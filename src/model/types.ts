/** Three-dimensional axis-aligned box in metres: x across the room width, y up, z into the room depth. */
export interface Box {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
    readonly h: number;
    readonly d: number;
}

import type { Pose, Vec3 } from "./geometry";

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
    | "table"
    | "door"
    | "grille"
    | "arm"
    | "screen"
    | "display"
    | "computer"
    | "keyboard";

/** What keeps a piece in place: it stands on the floor, or its back (the face at its minimum z) is fixed to a room wall. */
export type Rest = "floor" | "wall";

/**
 * One named, coloured box of a placed module. `box` is given in the frame of the rigid link the
 * piece belongs to, and `pose` places that frame in the room, so a tilted bed is a tilted box.
 */
export interface Part {
    readonly key: string;
    readonly moduleId: string;
    readonly link: string;
    readonly label: string;
    readonly finish: Finish;
    readonly box: Box;
    readonly pose: Pose;
    readonly moving: boolean;
    readonly solid: boolean;
    readonly rest?: Rest;
}

/**
 * Space that must stay free of solid parts in the current state: the floor in front of a kitchen,
 * the sweep of a door, the knee room under a desk. Zones in one `group` are alternatives, and only
 * one of them needs to be free. A seat's legroom zone has the direction the seat faces.
 */
export interface Zone {
    readonly key: string;
    readonly moduleId: string;
    readonly label: string;
    readonly box: Box;
    readonly pose: Pose;
    readonly group?: string;
    readonly facing?: Vec3;
}

/** A joint between a link and its parent, placed in the room, for the joint limit and attachment checks. */
export interface PlacedJoint {
    readonly moduleId: string;
    readonly link: string;
    readonly label: string;
    readonly parent: string;
    readonly kind: "slide" | "hinge";
    readonly value: number;
    readonly min: number;
    readonly max: number;
    readonly origin: Vec3;
    readonly axis: Vec3;
}

/** A link that carries weight in the current state and the links it rests on, which must stand on the floor. */
export interface PlacedLoad {
    readonly moduleId: string;
    readonly link: string;
    readonly label: string;
    readonly props: readonly string[];
}

/** A screen in use, placed in the room: its face centre, outward normal, top edge height and the seated eye it serves. */
export interface PlacedScreen {
    readonly key: string;
    readonly moduleId: string;
    readonly link: string;
    readonly label: string;
    readonly center: Vec3;
    readonly normal: Vec3;
    readonly top: number;
    readonly eye: Vec3;
}

/** Everything a module contributes to the room in one state. */
export interface PlacedModule {
    readonly links: readonly { readonly id: string; readonly label: string; readonly parent?: string }[];
    readonly parts: readonly Part[];
    readonly zones: readonly Zone[];
    readonly joints: readonly PlacedJoint[];
    readonly loads: readonly PlacedLoad[];
    readonly screens: readonly PlacedScreen[];
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

/** Room dimensions in metres; `height` is the clear height to the ceiling. */
export interface Room {
    readonly width: number;
    readonly depth: number;
    readonly height: number;
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
