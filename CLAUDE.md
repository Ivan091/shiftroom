# shiftroom

Static 3D configurator for Shiftroom, a sliding multi-mode furniture module for small rooms. Live at https://ivan091.github.io/shiftroom/ (GitHub Pages, deployed from `master`).

## Stack

Vite + TypeScript (strict) + Three.js, Vitest for unit tests. No framework: the UI is plain DOM built with `src/ui/dom.ts`.

## Layout

- `src/model/`: pure TypeScript, no Three.js and no DOM. Everything here is unit tested.
  - `types.ts`: `Setup` (room, modules, modes), `Part` (an axis-aligned box in metres).
  - `catalog.ts`: module types with parameters, configuration and parametric geometry; placement and quarter-turn rotation (the anchor `x, z` is always the minimum corner of the rest footprint).
  - `transition.ts`: interpolation between two modes in three stages (fold, move, unfold).
  - `collision.ts`: clashes between moving parts and other modules or the room walls, sampled along a transition.
  - `setup.ts`: JSON validation (`parseSetup`) and serialization. `edit.ts`: immutable editing operations. `presets.ts`: ready-made setups.
- `src/view/scene.ts`: the Three.js scene; syncs one mesh per part key, picking and floor dragging.
- `src/ui/app.ts`: sidebar, transition bar, localStorage (`shiftroom.setup.v1`), save/load JSON.
- `tests/`: Vitest unit tests for the model.

Coordinates: metres; x across the room width from the left wall, z into the depth from the window wall, y up.

## Commands

- `npm ci` once, then `npm run dev` for a dev server (http://localhost:5173/shiftroom/).
- `npm test` runs the unit tests, `npm run typecheck` the TypeScript check, `npm run build` the production build into `dist/`.
- `bash scripts/check.sh` is the gate: typecheck, tests and build. Run it before every commit; CI runs it on pull requests and before each deploy.

## Delivery

Branch, commit (Conventional Commits), push, pull request, merge, with the global `contribute` and `ship` skills; never commit to `master`. A push to `master` runs `.github/workflows/pages.yml`, which runs the gate and deploys `dist/` to GitHub Pages (Pages source: GitHub Actions).

## Rules

- Keep `src/model/` free of rendering and DOM code, and cover model changes with tests.
- Adding a module type: add a `ModuleType` to `CATALOG` in `catalog.ts`; parameters of kind `extend` fold before and unfold after parameters of kind `move` in transitions.
- No code comments except doc comments (`/** */`).
