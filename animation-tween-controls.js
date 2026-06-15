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
