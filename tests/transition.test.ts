import { describe, expect, it } from "vitest";
import { SLIDING_ROOM } from "./rooms";
import { activePhases, ease, phaseBoundaries, phaseOf, transitionStates } from "../src/model/transition";
import type { Mode, Setup } from "../src/model/types";

const setup: Setup = SLIDING_ROOM;
const [sleep, work] = setup.modes as [Mode, Mode];

describe("phaseOf", () => {
    it("puts folding extensions first, moves in the middle and unfolding last", () => {
        expect(phaseOf("extend", 1, 0)).toBe("fold");
        expect(phaseOf("move", 0, 1)).toBe("move");
        expect(phaseOf("move", 1, 0)).toBe("move");
        expect(phaseOf("extend", 0, 1)).toBe("unfold");
        expect(phaseOf("extend", 0.4, 0.4)).toBeUndefined();
    });
});

describe("ease", () => {
    it("starts at 0, ends at 1 and clamps outside the range", () => {
        expect(ease(-1)).toBe(0);
        expect(ease(0)).toBe(0);
        expect(ease(0.5)).toBeCloseTo(0.5);
        expect(ease(1)).toBe(1);
        expect(ease(2)).toBe(1);
    });
});

describe("transitionStates", () => {
    it("matches the source mode at 0 and the target mode at 1", () => {
        expect(transitionStates(setup, sleep, work, 0)["wall-1"]).toEqual({ slide: 0, bed: 1, desk: 0 });
        expect(transitionStates(setup, sleep, work, 1)["wall-1"]).toEqual({ slide: 1, bed: 0, desk: 1 });
    });

    it("folds the bed, then slides the module, then unfolds the desk", () => {
        expect(activePhases(setup, sleep, work)).toEqual(["fold", "move", "unfold"]);
        const third = 1 / 3;
        const atFolded = transitionStates(setup, sleep, work, third)["wall-1"]!;
        expect(atFolded.bed).toBeCloseTo(0);
        expect(atFolded.slide).toBeCloseTo(0);
        expect(atFolded.desk).toBeCloseTo(0);
        const midSlide = transitionStates(setup, sleep, work, 0.5)["wall-1"]!;
        expect(midSlide.slide).toBeCloseTo(0.5);
        expect(midSlide.bed).toBeCloseTo(0);
        expect(midSlide.desk).toBeCloseTo(0);
        const arrived = transitionStates(setup, sleep, work, 2 * third)["wall-1"]!;
        expect(arrived.slide).toBeCloseTo(1);
        expect(arrived.desk).toBeCloseTo(0);
        const unfolding = transitionStates(setup, sleep, work, 5 / 6)["wall-1"]!;
        expect(unfolding.desk).toBeCloseTo(0.5);
    });

    it("runs backwards in the same order: the desk folds before the module slides back", () => {
        const s = transitionStates(setup, work, sleep, 0.2)["wall-1"]!;
        expect(s.slide).toBe(1);
        expect(s.desk).toBeLessThan(1);
        expect(s.bed).toBe(0);
    });

    it("gives each active stage an equal share and skips stages with nothing to do", () => {
        const day = SLIDING_ROOM.modes[2]!;
        const large = SLIDING_ROOM;
        expect(activePhases(large, large.modes[0]!, day)).toEqual(["fold", "move"]);
        expect(phaseBoundaries(large, large.modes[0]!, day)).toEqual([
            { phase: "fold", end: 0.5 },
            { phase: "move", end: 1 },
        ]);
        expect(transitionStates(large, large.modes[0]!, day, 0.5)["wall-1"]).toEqual({ slide: 0, bed: 0, desk: 0 });
    });

    it("keeps the state still between identical modes", () => {
        expect(activePhases(setup, sleep, sleep)).toEqual([]);
        expect(transitionStates(setup, sleep, sleep, 0.7)["wall-1"]).toEqual({ slide: 0, bed: 1, desk: 0 });
    });

    it("fills missing states from parameter defaults and clamps stored values", () => {
        const empty: Mode = { id: "e", name: "Empty", states: {} };
        const wild: Mode = { id: "w", name: "Wild", states: { "wall-1": { slide: 3, bed: -2 } } };
        expect(transitionStates(setup, empty, wild, 0)["wall-1"]).toEqual({ slide: 0, bed: 0, desk: 0 });
        expect(transitionStates(setup, empty, wild, 1)["wall-1"]).toEqual({ slide: 1, bed: 0, desk: 0 });
    });

    it("leaves out modules without parameters", () => {
        expect(Object.keys(transitionStates(setup, sleep, work, 0.5))).toEqual(["wall-1"]);
    });
});
