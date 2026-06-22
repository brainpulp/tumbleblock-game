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
let audio = null;
let cameraSnap = null;

// ---- Camera orientation as a quaternion [w, x, y, z] ----------------------
// The camera frame (right/up/depth, all in world space) is derived by rotating
// the basis axes by camQuat. World axes never move; only the camera orbits.
const qMul = (a, b) => [
  a[0]*b[0] - a[1]*b[1] - a[2]*b[2] - a[3]*b[3],
  a[0]*b[1] + a[1]*b[0] + a[2]*b[3] - a[3]*b[2],
  a[0]*b[2] - a[1]*b[3] + a[2]*b[0] + a[3]*b[1],
  a[0]*b[3] + a[1]*b[2] - a[2]*b[1] + a[3]*b[0],
];
const qLen = q => Math.hypot(q[0], q[1], q[2], q[3]) || 1;
const qNorm = q => q.map(n => n / qLen(q));
const qDot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
const qFromAxis = (axis, angle) => {
  const m = Math.hypot(...axis) || 1, h = angle / 2, s = Math.sin(h) / m;
  return [Math.cos(h), axis[0]*s, axis[1]*s, axis[2]*s];
};
// Rotate world vector v by quaternion q.
const qRot = (q, v) => {
  const [w, x, y, z] = q;
  const t = [2*(y*v[2]-z*v[1]), 2*(z*v[0]-x*v[2]), 2*(x*v[1]-y*v[0])];
  return [
    v[0] + w*t[0] + (y*t[2]-z*t[1]),
    v[1] + w*t[1] + (z*t[0]-x*t[2]),
    v[2] + w*t[2] + (x*t[1]-y*t[0]),
  ];
};
const qSlerp = (a, b, t) => {
  let d = qDot(a, b);
  if (d < 0) { b = b.map(n => -n); d = -d; }
  if (d > 0.9995) return qNorm(a.map((n, i) => n + (b[i] - n) * t));
  const theta = Math.acos(Math.min(1, d)), s = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / s, wb = Math.sin(t * theta) / s;
  return a.map((n, i) => n * wa + b[i] * wb);
};
const norm3 = v => { const m = Math.hypot(...v) || 1; return v.map(n => n / m); };

// Quaternion from a 3x3 rotation matrix (rows). The matrix must be a proper
// rotation (det +1); the projection frame itself is left-handed, so we never
// feed that frame in directly -- see frameRot below.
function matToQuat(m) {
  const tr = m[0][0] + m[1][1] + m[2][2];
  let q;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [s / 4, (m[2][1]-m[1][2]) / s, (m[0][2]-m[2][0]) / s, (m[1][0]-m[0][1]) / s];
  } else if (m[0][0] > m[1][1] && m[0][0] > m[2][2]) {
    const s = Math.sqrt(1 + m[0][0] - m[1][1] - m[2][2]) * 2;
    q = [(m[2][1]-m[1][2]) / s, s / 4, (m[0][1]+m[1][0]) / s, (m[0][2]+m[2][0]) / s];
  } else if (m[1][1] > m[2][2]) {
    const s = Math.sqrt(1 + m[1][1] - m[0][0] - m[2][2]) * 2;
    q = [(m[0][2]-m[2][0]) / s, (m[0][1]+m[1][0]) / s, s / 4, (m[1][2]+m[2][1]) / s];
  } else {
    const s = Math.sqrt(1 + m[2][2] - m[0][0] - m[1][1]) * 2;
    q = [(m[1][0]-m[0][1]) / s, (m[0][2]+m[2][0]) / s, (m[1][2]+m[2][1]) / s, s / 4];
  }
  return qNorm(q);
}

// The camera orientation is a proper rotation applied to this fixed isometric
// base frame (matches the old yaw=-45deg / iso-pitch start). Storing the
// rotation -- not the left-handed frame -- keeps the quaternion math valid.
const BASE_FRAME = { right: norm3([1, 1, 0]), up: norm3([1, -1, 2]), depth: norm3([-1, 1, 1]) };

