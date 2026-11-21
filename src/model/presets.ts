import type { Setup } from "./types";

const SLEEP = { slide: 0, bed: 1, desk: 0 };
const WORK = { slide: 1, bed: 0, desk: 1 };

/**
 * Ready-made setups. The window wall is at depth 0 and the entrance wall at the far end; the module's
 * bed/desk end faces the window and its wardrobe the entrance, with the fixed pieces outside its track.
 */
export const PRESETS: readonly Setup[] = [
    {
        version: 1,
        name: "Shiftroom 4.0 m",
        room: { width: 3.6, depth: 5.6 },
        modules: [
            { id: "wall-1", type: "sliding-wall", name: "Shiftroom module", x: 0, z: 0.4, rotation: 0, config: { length: 4.0, travel: 3.1 } },
            { id: "kitchen-1", type: "kitchen", name: "Kitchen", x: 1.6, z: 5.0, rotation: 180, config: { length: 2.0 } },
            { id: "post-1", type: "window-post", name: "Window shelf", x: 1.6, z: 0, rotation: 0, config: {} },
            { id: "chair-1", type: "armchair", name: "Armchair and table", x: 0, z: 4.75, rotation: 180, config: {} },
        ],
        modes: [
            { id: "mode-1", name: "Sleep", states: { "wall-1": SLEEP } },
            { id: "mode-2", name: "Work", states: { "wall-1": WORK } },
        ],
    },
    {
        version: 1,
        name: "Compact 2.6 m",
        room: { width: 3.2, depth: 3.9 },
        modules: [
            { id: "wall-1", type: "sliding-wall", name: "Shiftroom module", x: 0, z: 0.3, rotation: 0, config: { length: 2.6, travel: 2.7 } },
            { id: "kitchen-1", type: "kitchen", name: "Kitchen", x: 1.5, z: 3.3, rotation: 180, config: { length: 1.7 } },
            { id: "post-1", type: "window-post", name: "Window shelf", x: 1.4, z: 0, rotation: 0, config: {} },
            { id: "chair-1", type: "armchair", name: "Armchair and table", x: 0, z: 3.05, rotation: 180, config: {} },
        ],
        modes: [
            { id: "mode-1", name: "Sleep", states: { "wall-1": SLEEP } },
            { id: "mode-2", name: "Work", states: { "wall-1": WORK } },
        ],
    },
    {
        version: 1,
        name: "Large 5.3 m, three modes",
        room: { width: 4.0, depth: 7.0 },
        modules: [
            { id: "wall-1", type: "sliding-wall", name: "Shiftroom module", x: 0, z: 0.4, rotation: 0, config: { length: 5.3, travel: 3.5 } },
            { id: "kitchen-1", type: "kitchen", name: "Kitchen", x: 1.6, z: 6.4, rotation: 180, config: { length: 2.4 } },
            { id: "post-1", type: "window-post", name: "Window shelf", x: 1.8, z: 0, rotation: 0, config: {} },
            { id: "chair-1", type: "armchair", name: "Armchair and table", x: 0, z: 6.15, rotation: 180, config: {} },
        ],
        modes: [
            { id: "mode-1", name: "Sleep", states: { "wall-1": SLEEP } },
            { id: "mode-2", name: "Work", states: { "wall-1": WORK } },
            { id: "mode-3", name: "Day", states: { "wall-1": { slide: 0.5, bed: 0, desk: 0 } } },
        ],
    },
];
