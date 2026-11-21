import type { Setup } from "./types";

const SLEEP = { slide: 0, bed: 1, desk: 0 };
const WORK = { slide: 1, bed: 0, desk: 1 };

/**
 * Ready-made setups. The window wall is at depth 0 and the entrance at the far end. The sliding
 * module spans the depth from just past the window shelf and slides across the whole width; the
 * strip between its far end and the entrance wall holds what never moves: the armchair facing into
 * the room, the kitchen with its working space, and the door in the side wall.
 */
export const PRESETS: readonly Setup[] = [
    {
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
            { id: "mode-1", name: "Sleep", states: { "wall-1": SLEEP } },
            { id: "mode-2", name: "Work", states: { "wall-1": WORK } },
        ],
    },
    {
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
            { id: "mode-1", name: "Sleep", states: { "wall-1": SLEEP } },
            { id: "mode-2", name: "Work", states: { "wall-1": WORK } },
        ],
    },
    {
        version: 1,
        name: "Large 5.3 m, three modes",
        room: { width: 4.0, depth: 7.1, height: 2.6 },
        modules: [
            { id: "wall-1", type: "sliding-wall", name: "Shiftroom module", x: 0, z: 0.35, rotation: 0, config: { length: 5.3, travel: 3.5 } },
            { id: "kitchen-1", type: "kitchen", name: "Kitchen", x: 1.0, z: 6.5, rotation: 180, config: { length: 3.0 } },
            { id: "post-1", type: "window-post", name: "Window shelf", x: 1.8, z: 0, rotation: 0, config: {} },
            { id: "chair-1", type: "armchair", name: "Armchair and table", x: 0, z: 5.65, rotation: 90, config: {} },
            { id: "door-1", type: "door", name: "Door", x: 3.2, z: 5.65, rotation: 90, config: {} },
        ],
        modes: [
            { id: "mode-1", name: "Sleep", states: { "wall-1": SLEEP } },
            { id: "mode-2", name: "Work", states: { "wall-1": WORK } },
            { id: "mode-3", name: "Day", states: { "wall-1": { slide: 0.5, bed: 0, desk: 0 } } },
        ],
    },
    {
        version: 1,
        name: "Turning module",
        room: { width: 3.0, depth: 3.9, height: 2.6 },
        modules: [
            { id: "turn-1", type: "turning", name: "Turning module", x: 0, z: 0.35, rotation: 0, config: {} },
            { id: "kitchen-1", type: "kitchen", name: "Kitchen", x: 1.0, z: 3.3, rotation: 180, config: { length: 2.0 } },
            { id: "post-1", type: "window-post", name: "Window shelf", x: 1.6, z: 0, rotation: 0, config: {} },
            { id: "chair-1", type: "armchair", name: "Armchair and table", x: 0, z: 2.45, rotation: 90, config: {} },
            { id: "door-1", type: "door", name: "Door", x: 2.2, z: 2.45, rotation: 90, config: {} },
        ],
        modes: [
            { id: "mode-1", name: "Sleep", states: { "turn-1": { turn: 0, bed: 1, desk: 0 } } },
            { id: "mode-2", name: "Work", states: { "turn-1": { turn: 1, bed: 0, desk: 1 } } },
        ],
    },
];
