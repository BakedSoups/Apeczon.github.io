/**
 * Calm koi pond hero canvas.
 *
 * The goldfish image is optional. If the sprite exists, it is used as a
 * top down fish facing right. Otherwise the renderer falls back to a simple
 * drawn koi shape. Click the pond to drop food and make ripples.
 */

(function () {
  'use strict';

  const canvas = document.getElementById('boids-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const TAU = Math.PI * 2;

  const CONFIG = {
    fishCount: 18,
    mobileFishCount: 10,
    minSpeed: 0.18,
    maxSpeed: 0.58,
    turnRate: 0.035,
    foodPull: 0.012,
    foodRadius: 170,
    rainChance: 0.16,
    maxFood: 18,
    maxRipples: 90,
    lilyPadCount: 9,
    personalSpace: 44,
    separationStrength: 0.085,
  };

  let W = 1;
  let H = 1;
  let dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  let fish = [];
  let food = [];
  let ripples = [];
  let rain = [];
  let lilyPads = [];
  let uiZones = [];
  let lastTime = performance.now();
  let mouse = { x: -9999, y: -9999, active: false };

  const fishImage = new Image();
  let fishReady = false;
  fishImage.onload = () => { fishReady = true; };
  fishImage.src = '/static/images/goldfish-fish-clipart-md.png';

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    return d;
  }

  function updateUIZones() {
    uiZones = [];
    const canvasRect = canvas.getBoundingClientRect();
    document.querySelectorAll('#header, .hero-content, .profile-picture').forEach(el => {
      const r = el.getBoundingClientRect();
      uiZones.push({
        x: r.left - canvasRect.left,
        y: r.top - canvasRect.top,
        w: r.width,
        h: r.height,
      });
    });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    W = Math.max(1, Math.floor(rect.width));
    H = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    updateUIZones();
    seedLilyPads();
    if (!fish.length) seedFish();
  }

  function seedFish() {
    const count = W < 768 ? CONFIG.mobileFishCount : CONFIG.fishCount;
    fish = [];
    fish.push(new Koi('giant'));
    const tinyCount = Math.min(5, count - 1);
    for (let i = 0; i < tinyCount; i++) fish.push(new Koi('tinyRacer'));
    while (fish.length < count) fish.push(new Koi());
  }

  function seedLilyPads() {
    const count = W < 768 ? 5 : CONFIG.lilyPadCount;
    lilyPads = Array.from({ length: count }, (_, index) => {
      const sideBias = index % 3 === 0 ? rand(0.06, 0.28) : rand(0.66, 0.94);
      return {
        x: W * sideBias + rand(-18, 18),
        y: rand(H * 0.12, H * 0.88),
        r: rand(14, 34),
        rot: rand(0, TAU),
        drift: rand(0, TAU),
      };
    });
  }

  function addRipple(x, y, strength = 1) {
    if (ripples.length > CONFIG.maxRipples) ripples.shift();
    ripples.push({
      x,
      y,
      r: 2,
      life: 1,
      strength,
    });
  }

  function addFood(x, y) {
    addRipple(x, y, 1.6);
    for (let i = 0; i < 7; i++) {
      food.push({
        x: x + rand(-10, 10),
        y: y + rand(-8, 8),
        vy: rand(0.08, 0.26),
        life: rand(8, 13),
        r: rand(2.2, 3.8),
      });
    }
    while (food.length > CONFIG.maxFood) food.shift();
  }

  function nearestFood(koi) {
    let best = null;
    let bestD = Infinity;
    for (const pellet of food) {
      const dx = pellet.x - koi.x;
      const dy = pellet.y - koi.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) {
        best = pellet;
        bestD = d;
      }
    }
    return best && bestD < CONFIG.foodRadius ? { pellet: best, d: bestD } : null;
  }

  class Koi {
    constructor(forcedKind = null) {
      const edge = Math.floor(rand(0, 4));
      if (edge === 0) {
        this.x = -40;
        this.y = rand(0, H);
        this.heading = rand(-0.4, 0.4);
      } else if (edge === 1) {
        this.x = W + 40;
        this.y = rand(0, H);
        this.heading = Math.PI + rand(-0.4, 0.4);
      } else {
        this.x = rand(0, W);
        this.y = edge === 2 ? -40 : H + 40;
        this.heading = edge === 2 ? rand(0.7, 2.4) : rand(-2.4, -0.7);
      }
      this.targetHeading = this.heading;
      this.visualHeading = this.heading;
      this.forcedKind = forcedKind;
      this.size = forcedKind === 'giant' ? rand(68, 86) : forcedKind === 'tinyRacer' ? rand(16, 22) : rand(24, 44);
      this.phase = rand(0, TAU);
      this.turnAmount = 0;
      this.personality = this.pickPersonality();
      this.baseSpeed = rand(this.personality.speedMin, this.personality.speedMax);
      this.speed = this.baseSpeed;
      this.targetSpeed = this.baseSpeed;
      this.pauseTimer = rand(0, this.personality.pauseEvery);
      this.burstTimer = rand(0, this.personality.burstEvery);
      this.isPaused = false;
      this.isBursting = false;
      this.palette = Math.random() < 0.5
        ? ['#f5f0dc', '#ef6f43', '#1d2430']
        : ['#fff8e8', '#d84332', '#202020'];
      this.wanderTimer = rand(0, 180);
    }

    pickPersonality() {
      if (this.forcedKind === 'giant') {
        return {
          kind: 'giant',
          speedMin: 0.04,
          speedMax: 0.16,
          wander: 0.22,
          pauseEvery: 360,
          pauseLength: [3.0, 7.0],
          burstEvery: 9999,
          burstLength: [0, 0],
          burstSpeed: 0,
        };
      }
      if (this.forcedKind === 'tinyRacer') {
        return {
          kind: 'tinyRacer',
          speedMin: 0.62,
          speedMax: 1.05,
          wander: 1.35,
          pauseEvery: 9999,
          pauseLength: [0, 0],
          burstEvery: 105,
          burstLength: [0.8, 1.8],
          burstSpeed: 0.42,
        };
      }
      const roll = Math.random();
      if (roll < 0.28) {
        return {
          kind: 'lazy',
          speedMin: 0.05,
          speedMax: 0.28,
          wander: 0.42,
          pauseEvery: 260,
          pauseLength: [2.4, 5.8],
          burstEvery: 9999,
          burstLength: [0, 0],
          burstSpeed: 0,
        };
      }
      if (roll > 0.78) {
        return {
          kind: 'racer',
          speedMin: 0.34,
          speedMax: 0.74,
          wander: 1.05,
          pauseEvery: 9999,
          pauseLength: [0, 0],
          burstEvery: 180,
          burstLength: [1.1, 2.4],
          burstSpeed: 0.36,
        };
      }
      return {
        kind: 'cruiser',
        speedMin: 0.16,
        speedMax: 0.52,
        wander: 0.68,
        pauseEvery: 520,
        pauseLength: [0.6, 1.8],
        burstEvery: 520,
        burstLength: [0.6, 1.5],
        burstSpeed: 0.15,
      };
    }

    steerTo(x, y, strength) {
      const desired = Math.atan2(y - this.y, x - this.x);
      this.targetHeading += angleDiff(this.targetHeading, desired) * strength;
    }

    avoidFish(allFish) {
      let pushX = 0;
      let pushY = 0;
      let count = 0;

      for (const other of allFish) {
        if (other === this) continue;
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDistance = (this.size + other.size) * 0.62 + CONFIG.personalSpace * 0.25;
        if (distance < minDistance) {
          const force = 1 - distance / minDistance;
          const sizeBias = clamp(other.size / this.size, 0.35, 2.2);
          pushX += (dx / distance) * force;
          pushY += (dy / distance) * force;
          count++;

          const nudge = force * 0.16 * sizeBias;
          this.x += (dx / distance) * nudge;
          this.y += (dy / distance) * nudge;
        }
      }

      if (count > 0) {
        this.steerTo(this.x + pushX, this.y + pushY, CONFIG.separationStrength);
        this.targetSpeed = Math.max(this.targetSpeed, CONFIG.minSpeed + 0.08);
      }
    }

    flock(allFish) {
      if (this.personality.kind === 'giant' || this.isPaused) return;

      let neighbors = 0;
      let alignX = 0;
      let alignY = 0;
      let centerX = 0;
      let centerY = 0;
      let separateX = 0;
      let separateY = 0;

      const range = this.personality.kind === 'tinyRacer' ? 145 : 115;
      const separateRange = this.personality.kind === 'tinyRacer' ? 42 : 52;

      for (const other of allFish) {
        if (other === this || other.personality.kind === 'giant') continue;
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        if (distance > range) continue;

        neighbors++;
        alignX += Math.cos(other.heading);
        alignY += Math.sin(other.heading);
        centerX += other.x;
        centerY += other.y;

        if (distance < separateRange) {
          const force = 1 - distance / separateRange;
          separateX -= (dx / distance) * force;
          separateY -= (dy / distance) * force;
        }
      }

      if (!neighbors) return;

      alignX /= neighbors;
      alignY /= neighbors;
      centerX /= neighbors;
      centerY /= neighbors;

      const alignHeading = Math.atan2(alignY, alignX);
      this.targetHeading += angleDiff(this.targetHeading, alignHeading) * 0.018;
      this.steerTo(centerX, centerY, this.personality.kind === 'tinyRacer' ? 0.012 : 0.008);

      if (separateX || separateY) {
        this.steerTo(this.x + separateX, this.y + separateY, 0.09);
      }
    }

    avoidUI() {
      for (const z of uiZones) {
        const margin = 28;
        const left = z.x - margin;
        const right = z.x + z.w + margin;
        const top = z.y - margin;
        const bottom = z.y + z.h + margin;
        if (this.x > left && this.x < right && this.y > top && this.y < bottom) {
          const cx = z.x + z.w * 0.5;
          const cy = z.y + z.h * 0.5;
          this.steerTo(this.x + (this.x - cx), this.y + (this.y - cy), 0.18);
        }
      }
    }

    update(dt, allFish) {
      this.phase += dt * (2.2 + this.speed * 2.4);
      this.wanderTimer -= dt * 60;
      this.pauseTimer -= dt * 60;
      this.burstTimer -= dt * 60;

      if (this.wanderTimer <= 0) {
        this.targetHeading += rand(-this.personality.wander, this.personality.wander);
        this.baseSpeed = rand(this.personality.speedMin, this.personality.speedMax);
        this.wanderTimer = rand(90, 220);
      }

      if (!this.isPaused && this.pauseTimer <= 0) {
        this.isPaused = true;
        this.pauseTimer = rand(this.personality.pauseLength[0], this.personality.pauseLength[1]) * 60;
      } else if (this.isPaused && this.pauseTimer <= 0) {
        this.isPaused = false;
        this.pauseTimer = rand(this.personality.pauseEvery * 0.65, this.personality.pauseEvery * 1.35);
      }

      if (!this.isBursting && this.burstTimer <= 0) {
        this.isBursting = true;
        this.burstTimer = rand(this.personality.burstLength[0], this.personality.burstLength[1]) * 60;
        this.targetHeading += rand(-0.9, 0.9);
        addRipple(this.x, this.y, 0.28);
      } else if (this.isBursting && this.burstTimer <= 0) {
        this.isBursting = false;
        this.burstTimer = rand(this.personality.burstEvery * 0.65, this.personality.burstEvery * 1.35);
      }

      this.targetSpeed = this.isPaused ? rand(0.01, 0.05) : this.baseSpeed;
      if (this.isBursting) this.targetSpeed += this.personality.burstSpeed;

      const target = nearestFood(this);
      if (target) {
        this.steerTo(target.pellet.x, target.pellet.y, CONFIG.foodPull * (1 - target.d / CONFIG.foodRadius) * 18);
        this.targetSpeed = clamp(this.targetSpeed + 0.22, CONFIG.minSpeed, CONFIG.maxSpeed + 0.28);
        if (target.d < this.size * 0.55) {
          target.pellet.life = 0;
          addRipple(target.pellet.x, target.pellet.y, 0.7);
        }
      }

      if (mouse.active) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 160 && d > 1) this.steerTo(mouse.x, mouse.y, 0.015);
      }

      const margin = 70;
      if (this.x < margin) this.steerTo(W * 0.45, this.y, 0.04);
      if (this.x > W - margin) this.steerTo(W * 0.55, this.y, 0.04);
      if (this.y < margin) this.steerTo(this.x, H * 0.45, 0.04);
      if (this.y > H - margin) this.steerTo(this.x, H * 0.55, 0.04);

      this.avoidUI();
      this.flock(allFish);
      this.avoidFish(allFish);

      this.speed += (this.targetSpeed - this.speed) * 0.045 * dt * 60;
      this.speed = clamp(this.speed, 0.01, CONFIG.maxSpeed + 0.36);

      const forwardTurn = clamp(this.speed / Math.max(0.01, this.personality.speedMax), 0.05, 1);
      const turnDelta = angleDiff(this.heading, this.targetHeading) * CONFIG.turnRate * forwardTurn * dt * 60;
      this.heading += turnDelta;
      this.visualHeading += angleDiff(this.visualHeading, this.heading) * (0.025 + 0.045 * forwardTurn) * dt * 60;
      this.turnAmount = clamp(angleDiff(this.visualHeading, this.heading), -1.2, 1.2);
      const wiggle = Math.sin(this.phase) * 0.08;
      this.x += Math.cos(this.heading + wiggle) * this.speed * dt * 60;
      this.y += Math.sin(this.heading + wiggle) * this.speed * dt * 60;

      if (this.x < -90) this.x = W + 80;
      if (this.x > W + 90) this.x = -80;
      if (this.y < -90) this.y = H + 80;
      if (this.y > H + 90) this.y = -80;
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.visualHeading);
      if (fishReady && fishImage.naturalWidth > 0) {
        drawWiggledSprite(fishImage, this.size, this.phase, this.turnAmount, this.speed);
      } else {
        drawFallbackKoi(this.size, this.phase, this.palette);
      }
      ctx.restore();
    }
  }

  function drawWiggledSprite(img, size, phase, turnAmount, speed) {
    const aspect = img.naturalWidth / img.naturalHeight || 2;
    const h = size;
    const w = size * aspect;
    const segments = 16;
    const speedNorm = clamp((speed - CONFIG.minSpeed) / (CONFIG.maxSpeed + 0.18 - CONFIG.minSpeed), 0, 1);
    const waveAmp = size * (0.12 + speedNorm * 0.12);
    ctx.globalAlpha = 0.84;
    for (let i = 0; i < segments; i++) {
      const sx = (img.naturalWidth / segments) * i;
      const sw = img.naturalWidth / segments;
      const dx = -w * 0.5 + (w / segments) * i;
      const dw = w / segments + 1.4;
      const f = i / (segments - 1);
      const tailInfluence = 0.035 + 0.965 * Math.pow(1 - f, 2.6);
      const wave = phase + (1 - f) * Math.PI * 3.1;
      const swimBend = Math.sin(wave) * waveAmp * tailInfluence;
      const bodyCurve = turnAmount * Math.sin((1 - f) * Math.PI) * size * 0.58;
      const turnBend = turnAmount * size * 0.22 * tailInfluence + bodyCurve;
      const offset = swimBend + turnBend;
      const sliceScale = 1 + Math.abs(offset) / size * 0.08;
      const swimAngle = Math.cos(wave) * 0.16 * tailInfluence * (0.6 + speedNorm);
      const curveAngle = -turnAmount * Math.cos((1 - f) * Math.PI) * 0.42;
      const turnAngle = -turnAmount * 0.18 * tailInfluence + curveAngle;
      ctx.save();
      ctx.translate(dx + dw * 0.5, offset);
      ctx.rotate(swimAngle + turnAngle);
      ctx.drawImage(img, sx, 0, sw, img.naturalHeight, -dw * 0.5, -h * 0.5, dw, h * sliceScale);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawFallbackKoi(size, phase, palette) {
    const [base, accent, dark] = palette;
    const len = size * 2.25;
    const bodyW = size * 0.46;
    const tail = Math.sin(phase) * size * 0.18;

    ctx.globalAlpha = 0.86;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.beginPath();
    ctx.ellipse(0, 2, len * 0.48, bodyW * 0.9, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.ellipse(0, 0, len * 0.38, bodyW, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.ellipse(len * 0.03, -bodyW * 0.2, len * 0.16, bodyW * 0.42, -0.5, 0, TAU);
    ctx.ellipse(-len * 0.12, bodyW * 0.18, len * 0.12, bodyW * 0.36, 0.4, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(245, 238, 210, 0.86)';
    ctx.beginPath();
    ctx.moveTo(-len * 0.38, 0);
    ctx.lineTo(-len * 0.58, -bodyW * 0.55 + tail);
    ctx.lineTo(-len * 0.52, 0);
    ctx.lineTo(-len * 0.58, bodyW * 0.55 + tail);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(len * 0.31, -bodyW * 0.22, size * 0.045, 0, TAU);
    ctx.arc(len * 0.31, bodyW * 0.22, size * 0.045, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function updateFood(dt) {
    for (const pellet of food) {
      pellet.y += pellet.vy * dt * 60;
      pellet.life -= dt;
    }
    food = food.filter(pellet => pellet.life > 0);
  }

  function updateRipples(dt) {
    for (const ripple of ripples) {
      ripple.r += (28 + ripple.strength * 20) * dt;
      ripple.life -= 0.42 * dt;
    }
    ripples = ripples.filter(ripple => ripple.life > 0);
  }

  function updateRain(dt) {
    if (Math.random() < CONFIG.rainChance * dt * 60) {
      const x = rand(0, W);
      const y = rand(0, H);
      rain.push({ x, y, life: 0.55, alpha: rand(0.18, 0.36) });
      addRipple(x, y, 0.35);
    }
    for (const drop of rain) drop.life -= dt;
    rain = rain.filter(drop => drop.life > 0);
  }

  function drawWater(time) {
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, '#071b25');
    gradient.addColorStop(0.48, '#0a2832');
    gradient.addColorStop(1, '#123742');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = 'rgba(195, 230, 218, 0.22)';
    ctx.lineWidth = 1;
    for (let y = -30; y < H + 40; y += 30) {
      ctx.beginPath();
      for (let x = -20; x < W + 20; x += 18) {
        const yy = y + Math.sin(x * 0.018 + time * 0.0006 + y * 0.02) * 5;
        if (x === -20) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLilyPads(time) {
    for (const pad of lilyPads) {
      const bob = Math.sin(time * 0.001 + pad.drift) * 1.5;
      ctx.save();
      ctx.translate(pad.x, pad.y + bob);
      ctx.rotate(pad.rot + Math.sin(time * 0.0004 + pad.drift) * 0.06);
      ctx.fillStyle = 'rgba(55, 112, 78, 0.82)';
      ctx.beginPath();
      ctx.arc(0, 0, pad.r, 0.28, TAU - 0.42);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(160, 210, 160, 0.26)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, pad.r * 0.62, 0.35, TAU - 0.55);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawRipples() {
    ctx.save();
    ctx.lineWidth = 1.2;
    for (const ripple of ripples) {
      ctx.globalAlpha = Math.max(0, ripple.life) * 0.36;
      ctx.strokeStyle = 'rgba(218, 245, 238, 0.9)';
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.r, 0, TAU);
      ctx.stroke();
      if (ripple.strength > 1) {
        ctx.globalAlpha = Math.max(0, ripple.life) * 0.2;
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, ripple.r * 0.58, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawFood() {
    ctx.save();
    for (const pellet of food) {
      ctx.globalAlpha = clamp(pellet.life / 2, 0, 1);
      ctx.fillStyle = '#d9a34a';
      ctx.beginPath();
      ctx.arc(pellet.x, pellet.y, pellet.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRain() {
    ctx.save();
    for (const drop of rain) {
      ctx.globalAlpha = drop.life * drop.alpha;
      ctx.strokeStyle = 'rgba(210, 235, 245, 0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(drop.x - 3, drop.y - 9);
      ctx.lineTo(drop.x + 3, drop.y + 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(0.04, (now - lastTime) / 1000 || 0.016);
    lastTime = now;

    updateRain(dt);
    updateFood(dt);
    updateRipples(dt);
    for (const koi of fish) koi.update(dt, fish);

    drawWater(now);
    drawLilyPads(now);
    drawRipples();
    drawFood();
    for (const koi of fish) koi.draw();
    drawRain();

    requestAnimationFrame(frame);
  }

  canvas.addEventListener('mousemove', event => {
    const r = canvas.getBoundingClientRect();
    mouse.x = event.clientX - r.left;
    mouse.y = event.clientY - r.top;
    mouse.active = true;
  });

  canvas.addEventListener('mouseleave', () => {
    mouse.active = false;
  });

  canvas.addEventListener('click', event => {
    const r = canvas.getBoundingClientRect();
    addFood(event.clientX - r.left, event.clientY - r.top);
  });

  window.addEventListener('resize', resize);
  window.addEventListener('scroll', updateUIZones, { passive: true });

  resize();
  requestAnimationFrame(frame);

  window.boidsAPI = {
    setTargetCount() {},
    setServerLoad() {},
    setMemoryLoad() {},
    getCount() { return fish.length; },
  };
})();
