(() => {
  const rigidCorner = (cube, local) => add(cube.rigidTransform.center, rotateVector(local, cube.rigidTransform.axis, cube.rigidTransform.angle));
  polygonForAnimatedFace = function(cube, normal, origin, scale) {
    const axis = normal.findIndex(value => value !== 0), others = [0, 1, 2].filter(index => index !== axis);
    return [[-1,-1], [1,-1], [1,1], [-1,1]].map(pair => {
      const local = [-.5, -.5, -.5]; local[axis] = normal[axis] * .5; local[others[0]] = pair[0] * .5; local[others[1]] = pair[1] * .5;
      return project(rigidCorner(cube, local), origin, scale);
    });
  };
  animatedCube = function(cube, cubeIndex, now, animate) {
    if (!animate || !animation || animation.index !== cubeIndex) return cube;
    const elapsed = Math.min(1, (now - animation.started) / animation.duration);
    const raw = animation.preview ? animation.progress : (animation.fromProgress || 0) + (1 - (animation.fromProgress || 0)) * elapsed;
    const progress = raw * raw * (3 - 2 * raw), startCenter = cube.pos.map(value => value + .5), destinationCenter = animation.destination.map(value => value + .5), step = animation.path?.[0];
    if (!step) { const center = startCenter.map((value, index) => value + (destinationCenter[index] - value) * progress); return { ...cube, pos: center.map(value => value - .5) }; }
    const angle = step.turns * Math.PI / 2 * progress;
    const support = cubes.find((other, index) => index !== cubeIndex && DIRS.some(direction => eq(add(cube.pos, direction), other.pos)) && DIRS.some(direction => eq(add(animation.destination, direction), other.pos)) && eq(cross(sub(cube.pos, other.pos), sub(animation.destination, other.pos)), step.axis));
    const centerPivot = support ? support.pos.map(value => value + .5) : step.pivot, centerRelative = sub(startCenter, centerPivot);
    const distanceSquared = sub(animation.destination, cube.pos).reduce((sum, value) => sum + value * value, 0), centerAngle = (distanceSquared > 2 ? Math.PI : Math.PI / 2) * progress;
    const center = add(centerPivot, rotateVector(centerRelative, step.axis, centerAngle));
    return { ...cube, pos: center.map(value => value - .5), visualRotations: [{ axis: step.axis, angle }], rigidTransform: { center, axis: step.axis, angle } };
  };
})();
