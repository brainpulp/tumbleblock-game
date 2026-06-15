(() => {
  function isFaceConnected(positions) {
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

  validDestination = function(index, destination) {
    if (!connectedWithout(index)) return false;
    if (cubes.some((cube, i) => i !== index && eq(cube.pos, destination))) return false;
    return isFaceConnected(cubes.map((cube, i) => i === index ? destination : cube.pos));
  };
})();
