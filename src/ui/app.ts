import { CATALOG, moduleType, placedFootprint, placedParts, resolvedConfig, resolvedState } from "../model/catalog";
import { countByRule, groupViolations, isLong, type ViolationGroup } from "../model/grouping";
import { restViolations, type Rule, stateViolations, type TimedViolation, transitionViolations, zoneStatus } from "../model/rules";
import { addMode, addModule, removeMode, removeModule, renameMode, renameSetup, setModeParam, setRoom, updateModule } from "../model/edit";
import { PRESETS } from "../model/presets";
import { parseSetupText, serializeSetup } from "../model/setup";
import { activePhases, type Phase, phaseBoundaries, transitionStates } from "../model/transition";
import type { Mode, ModuleInstance, Rotation, Setup } from "../model/types";
import { RoomView } from "../view/scene";
import { download, h, numberField } from "./dom";

const STORAGE_KEY = "shiftroom.setup.v1";
const SNAP = 0.05;
const SECONDS_PER_PHASE = 1.6;
const PHASE_LABELS: Record<Phase, string> = { fold: "Fold", move: "Slide", unfold: "Unfold" };

const RULE_LABELS: Record<Rule, [string, string]> = {
    collision: ["clash", "clashes"],
    room: ["outside the room", "outside the room"],
    floor: ["below the floor", "below the floor"],
    ceiling: ["through the ceiling", "through the ceiling"],
    support: ["unsupported part", "unsupported parts"],
    joint: ["joint problem", "joint problems"],
    clearance: ["blocked clearance", "blocked clearances"],
    seat: ["seat facing a wall", "seats facing a wall"],
    view: ["screen view problem", "screen view problems"],
};

const snap = (v: number): number => Math.round(v / SNAP) * SNAP;
const round2 = (v: number): number => Math.round(v * 100) / 100;

const BACKUP_KEY = "shiftroom.setup.backup";

function loadStored(): { setup?: Setup; backedUp?: boolean } {
    try {
        const text = localStorage.getItem(STORAGE_KEY);
        if (!text) return {};
        const result = parseSetupText(text);
        if (result.ok) return { setup: result.setup };
        localStorage.setItem(BACKUP_KEY, text);
        return { backedUp: true };
    } catch {
        return {};
    }
}

function store(setup: Setup): void {
    try {
        localStorage.setItem(STORAGE_KEY, serializeSetup(setup));
    } catch {
        return;
    }
}

/** The configurator: owns the current setup and selection, and keeps the sidebar, transition bar and 3D view in step. */
export class App {
    private setup: Setup;
    private selected: string | undefined;
    private fromId: string;
    private toId: string;
    private editId: string;
    private t = 0;
    private playing: number | undefined;
    private dragStart: { x: number; z: number } | undefined;
    private clashCache: { key: string; list: TimedViolation[] } | undefined;
    private showZones = true;
    private violationsOpen: boolean | undefined;
    private positionInputs: { x: HTMLInputElement; z: HTMLInputElement } | undefined;
    private readonly view: RoomView;
    private readonly sidebar: HTMLElement;
    private readonly bar: HTMLElement;
    private readonly toast: HTMLElement;
    private slider!: HTMLInputElement;
    private stageLabel!: HTMLElement;
    private playButton!: HTMLButtonElement;
    private warnings!: HTMLElement;

    constructor(root: HTMLElement) {
        const stored = loadStored();
        this.setup = stored.setup ?? structuredClone(PRESETS[0]!) as Setup;
        this.fromId = this.setup.modes[0]!.id;
        this.toId = (this.setup.modes[1] ?? this.setup.modes[0]!).id;
        this.editId = this.fromId;

        this.sidebar = h("aside", { class: "sidebar" });
        const stage = h("div", { class: "stage" });
        this.bar = h("div", { class: "bar" });
        this.toast = h("div", { class: "toast", role: "status" });
        const viewport = h("div", { class: "viewport" });
        stage.append(viewport, h("button", { class: "ghost reframe", title: "Frame the whole room", onClick: () => this.view.frame() }, "Reset view"), this.bar);
        root.append(this.sidebar, stage, this.toast);

        this.view = new RoomView(viewport, {
            onPick: (id) => {
                if (id === this.selected) return;
                this.selected = id;
                this.renderSidebar();
                this.updateScene();
            },
            onDragMove: (id, dx, dz) => this.dragModule(id, dx, dz),
            onDragEnd: () => {
                if (!this.dragStart) return;
                this.dragStart = undefined;
                store(this.setup);
                this.renderSidebar();
            },
        });
        this.renderAll();
        if (stored.backedUp) this.flash("Could not restore your last setup; kept a copy");
    }

