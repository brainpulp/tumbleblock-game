(() => {
  const SOLVER_LIMIT = 160000;
  const CACHE_KEY = "tumbleblock-hush-used-v2";
  const clueButton = document.querySelector("#clues");
  const dialog = document.querySelector("#clues-dialog");
  const perfectRoute = document.querySelector("#perfect-route");
  const currentRoute = document.querySelector("#current-route");
  const clueCopy = document.querySelector("#clue-copy");
  const nextClue = document.querySelector("#next-clue");
  const showHush = document.querySelector("#show-hush");
  const hushControls = document.querySelector(".hush-controls");
  const solutionCache = new Map();
  const pendingSolves = new Map();
  window.TUMBLEBLOCK_BEST_POSSIBLE ||= {};
  let currentSolution = null;
  let clueStep = 0;
  let allWarmStarted = false;

  const cloneCube = cube => ({
    pos: [...cube.pos],
    color: cube.color || 0,
    orient: cube.orient ? [...cube.orient] : [0, 1, 2, 3, 4, 5],
  });

  const clueKey = () => `${window.TUMBLEBLOCK_BUILD?.commit || "local"}:${levels.length}`;
  const usedHush = () => JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  const setHushUsed = index => {
    const used = usedHush();
    used[`${clueKey()}:${index}`] = true;
    localStorage.setItem(CACHE_KEY, JSON.stringify(used));
  };
  const hasUsedHush = index => !!usedHush()[`${clueKey()}:${index}`];

  function normalized(cluster, mode) {
    const mins = [0, 1, 2].map(axis => Math.min(...cluster.map(cube => cube.pos[axis])));
    return cluster.map(cube => ({
      pos: cube.pos.map((value, axis) => value - mins[axis]),
      color: mode === "solid" ? cube.color || 0 : 0,
      orient: mode === "faces" ? [...cube.orient] : [0, 1, 2, 3, 4, 5],
    })).sort((a, b) =>
      k(a.pos).localeCompare(k(b.pos)) ||
      a.color - b.color ||
      k(a.orient).localeCompare(k(b.orient))
    );
  }

  function stateKey(state, mode) {
    return normalized(state, mode)
      .map(cube => `${k(cube.pos)}:${cube.color}:${k(cube.orient)}`)
      .join("|");
  }

  function orientationAfter(cube, candidate) {
    let orientation = [...cube.orient];
    for (const step of candidate.path) {
      for (let turn = 0; turn < (step.turns || 1); turn++) {
        const turned = [...orientation];
        DIRS.forEach((direction, oldIndex) => {
          turned[dirIndex(rotateDirection(direction, step.axis))] = orientation[oldIndex];
        });
        orientation = turned;
      }
    }
    return orientation;
  }

  function applyMove(state, move, mode) {
    const next = state.map(cloneCube);
    const cube = next[move.index];
    cube.pos = [...move.destination];
    if (move.candidate) cube.orient = orientationAfter(cube, move.candidate);
    return normalized(next, mode);
  }

  function moveText(move) {
    const source = `(${move.source.join(",")})`;
    const destination = `(${move.destination.join(",")})`;
    return `${move.type === "slide" ? "Slide" : "Roll"} cube ${source} to ${destination}.`;
  }

  function enumerateMoves(state) {
    const savedCubes = cubes;
    cubes = state.map(cloneCube);
    const moves = [];
    const seen = new Set();

    const addMove = move => {
      const key = `${move.type}:${move.index}:${k(move.destination)}:${move.candidate ? move.candidate.turns : 0}:${move.candidate ? move.candidate.path.map(step => k(step.axis)).join("/") : ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      moves.push(move);
    };

    cubes.forEach((cube, index) => {
      DIRS.forEach(direction => {
        const destination = add(cube.pos, direction);
        if (validDestination(index, destination)) {
          addMove({ type: "slide", index, source: [...cube.pos], sourceColor: cube.color, sourceOrient: [...cube.orient], destination, label: "slide" });
        }
      });

      rollCandidates(index).forEach(candidate => {
        addMove({
          type: "roll",
          index,
          source: [...cube.pos],
          sourceColor: cube.color,
          sourceOrient: [...cube.orient],
          destination: [...candidate.destination],
          candidate: clone(candidate),
          label: candidate.turns === 2 ? "over-roll" : candidate.surface ? "surface roll" : "roll",
        });
      });
    });

    cubes = savedCubes;
    return moves;
  }

  function solveState(level, startState, cacheName) {
    const mode = level.mode;
    const start = normalized(startState, mode);
    const target = stateKey(level.target, mode);
    const startKey = stateKey(start, mode);
    if (startKey === target) return Promise.resolve({ moves: [], visited: 1, exact: true });
    if (solutionCache.has(cacheName)) return Promise.resolve(solutionCache.get(cacheName));
    if (pendingSolves.has(cacheName)) return pendingSolves.get(cacheName);

    const promise = new Promise(resolve => {
      const queue = [{ state: start, path: [] }];
      const seen = new Set([startKey]);
      let cursor = 0;

      const finish = solution => {
        solutionCache.set(cacheName, solution);
        pendingSolves.delete(cacheName);
        resolve(solution);
      };

      const step = () => {
        const until = Math.min(queue.length, cursor + 240);
        for (; cursor < until; cursor++) {
          const item = queue[cursor];
          for (const move of enumerateMoves(item.state)) {
            const nextState = applyMove(item.state, move, mode);
            const key = stateKey(nextState, mode);
            if (seen.has(key)) continue;
            const path = item.path.concat(move);
            if (key === target) return finish({ moves: path, visited: seen.size, exact: true });
            seen.add(key);
            if (seen.size >= SOLVER_LIMIT) {
              return finish({ moves: [], visited: seen.size, exact: false });
            }
            queue.push({ state: nextState, path });
          }
        }
        if (cursor < queue.length) setTimeout(step, 0);
        else finish({ moves: [], visited: seen.size, exact: false });
      };

      step();
    });

    pendingSolves.set(cacheName, promise);
    return promise;
  }

  function currentCacheName(prefix, state = cubes) {
    return `${prefix}:${levelIndex}:${stateKey(state, levels[levelIndex].mode)}`;
  }

  function routeLabel(solution) {
    if (!solution) return "Calculating";
    if (!solution.exact) return "Still searching";
    return `${solution.moves.length} move${solution.moves.length === 1 ? "" : "s"}`;
  }

  function setBestPossible(index, solution) {
    if (!solution?.exact) return;
    window.TUMBLEBLOCK_BEST_POSSIBLE[index] = solution.moves.length;
    window.TUMBLEBLOCK_UPDATE_RECORD_STRIP?.();
  }

  function showStepHint() {
    if (!currentSolution?.exact) {
      clueCopy.textContent = currentSolution
        ? `Searched ${currentSolution.visited.toLocaleString()} boards without finishing yet.`
        : "Finding the cleanest path.";
      return;
    }
    if (!currentSolution.moves.length) {
      clueCopy.textContent = "This board is already matched.";
      return;
    }
    const step = Math.min(clueStep, currentSolution.moves.length - 1);
    clueCopy.textContent = `${step + 1}/${currentSolution.moves.length}: ${moveText(currentSolution.moves[step])}`;
  }

  function updateHushState() {
    const used = hasUsedHush(levelIndex);
    showHush.disabled = used || !currentSolution?.exact || !currentSolution.moves.length || won || !!animation;
    showHush.textContent = used ? "Already Used" : "Hush Mode";
    hushControls.classList.remove("show");
  }

  async function refreshClues() {
    const level = levels[levelIndex];
    currentSolution = null;
    perfectRoute.textContent = "Calculating";
    currentRoute.textContent = "Calculating";
    clueCopy.textContent = "Finding the cleanest path.";
    nextClue.disabled = true;
    updateHushState();

    const startName = `start:${levelIndex}:${stateKey(level.start, level.mode)}`;
    const hereName = currentCacheName("here");
    const [perfect, here] = await Promise.all([
      solveState(level, level.start, startName),
      solveState(level, cubes, hereName),
    ]);
    if (level !== levels[levelIndex]) return;

    currentSolution = here;
    clueStep = 0;
    setBestPossible(levelIndex, perfect);
    perfectRoute.textContent = routeLabel(perfect);
    currentRoute.textContent = routeLabel(here);
    showStepHint();
    nextClue.disabled = !here.exact || !here.moves.length;
    updateHushState();
  }

  function boardOffset() {
    const realMins = [0, 1, 2].map(axis => Math.min(...cubes.map(cube => cube.pos[axis])));
    return realMins;
  }

  function sameCube(real, source, mode) {
    if (!eq(real.pos, source.pos)) return false;
    if (mode === "solid" && (real.color || 0) !== source.color) return false;
    if (mode === "faces" && !eq(real.orient, source.orient)) return false;
    return true;
  }

  function liveMoveFrom(move) {
    const mode = levels[levelIndex].mode;
    const offset = boardOffset();
    const source = {
      pos: move.source.map((value, axis) => value + offset[axis]),
      color: move.sourceColor || 0,
      orient: move.sourceOrient || [0, 1, 2, 3, 4, 5],
    };
    const index = cubes.findIndex(cube => sameCube(cube, source, mode) || eq(cube.pos, source.pos));
    if (index < 0) return null;
    const destination = move.destination.map((value, axis) => value + offset[axis]);
    if (move.type === "slide") return { index, destination, type: "slide", duration: 180, sound: "slide" };

    const candidate = clone(move.candidate);
    candidate.destination = destination;
    candidate.path = candidate.path.map(step => ({
      ...step,
      destination: step.destination.map((value, axis) => value + offset[axis]),
      pivot: step.pivot.map((value, axis) => value + offset[axis]),
    }));
    return {
      index,
      destination,
      path: candidate.path,
      turns: candidate.turns,
      orient: orientationAfter(cubes[index], candidate),
      type: "roll",
      duration: candidate.turns === 2 ? 440 : 280,
      sound: "roll",
    };
  }

  function animateSolutionMove(move, speed) {
    const liveMove = liveMoveFrom(move);
    if (!liveMove) return Promise.resolve(false);
    liveMove.duration = Math.max(80, liveMove.duration / speed);
    return new Promise(resolve => {
      const duration = liveMove.duration;
      if (!animateMove(liveMove)) return resolve(false);
      setTimeout(() => resolve(true), duration + 40);
    });
  }

  async function playHush(speed) {
    if (!currentSolution?.exact || !currentSolution.moves.length || hasUsedHush(levelIndex)) return;
    setHushUsed(levelIndex);
    dialog.close();
    showMessage("Hush mode");
    for (const move of currentSolution.moves) {
      if (won) break;
      const moved = await animateSolutionMove(move, speed);
      if (!moved) break;
    }
    updateHushState();
  }

  async function warmAllSolutions() {
    if (allWarmStarted) return;
    allWarmStarted = true;
    for (let index = 0; index < levels.length; index++) {
      const level = levels[index];
      const solution = await solveState(level, level.start, `start:${index}:${stateKey(level.start, level.mode)}`);
      setBestPossible(index, solution);
      if (index === levelIndex && dialog.open) refreshClues();
    }
  }

  const baseLoadLevel = loadLevel;
  loadLevel = function(index) {
    const result = baseLoadLevel(index);
    currentSolution = null;
    return result;
  };

  const baseCommitMove = commitMove;
  commitMove = function() {
    const result = baseCommitMove();
    if (dialog.open) refreshClues();
    return result;
  };

  const baseBuildLevelGrid = buildLevelGrid;
  buildLevelGrid = function() {
    baseBuildLevelGrid();
    [...ui.levelGrid.querySelectorAll("button")].forEach((button, index) => {
      const level = levels[index];
      const solution = solutionCache.get(`start:${index}:${stateKey(level.start, level.mode)}`);
      if (!solution?.exact) return;
      const summary = document.createElement("small");
      summary.className = "level-score";
      summary.textContent = `best ${solution.moves.length}`;
      button.append(summary);
    });
  };

  clueButton.onclick = () => {
    dialog.showModal();
    refreshClues();
    warmAllSolutions();
  };
  document.querySelector("#close-clues").onclick = () => dialog.close();
  nextClue.onclick = () => {
    if (!currentSolution?.moves.length) return;
    clueStep = Math.min(clueStep + 1, currentSolution.moves.length - 1);
    showStepHint();
  };
  showHush.onclick = () => {
    hushControls.classList.toggle("show");
    if (hushControls.classList.contains("show")) {
      clueCopy.textContent = "Hush mode plays the route once for this level. Faster playback costs fewer clue credits.";
    } else showStepHint();
  };
  hushControls.addEventListener("click", event => {
    const speed = Number(event.target?.dataset?.hushSpeed);
    if (speed) playHush(speed);
  });

  setTimeout(warmAllSolutions, 700);
})();