// Rotation carrying BASE_FRAME onto another like-handed frame f: R = Fcols * Bcols^T.
function frameRot(f) {
  const B = BASE_FRAME, m = [[0,0,0],[0,0,0],[0,0,0]];
  const bc = [B.right, B.up, B.depth], fc = [f.right, f.up, f.depth];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
    m[i][j] = fc[0][i]*bc[0][j] + fc[1][i]*bc[1][j] + fc[2][i]*bc[2][j];
  return matToQuat(m);
}

// All isometric orientations: depth on a cube body diagonal with one world axis
// projecting straight up (both vertex-up and vertex-down). Snapping on release
// picks the nearest of these; arrow turns also land on one.
const ISO_TARGETS = (() => {
  const targets = [], seen = [];
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
    const depth = norm3([sx, sy, sz]);
    for (const axis of [[1,0,0],[0,1,0],[0,0,1]]) for (const sign of [1, -1]) {
      const proj = sub(axis, depth.map(n => n * dot(axis, depth)));
      if (Math.hypot(...proj) < 1e-6) continue;
      const up = norm3(proj).map(n => n * sign);
      const q = frameRot({ right: norm3(cross(depth, up)), up, depth });
      if (seen.some(s => Math.abs(qDot(s, q)) > 0.9999)) continue;
      seen.push(q);
      targets.push(q);
    }
  }
  return targets;
})();

const nearestIso = q => ISO_TARGETS.reduce(
  (best, t) => (Math.abs(qDot(t, q)) > Math.abs(qDot(best, q)) ? t : best),
  ISO_TARGETS[0],
);

let camQuat = [1, 0, 0, 0]; // identity rotation -> BASE_FRAME (the start view)

