(() => {
  polygonForAnimatedFace = function(cube, normal, origin, scale) {
    const axis = normal.findIndex(n => n !== 0);
    const others = [0, 1, 2].filter(index => index !== axis);
    const tween = cube.visualTween;
    return [[-1,-1], [1,-1], [1,1], [-1,1]].map(pair => {
      const local = [-.5, -.5, -.5];
      local[axis] = normal[axis] * .5;
      local[others[0]] = pair[0] * .5;
      local[others[1]] = pair[1] * .5;
      const start = add(tween.startCenter, local);
      const end = add(tween.destinationCenter, rotateVector(local, tween.axis, tween.angle));
      return project(start.map((value, index) => value + (end[index] - value) * tween.progress), origin, scale);
    });
  };

  animatedCube = function(cube, cubeIndex, now, animate) {
    if (!animate || !animation || animation.index !== cubeIndex) return cube;
    const elapsed = Math.min(1, (now - animation.started) / animation.duration);
    const raw = animation.preview ? animation.progress : (animation.fromProgress || 0) + (1 - (animation.fromProgress || 0)) * elapsed;
    const progress = raw * raw * (3 - 2 * raw);
    const step = animation.path?.[0];
    if (!step) return { ...cube, pos: cube.pos.map((value, index) => value + (animation.destination[index] - value) * progress) };
    const startCenter = cube.pos.map(value => value + .5);
    const destinationCenter = animation.destination.map(value => value + .5);
    const center = startCenter.map((value, index) => value + (destinationCenter[index] - value) * progress);
    const angle = step.turns * Math.PI / 2;
    return { ...cube, pos: center.map(value => value - .5), visualRotations: [{ axis: step.axis, angle: angle * progress }], visualTween: { startCenter, destinationCenter, axis: step.axis, angle, progress } };
  };
})();
