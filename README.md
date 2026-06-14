# Tumbleblock

A browser-based spatial puzzle about sliding and tumbling connected cubes into a target configuration.

## Play locally

Open `index.html` in a modern browser.

## Controls

- Click an exposed cube face to push the cube one space.
- Drag a cube to roll it 90 degrees around a connected neighbor.
- A roll uses the shortest connected edge path toward the drag direction, up to two quarter-turns.
- Drag empty space to orbit both configurations with the shared trackball camera.
- Drag empty space to orbit both configurations.
- Restarting is free. There is no undo; reversing a move costs a move.

## Publish with GitHub Pages

Push this repository to GitHub, then enable **Settings → Pages → Source: GitHub Actions**. The included workflow publishes every push to `main`.
