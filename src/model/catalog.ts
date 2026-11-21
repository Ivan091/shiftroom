import { compose, type Pose, translation, vec, type Vec3 } from "./geometry";
import { box, type Link, type LoadSpec, type Mechanism, piece, type Piece, placeMechanism, type ScreenSpec, span, type ZoneSpec } from "./mechanism";
import type { Box, ModuleInstance, ModuleState, ParamSpec, Part, PlacedModule, Rotation } from "./types";

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

/** A catalogue entry: parameters, configuration and the jointed mechanism of one kind of module. */
export interface ModuleType {
    readonly id: string;
    readonly label: string;
    readonly params: readonly ParamSpec[];
    readonly config: readonly ConfigSpec[];
    readonly footprint: (config: Readonly<Record<string, number>>) => { readonly w: number; readonly d: number };
    readonly mechanism: (config: Readonly<Record<string, number>>, state: ModuleState) => Mechanism;
}

/** Dimensions of the Shiftroom carcass, in metres; see docs/mechanisms.md for the drawings. */
export const SLIDING = {
    thickness: 0.5,
    height: 2.35,
    activeLength: 2.0,
    lengths: [2.6, 4.0, 5.3],
    board: 0.02,
    spineX: 0.135,
    spineDepth: 0.03,
    plinth: 0.08,
} as const;

/**
 * The fold-down bed on the +x face. Its frame turns about a horizontal pivot near the floor; stored
 * upright, its underside closes the bed cavity. `head` is how far the frame reaches behind the pivot.
 */
export const BED = {
    pivotX: 0.32,
    pivotY: 0.35,
    pivotZ: 0.16,
    head: 0.1,
    length: 2.0,
    width: 1.68,
    rail: 0.04,
    frameDepth: 0.25,
    deck: 0.05,
    below: 0.14,
    legAt: 1.8,
    leg: 0.04,
} as const;

/**
 * The fall-front desk on the -x face. The leaf hangs on flap hinges at its back edge, `hingeX`
 * inside the face at desk height: level it reaches `depth` out of the face, raised it stands upright
 * in front of the screen compartment with its top facing in. Two gate legs, which close the lower
 * cavity as doors, swing out under its front half.
 */
export const DESK = {
    hingeX: 0.025,
    hingeY: 0.75,
    depth: 0.7,
    width: 1.8,
    z: 0.1,
    top: 0.025,
    gateX: 0,
    gate: 0.02,
    gateLength: 0.66,
} as const;

/** Length of the leaf from its hinge to its front edge. */
const LEAF = DESK.depth + DESK.hingeX;

/** Height of the raised leaf's top edge, which is also the roof of the screen compartment. */
export const DESK_CLOSED_TOP = DESK.hingeY + LEAF;

/**
 * The hidden workstation behind the leaf: a 27-inch monitor on a two-segment wall arm in the screen
 * compartment above the desk, a one-litre mini PC behind the grille below it, and a keyboard and
 * mouse that ride on the leaf. Sizes are those of real equipment; see docs/mechanisms.md.
 */
export const WORKSTATION = {
    screen: { w: 0.615, h: 0.37, d: 0.05 },
    screenX: 0.03,
    screenY: 0.8,
    headOffset: 0.03,
    armLength: 0.15,
    arm: 0.03,
    armY: 0.9,
    pc: { w: 0.035, h: 0.183, d: 0.179 },
    pcX: 0.055,
    pcY: 0.1,
    pcGap: 0.08,
    keyboard: { w: 0.36, d: 0.13, h: 0.025 },
    keyboardFromEdge: 0.1,
    eyeBehindEdge: 0.2,
    eyeHeight: 1.2,
} as const;

/** Where the leaf, the gate legs and the screen arm move within the desk's 0..1 motion; closing runs it backwards. */
export const DESK_STEPS = { leaf: [0, 0.35], gates: [0.35, 0.55], screen: [0.6, 1] } as const;

/** The turning module: how far it pulls away from the wall before it turns. */
export const TURNING = { pull: 0.85, pin: 0.03 } as const;