    private get from(): Mode {
        return this.setup.modes.find((m) => m.id === this.fromId)!;
    }

    private get to(): Mode {
        return this.setup.modes.find((m) => m.id === this.toId)!;
    }

    private commit(next: Setup, rerender = true): void {
        this.setup = next;
        const ids = next.modes.map((m) => m.id);
        if (!ids.includes(this.fromId)) this.fromId = ids[0]!;
        if (!ids.includes(this.toId)) this.toId = ids.find((id) => id !== this.fromId) ?? ids[0]!;
        if (!ids.includes(this.editId)) this.editId = this.fromId;
        if (this.selected && !next.modules.some((m) => m.id === this.selected)) this.selected = undefined;
        this.clashCache = undefined;
        store(next);
        if (rerender) this.renderAll();
        else this.updateScene();
    }

    private replace(setup: Setup): void {
        this.selected = undefined;
        this.fromId = setup.modes[0]!.id;
        this.toId = (setup.modes[1] ?? setup.modes[0]!).id;
        this.editId = this.fromId;
        this.t = 0;
        this.stop();
        this.commit(setup);
        this.view.frame();
    }

    private renderAll(): void {
        this.renderSidebar();
        this.renderBar();
        this.updateScene();
    }

    private flash(message: string): void {
        this.toast.textContent = message;
        this.toast.classList.add("show");
        setTimeout(() => this.toast.classList.remove("show"), 3500);
    }

    private dragModule(id: string, dx: number, dz: number): void {
        const module = this.setup.modules.find((m) => m.id === id);
        if (!module) return;
        this.dragStart ??= { x: module.x, z: module.z };
        const fp = placedFootprint(module);
        const fit = (v: number, size: number, room: number): number => (size <= room ? Math.min(room - size, Math.max(0, v)) : v);
        const x = round2(fit(snap(this.dragStart.x + dx), fp.w, this.setup.room.width));
        const z = round2(fit(snap(this.dragStart.z + dz), fp.d, this.setup.room.depth));
        if (x === module.x && z === module.z) return;
        this.setup = updateModule(this.setup, id, { x, z });
        this.clashCache = undefined;
        if (this.positionInputs) {
            this.positionInputs.x.value = String(x);
            this.positionInputs.z.value = String(z);
        }
        this.updateScene();
    }

    private updateScene(): void {
        const states = transitionStates(this.setup, this.from, this.to, this.t);
        const parts = this.setup.modules.flatMap((m) => placedParts(m, states[m.id]));
        const resting = this.t <= 0 || this.t >= 1;
        const now = resting ? restViolations(this.setup, states) : stateViolations(this.setup, states);
        this.view.setRoom(this.setup.room);
        this.view.setParts(parts, this.selected, new Set(now.flatMap((c) => c.partKeys)));
        this.view.setZones(this.showZones && resting ? zoneStatus(this.setup, states) : []);
        this.updateBarValues();
        this.renderWarnings();
    }

    private transitionWarnings(): TimedViolation[] {
        const key = `${this.fromId}>${this.toId}`;
        if (this.clashCache?.key !== key) this.clashCache = { key, list: transitionViolations(this.setup, this.from, this.to) };
        return this.clashCache.list;
    }

    private when(t: number): string {
        if (t <= 0) return `in ${this.from.name}`;
        if (t >= 1) return `in ${this.to.name}`;
        return `at ${Math.round(t * 100)}%`;
    }

