import { placedModule } from "./catalog";
import { apply, bounds, contains, corners, dot, type Obb, obb, penetration, radiusAlong, rotate, vec, type Vec3 } from "./geometry";
import { modeStates, transitionStates } from "./transition";
import type { Box, Mode, ModuleState, Part, PlacedModule, Setup, Zone } from "./types";

/** Overlaps shallower than this, in metres, count as touching rather than colliding. */
export const TOLERANCE = 0.005;

/** How much open floor a seat needs between its legroom and the wall it faces, in metres. */
export const SEAT_VIEW = 0.8;

/** The physical rule a violation breaks. */
export type Rule = "collision" | "room" | "floor" | "ceiling" | "support" | "joint" | "clearance" | "seat";

/** One broken rule, with the parts and zones to highlight. `id` is stable across samples of a transition. */
export interface Violation {
    readonly id: string;
    readonly rule: Rule;
    readonly moduleId: string;
    readonly message: string;
    readonly partKeys: readonly string[];
    readonly zoneKeys: readonly string[];
}

/** A violation and the earliest transition progress at which it shows up. */
export interface TimedViolation extends Violation {
    readonly t: number;
}

interface Solid {
    readonly part: Part;
    readonly obb: Obb;
    readonly aabb: Box;
}

interface Scene {
    readonly setup: Setup;
    readonly placed: readonly PlacedModule[];
    readonly solids: readonly Solid[];
    readonly all: readonly Solid[];
    readonly byLink: ReadonlyMap<string, readonly Solid[]>;
}

const name = (setup: Setup, moduleId: string): string => setup.modules.find((m) => m.id === moduleId)?.name ?? moduleId;

function place(setup: Setup, states: Readonly<Record<string, ModuleState>>): PlacedModule[] {
    return setup.modules.map((m) => placedModule(m, states[m.id]));
}

function scene(setup: Setup, placed: readonly PlacedModule[]): Scene {
    const all = placed.flatMap((p) => p.parts).map((part) => {
        const o = obb(part.box, part.pose);
        return { part, obb: o, aabb: bounds(o) };
    });
    const byLink = new Map<string, Solid[]>();
    for (const s of all) byLink.set(s.part.link, [...(byLink.get(s.part.link) ?? []), s]);
    return { setup, placed, all, solids: all.filter((s) => s.part.solid && s.part.box.w > 1e-4 && s.part.box.h > 1e-4 && s.part.box.d > 1e-4), byLink };
}

const aabbApart = (p: Box, q: Box): boolean =>
    p.x + p.w < q.x - TOLERANCE || q.x + q.w < p.x - TOLERANCE || p.y + p.h < q.y - TOLERANCE || q.y + q.h < p.y - TOLERANCE || p.z + p.d < q.z - TOLERANCE || q.z + q.d < p.z - TOLERANCE;

class Collector {
    private readonly found = new Map<string, { v: Violation; parts: Set<string>; zones: Set<string> }>();

    add(id: string, rule: Rule, moduleId: string, message: string, partKeys: readonly string[] = [], zoneKeys: readonly string[] = []): void {
        const existing = this.found.get(id);
        if (existing) {
            partKeys.forEach((k) => existing.parts.add(k));
            zoneKeys.forEach((k) => existing.zones.add(k));
            return;
        }
        this.found.set(id, { v: { id, rule, moduleId, message, partKeys: [], zoneKeys: [] }, parts: new Set(partKeys), zones: new Set(zoneKeys) });
    }

    list(): Violation[] {
        return [...this.found.values()].map(({ v, parts, zones }) => ({ ...v, partKeys: [...parts], zoneKeys: [...zones] }));
    }
}

function collisions(s: Scene, out: Collector): void {
    const { solids, setup } = s;
    for (let i = 0; i < solids.length; i++) {
        for (let j = i + 1; j < solids.length; j++) {
            const p = solids[i]!;
            const q = solids[j]!;
            if (p.part.link === q.part.link) continue;
            if (aabbApart(p.aabb, q.aabb)) continue;
            if (penetration(p.obb, q.obb) <= TOLERANCE) continue;
            const [a, other] = !p.part.moving && q.part.moving ? [q, p] : [p, q];
            const where = a.part.moduleId === other.part.moduleId ? "" : ` (${name(setup, other.part.moduleId)})`;
            out.add(
                `collision|${a.part.moduleId}/${a.part.label}|${other.part.moduleId}/${other.part.label}`,
                "collision",
                a.part.moduleId,
                `${a.part.label} hits ${other.part.label}${where}`,
                [p.part.key, q.part.key],
            );
        }
    }
}