const QUARTER = Math.PI / 2;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Progress of a sub-step that runs while `v` goes from `from` to `to`. */
const ramp = (v: number, from: number, to: number): number => clamp01((v - from) / (to - from));

const isOpen = (v: number): boolean => v >= 1 - 1e-6;
const isClosed = (v: number): boolean => v <= 1e-6;

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
const turnParam: ParamSpec = { key: "turn", label: "Pull out, turn, push back", kind: "move", fallback: 0 };
const bedParam: ParamSpec = { key: "bed", label: "Bed", kind: "extend", fallback: 0 };
const deskParam: ParamSpec = { key: "desk", label: "Workstation", kind: "extend", fallback: 0 };
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

const t = SLIDING.thickness;
const b = SLIDING.board;
const top = SLIDING.height - b;
const active = SLIDING.activeLength;

/** Panels of the bed and desk section, z 0..2.0: the cavities are the empty space between them. */
function activeCarcass(): Piece[] {
    const label = "Module body";
    const sx = SLIDING.spineX;
    const sx1 = sx + SLIDING.spineDepth;
    const bedPivotZ1 = BED.pivotZ + BED.width;
    const mid = deskMid();
    const ws = WORKSTATION;
    const bracketY = ws.armY;
    const pcZ0 = mid - ws.pc.d / 2;
    const pcZ1 = mid + ws.pc.d / 2;
    return [
        piece("plinth", label, "panel", span(sx1, t - b, 0, SLIDING.plinth, b, active - b), { rest: "floor" }),
        piece("bottom", label, "panel", span(sx, t, SLIDING.plinth, SLIDING.plinth + b, b, active - b)),
        piece("spine", label, "panel", span(sx, sx1, 0, top, b, active - b), { rest: "floor" }),
        piece("end", label, "panel", span(0, t, 0, top, 0, b), { rest: "floor" }),
        piece("divider", label, "panel", span(0, t, 0, top, active - b, active), { rest: "floor" }),
        piece("top", label, "panel", span(0, t, top, SLIDING.height, 0, active)),
        piece("shelves", "Shelves above the desk", "panel", span(0, sx, DESK_CLOSED_TOP, top, b, active - b)),
        piece("desk-board", "Desk hinge rail", "panel", span(DESK.hingeX, sx, DESK.hingeY - DESK.top, DESK.hingeY, b, active - b)),
        piece("frame-a", label, "panel", span(0, DESK.gate, DESK.hingeY - DESK.top, DESK_CLOSED_TOP, b, DESK.z)),
        piece("frame-b", label, "panel", span(0, DESK.gate, DESK.hingeY - DESK.top, DESK_CLOSED_TOP, DESK.z + DESK.width, active - b)),
        piece("grille", "PC air grille", "grille", span(0, DESK.gate, 0.02, DESK.hingeY - DESK.top, gateAZ() + DESK.gateLength, gateBZ() - DESK.gateLength)),
        piece("pc-shelf", "PC shelf", "panel", span(DESK.gate, sx, ws.pcY - b, ws.pcY, pcZ0 - ws.pcGap - 0.1, pcZ1 + ws.pcGap + 0.1)),
        piece("cable-duct", "Cable duct", "arm", span(sx - 0.02, sx, ws.pcY + ws.pc.h + 0.02, bracketY + 0.02, pcZ1 + ws.pcGap + 0.015, pcZ1 + ws.pcGap + 0.055)),
        piece("arm-bracket", "Monitor arm wall plate", "arm", span(armPivotX() - ws.arm / 2, sx, bracketY - 0.04, bracketY, mid - 0.03, mid + 0.03)),
        piece("bracket-a", "Bed pivot bracket", "post", span(BED.pivotX - 0.04, BED.pivotX + 0.04, BED.pivotY - 0.04, BED.pivotY + 0.04, b, BED.pivotZ)),
        piece("bracket-b", "Bed pivot bracket", "post", span(BED.pivotX - 0.04, BED.pivotX + 0.04, BED.pivotY - 0.04, BED.pivotY + 0.04, bedPivotZ1, active - b)),
        piece("stile-a", "Gate leg hinge stile", "panel", span(DESK.gateX, DESK.gateX + DESK.gate, 0, DESK.hingeY - DESK.top, b, gateAZ())),
        piece("stile-b", "Gate leg hinge stile", "panel", span(DESK.gateX, DESK.gateX + DESK.gate, 0, DESK.hingeY - DESK.top, gateBZ(), active - b)),
    ];
}

