import * as THREE from '/static/js/three.module.js';

const root = document.getElementById('future-scene');

if (root) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setClearColor(0x000000, 0);
  root.appendChild(renderer.domElement);

  const group = new THREE.Group();
  scene.add(group);
  const disposableTextures = [];

  function mixChannel(a, b, amount) {
    return Math.round(a + (b - a) * amount);
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function smoothstep(value) {
    return value * value * (3 - 2 * value);
  }

  function hashNoise(x, y) {
    const raw = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return raw - Math.floor(raw);
  }

  function valueNoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = smoothstep(x - ix);
    const fy = smoothstep(y - iy);
    const a = hashNoise(ix, iy);
    const b = hashNoise(ix + 1, iy);
    const c = hashNoise(ix, iy + 1);
    const d = hashNoise(ix + 1, iy + 1);
    const x1 = a + (b - a) * fx;
    const x2 = c + (d - c) * fx;
    return x1 + (x2 - x1) * fy;
  }

  function fbm(x, y, octaves = 5) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let total = 0;

    for (let i = 0; i < octaves; i++) {
      value += valueNoise(x * frequency, y * frequency) * amplitude;
      total += amplitude;
      amplitude *= 0.52;
      frequency *= 2.03;
    }

    return value / total;
  }

  function createNoiseTexture({
    size = 128,
    base = [255, 190, 86],
    accent = [255, 245, 190],
    shadow = [128, 56, 26],
    banding = 6,
    noise = 0.26,
  }) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const image = context.createImageData(size, size);
    const center = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - center) / center;
        const dy = (y - center) / center;
        const distance = Math.min(Math.sqrt(dx * dx + dy * dy), 1);
        const warpA = fbm(dx * 2.1 + 9.5, dy * 2.1 - 4.2, 4) - 0.5;
        const warpB = fbm(dx * 3.2 - 2.4, dy * 3.2 + 7.1, 4) - 0.5;
        const organic = fbm(dx * 4.6 + warpA * 2.1, dy * 4.6 + warpB * 2.1, 6);
        const bands = Math.sin((dx * 2.8 + dy * 1.2 + organic * 1.9) * banding) * 0.5 + 0.5;
        const lightMix = clamp01(bands * 0.45 + organic * noise + (1 - distance) * 0.24);
        const darkMix = clamp01(distance * 0.34 + (1 - organic) * 0.18);
        const pixel = (y * size + x) * 4;
        const r = mixChannel(mixChannel(base[0], accent[0], lightMix), shadow[0], darkMix);
        const g = mixChannel(mixChannel(base[1], accent[1], lightMix), shadow[1], darkMix);
        const b = mixChannel(mixChannel(base[2], accent[2], lightMix), shadow[2], darkMix);

        image.data[pixel] = r;
        image.data[pixel + 1] = g;
        image.data[pixel + 2] = b;
        image.data[pixel + 3] = 255;
      }
    }

    context.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    disposableTextures.push(texture);
    return texture;
  }

  function createSoftPointTexture(size = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    disposableTextures.push(texture);
    return texture;
  }

  function createNebulaTexture({
    size = 256,
    colorA = [180, 205, 255],
    colorB = [255, 155, 210],
    colorC = [255, 218, 150],
  } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const image = context.createImageData(size, size);
    const center = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - center) / center;
        const dy = (y - center) / center;
        const radius = Math.sqrt(dx * dx + dy * dy);
        const swirl = Math.atan2(dy, dx) + radius * 2.4;
        const nx = Math.cos(swirl) * radius;
        const ny = Math.sin(swirl) * radius;
        const gas = fbm(nx * 3.2 + 11, ny * 3.2 - 3, 6);
        const ridge = Math.pow(clamp01(1 - Math.abs(gas - 0.56) * 2.8), 1.7);
        const falloff = Math.pow(clamp01(1 - radius), 1.65);
        const alpha = clamp01((ridge * 0.72 + gas * 0.18) * falloff);
        const warm = clamp01(fbm(nx * 5.4 - 8, ny * 5.4 + 2, 4));
        const base = warm > 0.58 ? colorB : colorA;
        const highlight = warm > 0.72 ? colorC : base;
        const pixel = (y * size + x) * 4;

        image.data[pixel] = mixChannel(base[0], highlight[0], ridge);
        image.data[pixel + 1] = mixChannel(base[1], highlight[1], ridge);
        image.data[pixel + 2] = mixChannel(base[2], highlight[2], ridge);
        image.data[pixel + 3] = Math.round(alpha * 180);
      }
    }

    context.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    disposableTextures.push(texture);
    return texture;
  }

  function createFlareTexture({
    size = 128,
    inner = 'rgba(255,255,255,0.95)',
    middle = 'rgba(255,197,89,0.28)',
    outer = 'rgba(249,115,22,0)',
  } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.24, middle);
    gradient.addColorStop(1, outer);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    disposableTextures.push(texture);
    return texture;
  }

  function createFlareSprite(texture, {
    color = 0xffffff,
    opacity = 0.4,
    scale = [1, 1],
    position = [0, 0, 0],
  } = {}) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sprite.scale.set(scale[0], scale[1], 1);
    sprite.position.set(position[0], position[1], position[2]);
    return sprite;
  }

  function createGalaxyLayer({
    count,
    minRadius,
    radiusRange,
    height,
    zScale,
    size,
    opacity,
    color,
    spread = 0.35,
  }) {
    const positions = new Float32Array(count * 3);
    const basePositions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const radius = minRadius + Math.random() * radiusRange;
      const angle = Math.random() * Math.PI * 2;
      const arm = Math.sin(angle * 2.6) * spread;
      const y = (Math.random() - 0.5) * height + arm;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius * zScale;
      basePositions[i * 3] = positions[i * 3];
      basePositions[i * 3 + 1] = positions[i * 3 + 1];
      basePositions[i * 3 + 2] = positions[i * 3 + 2];
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.08 + Math.random() * 0.2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color,
        size,
        map: pointTexture,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );

    group.add(points);
    return { count, geometry, points, positions, basePositions, phases, speeds, baseOpacity: opacity };
  }

  const pointTexture = createSoftPointTexture();
  const nebulaTexture = createNebulaTexture({
    colorA: [150, 120, 255],
    colorB: [240, 125, 255],
    colorC: [216, 180, 254],
  });
  const nebulaClouds = [
    createFlareSprite(nebulaTexture, {
      color: 0xd8b4fe,
      opacity: 0.36,
      scale: [12.8, 6.7],
      position: [0.72, 0.35, -3.8],
    }),
    createFlareSprite(nebulaTexture, {
      color: 0xf0abfc,
      opacity: 0.28,
      scale: [10.9, 5.25],
      position: [3.45, -0.78, -4],
    }),
    createFlareSprite(nebulaTexture, {
      color: 0xc084fc,
      opacity: 0.22,
      scale: [9.8, 4.75],
      position: [-2.35, -0.22, -4.2],
    }),
    createFlareSprite(nebulaTexture, {
      color: 0xa78bfa,
      opacity: 0.18,
      scale: [9.2, 4.15],
      position: [-4.65, 0.92, -4.35],
    }),
    createFlareSprite(nebulaTexture, {
      color: 0xf5d0fe,
      opacity: 0.16,
      scale: [10.4, 4.25],
      position: [0.25, -1.35, -4.55],
    }),
  ];
  nebulaClouds[0].material.rotation = -0.28;
  nebulaClouds[1].material.rotation = 0.42;
  nebulaClouds[2].material.rotation = -0.75;
  nebulaClouds[3].material.rotation = 0.12;
  nebulaClouds[4].material.rotation = -0.52;
  nebulaClouds.forEach((cloud) => group.add(cloud));

  const layers = [
    createGalaxyLayer({
      count: 720,
      minRadius: 1.5,
      radiusRange: 5.4,
      height: 4.6,
      zScale: 0.56,
      size: 0.019,
      opacity: 0.42,
      color: 0xbfd7ff,
    }),
    createGalaxyLayer({
      count: 115,
      minRadius: 1.7,
      radiusRange: 5.2,
      height: 4.2,
      zScale: 0.58,
      size: 0.04,
      opacity: 0.82,
      color: 0xffffff,
      spread: 0.5,
    }),
    createGalaxyLayer({
      count: 180,
      minRadius: 1.2,
      radiusRange: 5.9,
      height: 3.5,
      zScale: 0.5,
      size: 0.18,
      opacity: 0.045,
      color: 0x7dd3fc,
      spread: 0.7,
    }),
    createGalaxyLayer({
      count: 260,
      minRadius: 0.8,
      radiusRange: 6.4,
      height: 5.2,
      zScale: 0.62,
      size: 0.012,
      opacity: 0.28,
      color: 0xfde68a,
      spread: 0.95,
    }),
  ];
  const particleCount = layers.reduce((sum, layer) => sum + layer.count, 0);
  const solarSystem = new THREE.Group();
  solarSystem.position.set(4.45, 0.25, -1.8);
  solarSystem.rotation.z = -0.12;
  group.add(solarSystem);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfff2b0,
      map: createNoiseTexture({
        base: [255, 174, 73],
        accent: [255, 248, 190],
        shadow: [160, 60, 22],
        banding: 9,
        noise: 0.34,
      }),
    }),
  );
  solarSystem.add(sun);
  const sunFlareTexture = createFlareTexture();

  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffc75f,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  solarSystem.add(sunGlow);

  const outerGlow = new THREE.Mesh(
    new THREE.SphereGeometry(1.18, 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.035,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  solarSystem.add(outerGlow);
  const sunFlare = createFlareSprite(sunFlareTexture, {
    opacity: 0.32,
    scale: [2.7, 2.7],
    position: [0, 0, -0.03],
  });
  const sunHorizontalFlare = createFlareSprite(sunFlareTexture, {
    opacity: 0.12,
    scale: [3.9, 0.55],
    position: [0, 0, -0.04],
  });
  solarSystem.add(sunFlare, sunHorizontalFlare);

  const planetConfigs = [
    {
      radius: 1.25,
      size: 0.164,
      color: 0x93c5fd,
      speed: 1.7,
      phase: Math.random() * Math.PI * 2,
      y: 0.08,
      texture: { base: [38, 112, 191], accent: [86, 181, 112], shadow: [14, 43, 87], banding: 5 },
    },
    {
      radius: 1.78,
      size: 0.236,
      color: 0xfacc15,
      speed: 1.08,
      phase: Math.random() * Math.PI * 2,
      y: -0.06,
      ring: true,
      texture: { base: [202, 138, 4], accent: [254, 240, 138], shadow: [92, 52, 13], banding: 10 },
    },
    {
      radius: 2.35,
      size: 0.19,
      color: 0xfb923c,
      speed: 0.76,
      phase: Math.random() * Math.PI * 2,
      y: 0.13,
      texture: { base: [190, 82, 34], accent: [251, 191, 36], shadow: [92, 35, 15], banding: 8 },
    },
    {
      radius: 2.92,
      size: 0.144,
      color: 0x93c5fd,
      speed: 0.52,
      phase: Math.random() * Math.PI * 2,
      y: -0.1,
      texture: { base: [54, 83, 136], accent: [191, 219, 254], shadow: [15, 23, 42], banding: 6 },
    },
  ];
  const planetFlareTexture = createFlareTexture({
    inner: 'rgba(255,255,255,0.75)',
    middle: 'rgba(147,197,253,0.22)',
    outer: 'rgba(147,197,253,0)',
  });

  const planets = planetConfigs.map((config) => {
    const pivot = new THREE.Group();
    pivot.rotation.y = config.phase;
    solarSystem.add(pivot);

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(config.size, 18, 14),
      new THREE.MeshBasicMaterial({
        color: config.color,
        map: createNoiseTexture({
          ...config.texture,
          size: 64,
          noise: 0.22,
        }),
      }),
    );
    planet.position.set(config.radius, config.y, 0);
    pivot.add(planet);

    const haze = new THREE.Mesh(
      new THREE.SphereGeometry(config.size * 2.4, 18, 14),
      new THREE.MeshBasicMaterial({
        color: config.color,
        transparent: true,
        opacity: 0.09,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    haze.position.copy(planet.position);
    pivot.add(haze);
    const flare = createFlareSprite(planetFlareTexture, {
      color: config.color,
      opacity: 0.16,
      scale: [config.size * 5.8, config.size * 5.8],
      position: [config.radius, config.y, -0.01],
    });
    pivot.add(flare);
    let ring = null;
    if (config.ring) {
      ring = new THREE.Mesh(
        new THREE.RingGeometry(config.size * 1.55, config.size * 2.45, 48),
        new THREE.MeshBasicMaterial({
          color: 0xfde68a,
          transparent: true,
          opacity: 0.46,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.position.copy(planet.position);
      ring.rotation.x = Math.PI / 2.65;
      ring.rotation.y = 0.42;
      pivot.add(ring);
    }

    return { pivot, planet, haze, flare, ring, speed: config.speed, radius: config.size };
  });
  const distantSystem = new THREE.Group();
  distantSystem.position.set(-4.75, -0.42, -2.35);
  distantSystem.rotation.z = 0.18;
  distantSystem.scale.setScalar(0.86);
  group.add(distantSystem);

  const distantSun = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfff2b0,
      map: createNoiseTexture({
        base: [255, 184, 76],
        accent: [255, 248, 190],
        shadow: [146, 64, 14],
        banding: 9,
        noise: 0.34,
      }),
    }),
  );
  distantSystem.add(distantSun);

  const distantGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.92, 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0xffc75f,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  distantSystem.add(distantGlow);

  const distantFlare = createFlareSprite(sunFlareTexture, {
    color: 0xfff7ad,
    opacity: 0.2,
    scale: [2.15, 2.15],
    position: [0, 0, -0.03],
  });
  distantSystem.add(distantFlare);

  const distantPlanets = [
    {
      radius: 1.14,
      size: 0.156,
      color: 0x60a5fa,
      speed: 1.34,
      phase: Math.random() * Math.PI * 2,
      y: 0.05,
      texture: { base: [30, 104, 180], accent: [74, 222, 128], shadow: [14, 45, 90], banding: 5 },
    },
    {
      radius: 1.72,
      size: 0.216,
      color: 0xf9a8d4,
      speed: 0.86,
      phase: Math.random() * Math.PI * 2,
      y: -0.08,
      ring: true,
      texture: { base: [147, 86, 49], accent: [253, 186, 116], shadow: [67, 20, 7], banding: 9 },
    },
    {
      radius: 2.26,
      size: 0.164,
      color: 0xddd6fe,
      speed: 0.61,
      phase: Math.random() * Math.PI * 2,
      y: 0.1,
      texture: { base: [90, 88, 160], accent: [221, 214, 254], shadow: [36, 32, 76], banding: 6 },
    },
  ].map((config) => {
    const pivot = new THREE.Group();
    pivot.rotation.y = config.phase;
    distantSystem.add(pivot);

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(config.size, 18, 14),
      new THREE.MeshBasicMaterial({
        color: config.color,
        map: createNoiseTexture({
          ...config.texture,
          size: 64,
          noise: 0.22,
        }),
      }),
    );
    planet.position.set(config.radius, config.y, 0);
    pivot.add(planet);

    const flare = createFlareSprite(planetFlareTexture, {
      color: config.color,
      opacity: 0.13,
      scale: [config.size * 5.4, config.size * 5.4],
      position: [config.radius, config.y, -0.01],
    });
    pivot.add(flare);
    let ring = null;
    if (config.ring) {
      ring = new THREE.Mesh(
        new THREE.RingGeometry(config.size * 1.5, config.size * 2.35, 48),
        new THREE.MeshBasicMaterial({
          color: 0xf5d0fe,
          transparent: true,
          opacity: 0.42,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.position.copy(planet.position);
      ring.rotation.x = Math.PI / 2.8;
      ring.rotation.y = -0.3;
      pivot.add(ring);
    }

    return { pivot, planet, flare, ring, speed: config.speed, radius: config.size };
  });

  function createRocket(color = 0xffffff) {
    const rocket = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.026, 0.18, 10),
      new THREE.MeshBasicMaterial({ color }),
    );
    body.rotation.z = Math.PI / 2;
    rocket.add(body);

    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.027, 0.07, 10),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc }),
    );
    nose.position.x = 0.115;
    nose.rotation.z = -Math.PI / 2;
    rocket.add(nose);

    const flame = createFlareSprite(sunFlareTexture, {
      color: 0xfb7185,
      opacity: 0.34,
      scale: [0.18, 0.07],
      position: [-0.13, 0, 0],
    });
    rocket.add(flame);

    group.add(rocket);
    return { rocket, body, nose, flame };
  }

  const rockets = [
    { ...createRocket(0xe0f2fe), offset: Math.random(), altitude: 0.45, from: distantPlanets[1], to: planets[1], speed: 0.22 },
    { ...createRocket(0xfdf4ff), offset: Math.random(), altitude: -0.4, from: planets[0], to: distantPlanets[0], speed: 0.2 },
  ];
  const tempCenter = new THREE.Vector3();
  const tempSystemCenter = new THREE.Vector3();
  const tempNormal = new THREE.Vector3();
  const tempScale = new THREE.Vector3();
  const tempPointA = new THREE.Vector3();
  const tempPointB = new THREE.Vector3();
  const tempPrev = new THREE.Vector3();
  const tempNext = new THREE.Vector3();
  const tempDirection = new THREE.Vector3();

  function getLandingPoint(target, output) {
    target.planet.getWorldPosition(tempCenter);
    target.pivot.parent.getWorldPosition(tempSystemCenter);
    tempNormal.copy(tempCenter).sub(tempSystemCenter);
    if (tempNormal.lengthSq() < 0.0001) tempNormal.set(0, 1, 0);
    tempNormal.normalize();
    target.planet.getWorldScale(tempScale);
    output.copy(tempCenter).addScaledVector(tempNormal, target.radius * tempScale.x + 0.08);
    return group.worldToLocal(output);
  }

  function getRocketRoutePoint(item, progress, output) {
    const from = getLandingPoint(item.from, tempPointA);
    const to = getLandingPoint(item.to, tempPointB);
    const outbound = progress < 0.5;
    const local = outbound ? progress / 0.5 : (progress - 0.5) / 0.5;
    const hold = 0.18;
    const flightSpan = 1 - hold * 2;

    if (local < hold) return output.copy(outbound ? from : to);
    if (local > 1 - hold) return output.copy(outbound ? to : from);

    const flight = (local - hold) / flightSpan;
    const eased = 0.5 - Math.cos(flight * Math.PI) * 0.5;
    const start = outbound ? from : to;
    const end = outbound ? to : from;
    const arc = Math.sin(flight * Math.PI) * item.altitude;
    const wobble = Math.sin((frame + item.offset) * 8) * 0.026;

    return output.set(
      start.x + (end.x - start.x) * eased,
      start.y + (end.y - start.y) * eased + arc + wobble,
      start.z + (end.z - start.z) * eased + Math.sin(flight * Math.PI * 2) * 0.18,
    );
  }

  let frame = 0;
  let animationId = 0;

  function resize() {
    const width = root.clientWidth;
    const height = root.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }

  function animate() {
    frame += 0.0017;
    layers.forEach((layer, layerIndex) => {
      const position = layer.geometry.attributes.position;
      const array = position.array;

      for (let i = 0; i < layer.count; i++) {
        const offset = i * 3;
        const phase = layer.phases[i] + frame * layer.speeds[i] * 3.4;
        const breathe = 1 + Math.sin(phase) * (layerIndex === 2 ? 0.028 : 0.018);
        array[offset] = layer.basePositions[offset] * breathe;
        array[offset + 1] = layer.basePositions[offset + 1] + Math.sin(phase * 1.17) * 0.09;
        array[offset + 2] = layer.basePositions[offset + 2] + Math.cos(phase * 0.9) * 0.1;
      }

      position.needsUpdate = true;
      const layerPulse = 0.72 + Math.pow(Math.sin(frame * (1.5 + layerIndex * 0.45) + layerIndex), 2) * 0.32;
      layer.points.material.opacity = layer.baseOpacity * layerPulse;
    });

    group.rotation.y = frame * 0.22;
    group.rotation.x = Math.sin(frame * 0.38) * 0.018;
    group.scale.setScalar(1 + Math.sin(frame * 1.2) * 0.007);
    layers[0].points.rotation.z = Math.sin(frame * 0.32) * 0.012;
    layers[1].points.rotation.z = Math.sin(frame * 0.4) * 0.018;
    layers[2].points.rotation.z = Math.sin(frame * 0.24) * 0.03;
    layers[3].points.rotation.z = frame * -0.11;
    const nebulaBaseOpacity = [0.36, 0.28, 0.22, 0.18, 0.16];
    nebulaClouds.forEach((cloud, index) => {
      cloud.material.rotation += 0.00045 * (index + 1);
      cloud.material.opacity = nebulaBaseOpacity[index] + Math.sin(frame * (0.8 + index * 0.25)) * 0.024;
    });

    sun.rotation.y = frame * 1.8;
    sunGlow.scale.setScalar(1 + Math.sin(frame * 4.2) * 0.035);
    sunGlow.material.opacity = 0.08 + Math.pow(Math.sin(frame * 2.8), 2) * 0.06;
    outerGlow.scale.setScalar(1 + Math.sin(frame * 2.2) * 0.05);
    outerGlow.material.opacity = 0.022 + Math.pow(Math.sin(frame * 1.7 + 1.3), 2) * 0.026;
    sunFlare.material.opacity = 0.22 + Math.pow(Math.sin(frame * 2.6 + 0.4), 2) * 0.18;
    sunHorizontalFlare.material.opacity = 0.07 + Math.pow(Math.sin(frame * 2.1 + 1.1), 2) * 0.08;
    solarSystem.rotation.y = frame * 0.08;
    planets.forEach((planet) => {
      planet.pivot.rotation.y += 0.0025 * planet.speed;
      planet.planet.rotation.y += 0.01;
      planet.haze.scale.setScalar(1 + Math.sin(frame * planet.speed * 4) * 0.04);
      planet.flare.material.opacity = 0.12 + Math.sin(frame * planet.speed * 3.2) * 0.035;
      if (planet.ring) planet.ring.rotation.z += 0.002;
    });
    distantSun.rotation.y = -frame * 1.35;
    distantGlow.scale.setScalar(1 + Math.sin(frame * 2.8) * 0.055);
    distantGlow.material.opacity = 0.045 + Math.pow(Math.sin(frame * 2.3 + 0.8), 2) * 0.045;
    distantFlare.material.opacity = 0.13 + Math.pow(Math.sin(frame * 2.1), 2) * 0.11;
    distantSystem.rotation.y = -frame * 0.07;
    distantPlanets.forEach((planet) => {
      planet.pivot.rotation.y -= 0.0022 * planet.speed;
      planet.planet.rotation.y += 0.009;
      planet.flare.material.opacity = 0.1 + Math.sin(frame * planet.speed * 3.4) * 0.03;
      if (planet.ring) planet.ring.rotation.z -= 0.0024;
    });

    group.updateMatrixWorld(true);
    rockets.forEach((item) => {
      const t = (frame * item.speed + item.offset) % 1;
      getRocketRoutePoint(item, t, tempNext);
      getRocketRoutePoint(item, (t + 0.003) % 1, tempPrev);
      item.rocket.position.copy(tempNext);
      tempDirection.copy(tempPrev).sub(tempNext);
      item.rocket.rotation.z = Math.atan2(tempDirection.y, tempDirection.x);
      item.rocket.rotation.y = Math.atan2(tempDirection.z, Math.max(0.001, Math.abs(tempDirection.x))) * 0.55;
      const local = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
      const isLanded = local < 0.18 || local > 0.82;
      if (isLanded) {
        const target = local < 0.18
          ? (t < 0.5 ? item.from : item.to)
          : (t < 0.5 ? item.to : item.from);
        getLandingPoint(target, tempNext);
        item.rocket.position.copy(tempNext);
      }
      item.flame.visible = !isLanded;
      item.flame.material.opacity = isLanded ? 0 : 0.18 + Math.pow(Math.sin(frame * 12 + item.offset * 8), 2) * 0.2;
    });

    renderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
  }

  window.addEventListener('resize', resize);
  resize();
  animate();

  window.boidsAPI = {
    setTargetCount() {},
    setServerLoad() {},
    setMemoryLoad() {},
    getCount() { return particleCount; },
    destroy() {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      layers.forEach((layer) => {
        layer.geometry.dispose();
        layer.points.material.dispose();
      });
      sun.geometry.dispose();
      sun.material.dispose();
      sunGlow.geometry.dispose();
      sunGlow.material.dispose();
      outerGlow.geometry.dispose();
      outerGlow.material.dispose();
      sunFlare.material.dispose();
      sunHorizontalFlare.material.dispose();
      nebulaClouds.forEach((cloud) => cloud.material.dispose());
      planets.forEach((planet) => {
        planet.planet.geometry.dispose();
        planet.planet.material.dispose();
        planet.haze.geometry.dispose();
        planet.haze.material.dispose();
        planet.flare.material.dispose();
        if (planet.ring) {
          planet.ring.geometry.dispose();
          planet.ring.material.dispose();
        }
      });
      distantSun.geometry.dispose();
      distantSun.material.dispose();
      distantGlow.geometry.dispose();
      distantGlow.material.dispose();
      distantFlare.material.dispose();
      distantPlanets.forEach((planet) => {
        planet.planet.geometry.dispose();
        planet.planet.material.dispose();
        planet.flare.material.dispose();
        if (planet.ring) {
          planet.ring.geometry.dispose();
          planet.ring.material.dispose();
        }
      });
      rockets.forEach((item) => {
        item.body.geometry.dispose();
        item.body.material.dispose();
        item.nose.geometry.dispose();
        item.nose.material.dispose();
        item.flame.material.dispose();
      });
      disposableTextures.forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
