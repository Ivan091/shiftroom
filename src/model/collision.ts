import { placedParts } from "./catalog";
import { transitionStates } from "./transition";
import type { Box, Mode, ModuleState, Part, Setup } from "./types";

/** Overlaps shallower than this, in metres, count as touching rather than colliding. */
export const TOLERANCE = 0.005;

/** One side of a clash: a labelled part of a module, or the room's walls. */
export type ClashSide = { readonly moduleId: string; readonly label: string } | { readonly wall: true };

/** Two things that occupy the same space; `a` is always a moving part or the part that left the room. */
export interface Clash {
    readonly a: { readonly moduleId: string; readonly label: string };
    readonly b: ClashSide;
    readonly partKeys: readonly string[];
}

/** A clash and the earliest transition progress at which it happens. */
export interface TimedClash extends Clash {
    readonly t: number;
}

/** Whether two boxes overlap by more than the tolerance on every axis. */
export function overlaps(p: Box, q: Box): boolean {
    return (
        Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x) > TOLERANCE &&
        Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y) > TOLERANCE &&
        Math.min(p.z + p.d, q.z + q.d) - Math.max(p.z, q.z) > TOLERANCE
    );
}

function outsideRoom(b: Box, width: number, depth: number): boolean {
    return b.x < -TOLERANCE || b.z < -TOLERANCE || b.x + b.w > width + TOLERANCE || b.z + b.d > depth + TOLERANCE;
}

function moduleOf(part: Part): string {
    return part.key.slice(0, part.key.indexOf(":"));
}

function clashId(c: Clash): string {
    const b = "wall" in c.b ? "wall" : `${c.b.moduleId}/${c.b.label}`;
    return `${c.a.moduleId}/${c.a.label}|${b}`;
}

/**
 * Every clash in the given module states: a moving part inside another module's part, or any part
 * outside the room. Parts of the same module never clash with each other, and each pair of
 * labelled parts is reported once.
 */
export function clashes(setup: Setup, states: Readonly<Record<string, ModuleState>>): Clash[] {
    const parts = setup.modules.flatMap((m) => placedParts(m, states[m.id])).filter((p) => p.solid && p.box.w > 1e-4 && p.box.d > 1e-4);
    const found = new Map<string, { clash: Clash; keys: Set<string> }>();
    const add = (clash: Clash, keys: string[]): void => {
        const id = clashId(clash);
        const existing = found.get(id);
        if (existing) keys.forEach((k) => existing.keys.add(k));
        else found.set(id, { clash, keys: new Set(keys) });
    };
    for (const p of parts) {
        if (outsideRoom(p.box, setup.room.width, setup.room.depth)) {
            add({ a: { moduleId: moduleOf(p), label: p.label }, b: { wall: true }, partKeys: [] }, [p.key]);
        }
    }
    for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
            const p = parts[i]!;
            const q = parts[j]!;
            if (!p.moving && !q.moving) continue;
            if (moduleOf(p) === moduleOf(q)) continue;
            if (!overlaps(p.box, q.box)) continue;
            const [mover, other] = p.moving ? [p, q] : [q, p];
            add(
                { a: { moduleId: moduleOf(mover), label: mover.label }, b: { moduleId: moduleOf(other), label: other.label }, partKeys: [] },
                [p.key, q.key],
            );
        }
    }
    return [...found.values()].map(({ clash, keys }) => ({ ...clash, partKeys: [...keys] }));
}

/** Clashes anywhere along a transition, sampled evenly including both modes, each with the first progress it shows up at. */
export function transitionClashes(setup: Setup, from: Mode, to: Mode, samples = 60): TimedClash[] {
    const first = new Map<string, TimedClash>();
    for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        for (const c of clashes(setup, transitionStates(setup, from, to, t))) {
            const id = clashId(c);
            if (!first.has(id)) first.set(id, { ...c, t });
        }
    }
    return [...first.values()];
}
