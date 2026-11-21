/** Three-dimensional axis-aligned box in metres: x across the room width, y up, z into the room depth. */
export interface Box {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
    readonly h: number;
    readonly d: number;
}

/** Visual material class of a box; the renderer maps each to a colour. */
export type Finish =
    | "panel"
    | "wardrobe"
    | "bed"
    | "mattress"
    | "desk"
    | "rail"
    | "counter"
    | "cabinet"
    | "post"
    | "shelf"
    | "chair"
    | "table";

/** One named, coloured box of a module, in room coordinates once placed. */
export interface Part {
    readonly key: string;
    readonly label: string;
    readonly finish: Finish;
    readonly box: Box;
    readonly moving: boolean;
    readonly solid: boolean;
}

/** How a state parameter takes part in a transition: extensions fold before moves and unfold after them. */
export type ParamKind = "move" | "extend";

/** A slider-controlled state value of a module, normalised to 0..1. */
export interface ParamSpec {
    readonly key: string;
    readonly label: string;
    readonly kind: ParamKind;
    readonly fallback: number;
}

/** Quarter-turn rotation of a module about its local origin. */
export type Rotation = 0 | 90 | 180 | 270;

/** Room dimensions in metres. */
export interface Room {
    readonly width: number;
    readonly depth: number;
}

/** One placed module: its catalogue type, placement and type-specific configuration. */
export interface ModuleInstance {
    readonly id: string;
    readonly type: string;
    readonly name: string;
    readonly x: number;
    readonly z: number;
    readonly rotation: Rotation;
    readonly config: Readonly<Record<string, number>>;
}

/** Values of a module's state parameters, keyed by parameter key. */
export type ModuleState = Readonly<Record<string, number>>;

/** A named mode: the state of every module that has parameters. */
export interface Mode {
    readonly id: string;
    readonly name: string;
    readonly states: Readonly<Record<string, ModuleState>>;
}

/** A whole design: room, modules and modes. */
export interface Setup {
    readonly version: 1;
    readonly name: string;
    readonly room: Room;
    readonly modules: readonly ModuleInstance[];
    readonly modes: readonly Mode[];
}
