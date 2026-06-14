(() => {
  function stableAt(index, destination) {
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
    if (!cubes.some((cube, i) => i !== index && DIRS.some(direction => eq(add(destination, direction), cube.pos)))) return false;
    return stableAt(index, destination);
  };
})();
