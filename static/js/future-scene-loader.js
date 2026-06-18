const loadScene = () => {
  import('/static/js/future-scene.js?v=20260618-lazy-scene').catch(() => {
    // The static hero remains usable if WebGL or the module fetch fails.
  });
};

if ('requestIdleCallback' in window) {
  window.requestIdleCallback(loadScene, { timeout: 1200 });
} else {
  window.setTimeout(loadScene, 350);
}