    private rangeText(g: ViolationGroup): string {
        if (g.end - g.start < 1e-9) return this.when(g.start);
        const pct = (t: number): string => (t <= 0 ? this.from.name : t >= 1 ? this.to.name : `${Math.round(t * 100)}%`);
        return `from ${pct(g.start)} to ${pct(g.end)}`;
    }

    private renderWarnings(): void {
        const groups = groupViolations(this.transitionWarnings());
        this.warnings.replaceChildren();
        if (groups.length === 0) {
            this.warnings.append(h("span", { class: "ok" }, `Plausible: no clipping, everything supported and every clearance free from ${this.from.name} to ${this.to.name}`));
            return;
        }
        const long = isLong(groups);
        const open = !long || (this.violationsOpen ?? false);
        if (long) {
            const breakdown = countByRule(groups)
                .map(({ rule, count }) => `${count} ${RULE_LABELS[rule][count === 1 ? 0 : 1]}`)
                .join(", ");
            this.warnings.append(
                h(
                    "button",
                    {
                        class: "warn-summary",
                        "aria-expanded": String(open),
                        title: open ? "Collapse the list" : "Show every problem",
                        onClick: () => {
                            this.violationsOpen = !open;
                            this.renderWarnings();
                        },
                    },
                    `${open ? "▾" : "▸"} ${groups.length} problems: ${breakdown}`,
                ),
            );
        }
        if (!open) return;
        const items = groups.map((g) => {
            const times = g.count > 1 ? ` (×${g.count})` : "";
            return h("button", { class: "warn", title: "Jump to this point", onClick: () => this.seek(g.start) }, `${g.message}${times} ${this.rangeText(g)}`);
        });
        if (long) this.warnings.append(h("div", { class: "warn-list" }, ...items));
        else this.warnings.append(...items);
    }

    private seek(t: number): void {
        this.stop();
        this.t = t;
        this.updateScene();
    }

    private stageAt(t: number): string {
        if (t <= 0) return this.from.name;
        if (t >= 1) return this.to.name;
        const bounds = phaseBoundaries(this.setup, this.from, this.to);
        const current = bounds.find((b) => t <= b.end + 1e-9);
        return current ? `${PHASE_LABELS[current.phase]}…` : this.to.name;
    }

    private updateBarValues(): void {
        if (!this.slider) return;
        this.slider.value = String(Math.round(this.t * 1000));
        this.stageLabel.textContent = `${this.stageAt(this.t)} · ${Math.round(this.t * 100)}%`;
        this.playButton.textContent = this.playing === undefined ? "▶ Play" : "❚❚ Pause";
    }

    private play(): void {
        if (this.playing !== undefined) {
            this.stop();
            this.updateBarValues();
            return;
        }
        if (this.t >= 1) this.t = 0;
        const duration = Math.max(1, activePhases(this.setup, this.from, this.to).length) * SECONDS_PER_PHASE * 1000;
        let last = performance.now();
        const step = (now: number): void => {
            this.t = Math.min(1, this.t + (now - last) / duration);
            last = now;
            if (this.t >= 1) this.playing = undefined;
            else this.playing = requestAnimationFrame(step);
            this.updateScene();
        };
        this.playing = requestAnimationFrame(step);
        this.updateBarValues();
    }

    private stop(): void {
        if (this.playing !== undefined) cancelAnimationFrame(this.playing);
        this.playing = undefined;
    }

