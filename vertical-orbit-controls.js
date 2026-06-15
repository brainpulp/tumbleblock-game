(() => {
  let orbitPointer = null;
  canvas.addEventListener("pointerdown", event => {
    if (animation || cameraSnap) return;
    const point = localPoint(event);
    const face = [...hitFaces].reverse().find(item => pointInPoly(point, item.poly));
    if (face) return;
    event.stopImmediatePropagation(); canvas.setPointerCapture(event.pointerId);
    orbitPointer = { pointerId: event.pointerId, last: point, drag: [0, 0] };
  }, true);
  canvas.addEventListener("pointermove", event => {
    if (!orbitPointer || event.pointerId !== orbitPointer.pointerId || animation) return;
    event.stopImmediatePropagation(); const point = localPoint(event);
    orbitPointer.drag[0] += point.x - orbitPointer.last.x; orbitPointer.drag[1] += point.y - orbitPointer.last.y; orbitPointer.last = point;
    if (cameraSnap || Math.max(Math.abs(orbitPointer.drag[0]), Math.abs(orbitPointer.drag[1])) < 42) return;
    const quarter = Math.PI / 2;
    if (Math.abs(orbitPointer.drag[0]) >= Math.abs(orbitPointer.drag[1])) snapCamera(cameraYaw - Math.sign(orbitPointer.drag[0]) * quarter, cameraPitch);
    else snapCamera(cameraYaw, cameraPitch - Math.sign(orbitPointer.drag[1]) * quarter);
    orbitPointer.drag = [0, 0];
  }, true);
  const finishOrbit = event => { if (!orbitPointer || event.pointerId !== orbitPointer.pointerId) return; event.stopImmediatePropagation(); orbitPointer = null; };
  canvas.addEventListener("pointerup", finishOrbit, true); canvas.addEventListener("pointercancel", finishOrbit, true);
})();
