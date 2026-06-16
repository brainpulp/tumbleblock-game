(() => {
  window.TUMBLEBLOCK_SCREEN_ORBIT = true;
  window.TUMBLEBLOCK_SHOW_CAMERA_AXES = true;

  const dragDistanceForTurn = 170;
  const commitProgress = .25;
  const snapDuration = 220;
  const turnAngle = Math.PI * 2 / 3;
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
    return { right, up, depth };
  };

  const bodyAxes = [
    normalize([1, 1, 1]),
    normalize([1, 1, -1]),
    normalize([1, -1, 1]),
    normalize([-1, 1, 1]),
  ];

  const viewCorners = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => makeView([x, y, z]))));
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

  const projectedAxis = (axis, view = viewBasis) => {
    const x = dot(axis, view.right);
    const y = -dot(axis, view.up);
    const length = Math.hypot(x, y);
    if (length < .08) return null;
    return { axis, x: x / length, y: y / length, length };
  };

  const projectedAxes = (view = viewBasis) => bodyAxes
    .map(axis => projectedAxis(axis, view))
    .filter(Boolean);

  let viewBasis = nearestCorner(currentView());

  const chooseAxis = drag => {
    const length = Math.hypot(drag.x, drag.y);
    if (!length) return null;
    const unit = { x: drag.x / length, y: drag.y / length };
    return projectedAxes(orbitPointer.from)
      .map(item => ({
        ...item,
        score: Math.abs(item.x * unit.x + item.y * unit.y),
        sign: item.x * drag.x + item.y * drag.y >= 0 ? 1 : -1,
      }))
      .sort((a, b) => b.score - a.score)[0];
  };

  const drawAxisPreview = () => {
    if (!window.TUMBLEBLOCK_SHOW_CAMERA_AXES) return;
    const view = orbitPointer?.from || currentView();
    const axes = projectedAxes(view);
    const center = { x: canvas.clientWidth / 2, y: canvas.clientHeight * .65 };
    const length = Math.min(canvas.clientWidth, canvas.clientHeight) * .18;
    ctx.save();
    axes.forEach((item, index) => {
      const selected = orbitPointer?.axis === item.axis;
      const start = { x: center.x - item.x * length, y: center.y - item.y * length };
      const end = { x: center.x + item.x * length, y: center.y + item.y * length };
      ctx.globalAlpha = selected ? 1 : .28;
      ctx.strokeStyle = selected ? "#1687ff" : "#ff315b";
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = selected ? 3 : 2;
      ctx.setLineDash(selected ? [] : [8, 6]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const point of [start, end]) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, selected ? 4.5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = "700 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(index + 1), end.x + item.x * 11, end.y + item.y * 11);
    });
    if (orbitPointer?.axis) {
      const text = `AXIS LOCKED | ${Math.round(orbitPointer.progress * 100)}%`;
      const y = center.y + length + 24;
      const width = ctx.measureText(text).width;
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(247, 244, 237, .94)";
      ctx.fillRect(center.x - width / 2 - 8, y - 14, width + 16, 20);
      ctx.fillStyle = "#1687ff";
      ctx.fillText(text, center.x, y);
    }
    ctx.restore();
  };

  currentView = function(now = performance.now()) {
    if (!viewSnap) return viewBasis;
    const raw = Math.min(1, (now - viewSnap.started) / viewSnap.duration);
    const eased = raw * raw * (3 - 2 * raw);
    const progress = viewSnap.fromProgress + (viewSnap.toProgress - viewSnap.fromProgress) * eased;
    return rotateView(viewSnap.from, viewSnap.axis, viewSnap.direction * progress * turnAngle);
  };

  render = function() {
    baseRender();
    drawAxisPreview();
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
      from: viewBasis,
      axis: null,
      axisScreen: null,
      direction: 1,
      progress: 0,
      committed: false,
    };
  }, true);

  canvas.addEventListener("pointermove", event => {
    if (!orbitPointer || event.pointerId !== orbitPointer.pointerId || animation) return;
    event.stopImmediatePropagation();
    const point = localPoint(event);
    const drag = { x: point.x - orbitPointer.start.x, y: point.y - orbitPointer.start.y };
    if (!orbitPointer.axis) {
      if (Math.max(Math.abs(drag.x), Math.abs(drag.y)) < 8) return;
      const picked = chooseAxis(drag);
      if (!picked) return;
      orbitPointer.axis = picked.axis;
      orbitPointer.axisScreen = { x: picked.x, y: picked.y };
      orbitPointer.direction = picked.sign;
    }

    const signedDistance = drag.x * orbitPointer.axisScreen.x + drag.y * orbitPointer.axisScreen.y;
    orbitPointer.direction = signedDistance >= 0 ? 1 : -1;
    orbitPointer.progress = Math.min(1, Math.abs(signedDistance) / dragDistanceForTurn);
    orbitPointer.committed ||= orbitPointer.progress >= commitProgress;
    viewBasis = rotateView(
      orbitPointer.from,
      orbitPointer.axis,
      orbitPointer.direction * orbitPointer.progress * turnAngle
    );
    render();
  }, true);

  const finishOrbit = event => {
    if (!orbitPointer || event.pointerId !== orbitPointer.pointerId) return;
    event.stopImmediatePropagation();
    const pointer = orbitPointer;
    orbitPointer = null;
    if (!pointer.axis) return;

    const toProgress = pointer.committed ? 1 : 0;
    viewSnap = {
      from: pointer.from,
      axis: pointer.axis,
      direction: pointer.direction,
      fromProgress: pointer.progress,
      toProgress,
      started: performance.now(),
      duration: snapDuration,
    };
    cameraSnap = viewSnap;
    playSound("camera");
    render();
    setTimeout(() => {
      viewBasis = rotateView(pointer.from, pointer.axis, pointer.direction * toProgress * turnAngle);
      viewBasis = pointer.committed ? viewBasis : pointer.from;
      viewSnap = null;
      cameraSnap = null;
      render();
    }, snapDuration);
  };

  canvas.addEventListener("pointerup", finishOrbit, true);
  canvas.addEventListener("pointercancel", finishOrbit, true);
})();