    private renderBar(): void {
        const modeSelect = (value: string, onChange: (id: string) => void): HTMLSelectElement =>
            h(
                "select",
                { onChange: (e: Event) => onChange((e.target as HTMLSelectElement).value) },
                ...this.setup.modes.map((m) => h("option", { value: m.id, selected: m.id === value }, m.name)),
            );
        this.slider = h("input", {
            type: "range",
            min: "0",
            max: "1000",
            value: String(Math.round(this.t * 1000)),
            class: "transition",
            "aria-label": "Transition progress",
            onInput: () => this.seek(Number(this.slider.value) / 1000),
        });
        this.stageLabel = h("span", { class: "stage-label" });
        this.playButton = h("button", { class: "primary", onClick: () => this.play() }, "▶ Play");
        this.warnings = h("div", { class: "warnings" });
        const bounds = phaseBoundaries(this.setup, this.from, this.to);
        let start = 0;
        const ticks = h(
            "div",
            { class: "ticks" },
            ...bounds.map((b) => {
                const el = h("span", { style: `left:${start * 100}%;width:${(b.end - start) * 100}%` }, PHASE_LABELS[b.phase]);
                start = b.end;
                return el;
            }),
        );
        this.bar.replaceChildren(
            h(
                "div",
                { class: "bar-row" },
                h("span", { class: "bar-title" }, "Transition"),
                modeSelect(this.fromId, (id) => {
                    this.fromId = id;
                    this.seek(0);
                    this.renderBar();
                }),
                h(
                    "button",
                    {
                        class: "ghost",
                        title: "Swap modes",
                        onClick: () => {
                            [this.fromId, this.toId] = [this.toId, this.fromId];
                            this.t = 1 - this.t;
                            this.renderBar();
                            this.updateScene();
                        },
                    },
                    "⇄",
                ),
                modeSelect(this.toId, (id) => {
                    this.toId = id;
                    this.seek(0);
                    this.renderBar();
                }),
                this.playButton,
                this.stageLabel,
            ),
            h("div", { class: "slider-wrap" }, this.slider, ticks),
            this.warnings,
        );
        this.updateBarValues();
        this.renderWarnings();
    }

    private showMode(modeId: string): void {
        this.stop();
        if (this.toId === modeId && this.fromId !== modeId) {
            this.t = 1;
        } else {
            this.fromId = modeId;
            if (this.toId === modeId) this.toId = this.setup.modes.find((m) => m.id !== modeId)?.id ?? modeId;
            this.t = 0;
        }
        this.renderBar();
    }

    private renderSidebar(): void {
        this.positionInputs = undefined;
        this.sidebar.replaceChildren(this.headerSection(), this.roomSection(), this.modulesSection(), this.selectedSection(), this.modesSection());
    }

    private headerSection(): HTMLElement {
        const file = h("input", {
            type: "file",
            accept: "application/json,.json",
            hidden: true,
            onChange: async () => {
                const f = file.files?.[0];
                if (!f) return;
                const result = parseSetupText(await f.text());
                file.value = "";
                if (result.ok) {
                    this.replace(result.setup);
                    this.flash(`Loaded “${result.setup.name}”`);
                } else {
                    this.flash(`Could not load: ${result.error}`);
                }
            },
        });
        return h(
            "header",
            { class: "brand" },
            h("div", { class: "brand-row" }, h("h1", {}, "Shiftroom"), h("span", { class: "badge" }, "configurator · POC")),
            h(
                "label",
                { class: "field" },
                h("span", {}, "Setup name"),
                h("input", { type: "text", value: this.setup.name, onChange: (e: Event) => this.commit(renameSetup(this.setup, (e.target as HTMLInputElement).value)) }),
            ),
            h(
                "div",
                { class: "row" },
                h(
                    "select",
                    {
                        "aria-label": "Load a preset",
                        onChange: (e: Event) => {
                            const preset = PRESETS[Number((e.target as HTMLSelectElement).value)];
                            if (preset) this.replace(structuredClone(preset) as Setup);
                        },
                    },
                    h("option", { value: "", selected: true, disabled: true }, "Load a preset…"),
                    ...PRESETS.map((p, i) => h("option", { value: String(i) }, p.name)),
                ),
            ),
            h(
                "div",
                { class: "row" },
                h("button", { onClick: () => download(`${this.setup.name.replace(/[^\w.-]+/g, "-")}.json`, serializeSetup(this.setup)) }, "Save JSON"),
                h("button", { onClick: () => file.click() }, "Load JSON"),
                file,
            ),
        );
    }

