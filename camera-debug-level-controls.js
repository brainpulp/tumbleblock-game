(() => {
  const debugRequested = new URLSearchParams(location.search).has("cameraDebug") ||
    location.hash === "#cameraDebug";
  if (!debugRequested) return;

  window.TUMBLEBLOCK_CAMERA_DEBUG = true;

  const debugLevel = {
    title: "Camera Debug",
    mode: "faces",
    hint: "Single cube camera test. Drag the background only.",
    start: [p(0, 0, 0)],
    target: [p(0, 0, 0)],
    debugOnly: true,
  };

  if (levels[0]?.title !== debugLevel.title) {
    levels.unshift(debugLevel);
    unlocked = Math.max(unlocked + 1, 0);
    localStorage.setItem("tumbleblock-unlocked", unlocked);
  }

  window.TUMBLEBLOCK_SAVED_LEVEL = 0;
  loadLevel(0);
})();
