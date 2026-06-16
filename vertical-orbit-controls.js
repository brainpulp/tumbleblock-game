(() => {
  window.TUMBLEBLOCK_SCREEN_ORBIT = true;
  window.TUMBLEBLOCK_SHOW_CAMERA_AXES = true;

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

  const makeView = depthSigns => {
    const depth = normalize(depthSigns);
    const right = normalize([depth[1], -depth[0], 0]);
    const up = normalize(cross(right, depth));
    return { depthSigns, right, up, depth };
  };

  const viewCorners = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => makeView([x, y, z]))));
  const keyOf = view => view.depthSigns.join(",");
  const viewByKey = Object.fromEntries(viewCorners.map(view => [keyOf(view), view]));
  const neighborKeys = {
    "-1,-1,-1": { right: "1,-1,-1", left: "-1,1,-1", down: "-1,-1,1", up: "-1,-1,1" },
    "-1,-1,1": { right: "1,-1,1", left: "-1,1,1", down: "-1,-1,-1", up: "-1,-1,-1" },
    "-1,1,-1": { right: "-1,-1,-1", left: "1,1,-1", down: "-1,1,1", up: "-1,1,1" },
    "-1,1,1": { right: "-1,-1,1", left: "1,1,1", down: "-1,1,-1", up: "-1,1,-1" },
    "1,-1,-1": { right: "1,1,-1", left: "-1,-1,-1", down: "1,-1,1", up: "1,-1,1" },
    "1,-1,1": { right: "1,1,1", left: "-1,-1,1", down: "1,-1,-1", up: "1,-1,-1" },
    "1,1,-1": { right: "-1,1,-1", left: "1,-1,-1", down: "1,1,1", up: "1,1,1" },
    "1,1,1": { right: "-1,1,1", left: "1,-1,1", down: "1,1,-1", up: "1,1,-1" },
  };
  const nearestCorner = basis => viewCorners.reduce((best, view) =>
    dot(view.depth, basis.depth) > dot(best.depth, basis.depth) ? view : best
  );

  const sign = value => value >= 0 ? 1 : -1;

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

  const orthonormal = basis => {
    const depth = normalize(basis.depth);
    const right = normalize(cross(depth, basis.up));
    const up = normalize(cross(right, depth));
    return { right, up, depth };
  };

  const blendView = (from, to, amount) => {
    const t = Math.max(0, Math.min(1, amount));
    return orthonormal({
      right: from.right.map((value, index) => value + (to.right[index] - value) * t),
      up: from.up.map((value, index) => value + (to.up[index] - value) * t),
      depth: from.depth.map((value, index) => value + (to.depth[index] - value) * t),
    });
  };

  const targetForGesture = pointer => {
    const directionKey = pointer.axisName === "horizontal"
      ? (pointer.direction > 0 ? "right" : "left")
      : (pointer.direction > 0 ? "down" : "up");
    return viewByKey[neighborKeys[keyOf(pointer.from)][directionKey]];
  };

  let currentCorner = nearestCorner(currentView());
  let viewBasis = currentCorner;

  const drawAxisPreview = () => {
    if (!window.TUMBLEBLOCK_SHOW_CAMERA_AXES || !orbitPointer?.axisName) return;
    const center = { x: canvas.clientWidth / 2, y: canvas.clientHeight * .52 };
    const length = Math.min(canvas.clientWidth, canvas.clientHeight) * .18;
    const horizontal = orbitPointer.axisName === "horizontal";
    const direction = horizontal ? [0, 1] : [1, 0];
    const color = horizontal ? "#1687ff" : "#ff315b";
    const label = horizontal
      ? `HORIZONTAL DRAG: SCREEN VERTICAL AXIS ${orbitPointer.direction > 0 ? "FORWARD" : "BACK"}`
      : `VERTICAL DRAG: SCREEN HORIZONTAL AXIS ${orbitPointer.direction > 0 ? "FORWARD" : "BACK"}`;
    const start = { x: center.x - direction[0] * length, y: center.y - direction[1] * length };
    const end = { x: center.x + direction[0] * length, y: center.y + direction[1] * length };
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([9, 6]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const point of [start, center, end]) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, point === center ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = "700 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    const text = `${label} | ${Math.round(orbitPointer.progress * 100)}%`;
    const width = ctx.measureText(text).width;
    const y = center.y + length + 24;
    ctx.fillStyle = "rgba(247, 244, 237, .94)";
    ctx.fillRect(center.x - width / 2 - 8, y - 14, width + 16, 20);
    ctx.fillStyle = color;
    ctx.fillText(text, center.x, y);
    ctx.restore();
  };

  currentView = function(now = performance.now()) {
    if (!viewSnap) return viewBasis;
    const raw = Math.min(1, (now - viewSnap.started) / viewSnap.duration);
    const eased = raw * raw * (3 - 2 * raw);
    const progress = viewSnap.fromProgress + (viewSnap.toProgress - viewSnap.fromProgress) * eased;
    return blendView(viewSnap.from, viewSnap.to, progress);
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
      from: currentCorner,
      axisName: null,
      axis: null,
      direction: 0,
      progress: 0,
      target: currentCorner,
      committed: false,
    };
  }, true);

  canvas.addEventListener("pointermove", event => {
    if (!orbitPointer || event.pointerId !== orbitPointer.pointerId || animation) return;
    event.stopImmediatePropagation();
    const point = localPoint(event);
    const dx = point.x - orbitPointer.start.x;
    const dy = point.y - orbitPointer.start.y;
    if (!orbitPointer.axisName) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      orbitPointer.axisName = Math.abs(dx) >= Math.abs(dy) ? "horizontal" : "vertical";
      orbitPointer.axis = orbitPointer.axisName === "horizontal"
        ? orbitPointer.from.up
        : orbitPointer.from.right;
    }

    const raw = orbitPointer.axisName === "horizontal" ? dx : dy;
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
    if (!pointer.axisName) return;

    const toProgress = pointer.committed ? 1 : 0;
    viewSnap = {
      from: pointer.from,
      to: pointer.target,
      fromProgress: pointer.progress,
      toProgress,
      started: performance.now(),
      duration: snapDuration,
    };
    cameraSnap = viewSnap;
    playSound("camera");
    render();
    setTimeout(() => {
      currentCorner = pointer.committed ? pointer.target : pointer.from;
      viewBasis = currentCorner;
      viewSnap = null;
      cameraSnap = null;
      render();
    }, snapDuration);
  };

  canvas.addEventListener("pointerup", finishOrbit, true);
  canvas.addEventListener("pointercancel", finishOrbit, true);
})();
