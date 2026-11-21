import type { Setup } from "../src/model/types";

/** A 3.6 × 5.8 m room around a 4.0 m sliding module, with Sleep, Work and Day modes; the rule tests break it on purpose. */
export const SLIDING_ROOM: Setup = {
    version: 1,
    name: "Shiftroom 4.0 m",
    room: { width: 3.6, depth: 5.8, height: 2.6 },
    modules: [
        { id: "wall-1", type: "sliding-wall", name: "Shiftroom module", x: 0, z: 0.35, rotation: 0, config: { length: 4.0, travel: 3.1 } },
        { id: "kitchen-1", type: "kitchen", name: "Kitchen", x: 1.0, z: 5.2, rotation: 180, config: { length: 2.6 } },
        { id: "post-1", type: "window-post", name: "Window shelf", x: 1.6, z: 0, rotation: 0, config: {} },
        { id: "chair-1", type: "armchair", name: "Armchair and table", x: 0, z: 4.4, rotation: 90, config: {} },
        { id: "door-1", type: "door", name: "Door", x: 2.8, z: 4.35, rotation: 90, config: {} },
    ],
    modes: [
        { id: "mode-1", name: "Sleep", states: { "wall-1": { slide: 0, bed: 1, desk: 0 } } },
        { id: "mode-2", name: "Work", states: { "wall-1": { slide: 1, bed: 0, desk: 1 } } },
        { id: "mode-3", name: "Day", states: { "wall-1": { slide: 0.5, bed: 0, desk: 0 } } },
    ],
};

/** The shortest sliding module, 2.6 m, in a 3.2 × 4.4 m room. */
export const COMPACT_ROOM: Setup = {
    version: 1,
    name: "Compact 2.6 m",
    room: { width: 3.2, depth: 4.4, height: 2.6 },
    modules: [
        { id: "wall-1", type: "sliding-wall", name: "Shiftroom module", x: 0, z: 0.35, rotation: 0, config: { length: 2.6, travel: 2.7 } },
        { id: "kitchen-1", type: "kitchen", name: "Kitchen", x: 1.0, z: 3.8, rotation: 180, config: { length: 2.2 } },
        { id: "post-1", type: "window-post", name: "Window shelf", x: 1.4, z: 0, rotation: 0, config: {} },
        { id: "chair-1", type: "armchair", name: "Armchair and table", x: 0, z: 2.95, rotation: 90, config: {} },
        { id: "door-1", type: "door", name: "Door", x: 2.4, z: 2.95, rotation: 90, config: {} },
    ],
    modes: [
        { id: "mode-1", name: "Sleep", states: { "wall-1": { slide: 0, bed: 1, desk: 0 } } },
        { id: "mode-2", name: "Work", states: { "wall-1": { slide: 1, bed: 0, desk: 1 } } },
    ],
};