function roomBounds(s: Scene, out: Collector): void {
    const { width, depth, height } = s.setup.room;
    for (const solid of s.all) {
        const { part, aabb } = solid;
        const who = `${part.label} (${name(s.setup, part.moduleId)})`;
        if (aabb.x < -TOLERANCE || aabb.z < -TOLERANCE || aabb.x + aabb.w > width + TOLERANCE || aabb.z + aabb.d > depth + TOLERANCE) {
            out.add(`room|${part.moduleId}/${part.label}`, "room", part.moduleId, `${who} goes through a wall`, [part.key]);
        }
        if (aabb.y < -TOLERANCE) out.add(`floor|${part.moduleId}/${part.label}`, "floor", part.moduleId, `${who} goes through the floor`, [part.key]);
        if (aabb.y + aabb.h > height + TOLERANCE) out.add(`ceiling|${part.moduleId}/${part.label}`, "ceiling", part.moduleId, `${who} goes through the ceiling`, [part.key]);
    }
}

/** Whether a piece's back, the face at the minimum z of its own frame, lies flat against one of the room's walls. */
function backOnWall(part: Part, width: number, depth: number): boolean {
    const { box: b, pose } = part;
    const p = apply(pose, vec(b.x + b.w / 2, b.y + b.h / 2, b.z));
    const n = rotate(pose.r, vec(0, 0, -1));
    const near = (a: number, c: number): boolean => Math.abs(a - c) <= TOLERANCE;
    return (
        (near(n.x, -1) && near(p.x, 0)) || (near(n.x, 1) && near(p.x, width)) || (near(n.z, -1) && near(p.z, 0)) || (near(n.z, 1) && near(p.z, depth))
    );
}

function support(s: Scene, out: Collector): void {
    const { width, depth } = s.setup.room;
    for (const { part, aabb } of s.all) {
        const who = `${part.label} (${name(s.setup, part.moduleId)})`;
        if (part.rest === "floor" && aabb.y > TOLERANCE) {
            out.add(`support|${part.moduleId}/${part.label}|floor`, "support", part.moduleId, `${who} does not reach the floor`, [part.key]);
        }
        if (part.rest === "wall" && !backOnWall(part, width, depth)) {
            out.add(`support|${part.moduleId}/${part.label}|wall`, "support", part.moduleId, `${who} must hang on a wall but stands free`, [part.key]);
        }
    }
    for (const placed of s.placed) {
        for (const link of placed.links) {
            if (link.parent !== undefined) continue;
            const parts = placed.parts.filter((p) => p.link === link.id);
            if (parts.length === 0 || parts.some((p) => p.rest)) continue;
            out.add(`support|${link.id}|floats`, "support", parts[0]!.moduleId, `${link.label} (${name(s.setup, parts[0]!.moduleId)}) floats`, parts.map((p) => p.key));
        }
        for (const load of placed.loads) {
            const loaded = s.byLink.get(load.link) ?? [];
            for (const prop of load.props) {
                const props = s.byLink.get(prop) ?? [];
                const touching = loaded.some((l) => props.some((p) => penetration(l.obb, p.obb) >= -TOLERANCE));
                if (!touching) {
                    out.add(
                        `support|${load.link}|${prop}`,
                        "support",
                        load.moduleId,
                        `${load.label} (${name(s.setup, load.moduleId)}) is not resting on its ${props[0]?.part.label ?? "support"}`,
                        [...loaded, ...props].map((x) => x.part.key),
                    );
                }
            }
        }
    }
}

function project(solids: readonly Solid[], axis: Vec3): [number, number] {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of solids) {
        for (const c of corners(s.obb)) {
            const v = dot(c, axis);
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
        }
    }
    return [lo, hi];
}

function joints(s: Scene, out: Collector): void {
    for (const placed of s.placed) {
        for (const j of placed.joints) {
            const who = `${j.label} (${name(s.setup, j.moduleId)})`;
            const child = s.byLink.get(j.link) ?? [];
            const parent = s.byLink.get(j.parent) ?? [];
            const keys = child.map((c) => c.part.key);
            if (j.value < j.min - 1e-9 || j.value > j.max + 1e-9) {
                out.add(`joint|${j.link}|limit`, "joint", j.moduleId, `${who} moves beyond its joint limits`, keys);
            }
            if (j.kind === "hinge") {
                const onParent = parent.some((p) => contains(p.obb, j.origin, TOLERANCE));
                const onChild = child.some((c) => contains(c.obb, j.origin, TOLERANCE));
                if (!onParent || !onChild) out.add(`joint|${j.link}|hinge`, "joint", j.moduleId, `${who} hinges on nothing`, keys);
            } else {
                const [clo, chi] = project(child, j.axis);
                const [plo, phi] = project(parent, j.axis);
                if (clo < plo - TOLERANCE || chi > phi + TOLERANCE) {
                    out.add(`joint|${j.link}|runner`, "joint", j.moduleId, `${who} runs off the end of its ${parent[0]?.part.label ?? "runner"}`, keys);
                }
            }
        }
    }
}

function zoneBlockers(s: Scene, zone: Zone): { outside: boolean; blockers: Solid[] } {
    const o = obb(zone.box, zone.pose);
    const a = bounds(o);
    const { width, depth } = s.setup.room;
    const outside = a.x < -TOLERANCE || a.z < -TOLERANCE || a.x + a.w > width + TOLERANCE || a.z + a.d > depth + TOLERANCE;
    const blockers = s.solids.filter((p) => !aabbApart(a, p.aabb) && penetration(o, p.obb) > TOLERANCE);
    return { outside, blockers };
}

