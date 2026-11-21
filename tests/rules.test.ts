import { describe, expect, it } from "vitest";
import { placedModule } from "../src/model/catalog";
import { updateModule } from "../src/model/edit";
import { vec } from "../src/model/geometry";
import { type Link, type Mechanism, piece, placeMechanism, span } from "../src/model/mechanism";
import { PRESETS } from "../src/model/presets";
import { modeViolations, placedViolations, type Rule, restViolations, stateViolations, transitionViolations, zoneStatus } from "../src/model/rules";
import { transitionStates } from "../src/model/transition";
import type { Mode, Setup } from "../src/model/types";

const FINE = 400;

const rules = (list: readonly { rule: Rule }[]): Rule[] => [...new Set(list.map((v) => v.rule))].sort();
const messages = (list: readonly { message: string }[]): string[] => list.map((v) => v.message);

describe("every preset is physically plausible", () => {
    for (const preset of PRESETS) {
        describe(preset.name, () => {
            for (const mode of preset.modes) {
                it(`rests in ${mode.name} with free clearances, supported parts and seats facing the room`, () => {
                    expect(messages(modeViolations(preset, mode))).toEqual([]);
                });
            }
            for (const from of preset.modes) {
                for (const to of preset.modes) {
                    if (from === to) continue;
                    it(`moves from ${from.name} to ${to.name} without clipping, floating or leaving the room`, () => {
                        for (let i = 0; i <= FINE; i++) {
                            const states = transitionStates(preset, from, to, i / FINE);
                            const found = stateViolations(preset, states);
                            if (found.length > 0) throw new Error(`at ${(i / FINE).toFixed(4)}: ${messages(found).join("; ")}`);
                        }
                    });
                }
            }
        });
    }
});

describe("the rules catch implausible setups", () => {
    const setup: Setup = PRESETS[0]!;
    const [sleep, work] = setup.modes as [Mode, Mode];

    it("reports a fixed piece standing in the module's track, with the progress it is hit at", () => {
        const blocked = updateModule(setup, "post-1", { z: 1.0 });
        const found = transitionViolations(blocked, sleep, work, 60);
        expect(messages(found)).toContain("Bed hits Window shelf post (Window shelf)");
        const body = found.find((v) => v.message.startsWith("Module body hits"))!;
        expect(body.t).toBeGreaterThan(1 / 3);
        expect(body.t).toBeLessThan(2 / 3);
    });

    it("reports a bed lowered against the wall", () => {
        const found = restViolations(setup, { "wall-1": { slide: 1, bed: 1, desk: 0 } });
        expect(messages(found)).toContain("Bed (Shiftroom module) goes through a wall");
    });

    it("reports a desk opened with no room for the chair", () => {
        const found = restViolations(setup, { "wall-1": { slide: 0, bed: 0, desk: 1 } });
        expect(rules(found)).toContain("room");
        expect(messages(found)).toContain("Desk chair (Shiftroom module) is blocked by the wall");
    });

    it("reports an armchair turned to face the wall", () => {
        const found = modeViolations(updateModule(setup, "chair-1", { rotation: 270 }), sleep);
        expect(rules(found)).toEqual(["clearance", "seat"]);
    });

    it("reports a kitchen whose working space is taken", () => {
        const found = modeViolations(updateModule(setup, "chair-1", { x: 2.0 }), sleep);
        expect(messages(found).some((m) => m.startsWith("Kitchen working space (Kitchen) is blocked by Armchair"))).toBe(true);
    });

    it("reports wall cabinets that hang in the middle of the room", () => {
        const found = modeViolations(updateModule(setup, "kitchen-1", { z: 4.6 }), sleep);
        expect(messages(found)).toContain("Kitchen wall cabinets (Kitchen) must hang on a wall but stands free");
    });

    it("reports a module taller than the room", () => {
        const found = modeViolations({ ...setup, room: { ...setup.room, height: 2.3 } }, sleep);
        expect(rules(found)).toEqual(["ceiling"]);
    });

    it("reports a wardrobe that cannot be opened in the mode it is used in", () => {
        const found = modeViolations(updateModule(setup, "chair-1", { x: 0.55, z: 3.0, rotation: 0 }), sleep);
        expect(messages(found).some((m) => m.startsWith("Wardrobe doors (bed side) (Shiftroom module) is blocked"))).toBe(true);
    });

    it("reports a turning module placed too close to the window to turn", () => {
        const turning = PRESETS[3]!;
        const [tSleep, tWork] = turning.modes as [Mode, Mode];
        const found = transitionViolations(updateModule(turning, "post-1", { x: 1.0, z: 0.1 }), tSleep, tWork, 120);
        expect(found.some((v) => v.rule === "collision" && v.t > 1 / 3 && v.t < 2 / 3)).toBe(true);
    });
});

