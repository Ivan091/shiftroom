# Mechanisms

How every module works inside, so that it could be built. The code models each module as a tree of rigid links joined by sliding or hinged joints (`src/model/mechanism.ts`, geometry in `src/model/catalog.ts`); `src/model/rules.ts` checks the result. Dimensions are in metres. In a module's own frame, x runs through its thickness (the desk face is x = 0, the bed face x = 0.5), z along its length and y up.

## Why fold-down and not telescopic

A telescopic bed that reaches 2 m into the room cannot live in a 0.5 m body: it would need four or more nested stages, and the mattress cannot telescope at all (a 2 m mattress folded into 0.5 m segments is about 0.8 m thick). The same holds for a 0.7 m desk. Both therefore fold: the bed is a counterbalanced fold-down bed (the mechanism of a wall bed, whose cabinets are 0.45-0.5 m deep), and the desk is a fall-front leaf that hides a workstation. This fits both cavities and a spine into the 0.5 m thickness:

| x from the desk face | What |
|---|---|
| 0.000-0.135 | desk cavity. Below 0.75 m: the gate-leg doors and the PC grille in the face (0.02), the mini PC behind them. Above: the raised leaf (0.025) in front, the keyboard on its inside, the monitor (0.03-0.08) and its folded wall arm (0.095-0.135) |
| 0.135-0.165 | spine, from the floor to the top panel |
| 0.165-0.50 | bed cavity: the stored bed frame with its mattress, underside out, legs folded flat on it |

The spine sits 15 mm further into the bed cavity than a plain drop-leaf desk would need. The bed frame's head corner sweeps to x = 0.171 as it tilts, so 6 mm of clearance remains. The bed pivot cannot move towards the bed face instead: stored, the folded legs already reach the face at x = 0.50.

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

### Hidden workstation (desk face, z 0.10-1.90)

Closed, the desk face shows only flat fronts: the raised leaf from 0.75 to 1.475 m, two gate-leg doors and a grille below it, and the closed shelves above. Behind them sit a 27-inch monitor, a mini PC, a keyboard, a mouse and their cables. Open, the leaf is the desk, the keyboard lies on it and the monitor stands at eye height in front of the chair.

**Leaf (fall front).**
- **Joint:** two or three fall-flap hinges with soft-close stays (the hardware of a secretary desk's fall front, such as Häfele or Blum flap stays rated for about 15 kg). They form a horizontal axis along the module at x 0.025, y 0.75, the back top edge of the level leaf. The leaf turns through 90°, from upright to level.
- **Leaf:** 1.8 × 0.725 m, 25 mm thick. Level, its top is at 0.75 m and it reaches 0.7 m out of the face. Upright, it stands inside the face (x 0-0.025), its top facing in, and closes the screen compartment up to 1.475 m.
- **Gate legs:** two 0.66 × 0.725 m panels, each hung on a vertical hinge stile at one end of the desk. Closed, they are the doors of the lower cavity, flush with the face. They swing out 90° to stand under the leaf's front half at both ends, so the knee room between them stays clear.
- **Carries the load:** upright, the flap hinges and a magnetic catch at the top. Level, the hinges at the back and the two gate legs at the front.

**Monitor on a wall arm.**
- **Equipment:** one 27-inch monitor without its stand, 615 × 370 × 50 mm, on a 100 mm VESA plate.
- **Joints:** a two-segment articulating wall arm, of the kind that folds flat against a wall, with segments 0.15 m between pivots. A wall plate on the spine at y 0.86-0.90, centred on the desk, carries the first vertical pivot at x 0.11. The second segment rides on top of the first, and the VESA head turns on a third pivot at its tip. Folded, both segments lie along the module behind the monitor, and the monitor faces the leaf with its face at x 0.03. Pulled out, the elbow opens while the head pivot turns the opposite way, so the monitor travels straight out and stays square to the desk. Its face ends at x = -0.27, 0.43 m back from the desk's front edge.
- **Viewing position:** the bottom edge is at 0.80 m, the centre at 0.985 m and the top edge at 1.17 m. That puts the top 3 cm below the eye of a seated adult (1.20 m) and 0.67 m from it, with the eye taken 0.2 m behind the desk edge. Looking at the centre means looking about 18° down.
- **Carries the load:** the wall plate on the spine, which is screwed through to the end panel and divider rails.

**PC.**
- **Equipment:** a one-litre business mini PC (ThinkCentre Tiny, Elite Mini or OptiPlex Micro class, 183 × 179 × 35 mm, under 65 W). It stands on its edge in a bracket on a shelf 0.1 m above the floor, centred behind the 0.46 m wide grille between the two gate doors.
- **Ventilation:** cool air comes in through the grille. There is a 35 mm gap between grille and PC, and 80 mm free in front of the PC's intake end and behind its exhaust end. The cavity is open to the floor under the doors and has a slot in the board under the leaf hinge, so warm air rises into the screen compartment and leaves through the gap above the raised leaf. With the desk open, the compartment is open to the room.
- **Cables:** a 40 mm cable duct runs up the spine from the PC shelf to the arm's wall plate. It carries power, the DisplayPort cable and a USB cable through a grommet in the board behind the leaf hinge. From the plate the cables run in the arm's cable channels through each of its pivots, with a loose loop at each joint. The keyboard and mouse are wireless, with the receiver in the PC.

**Keyboard and mouse.** A tenkeyless keyboard (360 × 130 mm) and a mouse lie in a shallow felt-lined recess on the leaf's top, 0.1 m from its front edge, held by magnetic catches. When the leaf rises they ride up with it on its inside face, above the stored monitor (1.25-1.38 m). When it falls they are on the desk, ready to type.

**Order of motion.** The one "Workstation" control runs these steps in order, and closing runs them backwards:
1. The leaf falls from upright to level (0-35 % of the motion).
2. The gate legs swing out under it (35-55 %).
3. The arm brings the monitor out (60-100 %).

Closing therefore puts the monitor home, then folds the gate legs, before the leaf rises in front of it. Bringing the monitor out with the leaf still up would put it through the leaf, and the tests show that this is caught.

**Clearances:**
- Knee room under the middle 0.8 m of the desk up to 0.62 m.
- A 0.7 × 0.7 m chair space in front of it. The chair is a loose folding chair kept in the wardrobe.
- The PC's three air gaps, in every state.

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

Resting in a mode adds three more (`restViolations`):
- **Clearances:** every active clearance zone is free of solid parts and inside the room (of alternatives, one is enough). This includes the PC's air gaps, which are active in every state.
- **Seats:** every seat faces into the room.
- **Screens:** every screen in use sits where a seated person can work at it (`VIEW` in `rules.ts`). Its face is 0.5-0.85 m from the seated eye, its top edge is between 0.3 m below and 0.05 m above eye level, and it is turned at most 30° away from the eye.

The equipment parts (monitor, arm, PC, keyboard, mouse) are their own links, so the clipping check covers them against the leaf, the cabinet, the bed side and the rest of the room. That holds at rest, while the module slides and while it turns.

The tests (`tests/rules.test.ts`) sweep the preset, a compact 2.6 m room and a turning-module room through every mode and every transition in 400 steps and fail on any violation; other tests break each rule on purpose to show it is caught. In the app, the bar under the room lists every violation of the current transition, and clicking one jumps to the moment it happens.
