# Tumbleblock

A browser-based spatial puzzle about sliding and tumbling connected cubes into a target configuration.

## Play locally

Open `index.html` in a modern browser.

## Controls

- Click an exposed cube face to push the cube one space.
- Drag a cube to roll it 90 degrees around a connected neighbor.
- A roll uses the shortest connected edge path toward the drag direction, up to two quarter-turns.
- Drag empty space to orbit both configurations freely; release to snap to the nearest isometric view.
- Arrow keys rotate the same shared camera in 90-degree steps.
- Restarting is free. There is no undo; reversing a move costs a move.

## Project structure

The game is a single `<canvas>` that projects 3D cubes in 2D — no engine, no build step.

- `game.js` — core engine: state, math, projection, rendering, level loading.
- `mechanics-controls.js` — gameplay: move validation, slides, rolls (over/surface/push), animation tweening, and the camera-debug level.
- `camera-controls.js` — shared orbit camera.
- `audio-controls.js` — move and selection sounds.
- `levels-controls.js` — extra levels and the level-picker thumbnails.
- `score-controls.js` — scoring, records, and the score panel.
- `solver-controls.js` — optimal-route solver behind the Clues panel.
- `keyboard-controls.js` — keyboard play and view controls.

Each `*-controls.js` file is a sequence of self-contained IIFEs layered over `game.js`; `index.html` load order is significant. Asset cache-busting is applied automatically at deploy time (see below), so source files carry no `?v=` version tags.

## Publish with GitHub Pages

Push this repository to GitHub, then enable **Settings → Pages → Source: GitHub Actions**. The included workflow publishes every push to `main`.