function clearances(s: Scene, out: Collector): void {
    const zones = s.placed.flatMap((p) => p.zones);
    const groups = new Map<string, Zone[]>();
    for (const z of zones) groups.set(z.group ?? z.key, [...(groups.get(z.group ?? z.key) ?? []), z]);
    for (const [group, members] of groups) {
        const checked = members.map((z) => ({ z, ...zoneBlockers(s, z) }));
        if (checked.some((c) => !c.outside && c.blockers.length === 0)) continue;
        const first = checked[0]!;
        const owner = name(s.setup, first.z.moduleId);
        const blocker = first.blockers[0];
        const by = blocker ? `${blocker.part.label}${blocker.part.moduleId === first.z.moduleId ? "" : ` (${name(s.setup, blocker.part.moduleId)})`}` : "the wall";
        out.add(
            `clearance|${group}`,
            "clearance",
            first.z.moduleId,
            `${first.z.label} (${owner}) is blocked by ${by}`,
            checked.flatMap((c) => c.blockers.map((b) => b.part.key)),
            members.map((z) => z.key),
        );
    }
}

/** Distance from a point along a horizontal direction to the room's walls. */
function wallDistance(p: Vec3, dir: Vec3, width: number, depth: number): number {
    const hits: number[] = [];
    if (dir.x > 1e-9) hits.push((width - p.x) / dir.x);
    if (dir.x < -1e-9) hits.push(-p.x / dir.x);
    if (dir.z > 1e-9) hits.push((depth - p.z) / dir.z);
    if (dir.z < -1e-9) hits.push(-p.z / dir.z);
    return hits.length === 0 ? Infinity : Math.min(...hits);
}

function seats(s: Scene, out: Collector): void {
    const { width, depth } = s.setup.room;
    for (const zone of s.placed.flatMap((p) => p.zones)) {
        if (!zone.facing) continue;
        const o = obb(zone.box, zone.pose);
        const view = wallDistance(o.center, zone.facing, width, depth) - radiusAlong(o, zone.facing);
        if (view < SEAT_VIEW) {
            out.add(
                `seat|${zone.key}`,
                "seat",
                zone.moduleId,
                `${name(s.setup, zone.moduleId)} faces a wall ${Math.max(0, view).toFixed(2)} m away`,
                [],
                [zone.key],
            );
        }
    }
}

/**
 * Checks already placed modules against the room of `setup`. The moment rules always apply: no
 * clipping, nothing outside the room, everything carried, joints within their limits. A resting
 * state (`rest`) must also keep its clearance zones free and its seats facing into the room.
 */
export function placedViolations(setup: Setup, placed: readonly PlacedModule[], rest: boolean): Violation[] {
    const s = scene(setup, placed);
    const out = new Collector();
    collisions(s, out);
    roomBounds(s, out);
    support(s, out);
    joints(s, out);
    if (rest) {
        clearances(s, out);
        seats(s, out);
    }
    return out.list();
}

/** Moment rules for the given module states, as they apply in the middle of a transition. */
export function stateViolations(setup: Setup, states: Readonly<Record<string, ModuleState>>): Violation[] {
    return placedViolations(setup, place(setup, states), false);
}

/** Every rule for module states the room rests in. */
export function restViolations(setup: Setup, states: Readonly<Record<string, ModuleState>>): Violation[] {
    return placedViolations(setup, place(setup, states), true);
}

/** Every rule a mode breaks. */
export function modeViolations(setup: Setup, mode: Mode): Violation[] {
    return restViolations(setup, modeStates(setup, mode));
}

/**
 * Clearance zones of every module in the given states, with whether each is blocked, for drawing
 * them. Of alternatives in a group that is satisfied, only the free ones are listed.
 */
export function zoneStatus(setup: Setup, states: Readonly<Record<string, ModuleState>>): { zone: Zone; blocked: boolean }[] {
    const s = scene(setup, place(setup, states));
    const checked = s.placed.flatMap((p) => p.zones).map((zone) => {
        const { outside, blockers } = zoneBlockers(s, zone);
        return { zone, blocked: outside || blockers.length > 0 };
    });
    const satisfied = new Set(checked.filter((c) => c.zone.group && !c.blocked).map((c) => c.zone.group));
    return checked.filter((c) => !(c.blocked && c.zone.group && satisfied.has(c.zone.group)));
}

/**
 * Everything wrong with a transition: the rest rules at both modes and the moment rules sampled
 * evenly in between, each violation with the first progress it shows up at.
 */
export function transitionViolations(setup: Setup, from: Mode, to: Mode, samples = 60): TimedViolation[] {
    const first = new Map<string, TimedViolation>();
    const note = (list: Violation[], t: number): void => {
        for (const v of list) if (!first.has(v.id)) first.set(v.id, { ...v, t });
    };
    note(modeViolations(setup, from), 0);
    for (let i = 1; i < samples; i++) {
        const t = i / samples;
        note(stateViolations(setup, transitionStates(setup, from, to, t)), t);
    }
    note(modeViolations(setup, to), 1);
    return [...first.values()];
}