const deskMid = (): number => DESK.z + DESK.width / 2;
const armPivotX = (): number => WORKSTATION.screenX + WORKSTATION.screen.d + WORKSTATION.headOffset;
const gateAZ = (): number => DESK.z + 0.01;
const gateBZ = (): number => DESK.z + DESK.width - 0.01;

/**
 * The bed frame and its two folding legs. `open` runs from 0 (stored upright) to 1 (lowered). The
 * frame turns down over the whole range; the legs swing out from under the deck between 35 % and
 * 80 %, so they are straight before the frame comes down onto them.
 */
function bedLinks(parent: string, open: number): Link[] {
    const angle = QUARTER * (1 - open);
    const legs = -QUARTER * (1 - ramp(open, 0.35, 0.8));
    const x0 = -BED.head;
    const x1 = BED.length - BED.head;
    const y0 = -BED.below;
    const y1 = y0 + BED.frameDepth;
    const deckTop = y0 + BED.deck;
    const w = BED.width;
    const r = BED.rail;
    const legReach = BED.pivotY - BED.below;
    const label = "Bed";
    const leg = (key: string, z: number): Link => ({
        key,
        label: "Bed leg",
        parent: "bed",
        joint: { kind: "hinge", origin: vec(BED.legAt, y0, z), axis: vec(0, 0, 1), value: legs, min: -QUARTER, max: 0 },
        pieces: [piece("leg", "Bed leg", "post", span(0, BED.leg, -legReach, 0, 0, BED.leg), isOpen(open) ? { rest: "floor" } : {})],
    });
    return [
        {
            key: "bed",
            label,
            parent,
            joint: { kind: "hinge", origin: vec(BED.pivotX, BED.pivotY, BED.pivotZ), axis: vec(0, 0, 1), value: angle, min: 0, max: QUARTER },
            pieces: [
                piece("rail-a", label, "bed", span(x0, x1, y0, y1, 0, r)),
                piece("rail-b", label, "bed", span(x0, x1, y0, y1, w - r, w)),
                piece("deck", label, "bed", span(x0, x1, y0, deckTop, r, w - r)),
                piece("head", label, "bed", span(x0, x0 + b, deckTop, y1, r, w - r)),
                piece("foot", label, "bed", span(x1 - b, x1, deckTop, y1, r, w - r)),
                piece("mattress", label, "mattress", span(x0 + b, x1 - b, deckTop, y1, r, w - r)),
            ],
        },
        leg("leg-a", r),
        leg("leg-b", w - r - BED.leg),
    ];
}

/** Where the lowered bed ends, measured from the module's back (x = 0). */
export const BED_FOOT = BED.pivotX - BED.head + BED.length;

/**
 * The desk leaf with the keyboard on it, its two gate legs and the screen on its arm. Opening runs
 * the steps of `DESK_STEPS` in order: the leaf falls from upright to level, the gate legs swing out
 * under it, then the arm carries the screen straight out of its compartment. Closing runs them in
 * reverse, so the screen is home before the leaf rises in front of it.
 */
