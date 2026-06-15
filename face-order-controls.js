(() => {
  drawCluster = function(cluster, origin, scale, mode, interactive, now = performance.now(), animate = false) {
    const occupied = new Set(cluster.map((cube, i) => animate && i === animation?.index ? "" : k(cube.pos)));
    const view = currentView();
    const faces = [];

    cluster.forEach((cube, cubeIndex) => {
      const visual = animatedCube(cube, cubeIndex, now, animate);
      DIRS.forEach(normal => {
        if (!visual.visualRotations && occupied.has(k(add(cube.pos, normal)))) return;
        const visualNormal = visual.visualRotations
          ? visual.visualRotations.reduce((vector, rotation) => rotateVector(vector, rotation.axis, rotation.angle), normal)
          : normal;
        if (dot(visualNormal, view.depth) <= 0) return;
        const poly = visual.visualRotations
          ? polygonForAnimatedFace(visual, normal, origin, scale)
          : polygonForFace(visual.pos, normal, origin, scale);
        const center = add(visual.pos.map(n => n + .5), visualNormal.map(n => n * .5));
        faces.push({ cube, cubeIndex, normal, poly, depth: dot(center, view.depth) });
      });
    });

    faces.sort((a, b) => a.depth - b.depth);
    for (const face of faces) {
      ctx.beginPath();
      face.poly.forEach((point, i) => i ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.closePath();
      ctx.fillStyle = faceColor(face.cube, face.normal, mode);
      ctx.fill();
      ctx.strokeStyle = "#202020";
      ctx.lineWidth = Math.max(1.25, scale / 34);
      ctx.lineJoin = "round";
      ctx.stroke();
      if (interactive) hitFaces.push(face);
    }
  };
})();
