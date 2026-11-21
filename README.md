# shiftroom

Shiftroom: configurator for a sliding multi-mode furniture module.

**Live:** https://ivan091.github.io/shiftroom/

Design a small room in 3D, place a sliding wall module (bed on one side, desk on the other, wardrobe in between) and fixed pieces, define modes such as Sleep and Work, and watch the module move between them.

## Features

- Room with editable width and depth, metre dimensions and a 0.5 m grid.
- Modules: the sliding wall module (0.5 m thick; 2.6, 4.0 or 5.3 m long; 2 m bed/desk zone plus a back-to-back wardrobe that grows with the length; telescopic bed about 2 m deep, shallower telescopic desk), a kitchen run, a window shelf post, an armchair with a small table.
- Add, remove, drag, rotate and configure modules.
- Any number of named modes, each storing every module's state (position on the rail, bed and desk extension).
- Transition slider and play button between any two modes, in a sensible order: fold, slide, unfold.
- Clearance warnings when a moving part hits another piece or a wall anywhere along a transition.
- Presets, save and load as JSON, and the last setup kept in the browser.

## Development

```bash
npm ci
npm run dev
bash scripts/check.sh
```
