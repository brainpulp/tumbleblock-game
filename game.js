const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const ui = {
  title: document.querySelector("#level-title"),
  level: document.querySelector("#level-number"),
  moves: document.querySelector("#moves"),
  limit: document.querySelector("#limit"),
  message: document.querySelector("#message"),
  levelDialog: document.querySelector("#level-dialog"),
  levelGrid: document.querySelector("#level-grid"),
  resultDialog: document.querySelector("#result-dialog"),
  resultTitle: document.querySelector("#result-title"),
  resultCopy: document.querySelector("#result-copy"),
};

const DIRS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0],
  [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
const FACE_COLORS = ["#ff315b", "#ff9f1c", "#2ec4b6", "#8b5cf6", "#ffe83f", "#1687ff"];
const SOLID_COLORS = ["#ff315b", "#1687ff", "#ffe83f", "#2ec4b6", "#ff9f1c", "#8b5cf6"];
const NEUTRAL = ["#ff6b83", "#ff8aa0", "#ffb0be", "#ffc8d1", "#ff7890", "#ffe0e5"];
const VIEWS = [
  { right: [1, -1, 0], up: [-1, -1, 2], depth: [1, 1, 1] },
  { right: [0, 1, -1], up: [2, -1, -1], depth: [1, 1, 1] },
  { right: [-1, 0, 1], up: [-1, 2, -1], depth: [1, 1, 1] },
  { right: [-1, 1, 0], up: [1, 1, 2], depth: [-1, -1, 1] },
  { right: [0, -1, 1], up: [2, 1, 1], depth: [1, -1, -1] },
  { right: [1, 0, -1], up: [1, 2, 1], depth: [-1, 1, -1] },
];

const p = (x, y, z, color = 0, orient = null) => ({
  pos: [x, y, z], color,
  orient: orient || [0, 1, 2, 3, 4, 5],
});
const clone = value => JSON.parse(JSON.stringify(value));
const k = v => v.join(",");
const add = (a, b) => a.map((n, i) => n + b[i]);
const sub = (a, b) => a.map((n, i) => n - b[i]);
const dot = (a, b) => a.reduce((s, n, i) => s + n * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const neg = a => a.map(n => -n);
const eq = (a, b) => k(a) === k(b);
const dirIndex = d => DIRS.findIndex(x => eq(x, d));

const levels = [
  { title: "First Push", mode: "plain", hint: "Click the outside face of the end cube.", start: [p(0,0,0),p(1,0,0),p(0,1,0)], target: [p(0,0,0),p(1,0,0),p(1,1,0)] },
  { title: "Around the Corner", mode: "plain", hint: "Drag a cube to tumble it around its neighbor.", start: [p(0,0,0),p(1,0,0),p(1,1,0)], target: [p(0,0,0),p(1,0,0),p(1,0,1)] },
  { title: "Little Stair", mode: "plain", start: [p(0,0,0),p(1,0,0),p(2,0,0)], target: [p(0,0,0),p(1,0,0),p(1,0,1)] },
  { title: "Four Square", mode: "plain", start: [p(0,0,0),p(1,0,0),p(2,0,0),p(2,1,0)], target: [p(0,0,0),p(1,0,0),p(0,1,0),p(1,1,0)] },
  { title: "High Five", mode: "plain", start: [p(0,0,0),p(1,0,0),p(2,0,0),p(2,1,0),p(2,2,0)], target: [p(0,0,0),p(1,0,0),p(1,1,0),p(1,0,1),p(2,0,1)] },
  { title: "Color Order", mode: "solid", start: [p(0,0,0,0),p(1,0,0,1),p(1,1,0,2)], target: [p(0,0,0,1),p(1,0,0,0),p(1,1,0,2)] },
  { title: "Traffic Light", mode: "solid", start: [p(0,0,0,2),p(1,0,0,0),p(2,0,0,1)], target: [p(0,0,0,0),p(0,0,1,1),p(0,0,2,2)] },
  { title: "Color Corner", mode: "solid", start: [p(0,0,0,0),p(1,0,0,1),p(2,0,0,2),p(2,1,0,3)], target: [p(0,0,0,0),p(1,0,0,1),p(1,1,0,2),p(1,1,1,3)] },
  { title: "Face Value", mode: "faces", start: [p(0,0,0),p(1,0,0),p(1,1,0)], target: [p(0,0,0),p(1,0,0),p(1,0,1,0,[4,5,2,3,1,0])] },
  { title: "True Colors", mode: "faces", start: [p(0,0,0),p(1,0,0),p(2,0,0),p(2,1,0)], target: [p(0,0,0),p(1,0,0),p(1,1,0,0,[0,1,4,5,3,2]),p(1,1,1,0,[4,5,2,3,1,0])] },
  { title: "Under Twelve", mode: "solid", limit: 12, start: [p(0,0,0,0),p(1,0,0,1),p(2,0,0,2),p(2,1,0,3)], target: [p(0,0,0,3),p(0,1,0,2),p(0,1,1,1),p(0,1,2,0)] },
  { title: "Exacting", mode: "faces", limit: 16, start: [p(0,0,0),p(1,0,0),p(2,0,0),p(2,1,0),p(2,2,0)], target: [p(0,0,0),p(1,0,0),p(1,1,0,0,[0,1,4,5,3,2]),p(1,1,1,0,[4,5,2,3,1,0]),p(2,1,1)] },
];

let levelIndex = Number(localStorage.getItem("tumbleblock-level") || 0);
let unlocked = Number(localStorage.getItem("tumbleblock-unlocked") || 0);
levelIndex = Math.min(levelIndex, unlocked, levels.length - 1);
let cubes = [];
let moves = 0;
let viewIndex = 0;
let hitFaces = [];
let pointer = null;
let shakeUntil = 0;
let messageTimer = 0;
let won = false;
let animation = null;
let cameraAnimation = null;
let audio = null;

function loadLevel(index) {
  levelIndex = index;
  cubes = clone(levels[index].start);
  moves = 0;
  won = false;
  animation = null;
  cameraAnimation = null;
  ui.resultDialog.close();
  localStorage.setItem("tumbleblock-level", index);
  updateUI();
  render();
}

function updateUI() {
  const level = levels[levelIndex];
  ui.title.textContent = level.title;
  ui.level.textContent = levelIndex + 1;
  ui.moves.textContent = moves;
  ui.limit.textContent = level.limit ? ` / ${level.limit}` : "";
}

function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

function scaledUnit(v, length) {
  const magnitude = Math.hypot(...v) || 1;
  return v.map(n => n / magnitude * length);
}

function currentView(now = performance.now()) {
  if (!cameraAnimation) return VIEWS[viewIndex];
  const raw = Math.min(1, (now - cameraAnimation.started) / cameraAnimation.duration);
  const t = raw * raw * (3 - 2 * raw);
  const from = VIEWS[cameraAnimation.from], to = VIEWS[cameraAnimation.to];
  const mix = key => from[key].map((n, i) => n + (to[key][i] - n) * t);
  return {
    right: scaledUnit(mix("right"), Math.sqrt(2)),
    up: scaledUnit(mix("up"), Math.sqrt(6)),
    depth: scaledUnit(mix("depth"), Math.sqrt(3)),
  };
}

function project(v, origin, scale, now = performance.now()) {
  const view = currentView(now);
  return {
    x: origin.x + dot(v, view.right) * scale / Math.sqrt(2),
    y: origin.y - dot(v, view.up) * scale / Math.sqrt(6),
    depth: dot(v, view.depth),
  };
}

function polygonForFace(pos, normal, origin, scale, now) {
  const axis = normal.findIndex(n => n !== 0);
  const others = [0,1,2].filter(i => i !== axis);
  const points = [[-1,-1], [1,-1], [1,1], [-1,1]].map(pair => {
    const v = pos.map(n => n);
    v[axis] += normal[axis] > 0 ? 1 : 0;
    v[others[0]] += pair[0] > 0 ? 1 : 0;
    v[others[1]] += pair[1] > 0 ? 1 : 0;
    return project(v, origin, scale, now);
  });
  const area = points.reduce((s, point, i) => {
    const next = points[(i + 1) % points.length];
    return s + point.x * next.y - next.x * point.y;
  }, 0);
  return area < 0 ? points.reverse() : points;
}

function faceColor(cube, normal, mode) {
  if (mode === "plain") return NEUTRAL[dirIndex(normal)];
  if (mode === "solid") return SOLID_COLORS[cube.color % SOLID_COLORS.length];
  return FACE_COLORS[cube.orient[dirIndex(normal)]];
}

function animatedCube(cube, cubeIndex, now, animate) {
  if (!animate || !animation || animation.index !== cubeIndex) return cube;
  const raw = Math.min(1, (now - animation.started) / animation.duration);
  const t = raw * raw * (3 - 2 * raw);
  let pos = cube.pos.map((n, i) => n + (animation.destination[i] - n) * t);
  if (animation.type === "roll") {
    const center = add(animation.pivot, rotateVector(animation.from, animation.axis, t * animation.turns * Math.PI / 2));
    pos = center.map(n => n - .5);
  }
  return { ...cube, pos, visualRotation: animation.type === "roll" ? { axis: animation.axis, angle: t * animation.turns * Math.PI / 2 } : null };
}

function rotateVector(v, axis, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const c = cross(axis, v);
  return v.map((n, i) => n * cos + c[i] * sin + axis[i] * dot(axis, v) * (1 - cos));
}

function polygonForAnimatedFace(cube, normal, origin, scale, now) {
  const axis = normal.findIndex(n => n !== 0);
  const others = [0,1,2].filter(i => i !== axis);
  const center = cube.pos.map(n => n + .5);
  return [[-1,-1], [1,-1], [1,1], [-1,1]].map(pair => {
    const local = [-.5, -.5, -.5];
    local[axis] = normal[axis] * .5;
    local[others[0]] = pair[0] * .5;
    local[others[1]] = pair[1] * .5;
    const rotated = cube.visualRotation ? rotateVector(local, cube.visualRotation.axis, cube.visualRotation.angle) : local;
    return project(add(center, rotated), origin, scale, now);
  });
}

function drawCluster(cluster, origin, scale, mode, interactive, now = performance.now(), animate = false) {
  const occupied = new Set(cluster.map((c, i) => animate && i === animation?.index ? "" : k(c.pos)));
  const faces = [];
  cluster.forEach((cube, cubeIndex) => {
    const visual = animatedCube(cube, cubeIndex, now, animate);
    DIRS.forEach(normal => {
      if (!visual.visualRotation && occupied.has(k(add(cube.pos, normal)))) return;
      const visualNormal = visual.visualRotation
        ? rotateVector(normal, visual.visualRotation.axis, visual.visualRotation.angle)
        : normal;
      if (visual.visualRotation && dot(visualNormal, currentView(now).depth) <= 0) return;
      const poly = visual.visualRotation
        ? polygonForAnimatedFace(visual, normal, origin, scale, now)
        : polygonForFace(visual.pos, normal, origin, scale, now);
      const center = add(visual.pos, visualNormal.map(n => n * .5));
      faces.push({ cube, cubeIndex, normal, poly, depth: dot(center, currentView(now).depth) });
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
}

function bounds(cluster) {
  const xs = cluster.map(c => c.pos[0]), ys = cluster.map(c => c.pos[1]), zs = cluster.map(c => c.pos[2]);
  return { span: Math.max(Math.max(...xs)-Math.min(...xs), Math.max(...ys)-Math.min(...ys), Math.max(...zs)-Math.min(...zs)) + 1 };
}

function render() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  ctx.clearRect(0, 0, w, h);
  hitFaces = [];
  const level = levels[levelIndex];
  const shake = performance.now() < shakeUntil ? Math.sin(performance.now() * .09) * 3 : 0;
  const targetScale = Math.min(w * .1, h * .075, 42) / Math.max(1, bounds(level.target).span / 3);
  const workScale = Math.min(w * .17, h * .12, 74) / Math.max(1, bounds(cubes).span / 4);
  const now = performance.now();
  drawCluster(level.target, { x: w / 2, y: h * .24 }, targetScale, level.mode, false, now);
  drawCluster(cubes, { x: w / 2 + shake, y: h * .65 }, workScale, level.mode, !animation, now, true);
  ctx.strokeStyle = "#d8d3c8";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  ctx.moveTo(w * .34, h * .39);
  ctx.lineTo(w * .66, h * .39);
  ctx.stroke();
  ctx.setLineDash([]);
  if (now < shakeUntil || animation || cameraAnimation) requestAnimationFrame(render);
}

function pointInPoly(point, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (((a.y > point.y) !== (b.y > point.y)) && point.x < (b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside = !inside;
  }
  return inside;
}

function topFree(cubeIndex) {
  const here = cubes[cubeIndex].pos;
  return !cubes.some((c, i) => i !== cubeIndex && c.pos[2] > here[2] && c.pos[0] === here[0] && c.pos[1] === here[1]);
}

function connectedWithout(index) {
  const left = cubes.filter((_, i) => i !== index);
  if (left.length < 2) return true;
  const seen = new Set([k(left[0].pos)]);
  const queue = [left[0].pos];
  while (queue.length) {
    const pos = queue.shift();
    for (const d of DIRS) {
      const next = k(add(pos, d));
      if (!seen.has(next) && left.some(c => k(c.pos) === next)) {
        seen.add(next); queue.push(add(pos, d));
      }
    }
  }
  return seen.size === left.length;
}

function validDestination(index, destination) {
  if (!topFree(index) || !connectedWithout(index)) return false;
  if (cubes.some((c, i) => i !== index && eq(c.pos, destination))) return false;
  return cubes.some((c, i) => i !== index && DIRS.some(d => eq(add(destination, d), c.pos)));
}

function doSlide(face) {
  const destination = add(face.cube.pos, neg(face.normal));
  if (!validDestination(face.cubeIndex, destination)) return blocked();
  animateMove({ index: face.cubeIndex, destination, type: "slide", duration: 180, sound: "slide" });
}

function rotateDirection(v, axis) {
  const c = cross(axis, v);
  return c.map((n, i) => n + axis[i] * dot(axis, v));
}

function rollCandidates(index) {
  const cube = cubes[index];
  const occupied = new Set(cubes.filter((_, i) => i !== index).map(c => k(c.pos)));
  const candidates = [];
  for (const neighbor of cubes) {
    if (neighbor === cube) continue;
    const from = sub(cube.pos, neighbor.pos);
    if (!DIRS.some(d => eq(d, from))) continue;
    for (const to of DIRS) {
      if (dot(from, to) !== 0) continue;
      const destination = add(neighbor.pos, to);
      if (occupied.has(k(destination)) || !validDestination(index, destination)) continue;
      const axis = cross(from, to);
      const pivot = neighbor.pos.map(n => n + .5);
      candidates.push({ destination, axis, from, pivot, turns: 1, screen: subScreen(destination, cube.pos) });

      const opposite = add(neighbor.pos, neg(from));
      if (!occupied.has(k(opposite)) && validDestination(index, opposite)) {
        candidates.push({
          destination: opposite,
          axis,
          from,
          pivot,
          turns: 2,
          screen: subScreen(destination, cube.pos),
        });
      }
    }
  }
  return candidates;
}

function subScreen(a, b) {
  const pa = project(a, {x:0,y:0}, 60), pb = project(b, {x:0,y:0}, 60);
  return [pa.x-pb.x, pa.y-pb.y];
}

function doRoll(index, drag) {
  const length = Math.hypot(...drag);
  if (length < 12) return false;
  const candidates = rollCandidates(index);
  let best = null, bestScore = .42;
  for (const candidate of candidates) {
    if (candidate.turns === 2 && length < 64) continue;
    const len = Math.hypot(...candidate.screen);
    const score = dot(drag, candidate.screen) / (length * len);
    const longTurnBonus = candidate.turns === 2 && length > 120 ? .35 : -.12;
    if (score + longTurnBonus > bestScore) {
      best = candidate;
      bestScore = score + longTurnBonus;
    }
  }
  if (!best) return blocked();
  const cube = cubes[index];
  let nextOrient = [...cube.orient];
  for (let turn = 0; turn < best.turns; turn++) {
    const turned = [...nextOrient];
    DIRS.forEach((worldDir, oldWorldIndex) => {
      const newWorldIndex = dirIndex(rotateDirection(worldDir, best.axis));
      turned[newWorldIndex] = nextOrient[oldWorldIndex];
    });
    nextOrient = turned;
  }
  animateMove({
    index,
    destination: best.destination,
    axis: best.axis,
    from: best.from,
    pivot: best.pivot,
    turns: best.turns,
    orient: nextOrient,
    type: "roll",
    duration: best.turns === 2 ? 440 : 280,
    sound: "roll",
  });
  return true;
}

function animateMove(move) {
  if (animation) return false;
  animation = { ...move, started: performance.now() };
  playSound(move.sound);
  render();
  setTimeout(() => {
    const cube = cubes[move.index];
    cube.pos = move.destination;
    if (move.orient) cube.orient = move.orient;
    animation = null;
    commitMove();
  }, move.duration);
  return true;
}

function playSound(type) {
  audio ||= new AudioContext();
  const now = audio.currentTime;
  const gain = audio.createGain();
  const oscillator = audio.createOscillator();
  gain.connect(audio.destination);
  oscillator.connect(gain);
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(type === "slide" ? .09 : .07, now + .008);
  gain.gain.exponentialRampToValueAtTime(.0001, now + (type === "slide" ? .11 : .28));
  oscillator.type = type === "slide" ? "triangle" : "sine";
  oscillator.frequency.setValueAtTime(type === "slide" ? 190 : 330, now);
  oscillator.frequency.exponentialRampToValueAtTime(type === "slide" ? 145 : 105, now + (type === "slide" ? .11 : .28));
  oscillator.start(now);
  oscillator.stop(now + (type === "slide" ? .12 : .3));
}

function moveCamera(next) {
  if (cameraAnimation || animation || next === viewIndex) return;
  const from = viewIndex;
  viewIndex = next;
  cameraAnimation = { from, to: next, started: performance.now(), duration: 320 };
  render();
  setTimeout(() => { cameraAnimation = null; render(); }, 320);
}

function blocked() {
  shakeUntil = performance.now() + 220;
  render();
  return false;
}

function normalizeCluster(cluster, includeOrientation) {
  const mins = [0,1,2].map(axis => Math.min(...cluster.map(c => c.pos[axis])));
  return cluster.map(c => ({
    pos: c.pos.map((n, i) => n - mins[i]),
    color: c.color,
    orient: includeOrientation ? c.orient : [],
  })).sort((a,b) => k(a.pos).localeCompare(k(b.pos)) || a.color-b.color || k(a.orient).localeCompare(k(b.orient)));
}

function isMatched() {
  const level = levels[levelIndex];
  const a = normalizeCluster(cubes, level.mode === "faces");
  const b = normalizeCluster(level.target, level.mode === "faces");
  if (a.length !== b.length) return false;
  return a.every((cube, i) => eq(cube.pos, b[i].pos) &&
    (level.mode === "plain" || cube.color === b[i].color) &&
    (level.mode !== "faces" || eq(cube.orient, b[i].orient)));
}

function commitMove() {
  moves++;
  updateUI();
  render();
  const limit = levels[levelIndex].limit;
  if (isMatched()) return completeLevel();
  if (limit && moves >= limit) {
    showMessage("Move limit reached");
    setTimeout(() => loadLevel(levelIndex), 700);
  }
}

function completeLevel() {
  won = true;
  unlocked = Math.max(unlocked, Math.min(levelIndex + 1, levels.length - 1));
  localStorage.setItem("tumbleblock-unlocked", unlocked);
  ui.resultTitle.textContent = levels[levelIndex].limit ? "Within the limit." : "Nicely shaped.";
  ui.resultCopy.textContent = `Solved in ${moves} move${moves === 1 ? "" : "s"}.`;
  document.querySelector("#next-level").textContent = levelIndex === levels.length - 1 ? "Play again" : "Next level";
  setTimeout(() => ui.resultDialog.showModal(), 250);
  buildLevelGrid();
}

function showMessage(text) {
  clearTimeout(messageTimer);
  ui.message.textContent = text;
  ui.message.classList.add("show");
  messageTimer = setTimeout(() => ui.message.classList.remove("show"), 1000);
}

function localPoint(event) {
  const r = canvas.getBoundingClientRect();
  return { x: event.clientX-r.left, y: event.clientY-r.top };
}

canvas.addEventListener("pointerdown", event => {
  if (animation || cameraAnimation) return;
  canvas.setPointerCapture(event.pointerId);
  const point = localPoint(event);
  const face = [...hitFaces].reverse().find(f => pointInPoly(point, f.poly));
  pointer = { start: point, face, time: performance.now() };
});

canvas.addEventListener("pointerup", event => {
  if (!pointer || won || animation || cameraAnimation) return;
  const end = localPoint(event);
  const drag = [end.x-pointer.start.x, end.y-pointer.start.y];
  const distance = Math.hypot(...drag);
  if (pointer.face) {
    if (distance < 10) doSlide(pointer.face);
    else doRoll(pointer.face.cubeIndex, drag);
  } else if (distance > 18) {
    if (Math.abs(drag[0]) > Math.abs(drag[1])) moveCamera((viewIndex + (drag[0] > 0 ? 1 : 5)) % 6);
    else moveCamera((viewIndex + (drag[1] > 0 ? 2 : 4)) % 6);
  }
  pointer = null;
});

function buildLevelGrid() {
  ui.levelGrid.innerHTML = "";
  levels.forEach((level, i) => {
    const button = document.createElement("button");
    button.textContent = i + 1;
    button.title = level.title;
    button.disabled = i > unlocked;
    button.classList.toggle("current", i === levelIndex);
    button.onclick = () => { ui.levelDialog.close(); loadLevel(i); };
    ui.levelGrid.append(button);
  });
}

document.querySelector("#restart").onclick = () => loadLevel(levelIndex);
document.querySelector("#levels").onclick = () => { buildLevelGrid(); ui.levelDialog.showModal(); };
document.querySelector("#close-levels").onclick = () => ui.levelDialog.close();
document.querySelector("#next-level").onclick = () => loadLevel(levelIndex === levels.length - 1 ? levelIndex : levelIndex + 1);
window.addEventListener("resize", resize);

loadLevel(levelIndex);
resize();
