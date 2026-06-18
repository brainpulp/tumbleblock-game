(() => {
  let started = false;
  let beat = 0;
  let lastBeatAt = 0;
  let lastDepth = null;
  let lastShapeMatched = false;

  function tone(frequency, duration, volume, type = "sine", delay = 0) {
    audio ||= new AudioContext();
    if (audio.state === "suspended") audio.resume();
    const now = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + .04);
  }

  function positionKeyList(cluster) {
    return normalizeCluster(cluster, false).map(cube => k(cube.pos));
  }

  function shapeScore() {
    const current = positionKeyList(cubes);
    const target = positionKeyList(levels[levelIndex].target);
    const targetSet = new Set(target);
    const hits = current.filter(position => targetSet.has(position)).length;
    return target.length ? hits / target.length : 0;
  }

  function shapeMatchedOnly() {
    const current = positionKeyList(cubes);
    const target = positionKeyList(levels[levelIndex].target);
    return current.length === target.length && current.every((position, index) => position === target[index]);
  }

  function updateMusic() {
    if (!started || won) return;
    const now = performance.now();
    const span = bounds(cubes).span;
    const complexity = cubes.length + span;
    const closeness = shapeScore();
    const interval = Math.max(260, 760 - complexity * 32 - closeness * 180);

    const view = currentView();
    if (lastDepth) {
      const cameraShift = Math.hypot(...view.depth.map((value, index) => value - lastDepth[index]));
      if (cameraShift > .12) {
        tone(740 + complexity * 18, .12, .012, "triangle");
      }
    }
    lastDepth = [...view.depth];

    const shapeOnly = shapeMatchedOnly() && !isMatched();
    if (shapeOnly && !lastShapeMatched) {
      tone(392, .24, .02);
      tone(587.33, .28, .018, "sine", .05);
      tone(783.99, .32, .014, "triangle", .1);
    }
    lastShapeMatched = shapeOnly;

    if (now - lastBeatAt < interval) return;
    lastBeatAt = now;
    beat++;
    const scale = [0, 3, 5, 7, 10, 12];
    const note = scale[(beat + cubes.length + Math.round(closeness * 5)) % scale.length];
    const root = 130.81 + complexity * 3.5;
    const frequency = root * Math.pow(2, note / 12);
    tone(frequency, .18 + closeness * .12, .012 + closeness * .01, beat % 4 === 0 ? "triangle" : "sine");
    if (beat % 4 === 0) tone(frequency / 2, .32, .01, "sine");
  }

  function startMusic() {
    if (started) return;
    started = true;
    audio ||= new AudioContext();
    if (audio.state === "suspended") audio.resume();
    lastBeatAt = performance.now();
    lastDepth = [...currentView().depth];
    setInterval(updateMusic, 90);
  }

  const baseCompleteLevel = completeLevel;
  completeLevel = function() {
    if (started) {
      tone(523.25, .18, .024);
      tone(659.25, .22, .02, "triangle", .06);
      tone(783.99, .28, .018, "sine", .12);
    }
    return baseCompleteLevel();
  };

  window.addEventListener("keydown", startMusic, { once: true });
  canvas.addEventListener("pointerdown", startMusic, { once: true });
})();
