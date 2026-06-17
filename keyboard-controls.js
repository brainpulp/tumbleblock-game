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
    return rollCandidates(index).map(candidate => ({
      mode: "roll",
      index,
      candidate,
      destination: candidate.destination,
      screen: candidate.screen,
    }));
  }

  function moveOptions(index) {
    return [...slideOptions(index), ...rollOptions(index)]
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
    const choice = preview.choice;
    preview = null;
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
      const ghost = {
        ...cubes[choice.index],
        pos: choice.destination,
        orient: choice.mode === "roll"
          ? orientationAfterCandidate(cubes[choice.index], choice.candidate)
          : cubes[choice.index].orient,
      };
      const occupied = new Set(cubes.map(cube => k(cube.pos)));
      const view = currentView();
      const faces = [];
      DIRS.forEach(normal => {
        if (occupied.has(k(add(ghost.pos, normal)))) return;
        if (dot(normal, view.depth) <= 0) return;
        const poly = polygonForFace(ghost.pos, normal, origin, scale);
        const center = add(ghost.pos.map(value => value + .5), normal.map(value => value * .5));
        faces.push({ normal, poly, depth: dot(center, view.depth) });
      });
      ctx.save();
      ctx.globalAlpha = .42;
      faces.sort((a, b) => a.depth - b.depth).forEach(face => {
        ctx.beginPath();
        face.poly.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
        ctx.closePath();
        ctx.fillStyle = faceColor(ghost, face.normal, level.mode);
        ctx.fill();
        ctx.strokeStyle = "#1687ff";
        ctx.lineWidth = Math.max(1.5, scale / 30);
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
      clearPreview();
      turnCamera(direction);
    }
  });

  document.querySelector("#hint").textContent =
    "Keyboard: Tab selects movable cubes, Space cycles possible moves, Enter commits. Mouse controls still work.";
  render();
})();
