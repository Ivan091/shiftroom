import { describe, expect, it } from "vitest";
import { BED_FOOT, DESK, placedModule, SLIDING, TURNING } from "../src/model/catalog";
import { bounds, obb } from "../src/model/geometry";
import type { Box, ModuleInstance, ModuleState, Part } from "../src/model/types";

const slider: ModuleInstance = { id: "m", type: "sliding-wall", name: "Module", x: 0, z: 0, rotation: 0, config: { length: 4.0, travel: 3.0 } };
const turner: ModuleInstance = { id: "t", type: "turning", name: "Turner", x: 0, z: 0, rotation: 0, config: {} };

function extent(parts: readonly Part[]): Box {
    const boxes = parts.map((p) => bounds(obb(p.box, p.pose)));
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    const z = Math.min(...boxes.map((b) => b.z));
    return {
        x,
        y,
        z,
        w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
        h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
        d: Math.max(...boxes.map((b) => b.z + b.d)) - z,
    };
}

const linkParts = (module: ModuleInstance, state: ModuleState, link: string): Part[] =>
    placedModule(module, state).parts.filter((p) => p.link === `${module.id}:${link}`);

const topOf = (b: Box): number => b.y + b.h;

describe("sliding module", () => {
    it("stores the bed and the desk inside its 0.5 m body", () => {
        const e = extent(placedModule(slider, { slide: 0, bed: 0, desk: 0 }).parts.filter((p) => p.solid));
        expect(e.x).toBeGreaterThanOrEqual(-1e-9);
        expect(e.x + e.w).toBeLessThanOrEqual(SLIDING.thickness + 1e-9);
        expect(topOf(e)).toBeLessThanOrEqual(SLIDING.height + 1e-9);
    });

    it("lowers the bed to a 0.45-0.5 m mattress top on legs that stand on the floor", () => {
        const bed = linkParts(slider, { bed: 1 }, "bed");
        const mattress = extent(bed.filter((p) => p.finish === "mattress"));
        expect(topOf(mattress)).toBeGreaterThanOrEqual(0.45);
        expect(topOf(mattress)).toBeLessThanOrEqual(0.5);
        expect(mattress.w).toBeCloseTo(1.96);
        expect(mattress.d).toBeCloseTo(1.6);
        const frame = extent(bed);
        expect(frame.x + frame.w).toBeCloseTo(BED_FOOT);
        for (const leg of ["leg-a", "leg-b"]) {
            const e = extent(linkParts(slider, { bed: 1 }, leg));
            expect(e.y).toBeCloseTo(0);
            expect(e.h).toBeCloseTo(0.21);
        }
    });

    it("keeps the bed legs folded under the deck while the bed is still high", () => {
        const leg = extent(linkParts(slider, { bed: 0.3 }, "leg-a"));
        expect(leg.y).toBeGreaterThan(0.5);
    });

    it("opens the desk level at 0.75 m with gate legs under its front half", () => {
        const top = extent(linkParts(slider, { desk: 1 }, "desk"));
        expect(topOf(top)).toBeCloseTo(DESK.hingeY);
        expect(top.x).toBeCloseTo(-DESK.depth);
        for (const gate of ["gate-a", "gate-b"]) {
            const g = extent(linkParts(slider, { desk: 1 }, gate));
            expect(g.y).toBeCloseTo(0);
            expect(topOf(g)).toBeCloseTo(top.y);
            expect(g.x).toBeLessThan(-DESK.depth / 2);
        }
    });

    it("keeps every joint within its limits for any state", () => {
        for (let i = 0; i <= 20; i++) {
            const v = i / 20;
            for (const j of placedModule(slider, { slide: v, bed: v, desk: v }).joints) {
                expect(j.value).toBeGreaterThanOrEqual(j.min - 1e-9);
                expect(j.value).toBeLessThanOrEqual(j.max + 1e-9);
            }
        }
    });
});

describe("turning module", () => {
    it("pulls away from the wall, turns half a circle and comes back with the desk side out", () => {
        const body = (turn: number): Box => extent(linkParts(turner, { turn }, "body"));
        expect(body(0).x).toBeCloseTo(0);
        expect(body(1 / 3).x).toBeCloseTo(TURNING.pull);
        expect(body(0.5).w).toBeGreaterThan(1.9);
        expect(body(1).x).toBeCloseTo(0);
        const desk = extent(linkParts(turner, { turn: 1, desk: 1 }, "desk"));
        expect(desk.x).toBeCloseTo(SLIDING.thickness);
        expect(desk.x + desk.w).toBeCloseTo(SLIDING.thickness + DESK.depth);
    });

    it("keeps its turning circle clear of the wall behind it", () => {
        for (let i = 0; i <= 60; i++) {
            const e = extent(placedModule(turner, { turn: i / 60 }).parts.filter((p) => p.solid));
            expect(e.x).toBeGreaterThanOrEqual(-0.005);
        }
    });
});

describe("fixed pieces", () => {
    it("have standard heights", () => {
        const kitchen = placedModule({ id: "k", type: "kitchen", name: "K", x: 0, z: 0, rotation: 0, config: {} }, {}).parts;
        expect(topOf(extent(kitchen.filter((p) => p.finish === "counter")))).toBeCloseTo(0.9);
        const chair = placedModule({ id: "a", type: "armchair", name: "A", x: 0, z: 0, rotation: 0, config: {} }, {}).parts;
        expect(chair.find((p) => p.key.endsWith(":seat"))!.box.h).toBeCloseTo(0.42);
    });
});
