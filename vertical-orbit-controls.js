(() => {
  window.TUMBLEBLOCK_SCREEN_ORBIT = true;
  window.TUMBLEBLOCK_SHOW_CAMERA_AXES ||= false;

  const dragDistanceForTurn = 160;
  const commitProgress = .25;
  const snapDuration = 220;
  const baseRender = render;
  let orbitPointer = null;
  let viewSnap = null;

  const normalize = vector => {
    const length = Math.hypot(...vector);
    return vector.map(value => value / length);
  };

  const makeView = (name, depthSigns) => {
    const depth = normalize(depthSigns);
    const right = normalize([depth[1], -depth[0], 0]);
    const up = normalize(cross(right, depth));
    return { name, depthSigns, right, up, depth };
  };

  const viewStates = [
    makeView("top-front-left", [-1, -1, 1]),
    makeView("top-front-right", [1, -1, 1]),
    makeView("top-back-right", [1, 1, 1]),
    makeView("top-back-left", [-1, 1, 1]),
    makeView("bottom-front-right", [1, -1, -1]),
    makeView("bottom-back-left", [-1, 1, -1]),
  ];

  const sign = value => value >= 0 ? 1 : -1;
  const sameView = (a, b) => a.name === b.name;
  const nearestState = basis => viewStates.reduce((best, view) =>
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
    name: view.name,
    right: normalize(rotateAround(view.right, axis, angle)),
    up: normalize(rotateAround(view.up, axis, angle)),
    depth: normalize(rotateAround(view.depth, axis, angle)),
  });

  const orthonormal = basis => {
    const depth = normalize(basis.depth);
    const right = normalize(cross(depth, basis.up));
    const up = normalize(cross(right, depth));
    return { right, up, depth };
  };

  const blendView = (from, to, amount) => {
    const t = Math.max(0, Math.min(1, amount));
    return orthonormal({
      right: normalize(from.right.map((value, index) => value + (to.right[index] - value) * t)),
      up: normalize(from.up.map((value, index) => value + (to.up[index] - value) * t)),
      depth: normalize(from.depth.map((value, index) => value + (to.depth[index] - value) * t)),
    });
  };

  const targetForGesture = pointer => {
    const axis = pointer.axis === "horizontal" ? pointer.from.up : pointer.from.right;
    const rotated = rotateView(pointer.from, axis, pointer.direction * Math.PI / 2);
    const candidates = viewStates
      .filter(view => !sameView(view, pointer.from))
      .map(view => ({ view, score: dot(view.depth, rotated.depth) }))
      .sort((a, b) => b.score - a.score);
    return candidates[0].view;
  };

  let currentState = nearestState(currentView());
  let viewBasis = currentState;

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
      from: currentState,
      axis: null,
      direction: 0,
      progress: 0,
      target: currentState,
      committed: false,
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
    if (!orbitPointer.committed) {
      orbitPointer.target = targetForGesture(orbitPointer);
      orbitPointer.committed = orbitPointer.progress >= commitProgress;
    }

    viewBasis = blendView(orbitPointer.from, orbitPointer.target, orbitPointer.progress);
    render();
  }, true);

  const finishOrbit = event => {
    if (!orbitPointer || event.pointerId !== orbitPointer.pointerId) return;
    event.stopImmediatePropagation();
    const pointer = orbitPointer;
    orbitPointer = null;
    if (!pointer.axis) return;

    const target = pointer.committed ? pointer.target : pointer.from;
    viewSnap = { from: viewBasis, to: target, started: performance.now(), duration: snapDuration };
    cameraSnap = viewSnap;
    playSound("camera");
    render();
    setTimeout(() => {
      currentState = target;
      viewBasis = target;
      viewSnap = null;
      cameraSnap = null;
      render();
    }, snapDuration);
  };

  canvas.addEventListener("pointerup", finishOrbit, true);
  canvas.addEventListener("pointercancel", finishOrbit, true);
})();
