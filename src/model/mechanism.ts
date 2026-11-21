import { apply, axisRotation, compose, IDENTITY, type Pose, rotate, scale, translation, type Vec3 } from "./geometry";
import type { Box, Finish, PlacedJoint, PlacedLoad, PlacedModule, PlacedScreen, Part, Rest, Zone } from "./types";

/**
 * How a link hangs from its parent. The link's frame starts at `origin` in the parent's frame and
 * then moves along (`slide`) or turns about (`hinge`, radians) the axis by `value`, which must stay
 * within `min..max`. A `fixed` link is rigidly bolted to its parent.
 */
export type Joint =
    | { readonly kind: "fixed"; readonly origin: Vec3 }
    | {
          readonly kind: "slide" | "hinge";
          readonly origin: Vec3;
          readonly axis: Vec3;
          readonly value: number;
          readonly min: number;
          readonly max: number;
      };

/** One box of a rigid link, in the link's frame. */
export interface Piece {
    readonly key: string;
    readonly label: string;
    readonly finish: Finish;
    readonly box: Box;
    readonly solid: boolean;
    readonly rest?: Rest;
}

/** A rigid body of a module: its pieces and the joint that attaches it to its parent link, or to the module itself. */
export interface Link {
    readonly key: string;
    readonly label: string;
    readonly parent?: string;
    readonly joint: Joint;
    readonly pieces: readonly Piece[];
}

/** A clearance zone in the frame of one link. */
export interface ZoneSpec {
    readonly key: string;
    readonly label: string;
    readonly link: string;
    readonly box: Box;
    readonly group?: string;
    readonly facing?: Vec3;
}

/** A link that carries weight in this state and the links it rests on. */
export interface LoadSpec {
    readonly link: string;
    readonly label: string;
    readonly props: readonly string[];
}

/**
 * A screen in use: the centre and outward normal of its face and half its height, in the frame of
 * its link, and the seated eye it is meant for, in the frame of another link.
 */
export interface ScreenSpec {
    readonly key: string;
    readonly label: string;
    readonly link: string;
    readonly center: Vec3;
    readonly normal: Vec3;
    readonly halfHeight: number;
    readonly eye: { readonly link: string; readonly point: Vec3 };
}

/** The whole mechanism of a module in one state, in the module's own frame; links are listed parents first. */
export interface Mechanism {
    readonly links: readonly Link[];
    readonly zones: readonly ZoneSpec[];
    readonly loads: readonly LoadSpec[];
    readonly screens?: readonly ScreenSpec[];
}

export const box = (x: number, y: number, z: number, w: number, h: number, d: number): Box => ({ x, y, z, w, h, d });

/** A box from its two opposite corners, which reads closer to a drawing than origin and size. */
export const span = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Box => box(x0, y0, z0, x1 - x0, y1 - y0, z1 - z0);

export const piece = (key: string, label: string, finish: Finish, b: Box, options: { solid?: boolean; rest?: Rest } = {}): Piece => ({
    key,
    label,
    finish,
    box: b,
    solid: options.solid ?? true,
    ...(options.rest ? { rest: options.rest } : {}),
});

function jointMotion(joint: Joint): Pose {
    if (joint.kind === "fixed") return IDENTITY;
    if (joint.kind === "slide") return translation(scale(joint.axis, joint.value));
    return axisRotation(joint.axis, joint.value);
}

/** Places a mechanism in the room with the module's pose, giving every piece, zone, joint and load room coordinates. */
export function placeMechanism(moduleId: string, mechanism: Mechanism, modulePose: Pose): PlacedModule {
    const poses = new Map<string, Pose>();
    const moving = new Map<string, boolean>();
    const parts: Part[] = [];
    const joints: PlacedJoint[] = [];
    for (const link of mechanism.links) {
        const parentPose = link.parent === undefined ? modulePose : poses.get(link.parent);
        if (!parentPose) throw new Error(`Link ${link.key} of ${moduleId} is listed before its parent ${link.parent}`);
        const anchor = compose(parentPose, translation(link.joint.origin));
        const pose = compose(anchor, jointMotion(link.joint));
        poses.set(link.key, pose);
        const isMoving = link.joint.kind !== "fixed" || (link.parent !== undefined && moving.get(link.parent) === true);
        moving.set(link.key, isMoving);
        const linkId = `${moduleId}:${link.key}`;
        for (const p of link.pieces) {
            parts.push({
                key: `${linkId}:${p.key}`,
                moduleId,
                link: linkId,
                label: p.label,
                finish: p.finish,
                box: p.box,
                pose,
                moving: isMoving,
                solid: p.solid,
                ...(p.rest ? { rest: p.rest } : {}),
            });
        }
        if (link.joint.kind !== "fixed" && link.parent !== undefined) {
            joints.push({
                moduleId,
                link: linkId,
                label: link.label,
                parent: `${moduleId}:${link.parent}`,
                kind: link.joint.kind,
                value: link.joint.value,
                min: link.joint.min,
                max: link.joint.max,
                origin: apply(anchor, { x: 0, y: 0, z: 0 }),
                axis: rotate(anchor.r, link.joint.axis),
            });
        }
    }
    const zones: Zone[] = mechanism.zones.map((z) => {
        const pose = poses.get(z.link);
        if (!pose) throw new Error(`Zone ${z.key} of ${moduleId} refers to unknown link ${z.link}`);
        return {
            key: `${moduleId}:${z.key}`,
            moduleId,
            label: z.label,
            box: z.box,
            pose,
            ...(z.group ? { group: `${moduleId}:${z.group}` } : {}),
            ...(z.facing ? { facing: rotate(pose.r, z.facing) } : {}),
        };
    });
    const loads: PlacedLoad[] = mechanism.loads.map((l) => ({
        moduleId,
        link: `${moduleId}:${l.link}`,
        label: l.label,
        props: l.props.map((p) => `${moduleId}:${p}`),
    }));
    const links = mechanism.links.map((l) => ({
        id: `${moduleId}:${l.key}`,
        label: l.label,
        ...(l.parent !== undefined ? { parent: `${moduleId}:${l.parent}` } : {}),
    }));
    const screens: PlacedScreen[] = (mechanism.screens ?? []).map((sc) => {
        const pose = poses.get(sc.link);
        const eyePose = poses.get(sc.eye.link);
        if (!pose || !eyePose) throw new Error(`Screen ${sc.key} of ${moduleId} refers to an unknown link`);
        const center = apply(pose, sc.center);
        return {
            key: `${moduleId}:${sc.key}`,
            moduleId,
            link: `${moduleId}:${sc.link}`,
            label: sc.label,
            center,
            normal: rotate(pose.r, sc.normal),
            top: center.y + sc.halfHeight,
            eye: apply(eyePose, sc.eye.point),
        };
    });
    return { links, parts, zones, joints, loads, screens };
}
