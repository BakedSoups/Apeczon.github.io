/**
 * Portfolio Animations
 *
 * - Header scroll shadow
 * - Copy to clipboard with toast (remove-me)
 * - Project modal system
 * - Scroll-triggered reveals (Intersection Observer)
 */

(function () {
  'use strict';

  // ── Header scroll shadow ──
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    if (header) {
      header.classList.toggle('scrolled', window.scrollY > 50);
    }
  }, { passive: true });

  // ── Copy to clipboard with toast ──
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('remove-me', '3s');
    toast.textContent = message;
    container.appendChild(toast);
    // Self-destruct after 3s (fallback if remove-me extension doesn't catch it)
    setTimeout(() => toast.remove(), 3200);
  }

  document.getElementById('email-copy')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigator.clipboard.writeText('peczonalex@gmail.com').then(() => {
      showToast('Email copied to clipboard!');
    });
  });

  document.getElementById('discord-copy')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigator.clipboard.writeText('@alexpeczon').then(() => {
      showToast('Discord handle copied!');
    });
  });

  // ── Hero section switcher ──
  document.querySelectorAll('.hero-nav-link[data-view]').forEach(button => {
    button.addEventListener('click', () => {
      const view = button.dataset.view;

      document.querySelectorAll('.hero-nav-link[data-view]').forEach(item => {
        item.classList.toggle('active', item === button);
      });

      document.querySelectorAll('[data-view-panel]').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.viewPanel === view);
      });
    });
  });

  // ── Project Modal System ──
  const backdrop = document.getElementById('modal-backdrop');
  const modalContent = document.getElementById('modal-content');

  function closeModal() {
    backdrop.classList.remove('active');
  }

  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Fetch project data and show modal
  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', async () => {
      const slug = card.dataset.slug;
      if (!slug) return;

      try {
        const res = await fetch(`/api/projects/${slug}`);
        const project = await res.json();

        if (project.error) return;

        modalContent.innerHTML = `
          <button class="modal-close" aria-label="Close" onclick="document.getElementById('modal-backdrop').classList.remove('active')">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <div class="modal-media">
            <img src="${project.image}" alt="${project.title}" />
          </div>
          <div class="modal-body">
            <div class="modal-title">${project.title}</div>
            <div class="modal-desc">${project.long_description}</div>
            <div class="modal-tools">
              ${project.tools.map(t => `<span class="tool-tag">${t}</span>`).join('')}
            </div>
            <div class="modal-actions">
              ${project.links.map(l => `
                <a class="btn" href="${l.url}" target="_blank">
                  <i class="${l.icon}"></i> ${l.label}
                </a>
              `).join('')}
            </div>
          </div>
        `;

        backdrop.classList.add('active');
      } catch (err) {
        console.error('Failed to load project:', err);
      }
    });
  });

  // ── Scroll Reveal (Intersection Observer) ──
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  // Observe sections and cards
  document.querySelectorAll('.section, .project-card, .experience-card').forEach(el => {
    observer.observe(el);
  });
})();