describe("the rules check mechanisms themselves", () => {
    const room: Setup = { version: 1, name: "Test", room: { width: 4, depth: 4, height: 2.6 }, modules: [], modes: [{ id: "m", name: "M", states: {} }] };
    const base: Link = { key: "base", label: "Base", joint: { kind: "fixed", origin: vec(1, 0, 1) }, pieces: [piece("block", "Base", "panel", span(0, 1, 0, 1, 0, 1), { rest: "floor" })] };
    const check = (links: Link[], extra: Partial<Mechanism> = {}): string[] =>
        messages(placedViolations(room, [placeMechanism("x", { links, zones: [], loads: [], ...extra }, { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: vec(0, 0, 0) })], true));

    it("accepts a well-built mechanism", () => {
        const lid: Link = {
            key: "lid",
            label: "Lid",
            parent: "base",
            joint: { kind: "hinge", origin: vec(0, 1, 0), axis: vec(0, 0, 1), value: 0, min: 0, max: Math.PI / 2 },
            pieces: [piece("lid", "Lid", "panel", span(0, 1, 0, 0.02, 0, 1))],
        };
        expect(check([base, lid])).toEqual([]);
    });

    it("reports a part that floats", () => {
        const floating: Link = { key: "shelf", label: "Shelf", joint: { kind: "fixed", origin: vec(2.5, 1, 2.5) }, pieces: [piece("s", "Shelf", "shelf", span(0, 0.5, 0, 0.02, 0, 0.3))] };
        expect(check([base, floating])).toEqual(["Shelf (x) floats"]);
    });

    it("reports a hinge that is not attached to its parent", () => {
        const loose: Link = {
            key: "flap",
            label: "Flap",
            parent: "base",
            joint: { kind: "hinge", origin: vec(0, 1.5, 0), axis: vec(0, 0, 1), value: 0, min: 0, max: 1 },
            pieces: [piece("f", "Flap", "panel", span(0, 0.5, 0, 0.02, 0, 0.5))],
        };
        expect(check([base, loose])).toEqual(["Flap (x) hinges on nothing"]);
    });

    it("reports a drawer pulled beyond its runner and a joint beyond its limit", () => {
        const drawer: Link = {
            key: "drawer",
            label: "Drawer",
            parent: "base",
            joint: { kind: "slide", origin: vec(0.1, 0.4, 0.1), axis: vec(1, 0, 0), value: 1.2, min: 0, max: 0.6 },
            pieces: [piece("d", "Drawer", "panel", span(0, 0.8, 0, 0.2, 0, 0.8), { solid: false })],
        };
        expect(check([base, drawer]).sort()).toEqual(["Drawer (x) moves beyond its joint limits", "Drawer (x) runs off the end of its Base"]);
    });

    it("reports a load whose legs do not reach the floor, and a part inside another", () => {
        const top: Link = {
            key: "top",
            label: "Table top",
            parent: "base",
            joint: { kind: "fixed", origin: vec(1, 0.7, 0) },
            pieces: [piece("t", "Table top", "table", span(0, 1, 0, 0.03, 0, 1))],
        };
        const leg: Link = {
            key: "leg",
            label: "Table leg",
            parent: "top",
            joint: { kind: "fixed", origin: vec(0.9, 0, 0.9) },
            pieces: [piece("l", "Table leg", "post", span(0, 0.05, -0.6, 0, 0, 0.05), { rest: "floor" })],
        };
        const crate: Link = { key: "crate", label: "Crate", joint: { kind: "fixed", origin: vec(1.5, 0, 1.5) }, pieces: [piece("c", "Crate", "panel", span(0, 0.4, 0, 0.4, 0, 0.4), { rest: "floor" })] };
        const found = check([base, top, leg, crate], { loads: [{ link: "top", label: "Table top", props: ["leg"] }] });
        expect(found).toContain("Table leg (x) does not reach the floor");
        expect(found).toContain("Base hits Crate");
    });
});

describe("rule checks run on placed presets", () => {
    it("places every part of a preset module inside the room", () => {
        const preset = PRESETS[0]!;
        const parts = preset.modules.flatMap((m) => placedModule(m, preset.modes[0]!.states[m.id]).parts);
        expect(parts.length).toBeGreaterThan(30);
    });
});

describe("zoneStatus", () => {
    it("shows only the free alternatives of a satisfied group", () => {
        const preset = PRESETS[0]!;
        const zones = zoneStatus(preset, { "wall-1": { slide: 0, bed: 1, desk: 0 } });
        const access = zones.filter((z) => z.zone.group === "wall-1:bed-access");
        expect(access.length).toBeGreaterThan(0);
        expect(access.every((z) => !z.blocked)).toBe(true);
    });
});
