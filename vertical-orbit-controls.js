(() => {
  window.TUMBLEBLOCK_SCREEN_ORBIT = true;
  const quarter = Math.PI / 2;
  const pixelsPerQuarter = 150;
  let viewBasis = currentView();
  let orbitPointer = null;
  let viewSnap = null;

  const normalized = vector => {
    const length = Math.hypot(...vector);
    return vector.map(value => value / length);
  };

  const rotateAround = (vector, axis, angle) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const crossed = cross(axis, vector);
    const aligned = dot(axis, vector) * (1 - cosine);
    return vector.map((value, index) => value * cosine + crossed[index] * sine + axis[index] * aligned);
  };

  const basisAt = (start, horizontal, vertical) => {
    const afterHorizontal = {
      right: rotateAround(start.right, start.up, horizontal),
      up: start.up,
      depth: rotateAround(start.depth, start.up, horizontal),
    };
    return {
      right: afterHorizontal.right,
      up: rotateAround(afterHorizontal.up, start.right, vertical),
      depth: rotateAround(afterHorizontal.depth, start.right, vertical),
    };
  };

  const orthonormal = basis => {
    const right = normalized(basis.right);
    const depth = normalized(cross(right, basis.up));
    const up = normalized(cross(depth, right));
    return { right, up, depth };
  };

  currentView = function(now = performance.now()) {
    if (!viewSnap) return viewBasis;
    const raw = Math.min(1, (now - viewSnap.started) / viewSnap.duration);
    const eased = raw * raw * (3 - 2 * raw);
    const horizontal = viewSnap.fromHorizontal + (viewSnap.toHorizontal - viewSnap.fromHorizontal) * eased;
    const vertical = viewSnap.fromVertical + (viewSnap.toVertical - viewSnap.fromVertical) * eased;
    return orthonormal(basisAt(viewSnap.startBasis, horizontal, vertical));
  };

  canvas.addEventListener("pointerdown", event => {
    if (animation || cameraSnap) return;
    const point = localPoint(event);
    const face = [...hitFaces].reverse().find(item => pointInPoly(point, item.poly));
    if (face) return;
    event.stopImmediatePropagation();
    canvas.setPointerCapture(event.pointerId);
    orbitPointer = { pointerId: event.pointerId, start: point, startBasis: viewBasis, horizontal: 0, vertical: 0, moved: false };
  }, true);

  canvas.addEventListener("pointermove", event => {
    if (!orbitPointer || event.pointerId !== orbitPointer.pointerId || animation) return;
    event.stopImmediatePropagation();
    const point = localPoint(event);
    const dx = point.x - orbitPointer.start.x;
    const dy = point.y - orbitPointer.start.y;
    if (Math.hypot(dx, dy) < 3) return;
    orbitPointer.moved = true;
    orbitPointer.horizontal = dx / pixelsPerQuarter * quarter;
    orbitPointer.vertical = -dy / pixelsPerQuarter * quarter;
    viewBasis = orthonormal(basisAt(orbitPointer.startBasis, orbitPointer.horizontal, orbitPointer.vertical));
    render();
  }, true);

  const finishOrbit = event => {
    if (!orbitPointer || event.pointerId !== orbitPointer.pointerId) return;
    event.stopImmediatePropagation();
    const finished = orbitPointer;
    orbitPointer = null;
    if (!finished.moved) return;
    viewSnap = {
      startBasis: finished.startBasis,
      fromHorizontal: finished.horizontal,
      fromVertical: finished.vertical,
      toHorizontal: Math.round(finished.horizontal / quarter) * quarter,
      toVertical: Math.round(finished.vertical / quarter) * quarter,
      started: performance.now(),
      duration: 260,
    };
    cameraSnap = viewSnap;
    playSound("camera");
    render();
    setTimeout(() => {
      viewBasis = orthonormal(basisAt(viewSnap.startBasis, viewSnap.toHorizontal, viewSnap.toVertical));
      viewSnap = null;
      cameraSnap = null;
      render();
    }, viewSnap.duration);
  };

  canvas.addEventListener("pointerup", finishOrbit, true);
  canvas.addEventListener("pointercancel", finishOrbit, true);
})();
