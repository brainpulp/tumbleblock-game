// camera-controls.js
// Two-axis orbit camera for empty-space drags.
//
// The camera turns about exactly two world axes, neither of which can flip the
// view upside down:
//   - the vertical world axis Z (heading / azimuth) -- horizontal drag, unbounded.
//   - a fixed horizontal cube-face normal, world X (tilt) -- vertical drag, clamped
//     to the isometric band so the look elevation never leaves |depth_z| <= 1/sqrt3.
//     The two isometric elevations are that band's edges, so a drag rocks between
//     them and never tips past vertical.
// The screen-horizontal axis is never used. On release the view eases to the
// nearest isometric corner; arrow keys make a single 90 degree turn that lands on
// another isometric view.
//
// Drives game.js's quaternion camera (camQuat / snapCamera / nearestIso) and reuses
// its globals (BASE_FRAME, ISO_TARGETS, qMul, qFromAxis, qRot, qNorm).
(() => {
  const quarter = Math.PI / 2;
  const moveThreshold = 4;         // px before a press counts as a drag
  const VERT = [0, 0, 1];          // world up: heading axis (horizontal drag / left-right arrows)
  const TILT = [1, 0, 0];          // fixed cube-face normal: tilt axis (vertical drag / up-down arrows)
  const ISO_Z = 1 / Math.sqrt(3);  // |look elevation| at an isometric view = the band edge

  window.TUMBLEBLOCK_VMODE_LOCK_AXIS = TILT; // the camera-debug overlay labels the tilt axis

  let orbit = null;

  const overFace = point => [...hitFaces].reverse().some(item => pointInPoly(point, item.poly));

  // A tilt of `el` about world X is allowed only while the look elevation stays in
  // the isometric band. Heading (about Z) leaves depth_z untouched, so el is the
  // only thing to clamp. A press always starts at an iso, so el = 0 sits on a band
  // edge; bisect toward 0 until the candidate is back inside the band.
  const inBand = (startQuat, el) =>
    Math.abs(qRot(qNorm(qMul(qFromAxis(TILT, el), startQuat)), BASE_FRAME.depth)[2]) <= ISO_Z + 1e-9;
  const clampTilt = (startQuat, el) => {
    if (inBand(startQuat, el)) return el;
    let lo = 0, hi = el;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inBand(startQuat, mid)) lo = mid; else hi = mid;
    }
    return lo;
  };

  canvas.addEventListener("pointerdown", event => {
    if (animation || cameraSnap) return;
    const point = localPoint(event);
    if (overFace(point)) return;            // a cube is under the pointer -> let it roll/slide
    event.stopImmediatePropagation();       // suppress game.js's native cube pointer logic
    canvas.setPointerCapture(event.pointerId);
    orbit = {
      pointerId: event.pointerId,
      start: point,
      startQuat: camQuat.slice(),
      moved: false,
    };
  }, true);

  canvas.addEventListener("pointermove", event => {
    if (!orbit || event.pointerId !== orbit.pointerId || animation) return;
    event.stopImmediatePropagation();
    const point = localPoint(event);
    const dx = point.x - orbit.start.x, dy = point.y - orbit.start.y;
    if (Math.hypot(dx, dy) > moveThreshold) orbit.moved = true;
    const k = Math.PI / Math.min(canvas.clientWidth, canvas.clientHeight); // full drag ~ 180 degrees
    const az = -dx * k;                              // heading about world Z (matches the arrow keys)
    const el = clampTilt(orbit.startQuat, -dy * k);  // tilt about world X, kept inside the iso band
    // Both are world-space pre-multiplications: tilt about X first, then heading about Z.
    camQuat = qNorm(qMul(qFromAxis(VERT, az), qMul(qFromAxis(TILT, el), orbit.startQuat)));
    render();
  }, true);

  const finishOrbit = event => {
    if (!orbit || event.pointerId !== orbit.pointerId) return;
    event.stopImmediatePropagation();
    const moved = orbit.moved;
    orbit = null;
    if (moved) snapCamera(nearestIso(camQuat));
  };

  canvas.addEventListener("pointerup", finishOrbit, true);
  canvas.addEventListener("pointercancel", finishOrbit, true);

  // Arrow keys: one snap to another isometric view. Left/right turn about the
  // vertical world axis Z; up/down turn about the fixed tilt axis X. Both land on
  // an isometric view, so neither flips.
  window.TUMBLEBLOCK_TURN_CAMERA = direction => {
    if (animation || cameraSnap) return false;
    const horizontal = Math.abs(direction.x) >= Math.abs(direction.y);
    const axis = horizontal ? VERT : TILT;
    const sign = horizontal ? -Math.sign(direction.x) : -Math.sign(direction.y);
    snapCamera(nearestIso(qMul(qFromAxis(axis, sign * quarter), camQuat)));
    return true;
  };
})();
