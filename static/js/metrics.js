/**
 * Metrics Client - polls /api/metrics and updates HUD + boids
 */

(function () {
  'use strict';

  async function fetchMetrics() {
    try {
      const res = await fetch('/api/metrics/');
      if (!res.ok) return;
      const data = await res.json();

      if (window.boidsAPI) {
        window.boidsAPI.setTargetCount(data.boid_count || 60);
        window.boidsAPI.setServerLoad((data.cpu_percent || 0) / 100);
        window.boidsAPI.setMemoryLoad((data.memory_percent || 0) / 100);
      }

      const hud = document.getElementById('metrics-hud');
      if (hud) {
        const inner = hud.querySelector('.hud-inner') || hud;
        inner.innerHTML = `
          <span class="hud-dot"></span>
          <span>CPU: ${data.cpu_percent.toFixed(1)}%</span>
          <span class="hud-sep">|</span>
          <span>MEM: ${data.memory_percent.toFixed(1)}%</span>
          <span class="hud-sep">|</span>
          <span>BOIDS: ${data.boid_count}</span>
        `;
      }
    } catch (e) {
      // silent fail
    }
  }

  // Poll every 3 seconds
  fetchMetrics();
  setInterval(fetchMetrics, 3000);

  // ── Draggable HUD ──
  const hud = document.getElementById('metrics-hud');
  if (hud) {
    let isDragging = false;
    let startX, startY, origX, origY;

    hud.addEventListener('mousedown', (e) => {
      isDragging = true;
      hud.style.cursor = 'grabbing';
      startX = e.clientX;
      startY = e.clientY;
      const rect = hud.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      hud.style.position = 'fixed';
      hud.style.left = (origX + dx) + 'px';
      hud.style.top = (origY + dy) + 'px';
      hud.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        hud.style.cursor = 'grab';
      }
    });
  }
})();
