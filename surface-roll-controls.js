(() => {
  const baseRollCandidates = rollCandidates;
  rollCandidates = function(index) {
    const cube = cubes[index];
    const occupied = new Set(cubes.filter((_, cubeIndex) => cubeIndex !== index).map(item => k(item.pos)));
    const candidates = baseRollCandidates(index);
    const sourceCenter = cube.pos.map(value => value + .5);

    const addCandidate = candidate => {
      if (!candidates.some(existing => eq(existing.destination, candidate.destination))) {
        candidates.push(candidate);
      }
    };

    cubes.forEach((support, supportIndex) => {
      if (supportIndex === index) return;
      const from = sub(cube.pos, support.pos);
      if (!DIRS.some(direction => eq(direction, from))) return;

      for (const direction of DIRS) {
        if (dot(from, direction) !== 0) continue;
        const destination = add(cube.pos, direction);
        const destinationSupport = add(support.pos, direction);
        if (
          occupied.has(k(destination)) ||
          !occupied.has(k(destinationSupport)) ||
          !validDestination(index, destination)
        ) continue;

        const axis = cross(from, direction);
        const pivot = sourceCenter.map((value, axisIndex) =>
          value + (direction[axisIndex] - from[axisIndex]) * .5
        );
        addCandidate({
          destination,
          turns: 1,
          surface: true,
          path: [{
            destination,
            axis,
            pivot,
            relative: sub(sourceCenter, pivot),
            turns: 1,
            surface: true,
          }],
          screen: subScreen(destination, cube.pos),
        });
      }
    });

    return candidates;
  };

  const baseAnimatedCube = animatedCube;
  animatedCube = function(cube, cubeIndex, now, animate) {
    const step = animation?.path?.[0];
    if (!animate || !animation || animation.index !== cubeIndex || !step?.surface) {
      return baseAnimatedCube(cube, cubeIndex, now, animate);
    }

    const elapsed = Math.min(1, (now - animation.started) / animation.duration);
    const raw = animation.preview
      ? animation.progress
      : (animation.fromProgress || 0) + (1 - (animation.fromProgress || 0)) * elapsed;
    const progress = raw * raw * (3 - 2 * raw);
    const angle = Math.PI / 2 * progress;
    const center = add(step.pivot, rotateVector(step.relative, step.axis, angle));

    return {
      ...cube,
      pos: center.map(value => value - .5),
      visualRotations: [{ axis: step.axis, angle }],
      rigidTransform: { center, axis: step.axis, angle },
    };
  };
})();
