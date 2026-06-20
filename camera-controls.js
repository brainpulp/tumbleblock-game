// camera-controls.js
// Shared turntable camera for both configurations.
//
// Dragging empty space orbits freely: horizontal motion spins around the
// vertical axis (yaw), vertical motion tilts (pitch). The base projection in
// game.js keeps the screen-right vector horizontal (z = 0), so a pure yaw or
// pitch never introduces roll -- rotating about one axis leaves the others put.
// On release the view eases to the nearest canonical isometric corner.
//
// This reuses game.js's native cameraYaw/cameraPitch/snapCamera and replaces the
// older axis-locked, snap-while-dragging orbit that lived here.
(() => {
  const isoPitch = Math.atan(1 / Math.sqrt(2)); // canonical isometric elevation
  const quarter = Math.PI / 2;
  const yawBase = -Math.PI / 4;                  // canonical yaws: yawBase + k * 90deg
  const radPerPx = quarter / 150;                // ~one quarter turn per 150px of drag
  const pitchLimit = quarter - 0.12;             // keep short of the poles to avoid flips
  const moveThreshold = 4;                       // px before a press counts as a drag

  const nearestYaw = yaw => Math.round((yaw - yawBase) / quarter) * quarter + yawBase;
  const nearestPitch = pitch => (pitch >= 0 ? isoPitch : -isoPitch);
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

  let orbit = null;

  const overFace = point => [...hitFaces].reverse().some(item => pointInPoly(point, item.poly));

  canvas.addEventListener("pointerdown", event => {
    if (animation || cameraSnap) return;
    const point = localPoint(event);
    if (overFace(point)) return;           // a cube is under the pointer -> let it roll/slide
    event.stopImmediatePropagation();      // suppress game.js's native stepped orbit
    canvas.setPointerCapture(event.pointerId);
    orbit = {
      pointerId: event.pointerId,
      last: point,
      moved: false,
    };
  }, true);

  canvas.addEventListener("pointermove", event => {
    if (!orbit || event.pointerId !== orbit.pointerId || animation) return;
    event.stopImmediatePropagation();
    const point = localPoint(event);
    const dx = point.x - orbit.last.x;
    const dy = point.y - orbit.last.y;
    orbit.last = point;
    if (Math.abs(dx) >= moveThreshold || Math.abs(dy) >= moveThreshold) orbit.moved = true;
    cameraYaw -= dx * radPerPx;             // free orbit -- no snapping mid-drag
    cameraPitch = clamp(cameraPitch + dy * radPerPx, -pitchLimit, pitchLimit);
    render();
  }, true);

  const finishOrbit = event => {
    if (!orbit || event.pointerId !== orbit.pointerId) return;
    event.stopImmediatePropagation();
    const moved = orbit.moved;
    orbit = null;
    if (moved) snapCamera(nearestYaw(cameraYaw), nearestPitch(cameraPitch));
  };

  canvas.addEventListener("pointerup", finishOrbit, true);
  canvas.addEventListener("pointercancel", finishOrbit, true);

  // Keyboard view rotation (arrow keys), kept consistent with drag direction.
  window.TUMBLEBLOCK_TURN_CAMERA = direction => {
    if (animation || cameraSnap) return false;
    const yaw = nearestYaw(cameraYaw);
    const pitch = nearestPitch(cameraPitch);
    if (Math.abs(direction.x) >= Math.abs(direction.y)) {
      snapCamera(yaw - Math.sign(direction.x) * quarter, pitch);
    } else {
      snapCamera(yaw, direction.y >= 0 ? isoPitch : -isoPitch);
    }
    return true;
  };
})();
