import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import type { Finish, Part, Room } from "../model/types";

const FINISH_COLOURS: Record<Finish, number> = {
    panel: 0xece6da,
    wardrobe: 0xc49a6c,
    bed: 0x6f8296,
    mattress: 0xf4f1ea,
    desk: 0xb98458,
    rail: 0x4a4a4a,
    counter: 0xdcdcd8,
    cabinet: 0x9db3a3,
    post: 0x3d3d3d,
    shelf: 0xb98458,
    chair: 0xc46d48,
    table: 0xb98458,
};

const WALL_HEIGHT = 2.6;
const SELECTED = new THREE.Color(0x2f6fde);
const CLASHING = new THREE.Color(0xe0312b);

/** Callbacks from the 3D view to the editor: picking and dragging modules on the floor. */
export interface ViewEvents {
    readonly onPick: (moduleId: string | undefined) => void;
    readonly onDragMove: (moduleId: string, dx: number, dz: number) => void;
    readonly onDragEnd: (moduleId: string) => void;
}

interface PartMesh {
    readonly mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
    readonly edges: THREE.LineSegments;
}

/** The Three.js scene: room shell, module boxes kept in sync by part key, orbit camera and floor dragging. */
export class RoomView {
    private readonly renderer: THREE.WebGLRenderer;
    private readonly labels: CSS2DRenderer;
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
    private readonly controls: OrbitControls;
    private readonly unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5);
    private readonly unitEdges = new THREE.EdgesGeometry(this.unitBox);
    private readonly edgeMaterial = new THREE.LineBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.35 });
    private readonly parts = new Map<string, PartMesh>();
    private readonly shell = new THREE.Group();
    private readonly raycaster = new THREE.Raycaster();
    private readonly floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    private room: Room | undefined;
    private drag: { moduleId: string; start: THREE.Vector3; pointerId: number } | undefined;

    constructor(
        private readonly container: HTMLElement,
        private readonly events: ViewEvents,
    ) {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);
        this.labels = new CSS2DRenderer();
        this.labels.domElement.className = "labels";
        container.appendChild(this.labels.domElement);

        this.scene.background = new THREE.Color(0xf3f1ed);
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc6b8, 1.6));
        const sun = new THREE.DirectionalLight(0xffffff, 1.6);
        sun.position.set(-3, 8, -2);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.camera.left = -10;
        sun.shadow.camera.right = 10;
        sun.shadow.camera.top = 10;
        sun.shadow.camera.bottom = -10;
        sun.shadow.bias = -0.0005;
        this.scene.add(sun, sun.target);
        this.scene.add(this.shell);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.maxPolarAngle = Math.PI * 0.49;
        this.controls.minDistance = 1.5;
        this.controls.maxDistance = 30;

        const canvas = this.renderer.domElement;
        canvas.addEventListener("pointerdown", (e) => this.pointerDown(e));
        canvas.addEventListener("pointermove", (e) => this.pointerMove(e));
        canvas.addEventListener("pointerup", (e) => this.pointerUp(e));
        canvas.addEventListener("pointercancel", (e) => this.pointerUp(e));

        new ResizeObserver(() => this.resize()).observe(container);
        this.resize();
        this.renderer.setAnimationLoop(() => {
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
            this.labels.render(this.scene, this.camera);
        });
    }

    /** Rebuilds the room shell (floor, walls, grid, dimensions) and reframes the camera when the size changed. */
    setRoom(room: Room): void {
        if (this.room && this.room.width === room.width && this.room.depth === room.depth) return;
        const reframe = !this.room;
        this.room = room;
        this.shell.traverse((o) => {
            if (o instanceof CSS2DObject) o.element.remove();
        });
        this.shell.clear();
        const { width: w, depth: d } = room;

        const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0xe2d6c3, roughness: 0.9 }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(w / 2, 0, d / 2);
        floor.receiveShadow = true;
        this.shell.add(floor);

        const grid: number[] = [];
        for (let x = 0.5; x < w - 1e-6; x += 0.5) grid.push(x, 0.002, 0, x, 0.002, d);
        for (let z = 0.5; z < d - 1e-6; z += 0.5) grid.push(0, 0.002, z, w, 0.002, z);
        const gridGeometry = new THREE.BufferGeometry();
        gridGeometry.setAttribute("position", new THREE.Float32BufferAttribute(grid, 3));
        this.shell.add(new THREE.LineSegments(gridGeometry, new THREE.LineBasicMaterial({ color: 0xb9ab95, transparent: true, opacity: 0.5 })));

        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: 1, side: THREE.DoubleSide });
        const wall = (sx: number, sy: number, sz: number, x: number, y: number, z: number): void => {
            const m = new THREE.Mesh(this.unitBox, wallMaterial);
            m.scale.set(sx, sy, sz);
            m.position.set(x, y, z);
            m.receiveShadow = true;
            this.shell.add(m);
        };
        const t = 0.08;
        wall(w + 2 * t, WALL_HEIGHT, t, -t, 0, -t);
        wall(t, WALL_HEIGHT, d + t, -t, 0, 0);
        wall(t, 0.12, d + t, w, 0, 0);
        wall(w + 2 * t, 0.12, t, -t, 0, d);

        const windowWidth = Math.min(1.4, w * 0.5);
        const glass = new THREE.Mesh(this.unitBox, new THREE.MeshStandardMaterial({ color: 0xa9d0ee, emissive: 0x6a9cc4, emissiveIntensity: 0.35 }));
        glass.scale.set(windowWidth, 1.3, 0.02);
        glass.position.set((w - windowWidth) / 2, 0.9, -0.005);
        this.shell.add(glass);

        this.shell.add(this.label(`${w.toFixed(2)} m`, w / 2, 0.02, d + 0.35, "dim"));
        this.shell.add(this.label(`${d.toFixed(2)} m`, w + 0.35, 0.02, d / 2, "dim"));
        this.shell.add(this.label("Window", w / 2, 2.35, 0, "tag"));
        this.shell.add(this.label("Entrance side", w / 2, 0.02, d + 0.75, "tag"));

        if (reframe) this.frame();
        else this.controls.target.set(w / 2, 0.6, d / 2);
    }

    /** Points the camera at the whole room from the entrance side. */
    frame(): void {
        if (!this.room) return;
        const { width: w, depth: d } = this.room;
        const radius = Math.hypot(w, d, WALL_HEIGHT) / 2;
        const vertical = THREE.MathUtils.degToRad(this.camera.fov) / 2;
        const horizontal = Math.atan(Math.tan(vertical) * this.camera.aspect);
        const distance = (radius / Math.sin(Math.min(vertical, horizontal))) * 1.1;
        const direction = new THREE.Vector3(0.18, 1.3, 0.95).normalize();
        this.controls.target.set(w / 2, 0.4, d * 0.6);
        this.camera.position.copy(this.controls.target).addScaledVector(direction, distance);
        this.controls.update();
    }

    /** Shows the given parts, reusing meshes by key, and tints the selected module and clashing parts. */
    setParts(parts: readonly Part[], selected: string | undefined, clashing: ReadonlySet<string>): void {
        const seen = new Set<string>();
        for (const p of parts) {
            seen.add(p.key);
            const entry = this.parts.get(p.key) ?? this.createPart(p);
            const { mesh } = entry;
            const visible = p.box.w > 1e-3 && p.box.h > 1e-3 && p.box.d > 1e-3;
            mesh.visible = visible;
            if (!visible) continue;
            mesh.scale.set(p.box.w, p.box.h, p.box.d);
            mesh.position.set(p.box.x, p.box.y, p.box.z);
            const moduleId = p.key.slice(0, p.key.indexOf(":"));
            const material = mesh.material;
            if (clashing.has(p.key)) {
                material.emissive.copy(CLASHING);
                material.emissiveIntensity = 0.55;
            } else if (moduleId === selected && p.finish !== "rail") {
                material.emissive.copy(SELECTED);
                material.emissiveIntensity = 0.22;
            } else {
                material.emissiveIntensity = 0;
            }
        }
        for (const [key, entry] of this.parts) {
            if (seen.has(key)) continue;
            entry.mesh.removeFromParent();
            entry.mesh.material.dispose();
            this.parts.delete(key);
        }
    }

    /** The current frame as a PNG data URL. */
    snapshot(): string {
        this.renderer.render(this.scene, this.camera);
        return this.renderer.domElement.toDataURL("image/png");
    }

    private createPart(p: Part): PartMesh {
        const material = new THREE.MeshStandardMaterial({ color: FINISH_COLOURS[p.finish], roughness: 0.75 });
        const mesh = new THREE.Mesh(this.unitBox, material);
        mesh.castShadow = p.solid;
        mesh.receiveShadow = true;
        mesh.userData.moduleId = p.key.slice(0, p.key.indexOf(":"));
        const edges = new THREE.LineSegments(this.unitEdges, this.edgeMaterial);
        edges.raycast = () => undefined;
        mesh.add(edges);
        this.scene.add(mesh);
        const entry = { mesh, edges };
        this.parts.set(p.key, entry);
        return entry;
    }

    private label(text: string, x: number, y: number, z: number, kind: string): CSS2DObject {
        const el = document.createElement("div");
        el.className = `scene-label ${kind}`;
        el.textContent = text;
        const obj = new CSS2DObject(el);
        obj.position.set(x, y, z);
        return obj;
    }

    private resize(): void {
        const w = Math.max(1, this.container.clientWidth);
        const h = Math.max(1, this.container.clientHeight);
        this.renderer.setSize(w, h);
        this.labels.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    private ray(e: PointerEvent): void {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        this.raycaster.setFromCamera(ndc, this.camera);
    }

    private floorPoint(): THREE.Vector3 | undefined {
        const hit = new THREE.Vector3();
        return this.raycaster.ray.intersectPlane(this.floorPlane, hit) ?? undefined;
    }

    private pointerDown(e: PointerEvent): void {
        if (e.button !== 0) return;
        this.ray(e);
        const meshes = [...this.parts.values()].map((p) => p.mesh).filter((m) => m.visible);
        const hit = this.raycaster.intersectObjects(meshes, false)[0];
        const moduleId = hit?.object.userData.moduleId as string | undefined;
        this.events.onPick(moduleId);
        if (!moduleId) return;
        const start = this.floorPoint();
        if (!start) return;
        this.drag = { moduleId, start, pointerId: e.pointerId };
        this.controls.enabled = false;
        this.renderer.domElement.setPointerCapture(e.pointerId);
    }

    private pointerMove(e: PointerEvent): void {
        if (!this.drag || e.pointerId !== this.drag.pointerId) return;
        this.ray(e);
        const p = this.floorPoint();
        if (p) this.events.onDragMove(this.drag.moduleId, p.x - this.drag.start.x, p.z - this.drag.start.z);
    }

    private pointerUp(e: PointerEvent): void {
        if (!this.drag || e.pointerId !== this.drag.pointerId) return;
        const { moduleId } = this.drag;
        this.drag = undefined;
        this.controls.enabled = true;
        this.renderer.domElement.releasePointerCapture(e.pointerId);
        this.events.onDragEnd(moduleId);
    }
}