    private roomSection(): HTMLElement {
        const room = this.setup.room;
        return h(
            "section",
            {},
            h("h2", {}, "Room"),
            h(
                "div",
                { class: "grid3" },
                numberField("Width", room.width, 0.05, (v) => this.commit(setRoom(this.setup, { ...room, width: v }))).row,
                numberField("Depth", room.depth, 0.05, (v) => this.commit(setRoom(this.setup, { ...room, depth: v }))).row,
                numberField("Height", room.height, 0.05, (v) => this.commit(setRoom(this.setup, { ...room, height: v }))).row,
            ),
            h(
                "label",
                { class: "check" },
                h("input", {
                    type: "checkbox",
                    checked: this.showZones,
                    onChange: (e: Event) => {
                        this.showZones = (e.target as HTMLInputElement).checked;
                        this.updateScene();
                    },
                }),
                h("span", {}, "Show clearances (free floor a mode needs: green when free, red when blocked)"),
            ),
            h("p", { class: "hint" }, `Floor area ${(room.width * room.depth).toFixed(1)} m² · grid 0.5 m · window at the back wall`),
        );
    }

    private modulesSection(): HTMLElement {
        return h(
            "section",
            {},
            h("h2", {}, "Modules"),
            h(
                "ul",
                { class: "list" },
                ...this.setup.modules.map((m) =>
                    h(
                        "li",
                        { class: m.id === this.selected ? "active" : "" },
                        h(
                            "button",
                            {
                                class: "item",
                                onClick: () => {
                                    this.selected = m.id;
                                    this.renderSidebar();
                                    this.updateScene();
                                },
                            },
                            h("strong", {}, m.name),
                            h("small", {}, moduleType(m.type).label),
                        ),
                        h("button", { class: "ghost icon", title: `Remove ${m.name}`, onClick: () => this.commit(removeModule(this.setup, m.id)) }, "×"),
                    ),
                ),
            ),
            h(
                "div",
                { class: "add-grid" },
                ...Object.values(CATALOG).map((type) =>
                    h(
                        "button",
                        {
                            onClick: () => {
                                const { setup, id } = addModule(this.setup, type.id);
                                this.selected = id;
                                this.commit(setup);
                            },
                        },
                        `+ ${type.label}`,
                    ),
                ),
            ),
            h("p", { class: "hint" }, "Click a module in the room to select it, drag it to move it (0.05 m snap)."),
        );
    }

    private selectedSection(): HTMLElement | string {
        const m = this.setup.modules.find((x) => x.id === this.selected);
        if (!m) return "";
        const type = moduleType(m.type);
        const config = resolvedConfig(m);
        const patch = (p: Partial<Omit<ModuleInstance, "id" | "type">>): void => this.commit(updateModule(this.setup, m.id, p));
        const x = numberField("X (from left wall)", m.x, SNAP, (v) => patch({ x: round2(v) }));
        const z = numberField("Z (from window wall)", m.z, SNAP, (v) => patch({ z: round2(v) }));
        this.positionInputs = { x: x.input, z: z.input };
        const fp = placedFootprint(m);
        const configRows = type.config.map((spec) => {
            const value = config[spec.key]!;
            if (spec.options) {
                return h(
                    "label",
                    { class: "field" },
                    h("span", {}, spec.label),
                    h(
                        "select",
                        { onChange: (e: Event) => patch({ config: { [spec.key]: Number((e.target as HTMLSelectElement).value) } }) },
                        ...spec.options.map((o) => h("option", { value: String(o), selected: Math.abs(o - value) < 1e-6 }, `${o.toFixed(1)} m`)),
                    ),
                );
            }
            return numberField(spec.label, value, spec.step, (v) => patch({ config: { [spec.key]: Math.min(spec.max, Math.max(spec.min, v)) } })).row;
        });
        const fitRail =
            m.type === "sliding-wall"
                ? h(
                      "button",
                      {
                          onClick: () => {
                              const across = m.rotation % 180 === 0 ? this.setup.room.width : this.setup.room.depth;
                              const travel = round2(Math.max(0.5, across - 0.5));
                              patch({ x: m.rotation % 180 === 0 ? 0 : m.x, z: m.rotation % 180 === 0 ? m.z : 0, config: { travel } });
                          },
                      },
                      "Fit rail to room",
                  )
                : "";
        return h(
            "section",
            { class: "selected" },
            h("h2", {}, "Selected module"),
            h(
                "label",
                { class: "field" },
                h("span", {}, "Name"),
                h("input", { type: "text", value: m.name, onChange: (e: Event) => patch({ name: (e.target as HTMLInputElement).value }) }),
            ),
            h("div", { class: "grid2" }, x.row, z.row),
            h(
                "label",
                { class: "field" },
                h("span", {}, "Rotation"),
                h(
                    "select",
                    { onChange: (e: Event) => patch({ rotation: Number((e.target as HTMLSelectElement).value) as Rotation }) },
                    ...[0, 90, 180, 270].map((r) => h("option", { value: String(r), selected: r === m.rotation }, `${r}°`)),
                ),
            ),
            ...configRows,
            fitRail,
            h("p", { class: "hint" }, `Footprint at rest ${fp.w.toFixed(2)} × ${fp.d.toFixed(2)} m`),
        );
    }

