//@@BANNER@@ mechanics-controls.js
//@@BANNER@@ Core gameplay: rendering, move validation, slides, rolls (over/surface/push), animation tweening, and the camera-debug level. Each block below is an isolated IIFE and the order is load-bearing.
//@@BANNER@@ Consolidated from: camera-debug-level-controls.js, core-controls.js, animation-tween-controls.js, movement-rules-controls.js, over-roll-controls.js, surface-roll-controls.js, push-roll-controls.js
//@@BANNER@@
//@@BANNER@@ ===== camera-debug-level-controls.js =====
(() => {
  const debugRequested = new URLSearchParams(location.search).has("cameraDebug") ||
    location.hash === "#cameraDebug";
  const debugLevel = {
    title: "🎥 Camera Debug",
    mode: "faces",
    hint: "Camera test level. Drag the background to orbit; arrow keys turn. Use the SCREEN/CYCLE/LOCK switch (or press M) to compare up/down modes.",
    start: [p(0, 0, 0)],
    target: [p(0, 0, 0)],
    debugOnly: true,
  };

  let debugIndex = levels.findIndex(level => level.debugOnly);
  if (debugIndex < 0) {
    levels.push(debugLevel);
    debugIndex = levels.length - 1;
  }

  const baseLoadLevel = loadLevel;
  loadLevel = function(index) {
    const isDebug = !!levels[index]?.debugOnly;
    window.TUMBLEBLOCK_CAMERA_DEBUG = isDebug;
    window.TUMBLEBLOCK_SHOW_CAMERA_AXES = isDebug;
    const result = baseLoadLevel(index);
    if (isDebug) document.querySelector("#hint").textContent = debugLevel.hint;
    return result;
  };

  if (debugRequested) {
    window.TUMBLEBLOCK_SAVED_LEVEL = debugIndex;
    loadLevel(debugIndex);
  }
})();
//@@BANNER@@
//@@BANNER@@ ===== core-controls.js =====
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

  const candKey = c => k(c.destination) + "|" + c.turns + "|" + k(c.path[0].axis);

  // Hysteresis keeps the roll preview from flickering when several candidates
  // project to nearby screen directions (common with 3+ options in iso view).
  const ROLL_ACQUIRE = .45; // alignment needed to first lock onto a roll
  const ROLL_KEEP = 0;      // keep the latched roll while it stays at least this aligned
  const ROLL_MARGIN = .15;  // a rival must beat the latched roll by this much to steal it

  function chooseRoll(index, drag, latchedKey) {
    const length = Math.hypot(...drag);
    if (length < 10) return null;
    const scored = rollCandidates(index).map(candidate => {
      const candidateLength = Math.hypot(...candidate.screen);
      const score = candidateLength ? dot(drag, candidate.screen) / (length * candidateLength) : -1;
      return { candidate, score, key: candKey(candidate) };
    }).sort((a, b) => b.score - a.score || a.candidate.turns - b.candidate.turns);
    const best = scored[0];
    if (!best) return null;
    if (latchedKey) {
      const current = scored.find(entry => entry.key === latchedKey);
      // Stay latched: only switch when a rival wins by a clear margin, and keep
      // showing the latched roll even if its score dips below the acquire bar.
      if (current && current.score >= ROLL_KEEP && best.score - current.score < ROLL_MARGIN) {
        return current.candidate;
      }
    }
    return best.score >= ROLL_ACQUIRE ? best.candidate : null;
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
    active = { pointerId: event.pointerId, start: point, face, latchedKey: null };
  }, true);

  canvas.addEventListener("pointermove", event => {
    if (!active || event.pointerId !== active.pointerId || animation && !animation.preview) return;
    event.stopImmediatePropagation();
    const point = localPoint(event);
    const drag = [point.x - active.start.x, point.y - active.start.y];
    const candidate = chooseRoll(active.face.cubeIndex, drag, active.latchedKey);
    if (!candidate) {
      active.latchedKey = null;
      animation = null;
      render();
      return;
    }
    active.latchedKey = candKey(candidate);
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
//@@BANNER@@
//@@BANNER@@ ===== animation-tween-controls.js =====
(() => {
  const rigidCorner = (cube, local) => { const rotated = rotateVector(local, cube.rigidTransform.axis, cube.rigidTransform.angle); return add(cube.rigidTransform.center, rotated); };
  const quadratic = (start, control, end, progress) => start.map((value, index) => { const remaining = 1 - progress; return remaining * remaining * value + 2 * remaining * progress * control[index] + progress * progress * end[index]; });
  const unit = vector => { const length = Math.hypot(...vector); return vector.map(value => value / length); };
  polygonForAnimatedFace = function(cube, normal, origin, scale) {
    const axis = normal.findIndex(value => value !== 0), others = [0, 1, 2].filter(index => index !== axis);
    return [[-1,-1], [1,-1], [1,1], [-1,1]].map(pair => { const local = [-.5, -.5, -.5]; local[axis] = normal[axis] * .5; local[others[0]] = pair[0] * .5; local[others[1]] = pair[1] * .5; return project(rigidCorner(cube, local), origin, scale); });
  };
  animatedCube = function(cube, cubeIndex, now, animate) {
    if (!animate || !animation || animation.index !== cubeIndex) return cube;
    const elapsed = Math.min(1, (now - animation.started) / animation.duration), raw = animation.preview ? animation.progress : (animation.fromProgress || 0) + (1 - (animation.fromProgress || 0)) * elapsed, progress = raw * raw * (3 - 2 * raw);
    const startCenter = cube.pos.map(value => value + .5), destinationCenter = animation.destination.map(value => value + .5), step = animation.path?.[0];
    if (!step) { const center = startCenter.map((value, index) => value + (destinationCenter[index] - value) * progress); return { ...cube, pos: center.map(value => value - .5) }; }
    const angle = step.turns * Math.PI / 2 * progress;
    let center;
    if (step.turns === 1) {
      const support = cubes.find((other, index) => index !== cubeIndex && DIRS.some(direction => eq(add(cube.pos, direction), other.pos)) && DIRS.some(direction => eq(add(animation.destination, direction), other.pos)) && eq(cross(sub(cube.pos, other.pos), sub(animation.destination, other.pos)), step.axis));
      const supportCenter = support ? support.pos.map(value => value + .5) : step.pivot;
      const outward = unit(add(sub(startCenter, supportCenter), sub(destinationCenter, supportCenter)));
      const control = add(supportCenter, outward.map(value => value * Math.sqrt(2) * 1.35));
      center = quadratic(startCenter, control, destinationCenter, progress);
    } else center = add(step.pivot, rotateVector(step.relative, step.axis, Math.PI * progress));
    return { ...cube, pos: center.map(value => value - .5), visualRotations: [{ axis: step.axis, angle }], rigidTransform: { center, axis: step.axis, angle } };
  };
})();
//@@BANNER@@
//@@BANNER@@ ===== movement-rules-controls.js =====
(() => {
  function isFaceConnected(positions) {
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
    if (!connectedWithout(index)) return false;
    if (cubes.some((cube, i) => i !== index && eq(cube.pos, destination))) return false;
    return isFaceConnected(cubes.map((cube, i) => i === index ? destination : cube.pos));
  };
})();
//@@BANNER@@
//@@BANNER@@ ===== over-roll-controls.js (removed) =====
// Over-roll (flipping a cube two cells straight over a neighbor, turns:2) was an
// illegal move: a roll must only travel one position. It is removed, so
// rollCandidates yields only the around-a-neighbor roll and the surface roll,
// both of which move a single position.
//@@BANNER@@
//@@BANNER@@ ===== surface-roll-controls.js =====
(() => {
  const baseRollCandidates = rollCandidates;
  rollCandidates = function(index) {
    const cube = cubes[index];
    const occupied = new Set(cubes.filter((_, cubeIndex) => cubeIndex !== index).map(item => k(item.pos)));
    const candidates = baseRollCandidates(index);
    const sourceCenter = cube.pos.map(value => value + .5);

    const addCandidate = candidate => {
      if (!candidates.some(existing => eq(existing.destination, candidate.destination))) {
        candidates.push(candidate);
      }
    };

    cubes.forEach((support, supportIndex) => {
      if (supportIndex === index) return;
      const from = sub(cube.pos, support.pos);
      if (!DIRS.some(direction => eq(direction, from))) return;

      for (const direction of DIRS) {
        if (dot(from, direction) !== 0) continue;
        const destination = add(cube.pos, direction);
        const destinationSupport = add(support.pos, direction);
        if (
          occupied.has(k(destination)) ||
          !occupied.has(k(destinationSupport)) ||
          !validDestination(index, destination)
        ) continue;

        const axis = cross(from, direction);
        const pivot = sourceCenter.map((value, axisIndex) =>
          value + (direction[axisIndex] - from[axisIndex]) * .5
        );
        addCandidate({
          destination,
          turns: 1,
          surface: true,
          path: [{
            destination,
            axis,
            pivot,
            relative: sub(sourceCenter, pivot),
            turns: 1,
            surface: true,
          }],
          screen: subScreen(destination, cube.pos),
        });
      }
    });

    return candidates;
  };

  const baseAnimatedCube = animatedCube;
  animatedCube = function(cube, cubeIndex, now, animate) {
    const step = animation?.path?.[0];
    if (!animate || !animation || animation.index !== cubeIndex || !step?.surface) {
      return baseAnimatedCube(cube, cubeIndex, now, animate);
    }

    const elapsed = Math.min(1, (now - animation.started) / animation.duration);
    const raw = animation.preview
      ? animation.progress
      : (animation.fromProgress || 0) + (1 - (animation.fromProgress || 0)) * elapsed;
    const progress = raw * raw * (3 - 2 * raw);
    const angle = Math.PI / 2 * progress;
    const center = add(step.pivot, rotateVector(step.relative, step.axis, angle));

    return {
      ...cube,
      pos: center.map(value => value - .5),
      visualRotations: [{ axis: step.axis, angle }],
      rigidTransform: { center, axis: step.axis, angle },
    };
  };
})();
//@@BANNER@@
//@@BANNER@@ ===== push-roll-controls.js =====
(() => {
  const originalSlide = doSlide;

  function orientationAfter(cube, candidate) {
    let orientation = [...cube.orient];
    for (const step of candidate.path) {
      const turned = [...orientation];
      DIRS.forEach((worldDirection, oldWorldIndex) => {
        turned[dirIndex(rotateDirection(worldDirection, step.axis))] = orientation[oldWorldIndex];
      });
      orientation = turned;
    }
    return orientation;
  }

  function pushScore(cube, pushDirection, candidate) {
    const points = [candidate.destination, ...candidate.path.map(step => step.destination)];
    return Math.max(...points.map(point => {
      const displacement = sub(point, cube.pos);
      const length = Math.hypot(...displacement);
      return length ? dot(pushDirection, displacement) / length : -1;
    }));
  }

  function sameRoute(a, b) {
    return eq(a.destination, b.destination) &&
      a.path.length === b.path.length &&
      a.path.every((step, index) => eq(step.axis, b.path[index].axis));
  }

  doSlide = function(face) {
    const pushDirection = neg(face.normal);
    const slideDestination = add(face.cube.pos, pushDirection);
    if (validDestination(face.cubeIndex, slideDestination)) return originalSlide(face);

    const scored = rollCandidates(face.cubeIndex)
      .map(candidate => ({ candidate, score: pushScore(face.cube, pushDirection, candidate) }))
      .filter(entry => entry.score > .5)
      .sort((a, b) => b.score - a.score || a.candidate.turns - b.candidate.turns);
    const best = scored[0];
    if (!best) return blocked();
    const tied = scored.find(entry => entry !== best && entry.score >= best.score - .08 && !sameRoute(entry.candidate, best.candidate));
    if (tied) {
      showMessage("Ambiguous push");
      return blocked();
    }
    const roll = best.candidate;
    return animateMove({
      index: face.cubeIndex,
      destination: roll.destination,
      path: roll.path,
      turns: roll.turns,
      orient: orientationAfter(cubes[face.cubeIndex], roll),
      type: "roll",
      duration: roll.turns === 2 ? 440 : 280,
      sound: "roll",
    });
  };
})();
