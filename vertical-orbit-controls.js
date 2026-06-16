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
    { axis: normalize([1, 1, 1]), signs: [1, 1, 1] },
    { axis: normalize([1, 1, -1]), signs: [1, 1, -1] },
    { axis: normalize([1, -1, 1]), signs: [1, -1, 1] },
    { axis: normalize([-1, 1, 1]), signs: [-1, 1, 1] },
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
    .map(definition => {
      const projected = projectedAxis(definition.axis, view);
      return projected && { ...projected, signs: definition.signs };
    })
    .filter(Boolean);

  let viewBasis = nearestCorner(currentView());

  const chooseAxis = drag => {
    const length = Math.hypot(drag.x, drag.y);
    if (!length) return null;
    const unit = { x: drag.x / length, y: drag.y / length };
    return projectedAxes(orbitPointer.from)
      .map(item => ({
        ...item,
        tangent: { x: -item.y, y: item.x },
        score: Math.abs(-item.y * unit.x + item.x * unit.y),
        sign: -item.y * drag.x + item.x * drag.y >= 0 ? 1 : -1,
      }))
      .sort((a, b) => b.score - a.score)[0];
  };

  const drawAxisPreview = () => {
    if (!window.TUMBLEBLOCK_SHOW_CAMERA_AXES) return;
    const view = currentView();
    const startView = orbitPointer?.from || view;
    const axes = projectedAxes(startView);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const origin = { x: width / 2, y: height * .65 };
    const scale = Math.min(width * .17, height * .12, 74) / Math.max(1, bounds(cubes).span / 4);
    const pivot = [0, 1, 2].map(axis =>
      cubes.reduce((sum, cube) => sum + cube.pos[axis] + .5, 0) / cubes.length
    );
    const projectWithView = (position, basis) => {
      const relative = sub(position, pivot);
      return {
        x: origin.x + dot(relative, basis.right) * scale,
        y: origin.y - dot(relative, basis.up) * scale,
      };
    };
    const axisSegment = (center, signs, radius, basis) => {
      return [
        projectWithView(center.map((value, index) => value - signs[index] * radius), basis),
        projectWithView(center.map((value, index) => value + signs[index] * radius), basis),
      ];
    };
    const pivotSegment = (signs, basis) => axisSegment(pivot, signs, .62, basis);
    const cubeSegment = (signs, basis) => axisSegment(cubes[0].pos.map(value => value + .5), signs, .5, basis);
    const drawSegment = ([start, end], color, width, alpha, dashed = false) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = width;
      if (dashed) ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const point of [start, end]) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, width + 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };
    ctx.save();
    axes.forEach((item, index) => {
      const selected = orbitPointer?.axis === item.axis;
      if (!selected) {
        drawSegment(pivotSegment(item.signs, startView), "#ff315b", 1.5, .28, true);
      } else {
        drawSegment(cubeSegment(item.signs, startView), "#111827", 1.25, .45, true);
        drawSegment(pivotSegment(item.signs, startView), "#1687ff", 3, 1);
        drawSegment(pivotSegment(item.signs, view), "#22c55e", 2, .9, true);
      }
      const [, end] = pivotSegment(item.signs, startView);
      ctx.font = "700 10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = selected ? "#1687ff" : "#ff315b";
      ctx.globalAlpha = selected ? 1 : .45;
      ctx.fillText(String(index + 1), end.x + item.x * 14, end.y + item.y * 14);
    });
    if (orbitPointer?.axis) {
      const text = `AXIS LOCKED | blue/green=pivot axis | black=cube diagonal | ${Math.round(orbitPointer.progress * 100)}%`;
      const y = origin.y + scale * 1.35;
      const width = ctx.measureText(text).width;
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(247, 244, 237, .94)";
      ctx.fillRect(origin.x - width / 2 - 8, y - 14, width + 16, 20);
      ctx.fillStyle = "#1687ff";
      ctx.fillText(text, origin.x, y);
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
      orbitPointer.tangentScreen = picked.tangent;
      orbitPointer.direction = picked.sign;
    }

    const signedDistance = drag.x * orbitPointer.tangentScreen.x + drag.y * orbitPointer.tangentScreen.y;
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
