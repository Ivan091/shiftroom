import { moduleType, placedFootprint, SLIDING } from "./catalog";
import { HEIGHT_LIMITS, ROOM_LIMITS } from "./setup";
import type { Mode, ModuleInstance, Room, Setup } from "./types";

/** The lowest `<prefix>-<n>` id not yet taken. */
export function nextId(prefix: string, used: Iterable<string>): string {
    const taken = new Set(used);
    let n = 1;
    while (taken.has(`${prefix}-${n}`)) n++;
    return `${prefix}-${n}`;
}

const round = (v: number): number => Math.round(v * 100) / 100;

/** Adds a module of the given type near the room centre; a sliding module gets a rail spanning the room width. */
export function addModule(setup: Setup, typeId: string): { setup: Setup; id: string } {
    const type = moduleType(typeId);
    const id = nextId(typeId, setup.modules.map((m) => m.id));
    const sameType = setup.modules.filter((m) => m.type === typeId).length;
    const config: Record<string, number> =
        typeId === "sliding-wall" ? { length: 4.0, travel: round(Math.max(0.5, setup.room.width - SLIDING.thickness)) } : {};
    const draft: ModuleInstance = { id, type: typeId, name: `${type.label} ${sameType + 1}`, x: 0, z: 0, rotation: 0, config };
    const fp = placedFootprint(draft);
    const module: ModuleInstance = {
        ...draft,
        x: round(Math.max(0, (setup.room.width - fp.w) / 2)),
        z: round(Math.max(0, (setup.room.depth - fp.d) / 2)),
    };
    return { setup: { ...setup, modules: [...setup.modules, module] }, id };
}

/** Removes a module and its state from every mode. */
export function removeModule(setup: Setup, id: string): Setup {
    return {
        ...setup,
        modules: setup.modules.filter((m) => m.id !== id),
        modes: setup.modes.map((mode) => {
            const states = { ...mode.states };
            delete states[id];
            return { ...mode, states };
        }),
    };
}

/** Changes placement, name or configuration of a module; the name is trimmed and a blank one keeps the old name. */
export function updateModule(setup: Setup, id: string, patch: Partial<Omit<ModuleInstance, "id" | "type">>): Setup {
    const { name, ...rest } = patch;
    const trimmed = name?.trim();
    return {
        ...setup,
        modules: setup.modules.map((m) =>
            m.id === id ? { ...m, ...rest, name: trimmed ? trimmed : m.name, config: { ...m.config, ...patch.config } } : m,
        ),
    };
}

/** Renames the setup; the name is trimmed and a blank one becomes "Untitled". */
export function renameSetup(setup: Setup, name: string): Setup {
    return { ...setup, name: name.trim() || "Untitled" };
}

/** Sets one state value of one module in one mode, clamped to 0..1. */
export function setModeParam(setup: Setup, modeId: string, moduleId: string, key: string, value: number): Setup {
    const v = Math.min(1, Math.max(0, value));
    return {
        ...setup,
        modes: setup.modes.map((mode) =>
            mode.id === modeId ? { ...mode, states: { ...mode.states, [moduleId]: { ...mode.states[moduleId], [key]: v } } } : mode,
        ),
    };
}

/** Adds a mode as a copy of an existing one, or with default states when there is none to copy. */
export function addMode(setup: Setup, name: string, copyOf?: string): { setup: Setup; id: string } {
    const id = nextId("mode", setup.modes.map((m) => m.id));
    const source = setup.modes.find((m) => m.id === copyOf);
    const mode: Mode = { id, name, states: source ? structuredClone(source.states) : {} };
    return { setup: { ...setup, modes: [...setup.modes, mode] }, id };
}

/** Renames a mode; blank names are ignored. */
export function renameMode(setup: Setup, id: string, name: string): Setup {
    const trimmed = name.trim();
    if (!trimmed) return setup;
    return { ...setup, modes: setup.modes.map((m) => (m.id === id ? { ...m, name: trimmed } : m)) };
}

/** Removes a mode; the last remaining mode stays, since a setup always has at least one. */
export function removeMode(setup: Setup, id: string): Setup {
    if (setup.modes.length <= 1) return setup;
    return { ...setup, modes: setup.modes.filter((m) => m.id !== id) };
}

/** Changes the room size, clamped to the supported range. */
export function setRoom(setup: Setup, room: Room): Setup {
    const fit = (v: number): number => Math.min(ROOM_LIMITS.max, Math.max(ROOM_LIMITS.min, v));
    const height = Math.min(HEIGHT_LIMITS.max, Math.max(HEIGHT_LIMITS.min, room.height));
    return { ...setup, room: { width: fit(room.width), depth: fit(room.depth), height } };
}
