(() => {
  function drawThumbnail(canvas, level) {
    const context = canvas.getContext("2d");
    const width = canvas.width = 150;
    const height = canvas.height = 90;
    const scale = Math.min(22, 65 / bounds(level.target).span);
    const iso = position => ({
      x: (position[0] - position[1]) * scale,
      y: (position[0] + position[1]) * scale * .5 - position[2] * scale,
    });
    const centers = level.target.map(cube => iso(cube.pos.map(n => n + .5)));
    const offset = {
      x: width / 2 - (Math.min(...centers.map(point => point.x)) + Math.max(...centers.map(point => point.x))) / 2,
      y: height / 2 - (Math.min(...centers.map(point => point.y)) + Math.max(...centers.map(point => point.y))) / 2,
    };
    const point = position => {
      const projected = iso(position);
      return [projected.x + offset.x, projected.y + offset.y];
    };
    const occupied = new Set(level.target.map(cube => k(cube.pos)));
    const faces = [];
    const visible = [[0,0,1], [1,0,0], [0,1,0]];

    level.target.forEach(cube => visible.forEach(normal => {
      if (occupied.has(k(add(cube.pos, normal)))) return;
      const axis = normal.findIndex(value => value);
      const others = [0,1,2].filter(i => i !== axis);
      const poly = [[0,0], [1,0], [1,1], [0,1]].map(pair => {
        const vertex = [...cube.pos];
        vertex[axis] += 1;
        vertex[others[0]] += pair[0];
        vertex[others[1]] += pair[1];
        return point(vertex);
      });
      faces.push({ cube, normal, poly, depth: cube.pos[0] + cube.pos[1] + cube.pos[2] + normal[axis] * .5 });
    }));

    faces.sort((a, b) => a.depth - b.depth);
    faces.forEach(face => {
      context.beginPath();
      face.poly.forEach(([x,y], i) => i ? context.lineTo(x,y) : context.moveTo(x,y));
      context.closePath();
      context.fillStyle = faceColor(face.cube, face.normal, level.mode);
      context.fill();
      context.strokeStyle = "#202020";
      context.lineWidth = 1.5;
      context.lineJoin = "round";
      context.stroke();
    });
  }

  buildLevelGrid = function() {
    ui.levelGrid.innerHTML = "";
    levels.forEach((level, index) => {
      const button = document.createElement("button");
      const thumbnail = document.createElement("canvas");
      const label = document.createElement("span");
      thumbnail.className = "level-thumbnail";
      label.textContent = `${index + 1} - ${level.title}`;
      button.title = level.title;
      button.classList.toggle("current", index === levelIndex);
      button.append(thumbnail, label);
      button.onclick = () => { ui.levelDialog.close(); loadLevel(index); };
      ui.levelGrid.append(button);
      drawThumbnail(thumbnail, level);
    });
  };
})();