function deskLinks(parent: string, open: number): Link[] {
    const leaf = -QUARTER * (1 - ramp(open, ...DESK_STEPS.leaf));
    const swing = ramp(open, ...DESK_STEPS.gates);
    const reach = QUARTER * ramp(open, ...DESK_STEPS.screen);
    const gateHeight = DESK.hingeY - DESK.top;
    const loaded = isOpen(open) ? { rest: "floor" as const } : {};
    const ws = WORKSTATION;
    const mid = deskMid() - DESK.z;
    const kb = ws.keyboard;
    const kbFront = -LEAF + ws.keyboardFromEdge;
    const L = ws.armLength;
    const a = ws.arm;
    const headY = ws.armY + 2 * a;
    const screenBack = -ws.headOffset;
    const screenFront = screenBack - ws.screen.d;
    return [
        {
            key: "desk",
            label: "Desk",
            parent,
            joint: { kind: "hinge", origin: vec(DESK.hingeX, DESK.hingeY, DESK.z), axis: vec(0, 0, 1), value: leaf, min: -QUARTER, max: 0 },
            pieces: [piece("top", "Desk", "desk", span(-LEAF, 0, -DESK.top, 0, 0, DESK.width))],
        },
        {
            key: "keyboard",
            label: "Keyboard and mouse",
            parent: "desk",
            joint: { kind: "fixed", origin: vec(0, 0, 0) },
            pieces: [
                piece("keyboard", "Keyboard", "keyboard", span(kbFront, kbFront + kb.d, 0, kb.h, mid - kb.w / 2, mid + kb.w / 2)),
                piece("mouse", "Mouse", "keyboard", span(kbFront + 0.005, kbFront + 0.125, 0, 0.035, mid + kb.w / 2 + 0.08, mid + kb.w / 2 + 0.145)),
            ],
        },
        {
            key: "gate-a",
            label: "Desk gate leg",
            parent,
            joint: { kind: "hinge", origin: vec(DESK.gateX, 0, gateAZ()), axis: vec(0, 1, 0), value: -QUARTER * swing, min: -QUARTER, max: 0 },
            pieces: [piece("gate", "Desk gate leg", "desk", span(0, DESK.gate, 0, gateHeight, 0, DESK.gateLength), loaded)],
        },
        {
            key: "gate-b",
            label: "Desk gate leg",
            parent,
            joint: { kind: "hinge", origin: vec(DESK.gateX, 0, gateBZ()), axis: vec(0, 1, 0), value: QUARTER * swing, min: 0, max: QUARTER },
            pieces: [piece("gate", "Desk gate leg", "desk", span(0, DESK.gate, 0, gateHeight, -DESK.gateLength, 0), loaded)],
        },
        {
            key: "arm-1",
            label: "Monitor arm",
            parent,
            joint: { kind: "hinge", origin: vec(armPivotX(), ws.armY, deskMid()), axis: vec(0, 1, 0), value: -reach, min: -QUARTER, max: 0 },
            pieces: [piece("segment", "Monitor arm", "arm", span(-a / 2, a / 2, 0, a, 0, L))],
        },
        {
            key: "arm-2",
            label: "Monitor arm",
            parent: "arm-1",
            joint: { kind: "hinge", origin: vec(0, a, L), axis: vec(0, 1, 0), value: -Math.PI + 2 * reach, min: -Math.PI, max: 0 },
            pieces: [piece("segment", "Monitor arm", "arm", span(-a / 2, a / 2, 0, a, 0, L))],
        },
        {
            key: "screen",
            label: "Monitor",
            parent: "arm-2",
            joint: { kind: "hinge", origin: vec(0, a, L), axis: vec(0, 1, 0), value: Math.PI - reach, min: QUARTER, max: Math.PI },
            pieces: [
                piece("head", "Monitor arm", "arm", span(screenBack, a / 2, 0, 0.08, -0.05, 0.05)),
                piece("monitor", "Monitor", "screen", span(screenFront, screenBack, ws.screenY - headY, ws.screenY + ws.screen.h - headY, -ws.screen.w / 2, ws.screen.w / 2)),
                piece("display", "Monitor", "display", span(screenFront - 0.002, screenFront, ws.screenY + 0.012 - headY, ws.screenY + ws.screen.h - 0.012 - headY, -ws.screen.w / 2 + 0.008, ws.screen.w / 2 - 0.008), { solid: false }),
            ],
        },
    ];
}

