# shiftroom

Shiftroom: configurator for a sliding multi-mode furniture module.

**Live:** https://ivan091.github.io/shiftroom/

Design a small room in 3D, place a sliding wall module (bed on one side, desk on the other, wardrobe in between) or a turning module and fixed pieces, define modes such as Sleep and Work, and watch the modules move between them. Every module is modelled as real joints, and the configurator checks that the design could be built: see [docs/mechanisms.md](docs/mechanisms.md).

## Features

- Room with editable width, depth and height, metre dimensions and a 0.5 m grid.
- Modules: the sliding wall module (0.5 m thick; 2.6, 4.0 or 5.3 m long; 2 m bed/desk zone plus a back-to-back wardrobe that grows with the length; fold-down bed on folding legs, and a fall-front desk that hides a monitor on a wall arm, a mini PC, keyboard and mouse), the turning module (the same bed and desk on a 2 m body that pulls out from the wall, turns 180° and goes back), a kitchen run, a window shelf post, an armchair with a small table, a room door.
- Add, remove, drag, rotate and configure modules.
- Any number of named modes, each storing every module's state (position on the rail, bed, workstation).
- Transition slider and play button between any two modes, in a sensible order: fold, slide, unfold.
- Plausibility checks along every transition and in every mode: no part passes through another, the floor, a wall or the ceiling; legs and props carry what they must; joints stay within their limits; doors, the kitchen, the bed, the desk and the chair have their free space; the PC keeps its air gaps; seats face into the room; an opened screen sits at a sane height and distance from the seated eye. Clearance zones are drawn green when free and red when blocked.
- Presets, save and load as JSON, and the last setup kept in the browser.

## Development

```bash
npm ci
npm run dev
bash scripts/check.sh
```
