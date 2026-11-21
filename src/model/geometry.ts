import type { Box } from "./types";

/** A point or direction in room space, in metres. */
export interface Vec3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** A row-major 3×3 rotation matrix. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

/** A rigid placement: rotate by `r`, then translate by `t`. */
export interface Pose {
    readonly r: Mat3;
    readonly t: Vec3;
}

/** An oriented box: centre, three unit axes and the half extent along each. */
export interface Obb {
    readonly center: Vec3;
    readonly axes: readonly [Vec3, Vec3, Vec3];
    readonly half: readonly [number, number, number];
}

export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const ORIGIN: Vec3 = vec(0, 0, 0);

const IDENTITY_R: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export const IDENTITY: Pose = { r: IDENTITY_R, t: ORIGIN };

export const add = (a: Vec3, b: Vec3): Vec3 => vec(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, k: number): Vec3 => vec(a.x * k, a.y * k, a.z * k);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = (a: Vec3): number => Math.sqrt(dot(a, a));

/** Rotates a direction by a matrix. */
export function rotate(r: Mat3, v: Vec3): Vec3 {
    return vec(r[0] * v.x + r[1] * v.y + r[2] * v.z, r[3] * v.x + r[4] * v.y + r[5] * v.z, r[6] * v.x + r[7] * v.y + r[8] * v.z);
}

/** Maps a point through a pose. */
export function apply(p: Pose, v: Vec3): Vec3 {
    return add(rotate(p.r, v), p.t);
}

function multiply(a: Mat3, b: Mat3): Mat3 {
    const out: number[] = [];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            out.push(a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!);
        }
    }
    return out as unknown as Mat3;
}

/** The pose that applies `inner` first and then `outer`. */
export function compose(outer: Pose, inner: Pose): Pose {
    return { r: multiply(outer.r, inner.r), t: apply(outer, inner.t) };
}

/** A pure translation. */
export function translation(t: Vec3): Pose {
    return { r: IDENTITY_R, t };
}

/** Right-handed rotation by `angle` radians about a unit axis through the origin. */
export function axisRotation(axis: Vec3, angle: number): Pose {
    const n = scale(axis, 1 / length(axis));
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const k = 1 - c;
    const { x, y, z } = n;
    return {
        r: [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k],
        t: ORIGIN,
    };
}

/** The oriented box a box given in some frame occupies once that frame is placed by `pose`. */
export function obb(box: Box, pose: Pose): Obb {
    const center = apply(pose, vec(box.x + box.w / 2, box.y + box.h / 2, box.z + box.d / 2));
    const axes: [Vec3, Vec3, Vec3] = [rotate(pose.r, vec(1, 0, 0)), rotate(pose.r, vec(0, 1, 0)), rotate(pose.r, vec(0, 0, 1))];
    return { center, axes, half: [box.w / 2, box.h / 2, box.d / 2] };
}

/** The eight corners of an oriented box. */
export function corners(o: Obb): Vec3[] {
    const out: Vec3[] = [];
    for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
            for (const sz of [-1, 1]) {
                out.push(add(o.center, add(scale(o.axes[0], sx * o.half[0]), add(scale(o.axes[1], sy * o.half[1]), scale(o.axes[2], sz * o.half[2])))));
            }
        }
    }
    return out;
}

/** The smallest axis-aligned box around an oriented box. */
export function bounds(o: Obb): Box {
    const pts = corners(o);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const zs = pts.map((p) => p.z);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const z = Math.min(...zs);
    return { x, y, z, w: Math.max(...xs) - x, h: Math.max(...ys) - y, d: Math.max(...zs) - z };
}

/** Half the width of an oriented box measured along a unit direction. */
export function radiusAlong(o: Obb, dir: Vec3): number {
    return o.half[0] * Math.abs(dot(o.axes[0], dir)) + o.half[1] * Math.abs(dot(o.axes[1], dir)) + o.half[2] * Math.abs(dot(o.axes[2], dir));
}

/**
 * How deep two oriented boxes interpenetrate, by the separating axis test: the smallest overlap of
 * their projections over the fifteen candidate axes. Positive means they overlap by at least that
 * much along every axis; zero means they touch; negative means a gap of at least that size.
 */
export function penetration(a: Obb, b: Obb): number {
    const candidates: Vec3[] = [...a.axes, ...b.axes];
    for (const p of a.axes) {
        for (const q of b.axes) {
            const c = cross(p, q);
            const n = length(c);
            if (n > 1e-9) candidates.push(scale(c, 1 / n));
        }
    }
    const between = sub(b.center, a.center);
    let least = Infinity;
    for (const axis of candidates) {
        const depth = radiusAlong(a, axis) + radiusAlong(b, axis) - Math.abs(dot(between, axis));
        if (depth < least) least = depth;
    }
    return least;
}

/** Whether a point lies inside an oriented box grown by `margin` on every side. */
export function contains(o: Obb, p: Vec3, margin: number): boolean {
    const d = sub(p, o.center);
    return o.axes.every((axis, i) => Math.abs(dot(d, axis)) <= o.half[i]! + margin);
}