/** The screen's face and the seated eye it is checked against, while the desk is open. */
function screenSpecs(link: string): ScreenSpec[] {
    const ws = WORKSTATION;
    const headY = ws.armY + 2 * ws.arm;
    const face = -ws.headOffset - ws.screen.d;
    return [
        {
            key: "screen",
            label: "Monitor",
            link: "screen",
            center: vec(face, ws.screenY + ws.screen.h / 2 - headY, 0),
            normal: vec(-1, 0, 0),
            halfHeight: ws.screen.h / 2,
            eye: { link, point: vec(-DESK.depth - ws.eyeBehindEdge, ws.eyeHeight, deskMid()) },
        },
    ];
}

/** Air gaps around the PC that must stay free in every state: towards the grille, and at both ends where it breathes in and out. */
function ventZones(link: string): ZoneSpec[] {
    const ws = WORKSTATION;
    const mid = deskMid();
    const x0 = ws.pcX;
    const x1 = ws.pcX + ws.pc.w;
    const y0 = ws.pcY;
    const y1 = ws.pcY + ws.pc.h;
    const z0 = mid - ws.pc.d / 2;
    const z1 = mid + ws.pc.d / 2;
    return [
        { key: "pc-side", label: "PC air gap behind the grille", link, box: span(DESK.gate, x0, y0, y1, z0, z1) },
        { key: "pc-intake", label: "PC air intake", link, box: span(x0, x1, y0, y1, z0 - ws.pcGap, z0) },
        { key: "pc-exhaust", label: "PC exhaust", link, box: span(x0, x1, y0, y1, z1, z1 + ws.pcGap) },
    ];
}

/** The one-litre mini PC, standing on its edge on a shelf behind the grille. */
function pcLink(parent: string): Link {
    const ws = WORKSTATION;
    const mid = deskMid();
    return {
        key: "pc",
        label: "PC",
        parent,
        joint: { kind: "fixed", origin: vec(0, 0, 0) },
        pieces: [piece("pc", "PC", "computer", span(ws.pcX, ws.pcX + ws.pc.w, ws.pcY, ws.pcY + ws.pc.h, mid - ws.pc.d / 2, mid + ws.pc.d / 2))],
    };
}

/** Clearances, loads and the screen of the bed and desk section, in the carcass frame that holds them. */
function activeZones(link: string, bed: number, desk: number): { zones: ZoneSpec[]; loads: LoadSpec[]; screens: ScreenSpec[] } {
    const zones: ZoneSpec[] = ventZones(link);
    const loads: LoadSpec[] = [];
    const screens: ScreenSpec[] = [];
    const z0 = BED.pivotZ;
    const z1 = BED.pivotZ + BED.width;
    if (isOpen(bed)) {
        zones.push(
            { key: "bed-foot", label: "Space to get into bed", link, group: "bed-access", box: span(BED_FOOT, BED_FOOT + 0.5, 0, 1.8, z0, z1) },
            { key: "bed-side-a", label: "Space to get into bed", link, group: "bed-access", box: span(t, BED_FOOT, 0, 1.8, z0 - 0.5, z0) },
            { key: "bed-side-b", label: "Space to get into bed", link, group: "bed-access", box: span(t, BED_FOOT, 0, 1.8, z1, z1 + 0.5) },
        );
        loads.push({ link: "bed", label: "Bed", props: ["leg-a", "leg-b"] });
    }
    if (isOpen(desk)) {
        const mid = DESK.z + DESK.width / 2;
        zones.push(
            { key: "desk-knees", label: "Knee room under the desk", link, box: span(-DESK.depth, 0, 0, 0.62, mid - 0.4, mid + 0.4) },
            { key: "desk-chair", label: "Desk chair", link, box: span(-DESK.depth - 0.7, -DESK.depth, 0, 1.0, mid - 0.35, mid + 0.35) },
        );
        loads.push({ link: "desk", label: "Desk", props: ["gate-a", "gate-b"] });
        screens.push(...screenSpecs(link));
    }
    return { zones, loads, screens };
}

