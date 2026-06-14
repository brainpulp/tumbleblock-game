(() => {
  let projectionPivot = [0, 0, 0];

  const originalProject = project;
  project = function(vector, origin, scale) {
    return originalProject(sub(vector, projectionPivot), origin, scale);
  };

  const originalDrawCluster = drawCluster;
  drawCluster = function(cluster, origin, scale, mode, interactive, now, animate) {
    projectionPivot = [0, 1, 2].map(axis =>
      cluster.reduce((sum, cube) => sum + cube.pos[axis] + .5, 0) / cluster.length
    );
    return originalDrawCluster(cluster, origin, scale, mode, interactive, now, animate);
  };
})();