    private modesSection(): HTMLElement {
        const edit = this.setup.modes.find((m) => m.id === this.editId)!;
        const movable = this.setup.modules.filter((m) => moduleType(m.type).params.length > 0);
        const letter = String.fromCharCode(65 + (this.setup.modes.length % 26));
        return h(
            "section",
            {},
            h("h2", {}, "Modes"),
            h(
                "ul",
                { class: "list modes" },
                ...this.setup.modes.map((mode) =>
                    h(
                        "li",
                        { class: mode.id === this.editId ? "active" : "" },
                        h("input", {
                            type: "radio",
                            name: "edit-mode",
                            title: "Edit this mode",
                            checked: mode.id === this.editId,
                            onChange: () => {
                                this.editId = mode.id;
                                this.showMode(mode.id);
                                this.renderSidebar();
                                this.updateScene();
                            },
                        }),
                        h("input", {
                            type: "text",
                            class: "mode-name",
                            value: mode.name,
                            "aria-label": "Mode name",
                            onChange: (e: Event) => this.commit(renameMode(this.setup, mode.id, (e.target as HTMLInputElement).value)),
                        }),
                        h(
                            "button",
                            {
                                class: "ghost icon",
                                title: `Remove ${mode.name}`,
                                disabled: this.setup.modes.length <= 1,
                                onClick: () => this.commit(removeMode(this.setup, mode.id)),
                            },
                            "×",
                        ),
                    ),
                ),
            ),
            h(
                "button",
                {
                    onClick: () => {
                        const { setup, id } = addMode(this.setup, `Mode ${letter}`, this.editId);
                        this.editId = id;
                        this.commit(setup);
                        this.showMode(id);
                        this.updateScene();
                    },
                },
                `+ Add mode (copy of ${edit.name})`,
            ),
            h("h3", {}, `State in “${edit.name}”`),
            movable.length === 0 ? h("p", { class: "hint" }, "Add a sliding wall module to give modes something to change.") : "",
            ...movable.map((m) => this.stateSliders(m, edit)),
        );
    }

    private stateSliders(m: ModuleInstance, mode: Mode): HTMLElement {
        const type = moduleType(m.type);
        const state = resolvedState(type, mode.states[m.id]);
        const travel = resolvedConfig(m).travel ?? 1;
        const describe = (key: string, v: number): string => {
            if (key === "slide") return `${(v * travel).toFixed(2)} m`;
            if (key === "turn") return v === 0 ? "bed side out" : v === 1 ? "desk side out" : `${Math.round(v * 100)}%`;
            return v === 0 ? "folded" : `${Math.round(v * 100)}%`;
        };
        return h(
            "div",
            { class: "state" },
            h("h4", {}, m.name),
            ...type.params.map((spec) => {
                const out = h("output", {}, describe(spec.key, state[spec.key]!));
                const input = h("input", {
                    type: "range",
                    min: "0",
                    max: "1",
                    step: "0.01",
                    value: String(state[spec.key]),
                    onInput: () => {
                        const v = Number(input.value);
                        out.textContent = describe(spec.key, v);
                        if (this.fromId !== mode.id || this.t !== 0) this.showMode(mode.id);
                        this.commit(setModeParam(this.setup, mode.id, m.id, spec.key, v), false);
                    },
                });
                return h("label", { class: "slider" }, h("span", {}, spec.label), input, out);
            }),
        );
    }
}
