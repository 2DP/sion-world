# 별빛 땅따먹기 · Star Garden

Original buildless Canvas territory game for SION WORLD. Six gardens, easy/normal modes, keyboard and touch controls, local best records and stage unlocks. All assets and synthesized sounds are original; no CDN, installation, or account required.

## Run

From the repository root, use the existing static server (`node bomberman/serve.cjs`) and open `/territory/`. Any static HTTP server works. Relative resources also support hosting under `/sion-world/territory/`.

## Play

- Arrow keys / WASD: move; latest pressed direction wins.
- Space / drawing button: toggle drawing preparation. Once drawing begins, return to any safe cell to finish; toggling cannot cancel a live line.
- P / Escape / pause button: pause or resume.
- Touch: hold direction buttons; tap drawing button. Release/cancel clears touch movement.
- Window blur or hidden tab clears inputs and pauses automatically.

Return from an open line to safe territory to claim regions unreachable from **all** cloud enemies. Occupied regions on both sides remain open. Retracing your line costs a heart. Clouds hit your exposed line; coral fireflies follow only the outside border from stage 3. Hits clear unfinished lines, restore the last safe departure cell, and provide two seconds of protection. An enemy overlapping a finishing line prevents its capture, including under protection. Timeout or three hits ends the round. Each stage starts with three hearts.

Easy enemies move at 75% speed and add 45 seconds. Reaching the displayed target immediately stops simulation and awards a one-time time/heart bonus. Complete stage 6 for the ending. Cleared stages unlock the next stage separately per difficulty.

## Structure

- `engine.js`: deterministic rules, flood fill, movement, damage, progression, save sanitization; browser global and CommonJS exports.
- `game.js`: Canvas rendering, input lifecycle, dialogs, audio and safe local storage adapter.
- `assets/`: original icon and homepage preview SVGs.
- `tests/engine.test.cjs`: Node built-in tests.

Storage key: `sion-world-star-territory-v1`. Stores final results, difficulty-specific unlocks, mute preference, and selected difficulty. Unfinished boards are intentionally not restored. Invalid/unavailable storage falls back to a playable fresh game.

## Test

`node --test --test-isolation=none territory/tests/engine.test.cjs territory/tests/lifecycle.test.cjs`

See `TESTING.md` for completed automated checks and browser checklist.
