//@@BANNER@@ levels-controls.js
//@@BANNER@@ Extra level definitions and the level-picker thumbnails.
//@@BANNER@@ Consolidated from: extra-levels-controls.js, level-thumbnails-controls.js
//@@BANNER@@
//@@BANNER@@ ===== extra-levels-controls.js =====
(() => {
  function orientationAfter(cube, candidate) {
    let orientation = [...cube.orient];
    for (const step of candidate.path) for (let turn = 0; turn < step.turns; turn++) {
      const turned = [...orientation];
      DIRS.forEach((direction, oldIndex) => { turned[dirIndex(rotateDirection(direction, step.axis))] = orientation[oldIndex]; });
      orientation = turned;
    }
    return orientation;
  }
  function applyCandidate(index, candidate) { cubes[index].pos = [...candidate.destination]; cubes[index].orient = orientationAfter(cubes[index], candidate); }
  function stateKey(cluster) { return cluster.map(cube => `${k(cube.pos)}:${k(cube.orient)}`).join("|"); }
  function puzzleKey(cluster, mode) {
    const mins = [0,1,2].map(axis => Math.min(...cluster.map(cube => cube.pos[axis])));
    return cluster.map(cube => ({ pos: cube.pos.map((n, axis) => n - mins[axis]), color: mode === "solid" ? cube.color : 0, orient: mode === "faces" ? cube.orient : [] }))
      .sort((a,b) => k(a.pos).localeCompare(k(b.pos)) || a.color-b.color || k(a.orient).localeCompare(k(b.orient)))
      .map(cube => `${k(cube.pos)}:${cube.color}:${k(cube.orient)}`).join("|");
  }
  function scramble(target, steps, seed, mode) {
    const savedCubes = cubes; cubes = clone(target); const history = [clone(cubes)]; const visited = new Set([stateKey(cubes)]);
    for (let step = 0; step < steps; step++) {
      const options = [];
      cubes.forEach((cube,index) => rollCandidates(index).filter(candidate => candidate.turns === 1).forEach(candidate => {
        const before = clone(cubes); applyCandidate(index,candidate); const key = stateKey(cubes); cubes = before; options.push({index,candidate,key});
      }));
      if (!options.length) throw new Error(`Unable to generate level state at step ${step}, seed ${seed}: ${stateKey(target)}`);
      const previousKey = history.length > 1 ? stateKey(history[history.length-2]) : "";
      const fresh = options.filter(option => !visited.has(option.key)); const forward = options.filter(option => option.key !== previousKey); const choices = fresh.length ? fresh : forward.length ? forward : options;
      choices.sort((a,b) => `${a.index}:${k(a.candidate.destination)}`.localeCompare(`${b.index}:${k(b.candidate.destination)}`));
      const choice = choices[(seed + step * 7) % choices.length]; applyCandidate(choice.index,choice.candidate); visited.add(choice.key); history.push(clone(cubes));
    }
    if (puzzleKey(cubes,mode) === puzzleKey(target,mode)) {
      const options = [];
      cubes.forEach((cube,index) => rollCandidates(index).filter(candidate => candidate.turns === 1).forEach(candidate => {
        const before = clone(cubes); applyCandidate(index,candidate); if (puzzleKey(cubes,mode) !== puzzleKey(target,mode)) options.push({index,candidate}); cubes = before;
      }));
      if (!options.length) throw new Error(`Unable to produce an unsolved start, seed ${seed}`);
      const choice = options[seed % options.length]; applyCandidate(choice.index,choice.candidate); history.push(clone(cubes));
    }
    const start = clone(cubes);
    for (let step = history.length - 2; step >= 0; step--) {
      const previous = history[step]; const movedIndex = cubes.findIndex((cube,index) => !eq(cube.pos,previous[index].pos));
      const reverse = rollCandidates(movedIndex).filter(candidate => candidate.turns === 1 && eq(candidate.destination,previous[movedIndex].pos)).find(candidate => eq(orientationAfter(cubes[movedIndex],candidate),previous[movedIndex].orient));
      if (!reverse) throw new Error("Generated level is not reversible"); applyCandidate(movedIndex,reverse);
    }
    if (stateKey(cubes) !== stateKey(target)) throw new Error("Generated level failed validation"); cubes = savedCubes; return start;
  }
  const solid = (title,target,steps,seed,limit) => ({title,mode:"solid",start:scramble(target,steps,seed,"solid"),target,...(limit?{limit}:{})});
  const faces = (title,target,steps,seed,limit) => ({title,mode:"faces",start:scramble(target,steps,seed,"faces"),target,limit});
  levels.push(
    solid("Solid Steps",[p(0,0,0,0),p(1,0,0,1),p(1,0,1,2)],4,2),
    solid("Color Bridge",[p(0,0,0,0),p(1,0,0,1),p(1,1,0,2),p(2,1,0,3)],5,5),
    solid("Stack Exchange",[p(0,0,0,0),p(0,0,1,1),p(0,0,2,2),p(1,0,0,3)],6,9,9),
    solid("Five Corners",[p(0,0,0,0),p(1,0,0,1),p(1,1,0,2),p(1,0,1,3),p(2,0,0,4)],7,13,11),
    solid("Painted Arch",[p(0,0,0,0),p(1,0,0,1),p(0,1,0,2),p(1,1,0,3),p(2,1,0,4)],8,17,12),
    solid("Six Steps",[p(0,0,0,0),p(1,0,0,1),p(1,0,1,2),p(2,0,1,3),p(2,0,2,4),p(2,1,1,5)],9,21,14),
    solid("Color Spiral",[p(0,0,0,0),p(1,0,0,1),p(1,1,0,2),p(1,1,1,3),p(0,1,1,4),p(0,1,2,5)],10,25,15),
    solid("Color Fortress",[p(0,0,0,0),p(1,0,0,1),p(0,1,0,2),p(1,1,0,3),p(0,0,1,4),p(1,1,1,5)],12,29,18),
    faces("Face Turn",[p(0,0,0),p(1,0,0),p(1,1,0),p(1,0,1)],5,31,8),
    faces("Face Staircase",[p(0,0,0),p(1,0,0),p(1,0,1),p(2,0,1),p(2,1,1)],7,35,11),
    faces("Prism Lock",[p(0,0,0),p(1,0,0),p(1,1,0),p(1,1,1),p(2,1,1),p(2,1,0)],9,39,14),
    faces("Master Tumble",[p(0,0,0),p(1,0,0),p(1,1,0),p(1,1,1),p(2,1,1),p(2,0,1),p(2,0,2)],12,43,18)
  );
  const savedLevel = window.TUMBLEBLOCK_SAVED_LEVEL || 0;
  if (savedLevel > levelIndex && savedLevel <= unlocked && savedLevel < levels.length) loadLevel(savedLevel);
})();
//@@BANNER@@
//@@BANNER@@ ===== level-thumbnails-controls.js =====
(() => {
  function drawThumbnail(canvas, level) {
    const context = canvas.getContext("2d");
    const width = canvas.width = 150;
    const height = canvas.height = 90;
    const scale = Math.min(22, 65 / bounds(level.target).span);
    const iso = position => ({
      x: (position[0] - position[1]) * scale,
      y: (position[0] + position[1]) * scale * .5 - position[2] * scale,
    });
    const centers = level.target.map(cube => iso(cube.pos.map(n => n + .5)));
    const offset = {
      x: width / 2 - (Math.min(...centers.map(point => point.x)) + Math.max(...centers.map(point => point.x))) / 2,
      y: height / 2 - (Math.min(...centers.map(point => point.y)) + Math.max(...centers.map(point => point.y))) / 2,
    };
    const point = position => {
      const projected = iso(position);
      return [projected.x + offset.x, projected.y + offset.y];
    };
    const occupied = new Set(level.target.map(cube => k(cube.pos)));
    const faces = [];
    const visible = [[0,0,1], [1,0,0], [0,1,0]];

    level.target.forEach(cube => visible.forEach(normal => {
      if (occupied.has(k(add(cube.pos, normal)))) return;
      const axis = normal.findIndex(value => value);
      const others = [0,1,2].filter(i => i !== axis);
      const poly = [[0,0], [1,0], [1,1], [0,1]].map(pair => {
        const vertex = [...cube.pos];
        vertex[axis] += 1;
        vertex[others[0]] += pair[0];
        vertex[others[1]] += pair[1];
        return point(vertex);
      });
      faces.push({ cube, normal, poly, depth: cube.pos[0] + cube.pos[1] + cube.pos[2] + normal[axis] * .5 });
    }));

    faces.sort((a, b) => a.depth - b.depth);
    faces.forEach(face => {
      context.beginPath();
      face.poly.forEach(([x,y], i) => i ? context.lineTo(x,y) : context.moveTo(x,y));
      context.closePath();
      context.fillStyle = faceColor(face.cube, face.normal, level.mode);
      context.fill();
      context.strokeStyle = "#202020";
      context.lineWidth = 1.5;
      context.lineJoin = "round";
      context.stroke();
    });
  }

  buildLevelGrid = function() {
    ui.levelGrid.innerHTML = "";
    levels.forEach((level, index) => {
      const button = document.createElement("button");
      const thumbnail = document.createElement("canvas");
      const label = document.createElement("span");
      thumbnail.className = "level-thumbnail";
      label.textContent = `${index + 1} - ${level.title}`;
      button.title = level.title;
      button.classList.toggle("current", index === levelIndex);
      button.append(thumbnail, label);
      button.onclick = () => { ui.levelDialog.close(); loadLevel(index); };
      ui.levelGrid.append(button);
      drawThumbnail(thumbnail, level);
    });
  };
})();
