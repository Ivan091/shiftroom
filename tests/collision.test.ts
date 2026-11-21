import { describe, expect, it } from "vitest";
import { placedFootprint, placedParts } from "../src/model/catalog";
import { clashes, overlaps, transitionClashes } from "../src/model/collision";
import { updateModule } from "../src/model/edit";
import { PRESETS } from "../src/model/presets";
import type { Box, Mode, Rotation, Setup } from "../src/model/types";

const box = (x: number, z: number, w: number, d: number): Box => ({ x, y: 0, z, w, h: 1, d });

describe("overlaps", () => {
    it("treats touching boxes as clear and real overlap as a clash", () => {
        expect(overlaps(box(0, 0, 1, 1), box(1, 0, 1, 1))).toBe(false);
        expect(overlaps(box(0, 0, 1, 1), box(0.9, 0, 1, 1))).toBe(true);
        expect(overlaps(box(0, 0, 1, 1), { ...box(0, 0, 1, 1), y: 1.2 })).toBe(false);
    });
});

describe("presets", () => {
    for (const preset of PRESETS) {
        it(`${preset.name} moves through every pair of modes without a clash`, () => {
            for (const from of preset.modes) {
                for (const to of preset.modes) {
                    expect(transitionClashes(preset, from, to, 40)).toEqual([]);
                }
            }
        });
    }
});

describe("clashes", () => {
    const setup: Setup = PRESETS[0]!;
    const [sleep, work] = setup.modes as [Mode, Mode];

    it("reports a fixed piece standing in the module's track during the slide", () => {
        const blocked = updateModule(setup, "post-1", { z: 1.0 });
        const found = transitionClashes(blocked, sleep, work, 60);
        const labels = found.map((c) => `${c.a.label} -> ${"wall" in c.b ? "wall" : c.b.label}`);
        expect(labels).toContain("Bed -> Window shelf post");
        expect(labels).toContain("Module body -> Window shelf post");
        const body = found.find((c) => c.a.label === "Module body")!;
        expect(body.t).toBeGreaterThan(1 / 3);
        expect(body.t).toBeLessThan(2 / 3);
    });

    it("reports a bed unfolded against the wall", () => {
        const found = clashes(setup, { "wall-1": { slide: 1, bed: 1, desk: 0 } });
        expect(found).toHaveLength(1);
        expect(found[0]!.a.label).toBe("Bed");
        expect(found[0]!.b).toEqual({ wall: true });
        expect(found[0]!.partKeys).toContain("wall-1:bed");
    });

    it("reports a fixed piece placed outside the room", () => {
        const outside = updateModule(setup, "kitchen-1", { x: 2.5 });
        expect(clashes(outside, {}).map((c) => c.a.label)).toEqual(["Kitchen base", "Kitchen wall cabinets"]);
    });

    it("ignores the floor rails and parts of the same module", () => {
        expect(clashes(setup, { "wall-1": { slide: 0.3, bed: 1, desk: 1 } })).toEqual([]);
    });
});

describe("placement", () => {
    const kitchen = PRESETS[0]!.modules[1]!;

    for (const rotation of [0, 90, 180, 270] as Rotation[]) {
        it(`keeps the anchor at the footprint corner and every part inside it at ${rotation} degrees`, () => {
            const turned = { ...kitchen, x: 1, z: 2, rotation };
            const fp = placedFootprint(turned);
            expect(fp.x).toBe(1);
            expect(fp.z).toBe(2);
            for (const p of placedParts(turned, undefined)) {
                expect(p.box.x).toBeGreaterThanOrEqual(fp.x - 1e-9);
                expect(p.box.z).toBeGreaterThanOrEqual(fp.z - 1e-9);
                expect(p.box.x + p.box.w).toBeLessThanOrEqual(fp.x + fp.w + 1e-9);
                expect(p.box.z + p.box.d).toBeLessThanOrEqual(fp.z + fp.d + 1e-9);
            }
        });
    }

    it("puts the wall cabinets against the wall the run backs onto", () => {
        const upper = (rotation: Rotation): Box => placedParts({ ...kitchen, x: 0, z: 0, rotation }, undefined).find((p) => p.label === "Kitchen wall cabinets")!.box;
        expect(upper(0).z).toBeCloseTo(0);
        expect(upper(180).z + upper(180).d).toBeCloseTo(0.6);
    });

    it("grows the wardrobe with the module length while the bed/desk zone stays 2 m", () => {
        const wall = PRESETS[0]!.modules[0]!;
        for (const [length, wardrobe] of [[2.6, 0.6], [4.0, 2.0], [5.3, 3.3]] as const) {
            const parts = placedParts({ ...wall, config: { ...wall.config, length } }, undefined);
            expect(parts.find((p) => p.key.endsWith(":wardrobe"))!.box.d).toBeCloseTo(wardrobe);
            expect(parts.find((p) => p.key.endsWith(":active"))!.box.d).toBeCloseTo(2.0);
        }
    });

    it("slides the module body along the rail travel", () => {
        const wall = PRESETS[0]!.modules[0]!;
        const body = (slide: number): Box => placedParts(wall, { slide }).find((p) => p.key.endsWith(":active"))!.box;
        expect(body(0).x).toBeCloseTo(0);
        expect(body(1).x).toBeCloseTo(3.1);
        expect(body(1).x + body(1).w).toBeCloseTo(3.6);
    });
});
