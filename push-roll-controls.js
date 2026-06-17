(() => {
  const originalSlide = doSlide;

  function orientationAfter(cube, candidate) {
    let orientation = [...cube.orient];
    for (const step of candidate.path) {
      const turned = [...orientation];
      DIRS.forEach((worldDirection, oldWorldIndex) => {
        turned[dirIndex(rotateDirection(worldDirection, step.axis))] = orientation[oldWorldIndex];
      });
      orientation = turned;
    }
    return orientation;
  }

  function pushScore(cube, pushDirection, candidate) {
    const points = [candidate.destination, ...candidate.path.map(step => step.destination)];
    return Math.max(...points.map(point => {
      const displacement = sub(point, cube.pos);
      const length = Math.hypot(...displacement);
      return length ? dot(pushDirection, displacement) / length : -1;
    }));
  }

  function sameRoute(a, b) {
    return eq(a.destination, b.destination) &&
      a.path.length === b.path.length &&
      a.path.every((step, index) => eq(step.axis, b.path[index].axis));
  }

  doSlide = function(face) {
    const pushDirection = neg(face.normal);
    const slideDestination = add(face.cube.pos, pushDirection);
    if (validDestination(face.cubeIndex, slideDestination)) return originalSlide(face);

    const scored = rollCandidates(face.cubeIndex)
      .map(candidate => ({ candidate, score: pushScore(face.cube, pushDirection, candidate) }))
      .filter(entry => entry.score > .5)
      .sort((a, b) => b.score - a.score || a.candidate.turns - b.candidate.turns);
    const best = scored[0];
    if (!best) return blocked();
    const tied = scored.find(entry => entry !== best && entry.score >= best.score - .08 && !sameRoute(entry.candidate, best.candidate));
    if (tied) {
      showMessage("Ambiguous push");
      return blocked();
    }
    const roll = best.candidate;
    return animateMove({
      index: face.cubeIndex,
      destination: roll.destination,
      path: roll.path,
      turns: roll.turns,
      orient: orientationAfter(cubes[face.cubeIndex], roll),
      type: "roll",
      duration: roll.turns === 2 ? 440 : 280,
      sound: "roll",
    });
  };
})();
