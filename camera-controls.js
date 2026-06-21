// camera-controls.js
// Free-orbit (arcball) camera for empty-space drags.
//
// Dragging empty space spins the view freely in 3D -- a Shoemake arcball, so the
// point you grab follows the pointer and the cube can roll about any of its own
// axes, not just a fixed vertical/horizontal pair. On release the view eases to
// the nearest isometric corner. Arrow keys make a single 90 degree turn that lands
// on another isometric view.
//
// Horizontal arrows always turn about the vertical world axis (Z). The vertical
// (up/down) arrows are experimental -- their behaviour is selectable between three
// modes via an on-screen switch (only in the Camera Debug level) or the "M" key:
//   screen : tilt about the current screen-horizontal direction (consistent on
//            screen; the world axis it maps to varies).
//   cycle  : keep the heading, step the elevation between view-from-above and
//            view-from-below (a fixed, predictable elevation cycle).
//   lock   : always turn about a single fixed world axis (X); never alternates.
//
// This drives game.js's quaternion camera (camQuat / snapCamera / nearestIso) and
// reuses its globals (BASE_FRAME, ISO_TARGETS, qRot, qDot, ...).
(() => {
  const quarter = Math.PI / 2;
  const moveThreshold = 4; // px before a press counts as a drag

  // --- Up/Down arrow mode (experimental, switchable for testing) --------------
  const V_MODES = ["screen", "cycle", "lock"];
  let vMode = localStorage.getItem("tb-vmode");
  if (!V_MODES.includes(vMode)) vMode = V_MODES[0];
  window.TUMBLEBLOCK_VMODE = vMode;
  window.TUMBLEBLOCK_VMODE_MODES = V_MODES;

  const setVMode = name => {
    if (!V_MODES.includes(name) || name === vMode) return;
    vMode = name;
    window.TUMBLEBLOCK_VMODE = vMode;
    localStorage.setItem("tb-vmode", vMode);
    if (typeof showMessage === "function") showMessage("Up/Down mode: " + vMode);
    render();
  };
  window.TUMBLEBLOCK_SET_VMODE = setVMode;

  let orbit = null;

  const overFace = point => [...hitFaces].reverse().some(item => pointInPoly(point, item.poly));

  // Map a canvas point onto the virtual arcball sphere (camera/screen space:
  // x right, y up, z toward the viewer).
  const ballVector = point => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const radius = Math.min(w, h) * 0.5;
    let x = (point.x - w / 2) / radius;
    let y = (h / 2 - point.y) / radius;
    const d2 = x * x + y * y;
    if (d2 > 1) { const len = Math.sqrt(d2); return [x / len, y / len, 0]; }
    return [x, y, Math.sqrt(1 - d2)];
  };

  const hitSwitch = point => {
    const rects = window.TUMBLEBLOCK_VMODE_RECTS;
    if (!window.TUMBLEBLOCK_SHOW_CAMERA_AXES || !rects) return null;
    return rects.find(r =>
      point.x >= r.x && point.x <= r.x + r.w &&
      point.y >= r.y && point.y <= r.y + r.h) || null;
  };

  canvas.addEventListener("pointerdown", event => {
    if (animation || cameraSnap) return;
    const point = localPoint(event);
    const sw = hitSwitch(point);            // mode switch pill (debug overlay)
    if (sw) { event.stopImmediatePropagation(); setVMode(sw.name); return; }
    if (overFace(point)) return;            // a cube is under the pointer -> let it roll/slide
    event.stopImmediatePropagation();       // suppress game.js's native cube pointer logic
    canvas.setPointerCapture(event.pointerId);
    orbit = {
      pointerId: event.pointerId,
      startVec: ballVector(point),
      startQuat: camQuat.slice(),
      startFrame: currentView(),
      moved: false,
    };
  }, true);

  // Lift a camera-space vector (x right, y up, z toward viewer) into world space
  // using the press-time frame.
  const toWorld = (c, f) => [
    c[0]*f.right[0] + c[1]*f.up[0] + c[2]*f.depth[0],
    c[0]*f.right[1] + c[1]*f.up[1] + c[2]*f.depth[1],
    c[0]*f.right[2] + c[1]*f.up[2] + c[2]*f.depth[2],
  ];

  canvas.addEventListener("pointermove", event => {
    if (!orbit || event.pointerId !== orbit.pointerId || animation) return;
    event.stopImmediatePropagation();
    const now = ballVector(localPoint(event));
    if (Math.hypot(...cross(orbit.startVec, now)) > moveThreshold / 100) orbit.moved = true;
    // Shoemake arcball: map both grab points to world, then cross in world space
    // (right-handed) so the axis is correct despite the left-handed view frame.
    // cross(w1, w0) rotates the camera so the grabbed point follows the pointer.
    const w0 = toWorld(orbit.startVec, orbit.startFrame);
    const w1 = toWorld(now, orbit.startFrame);
    const delta = qNorm([dot(w0, w1), ...cross(w1, w0)]);
    camQuat = qNorm(qMul(delta, orbit.startQuat));
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

  // --- Vertical-arrow targets, one per mode -----------------------------------
  // "lock" always turns about this world axis. Exposed so the overlay can label it.
  const LOCK_AXIS = [1, 0, 0];
  window.TUMBLEBLOCK_VMODE_LOCK_AXIS = LOCK_AXIS;

  const screenTarget = direction => {
    const axis = currentView().right;          // screen-horizontal, in world coords
    const sign = -Math.sign(direction.y);
    return nearestIso(qMul(qFromAxis(axis, sign * quarter), camQuat));
  };

  const lockTarget = direction => {
    const sign = -Math.sign(direction.y);
    return nearestIso(qMul(qFromAxis(LOCK_AXIS, sign * quarter), camQuat));
  };

  // Keep the current heading, set the elevation: Up -> view from above (depth tips
  // toward the viewer, +z), Down -> from below. Pick the closest ISO target at that
  // elevation so heading and roll change as little as possible.
  const cycleTarget = direction => {
    const wantUp = direction.y < 0;             // ArrowUp -> look from above
    const wantSign = wantUp ? 1 : -1;
    let best = null, bestDot = -Infinity;
    for (const q of ISO_TARGETS) {
      if (Math.sign(qRot(q, BASE_FRAME.depth)[2]) !== wantSign) continue;
      const d = Math.abs(qDot(q, camQuat));
      if (d > bestDot) { bestDot = d; best = q; }
    }
    return best || nearestIso(camQuat);
  };

  const verticalTarget = direction =>
    vMode === "lock" ? lockTarget(direction) :
    vMode === "cycle" ? cycleTarget(direction) :
    screenTarget(direction);

  // Arrow keys: one snap to another isometric view.
  window.TUMBLEBLOCK_TURN_CAMERA = direction => {
    if (animation || cameraSnap) return false;
    const horizontal = Math.abs(direction.x) >= Math.abs(direction.y);
    const target = horizontal
      ? nearestIso(qMul(qFromAxis([0, 0, 1], -Math.sign(direction.x) * quarter), camQuat))
      : verticalTarget(direction);
    snapCamera(target);
    return true;
  };

  // "M" cycles the up/down mode from anywhere (handy while testing).
  window.addEventListener("keydown", event => {
    if (event.code !== "KeyM" || event.ctrlKey || event.altKey || event.metaKey) return;
    setVMode(V_MODES[(V_MODES.indexOf(vMode) + 1) % V_MODES.length]);
  });
})();
