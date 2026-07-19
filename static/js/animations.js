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
  const gopherPile = [];
  let clawActive = false;

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function activeGophers() {
    return gopherPile.filter(gopher => gopher.isConnected && !gopher.classList.contains('is-being-picked'));
  }

  function pileSlot(index) {
    const columns = [-2, -1, 0, 1, 2];
    const level = Math.floor(index / columns.length);
    const column = columns[index % columns.length];
    const stagger = level % 2 === 0 ? 0 : 21;
    const x = clampNumber(window.innerWidth / 2 + column * 42 + stagger, 32, window.innerWidth - 32);
    const y = window.innerHeight - 24 - level * 29;
    return { x, y };
  }

  function trimGopherPile() {
    const live = activeGophers();
    while (live.length > 34) {
      live.shift()?.remove();
    }
    gopherPile.splice(0, gopherPile.length, ...live);
  }

  function maybeStartClaw() {
    trimGopherPile();
    if (clawActive || gopherPile.length < 10) return;

    const target = gopherPile.shift();
    if (!target || !target.isConnected) return;

    clawActive = true;
    const rect = target.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;
    const claw = document.createElement('div');
    claw.className = 'go-claw-machine';
    claw.setAttribute('aria-hidden', 'true');
    claw.style.setProperty('--claw-x', `${targetX}px`);
    claw.style.setProperty('--drop-y', `${Math.max(92, targetY - 18)}px`);
    document.body.appendChild(claw);

    window.setTimeout(() => {
      if (!target.isConnected) return;
      target.classList.add('is-being-picked');
      target.style.setProperty('--lift-y', `${-(targetY + 90)}px`);
    }, 2300);

    window.setTimeout(() => {
      target.remove();
      claw.remove();
      clawActive = false;
      maybeStartClaw();
    }, 5400);
  }

  function settleGopher(clone, spin) {
    const slot = pileSlot(activeGophers().length);
    clone.style.left = `${slot.x}px`;
    clone.style.top = `${slot.y}px`;
    clone.style.setProperty('--spin', `${spin}deg`);
    clone.classList.add('is-landed');
    gopherPile.push(clone);
    maybeStartClaw();
  }

  function launchGopher(clone, centerX, centerY, index, total) {
    const size = 43;
    const floor = window.innerHeight - 24;
    const leftWall = size / 2;
    const rightWall = window.innerWidth - size / 2;
    const angle = (Math.PI * 2 * index) / total + (Math.random() - 0.5) * 0.55;
    const speed = 680 + Math.random() * 460;
    const state = {
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 430,
      spin: 0,
      spinVelocity: (Math.random() > 0.5 ? 1 : -1) * (420 + Math.random() * 520),
      bounces: 0,
      started: performance.now(),
      last: performance.now(),
    };

    function step(now) {
      const dt = Math.min(0.032, (now - state.last) / 1000);
      state.last = now;
      state.vy += 1720 * dt;
      state.vx *= 0.996;
      state.x += state.vx * dt;
      state.y += state.vy * dt;
      state.spin += state.spinVelocity * dt;
      state.spinVelocity *= 0.992;

      if (state.x < leftWall || state.x > rightWall) {
        state.x = clampNumber(state.x, leftWall, rightWall);
        state.vx *= -0.58;
        state.spinVelocity *= -0.76;
      }

      if (state.y > floor) {
        state.y = floor;
        state.vy *= -0.42;
        state.vx *= 0.74;
        state.spinVelocity *= 0.68;
        state.bounces += 1;
      }

      clone.style.left = `${state.x}px`;
      clone.style.top = `${state.y}px`;
      clone.style.transform = `translate(-50%, -50%) rotate(${state.spin}deg)`;

      const age = now - state.started;
      const isSettled = state.bounces >= 2 && Math.abs(state.vy) < 130 && Math.abs(state.vx) < 85;
      if (age > 3100 || isSettled) {
        clone.style.transform = '';
        settleGopher(clone, Math.round(state.spin));
        return;
      }

      requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

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
      const total = 14;

      Array.from({ length: total }).forEach((_, index) => {
        const clone = document.createElement('img');
        clone.className = 'go-swarm-clone';
        clone.src = emote.dataset.goSrc || '/static/images/go-gopher.svg';
        clone.alt = '';
        clone.setAttribute('aria-hidden', 'true');
        clone.style.left = `${centerX}px`;
        clone.style.top = `${centerY}px`;
        document.body.appendChild(clone);
        launchGopher(clone, centerX, centerY, index, total);
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
