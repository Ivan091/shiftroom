import type { Box, Finish, ModuleInstance, ModuleState, ParamSpec, Part, Rotation } from "./types";

/** A configuration value of a module type, such as its length. */
export interface ConfigSpec {
    readonly key: string;
    readonly label: string;
    readonly fallback: number;
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly options?: readonly number[];
}

/** A part in the module's local frame, before rotation and placement. */
export interface LocalPart {
    readonly key: string;
    readonly label: string;
    readonly finish: Finish;
    readonly box: Box;
    readonly moving: boolean;
    readonly solid: boolean;
}

/** A catalogue entry: parameters, configuration and parametric geometry of one kind of module. */
export interface ModuleType {
    readonly id: string;
    readonly label: string;
    readonly params: readonly ParamSpec[];
    readonly config: readonly ConfigSpec[];
    readonly footprint: (config: Readonly<Record<string, number>>) => { readonly w: number; readonly d: number };
    readonly localParts: (config: Readonly<Record<string, number>>, state: ModuleState) => readonly LocalPart[];
}

/** Dimensions of the Shiftroom sliding module, in metres. */
export const SLIDING = {
    thickness: 0.5,
    height: 2.3,
    activeLength: 2.0,
    lengths: [2.6, 4.0, 5.3],
    bedReach: 2.0,
    bedWidth: 1.6,
    deskReach: 0.7,
    deskWidth: 1.8,
} as const;

const box = (x: number, y: number, z: number, w: number, h: number, d: number): Box => ({ x, y, z, w, h, d });

const part = (key: string, label: string, finish: Finish, b: Box, moving = false, solid = true): LocalPart => ({
    key,
    label,
    finish,
    box: b,
    moving,
    solid,
});

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

const cfg = (config: Readonly<Record<string, number>>, spec: ConfigSpec): number => {
    const raw = config[spec.key];
    if (raw === undefined || !Number.isFinite(raw)) return spec.fallback;
    return Math.min(spec.max, Math.max(spec.min, raw));
};

const st = (state: ModuleState, spec: ParamSpec): number => {
    const raw = state[spec.key];
    return raw === undefined || !Number.isFinite(raw) ? spec.fallback : clamp01(raw);
};

const slideParam: ParamSpec = { key: "slide", label: "Position on rail", kind: "move", fallback: 0 };
const bedParam: ParamSpec = { key: "bed", label: "Bed", kind: "extend", fallback: 0 };
const deskParam: ParamSpec = { key: "desk", label: "Desk", kind: "extend", fallback: 0 };
const lengthSpec: ConfigSpec = {
    key: "length",
    label: "Module length",
    fallback: 4.0,
    min: 2.6,
    max: 5.3,
    step: 0.1,
    options: SLIDING.lengths,
};
const travelSpec: ConfigSpec = { key: "travel", label: "Rail travel", fallback: 2.6, min: 0.5, max: 8, step: 0.05 };

const slidingWall: ModuleType = {
    id: "sliding-wall",
    label: "Sliding wall module",
    params: [slideParam, bedParam, deskParam],
    config: [lengthSpec, travelSpec],
    footprint: (config) => ({ w: cfg(config, travelSpec) + SLIDING.thickness, d: cfg(config, lengthSpec) }),
    localParts: (config, state) => {
        const length = cfg(config, lengthSpec);
        const travel = cfg(config, travelSpec);
        const t = SLIDING.thickness;
        const active = Math.min(SLIDING.activeLength, length);
        const x0 = st(state, slideParam) * travel;
        const bed = st(state, bedParam) * SLIDING.bedReach;
        const desk = st(state, deskParam) * SLIDING.deskReach;
        const bedZ = (active - SLIDING.bedWidth) / 2;
        const deskZ = (active - SLIDING.deskWidth) / 2;
        const parts: LocalPart[] = [
            part("rail-a", "Rail", "rail", box(0, 0, 0.12, travel + t, 0.01, 0.06), false, false),
            part("rail-b", "Rail", "rail", box(0, 0, length - 0.18, travel + t, 0.01, 0.06), false, false),
            part("active", "Module body", "panel", box(x0, 0, 0, t, SLIDING.height, active), true),
            part("wardrobe", "Wardrobe", "wardrobe", box(x0, 0, active, t, SLIDING.height, length - active), true),
        ];
        if (length - active > 0.01) {
            parts.push(
                part("wardrobe-split", "Wardrobe", "panel", box(x0 + t / 2 - 0.01, 0, active, 0.02, SLIDING.height + 0.01, length - active), true, false),
            );
        }
        if (bed > 0.005) {
            const bx = x0 + t;
            parts.push(part("bed", "Bed", "bed", box(bx, 0.18, bedZ, bed, 0.17, SLIDING.bedWidth), true));
            parts.push(part("mattress", "Bed", "mattress", box(bx + 0.02, 0.35, bedZ + 0.03, Math.max(0, bed - 0.04), 0.18, SLIDING.bedWidth - 0.06), true));
            parts.push(part("bed-leg-a", "Bed", "post", box(bx + bed - 0.06, 0, bedZ + 0.05, 0.04, 0.18, 0.04), true));
            parts.push(part("bed-leg-b", "Bed", "post", box(bx + bed - 0.06, 0, bedZ + SLIDING.bedWidth - 0.09, 0.04, 0.18, 0.04), true));
        }
        if (desk > 0.005) {
            const dx = x0 - desk;
            parts.push(part("desk", "Desk", "desk", box(dx, 0.72, deskZ, desk, 0.03, SLIDING.deskWidth), true));
            parts.push(part("desk-leg-a", "Desk", "post", box(dx + 0.02, 0, deskZ + 0.05, 0.03, 0.72, 0.03), true));
            parts.push(part("desk-leg-b", "Desk", "post", box(dx + 0.02, 0, deskZ + SLIDING.deskWidth - 0.08, 0.03, 0.72, 0.03), true));
        }
        return parts;
    },
};

