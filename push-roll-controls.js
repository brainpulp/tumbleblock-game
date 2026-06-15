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

  doSlide = function(face) {
    const pushDirection = neg(face.normal);
    const slideDestination = add(face.cube.pos, pushDirection);
    if (validDestination(face.cubeIndex, slideDestination)) return originalSlide(face);

    const roll = rollCandidates(face.cubeIndex)
      .map(candidate => {
        const displacement = sub(candidate.path[0].destination, face.cube.pos);
        return { candidate, score: dot(pushDirection, displacement) / Math.hypot(...displacement) };
      })
      .filter(entry => entry.score > .5)
      .sort((a, b) => b.score - a.score || a.candidate.turns - b.candidate.turns)[0]?.candidate;

    if (!roll) return blocked();
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
