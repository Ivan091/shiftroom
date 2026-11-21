import type { Setup } from "./types";

/**
 * The ready-made setup: a 3.0 × 3.9 m studio around the turning module, whose bed side and hidden
 * workstation side take turns facing the room. Sleep has the bed side out and the bed down; Work
 * turns the module and opens the workstation; Day turns it and leaves everything folded. The window
 * wall is at depth 0 and the entrance at the far end. The module stands against the left wall just
 * past the window shelf, with room in front of it to pull out and turn; the strip by the entrance
 * holds what never moves: the armchair facing into the room, the kitchen with its working space and
 * the door in the side wall.
 */
export const PRESETS: readonly Setup[] = [
    {
        version: 1,
        name: "Shiftroom studio",
        room: { width: 3.0, depth: 3.9, height: 2.6 },
        modules: [
            { id: "turn-1", type: "turning", name: "Shiftroom module", x: 0, z: 0.35, rotation: 0, config: {} },
            { id: "kitchen-1", type: "kitchen", name: "Kitchen", x: 1.0, z: 3.3, rotation: 180, config: { length: 2.0 } },
            { id: "post-1", type: "window-post", name: "Window shelf", x: 1.6, z: 0, rotation: 0, config: {} },
            { id: "chair-1", type: "armchair", name: "Armchair and table", x: 0, z: 2.45, rotation: 90, config: {} },
            { id: "door-1", type: "door", name: "Door", x: 2.2, z: 2.45, rotation: 90, config: {} },
        ],
        modes: [
            { id: "mode-1", name: "Sleep", states: { "turn-1": { turn: 0, bed: 1, desk: 0 } } },
            { id: "mode-2", name: "Work", states: { "turn-1": { turn: 1, bed: 0, desk: 1 } } },
            { id: "mode-3", name: "Day", states: { "turn-1": { turn: 1, bed: 0, desk: 0 } } },
        ],
    },
];
