(() => {
  const originalSlide = doSlide;

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
    return commitRoll(face.cubeIndex, roll);
  };
})();
