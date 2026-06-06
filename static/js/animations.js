/**
 * Portfolio Animations
 *
 * - Header scroll shadow
 * - Copy to clipboard with toast (remove-me)
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
  function playProjectVideos() {
    document.querySelectorAll('#projects video').forEach(video => {
      video.muted = true;
      video.play().catch(() => {
        // Some browsers wait for the first user gesture before autoplay.
      });
    });
  }

  document.querySelectorAll('.hero-nav-link[data-view]').forEach(button => {
    button.addEventListener('click', () => {
      const view = button.dataset.view;

      document.querySelectorAll('.hero-nav-link[data-view]').forEach(item => {
        item.classList.toggle('active', item === button);
      });

      document.querySelectorAll('[data-view-panel]').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.viewPanel === view);
      });

      if (view === 'projects') {
        playProjectVideos();
      }
    });
  });

  if (document.querySelector('#projects.content-view.active')) {
    playProjectVideos();
  }

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
