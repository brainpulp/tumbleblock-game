(() => {
  let previewPointer = null;

  const originalAnimatedCube = animatedCube;
  animatedCube = function(cube, cubeIndex, now, animate) {
    if (!animate || !animation || animation.index !== cubeIndex || !animation.preview && animation.fromProgress == null) {
      return originalAnimatedCube(cube, cubeIndex, now, animate);
    }
    const elapsed = Math.min(1, (now - animation.started) / animation.duration);
    const raw = animation.preview ? animation.progress : animation.fromProgress + (1 - animation.fromProgress) * elapsed;
    const t = raw * raw * (3 - 2 * raw);
    const scaled = t * animation.path.length;
    const pathIndex = Math.min(animation.path.length - 1, Math.floor(scaled));
    const stepT = Math.min(1, scaled - pathIndex);
    const step = animation.path[pathIndex];
    const center = add(step.pivot, rotateVector(step.relative, step.axis, stepT * Math.PI / 2));
    const pos = center.map(n => n - .5);
    const visualRotations = animation.path.slice(0, pathIndex).map(pathStep => ({ axis: pathStep.axis, angle: Math.PI / 2 }));
    visualRotations.push({ axis: step.axis, angle: stepT * Math.PI / 2 });
    return { ...cube, pos, visualRotations };
  };

  doSlide = function(face) {
    const destination = add(face.cube.pos, neg(face.normal));
    if (!validDestination(face.cubeIndex, destination)) return blocked();
    animateMove({ index: face.cubeIndex, destination, type: "slide", duration: 180, sound: "slide" });
  };

  function pickFace(point) {
    return [...hitFaces].reverse().find(face => pointInPoly(point, face.poly)) || null;
  }

  function chooseRoll(index, drag) {
    const length = Math.hypot(...drag);
    if (length < 10) return null;
    const scored = rollCandidates(index).map(candidate => {
      const len = Math.hypot(...candidate.screen);
      return { candidate, score: len ? dot(drag, candidate.screen) / (length * len) : -1 };
    }).sort((a, b) => b.score - a.score || a.candidate.turns - b.candidate.turns);
    const best = scored[0];
    return best?.score >= .45 ? best.candidate : null;
  }

  function orientationAfter(cube, candidate) {
    let orientation = [...cube.orient];
    for (const step of candidate.path) {
      const turned = [...orientation];
      DIRS.forEach((worldDir, oldWorldIndex) => {
        turned[dirIndex(rotateDirection(worldDir, step.axis))] = orientation[oldWorldIndex];
      });
      orientation = turned;
    }
    return orientation;
  }

  function commitPreview(index, preview) {
    const remaining = 1 - preview.progress;
    animation = null;
    animateMove({
      index,
      destination: preview.destination,
      path: preview.path,
      turns: preview.turns,
      orient: orientationAfter(cubes[index], preview),
      type: "roll",
      duration: (preview.turns === 2 ? 440 : 280) * remaining,
      fromProgress: preview.progress,
      sound: "roll",
    });
  }

  canvas.addEventListener("pointerdown", event => {
    if (animation || cameraSnap) return;
    const point = localPoint(event);
    const face = pickFace(point);
    if (!face) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    canvas.setPointerCapture(event.pointerId);
    previewPointer = { pointerId: event.pointerId, start: point, face };
  }, true);

  canvas.addEventListener("pointermove", event => {
    if (!previewPointer || event.pointerId !== previewPointer.pointerId || animation && !animation.preview) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const point = localPoint(event);
    const drag = [point.x - previewPointer.start.x, point.y - previewPointer.start.y];
    const candidate = chooseRoll(previewPointer.face.cubeIndex, drag);
    if (!candidate) {
      animation = null;
      render();
      return;
    }
    const directionLength = Math.hypot(...candidate.screen);
    const progress = Math.max(0, Math.min(1, dot(drag, candidate.screen) / directionLength / (72 * candidate.turns)));
    animation = { index: previewPointer.face.cubeIndex, destination: candidate.destination, path: candidate.path, turns: candidate.turns, type: "roll", preview: true, progress, started: performance.now(), duration: 1 };
    render();
  }, true);

  canvas.addEventListener("pointerup", event => {
    if (!previewPointer || event.pointerId !== previewPointer.pointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const point = localPoint(event);
    const distance = Math.hypot(point.x - previewPointer.start.x, point.y - previewPointer.start.y);
    const face = previewPointer.face;
    previewPointer = null;
    if (animation?.preview) {
      const preview = animation;
      if (preview.progress >= .3) commitPreview(face.cubeIndex, preview);
      else { animation = null; render(); }
    } else if (distance < 10) doSlide(face);
    else blocked();
  }, true);

  canvas.addEventListener("pointercancel", event => {
    if (!previewPointer || event.pointerId !== previewPointer.pointerId) return;
    previewPointer = null;
    animation = null;
    render();
  }, true);

  document.querySelector("#hint").textContent = "Click a face to push. Drag any visible face of a cube in the roll direction; release past 30% to commit.";
})();
