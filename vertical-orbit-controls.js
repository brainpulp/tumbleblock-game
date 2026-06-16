(() => {
  window.TUMBLEBLOCK_SCREEN_ORBIT = true;
  window.TUMBLEBLOCK_SHOW_CAMERA_AXES ||= false;

  const dragDistanceForTurn = 180;
  const snapDuration = 220;
  const baseRender = render;
  let orbitPointer = null;
  let viewSnap = null;

  const normalize = vector => {
    const length = Math.hypot(...vector);
    return vector.map(value => value / length);
  };

  const makeView = depthSigns => {
    const depth = normalize(depthSigns);
    const right = normalize([depth[1], -depth[0], 0]);
    const up = normalize(cross(right, depth));
    return { depthSigns, right, up, depth };
  };

  const sign = value => value >= 0 ? 1 : -1;
  const viewCorners = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => makeView([x, y, z]))));

  let currentCorner = viewCorners.reduce((best, view) =>
    dot(view.depth, currentView().depth) > dot(best.depth, currentView().depth) ? view : best
  );
  let viewBasis = currentCorner;

  const nearestCorner = basis => viewCorners.reduce((best, view) =>
    dot(view.depth, basis.depth) > dot(best.depth, basis.depth) ? view : best
  );

  const rotateAround = (vector, axis, angle) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const crossed = cross(axis, vector);
    const aligned = dot(axis, vector) * (1 - cosine);
    return vector.map((value, index) =>
      value * cosine + crossed[index] * sine + axis[index] * aligned
    );
  };

  const rotateView = (view, axis, angle) => ({
    right: normalize(rotateAround(view.right, axis, angle)),
    up: normalize(rotateAround(view.up, axis, angle)),
    depth: normalize(rotateAround(view.depth, axis, angle)),
  });

  const blendView = (from, to, amount) => {
    const t = Math.max(0, Math.min(1, amount));
    return {
      right: normalize(from.right.map((value, index) => value + (to.right[index] - value) * t)),
      up: normalize(from.up.map((value, index) => value + (to.up[index] - value) * t)),
      depth: normalize(from.depth.map((value, index) => value + (to.depth[index] - value) * t)),
    };
  };

  currentView = function(now = performance.now()) {
    if (!viewSnap) return viewBasis;
    const raw = Math.min(1, (now - viewSnap.started) / viewSnap.duration);
    const eased = raw * raw * (3 - 2 * raw);
    return blendView(viewSnap.from, viewSnap.to, eased);
  };

  render = function() {
    baseRender();
  };

  canvas.addEventListener("pointerdown", event => {
    if (animation || cameraSnap) return;
    const point = localPoint(event);
    const face = [...hitFaces].reverse().find(item => pointInPoly(point, item.poly));
    if (face) return;
    event.stopImmediatePropagation();
    canvas.setPointerCapture(event.pointerId);
    orbitPointer = {
      pointerId: event.pointerId,
      start: point,
      from: currentCorner,
      axis: null,
      direction: 0,
      progress: 0,
      target: currentCorner,
    };
  }, true);

  canvas.addEventListener("pointermove", event => {
    if (!orbitPointer || event.pointerId !== orbitPointer.pointerId || animation) return;
    event.stopImmediatePropagation();
    const point = localPoint(event);
    const dx = point.x - orbitPointer.start.x;
    const dy = point.y - orbitPointer.start.y;
    if (!orbitPointer.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      orbitPointer.axis = Math.abs(dx) >= Math.abs(dy) ? "horizontal" : "vertical";
    }
    const raw = orbitPointer.axis === "horizontal" ? -dx : -dy;
    orbitPointer.direction = sign(raw);
    orbitPointer.progress = Math.min(1, Math.abs(raw) / dragDistanceForTurn);
    const axis = orbitPointer.axis === "horizontal" ? orbitPointer.from.up : orbitPointer.from.right;
    const angle = orbitPointer.direction * orbitPointer.progress * Math.PI / 2;
    viewBasis = rotateView(orbitPointer.from, axis, angle);
    orbitPointer.target = nearestCorner(rotateView(orbitPointer.from, axis, orbitPointer.direction * Math.PI / 2));
    render();
  }, true);

  const finishOrbit = event => {
    if (!orbitPointer || event.pointerId !== orbitPointer.pointerId) return;
    event.stopImmediatePropagation();
    const pointer = orbitPointer;
    orbitPointer = null;
    if (!pointer.axis) return;
    const target = pointer.progress >= .35 ? pointer.target : pointer.from;
    viewSnap = { from: viewBasis, to: target, started: performance.now(), duration: snapDuration };
    cameraSnap = viewSnap;
    playSound("camera");
    render();
    setTimeout(() => {
      currentCorner = target;
      viewBasis = target;
      viewSnap = null;
      cameraSnap = null;
      render();
    }, snapDuration);
  };

  canvas.addEventListener("pointerup", finishOrbit, true);
  canvas.addEventListener("pointercancel", finishOrbit, true);
})();
