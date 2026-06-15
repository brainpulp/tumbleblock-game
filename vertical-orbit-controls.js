(() => {
  window.TUMBLEBLOCK_SCREEN_ORBIT = true;
  const quarter = Math.PI / 2;
  const baseYaw = -Math.PI / 4;
  const basePitch = Math.atan(1 / Math.sqrt(2));
  const pixelsPerQuarter = 150;
  let orbitPointer = null;

  canvas.addEventListener("pointerdown", event => {
    if (animation || cameraSnap) return;
    const point = localPoint(event);
    const face = [...hitFaces].reverse().find(item => pointInPoly(point, item.poly));
    if (face) return;
    event.stopImmediatePropagation();
    canvas.setPointerCapture(event.pointerId);
    orbitPointer = { pointerId: event.pointerId, start: point, startYaw: cameraYaw, startPitch: cameraPitch, moved: false };
  }, true);

  canvas.addEventListener("pointermove", event => {
    if (!orbitPointer || event.pointerId !== orbitPointer.pointerId || animation) return;
    event.stopImmediatePropagation();
    const point = localPoint(event);
    const dx = point.x - orbitPointer.start.x;
    const dy = point.y - orbitPointer.start.y;
    if (Math.hypot(dx, dy) < 3) return;
    orbitPointer.moved = true;
    cameraYaw = orbitPointer.startYaw - dx / pixelsPerQuarter * quarter;
    cameraPitch = orbitPointer.startPitch + dy / pixelsPerQuarter * quarter;
    render();
  }, true);

  const finishOrbit = event => {
    if (!orbitPointer || event.pointerId !== orbitPointer.pointerId) return;
    event.stopImmediatePropagation();
    const moved = orbitPointer.moved;
    orbitPointer = null;
    if (!moved) return;
    const targetYaw = baseYaw + Math.round((cameraYaw - baseYaw) / quarter) * quarter;
    const targetPitch = basePitch + Math.round((cameraPitch - basePitch) / quarter) * quarter;
    snapCamera(targetYaw, targetPitch);
  };
  canvas.addEventListener("pointerup", finishOrbit, true);
  canvas.addEventListener("pointercancel", finishOrbit, true);
})();
