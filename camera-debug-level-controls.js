(() => {
  const debugRequested = new URLSearchParams(location.search).has("cameraDebug") ||
    location.hash === "#cameraDebug";
  const debugLevel = {
    title: "Camera Debug",
    mode: "faces",
    hint: "Single cube camera test. Drag the background only.",
    start: [p(0, 0, 0)],
    target: [p(0, 0, 0)],
    debugOnly: true,
  };

  let debugIndex = levels.findIndex(level => level.debugOnly);
  if (debugIndex < 0) {
    levels.push(debugLevel);
    debugIndex = levels.length - 1;
  }

  const baseLoadLevel = loadLevel;
  loadLevel = function(index) {
    const isDebug = !!levels[index]?.debugOnly;
    window.TUMBLEBLOCK_CAMERA_DEBUG = isDebug;
    window.TUMBLEBLOCK_SHOW_CAMERA_AXES = isDebug;
    const result = baseLoadLevel(index);
    if (isDebug) document.querySelector("#hint").textContent = debugLevel.hint;
    return result;
  };

  if (debugRequested) {
    window.TUMBLEBLOCK_SAVED_LEVEL = debugIndex;
    loadLevel(debugIndex);
  }
})();
