# Mechanisms

How every module works inside, so that it could be built. The code models each module as a tree of rigid links joined by sliding or hinged joints (`src/model/mechanism.ts`, geometry in `src/model/catalog.ts`); `src/model/rules.ts` checks the result. Dimensions are in metres. In a module's own frame, x runs through its thickness (the desk face is x = 0, the bed face x = 0.5), z along its length and y up.

## Why fold-down and not telescopic

A telescopic bed that reaches 2 m into the room cannot live in a 0.5 m body: it would need four or more nested stages, and the mattress cannot telescope at all (a 2 m mattress folded into 0.5 m segments is about 0.8 m thick). The same holds for a 0.7 m desk. Both therefore fold: the bed is a counterbalanced fold-down bed (the mechanism of a wall bed, whose cabinets are 0.45-0.5 m deep), and the desk is a drop leaf. This fits both cavities and a spine into the 0.5 m thickness:

| x from the desk face | What |
|---|---|
| 0.00-0.12 | desk cavity: the hanging leaf (0.025) in front, the two gate legs folded behind it |
| 0.12-0.15 | spine, from the floor to the top panel |
| 0.15-0.50 | bed cavity: the stored bed frame with its mattress, underside out, legs folded flat on it |

## Sliding module (2.6, 4.0 or 5.3 m)

**Fixed:** two floor rails across the room, recessed flush with the floor, with an anti-tip profile like the rails of mobile archive shelving, which carries units of the same height and depth.

**Moves:** the whole body rolls along the rails on rollers in its plinth (joint: slide across the room, 0 to `travel`). At each end position a floor bolt locks it, so pulling the bed down cannot move it. The body is a set of 18 mm panels: end panels, a divider at 2.0 m, the spine, a bottom over the bed cavity, a top at 2.35 m, closed shelves above the desk, and behind the divider the back-to-back wardrobe (two chambers of about 0.23 m with pull-out hanging rails and shelves, hinged doors on both faces).

**Carries the load:** the plinth on the rails, always.

### Fold-down bed (bed face, z 0.16-1.84 of the 2.0 m section)

- **Joint:** a horizontal hinge along the module length at x 0.32, y 0.35, on two pivot brackets mounted on the end panel and the divider; 0° lowered, 90° stored upright.
- **Frame:** 2.0 × 1.68 m outside, 0.25 m deep side rails, a 0.05 m deck, a 1.96 × 1.6 m mattress 0.2 m thick. Lowered, the mattress top is at 0.46 m and the foot is 2.22 m from the back of the module. Stored, the frame stands in the cavity between x 0.20 and 0.50 and up to 2.25 m, under the 2.33 m inner top; its underside is the closed front.
- **Legs:** two 0.21 m folding legs hinged under the foot end (joint: hinge, −90° folded under the deck, 0° straight). They swing out while the frame is between 35 % and 80 % open, so they are straight before the frame comes down onto them, and they touch the floor only when the bed is level.
- **Carries the load:** stored, the latch and the brackets; while moving, the pivot and gas-spring counterbalance, so the frame floats at any angle; lowered, the pivot at the head and the two legs at the foot.
- **Clearance:** to get in, 0.5 m of free floor along the foot or along one long side when the bed is down.

### Drop-leaf desk (desk face, z 0.10-1.90)

- **Joint:** a horizontal hinge along the module length at desk height (0.75 m) on the underside of the shelves above; 90° hanging down as the front of the desk cavity, 0° level.
- **Leaf:** 1.8 × 0.7 m, 25 mm thick; level, its top is at 0.75 m.
- **Gate legs:** two 0.66 × 0.725 m gate panels, stored folded against the inside of the cavity, each on a vertical hinge stile at one end (joint: hinge about the vertical, 0° to ±90°). They swing out only once the leaf is level (after 60 % of the motion) and fold back first when it closes; out, they stand under the leaf's front half at both ends, so the knee room between them is clear.
- **Carries the load:** stored, the hinge; level, the hinge at the back and the two gate legs at the front.
- **Clearance:** knee room under the middle 0.8 m of the desk up to 0.62 m, and a 0.7 × 0.7 m chair space in front of it. The chair is a loose folding chair kept in the wardrobe.

### Wardrobe doors

The chamber on the bed face is used whenever the desk is folded, and the chamber on the desk face whenever the bed is folded. In those modes 0.5 m in front of the chamber must be free for the doors to swing.

## Turning module (2.0 m, bed and desk only)

**Fixed:** a short floor guide channel running straight out from the wall, 0.85 m long.

**Moves:** the body is the same 2.0 m bed and desk section as the sliding module, standing on two castor plinths. A pivot pin under its centre runs in the channel (joint: slide out from the wall, 0 to 0.85 m), and the body turns on a turntable bearing on that pin (joint: hinge about the vertical, 0 to 180°). The one "Pull out, turn, push back" control runs the three steps in order: pull out 0.85 m, so the 1.03 m turning radius clears the wall; turn 180°; push back. The bed face and the desk face swap sides. At the wall, a latch at the top holds the body upright while it is in use.

**Carries the load:** the castors on the floor; the pin only guides.

The bed and the desk are the same mechanisms as on the sliding module, and they fold before the module moves and unfold after it stops.

## Fixed pieces

| Module | What holds it | Clearance |
|---|---|---|
| Kitchen run | base units on the floor; 0.9 m worktop; wall units with their back screwed to a wall | 0.8 m working space in front, always free |
| Window shelf post | a base plate on the floor, a post and a 1.05 m shelf | none |
| Armchair with table | stands on the floor; 0.42 m seat, facing away from its back | 0.45 m legroom in front, and at least 0.8 m more open floor before a wall |
| Room door | the frame in a wall, 0.8 m leaf opening inward | its whole swing, always free |

## What the checks enforce

`src/model/rules.ts` runs these checks on every state, at every step of every transition (`stateViolations`):

- **No clipping:** no two solid boxes of different links overlap by more than 5 mm. This includes parts of the same module, such as the bed frame and the spine, and the boxes are oriented, so a tilting bed is checked as it really is.
- **Room:** nothing leaves the room, goes below the floor or rises above the ceiling.
- **Support:** pieces marked to stand on the floor touch it; wall units have their back against a wall; every free-standing link stands on something; a loaded part (a lowered bed, a level desk) touches each of its props.
- **Joints:** every joint stays within its limits; every hinge sits on both its parent and its child; a sliding link stays on its runner.

Resting in a mode adds two more (`restViolations`): every active clearance zone is free of solid parts and inside the room (of alternatives, one is enough), and every seat faces into the room.

The tests (`tests/rules.test.ts`) sweep every preset through every mode and every transition in 400 steps and fail on any violation; other tests break each rule on purpose to show it is caught. In the app, the bar under the room lists every violation of the current transition, and clicking one jumps to the moment it happens.
