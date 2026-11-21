import { describe, expect, it } from "vitest";
import { COLLAPSE_ABOVE, countByModule, countByRule, groupViolations, isLong } from "../src/model/grouping";
import type { Rule, TimedViolation } from "../src/model/rules";

const v = (id: string, rule: Rule, moduleId: string, message: string, t: number, end: number, parts: string[] = []): TimedViolation => ({
    id,
    rule,
    moduleId,
    message,
    t,
    end,
    partKeys: parts,
    zoneKeys: [],
});

describe("groupViolations", () => {
    it("merges the same rule, module and message into one group with the widest range", () => {
        const groups = groupViolations([v("a", "collision", "m1", "Door hits Wall", 0.2, 0.3, ["p1"]), v("b", "collision", "m1", "Door hits Wall", 0.1, 0.25, ["p2"])]);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({ start: 0.1, end: 0.3, count: 2, partKeys: ["p1", "p2"] });
    });

    it("keeps different messages, rules and modules apart and orders by start", () => {
        const groups = groupViolations([
            v("a", "support", "m1", "Shelf floats", 0.5, 0.6),
            v("b", "collision", "m1", "Door hits Wall", 0.1, 0.2),
            v("c", "collision", "m2", "Door hits Wall", 0.3, 0.4),
        ]);
        expect(groups.map((g) => g.start)).toEqual([0.1, 0.3, 0.5]);
    });

    it("returns nothing for no violations", () => {
        expect(groupViolations([])).toEqual([]);
    });
});

describe("summaries", () => {
    const groups = groupViolations([
        v("a", "collision", "m1", "x", 0, 0),
        v("b", "collision", "m1", "y", 0, 0),
        v("c", "seat", "m2", "z", 0, 0),
        v("d", "support", "m1", "w", 0, 0),
    ]);

    it("counts per rule, most frequent first", () => {
        expect(countByRule(groups)).toEqual([
            { rule: "collision", count: 2 },
            { rule: "seat", count: 1 },
            { rule: "support", count: 1 },
        ]);
    });

    it("counts per module, most frequent first", () => {
        expect(countByModule(groups)).toEqual([
            { moduleId: "m1", count: 3 },
            { moduleId: "m2", count: 1 },
        ]);
    });

    it("is long only above the threshold", () => {
        expect(COLLAPSE_ABOVE).toBe(3);
        expect(isLong(groups)).toBe(true);
        expect(isLong(groups.slice(0, COLLAPSE_ABOVE))).toBe(false);
    });
});