const slidingWall: ModuleType = {
    id: "sliding-wall",
    label: "Sliding wall module",
    params: [slideParam, bedParam, deskParam],
    config: [lengthSpec, travelSpec],
    footprint: (config) => ({ w: cfg(config, travelSpec) + t, d: cfg(config, lengthSpec) }),
    mechanism: (config, state) => {
        const length = cfg(config, lengthSpec);
        const travel = cfg(config, travelSpec);
        const bed = st(state, bedParam);
        const desk = st(state, deskParam);
        const wardrobe = length - active;
        const pieces = activeCarcass();
        const zones: ZoneSpec[] = [];
        if (wardrobe > 0.01) {
            const spine = t / 2;
            pieces.push(
                piece("wardrobe-plinth", "Wardrobe", "panel", span(b, t - b, 0, SLIDING.plinth, active, length - b), { rest: "floor" }),
                piece("wardrobe-desk-side", "Wardrobe", "wardrobe", span(0, spine - b / 2, SLIDING.plinth, top, active, length - b)),
                piece("wardrobe-spine", "Wardrobe", "panel", span(spine - b / 2, spine + b / 2, SLIDING.plinth, top, active, length - b)),
                piece("wardrobe-bed-side", "Wardrobe", "wardrobe", span(spine + b / 2, t, SLIDING.plinth, top, active, length - b)),
                piece("wardrobe-end", "Wardrobe", "panel", span(0, t, 0, top, length - b, length), { rest: "floor" }),
                piece("wardrobe-top", "Wardrobe", "panel", span(0, t, top, SLIDING.height, active, length)),
            );
            if (isClosed(desk)) {
                zones.push({ key: "wardrobe-bed-side", label: "Wardrobe doors (bed side)", link: "body", box: span(t, t + 0.5, 0, 2.1, active, length - b) });
            }
            if (isClosed(bed)) {
                zones.push({ key: "wardrobe-desk-side", label: "Wardrobe doors (desk side)", link: "body", box: span(-0.5, 0, 0, 2.1, active, length - b) });
            }
        }
        const open = activeZones("body", bed, desk);
        const links: Link[] = [
            {
                key: "rails",
                label: "Floor rails",
                joint: { kind: "fixed", origin: vec(0, 0, 0) },
                pieces: [
                    piece("rail-a", "Floor rail", "rail", span(0, travel + t, 0, 0.005, 0.12, 0.18), { solid: false, rest: "floor" }),
                    piece("rail-b", "Floor rail", "rail", span(0, travel + t, 0, 0.005, length - 0.18, length - 0.12), { solid: false, rest: "floor" }),
                ],
            },
            {
                key: "body",
                label: "Module body",
                parent: "rails",
                joint: { kind: "slide", origin: vec(0, 0, 0), axis: vec(1, 0, 0), value: st(state, slideParam) * travel, min: 0, max: travel },
                pieces,
            },
            ...bedLinks("body", bed),
            pcLink("body"),
            ...deskLinks("body", desk),
        ];
        return { links, zones: [...zones, ...open.zones], loads: open.loads, screens: open.screens };
    },
};

const turningModule: ModuleType = {
    id: "turning",
    label: "Turning module",
    params: [turnParam, bedParam, deskParam],
    config: [],
    footprint: () => ({ w: TURNING.pull + t, d: active }),
    mechanism: (_config, state) => {
        const turn = st(state, turnParam);
        const bed = st(state, bedParam);
        const desk = st(state, deskParam);
        const pull = TURNING.pull * (ramp(turn, 0, 1 / 3) - ramp(turn, 2 / 3, 1));
        const angle = Math.PI * ramp(turn, 1 / 3, 2 / 3);
        const centre = vec(t / 2, 0, active / 2);
        const pin = TURNING.pin;
        const open = activeZones("body", bed, desk);
        const links: Link[] = [
            {
                key: "track",
                label: "Floor guide channel",
                joint: { kind: "fixed", origin: vec(0, 0, 0) },
                pieces: [piece("channel", "Floor guide channel", "rail", span(centre.x - 0.03, centre.x + TURNING.pull + 0.03, 0, 0.005, centre.z - 0.03, centre.z + 0.03), { solid: false, rest: "floor" })],
            },
            {
                key: "pin",
                label: "Pivot pin",
                parent: "track",
                joint: { kind: "slide", origin: centre, axis: vec(1, 0, 0), value: pull, min: 0, max: TURNING.pull },
                pieces: [piece("pin", "Pivot pin", "post", span(-0.03, 0.03, 0, pin, -0.03, 0.03), { rest: "floor" })],
            },
            {
                key: "turntable",
                label: "Module body",
                parent: "pin",
                joint: { kind: "hinge", origin: vec(0, pin, 0), axis: vec(0, 1, 0), value: angle, min: 0, max: Math.PI },
                pieces: [piece("turntable", "Turntable", "post", span(-0.08, 0.08, 0, SLIDING.plinth - pin, -0.05, 0.05))],
            },
            {
                key: "body",
                label: "Module body",
                parent: "turntable",
                joint: { kind: "fixed", origin: vec(-centre.x, -pin, -centre.z) },
                pieces: turningCarcass(),
            },
            ...bedLinks("body", bed),
            pcLink("body"),
            ...deskLinks("body", desk),
        ];
        return { links, zones: open.zones, loads: open.loads, screens: open.screens };
    },
};