function loadLevel(index) {
  levelIndex = index;
  cubes = clone(levels[index].start);
  moves = 0;
  won = false;
  animation = null;
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

function currentView(now = performance.now()) {
  if (cameraSnap) {
    const raw = Math.min(1, (now - cameraSnap.started) / cameraSnap.duration);
    const t = raw * raw * (3 - 2 * raw);
    camQuat = qSlerp(cameraSnap.from, cameraSnap.to, t);
  }
  return {
    right: qRot(camQuat, BASE_FRAME.right),
    up: qRot(camQuat, BASE_FRAME.up),
    depth: qRot(camQuat, BASE_FRAME.depth),
  };
}

function project(v, origin, scale) {
  const view = currentView();
  return {
    x: origin.x + dot(v, view.right) * scale,
    y: origin.y - dot(v, view.up) * scale,
    depth: dot(v, view.depth),
  };
}

function polygonForFace(pos, normal, origin, scale) {
  const axis = normal.findIndex(n => n !== 0);
  const others = [0,1,2].filter(i => i !== axis);
  const points = [[-1,-1], [1,-1], [1,1], [-1,1]].map(pair => {
    const v = pos.map(n => n);
    v[axis] += normal[axis] > 0 ? 1 : 0;
    v[others[0]] += pair[0] > 0 ? 1 : 0;
    v[others[1]] += pair[1] > 0 ? 1 : 0;
    return project(v, origin, scale);
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
    const scaled = t * animation.path.length;
    const pathIndex = Math.min(animation.path.length - 1, Math.floor(scaled));
    const stepT = Math.min(1, scaled - pathIndex);
    const step = animation.path[pathIndex];
    const center = add(step.pivot, rotateVector(step.relative, step.axis, stepT * Math.PI / 2));
    pos = center.map(n => n - .5);
    const visualRotations = animation.path.slice(0, pathIndex).map(pathStep => ({ axis: pathStep.axis, angle: Math.PI / 2 }));
    visualRotations.push({ axis: step.axis, angle: stepT * Math.PI / 2 });
    return { ...cube, pos, visualRotations };
  }
  return { ...cube, pos, visualRotations: null };
}

function rotateVector(v, axis, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const c = cross(axis, v);
  return v.map((n, i) => n * cos + c[i] * sin + axis[i] * dot(axis, v) * (1 - cos));
}

function polygonForAnimatedFace(cube, normal, origin, scale) {
  const axis = normal.findIndex(n => n !== 0);
  const others = [0,1,2].filter(i => i !== axis);
  const center = cube.pos.map(n => n + .5);
  return [[-1,-1], [1,-1], [1,1], [-1,1]].map(pair => {
    const local = [-.5, -.5, -.5];
    local[axis] = normal[axis] * .5;
    local[others[0]] = pair[0] * .5;
    local[others[1]] = pair[1] * .5;
    const rotated = cube.visualRotations
      ? cube.visualRotations.reduce((vector, rotation) => rotateVector(vector, rotation.axis, rotation.angle), local)
      : local;
    return project(add(center, rotated), origin, scale);
  });
}

function drawCluster(cluster, origin, scale, mode, interactive, now = performance.now(), animate = false) {
  const occupied = new Set(cluster.map((c, i) => animate && i === animation?.index ? "" : k(c.pos)));
  const view = currentView();
  const ordered = cluster.map((cube, cubeIndex) => ({ cube, cubeIndex }))
    .sort((a, b) => dot(a.cube.pos.map(n => n + .5), view.depth) - dot(b.cube.pos.map(n => n + .5), view.depth));
  const faces = [];
  ordered.forEach(({ cube, cubeIndex }) => {
    const visual = animatedCube(cube, cubeIndex, now, animate);
    const cubeFaces = [];
    DIRS.forEach(normal => {
      if (!visual.visualRotations && occupied.has(k(add(cube.pos, normal)))) return;
      const visualNormal = visual.visualRotations
        ? visual.visualRotations.reduce((vector, rotation) => rotateVector(vector, rotation.axis, rotation.angle), normal)
        : normal;
      if (dot(visualNormal, view.depth) <= 0) return;
      const poly = visual.visualRotations
        ? polygonForAnimatedFace(visual, normal, origin, scale)
        : polygonForFace(visual.pos, normal, origin, scale);
      const center = add(visual.pos, visualNormal.map(n => n * .5));
      cubeFaces.push({ cube, cubeIndex, normal, poly, depth: dot(center, view.depth) });
    });
    cubeFaces.sort((a, b) => a.depth - b.depth);
    faces.push(...cubeFaces);
  });
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
  drawAxes(w, h);
  if (now < shakeUntil || animation || cameraSnap) requestAnimationFrame(render);
}

// Debug axis overlay: shows the world X (red), Y (green), Z (blue) axes under the
// current camera so we can see how they map to the screen. Only drawn in the
// Camera Debug level (window.TUMBLEBLOCK_SHOW_CAMERA_AXES). The axis that the
// vertical (up/down) arrow keys will currently rotate about is highlighted, so the
// "up/down alternates between axes" behaviour is visible live as you press keys.
function drawAxes(w, h) {
  if (!window.TUMBLEBLOCK_SHOW_CAMERA_AXES) return;
  const view = currentView();

  // The camera turns about exactly two world axes: Z (heading, left/right) and the
  // fixed tilt axis (up/down). Highlight the tilt axis so it reads live.
  const highlight = window.TUMBLEBLOCK_VMODE_LOCK_AXIS || [1, 0, 0];
  const tiltLabel = ["X", "Y", "Z"][[[1,0,0],[0,1,0],[0,0,1]].findIndex(a => eq(a, highlight))];
  const readout = `left/right turn about Z · up/down tilt about ${tiltLabel}`;

  const origin = { x: w / 2, y: h * 0.86 };
  const len = Math.min(w, h) * 0.09;
  const axes = [
    { dir: [1, 0, 0], color: "#e0473e", label: "X" },
    { dir: [0, 1, 0], color: "#3fae57", label: "Y" },
    { dir: [0, 0, 1], color: "#3f7fe0", label: "Z" },
  ];

  ctx.save();
  // faint reference ring
  ctx.strokeStyle = "rgba(58, 53, 44, .15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, len * 1.18, 0, Math.PI * 2);
  ctx.stroke();

  // draw far-to-near so nearer axes overlap correctly
  axes
    .map(a => ({ ...a, depth: dot(a.dir, view.depth), active: !!highlight && eq(a.dir, highlight) }))
    .sort((a, b) => a.depth - b.depth)
    .forEach(({ dir, color, label, active }) => {
      const sx = dot(dir, view.right), sy = dot(dir, view.up);
      const plus = { x: origin.x + sx * len, y: origin.y - sy * len };
      const minus = { x: origin.x - sx * len, y: origin.y + sy * len };
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineCap = "round";
      // negative half (dim)
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = active ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(minus.x, minus.y);
      ctx.stroke();
      // positive half (bright; thicker when this is the active vertical-turn axis)
      ctx.globalAlpha = 1;
      ctx.lineWidth = active ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(plus.x, plus.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(plus.x, plus.y, active ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (active) {
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(plus.x, plus.y, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, origin.x + sx * (len + 14), origin.y - sy * (len + 14));
    });

  // live readout
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#3a352c";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`camera debug · ${readout}`, origin.x, origin.y - len * 1.5);
  ctx.restore();
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
  return !cubes.some((c, i) => i !== cubeIndex && eq(c.pos, add(here, [0, 0, 1])));
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

function doSlide(face, clickPoint) {
  let destination = add(face.cube.pos, neg(face.normal));
  if (!validDestination(face.cubeIndex, destination)) {
    const workScale = Math.min(canvas.clientWidth * .17, canvas.clientHeight * .12, 74) / Math.max(1, bounds(cubes).span / 4);
    const center = project(face.cube.pos.map(n => n + .5), { x: canvas.clientWidth / 2, y: canvas.clientHeight * .65 }, workScale);
    const clickDirection = [clickPoint.x - center.x, clickPoint.y - center.y];
    const length = Math.hypot(...clickDirection);
    const legal = DIRS.map(direction => {
      const candidate = add(face.cube.pos, direction);
      const screen = subScreen(candidate, face.cube.pos);
      const score = length ? dot(clickDirection, screen) / (length * Math.hypot(...screen)) : -1;
      return { candidate, score };
    }).filter(move => validDestination(face.cubeIndex, move.candidate))
      .sort((a, b) => b.score - a.score);
    if (!legal[0] || legal[0].score < .25) return blocked();
    destination = legal[0].candidate;
  }
  animateMove({ index: face.cubeIndex, destination, type: "slide", duration: 180, sound: "slide" });
}

function rotateDirection(v, axis) {
  const c = cross(axis, v);
  return c.map((n, i) => n + axis[i] * dot(axis, v));
}

function rollCandidates(index) {
  const cube = cubes[index];
  const occupied = new Set(cubes.filter((_, i) => i !== index).map(c => k(c.pos)));
  const neighbors = cubes.filter((_, i) => i !== index);
  const stepsFrom = position => {
    const steps = [];
    for (const neighbor of neighbors) {
      const from = sub(position, neighbor.pos);
      if (!DIRS.some(d => eq(d, from))) continue;
      for (const to of DIRS) {
        if (dot(from, to) !== 0) continue;
        const destination = add(neighbor.pos, to);
        if (occupied.has(k(destination))) continue;
        const axis = cross(from, to);
        const neighborCenter = neighbor.pos.map(n => n + .5);
        const pivot = neighborCenter.map((n, i) => n + (from[i] + to[i]) * .5);
        const sourceCenter = position.map(n => n + .5);
        steps.push({ destination, axis, pivot, relative: sub(sourceCenter, pivot) });
      }
    }
    return steps;
  };
  const candidates = [];
  for (const first of stepsFrom(cube.pos)) {
    candidates.push({ destination: first.destination, turns: 1, path: [first], screen: subScreen(first.destination, cube.pos) });
    for (const second of stepsFrom(first.destination)) {
      if (eq(second.destination, cube.pos) || eq(second.axis, first.axis) || eq(second.axis, neg(first.axis))) continue;
      candidates.push({ destination: second.destination, turns: 2, path: [first, second], screen: subScreen(second.destination, cube.pos) });
    }
  }
  const valid = candidates.filter(candidate =>
    validDestination(index, candidate.destination) &&
    candidate.path.every(step => !occupied.has(k(step.destination)))
  );
  return valid.filter(candidate =>
    !valid.some(other => eq(other.destination, candidate.destination) && other.turns < candidate.turns)
  );
}

function subScreen(a, b) {
  const pa = project(a, {x:0,y:0}, 60), pb = project(b, {x:0,y:0}, 60);
  return [pa.x-pb.x, pa.y-pb.y];
}

function doRoll(index, drag) {
  const length = Math.hypot(...drag);
  if (length < 12) return false;
  const candidates = rollCandidates(index);
  const scored = candidates.map(candidate => {
    const len = Math.hypot(...candidate.screen);
    const score = dot(drag, candidate.screen) / (length * len);
    return { candidate, score };
  }).sort((a, b) => b.score - a.score || a.candidate.turns - b.candidate.turns);
  let bestEntry = scored[0];
  const shorterNearTie = scored.find(entry =>
    entry.candidate.turns < bestEntry?.candidate.turns &&
    entry.score >= bestEntry.score - .06
  );
  if (shorterNearTie) bestEntry = shorterNearTie;
  const best = bestEntry?.score >= .58 ? bestEntry.candidate : null;
  if (!best) return blocked();
  const cube = cubes[index];
  let nextOrient = [...cube.orient];
  for (const step of best.path) {
    const turned = [...nextOrient];
    DIRS.forEach((worldDir, oldWorldIndex) => {
      const newWorldIndex = dirIndex(rotateDirection(worldDir, step.axis));
      turned[newWorldIndex] = nextOrient[oldWorldIndex];
    });
    nextOrient = turned;
  }
  animateMove({
    index,
    destination: best.destination,
    path: best.path,
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

function blocked() {
  shakeUntil = performance.now() + 220;
  render();
  return false;
}

function snapCamera(target) {
  const to = qDot(camQuat, target) < 0 ? target.map(n => -n) : target;
  cameraSnap = {
    from: camQuat.slice(),
    to,
    started: performance.now(),
    duration: 260,
  };
  render();
  setTimeout(() => {
    camQuat = to;
    cameraSnap = null;
    render();
  }, cameraSnap.duration);
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
  if (animation || cameraSnap) return;
  canvas.setPointerCapture(event.pointerId);
  const point = localPoint(event);
  const face = [...hitFaces].reverse().find(f => pointInPoly(point, f.poly));
  pointer = { start: point, last: point, face, orbit: !face, orbitDrag: [0, 0], time: performance.now() };
});

// Orbiting empty space is handled by camera-controls.js (arcball free orbit).
// The native pointer handlers only deal with cubes (slide/roll).

canvas.addEventListener("pointerup", event => {
  if (!pointer || won || animation) return;
  const end = localPoint(event);
  const drag = [end.x-pointer.start.x, end.y-pointer.start.y];
  const distance = Math.hypot(...drag);
  if (pointer.face) {
    if (distance < 10) doSlide(pointer.face, end);
    else doRoll(pointer.face.cubeIndex, drag);
  }
  pointer = null;
});

function buildLevelGrid() {
  ui.levelGrid.innerHTML = "";
  ui.levelGrid.style.gridTemplateColumns = "repeat(2, 1fr)";
  levels.forEach((level, i) => {
    const button = document.createElement("button");
    button.textContent = i + 1;
    button.title = level.title;
    button.textContent = `${i + 1} · ${level.title}`;
    button.style.aspectRatio = "auto";
    button.style.minHeight = "44px";
    button.style.padding = "6px";
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
