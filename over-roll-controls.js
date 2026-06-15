(() => {
  const baseRollCandidates = rollCandidates;
  rollCandidates = function(index) {
    const cube = cubes[index];
    const occupied = new Set(cubes.filter((_, i) => i !== index).map(c => k(c.pos)));
    const candidates = baseRollCandidates(index);

    cubes.forEach((neighbor, neighborIndex) => {
      if (neighborIndex === index) return;
      const from = sub(cube.pos, neighbor.pos);
      if (!DIRS.some(direction => eq(direction, from))) return;

      const destination = add(neighbor.pos, neg(from));
      const overDirection = from[2] === 0 ? [0, 0, 1] : [0, 1, 0];
      const overPosition = add(neighbor.pos, overDirection);
      if (occupied.has(k(destination)) || occupied.has(k(overPosition)) || !validDestination(index, destination)) return;

      const neighborCenter = neighbor.pos.map(n => n + .5);
      candidates.push({
        destination,
        turns: 2,
        path: [{
          destination,
          axis: cross(from, overDirection),
          pivot: neighborCenter,
          relative: sub(cube.pos.map(n => n + .5), neighborCenter),
          turns: 2,
        }],
        screen: subScreen(destination, cube.pos),
      });
    });
    return candidates;
  };

  const baseSlide = doSlide;
  doSlide = function(face) {
    const destination = add(face.cube.pos, neg(face.normal));
    if (validDestination(face.cubeIndex, destination)) return baseSlide(face);

    const push = neg(face.normal);
    const roll = rollCandidates(face.cubeIndex)
      .filter(candidate => cubes.some((neighbor, neighborIndex) =>
        neighborIndex !== face.cubeIndex &&
        DIRS.some(direction => eq(direction, sub(face.cube.pos, neighbor.pos))) &&
        eq(candidate.destination, add(neighbor.pos, push))
      ))
      .sort((a, b) => a.turns - b.turns)[0];

    if (!roll) return blocked();
    animation = null;
    return animateMove({
      index: face.cubeIndex,
      destination: roll.destination,
      path: roll.path,
      turns: roll.turns,
      orient: (() => {
        let orientation = [...cubes[face.cubeIndex].orient];
        for (const step of roll.path) {
          for (let turn = 0; turn < step.turns; turn++) {
            const turned = [...orientation];
            DIRS.forEach((direction, oldIndex) => {
              turned[dirIndex(rotateDirection(direction, step.axis))] = orientation[oldIndex];
            });
            orientation = turned;
          }
        }
        return orientation;
      })(),
      type: "roll",
      duration: 440,
      fromProgress: 0,
      sound: "roll",
    });
  };
})();
