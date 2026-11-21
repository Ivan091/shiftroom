# shiftroom

Static 3D configurator for Shiftroom, a sliding multi-mode furniture module for small rooms. Live at https://ivan091.github.io/shiftroom/ (GitHub Pages, deployed from `master`).

## Stack

Vite + TypeScript (strict) + Three.js, Vitest for unit tests. No framework: the UI is plain DOM built with `src/ui/dom.ts`.

## Layout

- `src/model/`: pure TypeScript, no Three.js and no DOM. Everything here is unit tested.
  - `types.ts`: `Setup` (room with height, modules, modes), `Part` (a box in its link's frame plus the pose that places it), `Zone` (clearance that must stay free).
  - `geometry.ts`: vectors, poses and oriented boxes; the separating axis test.
  - `mechanism.ts`: links, joints (fixed, slide, hinge with limits), clearance zones and loads; places a mechanism in the room.
  - `catalog.ts`: module types with parameters, configuration and their jointed mechanisms; placement and quarter-turn rotation (the anchor `x, z` is always the minimum corner of the rest footprint).
  - `transition.ts`: interpolation between two modes in three stages (fold, move, unfold).
  - `rules.ts`: the plausibility checks (clipping, room, floor, ceiling, support, joints, clearances, seats, screen viewing) for a state, a mode and a sampled transition.
  - `setup.ts`: JSON validation (`parseSetup`) and serialization. `edit.ts`: immutable editing operations. `presets.ts`: the one ready-made setup, a studio around the turning module.
- `src/view/scene.ts`: the Three.js scene; syncs one mesh per part key, picking and floor dragging; a wall between the camera and the room drops to a kerb.
- `src/ui/app.ts`: sidebar, transition bar, localStorage (`shiftroom.setup.v1`), save/load JSON.
- `tests/`: Vitest unit tests for the model, including the sweep of the preset (turning module) and of two sliding-module rooms (`tests/rooms.ts`) through every transition.
- `docs/mechanisms.md`: how each module works inside, joint by joint, and what the checks enforce.

Coordinates: metres; x across the room width from the left wall, z into the depth from the window wall, y up.

## Commands

- `npm ci` once, then `npm run dev` for a dev server (http://localhost:5173/shiftroom/).
- `npm test` runs the unit tests, `npm run typecheck` the TypeScript check, `npm run build` the production build into `dist/`.
- `bash scripts/check.sh` is the gate: typecheck, tests and build. Run it before every commit; CI runs it on pull requests and before each deploy.

## Delivery

Branch, commit (Conventional Commits), push, pull request, merge, with the global `contribute` and `ship` skills; never commit to `master`. A push to `master` runs `.github/workflows/pages.yml`, which runs the gate and deploys `dist/` to GitHub Pages (Pages source: GitHub Actions).

## Rules

- Keep `src/model/` free of rendering and DOM code, and cover model changes with tests.
- Adding a module type: add a `ModuleType` to `CATALOG` in `catalog.ts`, built as links and joints so the rules can check it, and describe its mechanism in `docs/mechanisms.md`; parameters of kind `extend` fold before and unfold after parameters of kind `move` in transitions.
- Every preset must pass every rule in every mode and transition; `tests/rules.test.ts` enforces it.
- No code comments except doc comments (`/** */`).
