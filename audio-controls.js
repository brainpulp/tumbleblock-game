//@@BANNER@@ audio-controls.js
//@@BANNER@@ Sound effects for moves and selection.
//@@BANNER@@ Consolidated from: sound-controls.js
//@@BANNER@@
//@@BANNER@@ ===== sound-controls.js =====
(() => {
  const basePlaySound = playSound;

  function tone(frequency, start, duration, volume, type = "sine") {
    audio ||= new AudioContext();
    if (audio.state === "suspended") audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .02);
  }

  playSound = function(type) {
    if (type !== "camera" && type !== "win" && type !== "select") return basePlaySound(type);
    audio ||= new AudioContext();
    const now = audio.currentTime;
    if (type === "select") {
      tone(520, now, .055, .022, "square");
      tone(780, now + .035, .06, .014, "triangle");
      return;
    }
    if (type === "camera") {
      tone(220, now, .12, .025, "triangle");
      tone(330, now + .045, .13, .018, "triangle");
      return;
    }
    tone(392, now, .34, .045);
    tone(523.25, now + .09, .38, .04);
    tone(659.25, now + .18, .48, .035);
  };

  const baseSnapCamera = snapCamera;
  snapCamera = function(targetYaw, targetPitch) {
    if (targetYaw !== cameraYaw || targetPitch !== cameraPitch) playSound("camera");
    return baseSnapCamera(targetYaw, targetPitch);
  };

  const baseCompleteLevel = completeLevel;
  completeLevel = function() {
    playSound("win");
    return baseCompleteLevel();
  };
})();
