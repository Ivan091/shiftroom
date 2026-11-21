import { describe, expect, it } from "vitest";
import { apply, axisRotation, compose, contains, IDENTITY, obb, penetration, translation, vec } from "../src/model/geometry";
import type { Box } from "../src/model/types";

const cube = (x: number, y: number, z: number, size = 1): Box => ({ x, y, z, w: size, h: size, d: size });

describe("axisRotation", () => {
    it("turns right-handed about its axis", () => {
        const p = apply(axisRotation(vec(0, 0, 1), Math.PI / 2), vec(1, 0, 0));
        expect(p.x).toBeCloseTo(0);
        expect(p.y).toBeCloseTo(1);
        const q = apply(axisRotation(vec(0, 1, 0), -Math.PI / 2), vec(0, 0, 1));
        expect(q.x).toBeCloseTo(-1);
        expect(q.z).toBeCloseTo(0);
    });

    it("composes inner first, then outer", () => {
        const pose = compose(translation(vec(5, 0, 0)), axisRotation(vec(0, 0, 1), Math.PI / 2));
        const p = apply(pose, vec(1, 0, 0));
        expect(p.x).toBeCloseTo(5);
        expect(p.y).toBeCloseTo(1);
    });
});

describe("penetration", () => {
    it("is positive for overlap, zero for touching and negative for a gap", () => {
        expect(penetration(obb(cube(0, 0, 0), IDENTITY), obb(cube(0.9, 0, 0), IDENTITY))).toBeCloseTo(0.1);
        expect(penetration(obb(cube(0, 0, 0), IDENTITY), obb(cube(1, 0, 0), IDENTITY))).toBeCloseTo(0);
        expect(penetration(obb(cube(0, 0, 0), IDENTITY), obb(cube(1.5, 0, 0), IDENTITY))).toBeCloseTo(-0.5);
    });

    it("sees the gap between a tilted box and a corner its bounding box would cover", () => {
        const tilted = obb(cube(-0.5, -0.5, -0.5), axisRotation(vec(0, 0, 1), Math.PI / 4));
        expect(penetration(tilted, obb(cube(0.45, 0.45, -0.5, 0.2), IDENTITY))).toBeLessThan(0);
        expect(penetration(tilted, obb(cube(0.3, -0.1, -0.1, 0.2), IDENTITY))).toBeGreaterThan(0);
    });
});

describe("contains", () => {
    it("accepts points on the surface within the margin", () => {
        const o = obb(cube(0, 0, 0), IDENTITY);
        expect(contains(o, vec(1, 0.5, 0.5), 0.001)).toBe(true);
        expect(contains(o, vec(1.01, 0.5, 0.5), 0.001)).toBe(false);
    });
});