/** The turning module's carcass: the bed and desk section on two castor plinths, with a gap in the middle for the pivot pin. */
function turningCarcass(): Piece[] {
    const gap = 0.12;
    const mid = active / 2;
    return activeCarcass().flatMap((p) => {
        if (p.key !== "plinth") return [p];
        const { x, y, w, h } = p.box;
        return [
            piece("castors-a", "Castor plinth", "panel", box(x, y, b, w, h, mid - gap / 2 - b), { rest: "floor" }),
            piece("castors-b", "Castor plinth", "panel", box(x, y, mid + gap / 2, w, h, mid - gap / 2 - b), { rest: "floor" }),
        ];
    });
}

const kitchenLength: ConfigSpec = { key: "length", label: "Run length", fallback: 2.4, min: 0.6, max: 5, step: 0.1 };

const fixed = (key: string, label: string, pieces: Piece[]): Link => ({ key, label, joint: { kind: "fixed", origin: vec(0, 0, 0) }, pieces });

const kitchen: ModuleType = {
    id: "kitchen",
    label: "Kitchen run",
    params: [],
    config: [kitchenLength],
    footprint: (config) => ({ w: cfg(config, kitchenLength), d: 0.6 }),
    mechanism: (config) => {
        const len = cfg(config, kitchenLength);
        return {
            links: [
                fixed("kitchen", "Kitchen", [
                    piece("base", "Kitchen base", "cabinet", span(0, len, 0, 0.86, 0.02, 0.6), { rest: "floor" }),
                    piece("top", "Kitchen base", "counter", span(0, len, 0.86, 0.9, 0, 0.62)),
                    piece("upper", "Kitchen wall cabinets", "cabinet", span(0, len, 1.45, 2.15, 0, 0.35), { rest: "wall" }),
                ]),
            ],
            zones: [{ key: "front", label: "Kitchen working space", link: "kitchen", box: span(0, len, 0, 2.0, 0.62, 1.42) }],
            loads: [],
        };
    },
};

const windowPost: ModuleType = {
    id: "window-post",
    label: "Window shelf post",
    params: [],
    config: [],
    footprint: () => ({ w: 0.4, d: 0.3 }),
    mechanism: () => ({
        links: [
            fixed("post", "Window shelf post", [
                piece("base", "Window shelf post", "shelf", span(0.1, 0.3, 0, 0.02, 0.05, 0.25), { rest: "floor" }),
                piece("post", "Window shelf post", "post", span(0.17, 0.23, 0.02, 1.05, 0.12, 0.18)),
                piece("shelf", "Window shelf post", "shelf", span(0, 0.4, 1.05, 1.08, 0, 0.3)),
            ]),
        ],
        zones: [],
        loads: [],
    }),
};

