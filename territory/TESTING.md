# Verification

## Completed by implementation agent · 2026-10-18

- `node --test --test-isolation=none territory/tests/engine.test.cjs territory/tests/lifecycle.test.cjs`: **18 passed, 0 failed**.
- Tests cover initial border exclusion, safe movement/toggle, enemy-rooted fill, multiple occupied components, no repeated scoring, self collision, swept enemy collision, shield/commit overlap, damage restoration and immunity, pause freezing, timeout/terminal stability, capture priority at time boundary, stage configuration, progression separation, save sanitization/best records, and outer perimeter collision.
- `node --check territory/game.js`: passed.
- Standard test runner process isolation encountered sandbox `spawn EPERM`; running Node's test runner with isolation disabled executes the same tests successfully.

- Six VM DOM lifecycle tests execute real game.js: blocked/corrupt storage, blur/visibility clearing and pause, short taps, repeated Space, result idempotence, six-stage next-button campaign, difficulty menu, retry, stage select, and pause label reset.

## Browser QA completed · 2026-10-18

- Using keyboard Space and held Down, completed a real line, captured 50% and cleared stage 1 with 8,765 points.
- Repeated the capture using the on-screen drawing and direction buttons inside a 360px mobile frame.
- Confirmed document and scroll widths are both 360px, all four direction buttons are 48×48px, and the start button is contained by the overlay. Fixed the initial grid/aspect-ratio horizontal overflow.
- At 1280×720, verified the compact desktop layout, reachable start button and pause dialog. Active gameplay retains a 3:2 board.
- Confirmed a fresh page load restores stage 2 unlock and the stage 1 best score/percentage.
- Verified actual homepage card navigation, home return, original SVG icon/preview, and `/sion-world/territory/` relative routes. The browser tab used for direct game interactions reported no application errors or warnings.

## Scope limits

The full six-stage UI sequence and ending, late-stage firefly, storage errors and lifecycle edge cases are covered by automated tests; a human did not manually finish every stage. Actual phone multitouch and speaker volume were not hardware-tested. No online multiplayer, server saves, or mid-round restoration. Canvas board uses a text label and adjacent semantic controls; the spatial playfield is not a screen-reader-equivalent game.
