(() => {
  window.TUMBLEBLOCK_SCREEN_ORBIT = true;
  let orbitPointer = null;
  let viewBasis = currentView();
  let viewSnap = null;

  const rotateAround = (vector, axis, angle) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const crossed = cross(axis, vector);
    const aligned = dot(axis, vector) * (1 - cosine);
    return vector.map((value, index) =>
      value * cosine + crossed[index] * sine + axis[index] * aligned
    );
  };

  const normalized = vector => {
    const length = Math.hypot(...vector);
    return vector.map(value => value / length);
  };

  currentView = function(now = performance.now()) {
    if (!viewSnap) return viewBasis;
    const raw = Math.min(1, (now - viewSnap.started) / viewSnap.duration);
    const t = raw * raw * (3 - 2 * raw);
    const angle = viewSnap.angle * t;
    return {
      right: rotateAround(viewSnap.from.right, viewSnap.axis, angle),
      up: rotateAround(viewSnap.from.up, viewSnap.axis, angle),
      depth: rotateAround(viewSnap.from.depth, viewSnap.axis, angle),
    };
  };

  const snapScreenCamera = (axis, angle) => {
    viewSnap = {
      from: viewBasis,
      axis: normalized(axis),
      angle,
      started: performance.now(),
      duration: 260,
    };
    cameraSnap = viewSnap;
    playSound("camera");
    render();
    setTimeout(() => {
      viewBasis = {
        right: normalized(rotateAround(viewSnap.from.right, viewSnap.axis, viewSnap.angle)),
        up: normalized(rotateAround(viewSnap.from.up, viewSnap.axis, viewSnap.angle)),
        depth: normalized(rotateAround(viewSnap.from.depth, viewSnap.axis, viewSnap.angle)),
      };
      viewSnap = null;
      cameraSnap = null;
      render();
    }, viewSnap.duration);
  };

  canvas.addEventListener("pointerdown", event => {
    if (animation || cameraSnap) return;
    const point = localPoint(event);
    const face = [...hitFaces].reverse().find(item => pointInPoly(point, item.poly));
    if (face) return;
    event.stopImmediatePropagation();
    canvas.setPointerCapture(event.pointerId);
    orbitPointer = { pointerId: event.pointerId, last: point, drag: [0, 0] };
  }, true);

  canvas.addEventListener("pointermove", event => {
    if (!orbitPointer || event.pointerId !== orbitPointer.pointerId || animation) return;
    event.stopImmediatePropagation();
    const point = localPoint(event);
    orbitPointer.drag[0] += point.x - orbitPointer.last.x;
    orbitPointer.drag[1] += point.y - orbitPointer.last.y;
    orbitPointer.last = point;
    if (cameraSnap || Math.max(Math.abs(orbitPointer.drag[0]), Math.abs(orbitPointer.drag[1])) < 42) return;

    const quarter = Math.PI / 2;
    if (Math.abs(orbitPointer.drag[0]) >= Math.abs(orbitPointer.drag[1])) {
      snapScreenCamera(currentView().up, Math.sign(orbitPointer.drag[0]) * quarter);
    } else {
      snapScreenCamera(currentView().right, -Math.sign(orbitPointer.drag[1]) * quarter);
    }
    orbitPointer.drag = [0, 0];
  }, true);

  const finishOrbit = event => {
    if (!orbitPointer || event.pointerId !== orbitPointer.pointerId) return;
    event.stopImmediatePropagation();
    orbitPointer = null;
  };
  canvas.addEventListener("pointerup", finishOrbit, true);
  canvas.addEventListener("pointercancel", finishOrbit, true);
})();
