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

  // ── Lazy video playback ──
  function loadLazyVideo(video, shouldPlay = false) {
    const source = video.querySelector('source[data-src]');
    if (source) {
      source.src = source.dataset.src;
      source.removeAttribute('data-src');
      video.load();
    }

    if (shouldPlay) {
      video.muted = true;
      video.play().catch(() => {
        // Some browsers wait for the first user gesture before autoplay.
      });
    }
  }

  const lazyVideoObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (!(video instanceof HTMLVideoElement)) return;

        if (entry.isIntersecting) {
          loadLazyVideo(video, true);
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.22, rootMargin: '260px 0px' })
    : null;

  function observeLazyVideos(scope = document) {
    scope.querySelectorAll('video').forEach(video => {
      video.muted = true;
      video.preload = 'none';
      if (lazyVideoObserver) {
        lazyVideoObserver.observe(video);
      } else {
        loadLazyVideo(video, false);
      }
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

  observeLazyVideos();

  if (document.querySelector('#blog.content-view.active')) {
    document.body.classList.add('editorial-mode');
  }

  document.querySelectorAll('[data-blog-year]').forEach(button => {
    button.addEventListener('click', () => {
      const year = button.dataset.blogYear;
      document.querySelectorAll('[data-blog-year]').forEach(item => {
        item.classList.toggle('active', item === button);
      });
      document.querySelectorAll('[data-blog-year-page]').forEach(page => {
        page.classList.toggle('active', page.dataset.blogYearPage === year);
      });
    });
  });

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

  // ── Go project emote ──
  document.querySelectorAll('[data-go-emote]').forEach(emote => {
    let boomTimer;
    let resetTimer;

    function resetEmote() {
      window.clearTimeout(boomTimer);
      window.clearTimeout(resetTimer);
      emote.classList.remove('is-shaking', 'is-exploding');
      emote.src = emote.dataset.goSrc || '/static/images/go-gopher.svg';
    }

    function spawnGopherSwarm() {
      const rect = emote.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const landingOffsets = [-220, -110, 0, 110, 220];
      const groundY = window.innerHeight - centerY - 34;

      landingOffsets.forEach((offset, index) => {
        const clone = document.createElement('img');
        clone.className = 'go-swarm-clone';
        clone.src = emote.dataset.goSrc || '/static/images/go-gopher.svg';
        clone.alt = '';
        clone.setAttribute('aria-hidden', 'true');
        const targetX = Math.min(window.innerWidth - 34, Math.max(34, centerX + offset));
        const landX = targetX - centerX;
        clone.style.left = `${centerX}px`;
        clone.style.top = `${centerY}px`;
        clone.style.setProperty('--mid-x', `${landX * 0.35}px`);
        clone.style.setProperty('--mid-y', `${-110 - index * 12}px`);
        clone.style.setProperty('--land-x', `${landX}px`);
        clone.style.setProperty('--land-y', `${groundY}px`);
        const spin = landX >= 0 ? 360 + index * 34 : -360 - index * 34;
        clone.style.setProperty('--mid-spin', `${spin / 3}deg`);
        clone.style.setProperty('--spin', `${spin}deg`);
        document.body.appendChild(clone);
        window.setTimeout(() => clone.remove(), 6500);
      });
    }

    function triggerEmote() {
      resetEmote();
      // Restart the CSS animation if the user re-enters quickly.
      void emote.offsetWidth;
      emote.classList.add('is-shaking');
      boomTimer = window.setTimeout(() => {
        emote.classList.remove('is-shaking');
        emote.classList.add('is-exploding');
        emote.src = emote.dataset.boomSrc || '/static/images/boom-explosion.gif';
        spawnGopherSwarm();
        resetTimer = window.setTimeout(resetEmote, 850);
      }, 900);
    }

    emote.addEventListener('pointerenter', triggerEmote);
    emote.addEventListener('focus', triggerEmote);
    emote.addEventListener('blur', resetEmote);
  });

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
          video.preload = 'none';
          video.poster = poster || '';
          video.dataset.lazyVideo = '';
          video.setAttribute('aria-label', alt);

          const source = document.createElement('source');
          source.dataset.src = src;
          source.type = 'video/mp4';
          video.appendChild(source);
          stage.prepend(video);
          observeLazyVideos(stage);
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
