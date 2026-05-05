// scene3d.js
// Scène Three.js : ciel, sol, caméra orbitale (rotation à la souris),
// gestion d'un pool de "shells" (feux d'artifice) à base de Points.
//
// API publique :
//   Scene3D.init(canvas)                 -> crée scène + boucle
//   Scene3D.fireEffect(effectDef, opts)  -> tire un feu (opts: {x,y,z})
//   Scene3D.clear()                      -> efface tous les feux en cours

const Scene3D = (() => {
  let scene, camera, renderer, clock;
  let shells = [];              // shells actifs
  let groundY = 0;
  let camYaw = -0.3, camPitch = 0.25, camDist = 140;
  let dragging = false, lastX = 0, lastY = 0;

  function init(canvas) {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05060a, 0.0035);

    // Ciel : gradient simple via large sphère
    const skyGeo = new THREE.SphereGeometry(500, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor:    { value: new THREE.Color(0x05060a) },
        bottomColor: { value: new THREE.Color(0x1a1f33) },
        offset:      { value: 33 },
        exponent:    { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h,0.0), exponent), 0.0)), 1.0);
        }`,
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Étoiles d'arrière-plan
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(800 * 3);
    for (let i = 0; i < 800; i++) {
      const r = 480, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      starPos[i*3]   = r * Math.sin(p) * Math.cos(t);
      starPos[i*3+1] = Math.abs(r * Math.cos(p)) * 0.6 + 5;
      starPos[i*3+2] = r * Math.sin(p) * Math.sin(t);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: true, transparent: true, opacity: 0.6 });
    scene.add(new THREE.Points(starGeo, starMat));

    // Sol
    const groundGeo = new THREE.PlaneGeometry(600, 600, 1, 1);
    const groundMat = new THREE.MeshBasicMaterial({ color: 0x0b0d12 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = groundY;
    scene.add(ground);

    // Grille subtile
    const grid = new THREE.GridHelper(400, 40, 0x223044, 0x141a26);
    grid.position.y = groundY + 0.01;
    scene.add(grid);

    // Caméra
    camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
    updateCamera();

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    clock = new THREE.Clock();

    // Contrôles souris
    canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      camYaw   -= dx * 0.005;
      camPitch -= dy * 0.005;
      camPitch = Math.max(-0.2, Math.min(1.3, camPitch));
      updateCamera();
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      camDist = Math.max(40, Math.min(400, camDist + e.deltaY * 0.1));
      updateCamera();
    }, { passive: false });

    // Resize
    new ResizeObserver(() => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }).observe(canvas);

    animate();
  }

  function updateCamera() {
    const cx = Math.sin(camYaw) * Math.cos(camPitch) * camDist;
    const cy = Math.sin(camPitch) * camDist + 30;
    const cz = Math.cos(camYaw) * Math.cos(camPitch) * camDist;
    camera.position.set(cx, cy, cz);
    camera.lookAt(0, 40, 0);
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    updateShells(dt);
    renderer.render(scene, camera);
  }

  // ----- SHELLS -----

  function makeShell(effectDef, origin) {
    const N = effectDef.particleCount;
    const positions = new Float32Array(N * 3);
    const velocities = new Float32Array(N * 3);
    const colors = new Float32Array(N * 3);
    const alphas = new Float32Array(N);

    const c = Effects.colorToRGB(effectDef.color);
    const c2 = effectDef.secondaryColor ? Effects.colorToRGB(effectDef.secondaryColor) : null;

    for (let i = 0; i < N; i++) {
      positions[i*3]   = origin.x;
      positions[i*3+1] = origin.y;
      positions[i*3+2] = origin.z;

      let dir = randomDirection(effectDef.shape);
      const speed = effectDef.spread * (0.7 + Math.random() * 0.6);
      velocities[i*3]   = dir.x * speed;
      velocities[i*3+1] = dir.y * speed;
      velocities[i*3+2] = dir.z * speed;

      const useSecondary = c2 && Math.random() < 0.4;
      const cc = useSecondary ? c2 : c;
      colors[i*3]   = cc.r;
      colors[i*3+1] = cc.g;
      colors[i*3+2] = cc.b;

      alphas[i] = 1.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 1.6 + (effectDef.shellSize || 4) * 0.25,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // Trail (Points secondaire qui hérite des positions)
    let trail = null;
    if (effectDef.trail) {
      const trailGeo = new THREE.BufferGeometry();
      const trailMaxParticles = N * 6;
      const tPos = new Float32Array(trailMaxParticles * 3);
      const tCol = new Float32Array(trailMaxParticles * 3);
      const tLife = new Float32Array(trailMaxParticles);
      for (let i = 0; i < trailMaxParticles; i++) tLife[i] = 0;
      trailGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
      trailGeo.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
      const trailMat = new THREE.PointsMaterial({
        size: 0.9, vertexColors: true, transparent: true, opacity: 0.8,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      trail = { points: new THREE.Points(trailGeo, trailMat), life: tLife, max: trailMaxParticles, head: 0 };
      scene.add(trail.points);
    }

    return {
      effect: effectDef,
      points,
      velocities,
      alphas,
      age: 0,
      duration: effectDef.duration,
      gravity: effectDef.gravity,
      drag: effectDef.drag,
      trail,
    };
  }

  function randomDirection(shape) {
    // Distributions selon la forme du break
    if (shape === 'ring') {
      const a = Math.random() * Math.PI * 2;
      return { x: Math.cos(a), y: (Math.random() - 0.5) * 0.05, z: Math.sin(a) };
    }
    if (shape === 'palm' || shape === 'comet') {
      // cône vers le haut
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.4;
      return { x: Math.cos(a) * r, y: 1 - r * 0.3, z: Math.sin(a) * r };
    }
    if (shape === 'willow') {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.7 + 0.2;
      return { x: Math.cos(a) * r, y: 0.5 + Math.random() * 0.5, z: Math.sin(a) * r };
    }
    // sphère uniforme (peony / chrysanthemum / brocade / crossette / flash)
    const u = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return { x: s * Math.cos(t), y: u, z: s * Math.sin(t) };
  }

  function updateShells(dt) {
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i];
      s.age += dt;
      const lifeT = s.age / s.duration;
      const pos = s.points.geometry.attributes.position.array;
      const N = s.alphas.length;

      for (let p = 0; p < N; p++) {
        // appliquer gravité + drag
        s.velocities[p*3+1] -= s.gravity * dt;
        s.velocities[p*3]   *= s.drag;
        s.velocities[p*3+1] *= s.drag;
        s.velocities[p*3+2] *= s.drag;

        pos[p*3]   += s.velocities[p*3]   * dt;
        pos[p*3+1] += s.velocities[p*3+1] * dt;
        pos[p*3+2] += s.velocities[p*3+2] * dt;

        s.alphas[p] = 1 - lifeT;
      }
      s.points.geometry.attributes.position.needsUpdate = true;

      // fade global via opacity (économise vertex shader custom)
      s.points.material.opacity = Math.max(0, 1 - lifeT * 1.05);

      // trail : dépose des particules à la position courante
      if (s.trail && lifeT < 0.7) {
        const tg = s.trail.points.geometry;
        const tPos = tg.attributes.position.array;
        const tCol = tg.attributes.color.array;
        const baseCol = s.points.geometry.attributes.color.array;
        const sample = Math.min(20, N);
        for (let k = 0; k < sample; k++) {
          const idx = Math.floor(Math.random() * N);
          const head = s.trail.head;
          tPos[head*3]   = pos[idx*3];
          tPos[head*3+1] = pos[idx*3+1];
          tPos[head*3+2] = pos[idx*3+2];
          tCol[head*3]   = baseCol[idx*3];
          tCol[head*3+1] = baseCol[idx*3+1];
          tCol[head*3+2] = baseCol[idx*3+2];
          s.trail.life[head] = 0.9;
          s.trail.head = (s.trail.head + 1) % s.trail.max;
        }
        // décay des particules de trail
        for (let m = 0; m < s.trail.max; m++) {
          if (s.trail.life[m] > 0) s.trail.life[m] -= dt * 0.7;
        }
        tg.attributes.position.needsUpdate = true;
        tg.attributes.color.needsUpdate = true;
        s.trail.points.material.opacity = 0.7 * (1 - lifeT);
      }

      // shell terminé ?
      if (s.age >= s.duration) {
        scene.remove(s.points);
        s.points.geometry.dispose();
        s.points.material.dispose();
        if (s.trail) {
          scene.remove(s.trail.points);
          s.trail.points.geometry.dispose();
          s.trail.points.material.dispose();
        }
        shells.splice(i, 1);
      }
    }
  }

  function fireEffect(effectDef, opts = {}) {
    if (!effectDef) return;
    const origin = {
      x: opts.x ?? (Math.random() - 0.5) * 80,
      y: opts.y ?? 50 + Math.random() * 30,
      z: opts.z ?? (Math.random() - 0.5) * 80,
    };
    // Petite "comète" montante avant le break si shellSize >= 4
    if (effectDef.shape !== 'comet' && effectDef.shellSize >= 4) {
      const cometEffect = {
        ...effectDef,
        particleCount: 18,
        duration: 0.45,
        spread: 1.5,
        gravity: 2,
        drag: 0.96,
        shape: 'comet',
        shellSize: 1,
        color: effectDef.color,
        secondaryColor: null,
        trail: true,
      };
      const launchOrigin = { x: origin.x, y: 5, z: origin.z };
      const c = makeShell(cometEffect, launchOrigin);
      // bias vélocités vers le haut → on remplace
      for (let i = 0; i < cometEffect.particleCount; i++) {
        c.velocities[i*3]   = (Math.random() - 0.5) * 1.5;
        c.velocities[i*3+1] = (origin.y - 5) / 0.45;
        c.velocities[i*3+2] = (Math.random() - 0.5) * 1.5;
      }
      shells.push(c);
      // déclenchement différé du break
      setTimeout(() => shells.push(makeShell(effectDef, origin)), 430);
      return;
    }
    shells.push(makeShell(effectDef, origin));
  }

  function clear() {
    for (const s of shells) {
      scene.remove(s.points);
      s.points.geometry.dispose();
      s.points.material.dispose();
      if (s.trail) {
        scene.remove(s.trail.points);
        s.trail.points.geometry.dispose();
        s.trail.points.material.dispose();
      }
    }
    shells = [];
  }

  return { init, fireEffect, clear };
})();

window.Scene3D = Scene3D;
