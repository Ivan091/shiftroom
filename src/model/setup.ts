import { CATALOG } from "./catalog";
import type { Mode, ModuleInstance, ModuleState, Rotation, Setup } from "./types";

/** Outcome of reading a setup from untrusted JSON. */
export type ParseResult = { readonly ok: true; readonly setup: Setup } | { readonly ok: false; readonly error: string };

const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

/** Smallest and largest room side the configurator accepts, in metres. */
export const ROOM_LIMITS = { min: 1.5, max: 12 } as const;

class SetupError extends Error {}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function str(v: unknown, where: string): string {
    if (typeof v !== "string" || v.trim() === "") throw new SetupError(`${where} must be a non-empty string`);
    return v;
}

function num(v: unknown, where: string): number {
    if (typeof v !== "number" || !Number.isFinite(v)) throw new SetupError(`${where} must be a number`);
    return v;
}

function numbers(v: unknown, where: string): Record<string, number> {
    if (v === undefined) return {};
    if (!isRecord(v)) throw new SetupError(`${where} must be an object`);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, num(x, `${where}.${k}`)]));
}

function parseModule(v: unknown, index: number): ModuleInstance {
    const where = `modules[${index}]`;
    if (!isRecord(v)) throw new SetupError(`${where} must be an object`);
    const type = str(v.type, `${where}.type`);
    if (!CATALOG[type]) throw new SetupError(`${where}.type "${type}" is not a known module type`);
    const rotation = num(v.rotation ?? 0, `${where}.rotation`);
    if (!ROTATIONS.includes(rotation as Rotation)) throw new SetupError(`${where}.rotation must be 0, 90, 180 or 270`);
    return {
        id: str(v.id, `${where}.id`),
        type,
        name: str(v.name, `${where}.name`),
        x: num(v.x, `${where}.x`),
        z: num(v.z, `${where}.z`),
        rotation: rotation as Rotation,
        config: numbers(v.config, `${where}.config`),
    };
}

function parseMode(v: unknown, index: number, moduleIds: ReadonlySet<string>): Mode {
    const where = `modes[${index}]`;
    if (!isRecord(v)) throw new SetupError(`${where} must be an object`);
    const raw = v.states ?? {};
    if (!isRecord(raw)) throw new SetupError(`${where}.states must be an object`);
    const states: Record<string, ModuleState> = {};
    for (const [id, s] of Object.entries(raw)) {
        if (moduleIds.has(id)) states[id] = numbers(s, `${where}.states.${id}`);
    }
    return { id: str(v.id, `${where}.id`), name: str(v.name, `${where}.name`), states };
}

function unique(ids: readonly string[], what: string): void {
    const seen = new Set<string>();
    for (const id of ids) {
        if (seen.has(id)) throw new SetupError(`duplicate ${what} id "${id}"`);
        seen.add(id);
    }
}

/** Reads and validates a setup, such as an uploaded JSON file; mode states for unknown modules are dropped. */
export function parseSetup(input: unknown): ParseResult {
    try {
        if (!isRecord(input)) throw new SetupError("setup must be a JSON object");
        if (input.version !== 1) throw new SetupError("unsupported setup version (expected 1)");
        if (!isRecord(input.room)) throw new SetupError("room must be an object");
        const width = num(input.room.width, "room.width");
        const depth = num(input.room.depth, "room.depth");
        for (const [k, v] of [["width", width], ["depth", depth]] as const) {
            if (v < ROOM_LIMITS.min || v > ROOM_LIMITS.max) throw new SetupError(`room.${k} must be between ${ROOM_LIMITS.min} and ${ROOM_LIMITS.max} m`);
        }
        if (!Array.isArray(input.modules)) throw new SetupError("modules must be an array");
        if (!Array.isArray(input.modes) || input.modes.length === 0) throw new SetupError("modes must be a non-empty array");
        const modules = input.modules.map(parseModule);
        unique(modules.map((m) => m.id), "module");
        const ids = new Set(modules.map((m) => m.id));
        const modes = input.modes.map((m, i) => parseMode(m, i, ids));
        unique(modes.map((m) => m.id), "mode");
        return { ok: true, setup: { version: 1, name: str(input.name ?? "Untitled", "name"), room: { width, depth }, modules, modes } };
    } catch (e) {
        if (e instanceof SetupError) return { ok: false, error: e.message };
        throw e;
    }
}

/** Reads a setup from JSON text, reporting malformed JSON the same way as invalid content. */
export function parseSetupText(text: string): ParseResult {
    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        return { ok: false, error: "the file is not valid JSON" };
    }
    return parseSetup(json);
}

/** Pretty-printed JSON for download and local storage. */
export function serializeSetup(setup: Setup): string {
    return JSON.stringify(setup, null, 2);
}
