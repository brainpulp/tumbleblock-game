(() => {
  let selectedIndex = 0;
  let preview = null;
  let moveCursor = 0;
  let keyboardActive = false;

  const keyDirections = {
    ArrowUp: [0, -1],
    ArrowLeft: [-1, 0],
    ArrowDown: [0, 1],
    ArrowRight: [1, 0],
  };

  function clearPreview() {
    if (!preview) return;
    preview = null;
    render();
  }

  function orientationAfterCandidate(cube, candidate) {
    let orientation = [...cube.orient];
    for (const step of candidate.path) {
      for (let turn = 0; turn < (step.turns || 1); turn++) {
        const turned = [...orientation];
        DIRS.forEach((worldDirection, oldWorldIndex) => {
          turned[dirIndex(rotateDirection(worldDirection, step.axis))] = orientation[oldWorldIndex];
        });
        orientation = turned;
      }
    }
    return orientation;
  }

  function orientationAfterAxisTurn(cube, axis) {
    const turned = [...cube.orient];
    DIRS.forEach((worldDirection, oldWorldIndex) => {
      turned[dirIndex(rotateDirection(worldDirection, axis))] = cube.orient[oldWorldIndex];
    });
    return turned;
  }

  function slideOptions(index) {
    return DIRS.map(direction => {
      const destination = add(cubes[index].pos, direction);
      if (!validDestination(index, destination)) return null;
      return {
        mode: "slide",
        index,
        destination,
        screen: subScreen(destination, cubes[index].pos),
      };
    }).filter(Boolean);
  }

  function rollOptions(index) {
    const occupied = new Set(cubes.filter((_, cubeIndex) => cubeIndex !== index).map(cube => k(cube.pos)));
    return rollCandidates(index)
      .filter(candidate =>
        validDestination(index, candidate.destination) &&
        candidate.path.every(step => !occupied.has(k(step.destination)))
      )
      .map(candidate => ({
        mode: "roll",
        index,
        candidate,
        destination: candidate.destination,
        screen: candidate.screen,
      }));
  }

  function pushOptions(index) {
    const options = [];
    for (const direction of DIRS) {
      const chain = [index];
      let cursor = add(cubes[index].pos, direction);
      while (true) {
        const nextIndex = cubes.findIndex(cube => eq(cube.pos, cursor));
        if (nextIndex < 0) break;
        chain.push(nextIndex);
        cursor = add(cursor, direction);
      }
      if (chain.length < 2) continue;
      if (cubes.some(cube => eq(cube.pos, cursor))) continue;
      const chainSet = new Set(chain);
      const buried = chain.some(cubeIndex =>
        cubes.some((cube, otherIndex) =>
          !chainSet.has(otherIndex) &&
          eq(cube.pos, add(cubes[cubeIndex].pos, [0, 0, 1]))
        )
      );
      if (buried) continue;
      const positions = cubes.map((cube, cubeIndex) =>
        chainSet.has(cubeIndex) ? add(cube.pos, direction) : cube.pos
      );
      if (!faceConnected(positions)) continue;
      options.push({
        mode: "push",
        index,
        direction,
        indices: chain,
        items: chain.map(cubeIndex => ({
          index: cubeIndex,
          destination: add(cubes[cubeIndex].pos, direction),
        })),
        destination: add(cubes[index].pos, direction),
        screen: subScreen(add(cubes[index].pos, direction), cubes[index].pos),
      });
    }
    return options;
  }

  function twistOptions(index) {
    if (levels[levelIndex].mode !== "faces") return [];
    const seen = new Set();
    const options = [];
    cubes.forEach((neighbor, neighborIndex) => {
      if (neighborIndex === index) return;
      const axis = sub(cubes[index].pos, neighbor.pos);
      if (!DIRS.some(direction => eq(direction, axis))) return;
      for (const signedAxis of [axis, neg(axis)]) {
        const key = k(signedAxis);
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({
          mode: "twist",
          index,
          axis: signedAxis,
          destination: cubes[index].pos,
          orient: orientationAfterAxisTurn(cubes[index], signedAxis),
          screen: subScreen(add(cubes[index].pos, signedAxis), cubes[index].pos),
        });
      }
    });
    return options;
  }

  function moveOptions(index) {
    return [...slideOptions(index), ...rollOptions(index), ...pushOptions(index), ...twistOptions(index)]
      .map((option, originalIndex) => ({
        ...option,
        originalIndex,
        angle: Math.atan2(option.screen[1], option.screen[0]),
      }))
      .sort((a, b) =>
        a.angle - b.angle ||
        a.mode.localeCompare(b.mode) ||
        (a.candidate?.turns || 1) - (b.candidate?.turns || 1) ||
        a.originalIndex - b.originalIndex
      );
  }

  function samePosition(a, b) {
    return eq(a, b);
  }

  function sameMove(a, b) {
    return a &&
      b &&
      a.mode === b.mode &&
      a.index === b.index &&
      samePosition(a.destination, b.destination) &&
      (a.mode !== "roll" || (a.candidate?.turns || 1) === (b.candidate?.turns || 1)) &&
      (a.mode !== "push" || k(a.direction) === k(b.direction)) &&
      (a.mode !== "twist" || k(a.axis) === k(b.axis));
  }

  function currentLegalMove(choice) {
    if (!choice) return null;
    return moveOptions(choice.index).find(option => sameMove(option, choice)) || null;
  }

  function movableIndices() {
    return cubes
      .map((_, index) => index)
      .filter(index => moveOptions(index).length > 0);
  }

  function ensureMovableSelection() {
    const movable = movableIndices();
    if (!movable.length) return false;
    if (!movable.includes(selectedIndex)) {
      selectedIndex = movable[0];
      moveCursor = 0;
    }
    return true;
  }

  function cycleCube(delta) {
    keyboardActive = true;
    clearPreview();
    const movable = movableIndices();
    if (!movable.length) {
      blocked();
      return;
    }
    const current = movable.indexOf(selectedIndex);
    const next = current < 0
      ? 0
      : (current + delta + movable.length) % movable.length;
    selectedIndex = movable[next];
    moveCursor = 0;
    playSound("select");
    showMessage(`Cube ${selectedIndex + 1}`);
    render();
  }

  function cycleMove(delta = 1) {
    if (won || cameraSnap || animation) return;
    keyboardActive = true;
    if (!ensureMovableSelection()) {
      blocked();
      return;
    }
    const options = moveOptions(selectedIndex);
    if (!options.length) {
      blocked();
      return;
    }
    moveCursor = preview
      ? (moveCursor + delta + options.length) % options.length
      : Math.max(0, Math.min(moveCursor, options.length - 1));
    preview = {
      choice: options[moveCursor],
      count: options.length,
    };
    render();
    showMessage(`${preview.choice.mode.toUpperCase()} ${moveCursor + 1}/${options.length} · Enter commits`);
  }

  function commitPreview() {
    if (!preview?.choice || animation) return;
    const choice = currentLegalMove(preview.choice);
    if (!choice) {
      clearPreview();
      blocked();
      return;
    }
    preview = null;
    if (choice.mode === "push") {
      return animateMultiSlide(choice);
    }
    if (choice.mode === "twist") {
      return animateMove({
        index: choice.index,
        destination: choice.destination,
        path: [{ axis: choice.axis, turns: 1, twist: true }],
        axis: choice.axis,
        orient: choice.orient,
        type: "twist",
        duration: 220,
        sound: "roll",
      });
    }
    if (choice.mode === "roll") {
      return animateMove({
        index: choice.index,
        destination: choice.destination,
        path: choice.candidate.path,
        turns: choice.candidate.turns || 1,
        orient: orientationAfterCandidate(cubes[choice.index], choice.candidate),
        type: "roll",
        duration: choice.candidate.turns === 2 ? 440 : 280,
        sound: "roll",
      });
    }
    return animateMove({
      index: choice.index,
      destination: choice.destination,
      type: "slide",
      duration: 180,
      sound: "slide",
    });
  }

  function animateMultiSlide(choice) {
    if (animation) return false;
    animation = {
      type: "push",
      items: choice.items.map(item => ({
        index: item.index,
        destination: item.destination,
      })),
      started: performance.now(),
      duration: 220,
    };
    playSound("slide");
    render();
    setTimeout(() => {
      animation.items.forEach(item => {
        cubes[item.index].pos = item.destination;
      });
      animation = null;
      commitMove();
    }, animation.duration);
    return true;
  }

  function dispatchPointer(type, x, y) {
    const options = {
      bubbles: true,
      clientX: x,
      clientY: y,
      pointerId: 8701,
      pointerType: "mouse",
      isPrimary: true,
    };
    if (typeof PointerEvent === "function") return canvas.dispatchEvent(new PointerEvent(type, options));
    const event = new MouseEvent(type, options);
    Object.defineProperty(event, "pointerId", { value: options.pointerId });
    return canvas.dispatchEvent(event);
  }

  function turnCamera(direction) {
    if (window.TUMBLEBLOCK_TURN_CAMERA) {
      return window.TUMBLEBLOCK_TURN_CAMERA({ x: direction[0], y: direction[1] });
    }
    if (animation || cameraSnap) return false;
    const rect = canvas.getBoundingClientRect();
    const start = { x: rect.left + rect.width * .08, y: rect.top + rect.height * .5 };
    const drag = 210;
    const originalCapture = canvas.setPointerCapture;
    canvas.setPointerCapture = () => {};
    try {
      dispatchPointer("pointerdown", start.x, start.y);
      dispatchPointer("pointermove", start.x + direction[0] * drag, start.y + direction[1] * drag);
      dispatchPointer("pointerup", start.x + direction[0] * drag, start.y + direction[1] * drag);
    } finally {
      canvas.setPointerCapture = originalCapture;
    }
    return true;
  }

  const baseAnimatedCube = animatedCube;
  animatedCube = function(cube, cubeIndex, now, animate) {
    if (animate && animation?.type === "push") {
      const item = animation.items.find(entry => entry.index === cubeIndex);
      if (item) {
        const elapsed = Math.min(1, (now - animation.started) / animation.duration);
        const progress = elapsed * elapsed * (3 - 2 * elapsed);
        const pos = cube.pos.map((value, index) =>
          value + (item.destination[index] - value) * progress
        );
        return { ...cube, pos };
      }
    }
    if (animate && animation?.type === "twist" && animation.index === cubeIndex) {
      const elapsed = Math.min(1, (now - animation.started) / animation.duration);
      const raw = (animation.fromProgress || 0) + (1 - (animation.fromProgress || 0)) * elapsed;
      const progress = raw * raw * (3 - 2 * raw);
      const angle = Math.PI / 2 * progress;
      const center = cube.pos.map(value => value + .5);
      return {
        ...cube,
        visualRotations: [{ axis: animation.axis, angle }],
        rigidTransform: { center, axis: animation.axis, angle },
      };
    }
    return baseAnimatedCube(cube, cubeIndex, now, animate);
  };

  const baseLoadLevel = loadLevel;
  loadLevel = function(index) {
    selectedIndex = 0;
    preview = null;
    moveCursor = 0;
    keyboardActive = false;
    const result = baseLoadLevel(index);
    render();
    return result;
  };

  const baseRender = render;
  render = function() {
    baseRender();
    if (keyboardActive) ensureMovableSelection();

    if (preview?.choice && !animation) {
      const choice = preview.choice;
      const level = levels[levelIndex];
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const scale = Math.min(w * .17, h * .12, 74) / Math.max(1, bounds(cubes).span / 4);
      const origin = { x: w / 2, y: h * .65 };
      const ghosts = previewGhosts(choice);
      const occupied = new Set([...cubes, ...ghosts].map(cube => k(cube.pos)));
      const view = currentView();
      const faces = [];
      const collect = (cube, ghost = false) => DIRS.forEach(normal => {
        const neighborKey = k(add(cube.pos, normal));
        if (occupied.has(neighborKey)) return;
        const visualNormal = cube.visualRotations
          ? cube.visualRotations.reduce((vector, rotation) => rotateVector(vector, rotation.axis, rotation.angle), normal)
          : normal;
        if (dot(visualNormal, view.depth) <= 0) return;
        const poly = cube.visualRotations
          ? polygonForAnimatedFace(cube, normal, origin, scale)
          : polygonForFace(cube.pos, normal, origin, scale);
        const center = add(cube.pos.map(value => value + .5), visualNormal.map(value => value * .5));
        faces.push({ cube, normal, poly, ghost, depth: dot(center, view.depth) });
      });
      cubes.forEach(cube => collect(cube, false));
      ghosts.forEach(cube => collect(cube, true));
      ctx.save();
      faces.sort((a, b) => a.depth - b.depth).forEach(face => {
        ctx.globalAlpha = face.ghost ? .48 : 1;
        ctx.beginPath();
        face.poly.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
        ctx.closePath();
        ctx.fillStyle = faceColor(face.cube, face.normal, level.mode);
        ctx.fill();
        ctx.strokeStyle = face.ghost ? "#1687ff" : "#202020";
        ctx.lineWidth = face.ghost ? Math.max(1.5, scale / 30) : Math.max(1.25, scale / 34);
        ctx.stroke();
      });
      ctx.restore();
    }

    if (!keyboardActive || animation || !hitFaces.length || !moveOptions(selectedIndex).length) return;
    ctx.save();
    ctx.strokeStyle = "#1687ff";
    ctx.lineWidth = 3;
    ctx.globalAlpha = .9;
    hitFaces.filter(face => face.cubeIndex === selectedIndex).forEach(face => {
      ctx.beginPath();
      face.poly.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.closePath();
      ctx.stroke();
    });
    ctx.restore();
  };

  function previewGhosts(choice) {
    if (choice.mode === "push") {
      return choice.items.map(item => ({
        ...cubes[item.index],
        pos: item.destination,
      }));
    }
    if (choice.mode === "twist") {
      return [{
        ...cubes[choice.index],
        orient: choice.orient,
        visualRotations: [{ axis: choice.axis, angle: Math.PI / 2 }],
        rigidTransform: {
          center: cubes[choice.index].pos.map(value => value + .5),
          axis: choice.axis,
          angle: Math.PI / 2,
        },
      }];
    }
    return [{
      ...cubes[choice.index],
      pos: choice.destination,
      orient: choice.mode === "roll"
        ? orientationAfterCandidate(cubes[choice.index], choice.candidate)
        : cubes[choice.index].orient,
    }];
  }

  window.addEventListener("keydown", event => {
    if (event.repeat || event.target.closest("button,input,textarea,select")) return;
    if (document.querySelector("dialog[open]")) return;

    if (event.key === "Tab") {
      event.preventDefault();
      cycleCube(event.shiftKey ? -1 : 1);
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      cycleMove(event.shiftKey ? -1 : 1);
      return;
    }

    if (event.code === "Enter") {
      event.preventDefault();
      commitPreview();
      return;
    }

    if (event.code === "Escape") {
      clearPreview();
      return;
    }

    if (event.code === "KeyR" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      clearPreview();
      loadLevel(levelIndex);
      return;
    }

    const direction = keyDirections[event.code];
    if (direction) {
      event.preventDefault();
      turnCamera(direction);
      render();
    }
  });

  document.querySelector("#hint").textContent =
    "Keyboard: Tab selects movable cubes, Space cycles possible moves, Enter commits. Mouse controls still work.";
  render();
})();
