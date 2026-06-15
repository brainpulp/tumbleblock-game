(() => {
  levels[4].target = [p(0,0,0), p(1,0,0), p(1,1,0), p(1,0,1), p(2,0,0)];
  levels[11].target = [
    p(0,0,0), p(1,0,0), p(1,1,0,0,[0,1,4,5,3,2]),
    p(1,1,1,0,[4,5,2,3,1,0]), p(2,1,0),
  ];

  function faceConnected(positions) {
    const occupied = new Set(positions.map(k));
    const seen = new Set([k(positions[0])]);
    const queue = [positions[0]];
    while (queue.length) {
      const position = queue.shift();
      for (const direction of DIRS) {
        const next = add(position, direction);
        if (occupied.has(k(next)) && !seen.has(k(next))) {
          seen.add(k(next));
          queue.push(next);
        }
      }
    }
    return seen.size === positions.length;
  }

  validDestination = function(index, destination) {
    if (!topFree(index) || !connectedWithout(index)) return false;
    if (cubes.some((cube, i) => i !== index && eq(cube.pos, destination))) return false;
    return faceConnected(cubes.map((cube, i) => i === index ? destination : cube.pos));
  };

  let projectionPivot = [0, 0, 0];
  const baseProject = project;
  project = function(vector, origin, scale) {
    return baseProject(sub(vector, projectionPivot), origin, scale);
  };

  drawCluster = function(cluster, origin, scale, mode, interactive, now = performance.now(), animate = false) {
    projectionPivot = [0, 1, 2].map(axis =>
      cluster.reduce((sum, cube) => sum + cube.pos[axis] + .5, 0) / cluster.length
    );
    const occupied = new Set(cluster.map((cube, i) => animate && i === animation?.index ? "" : k(cube.pos)));
    const view = currentView();
    const faces = [];
    cluster.forEach((cube, cubeIndex) => {
      const visual = animatedCube(cube, cubeIndex, now, animate);
      DIRS.forEach(normal => {
        if (!visual.visualRotations && occupied.has(k(add(cube.pos, normal)))) return;
        const visualNormal = visual.visualRotations
          ? visual.visualRotations.reduce((vector, rotation) => rotateVector(vector, rotation.axis, rotation.angle), normal)
          : normal;
        if (dot(visualNormal, view.depth) <= 0) return;
        const poly = visual.visualRotations
          ? polygonForAnimatedFace(visual, normal, origin, scale)
          : polygonForFace(visual.pos, normal, origin, scale);
        const center = add(visual.pos.map(n => n + .5), visualNormal.map(n => n * .5));
        faces.push({ cube, cubeIndex, normal, poly, depth: dot(center, view.depth) });
      });
    });
    faces.sort((a, b) => a.depth - b.depth);
    for (const face of faces) {
      ctx.beginPath();
      face.poly.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.closePath();
      ctx.fillStyle = faceColor(face.cube, face.normal, mode);
      ctx.fill();
      ctx.strokeStyle = "#202020";
      ctx.lineWidth = Math.max(1.25, scale / 34);
      ctx.lineJoin = "round";
      ctx.stroke();
      if (interactive) hitFaces.push(face);
    }
  };

  function orientationAfter(cube, candidate) {
    let orientation = [...cube.orient];
    for (const step of candidate.path) {
      for (let turn = 0; turn < step.turns; turn++) {
        const turned = [...orientation];
        DIRS.forEach((worldDirection, oldWorldIndex) => {
          turned[dirIndex(rotateDirection(worldDirection, step.axis))] = orientation[oldWorldIndex];
        });
        orientation = turned;
      }
    }
    return orientation;
  }

  function commitRoll(index, candidate, progress = 0) {
    animation = null;
    return animateMove({
      index,
      destination: candidate.destination,
      path: candidate.path,
      turns: candidate.turns,
      orient: orientationAfter(cubes[index], candidate),
      type: "roll",
      duration: (candidate.turns === 2 ? 440 : 280) * (1 - progress),
      fromProgress: progress,
      sound: "roll",
    });
  }

  doSlide = function(face) {
    const destination = add(face.cube.pos, neg(face.normal));
    if (validDestination(face.cubeIndex, destination)) {
      return animateMove({ index: face.cubeIndex, destination, type: "slide", duration: 180, sound: "slide" });
    }
    const push = neg(face.normal);
    const roll = rollCandidates(face.cubeIndex)
      .filter(candidate => dot(push, sub(candidate.path[0].destination, face.cube.pos)) > 0)
      .sort((a, b) => a.turns - b.turns)[0];
    return roll ? commitRoll(face.cubeIndex, roll) : blocked();
  };

  const baseAnimatedCube = animatedCube;
  animatedCube = function(cube, cubeIndex, now, animate) {
    if (!animate || !animation || animation.index !== cubeIndex || !animation.preview && animation.fromProgress == null) {
      return baseAnimatedCube(cube, cubeIndex, now, animate);
    }
    const elapsed = Math.min(1, (now - animation.started) / animation.duration);
    const raw = animation.preview ? animation.progress : animation.fromProgress + (1 - animation.fromProgress) * elapsed;
    const t = raw * raw * (3 - 2 * raw);
    const scaled = t * animation.turns;
    const pathIndex = Math.min(animation.path.length - 1, Math.floor(scaled));
    const completedBefore = animation.path.slice(0, pathIndex).reduce((sum, pathStep) => sum + pathStep.turns, 0);
    const stepT = Math.min(1, (scaled - completedBefore) / animation.path[pathIndex].turns);
    const step = animation.path[pathIndex];
    const angle = stepT * step.turns * Math.PI / 2;
    const centerAngle = stepT * Math.PI;
    const center = add(step.pivot, rotateVector(step.relative, step.axis, centerAngle));
    const visualRotations = animation.path.slice(0, pathIndex).map(pathStep => ({ axis: pathStep.axis, angle: pathStep.turns * Math.PI / 2 }));
    visualRotations.push({ axis: step.axis, angle });
    return { ...cube, pos: center.map(n => n - .5), visualRotations };
  };

  function chooseRoll(index, drag) {
    const length = Math.hypot(...drag);
    if (length < 10) return null;
    return rollCandidates(index).map(candidate => {
      const candidateLength = Math.hypot(...candidate.screen);
      return { candidate, score: candidateLength ? dot(drag, candidate.screen) / (length * candidateLength) : -1 };
    }).sort((a, b) => b.score - a.score || a.candidate.turns - b.candidate.turns)
      .find(entry => entry.score >= .45)?.candidate || null;
  }

  rollCandidates = function(index) {
    const cube = cubes[index];
    const occupied = new Set(cubes.filter((_, i) => i !== index).map(c => k(c.pos)));
    const candidates = [];
    cubes.forEach((neighbor, neighborIndex) => {
      if (neighborIndex === index) return;
      const from = sub(cube.pos, neighbor.pos);
      if (!DIRS.some(direction => eq(direction, from))) return;
      for (const to of DIRS) {
        if (dot(from, to) !== 0) continue;
        const destination = add(neighbor.pos, to);
        if (occupied.has(k(destination)) || !validDestination(index, destination)) continue;
        const turns = cube.pos[2] === destination[2] ? 1 : 2;
        const axis = cross(from, to);
        const neighborCenter = neighbor.pos.map(n => n + .5);
        const pivot = neighborCenter.map((n, i) => n + (from[i] + to[i]) * .5);
        const sourceCenter = cube.pos.map(n => n + .5);
        candidates.push({
          destination,
          turns,
          path: [{ destination, axis, pivot, relative: sub(sourceCenter, pivot), turns }],
          screen: subScreen(destination, cube.pos),
        });
      }

    });
    return candidates;
  };

  let active = null;
  canvas.addEventListener("pointerdown", event => {
    if (animation || cameraSnap) return;
    const point = localPoint(event);
    const face = [...hitFaces].reverse().find(item => pointInPoly(point, item.poly));
    if (!face) return;
    event.stopImmediatePropagation();
    canvas.setPointerCapture(event.pointerId);
    active = { pointerId: event.pointerId, start: point, face };
  }, true);

  canvas.addEventListener("pointermove", event => {
    if (!active || event.pointerId !== active.pointerId || animation && !animation.preview) return;
    event.stopImmediatePropagation();
    const point = localPoint(event);
    const drag = [point.x - active.start.x, point.y - active.start.y];
    const candidate = chooseRoll(active.face.cubeIndex, drag);
    if (!candidate) {
      animation = null;
      render();
      return;
    }
    const length = Math.hypot(...candidate.screen);
    const progress = Math.max(0, Math.min(1, dot(drag, candidate.screen) / (length * length)));
    animation = { index: active.face.cubeIndex, destination: candidate.destination, path: candidate.path, turns: candidate.turns, type: "roll", preview: true, progress, started: performance.now(), duration: 1 };
    render();
  }, true);

  canvas.addEventListener("pointerup", event => {
    if (!active || event.pointerId !== active.pointerId) return;
    event.stopImmediatePropagation();
    const point = localPoint(event);
    const distance = Math.hypot(point.x - active.start.x, point.y - active.start.y);
    const face = active.face;
    active = null;
    if (animation?.preview) {
      const preview = animation;
      if (preview.progress >= .3) commitRoll(face.cubeIndex, preview, preview.progress);
      else { animation = null; render(); }
    } else if (distance < 10) doSlide(face);
    else blocked();
  }, true);

  canvas.addEventListener("pointercancel", () => {
    active = null;
    animation = null;
    render();
  }, true);

  document.querySelector("#hint").textContent = "Click a face to push. Drag any visible face through the full roll; release past 30% to commit.";
  render();
})();
