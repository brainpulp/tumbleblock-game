// camera-controls.js
// Free-orbit (arcball) camera for empty-space drags.
//
// Dragging empty space spins the view freely in 3D -- a Shoemake arcball, so the
// point you grab follows the pointer and the cube can roll about any of its own
// axes, not just a fixed vertical/horizontal pair. On release the view eases to
// the nearest isometric corner. Arrow keys make a single 90 degree turn about a
// world axis, which always lands on another isometric view. The world axes never
// move; only the camera orbits around them.
//
// This drives game.js's quaternion camera (camQuat / snapCamera / nearestIso) and
// replaces the older stepped yaw/pitch orbit.
(() => {
  const quarter = Math.PI / 2;
  const moveThreshold = 4; // px before a press counts as a drag

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

  canvas.addEventListener("pointerdown", event => {
    if (animation || cameraSnap) return;
    const point = localPoint(event);
    if (overFace(point)) return;           // a cube is under the pointer -> let it roll/slide
    event.stopImmediatePropagation();      // suppress game.js's native cube pointer logic
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

  // Arrow keys: one 90 degree turn about a world axis. Horizontal arrows turn
  // about the vertical world axis (Z); vertical arrows turn about whichever world
  // axis currently reads most as "screen right". Either keeps the view isometric.
  window.TUMBLEBLOCK_TURN_CAMERA = direction => {
    if (animation || cameraSnap) return false;
    const horizontal = Math.abs(direction.x) >= Math.abs(direction.y);
    let axis, sign;
    if (horizontal) {
      axis = [0, 0, 1];
      sign = -Math.sign(direction.x);
    } else {
      const right = currentView().right;
      const worldAxes = [[1,0,0],[0,1,0],[0,0,1]];
      axis = worldAxes.reduce((best, a) =>
        Math.abs(dot(a, right)) > Math.abs(dot(best, right)) ? a : best);
      sign = Math.sign(direction.y) * Math.sign(dot(axis, right) || 1);
    }
    const turned = qNorm(qMul(qFromAxis(axis, sign * quarter), camQuat));
    snapCamera(nearestIso(turned));
    return true;
  };
})();
