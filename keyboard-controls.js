(() => {
  let selectedIndex = 0;
  let preview = null;
  let lastMode = "slide";

  const keyDirections = {
    KeyW: [0, -1],
    KeyA: [-1, 0],
    KeyS: [0, 1],
    KeyD: [1, 0],
    ArrowUp: [0, -1],
    ArrowLeft: [-1, 0],
    ArrowDown: [0, 1],
    ArrowRight: [1, 0],
  };

  const unit = vector => {
    const length = Math.hypot(...vector);
    return length ? vector.map(value => value / length) : [0, 0];
  };

  const scoreScreen = (intent, screen) => {
    const intended = unit(intent);
    const projected = unit(screen);
    return intended[0] * projected[0] + intended[1] * projected[1];
  };

  const cubeCenter = cube => cube.pos.map(value => value + .5);

  function ensureSelection() {
    selectedIndex = Math.max(0, Math.min(selectedIndex, cubes.length - 1));
  }

  function clearKeyboardPreview() {
    if (animation?.keyboardPreview) {
      animation = null;
      preview = null;
      render();
    } else if (preview) {
      preview = null;
      render();
    } else {
      preview = null;
    }
  }

  function slideOptions(index, intent) {
    return DIRS.map(direction => {
      const destination = add(cubes[index].pos, direction);
      if (!validDestination(index, destination)) return null;
      const screen = subScreen(destination, cubes[index].pos);
      return {
        mode: "slide",
        index,
        destination,
        screen,
        score: scoreScreen(intent, screen),
      };
    }).filter(Boolean)
      .filter(option => option.score >= .45)
      .sort((a, b) => b.score - a.score);
  }

  function rollOptions(index, intent) {
    return rollCandidates(index).map(candidate => ({
      mode: "roll",
      index,
      candidate,
      destination: candidate.destination,
      screen: candidate.screen,
      score: scoreScreen(intent, candidate.screen),
    })).filter(option => option.score >= .45)
      .sort((a, b) => b.score - a.score || (a.candidate.turns || 1) - (b.candidate.turns || 1));
  }

  function optionsFor(index, intent) {
    const slide = slideOptions(index, intent)[0];
    const roll = rollOptions(index, intent)[0];
    return [slide, roll].filter(Boolean);
  }

  function drawPreview() {
    render();
  }

  function previewMove(intent) {
    if (won || cameraSnap || animation && !animation.keyboardPreview) return;
    ensureSelection();
    clearKeyboardPreview();
    const options = optionsFor(selectedIndex, intent);
    if (!options.length) {
      blocked();
      return;
    }
    const choice = options.find(option => option.mode === lastMode) || options[0];
    preview = { intent, options, choice };
    drawPreview(choice);
    const alternate = options.length > 1 ? " · Space switches" : "";
    showMessage(`${choice.mode.toUpperCase()} preview${alternate} · Enter commits`);
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

  function commitPreview() {
    if (!preview?.choice || animation) return;
    const choice = preview.choice;
    preview = null;
    lastMode = choice.mode;
    if (choice.mode === "roll") {
      return animateMove({
        index: choice.index,
        destination: choice.destination,
        path: choice.candidate.path,
        turns: choice.candidate.turns || 1,
        orient: orientationAfterCandidate(cubes[choice.index], choice.candidate),
        type: "roll",
        duration: (choice.candidate.turns === 2 ? 440 : 280),
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

  function togglePreviewMode() {
    if (!preview || preview.options.length < 2) return;
    const nextMode = preview.choice.mode === "slide" ? "roll" : "slide";
    const choice = preview.options.find(option => option.mode === nextMode);
    if (!choice) return;
    lastMode = nextMode;
    preview.choice = choice;
    drawPreview(choice);
    showMessage(`${choice.mode.toUpperCase()} preview · Enter commits`);
  }

  function selectByStep(delta) {
    clearKeyboardPreview();
    selectedIndex = (selectedIndex + delta + cubes.length) % cubes.length;
    playSound("select");
    showMessage(`Cube ${selectedIndex + 1}`);
    render();
  }

  function selectByDirection(intent) {
    clearKeyboardPreview();
    const view = currentView();
    const origin = cubeCenter(cubes[selectedIndex]);
    const intended = unit(intent);
    const next = cubes.map((cube, index) => {
      if (index === selectedIndex) return null;
      const delta = sub(cubeCenter(cube), origin);
      const screen = [dot(delta, view.right), -dot(delta, view.up)];
      const forward = screen[0] * intended[0] + screen[1] * intended[1];
      return {
        index,
        forward,
        score: scoreScreen(intent, screen),
        distance: Math.hypot(...screen),
      };
    }).filter(Boolean)
      .filter(option => option.forward > .05 && option.score >= .35)
      .sort((a, b) => b.score - a.score || a.distance - b.distance)[0];
    if (!next) {
      blocked();
      return;
    }
    selectedIndex = next.index;
    playSound("select");
    showMessage(`Cube ${selectedIndex + 1}`);
    render();
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
    const start = {
      x: rect.left + rect.width * .08,
      y: rect.top + rect.height * .5,
    };
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
    return baseLoadLevel(index);
  };

  const baseRender = render;
  render = function() {
    baseRender();
    ensureSelection();
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
    if (animation || !hitFaces.length) return;
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
      selectByStep(event.shiftKey ? -1 : 1);
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      togglePreviewMode();
      return;
    }

    if (event.code === "Enter") {
      event.preventDefault();
      commitPreview();
      return;
    }

    if (event.code === "Escape") {
      clearKeyboardPreview();
      return;
    }

    if (event.code === "KeyR" && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      clearKeyboardPreview();
      loadLevel(levelIndex);
      return;
    }

    const direction = keyDirections[event.code];
    if (!direction) return;

    if (event.altKey) {
      event.preventDefault();
      selectByDirection(direction);
      return;
    }

    if (event.ctrlKey || event.code.startsWith("Key")) {
      event.preventDefault();
      previewMove(direction);
      return;
    }

    if (event.code.startsWith("Arrow")) {
      event.preventDefault();
      clearKeyboardPreview();
      turnCamera(direction);
    }
  });

  document.querySelector("#hint").textContent =
    "Keyboard: Tab selects, WASD previews, Space switches slide/roll, Enter commits. Mouse controls still work.";
  render();
})();