/** The armchair faces -z in its own frame: its back is at the far side of its footprint. */
const armchair: ModuleType = {
    id: "armchair",
    label: "Armchair with table",
    params: [],
    config: [],
    footprint: () => ({ w: 1.4, d: 0.85 }),
    mechanism: () => ({
        links: [
            fixed("chair", "Armchair", [
                piece("seat", "Armchair", "chair", span(0, 0.8, 0, 0.42, 0, 0.85), { rest: "floor" }),
                piece("back", "Armchair", "chair", span(0, 0.8, 0.42, 0.92, 0.65, 0.85)),
                piece("arm-a", "Armchair", "chair", span(0, 0.12, 0.42, 0.62, 0, 0.65)),
                piece("arm-b", "Armchair", "chair", span(0.68, 0.8, 0.42, 0.62, 0, 0.65)),
                piece("table-top", "Side table", "table", span(0.9, 1.4, 0.52, 0.55, 0.15, 0.65)),
                piece("table-leg", "Side table", "post", span(1.13, 1.17, 0, 0.52, 0.38, 0.42), { rest: "floor" }),
            ]),
        ],
        zones: [{ key: "legroom", label: "Legroom in front of the armchair", link: "chair", box: span(0, 0.8, 0, 0.5, -0.45, 0), facing: vec(0, 0, -1) }],
        loads: [],
    }),
};

/** An inward-opening room door; its frame side is z = 0 and the leaf, hinged at x = 0, sweeps a quarter circle into the room. */
const door: ModuleType = {
    id: "door",
    label: "Room door",
    params: [],
    config: [],
    footprint: () => ({ w: 0.8, d: 0.8 }),
    mechanism: () => ({
        links: [fixed("door", "Room door", [piece("leaf", "Room door", "door", span(0, 0.8, 0, 2.0, 0, 0.04), { solid: false, rest: "wall" })])],
        zones: [{ key: "sweep", label: "Door swing", link: "door", box: span(0, 0.8, 0, 2.0, 0, 0.8) }],
        loads: [],
    }),
};

/** Every module type the configurator offers, keyed by id. */
export const CATALOG: Readonly<Record<string, ModuleType>> = {
    [slidingWall.id]: slidingWall,
    [turningModule.id]: turningModule,
    [kitchen.id]: kitchen,
    [windowPost.id]: windowPost,
    [armchair.id]: armchair,
    [door.id]: door,
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

function rotateBox(r: Box, rotation: Rotation): Box {
    const [ax, az] = rotatePoint(r.x, r.z, rotation);
    const [bx, bz] = rotatePoint(r.x + r.w, r.z + r.d, rotation);
    return { x: Math.min(ax, bx), y: r.y, z: Math.min(az, bz), w: Math.abs(bx - ax), h: r.h, d: Math.abs(bz - az) };
}

const QUARTER_TURNS: Record<Rotation, Pose["r"]> = {
    0: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    90: [0, 0, -1, 0, 1, 0, 1, 0, 0],
    180: [-1, 0, 0, 0, 1, 0, 0, 0, -1],
    270: [0, 0, 1, 0, 1, 0, -1, 0, 0],
};

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

/** Where the module's own frame sits in the room: a quarter turn, then the shift that puts the footprint's corner on the anchor. */
export function modulePose(module: ModuleInstance): Pose {
    const type = moduleType(module.type);
    const { w, d } = type.footprint(resolvedConfig(module));
    const rest = rotateBox(box(0, 0, 0, w, 0, d), module.rotation);
    const shift: Vec3 = vec(module.x - rest.x, 0, module.z - rest.z);
    return compose(translation(shift), { r: QUARTER_TURNS[module.rotation], t: vec(0, 0, 0) });
}

/** The module's mechanism in the given state, placed in the room. */
export function placedModule(module: ModuleInstance, state: ModuleState | undefined): PlacedModule {
    const type = moduleType(module.type);
    const mechanism = type.mechanism(resolvedConfig(module), resolvedState(type, state));
    return placeMechanism(module.id, mechanism, modulePose(module));
}

/** Parts of a module in room coordinates for the given state. */
export function placedParts(module: ModuleInstance, state: ModuleState | undefined): Part[] {
    return [...placedModule(module, state).parts];
}
