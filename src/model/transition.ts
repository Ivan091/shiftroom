import { moduleType, resolvedState } from "./catalog";
import type { Mode, ModuleState, ParamKind, Setup } from "./types";

/** Stage of a transition: every fold runs first, then every move, then every unfold. */
export type Phase = "fold" | "move" | "unfold";

const PHASE_ORDER: readonly Phase[] = ["fold", "move", "unfold"];

/** The stage in which a parameter changing from `from` to `to` moves, or none when it does not change. */
export function phaseOf(kind: ParamKind, from: number, to: number): Phase | undefined {
    if (Math.abs(from - to) < 1e-9) return undefined;
    if (kind === "move") return "move";
    return to < from ? "fold" : "unfold";
}

/** Smooth start and stop for each stage of the animation. */
export function ease(t: number): number {
    const c = Math.min(1, Math.max(0, t));
    return c * c * (3 - 2 * c);
}

/** Resolved state of every module with parameters in a mode, defaults filled in. */
export function modeStates(setup: Setup, mode: Mode): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {};
    for (const m of setup.modules) {
        const type = moduleType(m.type);
        if (type.params.length > 0) out[m.id] = resolvedState(type, mode.states[m.id]);
    }
    return out;
}

/** The stages a transition between two modes actually uses, in order; stages with nothing to do are skipped. */
export function activePhases(setup: Setup, from: Mode, to: Mode): Phase[] {
    const a = modeStates(setup, from);
    const b = modeStates(setup, to);
    const used = new Set<Phase>();
    for (const m of setup.modules) {
        for (const spec of moduleType(m.type).params) {
            const phase = phaseOf(spec.kind, a[m.id]?.[spec.key] ?? spec.fallback, b[m.id]?.[spec.key] ?? spec.fallback);
            if (phase) used.add(phase);
        }
    }
    return PHASE_ORDER.filter((p) => used.has(p));
}

/**
 * State of every module at progress `t` (0..1) of the transition from one mode to another. The
 * timeline is split evenly between the active stages, so a slide waits until every part that must
 * fold has folded, and parts unfold only once every module has arrived.
 */
export function transitionStates(setup: Setup, from: Mode, to: Mode, t: number): Record<string, ModuleState> {
    const a = modeStates(setup, from);
    const b = modeStates(setup, to);
    const phases = activePhases(setup, from, to);
    const progress = Math.min(1, Math.max(0, t));
    const share = phases.length === 0 ? 1 : 1 / phases.length;
    const local = (phase: Phase): number => {
        const index = phases.indexOf(phase);
        if (index < 0) return 1;
        return ease((progress - index * share) / share);
    };
    const out: Record<string, ModuleState> = {};
    for (const m of setup.modules) {
        const specs = moduleType(m.type).params;
        if (specs.length === 0) continue;
        const state: Record<string, number> = {};
        for (const spec of specs) {
            const v0 = a[m.id]?.[spec.key] ?? spec.fallback;
            const v1 = b[m.id]?.[spec.key] ?? spec.fallback;
            const phase = phaseOf(spec.kind, v0, v1);
            state[spec.key] = phase ? v0 + (v1 - v0) * local(phase) : v0;
        }
        out[m.id] = state;
    }
    return out;
}

/** Progress points (0..1) where each active stage ends, for tick marks under the transition slider. */
export function phaseBoundaries(setup: Setup, from: Mode, to: Mode): { phase: Phase; end: number }[] {
    const phases = activePhases(setup, from, to);
    return phases.map((phase, i) => ({ phase, end: (i + 1) / phases.length }));
}
