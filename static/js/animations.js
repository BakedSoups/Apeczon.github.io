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
      const wasEditorial = document.body.classList.contains('editorial-mode');
      const enteringEditorial = view === 'blog';
      const changingEditorialState = enteringEditorial || wasEditorial;
      const transitionKicker = document.querySelector('[data-transition-kicker]');
      const transitionTitle = document.querySelector('[data-transition-title]');

      if (transitionKicker && transitionTitle) {
        transitionKicker.textContent = enteringEditorial ? 'Entering' : 'Leaving';
        transitionTitle.textContent = 'Blog Mode';
      }

      document.body.classList.toggle('editorial-mode', enteringEditorial);
      document.body.classList.toggle('blog-door-transition', changingEditorialState);

      document.querySelectorAll('.hero-nav-link[data-view]').forEach(item => {
        item.classList.toggle('active', item === button);
      });

      document.querySelectorAll('[data-view-panel]').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.viewPanel === view);
      });

      if (view === 'projects') {
        playProjectVideos();
      }

      if (enteringEditorial) {
        window.setTimeout(() => {
          document.getElementById('blog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 160);
        window.setTimeout(() => {
          document.body.classList.remove('blog-door-transition');
        }, 1900);
      } else {
        if (wasEditorial) {
          window.setTimeout(() => {
            document.body.classList.remove('blog-door-transition');
          }, 1900);
        } else {
          document.body.classList.remove('blog-door-transition');
        }
      }
    });
  });

  if (document.querySelector('#projects.content-view.active')) {
    playProjectVideos();
  }

  if (document.querySelector('#blog.content-view.active')) {
    document.body.classList.add('editorial-mode');
  }

  // ── Portfolio tag filter ──
  const filterButtons = Array.from(document.querySelectorAll('.query-chip[data-filter]'));
  const filterStatus = document.querySelector('[data-filter-status]');
  const filterDescription = document.querySelector('[data-filter-copy]');
  let activeFilter = 'all';

  function getFilterLabel() {
    return filterButtons.find(button => button.dataset.filter === activeFilter)?.textContent?.trim() || 'All';
  }

  function getFilterDescription() {
    return filterButtons.find(button => button.dataset.filter === activeFilter)?.dataset.filterDescription || '';
  }

  function applyPortfolioFilter() {
    document.querySelectorAll('.project-card').forEach(card => {
      const buckets = (card.dataset.buckets || '').split(' ');
      const matches = activeFilter === 'all' || buckets.includes(activeFilter);
      card.classList.toggle('filtered-out', !matches);
    });

    if (!filterStatus) return;

    const items = Array.from(document.querySelectorAll('.project-card'));
    const visibleCount = items.filter(item => !item.classList.contains('filtered-out')).length;
    const plural = visibleCount === 1 ? 'project' : 'projects';

    if (activeFilter === 'all') {
      filterStatus.textContent = 'showing everything';
    } else if (visibleCount === 0) {
      filterStatus.textContent = `no projects in ${getFilterLabel()}`;
    } else {
      filterStatus.textContent = `${visibleCount} ${plural} in ${getFilterLabel()}`;
    }

    if (filterDescription) {
      filterDescription.textContent = getFilterDescription();
    }
  }

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter || 'all';
      filterButtons.forEach(item => {
        const isActive = item === button;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-pressed', String(isActive));
      });
      applyPortfolioFilter();
    });
  });

  document.querySelectorAll('.hero-nav-link[data-view]').forEach(button => {
    button.addEventListener('click', applyPortfolioFilter);
  });

  applyPortfolioFilter();

  // ── Project media switchers ──
  document.querySelectorAll('.project-media-options').forEach(options => {
    const media = options.closest('.project-media');
    const stage = media?.querySelector('[data-media-stage]');
    if (!stage) return;

    options.querySelectorAll('.project-media-option').forEach(option => {
      option.addEventListener('click', () => {
        const type = option.dataset.mediaType;
        const src = option.dataset.mediaSrc;
        const poster = option.dataset.mediaPoster;
        const alt = option.dataset.mediaAlt || '';
        if (!type || !src) return;

        const badges = stage.querySelector('.project-badges');
        stage.querySelector('img, video')?.remove();

        if (type === 'video') {
          const video = document.createElement('video');
          video.controls = true;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.preload = 'metadata';
          video.poster = poster || '';
          video.setAttribute('aria-label', alt);

          const source = document.createElement('source');
          source.src = src;
          source.type = 'video/mp4';
          video.appendChild(source);
          stage.prepend(video);
          video.play().catch(() => {});
        } else {
          const image = document.createElement('img');
          image.src = src;
          image.alt = alt;
          stage.prepend(image);
        }

        if (badges) stage.appendChild(badges);
        options.querySelectorAll('.project-media-option').forEach(item => {
          item.classList.toggle('active', item === option);
        });
      });
    });
  });

  // ── Live GitHub star counts ──
  document.querySelectorAll('[data-github-stars]').forEach(async badge => {
    const repo = badge.dataset.githubStars;
    if (!repo) return;

    try {
      const response = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) return;

      const data = await response.json();
      const stars = Number(data.stargazers_count || 0);
      const label = stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : String(stars);
      const span = badge.querySelector('span');
      if (span) span.textContent = label;
    } catch (error) {
      // Keep the static label if GitHub rate limits or the visitor is offline.
    }
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
  document.querySelectorAll('.section, .project-card, .experience-card, .blog-post-card').forEach(el => {
    observer.observe(el);
  });
})();