const kitchenLength: ConfigSpec = { key: "length", label: "Run length", fallback: 2.4, min: 0.6, max: 5, step: 0.1 };

const kitchen: ModuleType = {
    id: "kitchen",
    label: "Kitchen run",
    params: [],
    config: [kitchenLength],
    footprint: (config) => ({ w: cfg(config, kitchenLength), d: 0.6 }),
    localParts: (config) => {
        const len = cfg(config, kitchenLength);
        return [
            part("base", "Kitchen base", "cabinet", box(0, 0, 0.02, len, 0.86, 0.58)),
            part("top", "Kitchen base", "counter", box(0, 0.86, 0, len, 0.04, 0.6)),
            part("upper", "Kitchen wall cabinets", "cabinet", box(0, 1.45, 0, len, 0.7, 0.35)),
        ];
    },
};

const windowPost: ModuleType = {
    id: "window-post",
    label: "Window shelf post",
    params: [],
    config: [],
    footprint: () => ({ w: 0.4, d: 0.3 }),
    localParts: () => [
        part("post", "Window shelf post", "post", box(0.17, 0, 0.12, 0.06, 1.05, 0.06)),
        part("shelf", "Window shelf post", "shelf", box(0, 1.05, 0, 0.4, 0.03, 0.3)),
        part("base", "Window shelf post", "shelf", box(0.1, 0, 0.05, 0.2, 0.02, 0.2)),
    ],
};

const armchair: ModuleType = {
    id: "armchair",
    label: "Armchair with table",
    params: [],
    config: [],
    footprint: () => ({ w: 1.4, d: 0.85 }),
    localParts: () => [
        part("seat", "Armchair", "chair", box(0, 0, 0, 0.8, 0.42, 0.85)),
        part("back", "Armchair", "chair", box(0, 0.42, 0.65, 0.8, 0.5, 0.2)),
        part("arm-a", "Armchair", "chair", box(0, 0.42, 0, 0.12, 0.2, 0.65)),
        part("arm-b", "Armchair", "chair", box(0.68, 0.42, 0, 0.12, 0.2, 0.65)),
        part("table-top", "Side table", "table", box(0.9, 0.52, 0.15, 0.5, 0.03, 0.5)),
        part("table-leg", "Side table", "post", box(1.13, 0, 0.38, 0.04, 0.52, 0.04)),
    ],
};

/** Every module type the configurator offers, keyed by id. */
export const CATALOG: Readonly<Record<string, ModuleType>> = {
    [slidingWall.id]: slidingWall,
    [kitchen.id]: kitchen,
    [windowPost.id]: windowPost,
    [armchair.id]: armchair,
};

/** Looks up a module type; unknown ids are rejected when a setup is parsed, so this only fails on programmer error. */
export function moduleType(id: string): ModuleType {
    const found = CATALOG[id];
    if (!found) throw new Error(`Unknown module type: ${id}`);
    return found;
}

/** Configuration of a module with defaults filled in and values clamped to their range. */
export function resolvedConfig(module: ModuleInstance): Record<string, number> {
    const type = moduleType(module.type);
    return Object.fromEntries(type.config.map((spec) => [spec.key, cfg(module.config, spec)]));
}

/** State values for every parameter of a module type, with defaults filled in and clamped to 0..1. */
export function resolvedState(type: ModuleType, state: ModuleState | undefined): Record<string, number> {
    return Object.fromEntries(type.params.map((spec) => [spec.key, st(state ?? {}, spec)]));
}

function rotatePoint(x: number, z: number, rotation: Rotation): [number, number] {
    switch (rotation) {
        case 0:
            return [x, z];
        case 90:
            return [-z, x];
        case 180:
            return [-x, -z];
        case 270:
            return [z, -x];
    }
}

function rotateBox(b: Box, rotation: Rotation): Box {
    const [ax, az] = rotatePoint(b.x, b.z, rotation);
    const [bx, bz] = rotatePoint(b.x + b.w, b.z + b.d, rotation);
    return { x: Math.min(ax, bx), y: b.y, z: Math.min(az, bz), w: Math.abs(bx - ax), h: b.h, d: Math.abs(bz - az) };
}

/**
 * Rest footprint of a placed module in room coordinates. The module's anchor (x, z) is always the
 * minimum corner of this rectangle, whatever the rotation, so turning a module keeps it in place.
 */
export function placedFootprint(module: ModuleInstance): Box {
    const type = moduleType(module.type);
    const { w, d } = type.footprint(resolvedConfig(module));
    const r = rotateBox(box(0, 0, 0, w, 0, d), module.rotation);
    return { x: module.x, y: 0, z: module.z, w: r.w, h: 0, d: r.d };
}

/** Parts of a module in room coordinates for the given state. */
export function placedParts(module: ModuleInstance, state: ModuleState | undefined): Part[] {
    const type = moduleType(module.type);
    const config = resolvedConfig(module);
    const { w, d } = type.footprint(config);
    const rest = rotateBox(box(0, 0, 0, w, 0, d), module.rotation);
    const dx = module.x - rest.x;
    const dz = module.z - rest.z;
    return type.localParts(config, resolvedState(type, state)).map((p) => {
        const r = rotateBox(p.box, module.rotation);
        return {
            key: `${module.id}:${p.key}`,
            label: p.label,
            finish: p.finish,
            moving: p.moving,
            solid: p.solid,
            box: { ...r, x: r.x + dx, z: r.z + dz },
        };
    });
}
