(() => {
  function faceConnectedAt(index, destination) {
    const positions = cubes.map((cube, i) => i === index ? destination : cube.pos);
    const occupied = new Set(positions.map(k));
    const seen = new Set([k(positions[0])]);
    const queue = [positions[0]];
    while (queue.length) {
      const position = queue.shift();
      for (const direction of DIRS) {
        const next = add(position, direction);
        if (occupied.has(k(next)) && !seen.has(k(next))) {
          seen.add(k(next));
          queue.push(next);
        }
      }
    }
    return seen.size === positions.length;
  }

  function supportedAt(index, destination) {
    const positions = cubes.map((cube, i) => i === index ? destination : cube.pos);
    const ground = Math.min(...positions.map(position => position[2]));
    const occupied = new Set(positions.map(k));
    return positions.every(position =>
      position[2] === ground || occupied.has(k(add(position, [0, 0, -1])))
    );
  }

  validDestination = function(index, destination) {
    if (!topFree(index) || !connectedWithout(index)) return false;
    if (cubes.some((cube, i) => i !== index && eq(cube.pos, destination))) return false;
    if (!faceConnectedAt(index, destination)) return false;
    return supportedAt(index, destination);
  };
})();
