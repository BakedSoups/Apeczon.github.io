/**
 * Native JS Boids Simulation - Canvas 2D
 * Koi fish schooling with predators, whales, yacht, rain ripples,
 * swimming animation, and interactive tools.
 */

(function () {
  'use strict';

  const canvas = document.getElementById('boids-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // -- Config --
  const CONFIG = {
    initialCount: 80,
    maxCount: 230,
    maxSpeed: 1.8,
    minSpeed: 0.4,
    perceptionRadius: 120,
    separationDist: 38,
    separationWeight: 2.0,
    alignmentWeight: 1.0,
    cohesionWeight: 0.3,
    edgeMargin: 80,
    edgeTurnForce: 0.15,
    maxTurnRate: 0.08,
    koiPalettes: [
      [[40, 100, 180], [70, 140, 210], [140, 190, 240]],    // ocean blue
      [[30, 80, 160], [60, 120, 200], [130, 180, 230]],     // deep blue
      [[60, 130, 200], [90, 160, 220], [160, 210, 245]],    // sky blue
      [[20, 60, 130], [50, 100, 170], [110, 160, 220]],     // navy
      [[50, 120, 190], [80, 150, 215], [150, 200, 240]],    // steel blue
      [[70, 140, 210], [100, 170, 230], [170, 215, 250]],   // light blue
    ],
    predatorCount: 3,
    predatorSpeed: 0.6,
    predatorPerception: 250,
    predatorChaseWeight: 0.008,
    fleeRadius: 180,
    fleeWeight: 5.0,
    swimFrequency: 3.5,
    swimAmplitude: 0.35,
    fishSegments: 8,
    forceRadius: 140,
    forceStrength: 0.12,
    whaleCount: 2,
    whaleSpeed: 0.3,
    rainDropCount: 180,
  };

  let W, H;
  let boids = [];
  let predators = [];
  let whales = [];
  let yacht = null;
  let rainDrops = [];
  let targetCount = CONFIG.initialCount;
  let spawnedExtra = 0;
  let serverLoad = 0;
  let memoryLoad = 0;

  let activeTool = null;
  let mouseX = -9999, mouseY = -9999;
  let mouseOnCanvas = false;

  // Water sim state (declared early so resize() can reference them)
  const WATER_SCALE = 4;           // 1 cell = 4px
  const WATER_DAMPING = 0.985;     // energy loss per step
  const WATER_RENDER_MULT = 9;     // brightness multiplier for rendering
  let waterW, waterH;
  let waterBuf1, waterBuf2;        // Float32Arrays (current, previous)
  let waterImageData;              // for pixel rendering

  // UI exclusion zones - boids steer away from these rects
  let uiZones = [];
  function updateUIZones() {
    uiZones = [];
    const els = document.querySelectorAll('#header, .hero, .content-wrapper');
    for (const el of els) {
      const r = el.getBoundingClientRect();
      uiZones.push({ x: r.left, y: r.top, w: r.width, h: r.height });
    }
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    if (waterBuf1) initWater(); // reinit water on resize
    updateUIZones();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', updateUIZones);
  resize();

  // ============================================================
  //  RAIN - drops poke the water heightmap for real wave propagation
  // ============================================================
  function initRain() {
    rainDrops = [];
    for (let i = 0; i < CONFIG.rainDropCount; i++) {
      rainDrops.push({ delay: Math.floor(Math.random() * 300) });
    }
  }

  function updateRain() {
    for (const d of rainDrops) {
      if (d.delay > 0) { d.delay--; continue; }
      // Drop hits water - poke the heightmap
      const x = Math.random() * W;
      const y = Math.random() * H;
      pokeWater(x, y, 1.5, 4);
      // Wait before next drop (slow, scattered rain)
      d.delay = 60 + Math.floor(Math.random() * 180);
    }
  }

  // ============================================================
  //  FISH BODY (shared renderer for koi, predators, whales)
  // ============================================================
  function bodyWidth(t) {
    if (t < 0.3) return Math.sin((t / 0.3) * Math.PI * 0.5);
    return Math.cos(((t - 0.3) / 0.7) * Math.PI * 0.5);
  }

  function drawFishBody(x, y, vx, vy, size, swimTime, timeOffset, palette, segments) {
    const angle = Math.atan2(vy, vx);
    const t = swimTime * CONFIG.swimFrequency + timeOffset;
    const [bodyCol, accentCol, bellyCol] = palette;
    const totalLen = size * 2.4;
    const maxW = size * 0.6;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Build spine
    const sx = [], sy = [];
    for (let i = 0; i <= segments; i++) {
      const f = i / segments;
      sx.push(size * 1.2 - f * totalLen);
      sy.push(Math.sin(t + f * Math.PI * 2.5) * CONFIG.swimAmplitude * f * f * size);
    }

    // Build outlines
    const tx = [], ty = [], bx = [], by = [];
    for (let i = 0; i <= segments; i++) {
      const f = i / segments;
      const w = bodyWidth(f) * maxW;
      let nx, ny;
      if (i === 0) { nx = -(sy[1]-sy[0]); ny = sx[1]-sx[0]; }
      else if (i === segments) { nx = -(sy[i]-sy[i-1]); ny = sx[i]-sx[i-1]; }
      else { nx = -(sy[i+1]-sy[i-1]); ny = sx[i+1]-sx[i-1]; }
      const l = Math.sqrt(nx*nx+ny*ny)||1;
      nx/=l; ny/=l;
      tx.push(sx[i]+nx*w); ty.push(sy[i]+ny*w);
      bx.push(sx[i]-nx*w); by.push(sy[i]-ny*w);
    }

    // Body + forked tail
    ctx.beginPath();
    ctx.moveTo(tx[0], ty[0]);
    for (let i=1;i<=segments;i++) ctx.lineTo(tx[i], ty[i]);
    const tw = Math.sin(t+Math.PI)*size*0.35;
    ctx.lineTo(sx[segments]-size*0.45, sy[segments]-size*0.4+tw);
    ctx.lineTo(sx[segments], sy[segments]);
    ctx.lineTo(sx[segments]-size*0.45, sy[segments]+size*0.4+tw);
    for (let i=segments;i>=0;i--) ctx.lineTo(bx[i], by[i]);
    ctx.closePath();
    const [br,bg,bb]=bodyCol;
    ctx.fillStyle=`rgba(${br},${bg},${bb},0.85)`;
    ctx.fill();

    // Belly
    const [lr,lg,lb]=bellyCol;
    ctx.beginPath();
    for (let i=0;i<=segments;i++){
      const w=bodyWidth(i/segments)*maxW*0.3;
      if(i===0) ctx.moveTo(sx[i],sy[i]+w*0.5);
      else ctx.lineTo(sx[i],sy[i]+w*0.5);
    }
    for (let i=segments;i>=0;i--){
      ctx.lineTo(sx[i],sy[i]+bodyWidth(i/segments)*maxW*0.15);
    }
    ctx.closePath();
    ctx.fillStyle=`rgba(${lr},${lg},${lb},0.3)`;
    ctx.fill();

    // Dorsal fin
    const di=Math.floor(segments*0.25);
    const [ar,ag,ab]=accentCol;
    ctx.beginPath();
    ctx.moveTo(sx[di],sy[di]-maxW*bodyWidth(di/segments));
    ctx.lineTo(sx[di]-size*0.15,sy[di]-maxW*1.2+Math.sin(t+1)*size*0.08);
    ctx.lineTo(sx[di+1],sy[di+1]-maxW*bodyWidth((di+1)/segments));
    ctx.closePath();
    ctx.fillStyle=`rgba(${ar},${ag},${ab},0.5)`;
    ctx.fill();

    // Pectoral fin
    const pi=Math.floor(segments*0.35);
    ctx.beginPath();
    ctx.moveTo(sx[pi],sy[pi]+maxW*bodyWidth(pi/segments)*0.7);
    ctx.lineTo(sx[pi]-size*0.3,sy[pi]+maxW*0.85+Math.sin(t*0.8+0.5)*size*0.1);
    ctx.lineTo(sx[pi+1],sy[pi+1]+maxW*bodyWidth((pi+1)/segments)*0.7);
    ctx.closePath();
    ctx.fillStyle=`rgba(${ar},${ag},${ab},0.4)`;
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(sx[0]-size*0.1,sy[0]-maxW*0.2,size*0.1,0,Math.PI*2);
    ctx.fillStyle='rgba(20,20,20,0.8)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx[0]-size*0.08,sy[0]-maxW*0.22,size*0.04,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.7)';
    ctx.fill();

    ctx.restore();
  }

  // Heading-based UI zone avoidance for predators/whales/yacht
  function uiZoneHeadingPush(entity) {
    const m = 50;
    for (let z = 0; z < uiZones.length; z++) {
      const zone = uiZones[z];
      if (entity.x > zone.x - m && entity.x < zone.x + zone.w + m &&
          entity.y > zone.y - m && entity.y < zone.y + zone.h + m) {
        const dL = entity.x - (zone.x - m), dR = (zone.x + zone.w + m) - entity.x;
        const dT = entity.y - (zone.y - m), dB = (zone.y + zone.h + m) - entity.y;
        const min = Math.min(dL, dR, dT, dB);
        let tx = 0, ty = 0;
        if (min === dL) tx = -1; else if (min === dR) tx = 1;
        else if (min === dT) ty = -1; else ty = 1;
        const desired = Math.atan2(ty, tx);
        let dd = desired - entity.heading;
        while (dd > Math.PI) dd -= Math.PI * 2;
        while (dd < -Math.PI) dd += Math.PI * 2;
        entity.heading += dd * 0.05;
      }
    }
  }

  // ============================================================
  //  2D WATER HEIGHTMAP SIMULATION (proper wave propagation)
  //  Downscaled grid; whales/yacht disturb it each frame.
  //  Two-buffer swap with damping for realistic ripple spread.
  // ============================================================
  function initWater() {
    waterW = Math.max(1, Math.ceil(W / WATER_SCALE));
    waterH = Math.max(1, Math.ceil(H / WATER_SCALE));
    const sz = waterW * waterH;
    waterBuf1 = new Float32Array(sz);
    waterBuf2 = new Float32Array(sz);
    waterImageData = null; // force re-create on next draw
  }

  // Poke the water at world coords (x,y) with given strength and radius
  function pokeWater(wx, wy, strength, radius) {
    const cx = Math.floor(wx / WATER_SCALE);
    const cy = Math.floor(wy / WATER_SCALE);
    const r = Math.ceil(radius / WATER_SCALE);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const gx = cx + dx, gy = cy + dy;
        if (gx < 1 || gx >= waterW - 1 || gy < 1 || gy >= waterH - 1) continue;
        const d2 = dx * dx + dy * dy;
        const r2 = r * r;
        if (d2 < r2) {
          const falloff = 1 - d2 / r2;
          waterBuf1[gy * waterW + gx] += strength * falloff;
        }
      }
    }
  }

  let _waterFrame = 0;
  function updateWater() {
    // Run every 3rd frame for slower wave propagation (high aerial view)
    _waterFrame++;
    if (_waterFrame % 3 !== 0) return;
    // Wave propagation: new = avg_neighbors * 2 - previous, damped
    for (let y = 1; y < waterH - 1; y++) {
      for (let x = 1; x < waterW - 1; x++) {
        const i = y * waterW + x;
        const avg = (
          waterBuf1[i - 1] + waterBuf1[i + 1] +
          waterBuf1[i - waterW] + waterBuf1[i + waterW]
        ) * 0.5 - waterBuf2[i];
        waterBuf2[i] = avg * WATER_DAMPING;
      }
    }
    // Swap buffers
    const tmp = waterBuf1;
    waterBuf1 = waterBuf2;
    waterBuf2 = tmp;
  }

  // Optimized water renderer with cached offscreen canvas
  let _waterOffscreen = null;
  let _waterOctx = null;
  function drawWaterOpt() {
    if (!waterImageData || waterImageData.width !== waterW || waterImageData.height !== waterH) {
      waterImageData = ctx.createImageData(waterW, waterH);
    }
    const data = waterImageData.data;
    for (let y = 0; y < waterH; y++) {
      for (let x = 0; x < waterW; x++) {
        const i = y * waterW + x;
        const pi = i * 4;
        const val = waterBuf1[i] * WATER_RENDER_MULT;
        if (val > 0.5 || val < -0.5) {
          if (val > 0) {
            const v = Math.min(255, val * 1.5);
            data[pi]     = 100 + (v * 0.4)|0;
            data[pi + 1] = 160 + (v * 0.35)|0;
            data[pi + 2] = 220 + (v * 0.15)|0;
            data[pi + 3] = Math.min(180, (val * 2.5)|0);
          } else {
            const v = Math.min(255, -val);
            data[pi]     = 5;
            data[pi + 1] = 12;
            data[pi + 2] = 30;
            data[pi + 3] = Math.min(120, (v * 1.5)|0);
          }
        } else {
          data[pi + 3] = 0; // transparent for calm water
        }
      }
    }
    if (!_waterOffscreen || _waterOffscreen.width !== waterW || _waterOffscreen.height !== waterH) {
      _waterOffscreen = document.createElement('canvas');
      _waterOffscreen.width = waterW;
      _waterOffscreen.height = waterH;
      _waterOctx = _waterOffscreen.getContext('2d');
    }
    _waterOctx.putImageData(waterImageData, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(_waterOffscreen, 0, 0, W, H);
    ctx.restore();
  }

  // ============================================================
  //  BOID (koi fish)
  // ============================================================
  class Boid {
    constructor(x, y) {
      this.x = x !== undefined ? x : Math.random() * W;
      this.y = y !== undefined ? y : Math.random() * H;
      const angle = Math.random() * Math.PI * 2;
      const speed = CONFIG.minSpeed + Math.random() * (CONFIG.maxSpeed - CONFIG.minSpeed);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.heading = angle;
      this.sizeScale = 0.8 + Math.random() * 0.4;
      this.timeOffset = Math.random() * Math.PI * 2;
      this.swimTime = 0;
      this.palette = CONFIG.koiPalettes[Math.floor(Math.random() * CONFIG.koiPalettes.length)];
      // Wandering speed variation (natural fish rhythm)
      this.wanderPhase = Math.random() * Math.PI * 2;
      this.wanderFreq = 0.3 + Math.random() * 0.5; // how fast the speed oscillates
      this.wanderAmp = 0.3 + Math.random() * 0.4;  // how much speed varies (0-1 range)
    }

    update(flock, preds) {
      // Natural speed variation - fish randomly speed up and slow down
      this.wanderPhase += 0.016 * this.wanderFreq;
      const wanderMult = 1.0 - this.wanderAmp * 0.5 + Math.sin(this.wanderPhase) * this.wanderAmp * 0.5;
      // Occasionally change rhythm
      if (Math.random() < 0.001) {
        this.wanderFreq = 0.3 + Math.random() * 0.5;
        this.wanderAmp = 0.3 + Math.random() * 0.4;
      }

      let sepX=0,sepY=0,sepN=0,aliX=0,aliY=0,aliN=0,cohX=0,cohY=0,cohN=0;
      let fleeX=0,fleeY=0,fleeing=false;

      for (let i=0;i<flock.length;i++) {
        const o=flock[i]; if(o===this) continue;
        const dx=o.x-this.x, dy=o.y-this.y, d=Math.sqrt(dx*dx+dy*dy);
        if (d<CONFIG.perceptionRadius) {
          aliX+=o.vx; aliY+=o.vy; aliN++;
          cohX+=o.x; cohY+=o.y; cohN++;
          if (d<CONFIG.separationDist&&d>0) { sepX-=dx/d; sepY-=dy/d; sepN++; }
        }
      }

      for (let i=0;i<preds.length;i++) {
        const p=preds[i]; const dx=p.x-this.x,dy=p.y-this.y,d=Math.sqrt(dx*dx+dy*dy);
        if (d<CONFIG.fleeRadius&&d>0) {
          const u=1-(d/CONFIG.fleeRadius);
          fleeX-=(dx/d)*u; fleeY-=(dy/d)*u; fleeing=true;
        }
      }
      for (let i=0;i<whales.length;i++) {
        const w=whales[i]; const dx=w.x-this.x,dy=w.y-this.y,d=Math.sqrt(dx*dx+dy*dy);
        if (d<100&&d>0) { fleeX-=(dx/d)*(1-d/100)*0.5; fleeY-=(dy/d)*(1-d/100)*0.5; fleeing=true; }
      }

      if (sepN>0) { this.vx+=(sepX/sepN)*CONFIG.separationWeight; this.vy+=(sepY/sepN)*CONFIG.separationWeight; }
      if (aliN>0) { this.vx+=((aliX/aliN)-this.vx)*CONFIG.alignmentWeight*0.06; this.vy+=((aliY/aliN)-this.vy)*CONFIG.alignmentWeight*0.06; }
      if (cohN>0) { this.vx+=((cohX/cohN)-this.x)*CONFIG.cohesionWeight*0.0005; this.vy+=((cohY/cohN)-this.y)*CONFIG.cohesionWeight*0.0005; }
      if (fleeing) { this.vx+=fleeX*CONFIG.fleeWeight; this.vy+=fleeY*CONFIG.fleeWeight; }

      if ((activeTool==='attract'||activeTool==='repel')&&mouseOnCanvas) {
        const dx=mouseX-this.x,dy=mouseY-this.y,d=Math.sqrt(dx*dx+dy*dy);
        if (d<CONFIG.forceRadius&&d>0) {
          const s=CONFIG.forceStrength*(1-d/CONFIG.forceRadius);
          const dir=activeTool==='attract'?1:-1;
          this.vx+=(dx/d)*s*dir; this.vy+=(dy/d)*s*dir;
        }
      }

      if (this.x<CONFIG.edgeMargin) this.vx+=CONFIG.edgeTurnForce;
      if (this.x>W-CONFIG.edgeMargin) this.vx-=CONFIG.edgeTurnForce;
      if (this.y<CONFIG.edgeMargin) this.vy+=CONFIG.edgeTurnForce;
      if (this.y>H-CONFIG.edgeMargin) this.vy-=CONFIG.edgeTurnForce;

      // Steer away from UI card zones
      const uiMargin = 40;
      for (let z = 0; z < uiZones.length; z++) {
        const zone = uiZones[z];
        const zl = zone.x - uiMargin, zr = zone.x + zone.w + uiMargin;
        const zt = zone.y - uiMargin, zb = zone.y + zone.h + uiMargin;
        if (this.x > zl && this.x < zr && this.y > zt && this.y < zb) {
          // Inside zone - push toward nearest edge
          const dLeft = this.x - zl, dRight = zr - this.x;
          const dTop = this.y - zt, dBot = zb - this.y;
          const minD = Math.min(dLeft, dRight, dTop, dBot);
          const push = 0.3;
          if (minD === dLeft) this.vx -= push;
          else if (minD === dRight) this.vx += push;
          else if (minD === dTop) this.vy -= push;
          else this.vy += push;
        }
      }

      let da=Math.atan2(this.vy,this.vx)-this.heading;
      while(da>Math.PI)da-=Math.PI*2; while(da<-Math.PI)da+=Math.PI*2;
      const mt=fleeing?CONFIG.maxTurnRate*3:CONFIG.maxTurnRate;
      if(Math.abs(da)>mt) da=Math.sign(da)*mt;
      this.heading+=da;

      const sm=fleeing?1.8:(1+serverLoad*0.8);
      let sp=Math.sqrt(this.vx*this.vx+this.vy*this.vy);
      sp=Math.max(CONFIG.minSpeed*wanderMult, Math.min(CONFIG.maxSpeed*sm*wanderMult, sp));
      this.vx=Math.cos(this.heading)*sp; this.vy=Math.sin(this.heading)*sp;
      this.x+=this.vx; this.y+=this.vy;
      if(this.x<-20)this.x=W+20; if(this.x>W+20)this.x=-20;
      if(this.y<-20)this.y=H+20; if(this.y>H+20)this.y=-20;
      this.swimTime+=0.016*(Math.sqrt(this.vx*this.vx+this.vy*this.vy)/CONFIG.maxSpeed);
    }

    draw() {
      const size = (5 + serverLoad*1.5) * this.sizeScale;
      drawFishBody(this.x, this.y, this.vx, this.vy, size, this.swimTime, this.timeOffset, this.palette, CONFIG.fishSegments);
    }
  }

  // ============================================================
  //  PREDATOR (bigger dark fish, same body shape)
  // ============================================================
  const PRED_PALETTES = [
    [[200, 40, 40], [240, 80, 60], [255, 150, 130]],    // crimson
    [[180, 30, 30], [220, 60, 50], [250, 130, 110]],    // dark red
    [[220, 50, 50], [250, 100, 80], [255, 170, 150]],   // bright red
  ];

  class Predator {
    constructor() {
      this.x=Math.random()*W; this.y=Math.random()*H;
      this.heading=Math.random()*Math.PI*2;
      this.vx=Math.cos(this.heading)*CONFIG.predatorSpeed;
      this.vy=Math.sin(this.heading)*CONFIG.predatorSpeed;
      this.timeOffset=Math.random()*Math.PI*2; this.swimTime=0;
      this.palette=PRED_PALETTES[Math.floor(Math.random()*PRED_PALETTES.length)];
      this.sizeScale=1.8+Math.random()*0.4;
    }
    update(flock) {
      // Find desired heading toward prey center
      let nx=0,ny=0,nc=0;
      for(let i=0;i<flock.length;i++){
        const b=flock[i],dx=b.x-this.x,dy=b.y-this.y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<CONFIG.predatorPerception){nx+=b.x;ny+=b.y;nc++;}
      }

      let desiredHeading = this.heading;
      if(nc>0){
        desiredHeading = Math.atan2((ny/nc)-this.y, (nx/nc)-this.x);
      } else {
        // Gentle wander
        desiredHeading = this.heading + (Math.random()-0.5)*0.1;
      }

      // Edge steering
      if(this.x<CONFIG.edgeMargin*1.5){ const d=Math.atan2(0,1); let dd=d-this.heading; while(dd>Math.PI)dd-=Math.PI*2;while(dd<-Math.PI)dd+=Math.PI*2; desiredHeading=this.heading+dd*0.3; }
      if(this.x>W-CONFIG.edgeMargin*1.5){ const d=Math.atan2(0,-1); let dd=d-this.heading; while(dd>Math.PI)dd-=Math.PI*2;while(dd<-Math.PI)dd+=Math.PI*2; desiredHeading=this.heading+dd*0.3; }
      if(this.y<CONFIG.edgeMargin*1.5){ const d=Math.atan2(1,0); let dd=d-this.heading; while(dd>Math.PI)dd-=Math.PI*2;while(dd<-Math.PI)dd+=Math.PI*2; desiredHeading=this.heading+dd*0.3; }
      if(this.y>H-CONFIG.edgeMargin*1.5){ const d=Math.atan2(-1,0); let dd=d-this.heading; while(dd>Math.PI)dd-=Math.PI*2;while(dd<-Math.PI)dd+=Math.PI*2; desiredHeading=this.heading+dd*0.3; }

      // UI zone avoidance
      uiZoneHeadingPush(this);

      // Slow turn rate (like whale but slightly faster)
      let diff = desiredHeading - this.heading;
      while(diff>Math.PI)diff-=Math.PI*2; while(diff<-Math.PI)diff+=Math.PI*2;
      const maxTurn = 0.02; // slow turning
      if(Math.abs(diff)>maxTurn) diff=Math.sign(diff)*maxTurn;
      this.heading+=diff;

      // Reconstruct velocity from heading
      const sp = CONFIG.predatorSpeed*(1+serverLoad*0.5);
      this.vx=Math.cos(this.heading)*sp;
      this.vy=Math.sin(this.heading)*sp;
      this.x+=this.vx;this.y+=this.vy;
      if(this.x<-30)this.x=W+30;if(this.x>W+30)this.x=-30;
      if(this.y<-30)this.y=H+30;if(this.y>H+30)this.y=-30;
      this.swimTime+=0.016;
    }
    draw() {
      const size=(8+serverLoad*2)*this.sizeScale;
      drawFishBody(this.x,this.y,this.vx,this.vy,size,this.swimTime,this.timeOffset,this.palette,CONFIG.fishSegments);
    }
  }

  // ============================================================
  //  WHALE (very big fish + prominent wake)
  // ============================================================
  const WHALE_PALETTES = [
    [[35,55,75],[55,80,110],[100,135,160]],
    [[45,50,60],[70,75,90],[110,120,140]],
  ];

  class Whale {
    constructor() {
      this.x=Math.random()*W; this.y=Math.random()*H;
      this.heading=Math.random()*Math.PI*2;
      this.vx=Math.cos(this.heading)*CONFIG.whaleSpeed;
      this.vy=Math.sin(this.heading)*CONFIG.whaleSpeed;
      this.swimTime=0; this.timeOffset=Math.random()*Math.PI*2;
      this.palette=WHALE_PALETTES[Math.floor(Math.random()*WHALE_PALETTES.length)];
    }
    update() {
      this.heading+=(Math.random()-0.5)*0.006;
      if(this.x<150){let d=Math.atan2(0,1)-this.heading;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;this.heading+=d*0.008;}
      if(this.x>W-150){let d=Math.atan2(0,-1)-this.heading;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;this.heading+=d*0.008;}
      if(this.y<150){let d=Math.atan2(1,0)-this.heading;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;this.heading+=d*0.008;}
      if(this.y>H-150){let d=Math.atan2(-1,0)-this.heading;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;this.heading+=d*0.008;}
      uiZoneHeadingPush(this);

      this.vx=Math.cos(this.heading)*CONFIG.whaleSpeed;
      this.vy=Math.sin(this.heading)*CONFIG.whaleSpeed;
      this.x+=this.vx; this.y+=this.vy;
      if(this.x<-80)this.x=W+80;if(this.x>W+80)this.x=-80;
      if(this.y<-80)this.y=H+80;if(this.y>H+80)this.y=-80;
      this.swimTime+=0.016;
      // Disturb water heightmap - V-wake trailing behind
      if(this.x>0&&this.x<W&&this.y>0&&this.y<H) {
        const sin=Math.sin(this.heading), cos=Math.cos(this.heading);
        pokeWater(this.x, this.y, 2, 6); // small bow disturbance
        // Spread V-arms further back and wider apart
        for(let d=1;d<=6;d++){
          const bx=this.x-cos*d*16, by=this.y-sin*d*16;
          pokeWater(bx+sin*d*8, by-cos*d*8, 2.5, 4);
          pokeWater(bx-sin*d*8, by+cos*d*8, 2.5, 4);
        }
      }
    }
    draw() {
      const size = 35;
      drawFishBody(this.x,this.y,this.vx,this.vy,size,this.swimTime,this.timeOffset,this.palette,CONFIG.fishSegments);
    }
  }

  // ============================================================
  //  YACHT (single, with prominent wake)
  // ============================================================
  class Yacht {
    constructor() {
      this.x=W*0.5; this.y=H*0.3;
      this.heading=Math.random()*Math.PI*2;
      this.speed=0.45;
      this.vx=Math.cos(this.heading)*this.speed;
      this.vy=Math.sin(this.heading)*this.speed;
    }
    update() {
      // Slow gentle cruise, rare heading changes
      this.heading+=(Math.random()-0.5)*0.004;
      // Edge avoidance
      if(this.x<180){let d=Math.atan2(0,1)-this.heading;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;this.heading+=d*0.01;}
      if(this.x>W-180){let d=Math.atan2(0,-1)-this.heading;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;this.heading+=d*0.01;}
      if(this.y<180){let d=Math.atan2(1,0)-this.heading;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;this.heading+=d*0.01;}
      if(this.y>H-180){let d=Math.atan2(-1,0)-this.heading;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;this.heading+=d*0.01;}
      uiZoneHeadingPush(this);

      this.vx=Math.cos(this.heading)*this.speed;
      this.vy=Math.sin(this.heading)*this.speed;
      this.x+=this.vx; this.y+=this.vy;
      if(this.x<-60)this.x=W+60;if(this.x>W+60)this.x=-60;
      if(this.y<-60)this.y=H+60;if(this.y>H+60)this.y=-60;
      // Disturb water - yacht V-wake trailing behind
      if(this.x>0&&this.x<W&&this.y>0&&this.y<H) {
        const sin=Math.sin(this.heading), cos=Math.cos(this.heading);
        pokeWater(this.x, this.y, 3, 6); // small bow disturbance
        for(let d=1;d<=8;d++){
          const bx=this.x-cos*d*14, by=this.y-sin*d*14;
          pokeWater(bx+sin*d*9, by-cos*d*9, 3, 4);
          pokeWater(bx-sin*d*9, by+cos*d*9, 3, 4);
        }
      }
    }
    draw() {

      // Yacht body (top-down)
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.heading);

      const L = 28; // hull length
      const W2 = 8;  // hull half-width

      // Hull shadow
      ctx.beginPath();
      ctx.ellipse(0, 2, L*0.5, W2+2, 0, 0, Math.PI*2);
      ctx.fillStyle='rgba(0,0,0,0.15)';
      ctx.fill();

      // Hull (pointed bow, rounded stern)
      ctx.beginPath();
      ctx.moveTo(L*0.55, 0); // bow point
      ctx.quadraticCurveTo(L*0.3, -W2, -L*0.1, -W2*0.95);
      ctx.quadraticCurveTo(-L*0.45, -W2*0.8, -L*0.45, 0);
      ctx.quadraticCurveTo(-L*0.45, W2*0.8, -L*0.1, W2*0.95);
      ctx.quadraticCurveTo(L*0.3, W2, L*0.55, 0);
      ctx.closePath();
      ctx.fillStyle='rgba(240, 240, 245, 0.92)';
      ctx.fill();
      ctx.strokeStyle='rgba(180, 190, 200, 0.6)';
      ctx.lineWidth=1;
      ctx.stroke();

      // Deck stripe
      ctx.beginPath();
      ctx.moveTo(L*0.4, 0);
      ctx.lineTo(-L*0.35, 0);
      ctx.strokeStyle='rgba(100, 140, 180, 0.3)';
      ctx.lineWidth=W2*1.2;
      ctx.stroke();

      // Cabin
      ctx.fillStyle='rgba(220, 225, 235, 0.9)';
      ctx.fillRect(-L*0.15, -W2*0.45, L*0.28, W2*0.9);
      ctx.strokeStyle='rgba(150, 170, 190, 0.5)';
      ctx.lineWidth=0.8;
      ctx.strokeRect(-L*0.15, -W2*0.45, L*0.28, W2*0.9);

      // Windows
      ctx.fillStyle='rgba(100, 160, 220, 0.6)';
      ctx.fillRect(-L*0.08, -W2*0.35, L*0.06, W2*0.25);
      ctx.fillRect(-L*0.08, W2*0.1, L*0.06, W2*0.25);
      ctx.fillRect(L*0.02, -W2*0.35, L*0.06, W2*0.25);
      ctx.fillRect(L*0.02, W2*0.1, L*0.06, W2*0.25);

      // Mast
      ctx.strokeStyle='rgba(180, 180, 180, 0.8)';
      ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.moveTo(L*0.25, 0);
      ctx.lineTo(L*0.25, -W2*1.8);
      ctx.stroke();

      // Flag
      ctx.fillStyle='rgba(220, 60, 60, 0.7)';
      ctx.beginPath();
      ctx.moveTo(L*0.25, -W2*1.8);
      ctx.lineTo(L*0.25+5, -W2*1.8+2);
      ctx.lineTo(L*0.25, -W2*1.8+4);
      ctx.fill();

      // Bow accent
      ctx.beginPath();
      ctx.moveTo(L*0.55, 0);
      ctx.lineTo(L*0.4, -2);
      ctx.lineTo(L*0.4, 2);
      ctx.closePath();
      ctx.fillStyle='rgba(50, 80, 120, 0.4)';
      ctx.fill();

      ctx.restore();
    }
  }

  // ============================================================
  //  INIT & LIFECYCLE
  // ============================================================
  function initBoids(n) { boids=[]; for(let i=0;i<n;i++) boids.push(new Boid()); }
  function initPredators() { predators=[]; for(let i=0;i<CONFIG.predatorCount;i++) predators.push(new Predator()); }
  function initWhales() { whales=[]; for(let i=0;i<CONFIG.whaleCount;i++) whales.push(new Whale()); }
  function adjustFlockSize() {
    while(boids.length<targetCount) boids.push(new Boid());
    while(boids.length>targetCount) boids.pop();
  }

  function drawCursorForce() {
    if(!mouseOnCanvas||!activeTool||activeTool==='spawn') return;
    const c=activeTool==='attract'?'rgba(0,191,255,0.12)':'rgba(255,100,80,0.12)';
    const s=activeTool==='attract'?'rgba(0,191,255,0.3)':'rgba(255,100,80,0.3)';
    ctx.save();
    ctx.beginPath(); ctx.arc(mouseX,mouseY,CONFIG.forceRadius,0,Math.PI*2);
    ctx.fillStyle=c; ctx.fill(); ctx.strokeStyle=s; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(mouseX,mouseY,CONFIG.forceRadius*0.3,0,Math.PI*2);
    ctx.fillStyle=activeTool==='attract'?'rgba(0,191,255,0.15)':'rgba(255,100,80,0.15)'; ctx.fill();
    ctx.restore();
  }

  // Mouse tracking
  canvas.addEventListener('mousemove',(e)=>{const r=canvas.getBoundingClientRect();mouseX=e.clientX-r.left;mouseY=e.clientY-r.top;mouseOnCanvas=true;});
  canvas.addEventListener('mouseleave',()=>{mouseOnCanvas=false;});

  // Spawn click
  canvas.addEventListener('click',(e)=>{
    if(activeTool!=='spawn')return;
    const r=canvas.getBoundingClientRect();
    const x=e.clientX-r.left, y=e.clientY-r.top;
    const toAdd=Math.min(5,CONFIG.maxCount-boids.length);
    for(let i=0;i<toAdd;i++) boids.push(new Boid(x+(Math.random()-0.5)*30, y+(Math.random()-0.5)*30));
    spawnedExtra+=toAdd; targetCount=boids.length;
  });

  // Animation loop
  function frame() {
    try {
      ctx.fillStyle='rgba(10, 18, 32, 1)';
      ctx.fillRect(0,0,W,H);
      adjustFlockSize();
      updateRain();
      updateWater();
      for(let i=0;i<boids.length;i++) boids[i].update(boids,predators);
      for(let i=0;i<predators.length;i++) predators[i].update(boids);
      for(let i=0;i<whales.length;i++) whales[i].update();
      yacht.update();

      // Draw back-to-front: water surface first, then creatures on top
      drawWaterOpt();
      for(let i=0;i<boids.length;i++) boids[i].draw();
      for(let i=0;i<predators.length;i++) predators[i].draw();
      for(let i=0;i<whales.length;i++) whales[i].draw();
      yacht.draw();
      drawCursorForce();
    } catch(e) {
      console.error('frame error:', e);
    }
    requestAnimationFrame(frame);
  }

  initWater();
  initBoids(CONFIG.initialCount);
  initPredators();
  initWhales();
  initRain();
  yacht = new Yacht();
  requestAnimationFrame(frame);

  // Public API
  window.boidsAPI = {
    setTargetCount(n) { targetCount=Math.max(10,Math.min(CONFIG.maxCount,n+spawnedExtra)); },
    setServerLoad(v) { serverLoad=Math.max(0,Math.min(1,v)); },
    setMemoryLoad(v) { memoryLoad=Math.max(0,Math.min(1,v)); },
    getCount() { return boids.length; },
    setActiveTool(tool) { activeTool=tool; },
    getActiveTool() { return activeTool; },
  };
})();
