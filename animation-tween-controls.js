(() => {
  const rigidCorner = (cube, local) => {
    const rotated = rotateVector(local, cube.rigidTransform.axis, cube.rigidTransform.angle);
    return add(cube.rigidTransform.center, rotated);
  };

  polygonForAnimatedFace = function(cube, normal, origin, scale) {
    const axis = normal.findIndex(value => value !== 0);
    const others = [0, 1, 2].filter(index => index !== axis);
    return [[-1,-1], [1,-1], [1,1], [-1,1]].map(pair => {
      const local = [-.5, -.5, -.5];
      local[axis] = normal[axis] * .5;
      local[others[0]] = pair[0] * .5;
      local[others[1]] = pair[1] * .5;
      return project(rigidCorner(cube, local), origin, scale);
    });
  };

  animatedCube = function(cube, cubeIndex, now, animate) {
    if (!animate || !animation || animation.index !== cubeIndex) return cube;
    const elapsed = Math.min(1, (now - animation.started) / animation.duration);
    const raw = animation.preview ? animation.progress : (animation.fromProgress || 0) + (1 - (animation.fromProgress || 0)) * elapsed;
    const progress = raw * raw * (3 - 2 * raw);
    const startCenter = cube.pos.map(value => value + .5);
    const destinationCenter = animation.destination.map(value => value + .5);
    const center = startCenter.map((value, index) => value + (destinationCenter[index] - value) * progress);
    const step = animation.path?.[0];
    if (!step) return { ...cube, pos: center.map(value => value - .5) };
    const angle = step.turns * Math.PI / 2 * progress;
    return { ...cube, pos: center.map(value => value - .5), visualRotations: [{ axis: step.axis, angle }], rigidTransform: { center, axis: step.axis, angle } };
  };
})();
