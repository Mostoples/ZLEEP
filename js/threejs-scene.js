/* ZLEEP Three.js Scene Manager — Particle Field + Sleep Orb + IMU Cube */

const ZleepScene = (() => {

  const C = {
    PURPLE:  0x7B6CF6,
    VIOLET:  0xA78BFA,
    TEAL:    0x22D3EE,
    SUCCESS: 0x34D399,
    WARN:    0xFB923C,
    DANGER:  0xF87171,
    WHITE:   0xFFFFFF,
  };

  // ══════════════════════════════════════════════════════════
  // 1. PARTICLE FIELD BACKGROUND
  // ══════════════════════════════════════════════════════════
  let pR, pScene, pCam, pPoints, pLineSegs;
  const N = 110;
  const pPos = new Float32Array(N * 3);
  const pVel = new Float32Array(N * 3);
  let pRunning = false;

  function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas || !window.THREE) return;

    pR = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    pR.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    _resizeParticles();

    pScene = new THREE.Scene();
    pCam   = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 2000);
    pCam.position.z = 500;

    // Randomise particle start positions and velocities
    for (let i = 0; i < N; i++) {
      const W = window.innerWidth, H = window.innerHeight;
      pPos[i*3]   = (Math.random() - .5) * W * 1.6;
      pPos[i*3+1] = (Math.random() - .5) * H * 1.6;
      pPos[i*3+2] = (Math.random() - .5) * 300;
      pVel[i*3]   = (Math.random() - .5) * .35;
      pVel[i*3+1] = (Math.random() - .5) * .25;
      pVel[i*3+2] = (Math.random() - .5) * .1;
    }

    // Points
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', new THREE.BufferAttribute(pPos.slice(), 3));
    pPoints = new THREE.Points(dotGeo, new THREE.PointsMaterial({
      color: C.VIOLET, size: 2.5, transparent: true, opacity: .65, sizeAttenuation: false
    }));
    pScene.add(pPoints);

    // Line segments
    const lGeo = new THREE.BufferGeometry();
    const maxPairs = N * N;
    lGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxPairs * 6), 3));
    pLineSegs = new THREE.LineSegments(lGeo, new THREE.LineBasicMaterial({
      color: C.PURPLE, transparent: true, opacity: .12
    }));
    pScene.add(pLineSegs);

    window.addEventListener('resize', _resizeParticles);
    pRunning = true;
    _tickParticles();
  }

  function _resizeParticles() {
    if (!pR) return;
    pR.setSize(window.innerWidth, window.innerHeight);
    if (pCam) { pCam.aspect = window.innerWidth / window.innerHeight; pCam.updateProjectionMatrix(); }
  }

  function _tickParticles() {
    if (!pRunning) return;
    requestAnimationFrame(_tickParticles);

    const W = window.innerWidth * .8, H = window.innerHeight * .8;

    // Update positions
    for (let i = 0; i < N; i++) {
      pPos[i*3]   += pVel[i*3];
      pPos[i*3+1] += pVel[i*3+1];
      pPos[i*3+2] += pVel[i*3+2];
      if (pPos[i*3]   >  W) pPos[i*3]   = -W;
      if (pPos[i*3]   < -W) pPos[i*3]   =  W;
      if (pPos[i*3+1] >  H) pPos[i*3+1] = -H;
      if (pPos[i*3+1] < -H) pPos[i*3+1] =  H;
    }
    const dotAttr = pPoints.geometry.attributes.position;
    dotAttr.array.set(pPos);
    dotAttr.needsUpdate = true;

    // Rebuild connection lines
    const lArr = pLineSegs.geometry.attributes.position.array;
    const DIST = 160;
    let li = 0;
    for (let a = 0; a < N; a++) {
      for (let b = a + 1; b < N; b++) {
        const dx = pPos[a*3] - pPos[b*3], dy = pPos[a*3+1] - pPos[b*3+1];
        if (Math.sqrt(dx*dx + dy*dy) < DIST && li + 5 < lArr.length) {
          lArr[li++] = pPos[a*3]; lArr[li++] = pPos[a*3+1]; lArr[li++] = pPos[a*3+2];
          lArr[li++] = pPos[b*3]; lArr[li++] = pPos[b*3+1]; lArr[li++] = pPos[b*3+2];
        }
      }
    }
    for (let r = li; r < lArr.length; r++) lArr[r] = 0;
    pLineSegs.geometry.setDrawRange(0, li / 3);
    pLineSegs.geometry.attributes.position.needsUpdate = true;

    pR.render(pScene, pCam);
  }

  // ══════════════════════════════════════════════════════════
  // 2. SLEEP ORB (Dashboard hero)
  // ══════════════════════════════════════════════════════════
  let oR, oScene, oCam, oMesh, oGlow, oRings = [], oDots;
  let oTarget = new THREE.Color(C.PURPLE);
  let oRunning = false;

  function initOrb() {
    const canvas = document.getElementById('orb-canvas');
    if (!canvas || !window.THREE) return;

    const W = canvas.clientWidth || 320, H = canvas.clientHeight || 320;
    oR = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    oR.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    oR.setSize(W, H, false);

    oScene = new THREE.Scene();
    oCam   = new THREE.PerspectiveCamera(45, W / H, .1, 100);
    oCam.position.z = 3.5;

    // Lights
    oScene.add(new THREE.AmbientLight(0x1a0a44, 4));
    const l1 = new THREE.PointLight(C.VIOLET, 4, 12); l1.position.set(2, 2, 2); oScene.add(l1);
    const l2 = new THREE.PointLight(C.TEAL,   2, 8);  l2.position.set(-2,-1, 1); oScene.add(l2);

    // Main sphere
    const sGeo = new THREE.SphereGeometry(.85, 64, 64);
    const sMat = new THREE.MeshPhongMaterial({
      color: C.PURPLE, emissive: 0x3520aa,
      shininess: 100, transparent: true, opacity: .95
    });
    oMesh = new THREE.Mesh(sGeo, sMat);
    oScene.add(oMesh);

    // Outer glow shell
    const gMat = new THREE.MeshPhongMaterial({
      color: C.PURPLE, emissive: 0x5540dd,
      transparent: true, opacity: .14, side: THREE.BackSide
    });
    oGlow = new THREE.Mesh(new THREE.SphereGeometry(1.12, 32, 32), gMat);
    oScene.add(oGlow);

    // Three orbital rings (deep / REM / light)
    [
      { r: 1.28, t: .012, tilt: [Math.PI/4,  0, .3], col: C.PURPLE },
      { r: 1.60, t: .009, tilt: [Math.PI/3, .5, 0],  col: C.TEAL   },
      { r: 1.90, t: .007, tilt: [Math.PI/6,  0, .8], col: C.VIOLET },
    ].forEach(({ r, t, tilt, col }) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, t, 8, 100),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .55 })
      );
      ring.rotation.set(...tilt);
      oScene.add(ring);
      oRings.push(ring);
    });

    // Floating dots around orb
    const dPos = [];
    for (let i = 0; i < 80; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const rr = .95 + Math.random() * .55;
      dPos.push(rr * Math.sin(ph) * Math.cos(th), rr * Math.sin(ph) * Math.sin(th), rr * Math.cos(ph));
    }
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dPos), 3));
    oDots = new THREE.Points(dGeo, new THREE.PointsMaterial({ color: C.VIOLET, size: .04, transparent: true, opacity: .55 }));
    oScene.add(oDots);

    window.addEventListener('resize', _resizeOrb);
    oRunning = true;
    _tickOrb();
  }

  function _resizeOrb() {
    if (!oR) return;
    const c = oR.domElement;
    const W = c.clientWidth, H = c.clientHeight;
    oCam.aspect = W / H; oCam.updateProjectionMatrix();
    oR.setSize(W, H, false);
  }

  function _tickOrb() {
    if (!oRunning) return;
    requestAnimationFrame(_tickOrb);
    const t = Date.now() * .001;

    if (oMesh) {
      oMesh.rotation.y = t * .28;
      oMesh.rotation.x = Math.sin(t * .18) * .09;
      const pulse = 1 + Math.sin(t * 1.6) * .016;
      oMesh.scale.setScalar(pulse);
      oMesh.material.color.lerp(oTarget, .025);
      oMesh.material.emissive.copy(oMesh.material.color).multiplyScalar(.38);
    }
    if (oGlow) {
      oGlow.material.color.copy(oMesh.material.color);
      oGlow.material.emissive.copy(oMesh.material.color).multiplyScalar(.6);
    }
    oRings.forEach((ring, i) => {
      ring.rotation.y = t * (.38 + i * .16);
      ring.rotation.z = t * (.08 + i * .06);
    });
    if (oDots) oDots.rotation.y = -t * .12;

    oR.render(oScene, oCam);
  }

  function updateOrb(qualityScore) {
    if (!oMesh) return;
    if      (qualityScore >= 85) oTarget.setHex(C.SUCCESS);
    else if (qualityScore >= 70) oTarget.setHex(C.PURPLE);
    else if (qualityScore >= 55) oTarget.setHex(C.WARN);
    else                         oTarget.setHex(C.DANGER);
  }

  // ══════════════════════════════════════════════════════════
  // 3. IMU ORIENTATION CUBE (Monitor section)
  // ══════════════════════════════════════════════════════════
  let cR, cScene, cCam, cCube;
  let cTarget = { x: 0, y: 0, z: 0 };
  let cRunning = false;

  function initCube() {
    const canvas = document.getElementById('cube-canvas');
    if (!canvas || !window.THREE) return;

    const W = canvas.clientWidth || 280, H = canvas.clientHeight || 280;
    cR = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    cR.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    cR.setSize(W, H, false);

    cScene = new THREE.Scene();
    cCam   = new THREE.PerspectiveCamera(50, W / H, .1, 100);
    cCam.position.set(2.2, 1.6, 2.8);
    cCam.lookAt(0, 0, 0);

    // Lights
    cScene.add(new THREE.AmbientLight(0x223355, 5));
    const pl = new THREE.PointLight(C.VIOLET, 3, 12); pl.position.set(3, 3, 3); cScene.add(pl);
    const pl2 = new THREE.PointLight(C.TEAL, 1.5, 8); pl2.position.set(-2, -2, 1); cScene.add(pl2);

    // Pillow-shaped box (wide, flat, elongated)
    const boxGeo = new THREE.BoxGeometry(1.4, .55, 1.9);
    const mats = [
      new THREE.MeshPhongMaterial({ color: 0x5a4fd6, transparent: true, opacity: .28 }),
      new THREE.MeshPhongMaterial({ color: 0x5a4fd6, transparent: true, opacity: .28 }),
      new THREE.MeshPhongMaterial({ color: 0x4a3fc6, transparent: true, opacity: .28 }),
      new THREE.MeshPhongMaterial({ color: 0x4a3fc6, transparent: true, opacity: .28 }),
      new THREE.MeshPhongMaterial({ color: 0x22D3EE, transparent: true, opacity: .32 }),
      new THREE.MeshPhongMaterial({ color: 0x22D3EE, transparent: true, opacity: .32 }),
    ];
    cCube = new THREE.Mesh(boxGeo, mats);
    cScene.add(cCube);

    // Edges wireframe
    cCube.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeo),
      new THREE.LineBasicMaterial({ color: 0x9D8FFF, transparent: true, opacity: .9 })
    ));

    // Sensor dot on top face
    const dotMesh = new THREE.Mesh(
      new THREE.SphereGeometry(.07, 16, 16),
      new THREE.MeshPhongMaterial({ color: C.TEAL, emissive: C.TEAL, emissiveIntensity: .6 })
    );
    dotMesh.position.set(0, .32, 0);
    cCube.add(dotMesh);

    // World axes (X=red, Y=green, Z=blue)
    [[1,0,0,0xFF3333],[0,1,0,0x33FF88],[0,0,1,0x33AAFF]].forEach(([x,y,z,col]) => {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0,0,0), new THREE.Vector3(x*1.3, y*1.3, z*1.3)
      ]);
      cScene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: .6 })));
    });

    // Ground grid
    const grid = new THREE.GridHelper(5, 10, 0x2a2060, 0x1e1844);
    grid.position.y = -.85;
    cScene.add(grid);

    window.addEventListener('resize', _resizeCube);
    cRunning = true;
    _tickCube();
  }

  function _resizeCube() {
    if (!cR) return;
    const c = cR.domElement;
    const W = c.clientWidth, H = c.clientHeight;
    cCam.aspect = W / H; cCam.updateProjectionMatrix();
    cR.setSize(W, H, false);
  }

  function _tickCube() {
    if (!cRunning) return;
    requestAnimationFrame(_tickCube);
    if (cCube) {
      cCube.rotation.x += (cTarget.x - cCube.rotation.x) * .08;
      cCube.rotation.y += (cTarget.y - cCube.rotation.y) * .08;
      cCube.rotation.z += (cTarget.z - cCube.rotation.z) * .08;
    }
    cR.render(cScene, cCam);
  }

  function updateCube(ax, ay, az) {
    if (!cCube) return;
    cTarget.x = Math.atan2(ay, Math.sqrt(ax * ax + az * az));
    cTarget.z = Math.atan2(-ax, az);
    cTarget.y += .003; // gentle slow auto-spin on Y
  }

  // ══════════════════════════════════════════════════════════
  // 4. ICON 3D CANVAS — one shared renderer, multi-viewport
  //    Replaces the flat SVG metric-icons with spinning 3D shapes
  // ══════════════════════════════════════════════════════════
  let iR, iCanvas;
  const iSlots = [];
  let iRunning = false;

  const SHAPES = {
    moon:      () => new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.18, 16, 60),
      new THREE.MeshPhongMaterial({ color: C.VIOLET, emissive: 0x3a1880, shininess: 90 })
    ),
    bars:      () => {
      const g = new THREE.Group();
      [[-0.38, 0.28, C.PURPLE], [0, 0.52, C.TEAL], [0.38, 0.18, C.VIOLET]].forEach(([x, h, col]) => {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, h, 0.22),
          new THREE.MeshPhongMaterial({ color: col, emissive: col, emissiveIntensity: 0.25 })
        );
        m.position.set(x, h / 2 - 0.35, 0);
        g.add(m);
      });
      return g;
    },
    wave:      () => new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.42, 0.13, 80, 12),
      new THREE.MeshPhongMaterial({ color: C.TEAL, emissive: 0x0a4455, shininess: 110 })
    ),
    pillow:    () => {
      const b = new THREE.BoxGeometry(1.1, 0.45, 0.75);
      const m = new THREE.Mesh(b, new THREE.MeshPhongMaterial({ color: C.PURPLE, emissive: 0x221066, shininess: 60, transparent: true, opacity: 0.9 }));
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(b), new THREE.LineBasicMaterial({ color: C.VIOLET, transparent: true, opacity: 0.85 })));
      return m;
    },
    octa:      () => new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55),
      new THREE.MeshPhongMaterial({ color: C.WARN, emissive: 0x5a1a00, shininess: 100 })
    ),
    icosa:     () => new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.52, 1),
      new THREE.MeshPhongMaterial({ color: C.DANGER, emissive: 0x660000, shininess: 80 })
    ),
    dodeca:    () => new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.52),
      new THREE.MeshPhongMaterial({ color: C.DANGER, emissive: 0x550022, shininess: 120 })
    ),
    hex:       () => new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.5, 0.78, 6),
      new THREE.MeshPhongMaterial({ color: C.SUCCESS, emissive: 0x0a3322, shininess: 100 })
    ),
    sphere:    () => {
      const g = new THREE.Group();
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 10), new THREE.MeshPhongMaterial({ color: C.VIOLET, emissive: 0x2a0888, shininess: 70 }));
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshBasicMaterial({ color: C.PURPLE, wireframe: true, transparent: true, opacity: 0.35 }));
      g.add(s); g.add(w);
      return g;
    },
    ring:      () => new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.08, 8, 72),
      new THREE.MeshPhongMaterial({ color: C.TEAL, emissive: 0x0a4455, shininess: 90 })
    ),
  };

  function _makeIconScene(shapeKey) {
    const scene = new THREE.Scene();
    const cam   = new THREE.PerspectiveCamera(46, 1, 0.1, 10);
    cam.position.z = 2.4;

    scene.add(new THREE.AmbientLight(0x1a0a44, 5));
    const l1 = new THREE.PointLight(C.VIOLET, 6, 12); l1.position.set(1.5, 1.5, 2);   scene.add(l1);
    const l2 = new THREE.PointLight(C.TEAL,   2, 6);  l2.position.set(-1.5, -1, 1);   scene.add(l2);

    const mesh = (SHAPES[shapeKey] || SHAPES.sphere)();
    scene.add(mesh);
    return { scene, cam, mesh };
  }

  function initIconCanvas() {
    if (!window.THREE) return;

    iCanvas = document.createElement('canvas');
    iCanvas.id = 'icons3d-canvas';
    iCanvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3;';
    document.body.appendChild(iCanvas);

    iR = new THREE.WebGLRenderer({ canvas: iCanvas, alpha: true, antialias: false });
    iR.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    iR.setSize(innerWidth, innerHeight);
    iR.autoClear = false;

    const defs = [
      { id: 'icon-quality', shape: 'moon'   },
      { id: 'icon-stage',   shape: 'bars'   },
      { id: 'icon-resp',    shape: 'wave'   },
      { id: 'icon-pos',     shape: 'pillow' },
      { id: 'icon-move',    shape: 'octa'   },
      { id: 'icon-apnea',   shape: 'icosa'  },
      { id: 'icon-risk',    shape: 'dodeca' },
      { id: 'icon-bio',     shape: 'sphere' },
      { id: 'icon-zcs',     shape: 'hex'    },
      { id: 'icon-circ',    shape: 'ring'   },
    ];

    defs.forEach(({ id, shape }) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.opacity = '0'; // hide SVG, show 3D instead
      const slot = _makeIconScene(shape);
      iSlots.push({ el, ...slot, idx: iSlots.length });
    });

    window.addEventListener('resize', () => iR.setSize(innerWidth, innerHeight));
    iRunning = true;
    _tickIcons();
  }

  function _tickIcons() {
    if (!iRunning || !iR) return;
    requestAnimationFrame(_tickIcons);

    const t = Date.now() * 0.001;
    iR.clear();
    iR.setScissorTest(true);

    for (const slot of iSlots) {
      const rect = slot.el.getBoundingClientRect();
      if (!rect.width || rect.bottom < 0 || rect.top > innerHeight) continue;

      const dpr = iR.getPixelRatio();
      const x = Math.round(rect.left   * dpr);
      const y = Math.round((innerHeight - rect.bottom) * dpr);
      const w = Math.round(rect.width  * dpr);
      const h = Math.round(rect.height * dpr);
      if (w < 1 || h < 1) continue;

      iR.setViewport(x, y, w, h);
      iR.setScissor(x, y, w, h);
      slot.cam.aspect = w / h;
      slot.cam.updateProjectionMatrix();

      const spd = 0.55 + slot.idx * 0.04;
      slot.mesh.rotation.x = t * spd * 0.6;
      slot.mesh.rotation.y = t * spd;

      iR.render(slot.scene, slot.cam);
    }

    iR.setScissorTest(false);
  }

  // ══════════════════════════════════════════════════════════
  // 5. CARD TILT — CSS 3D perspective on hover
  // ══════════════════════════════════════════════════════════
  function initCardTilt() {
    const sel = '.metric-card, .chart-card, .cube-card, .orb-hero';
    document.querySelectorAll(sel).forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width  - 0.5;  // -0.5..+0.5
        const ny = (e.clientY - r.top)  / r.height - 0.5;
        card.style.transform     = `perspective(700px) rotateY(${nx * 13}deg) rotateX(${-ny * 9}deg) translateZ(6px)`;
        card.style.boxShadow     = `${-nx * 18}px ${ny * 12}px 32px rgba(123,108,246,0.22)`;
        card.style.borderColor   = 'rgba(123,108,246,0.35)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform   = '';
        card.style.boxShadow   = '';
        card.style.borderColor = '';
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // Init all
  // ══════════════════════════════════════════════════════════
  function init() {
    if (!window.THREE) { console.warn('[ZLEEP] Three.js not loaded'); return; }
    initParticles();
    // Small delay to ensure canvases are rendered and sized
    setTimeout(() => {
      initOrb();
      initCube();
      initIconCanvas();
      initCardTilt();
    }, 250);
  }

  return { init, updateOrb, updateCube };

})();
