/**
 * SSE Metrics Client
 *
 * Listens to the htmx SSE stream and updates:
 * 1. The boids simulation (count, color, speed)
 * 2. The HUD overlay numbers
 *
 * Uses htmx:sseMessage event to intercept SSE data before DOM swap,
 * so we can drive the canvas + let htmx handle the HUD template swap.
 */

(function () {
  'use strict';

  // Listen for SSE messages from htmx sse extension
  document.body.addEventListener('htmx:sseBeforeMessage', function (evt) {
    try {
      const data = JSON.parse(evt.detail.data);

      // Update boids simulation
      if (window.boidsAPI) {
        window.boidsAPI.setTargetCount(data.boid_count || 60);
        window.boidsAPI.setServerLoad((data.cpu_percent || 0) / 100);
        window.boidsAPI.setMemoryLoad((data.memory_percent || 0) / 100);
      }

      // Update HUD elements directly (faster than waiting for swap)
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

      // Prevent default htmx swap since we handled it
      evt.preventDefault();
    } catch (e) {
      // Let htmx handle it if parse fails
    }
  });

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
