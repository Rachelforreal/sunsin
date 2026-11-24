// VICE SUN '86 - 1980s Miami Coastal City, Art Deco Landmarks, Props & Day-to-Night Cycle
window.VS = window.VS || {};

VS.World = class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // { minX, maxX, minZ, maxZ, height, label }
    this.props = [];     // Knockable props { mesh, x, y, z, vx, vy, vz, rx, rz, radius, knocked, resetTimer }
    this.palms = [];     // Palm frond groups for gentle breeze sway
    this.neonMats = [];  // Emissive materials brightened at dusk/night
    this.windowMats = [];
    this.lampHalos = [];
    this.lampPoints = [];
    this.particles = []; // Pooled/managed particles
    this.pickups = [];   // Floating cash / health / weapon pickups
    this.packageMeshes = []; this.collectedPackages = {};
    this.ramps = [];     // Inclined 3D stunt jump ramps
    this.skidMarks = []; // Ring buffer of skid mark quads
    this.skidIndex = 0;

    this.timeOfDay = VS.CONFIG.START_HOUR; // 0..24
    this.oceanTime = 0;

    // Shared geometries/materials for particles
    this.partGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    this.smokeGeo = new THREE.DodecahedronGeometry(0.45, 0);

    this._initSkyAndLights();
    this._buildTerrainAndRoads();
    this._buildCityBlocks();
    this._buildLandmarks();
    this._buildBeachAndOcean();
    this._buildStreetDetails();
    this._initSkidPool();
    this._buildStarfishIsland();
    this._buildHiddenPackages();
    this.updateDayNight(0);
  }

  _makeSignTexture(text, bgColor, fgColor, glowColor) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 112);
    ctx.font = 'italic 900 54px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = fgColor;
    ctx.fillText(text, 256, 66);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  _makeWindowTextures(baseHex, cols = 8, rows = 10) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    const em = document.createElement('canvas');
    em.width = 256; em.height = 256;
    const ectx = em.getContext('2d');
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, 256, 256);

    const padX = 256 / cols;
    const padY = 256 / rows;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const lit = Math.random() > 0.42;
        const wx = col * padX + 4;
        const wy = r * padY + 4;
        const ww = Math.max(4, padX - 8);
        const wh = Math.max(4, padY - 8);
        // Frame
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
        // Glass pane
        ctx.fillStyle = lit ? '#3d5a73' : '#1e2c3e';
        ctx.fillRect(wx, wy, ww, wh);
        if (lit) {
          ectx.fillStyle = Math.random() > 0.25 ? '#ffe394' : '#7df9ff';
          ectx.fillRect(wx, wy, ww, wh);
        }
      }
    }
    const mapTex = new THREE.CanvasTexture(c);
    mapTex.wrapS = mapTex.wrapT = THREE.RepeatWrapping;
    const emTex = new THREE.CanvasTexture(em);
    emTex.wrapS = emTex.wrapT = THREE.RepeatWrapping;
    return { mapTex, emTex };
  }

  _makeAsphaltTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2a2e38';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3200; i++) {
      const v = 34 + Math.floor(Math.random() * 24);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 7})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }

  _makeSidewalkTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c5b8a5';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#9f907c';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 62, 62);
    ctx.strokeRect(65, 1, 62, 62);
    ctx.strokeRect(1, 65, 62, 62);
    ctx.strokeRect(65, 65, 62, 62);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 40);
    return tex;
  }

  _initSkyAndLights() {
    // Gradient sky dome shader
    const skyGeo = new THREE.SphereGeometry(580, 24, 16);
    this.skyUniforms = {
      topColor: { value: new THREE.Color(0x1f8fff) },
      horizonColor: { value: new THREE.Color(0x9be7ff) },
      bottomColor: { value: new THREE.Color(0xffe6d0) },
      starStrength: { value: 0.0 }
    };
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        uniform float starStrength;
        varying vec3 vWorldPos;
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        void main() {
          vec3 dir = normalize(vWorldPos);
          float h = dir.y;
          vec3 col = h >= 0.0
            ? mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55))
            : mix(horizonColor, bottomColor, clamp(-h * 3.0, 0.0, 1.0));
          if (starStrength > 0.02 && h > 0.08) {
            vec2 grid = floor(dir.xz / (dir.y + 0.15) * 90.0);
            float n = hash(grid);
            if (n > 0.994) {
              col += vec3(1.0, 0.95, 1.0) * starStrength * smoothstep(0.08, 0.35, h);
            }
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    // Sun & Moon discs
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff0a8, fog: false });
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 12), sunMat);
    this.scene.add(this.sunMesh);

    const moonMat = new THREE.MeshBasicMaterial({ color: 0xdbeafe, fog: false });
    this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(14, 14, 10), moonMat);
    this.scene.add(this.moonMesh);

    // Lights
    this.hemiLight = new THREE.HemisphereLight(0x9be7ff, 0x7c5a46, 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff3d6, 1.3);
    this.sunLight.position.set(120, 180, 70);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 20;
    this.sunLight.shadow.camera.far = 520;
    const d = 170;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.scene.fog = new THREE.FogExp2(0x9be7ff, 0.0021);
  }

  _buildTerrainAndRoads() {
    const cfg = VS.CONFIG;
    // Expanded concrete city ground (covers X: -360..+136, Z: -360..+320)
    const groundMat = new THREE.MeshLambertMaterial({ map: this._makeSidewalkTexture() });
    const cityBase = new THREE.Mesh(new THREE.BoxGeometry(500, 0.4, 700), groundMat);
    cityBase.position.set(-114, -0.2, -20);
    cityBase.receiveShadow = true;
    this.scene.add(cityBase);

    const asphaltTex = this._makeAsphaltTexture();
    const roadMat = new THREE.MeshLambertMaterial({ map: asphaltTex });
    const yellowLineMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    const whiteLineMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });

    // North-South Avenues (Z from -345 to +305)
    for (const ax of cfg.AVENUE_X) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(cfg.ROAD_WIDTH, 660), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(ax, 0.025, -20);
      road.receiveShadow = true;
      this.scene.add(road);

      // Dashed yellow centerlines between intersections
      for (let z = -332; z <= 292; z += 12) {
        if (cfg.STREET_Z.some((sz) => Math.abs(z - sz) < 13)) continue;
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 5.5), yellowLineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(ax, 0.04, z);
        this.scene.add(dash);
      }
    }

    // East-West Cross Streets (X from -345 to +135)
    for (const sz of cfg.STREET_Z) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(475, cfg.ROAD_WIDTH), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(-105, 0.03, sz);
      road.receiveShadow = true;
      this.scene.add(road);

      for (let x = -332; x <= 128; x += 12) {
        if (cfg.AVENUE_X.some((ax) => Math.abs(x - ax) < 13)) continue;
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 0.35), yellowLineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.045, sz);
        this.scene.add(dash);
      }
    }

    // Crosswalks at every intersection
    for (const ax of cfg.AVENUE_X) {
      for (const sz of cfg.STREET_Z) {
        for (let s = -6; s <= 6; s += 2.4) {
          [-11.5, 11.5].forEach((dz) => {
            const cw = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 3.0), whiteLineMat);
            cw.rotation.x = -Math.PI / 2;
            cw.position.set(ax + s, 0.048, sz + dz);
            this.scene.add(cw);
          });
          [-11.5, 11.5].forEach((dx) => {
            const cw = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.1), whiteLineMat);
            cw.rotation.x = -Math.PI / 2;
            cw.position.set(ax + dx, 0.048, sz + s);
            this.scene.add(cw);
          });
        }
      }
    }

    // Expanded perimeter seawall / boundary hedges (X = -346, Z = -346..+306)
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xe6d5c3 });
    this._addStaticBox(-346, 0, -20, 4, 3.5, 656, wallMat, 'West Boundary');
    this._addStaticBox(-80, 0, -346, 536, 3.5, 4, wallMat, 'North Boundary');
    this._addStaticBox(-80, 0, 306, 536, 3.5, 4, wallMat, 'South Boundary');
  }

  _addStaticBox(cx, yBase, cz, w, h, d, mat, label = 'building', registerCollider = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(cx, yBase + h / 2, cz);
    mesh.castShadow = h > 1.2;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (registerCollider) {
      this.colliders.push({
        minX: cx - w / 2,
        maxX: cx + w / 2,
        minZ: cz - d / 2,
        maxZ: cz + d / 2,
        height: yBase + h,
        label
      });
    }
    return mesh;
  }

  _addArtDecoBuilding(cx, cz, w, h, d, bodyColor, neonColor, signText = null, faceEast = false) {
    // Windowed walls texture with true emissive night-glow mask
    const { mapTex, emTex } = this._makeWindowTextures(
      '#' + bodyColor.toString(16).padStart(6, '0'),
      Math.max(5, Math.round(w / 3.4)),
      Math.max(4, Math.round(h / 3.2))
    );
    const wallMat = new THREE.MeshLambertMaterial({
      map: mapTex,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: emTex,
      emissiveIntensity: 0.05
    });
    this.windowMats.push(wallMat);

    const roofMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const mats = [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat];
    this._addStaticBox(cx, 0.14, cz, w, h, d, mats, signText || 'Art Deco Building', true);

    // Art Deco stepped crown parapet + rooftop AC/skylight details
    const crownMat = new THREE.MeshLambertMaterial({ color: 0xfff8f0 });
    this._addStaticBox(cx, 0.14 + h, cz, w * 0.72, 2.2, d * 0.72, crownMat, '', false);
    const acMat = new THREE.MeshLambertMaterial({ color: 0x64748b });
    const acUnit = new THREE.Mesh(new THREE.BoxGeometry(Math.min(4.2, w * 0.25), 1.4, Math.min(3.6, d * 0.25)), acMat);
    acUnit.position.set(cx + w * 0.14, 0.14 + h + 2.7, cz - d * 0.12);
    this.scene.add(acUnit);

    // Ground-floor dark glass storefront plinth + horizontal awning eyebrow
    const shopMat = new THREE.MeshPhongMaterial({ color: 0x162436, shininess: 95, specular: 0x90e0ef });
    const shop = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, 3.6, d + 0.18), shopMat);
    shop.position.set(cx, 2.0, cz);
    this.scene.add(shop);
    const ledgeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, 0.52, d + 1.6), ledgeMat);
    ledge.position.set(cx, 4.4, cz);
    ledge.castShadow = true;
    this.scene.add(ledge);

    // Glowing Neon Trim Band along roofline, awning & vertical Art Deco fin
    const neonMat = new THREE.MeshStandardMaterial({
      color: neonColor,
      emissive: neonColor,
      emissiveIntensity: 0.75,
      roughness: 0.3
    });
    this.neonMats.push(neonMat);

    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.45, d + 0.35), neonMat);
    trim.position.set(cx, 0.14 + h - 0.5, cz);
    this.scene.add(trim);

    const lowerTrim = new THREE.Mesh(new THREE.BoxGeometry(w + 1.7, 0.25, d + 1.7), neonMat);
    lowerTrim.position.set(cx, 4.7, cz);
    this.scene.add(lowerTrim);

    // Vertical Art Deco neon accent stripe on street-facing side
    const vStripe = new THREE.Mesh(new THREE.BoxGeometry(faceEast ? 0.3 : 0.45, h * 0.65, faceEast ? 0.45 : 0.3), neonMat);
    vStripe.position.set(faceEast ? cx + w / 2 + 0.22 : cx, 4.8 + h * 0.32, faceEast ? cz : cz + d / 2 + 0.22);
    this.scene.add(vStripe);

    // Optional iconic neon hotel sign
    if (signText) {
      const signTex = this._makeSignTexture(signText, '#140c24', '#ffffff', '#' + neonColor.toString(16).padStart(6, '0'));
      const signMat = new THREE.MeshBasicMaterial({ map: signTex });
      const signW = Math.min(w * 0.85, 16);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(faceEast ? 0.5 : signW, 3.2, faceEast ? signW : 0.5), signMat);
      if (faceEast) {
        sign.position.set(cx + w / 2 + 0.4, Math.min(h - 1.5, 9.5), cz);
      } else {
        sign.position.set(cx, Math.min(h - 1.5, 9.5), cz + d / 2 + 0.4);
      }
      this.scene.add(sign);
    }
  }

  _buildCityBlocks() {
    // Blocks lie neatly between AVENUE_X = [-180, -80, 20, 120] and STREET_Z = [-180, -80, 20, 120]
    // Block centers: X in [-130, -30, 70], Z in [-130, -30, 70]
    // Outer ring blocks also exist on West (-215), North (-215), South (165)
    const pastelPalette = [0xffb5c2, 0x9bf6ff, 0xffd6a5, 0xfdf0d5, 0xa0e7e5, 0xffc6ff, 0xfefae0, 0x90dbf4];
    const neonPalette = [0xff2a85, 0x00f0ff, 0xff9f1c, 0x4ef2b8, 0xc77dff];
    const hotelNames = ['STARLIGHT', 'COLONY', 'PALM ROYALE', 'CLEVELANDER', 'VICE PALACE', 'OCEAN VIEW', 'FLAMINGO', 'TROPICANA'];
    let hotelIdx = 0;

    // Raised sidewalk slab for each expanded city block (4x5 = 20 city blocks!)
    const curbMat = new THREE.MeshLambertMaterial({ color: 0xc2b5a2 });
    const blockXs = [-230, -130, -30, 70];
    const blockZs = [-230, -130, -30, 70, 170];

    for (let bi = 0; bi < blockXs.length; bi++) {
      for (let bj = 0; bj < blockZs.length; bj++) {
        const bx = blockXs[bi];
        const bz = blockZs[bj];

        // Westport Cargo Airfield spans (bx = -230, bz = -30..70) flush with ground (omit raised slab so runway is flush!)
        if (bx === -230 && (bz === -30 || bz === 70)) {
          if (bz === -30) this._buildWestportAirfield();
          continue;
        }

        // Raised sidewalk platform (size 78x78 inside the 100x100 road grid; leaves 11m each side = 9m half road + 2m gutter)
        const slab = new THREE.Mesh(new THREE.BoxGeometry(78, 0.18, 78), curbMat);
        slab.position.set(bx, 0.08, bz);
        slab.receiveShadow = true;
        this.scene.add(slab);

        // Special blocks reserved for iconic landmarks!
        // 1) Garage District Block: bx = -130, bz = 70
        if (bx === -130 && bz === 70) continue;
        // 2) Little Havana Plaza Block: bx = -30, bz = 70 (open courtyard + perimeter shops)
        if (bx === -30 && bz === 70) {
          this._buildHavanaPlaza(bx, bz);
          continue;
        }
        // 3) Club Malibu Block: bx = 70, bz = -130
        if (bx === 70 && bz === -130) {
          this._buildClubMalibuBlock(bx, bz);
          continue;
        }
        // 4) VCPD Precinct Block: bx = -130, bz = -130
        if (bx === -130 && bz === -130) {
          this._buildPrecinctBlock(bx, bz);
          continue;
        }
        // 5) Ocean View Hospital Block: bx = -30, bz = -130
        if (bx === -30 && bz === -130) {
          this._buildHospitalBlock(bx, bz);
          continue;
        }
        // 6) North Bay Resorts & Coastal Helipad Plaza: bx = 70, bz = -230
        if (bx === 70 && bz === -230) {
          this._buildNorthBayHelipad(bx, bz);
          continue;
        }

        // Ocean Drive strip (bx === 70): Iconic Pastel Art Deco Boutique Hotels facing the beach!
        if (bx === 70) {
          const slots = [
            { dx: 16, dz: -20, w: 26, d: 28, h: 14 + (bj % 2) * 5 },
            { dx: 16, dz: 18, w: 26, d: 28, h: 16 + ((bj + 1) % 2) * 6 },
            { dx: -18, dz: -18, w: 24, d: 26, h: 20 },
            { dx: -18, dz: 18, w: 24, d: 26, h: 17 }
          ];
          slots.forEach((s, idx) => {
            const col = pastelPalette[(hotelIdx + idx) % pastelPalette.length];
            const neo = neonPalette[(hotelIdx + idx) % neonPalette.length];
            const sign = s.dx > 0 ? hotelNames[hotelIdx % hotelNames.length] : null;
            if (sign) hotelIdx++;
            this._addArtDecoBuilding(bx + s.dx, bz + s.dz, s.w, s.h, s.d, col, neo, sign, s.dx > 0);
          });
        } else {
          // Downtown Miami mid-rise & high-rise towers
          const towers = [
            { dx: -18, dz: -18, w: 24, d: 24, h: 26 + ((bi * 3 + bj) % 3) * 12 },
            { dx: 18, dz: -16, w: 24, d: 24, h: 22 + ((bi + bj * 2) % 3) * 10 },
            { dx: -16, dz: 18, w: 24, d: 24, h: 18 + ((bi + bj) % 2) * 11 },
            { dx: 18, dz: 18, w: 24, d: 24, h: 32 + ((bi * 2 + bj) % 2) * 14 }
          ];
          if (bx === -30 && bz === -30) this._buildDowntownParkingDeck(-12, -12);
          towers.forEach((t, idx) => {
            if (bx === -30 && bz === -30 && idx === 3) return;
            const col = idx % 2 === 0 ? 0xeef4f8 : pastelPalette[(bi + bj + idx) % pastelPalette.length];
            const neo = neonPalette[(bi + bj + idx) % neonPalette.length];
            this._addArtDecoBuilding(bx + t.dx, bz + t.dz, t.w, t.h, t.d, col, neo, null, false);
          });
        }
      }
    }

    // Perimeter skyline buildings along expanded North (z = -314), South (z = 266), West (x = -314)
    for (let x = -260; x <= 90; x += 65) {
      this._addArtDecoBuilding(x, -314, 30, 20 + ((Math.abs(x) / 10) % 3) * 10, 26, pastelPalette[Math.abs(x) % pastelPalette.length], neonPalette[Math.abs(x) % neonPalette.length], null, false);
      if (x < 70) {
        this._addArtDecoBuilding(x, 266, 30, 15 + ((Math.abs(x) / 10) % 2) * 8, 24, pastelPalette[(Math.abs(x) + 3) % pastelPalette.length], neonPalette[(Math.abs(x) + 1) % neonPalette.length], null, false);
      }
    }
    for (let z = -250; z <= 220; z += 65) {
      this._addArtDecoBuilding(-314, z, 26, 22 + ((Math.abs(z) / 10) % 3) * 9, 32, 0xe8edf2, neonPalette[Math.abs(z) % neonPalette.length], null, true);
    }
  }

  _buildHavanaPlaza(bx, bz) {
    // Open tropical courtyard plaza with central fountain + surrounding low shops (great for combat & Debt Collection mission!)
    const plazaFloor = new THREE.Mesh(new THREE.BoxGeometry(74, 0.22, 74), new THREE.MeshLambertMaterial({ color: 0xf3d5b5 }));
    plazaFloor.position.set(bx, 0.09, bz);
    plazaFloor.receiveShadow = true;
    this.scene.add(plazaFloor);

    // Fountain centerpiece
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7, 1.1, 16), new THREE.MeshLambertMaterial({ color: 0xfff3e0 }));
    rim.position.set(bx, 0.65, bz);
    rim.castShadow = true;
    this.scene.add(rim);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.9, 16), new THREE.MeshLambertMaterial({ color: 0x00d9ff }));
    water.position.set(bx, 0.85, bz);
    this.scene.add(water);
    this.colliders.push({ minX: bx - 6.5, maxX: bx + 6.5, minZ: bz - 6.5, maxZ: bz + 6.5, height: 1.5, label: 'Fountain' });

    // Corner cafes
    this._addArtDecoBuilding(bx - 24, bz - 24, 20, 10, 18, 0xffb703, 0xff2a85, 'CAFE HAVANA', false);
    this._addArtDecoBuilding(bx + 24, bz - 24, 20, 11, 18, 0x8ecae6, 0x00f0ff, null, false);
  }

  _buildClubMalibuBlock(bx, bz) {
    // Iconic Neon Club Malibu main tower + Open-Entry Walk-In Neon VIP Lounge Pavilion
    this._addArtDecoBuilding(bx - 10, bz - 12, 38, 16, 28, 0x2c1b47, 0xff2a85, 'CLUB MALIBU', true);

    const neonCyan = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 1.0, roughness: 0.3 });
    const neonPink = new THREE.MeshStandardMaterial({ color: 0xff2a85, emissive: 0xff2a85, emissiveIntensity: 1.0, roughness: 0.3 });
    this.neonMats.push(neonCyan, neonPink);

    const arch = new THREE.Mesh(new THREE.BoxGeometry(12, 0.6, 5), neonCyan);
    arch.position.set(bx + 15, 5.2, bz - 12);
    this.scene.add(arch);

    // Open-Entry Walk-In Neon VIP Lounge Pavilion at (cx = 92, cz = -112)
    const cx = 92, cz = -112;
    const darkFloor = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.05, 22),
      new THREE.MeshLambertMaterial({ color: 0x120d24 })
    );
    darkFloor.position.set(cx, 0.18, cz);
    darkFloor.receiveShadow = true;
    this.scene.add(darkFloor);

    // Glowing checker pink/cyan dancefloor tiles at y = 0.22
    const tileGeo = new THREE.BoxGeometry(2.65, 0.08, 2.65);
    for (let ix = 0; ix < 4; ix++) {
      for (let iz = 0; iz < 4; iz++) {
        const tile = new THREE.Mesh(tileGeo, (ix + iz) % 2 === 0 ? neonPink : neonCyan);
        tile.position.set(cx + (ix - 1.5) * 2.9, 0.22, cz + (iz - 1.5) * 2.9);
        this.scene.add(tile);
      }
    }

    // Roof canopy at y = 5.4 (no roof collider so player walks freely inside)
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x23143d });
    this._addStaticBox(cx, 5.1, cz, 22, 0.6, 22, canopyMat, 'VIP Canopy', false);
    const trimTop = new THREE.Mesh(new THREE.BoxGeometry(22.5, 0.24, 22.5), neonPink);
    trimTop.position.set(cx, 5.55, cz);
    this.scene.add(trimTop);
    const trimBot = new THREE.Mesh(new THREE.BoxGeometry(22.3, 0.18, 22.3), neonCyan);
    trimBot.position.set(cx, 5.05, cz);
    this.scene.add(trimBot);

    const vipSignTex = this._makeSignTexture('MALIBU VIP', '#180b2e', '#ffffff', '#ff2a85');
    const vipSignMat = new THREE.MeshBasicMaterial({ map: vipSignTex });
    const vipSign = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.1, 11), vipSignMat);
    vipSign.position.set(cx + 11.1, 6.6, cz);
    this.scene.add(vipSign);

    // Neon bar counter at rear (visual, open lounge interior)
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(10.5, 1.15, 1.5), new THREE.MeshLambertMaterial({ color: 0x1b1333 }));
    barBase.position.set(cx, 0.78, cz - 6.9);
    barBase.castShadow = true;
    this.scene.add(barBase);
    const barTop = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.16, 1.75), neonCyan);
    barTop.position.set(cx, 1.42, cz - 6.9);
    this.scene.add(barTop);
    const barBackNeon = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.22, 0.25), neonPink);
    barBackNeon.position.set(cx, 2.75, cz - 7.8);
    this.scene.add(barBackNeon);

    // Side & back structural pillars ONLY (registered colliders sized for LOS & gunfight cover; front/side entries wide open!)
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0xf8edeb });
    const coverPillars = [
      [cx - 9.4, cz - 4.5, 3.4, 4.2],
      [cx + 9.4, cz - 4.5, 3.4, 4.2],
      [cx,       cz - 9.8, 11.0, 3.8]
    ];
    coverPillars.forEach(([px, pz, pw, pd]) => {
      this._addStaticBox(px, 0.17, pz, pw, 5.0, pd, pillarMat, 'Club Malibu Pillar', true);
    });

    this.spawnPickup(92, -112, 'health', 50);
  }

  _buildNorthBayHelipad(bx, bz) {
    // Two pastel resort towers on the west half framing the coastal East-facing Helipad Plaza
    this._addArtDecoBuilding(bx - 18, bz - 18, 26, 26, 26, 0x9bf6ff, 0xff2a85, 'BAYSHORE', true);
    this._addArtDecoBuilding(bx - 18, bz + 18, 26, 24, 26, 0xffd6a5, 0x00f0ff, 'MARINA BAY', true);

    const hx = bx + 16, hz = bz;
    const deckMat = new THREE.MeshLambertMaterial({ color: 0xe2e8f0 });
    const padConcreteMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 });
    const padAsphaltMat = new THREE.MeshLambertMaterial({ color: 0x262c38 });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const padNeon = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 1.0, roughness: 0.3 });
    this.neonMats.push(padNeon);

    // Coastal terrace + raised helipad deck (no blocking AABB collider so player can walk/drive onto pad)
    this._addStaticBox(hx, 0.17, hz, 34, 0.16, 46, deckMat, 'Helipad Terrace', false);
    this._addStaticBox(hx, 0.33, hz, 22, 0.24, 22, padConcreteMat, 'Helipad Base', false);

    const padDisk = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 9.6, 0.06, 28), padAsphaltMat);
    padDisk.position.set(hx, 0.58, hz);
    padDisk.receiveShadow = true;
    this.scene.add(padDisk);

    // Painted white 'H' circle
    const ring = new THREE.Mesh(new THREE.RingGeometry(7.5, 8.4, 32), whiteMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(hx, 0.62, hz);
    this.scene.add(ring);

    const hBarGeoV = new THREE.PlaneGeometry(1.3, 8.0);
    [-2.7, 2.7].forEach((dx) => {
      const bar = new THREE.Mesh(hBarGeoV, whiteMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(hx + dx, 0.622, hz);
      this.scene.add(bar);
    });
    const hCross = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.3), whiteMat);
    hCross.rotation.x = -Math.PI / 2;
    hCross.position.set(hx, 0.622, hz);
    this.scene.add(hCross);

    // Perimeter beacon lights around raised helipad
    [[-9.8, -9.8], [9.8, -9.8], [-9.8, 9.8], [9.8, 9.8]].forEach(([dx, dz]) => {
      const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.35, 0.65), padNeon);
      beacon.position.set(hx + dx, 0.72, hz + dz);
      this.scene.add(beacon);
    });
  }

  _buildWestportAirfield() {
    // Concrete airfield tarmac apron spanning Westport blocks (-230, -30..70)
    const tarmacMat = new THREE.MeshLambertMaterial({
      color: 0x383f4c,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    const tarmac = new THREE.Mesh(new THREE.PlaneGeometry(72, 186), tarmacMat);
    tarmac.rotation.x = -Math.PI / 2;
    tarmac.position.set(-236, 0.047, 20);
    tarmac.receiveShadow = true;
    this.scene.add(tarmac);

    // Flush dark-asphalt runway strip centered at x = -230, z = 20 (width: 28, length: 185, y = 0.05)
    const rwyMat = new THREE.MeshLambertMaterial({
      map: this._makeAsphaltTexture(),
      color: 0x6f7785,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2
    });
    const runway = new THREE.Mesh(new THREE.PlaneGeometry(28, 185), rwyMat);
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(-230, 0.05, 20);
    runway.receiveShadow = true;
    this.scene.add(runway);

    // White threshold piano-key stripes, edge lines & dashed centerline
    const markMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3
    });
    [-12.8, 12.8].forEach((dx) => {
      const edgeLine = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 181), markMat);
      edgeLine.rotation.x = -Math.PI / 2;
      edgeLine.position.set(-230 + dx, 0.058, 20);
      this.scene.add(edgeLine);
    });
    const keyGeo = new THREE.PlaneGeometry(1.45, 8.2);
    [-65.5, 105.5].forEach((tz) => {
      for (let kx = -10.5; kx <= 10.5; kx += 3.0) {
        const key = new THREE.Mesh(keyGeo, markMat);
        key.rotation.x = -Math.PI / 2;
        key.position.set(-230 + kx, 0.058, tz);
        this.scene.add(key);
      }
    });
    const dashGeo = new THREE.PlaneGeometry(0.65, 6.5);
    for (let z = -54; z <= 94; z += 12) {
      const dash = new THREE.Mesh(dashGeo, markMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(-230, 0.058, z);
      this.scene.add(dash);
    }

    // Glowing cyan runway edge lights
    const edgeLightMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 1.05,
      roughness: 0.3
    });
    const navPinkMat = new THREE.MeshStandardMaterial({
      color: 0xff2a85,
      emissive: 0xff2a85,
      emissiveIntensity: 1.0,
      roughness: 0.3
    });
    this.neonMats.push(edgeLightMat, navPinkMat);

    const bulbGeo = new THREE.BoxGeometry(0.48, 0.42, 0.48);
    for (let z = -70; z <= 110; z += 18) {
      // Leave west taxiway mouth open in front of cargo hangar (z = 4..36)
      if (z < 4 || z > 36) {
        const wl = new THREE.Mesh(bulbGeo, edgeLightMat);
        wl.position.set(-244.6, 0.26, z);
        this.scene.add(wl);
      }
      const el = new THREE.Mesh(bulbGeo, edgeLightMat);
      el.position.set(-215.4, 0.26, z);
      this.scene.add(el);
    }

    // Open-front Cargo Hangar at (x = -256, z = 20): side & back walled colliders, open east bay, roof at y = 7.5
    const hangarWallMat = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });
    const hangarRoofMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    this._addStaticBox(-256, 0, 6, 22, 7.5, 1.2, hangarWallMat, 'Hangar North Wall', true);
    this._addStaticBox(-256, 0, 34, 22, 7.5, 1.2, hangarWallMat, 'Hangar South Wall', true);
    this._addStaticBox(-266.4, 0, 20, 1.2, 7.5, 29.2, hangarWallMat, 'Hangar Back Wall', true);
    this._addStaticBox(-256, 7.5, 20, 23, 0.9, 30.2, hangarRoofMat, 'Hangar Roof', false);

    // Neon hangar bay beam & 'WESTPORT AIR' rooftop neon sign
    const bayTrim = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 29.8), edgeLightMat);
    bayTrim.position.set(-244.5, 7.45, 20);
    this.scene.add(bayTrim);

    const signTex = this._makeSignTexture('WESTPORT AIR', '#0d1528', '#ffffff', '#00f0ff');
    const signFaceMat = new THREE.MeshBasicMaterial({ map: signTex });
    const signFrameMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const signMats = [signFaceMat, signFaceMat, signFrameMat, signFrameMat, signFrameMat, signFrameMat];
    const roofSign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.4, 19), signMats);
    roofSign.position.set(-246.2, 10.1, 20);
    this.scene.add(roofSign);

    // Free $200 cash pickup inside open hangar bay
    this.spawnPickup(-254, 20, 'cash', 200);

    // Static twin-prop cargo plane parked at (-222, 68)
    const plane = new THREE.Group();
    const fuseMat = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0x0ea5e9 });
    const metalMat = new THREE.MeshLambertMaterial({ color: 0x475569 });
    const glassMat = new THREE.MeshPhongMaterial({ color: 0x0f172a, shininess: 95 });

    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.7, 15.2), fuseMat);
    fuselage.position.set(0, 2.35, 0);
    fuselage.castShadow = true;
    plane.add(fuselage);

    const cheatline = new THREE.Mesh(new THREE.BoxGeometry(3.08, 0.45, 14.8), stripeMat);
    cheatline.position.set(0, 2.35, 0);
    plane.add(cheatline);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.3, 2.0, 2.8), fuseMat);
    nose.position.set(0, 2.1, -8.8);
    plane.add(nose);

    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.95, 2.2), glassMat);
    cockpit.position.set(0, 3.0, -6.6);
    plane.add(cockpit);

    const mainWing = new THREE.Mesh(new THREE.BoxGeometry(20.5, 0.4, 3.3), fuseMat);
    mainWing.position.set(0, 3.55, -1.2);
    mainWing.castShadow = true;
    plane.add(mainWing);

    [-4.6, 4.6].forEach((wx, idx) => {
      const nacelle = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.35, 3.3), metalMat);
      nacelle.position.set(wx, 3.25, -2.2);
      plane.add(nacelle);
      const bladeA = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.28, 0.12), metalMat);
      bladeA.position.set(wx, 3.25, -3.95);
      plane.add(bladeA);
      const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.1, 0.12), metalMat);
      bladeB.position.set(wx, 3.25, -3.95);
      plane.add(bladeB);
      const tipLight = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.45), idx === 0 ? navPinkMat : edgeLightMat);
      tipLight.position.set(idx === 0 ? -10.2 : 10.2, 3.7, -1.2);
      plane.add(tipLight);
    });

    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.7, 3.0), stripeMat);
    tailFin.position.set(0, 4.5, 6.0);
    plane.add(tailFin);
    const tailPlane = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 2.1), fuseMat);
    tailPlane.position.set(0, 3.5, 6.2);
    plane.add(tailPlane);

    [[0, -7.2], [-1.3, 0.2], [1.3, 0.2]].forEach(([gx, gz]) => {
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.42, 12), metalMat);
      gear.rotation.z = Math.PI / 2;
      gear.position.set(gx, 0.55, gz);
      plane.add(gear);
    });

    plane.position.set(-222, 0, 68);
    plane.rotation.y = 0.22;
    this.scene.add(plane);
    this.colliders.push({
      minX: -224.2, maxX: -219.8,
      minZ: 60.5, maxZ: 75.5,
      height: 4.5, label: 'Cargo Plane'
    });
  }

  _buildPrecinctBlock(bx, bz) {
    this._addArtDecoBuilding(bx, bz - 8, 42, 18, 30, 0xd8e2ec, 0x38bdf8, 'VCPD PRECINCT', false);
  }

  _buildHospitalBlock(bx, bz) {
    this._addArtDecoBuilding(bx, bz - 8, 44, 22, 30, 0xffffff, 0xff3b5c, 'OCEAN VIEW MED', false);
  }

  _buildLandmarks() {
    // SUNSHINE AUTOS GARAGE (at block bx=-130, bz=70)
    const gPos = VS.CONFIG.GARAGE_POS; // { x: -126, z: 72 }
    // Paved driveway apron facing South (+Z towards z=120 street) and East
    const apron = new THREE.Mesh(new THREE.BoxGeometry(74, 0.16, 74), new THREE.MeshLambertMaterial({ color: 0x3b404d }));
    apron.position.set(-130, 0.06, 70);
    apron.receiveShadow = true;
    this.scene.add(apron);

    // Main garage showroom building set north of the drive-in bay
    this._addArtDecoBuilding(gPos.x, gPos.z - 22, 42, 12, 22, 0xfefae0, 0x00f0ff, 'SUNSHINE AUTOS', false);

    // Open-bay canopy extending over the interactive Garage Marker at (gPos.x, gPos.z)
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x172554 });
    const neonCyan = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 1.1 });
    this.neonMats.push(neonCyan);

    [[-12, -4], [12, -4], [-12, 8], [12, 8]].forEach(([dx, dz]) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6.2, 0.9), pillarMat);
      p.position.set(gPos.x + dx, 3.1, gPos.z + dz);
      p.castShadow = true;
      this.scene.add(p);
      this.colliders.push({
        minX: gPos.x + dx - 0.55, maxX: gPos.x + dx + 0.55,
        minZ: gPos.z + dz - 0.55, maxZ: gPos.z + dz + 0.55,
        height: 6.2, label: 'Garage Pillar'
      });
    });
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(26, 0.8, 15), canopyMat);
    canopy.position.set(gPos.x, 6.4, gPos.z + 2);
    canopy.castShadow = true;
    this.scene.add(canopy);
    const canopyTrim = new THREE.Mesh(new THREE.BoxGeometry(26.4, 0.35, 15.4), neonCyan);
    canopyTrim.position.set(gPos.x, 6.5, gPos.z + 2);
    this.scene.add(canopyTrim);

    // Glowing ground ring for Garage entry
    const ringGeo = new THREE.RingGeometry(4.2, 5.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide, transparent: true, opacity: 0.82 });
    this.garageRing = new THREE.Mesh(ringGeo, ringMat);
    this.garageRing.rotation.x = -Math.PI / 2;
    this.garageRing.position.set(gPos.x, 0.22, gPos.z + 2);
    this.scene.add(this.garageRing);

    // Glowing vertical cylinder beacon so player can spot Garage from blocks away
    const beaconGeo = new THREE.CylinderGeometry(4.4, 4.4, 5.5, 24, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
    this.garageBeacon = new THREE.Mesh(beaconGeo, beaconMat);
    this.garageBeacon.position.set(gPos.x, 2.9, gPos.z + 2);
    this.scene.add(this.garageBeacon);

    // Marina wooden pier at South Beach
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x8d6346 });
    const pier = new THREE.Mesh(new THREE.BoxGeometry(58, 0.6, 12), pierMat);
    pier.position.set(174, 0.35, VS.CONFIG.MARINA_POS.z);
    pier.receiveShadow = true;
    this.scene.add(pier);
  }

  _buildDowntownParkingDeck(cx, cz) {
    const concrete = new THREE.MeshLambertMaterial({ color: 0x667085 });
    const cyan = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 1.2 });
    const pink = new THREE.MeshStandardMaterial({ color: 0xff2a85, emissive: 0xff2a85, emissiveIntensity: 1.2 });
    this._addStaticBox(cx, 0.02, cz, 24, 0.2, 24, concrete, 'Parking Deck Ground', false);
    for (const dx of [-10.5, 10.5]) for (const dz of [-10.5, 10.5]) this._addStaticBox(cx + dx, 0, cz + dz, 1.6, 4.2, 1.6, concrete, 'Parking Pillar', true);
    this._addStaticBox(cx, 3.875, cz, 24, 0.35, 24, concrete, 'Parking Deck Upper', false);
    for (const [x,z,w,d,mat] of [[cx,cz-11.8,24,.22,cyan],[cx-11.8,cz, .22,24,pink],[cx,cz+11.8,24,.22,cyan]]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w,.65,d),mat); rail.position.set(x,4.55,z); this.scene.add(rail);
    }
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(5,.3,Math.hypot(18,4.05)),concrete);
    ramp.position.set(1,2.15,1); ramp.rotation.x = Math.atan2(4.05,18); this.scene.add(ramp);
    for (const dx of [-2.45,2.45]) { const edge=new THREE.Mesh(new THREE.BoxGeometry(.16,.22,Math.hypot(18,4.05)),dx<0?pink:cyan); edge.position.set(1+dx,2.25,1); edge.rotation.x=Math.atan2(4.05,18); this.scene.add(edge); }
    this.spawnPickup(-16,-16,'armor',50); this.pickups[this.pickups.length-1].mesh.position.y=4.2;
  }

  _buildStarfishIsland() {
    const sand = new THREE.MeshLambertMaterial({ color: 0xd9bd78 });
    this._addStaticBox(294,-0.4,-20,78,.7,98,sand,'Starfish Island',false);
    this._addStaticBox(294,-0.025,-20,68,.45,88,new THREE.MeshLambertMaterial({color:0x71865b}),'Starfish Plaza',false);
    [[264,-58],[324,-58],[264,18],[324,18],[294,-64],[294,24]].forEach(([x,z])=>{ const group=new THREE.Group(); group.position.set(x,.42,z); this.scene.add(group); this._addPalmTree(x,z,.9); });
    const coral=new THREE.MeshLambertMaterial({color:0xffb5c2}), cyan=new THREE.MeshStandardMaterial({color:0x00f0ff,emissive:0x00f0ff,emissiveIntensity:1});
    this._addStaticBox(284,.42,4,20,11,16,coral,'Starfish Villa',true);
    const sign=this._makeSignTexture('STARFISH VILLA','#140c24','#ffffff','#00f0ff');
    const signMesh=new THREE.Mesh(new THREE.PlaneGeometry(12,2.4),new THREE.MeshBasicMaterial({map:sign})); signMesh.position.set(284,8,12.2); this.scene.add(signMesh);
    const tower=new THREE.Mesh(new THREE.CylinderGeometry(2.2,3.4,24,8),new THREE.MeshLambertMaterial({color:0xf8fafc})); tower.position.set(314,12.42,-42); this.scene.add(tower);
    for(let i=0;i<8;i++){const stripe=new THREE.Mesh(new THREE.CylinderGeometry(3.4-i*.15,3.4-i*.15,1.4,8),new THREE.MeshLambertMaterial({color:i%2?0xffffff:0xe63946})); stripe.position.set(314,2+i*2.6,-42); this.scene.add(stripe);}
    this.colliders.push({minX:310.2,maxX:317.8,minZ:-45.8,maxZ:-38.2,height:24,label:'Starfish Lighthouse'});
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(2.5,12,8),new THREE.MeshStandardMaterial({color:0xffd166,emissive:0x00f0ff,emissiveIntensity:1.4})); lamp.position.set(314,24.5,-42);this.scene.add(lamp);
    // Causeway seamless sloped deck, piers, lane markers and neon rails
    const pinkRailMat = new THREE.MeshStandardMaterial({ color: 0xff2a85, emissive: 0xff2a85, emissiveIntensity: 1.1 });
    this.neonMats.push(cyan, pinkRailMat);
    const segCount = 16;
    const archH = (xx) => { const tt = VS.clamp((xx - 166) / 94, 0, 1); return Math.sin(tt * Math.PI) * 3.4 + tt * 0.4; };
    for (let i = 0; i < segCount; i++) {
      const x0 = 166 + (i / segCount) * 94, x1 = 166 + ((i + 1) / segCount) * 94;
      const y0 = archH(x0), y1 = archH(x1);
      const xm = (x0 + x1) * 0.5, ym = (y0 + y1) * 0.5;
      const dx = x1 - x0, dy = y1 - y0;
      const segLen = Math.hypot(dx, dy) + 0.28;
      const slope = Math.atan2(dy, dx);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.48, 16), new THREE.MeshLambertMaterial({ color: 0x424958 }));
      deck.position.set(xm, ym - 0.22, -24);
      deck.rotation.z = slope;
      this.scene.add(deck);
      if (i % 2 === 1) {
        const pierH = Math.max(0.5, ym + 1.2);
        const pier = new THREE.Mesh(new THREE.BoxGeometry(1.5, pierH, 1.5), new THREE.MeshLambertMaterial({ color: 0x9aa3ad }));
        pier.position.set(xm, ym - 0.22 - pierH * 0.5, -24);
        this.scene.add(pier);
      }
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.05, 0.32), new THREE.MeshBasicMaterial({ color: 0xffdf4d }));
      stripe.position.set(xm, ym + 0.05, -24);
      stripe.rotation.z = slope;
      this.scene.add(stripe);
      for (const z of [-31.5, -16.5]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(segLen, 0.36, 0.28), z < -24 ? cyan : pinkRailMat);
        rail.position.set(xm, ym + 0.55, z);
        rail.rotation.z = slope;
        this.scene.add(rail);
      }
    }
    for (const x of [198, 230]) {
      const archT = VS.clamp((x - 166) / 94, 0, 1);
      const archBaseY = Math.sin(archT * Math.PI) * 3.4 + archT * 0.4;
      const archTower = new THREE.Mesh(new THREE.TorusGeometry(8.1, 0.45, 8, 20, Math.PI), cyan);
      archTower.rotation.y = Math.PI / 2;
      archTower.position.set(x, archBaseY + 0.4, -24);
      this.scene.add(archTower);
    }
    const causewayTex = this._makeSignTexture('STARFISH CAUSEWAY', '#140c24', '#ffffff', '#ff2a85');
    const causewaySign = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.8), new THREE.MeshBasicMaterial({ map: causewayTex, side: THREE.DoubleSide }));
    causewaySign.rotation.y = -Math.PI / 2;
    causewaySign.position.set(198, 10.6, -24);
    this.scene.add(causewaySign);
    this.spawnPickup(296, -18, 'cash', 300);
    this.pickups[this.pickups.length - 1].mesh.position.y = 0.42;
  }

  _buildHiddenPackages() {
    for (const pkg of (VS.CONFIG.HIDDEN_PACKAGES || [])) {
      const group=new THREE.Group(); group.position.set(pkg.x,pkg.y||0,pkg.z);
      const core=new THREE.Mesh(new THREE.OctahedronGeometry(.75),new THREE.MeshStandardMaterial({color:0xff2a85,emissive:0x00f0ff,emissiveIntensity:1.4}));core.position.y=.95;group.add(core);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1.15,.12,8,20),new THREE.MeshBasicMaterial({color:0xffd166}));ring.position.y=.95;group.add(ring);
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.28,.5,4.5,10,1,true),new THREE.MeshBasicMaterial({color:0x00f0ff,transparent:true,opacity:.28}));beam.position.y=2.25;group.add(beam);
      this.scene.add(group);this.packageMeshes.push({pkg,group,core});
    }
  }

  syncPackages(collectedMap) { this.collectedPackages=Object.assign({},collectedMap||{}); for(const m of this.packageMeshes)m.group.visible=!this.collectedPackages[m.pkg.id]; }
  checkPackagePickup(px,py,pz) { for(const m of this.packageMeshes)if(!this.collectedPackages[m.pkg.id]&&VS.dist2D(px,pz,m.pkg.x,m.pkg.z)<2.5&&Math.abs((py||0)-(m.pkg.y||0))<2.4){this.collectedPackages[m.pkg.id]=true;m.group.visible=false;return m.pkg;}return null; }
  getDeckHeight(x,z,curY=0) {
    if(x>=-1.8&&x<=3.8&&z>=-8.5&&z<=10.5)return VS.clamp((10-z)/18,0,1)*4.05+.15;
    if(x>=-24.2&&x<=.2&&z>=-24.2&&z<=.2&&curY>=2.3)return 4.2;
    if(x>=166&&x<=260&&z>=-32.2&&z<=-15.8){const t=VS.clamp((x-166)/94,0,1);return Math.sin(t*Math.PI)*3.4+t*.4;}
    if(x>258&&x<=330&&z>=-66&&z<=26)return .42;
    if(x>=75&&x<=97&&z>=-241&&z<=-219)return .58;
    return 0;
  }

  _buildBeachAndOcean() {
    // Golden sandy beach strip from X = 136 to 192 (extended Z: -360..+320)
    const sandMat = new THREE.MeshLambertMaterial({ color: 0xdfb970 });
    const beach = new THREE.Mesh(new THREE.BoxGeometry(60, 0.4, 720), sandMat);
    beach.position.set(164, -0.22, -20);
    beach.receiveShadow = true;
    this.scene.add(beach);

    // Boardwalk promenade between Ocean Drive and Sand (X = 131..138)
    const walkMat = new THREE.MeshLambertMaterial({ color: 0xc9a27e });
    const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(7, 0.26, 680), walkMat);
    boardwalk.position.set(134.5, 0.06, -20);
    boardwalk.receiveShadow = true;
    this.scene.add(boardwalk);

    // Animated Turquoise Ocean Plane (X = 186 to 620)
    const oceanGeo = new THREE.PlaneGeometry(500, 1100, 18, 28);
    this.oceanMat = new THREE.MeshPhongMaterial({
      color: 0x00b4d8,
      emissive: 0x00334e,
      emissiveIntensity: 0.25,
      shininess: 90,
      specular: 0x90e0ef,
      flatShading: true
    });
    this.oceanMesh = new THREE.Mesh(oceanGeo, this.oceanMat);
    this.oceanMesh.rotation.x = -Math.PI / 2;
    this.oceanMesh.position.set(432, -0.18, -20);
    this.scene.add(this.oceanMesh);

    // Shoreline white foam band
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xe0fbfc, transparent: true, opacity: 0.72 });
    this.foamMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 720), foamMat);
    this.foamMesh.rotation.x = -Math.PI / 2;
    this.foamMesh.position.set(184.5, -0.02, -20);
    this.scene.add(this.foamMesh);

    // Beach umbrellas, loungers & lifeguard towers!
    const umbrellaColors = [0xff4fa3, 0x00f0ff, 0xffd166, 0xff6b35, 0x4ef2b8];
    const towelMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (let z = -180; z <= 110; z += 26) {
      if (Math.abs(z - (-24)) < 16) continue;
      const ux = 152 + ((Math.abs(z) * 7) % 18);
      const col = umbrellaColors[Math.abs(z) % umbrellaColors.length];
      this._addKnockableUmbrella(ux, z, col);
      // Paired beach lounger / towel beside umbrella
      const lounger = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 0.85), towelMat);
      lounger.position.set(ux + 1.6, 0.08, z + 1.2);
      lounger.rotation.y = 0.25;
      lounger.receiveShadow = true;
      this.scene.add(lounger);
    }
    // Two pastel lifeguard towers
    [-70, 55].forEach((lz) => {
      const towerMat = new THREE.MeshLambertMaterial({ color: 0xfff1f5 });
      const roofMat = new THREE.MeshLambertMaterial({ color: 0xff4fa3 });
      this._addStaticBox(166, 0, lz, 4.2, 5.2, 4.2, towerMat, 'Lifeguard Tower', true);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.8, 4), roofMat);
      roof.position.set(166, 6.1, lz);
      roof.rotation.y = Math.PI / 4;
      this.scene.add(roof);
    });
  }

  _addPalmTree(x, z, scale = 1.0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8d6748 });
    const leanX = (Math.random() - 0.5) * 0.9;
    const leanZ = (Math.random() - 0.5) * 0.9;
    const segs = 5;
    let cy = 0, cx = 0, cz = 0;
    for (let i = 0; i < segs; i++) {
      const h = 1.65 * scale;
      const rBot = (0.34 - i * 0.04) * scale;
      const rTop = (0.29 - i * 0.04) * scale;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 6), trunkMat);
      seg.position.set(cx + leanX * i * 0.2, cy + h * 0.5, cz + leanZ * i * 0.2);
      seg.rotation.z = -leanX * 0.08 * (i + 1);
      seg.rotation.x = leanZ * 0.08 * (i + 1);
      seg.castShadow = true;
      group.add(seg);
      cy += h * 0.92;
    }

    const crown = new THREE.Group();
    crown.position.set(leanX * 0.9, cy, leanZ * 0.9);
    // Coconuts cluster beneath palm fronds
    const cocoMat = new THREE.MeshLambertMaterial({ color: 0x4a2e1b });
    for (let c = 0; c < 3; c++) {
      const ca = (c / 3) * Math.PI * 2;
      const coco = new THREE.Mesh(new THREE.SphereGeometry(0.22 * scale, 6, 5), cocoMat);
      coco.position.set(Math.cos(ca) * 0.28 * scale, -0.22 * scale, Math.sin(ca) * 0.28 * scale);
      crown.add(coco);
    }
    const frondMat = new THREE.MeshLambertMaterial({ color: 0x2ea043, side: THREE.DoubleSide });
    const frondLightMat = new THREE.MeshLambertMaterial({ color: 0x43c559, side: THREE.DoubleSide });
    for (let f = 0; f < 9; f++) {
      const ang = (f / 9) * Math.PI * 2 + Math.random() * 0.25;
      const frondPivot = new THREE.Group();
      frondPivot.rotation.y = ang;
      // 2-segment drooping arch for lush tropical silhouette
      const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.68 * scale, 0.08, 2.0 * scale), f % 2 === 0 ? frondMat : frondLightMat);
      seg1.position.set(0, 0.28 * scale, 1.0 * scale);
      seg1.rotation.x = -0.18;
      seg1.castShadow = true;
      frondPivot.add(seg1);
      const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.46 * scale, 0.07, 1.9 * scale), f % 2 === 0 ? frondLightMat : frondMat);
      seg2.position.set(0, 0.14 * scale, 2.65 * scale);
      seg2.rotation.x = 0.52;
      frondPivot.add(seg2);
      crown.add(frondPivot);
    }
    group.add(crown);
    this.scene.add(group);
    this.palms.push({ crown, phase: Math.random() * Math.PI * 2 });
    this.colliders.push({ minX: x - 0.45, maxX: x + 0.45, minZ: z - 0.45, maxZ: z + 0.45, height: 6, label: 'Palm' });
  }

  _addStreetLamp(x, z, facingDir = 1) {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.2, 6), poleMat);
    pole.position.y = 3.6;
    pole.castShadow = true;
    g.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.14, 0.14), poleMat);
    arm.position.set(facingDir * 1.0, 7.1, 0);
    g.add(arm);

    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), bulbMat);
    bulb.position.set(facingDir * 1.9, 6.95, 0);
    g.add(bulb);

    // Subtle warm glow halo quad visible at night
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide });
    const halo = new THREE.Mesh(new THREE.CircleGeometry(4.2, 12), haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(facingDir * 1.9, 0.09, 0);
    g.add(halo);
    this.lampHalos.push(haloMat);

    this.scene.add(g);
  }

  _addKnockableProp(x, z, type) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    let radius = 0.55;
    if (type === 'hydrant') {
      const m = new THREE.MeshLambertMaterial({ color: 0xe63946 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.95, 8), m);
      body.position.y = 0.48;
      body.castShadow = true;
      g.add(body);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), m);
      cap.position.y = 0.95;
      g.add(cap);
    } else if (type === 'trash') {
      const m = new THREE.MeshLambertMaterial({ color: 0x475569 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 1.05, 8), m);
      body.position.y = 0.52;
      body.castShadow = true;
      g.add(body);
    } else if (type === 'bench') {
      radius = 0.95;
      const wood = new THREE.MeshLambertMaterial({ color: 0xb07d62 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 0.65), wood);
      seat.position.y = 0.52;
      seat.castShadow = true;
      g.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 0.1), wood);
      back.position.set(0, 0.85, -0.28);
      g.add(back);
    }
    this.scene.add(g);
    this.props.push({
      mesh: g,
      origX: x, origZ: z,
      x, y: 0, z,
      vx: 0, vy: 0, vz: 0,
      rx: 0, rz: 0,
      radius,
      knocked: false,
      resetTimer: 0
    });
  }

  _addKnockableUmbrella(x, z, color) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    pole.position.y = 1.25;
    g.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.75, 8), new THREE.MeshLambertMaterial({ color }));
    top.position.y = 2.45;
    top.castShadow = true;
    g.add(top);
    this.scene.add(g);
    this.props.push({
      mesh: g,
      origX: x, origZ: z,
      x, y: 0, z,
      vx: 0, vy: 0, vz: 0,
      rx: 0, rz: 0,
      radius: 0.6,
      knocked: false,
      resetTimer: 0
    });
  }

  _buildStreetDetails() {
    const cfg = VS.CONFIG;
    // Iconic palm tree avenue along Ocean Drive (both sides!) and beach edge
    for (let z = -195; z <= 145; z += 22) {
      if (cfg.STREET_Z.some((sz) => Math.abs(z - sz) < 15)) continue;
      this._addPalmTree(131.5, z, 1.05 + (Math.abs(z) % 3) * 0.1);
      this._addPalmTree(107.5, z + 6, 0.95);
    }
    // Additional palms along downtown avenues & Havana plaza
    [-80, 20].forEach((ax) => {
      for (let z = -165; z <= 125; z += 44) {
        if (cfg.STREET_Z.some((sz) => Math.abs(z - sz) < 16)) continue;
        this._addPalmTree(ax + 12.2, z, 0.9);
      }
    });
    this._addPalmTree(-46, 54, 1.0);
    this._addPalmTree(-14, 54, 1.0);
    this._addPalmTree(-46, 86, 1.0);
    this._addPalmTree(-14, 86, 1.0);

    // Street lamps along all 4 main avenues
    cfg.AVENUE_X.forEach((ax) => {
      for (let z = -160; z <= 130; z += 45) {
        if (cfg.STREET_Z.some((sz) => Math.abs(z - sz) < 15)) continue;
        this._addStreetLamp(ax - 10.6, z, 1);
        this._addStreetLamp(ax + 10.6, z + 22, -1);
      }
    });

    // Knockable street props (hydrants, trash bins, benches) along sidewalks
    const propTypes = ['hydrant', 'trash', 'bench'];
    let pi = 0;
    cfg.AVENUE_X.forEach((ax) => {
      for (let z = -150; z <= 110; z += 36) {
        if (cfg.STREET_Z.some((sz) => Math.abs(z - sz) < 16)) continue;
        this._addKnockableProp(ax + 10.2, z, propTypes[pi % propTypes.length]);
        pi++;
      }
    });

    // Ambient night point lights at key hotspots (Ocean Drive, Garage, Club Malibu)
    const hotspots = [
      { x: 112, y: 9, z: 45, col: 0xff4fa3 },
      { x: 112, y: 9, z: -30, col: 0x00f0ff },
      { x: -126, y: 8, z: 72, col: 0x00f0ff },
      { x: 86, y: 9, z: -130, col: 0xff2a85 }
    ];
    hotspots.forEach((h) => {
      const pl = new THREE.PointLight(h.col, 0, 48, 1.5);
      pl.position.set(h.x, h.y, h.z);
      this.scene.add(pl);
      this.lampPoints.push(pl);
    });

    this._buildStuntRamps();
  }

  _buildStuntRamps() {
    const rampSpecs = [
      { x: 124.2, z: 92,     dirX: 0, dirZ: -1, w: 6.2, len: 11,   h: 2.9 }, // Ocean Drive South
      { x: 115.8, z: -88,    dirX: 0, dirZ: -1, w: 6.2, len: 11,   h: 2.9 }, // Ocean Drive North
      { x: -230,  z: -10,    dirX: 0, dirZ: -1, w: 8.5, len: 14,   h: 3.8 }, // Westport Runway Mega Jump
      { x: 15.8,  z: -32,    dirX: 0, dirZ: -1, w: 6.0, len: 10.5, h: 2.7 }, // Downtown Avenue
      { x: -48,   z: 124.2,  dirX: 1, dirZ: 0,  w: 6.0, len: 10.5, h: 2.7 }, // Little Havana Eastbound
      { x: -135,  z: -275.8, dirX: 1, dirZ: 0,  w: 6.2, len: 11,   h: 2.9 }, // North Bay Highway
      { x: 274, z: -8, dirX: -1, dirZ: 0, w: 6.4, len: 11.5, h: 3.0, baseY: 0.42 }
    ];

    const rampDeckMat = new THREE.MeshLambertMaterial({ color: 0x242a38, side: THREE.DoubleSide });
    const neonPink = new THREE.MeshStandardMaterial({ color: 0xff2a85, emissive: 0xff2a85, emissiveIntensity: 1.15, roughness: 0.25 });
    const neonCyan = new THREE.MeshStandardMaterial({ color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 1.15, roughness: 0.25 });
    this.neonMats.push(neonPink, neonCyan);

    rampSpecs.forEach((spec, idx) => {
      const r = { id: idx, ...spec };
      this.ramps.push(r);

      const g = new THREE.Group();
      const hw = r.w * 0.5;
      const hl = r.len * 0.5;
      const hyp = Math.hypot(r.len, r.h);
      const pitch = Math.atan2(r.h, r.len);

      // Solid 3D wedge rising smoothly from y = 0 at entry (-hl) to y = h at launch lip (+hl); no blocking AABB collider
      const wedgeGeo = new THREE.BufferGeometry();
      const verts = new Float32Array([
        -hw, 0.04, -hl,   hw, 0.04, -hl,
        -hw, 0.04,  hl,   hw, 0.04,  hl,
        -hw, r.h,   hl,   hw, r.h,   hl
      ]);
      wedgeGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      wedgeGeo.setIndex([
        0, 4, 5,  0, 5, 1, // inclined top deck
        2, 3, 5,  2, 5, 4, // launch-end back wall
        0, 2, 4,           // left side triangle
        1, 5, 3            // right side triangle
      ]);
      wedgeGeo.computeVertexNormals();
      const wedgeMesh = new THREE.Mesh(wedgeGeo, rampDeckMat);
      wedgeMesh.castShadow = true;
      wedgeMesh.receiveShadow = true;
      g.add(wedgeMesh);

      // Bright neon pink & cyan side strips along the inclined slope + launch lip bar
      const railGeo = new THREE.BoxGeometry(0.28, 0.24, hyp);
      const leftRail = new THREE.Mesh(railGeo, neonPink);
      leftRail.position.set(-hw + 0.16, r.h * 0.5 + 0.13, 0);
      leftRail.rotation.x = -pitch;
      g.add(leftRail);

      const rightRail = new THREE.Mesh(railGeo, neonCyan);
      rightRail.position.set(hw - 0.16, r.h * 0.5 + 0.13, 0);
      rightRail.rotation.x = -pitch;
      g.add(rightRail);

      const lipBar = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.22, 0.34), idx % 2 === 0 ? neonCyan : neonPink);
      lipBar.position.set(0, r.h + 0.04, hl - 0.17);
      g.add(lipBar);

      // Ground entry chevron + ascending deck chevron arrows pointing toward launch lip (+Z local)
      const chevW = r.w * 0.27;
      const chevD = 0.52;
      const wingLen = Math.hypot(chevW, chevD * 2);
      const wingAng = Math.atan2(chevW, chevD * 2);
      const wingGeo = new THREE.BoxGeometry(0.28, 0.05, wingLen);

      const addChevron = (cz, cy, slopeRot, mat) => {
        const cg = new THREE.Group();
        const lw = new THREE.Mesh(wingGeo, mat);
        lw.position.x = -chevW * 0.5;
        lw.rotation.y = wingAng;
        const rw = new THREE.Mesh(wingGeo, mat);
        rw.position.x = chevW * 0.5;
        rw.rotation.y = -wingAng;
        cg.add(lw, rw);
        cg.position.set(0, cy, cz);
        cg.rotation.x = slopeRot;
        g.add(cg);
      };

      addChevron(-hl - 1.5, 0.06, 0, neonCyan);
      [0.24, 0.52, 0.80].forEach((t, ci) => {
        addChevron(-hl + t * r.len, t * r.h + 0.05, -pitch, ci % 2 === 0 ? neonPink : neonCyan);
      });

      g.position.set(r.x, r.baseY || 0, r.z);
      g.rotation.y = Math.atan2(r.dirX, r.dirZ);
      this.scene.add(g);
    });
  }

  _initSkidPool() {
    const geo = new THREE.PlaneGeometry(0.42, 1.55);
    for (let i = 0; i < 160; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x111218, transparent: true, opacity: 0.0, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.06;
      m.visible = false;
      this.scene.add(m);
      this.skidMarks.push({ mesh: m, mat, life: 0 });
    }
  }

  addSkidMark(x, z, travelYaw, opacity = 0.55) {
    const s = this.skidMarks[this.skidIndex];
    this.skidIndex = (this.skidIndex + 1) % this.skidMarks.length;
    s.mesh.position.set(x, 0.065, z);
    s.mesh.rotation.order = 'YXZ';
    s.mesh.rotation.set(-Math.PI / 2, travelYaw, 0);
    s.mat.opacity = opacity;
    s.mesh.visible = true;
    s.life = 14.0;
  }

  spawnParticle({ x, y, z, vx, vy, vz, color, size = 1, life = 0.6, gravity = 14, isSmoke = false }) {
    if (this.particles.length > 220) {
      const old = this.particles.shift();
      this.scene.remove(old.mesh);
      old.mesh.material.dispose();
    }
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: isSmoke ? 0.65 : 0.95 });
    const mesh = new THREE.Mesh(isSmoke ? this.smokeGeo : this.partGeo, mat);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(size);
    this.scene.add(mesh);
    this.particles.push({ mesh, vx, vy, vz, life, maxLife: life, gravity, isSmoke, baseSize: size });
  }

  spawnExplosion(x, y, z) {
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = VS.rand(4, 16);
      this.spawnParticle({
        x: x + VS.rand(-1, 1), y: y + VS.rand(0.3, 1.5), z: z + VS.rand(-1, 1),
        vx: Math.cos(a) * sp, vy: VS.rand(5, 16), vz: Math.sin(a) * sp,
        color: i % 3 === 0 ? 0xffdf4d : (i % 3 === 1 ? 0xff5a1f : 0x222222),
        size: VS.rand(1.2, 2.8),
        life: VS.rand(0.5, 1.25),
        gravity: i % 3 === 2 ? -2.5 : 15,
        isSmoke: i % 3 === 2
      });
    }
  }

  spawnPickup(x, z, type = 'cash', amount = 75) {
    const g = new THREE.Group();
    const col = type === 'cash' ? 0x4ef2b8 : (type === 'health' ? 0xff4fa3 : 0xffe066);
    const body = new THREE.Mesh(
      type === 'cash' ? new THREE.BoxGeometry(0.75, 0.35, 0.45) : new THREE.OctahedronGeometry(0.45),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.65 })
    );
    body.position.y = 0.8;
    g.add(body);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 16),
      new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.14;
    g.add(ring);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.pickups.push({ mesh: g, x, z, type, amount, age: 0 });
  }

  getRampInfo(x, z) {
    for (let i = 0; i < this.ramps.length; i++) {
      const r = this.ramps[i];
      const dx = x - r.x;
      const dz = z - r.z;
      const fwd = dx * r.dirX + dz * r.dirZ;
      if (fwd < -r.len * 0.5 || fwd > r.len * 0.5) continue;
      const lat = Math.abs(-dx * r.dirZ + dz * r.dirX);
      if (lat <= r.w * 0.52) {
        const t = (fwd + r.len / 2) / r.len;
        return { y: t * r.h, slope: r.h / r.len, ramp: r };
      }
    }
    return { y: 0, slope: 0, ramp: null };
  }

  // Circle vs AABB collision resolution against all static buildings/walls
  resolveCircleCollision(x, z, radius) {
    let rx = x, rz = z, hit = false, nx = 0, nz = 0;

    // World bounds (expanded city: X in -342..+183, Z in -342..+302)
    if (rx < -342 + radius) { rx = -342 + radius; hit = true; nx = 1; }
    if (rx > 183 - radius) {
      if (rx < 258 && rz >= -34 && rz <= -14) {
        const oldZ = rz;
        rz = VS.clamp(rz, -32 + radius, -16 - radius);
        if (rz !== oldZ) { hit = true; nz = rz < oldZ ? 1 : -1; }
      } else if (rx >= 258) {
        rx = Math.min(rx, 328 - radius);
        rz = VS.clamp(rz, -64 + radius, 24 - radius);
        if (rx < 260 + radius && (rz < -32 + radius || rz > -16 - radius)) { rx = 260 + radius; hit = true; nx = 1; }
      } else { rx = 183 - radius; hit = true; nx = -1; }
    }
    if (rz < -342 + radius) { rz = -342 + radius; hit = true; nz = 1; }
    if (rz > 302 - radius) { rz = 302 - radius; hit = true; nz = -1; }

    for (let i = 0; i < this.colliders.length; i++) {
      const b = this.colliders[i];
      const closestX = VS.clamp(rx, b.minX, b.maxX);
      const closestZ = VS.clamp(rz, b.minZ, b.maxZ);
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        hit = true;
        if (distSq > 0.00001) {
          const dist = Math.sqrt(distSq);
          const overlap = radius - dist;
          const ux = dx / dist;
          const uz = dz / dist;
          rx += ux * overlap;
          rz += uz * overlap;
          nx = ux; nz = uz;
        } else {
          // Inside box center fallback: push to nearest face
          const dLeft = Math.abs(rx - b.minX);
          const dRight = Math.abs(b.maxX - rx);
          const dTop = Math.abs(rz - b.minZ);
          const dBot = Math.abs(b.maxZ - rz);
          const m = Math.min(dLeft, dRight, dTop, dBot);
          if (m === dLeft) { rx = b.minX - radius; nx = -1; nz = 0; }
          else if (m === dRight) { rx = b.maxX + radius; nx = 1; nz = 0; }
          else if (m === dTop) { rz = b.minZ - radius; nx = 0; nz = -1; }
          else { rz = b.maxZ + radius; nx = 0; nz = 1; }
        }
      }
    }
    return { x: rx, z: rz, hit, nx, nz };
  }

  // Fast segment-vs-AABB occlusion check for police line-of-sight & bullets
  hasLineOfSight(ax, az, bx, bz) {
    const steps = Math.max(4, Math.ceil(VS.dist2D(ax, az, bx, bz) / 4));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const px = ax + (bx - ax) * t;
      const pz = az + (bz - az) * t;
      for (let i = 0; i < this.colliders.length; i++) {
        const b = this.colliders[i];
        if (b.height < 2.5) continue;
        if (px > b.minX && px < b.maxX && pz > b.minZ && pz < b.maxZ) return false;
      }
    }
    return true;
  }

  knockPropsNear(x, z, radius, impactVx, impactVz, audio) {
    let knockedAny = false;
    for (let i = 0; i < this.props.length; i++) {
      const p = this.props[i];
      if (p.knocked) continue;
      const d = VS.dist2D(x, z, p.x, p.z);
      if (d < radius + p.radius) {
        p.knocked = true;
        p.resetTimer = 28;
        const speed = Math.hypot(impactVx, impactVz);
        const ux = (p.x - x) / (d || 1);
        const uz = (p.z - z) / (d || 1);
        p.vx = impactVx * 0.9 + ux * Math.max(5, speed * 0.45);
        p.vz = impactVz * 0.9 + uz * Math.max(5, speed * 0.45);
        p.vy = Math.min(11, 3.8 + speed * 0.25);
        p.rx = VS.rand(-9, 9);
        p.rz = VS.rand(-9, 9);
        knockedAny = true;
        if (audio) audio.playCrash(0.32);
      }
    }
    return knockedAny;
  }

  advanceTime(hours = 4) {
    this.timeOfDay = (this.timeOfDay + hours) % 24;
    this.updateDayNight(0);
  }

  getTimeInfo() {
    const h = Math.floor(this.timeOfDay);
    const m = Math.floor((this.timeOfDay - h) * 60);
    const str = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    let phase = VS.t('晴朗白昼', 'SUNNY DAY');
    if (this.timeOfDay >= 5.5 && this.timeOfDay < 8.5) phase = VS.t('迈阿密拂晓', 'MIAMI DAWN');
    else if (this.timeOfDay >= 17.0 && this.timeOfDay < 20.0) phase = VS.t('罪恶落日', 'VICE SUNSET');
    else if (this.timeOfDay >= 20.0 || this.timeOfDay < 5.5) phase = VS.t('霓虹午夜', 'NEON NIGHT');
    return { str, phase, isNight: this.timeOfDay >= 19.2 || this.timeOfDay < 5.8 };
  }

  updateDayNight(dt, focusX = 0, focusZ = 0) {
    this.timeOfDay = (this.timeOfDay + (dt / VS.CONFIG.DAY_DURATION_SEC) * 24) % 24;
    const h = this.timeOfDay;

    // Keyframe palettes across 24 hours: [hour, topHex, horizHex, fogHex, sunHex, sunInt, hemiInt, nightFactor]
    const keys = [
      [0.0,  0x09071a, 0x1d1138, 0x191030, 0x7aa2f7, 0.30, 0.34, 1.0],
      [5.5,  0x1e1846, 0x6b3a6e, 0x5c3663, 0xff9e7d, 0.48, 0.44, 0.75],
      [7.5,  0x3b82f6, 0xffb38a, 0xffcfa8, 0xffe0a3, 0.92, 0.62, 0.15],
      [12.5, 0x1282f2, 0x86dcff, 0x96e2ff, 0xfff5db, 1.08, 0.68, 0.0],
      [16.8, 0x1e6fd9, 0x92e0ff, 0xa2e2ff, 0xffebd0, 1.02, 0.65, 0.0],
      [18.6, 0x3b1d6a, 0xff5f85, 0xff7c70, 0xff8a5b, 0.85, 0.56, 0.45],
      [20.2, 0x0e0a24, 0x31184d, 0x24133a, 0x8bb4ff, 0.34, 0.36, 0.95],
      [24.0, 0x09071a, 0x1d1138, 0x191030, 0x7aa2f7, 0.30, 0.34, 1.0]
    ];

    let k0 = keys[0], k1 = keys[1];
    for (let i = 0; i < keys.length - 1; i++) {
      if (h >= keys[i][0] && h <= keys[i + 1][0]) {
        k0 = keys[i]; k1 = keys[i + 1]; break;
      }
    }
    const t = (h - k0[0]) / Math.max(0.001, k1[0] - k0[0]);
    const cTop = new THREE.Color(k0[1]).lerp(new THREE.Color(k1[1]), t);
    const cHor = new THREE.Color(k0[2]).lerp(new THREE.Color(k1[2]), t);
    const cFog = new THREE.Color(k0[3]).lerp(new THREE.Color(k1[3]), t);
    const cSun = new THREE.Color(k0[4]).lerp(new THREE.Color(k1[4]), t);
    const sunInt = VS.lerp(k0[5], k1[5], t);
    const hemiInt = VS.lerp(k0[6], k1[6], t);
    const nightFactor = VS.lerp(k0[7], k1[7], t);

    this.skyUniforms.topColor.value.copy(cTop);
    this.skyUniforms.horizonColor.value.copy(cHor);
    this.skyUniforms.bottomColor.value.copy(cFog);
    this.skyUniforms.starStrength.value = Math.max(0, (nightFactor - 0.4) * 1.6);

    this.scene.fog.color.copy(cFog);
    this.scene.fog.density = VS.lerp(0.0019, 0.0032, nightFactor);

    // Sun & Moon orbits
    const sunAngle = ((h - 6) / 24) * Math.PI * 2; // 6:00 sunrise east (+X), 12:00 zenith, 18:00 sunset west (-X)
    const sx = Math.cos(sunAngle) * 340;
    const sy = Math.sin(sunAngle) * 340;
    const sz = -90;
    this.sunMesh.position.set(focusX + sx, sy, focusZ + sz);
    this.sunMesh.visible = sy > -25;
    this.moonMesh.position.set(focusX - sx, -sy, focusZ + 90);
    this.moonMesh.visible = -sy > -25;

    // Directional light tracks sun during day, moon at night
    const lightX = sy > 10 ? sx * 0.45 : -sx * 0.45;
    const lightY = Math.max(45, Math.abs(sy) * 0.55);
    this.sunLight.position.set(focusX + lightX, lightY, focusZ + (sy > 10 ? -50 : 50));
    this.sunLight.target.position.set(focusX, 0, focusZ);
    this.sunLight.color.copy(cSun);
    this.sunLight.intensity = sunInt;

    this.hemiLight.color.copy(cHor);
    this.hemiLight.groundColor.setHex(nightFactor > 0.5 ? 0x1b1429 : 0x806a58);
    this.hemiLight.intensity = hemiInt;

    // Glow up neon trims, windows & streetlamps smoothly at dusk/night
    const neonGlow = VS.lerp(0.55, 2.2, nightFactor);
    for (let i = 0; i < this.neonMats.length; i++) this.neonMats[i].emissiveIntensity = neonGlow;
    const winGlow = VS.lerp(0.0, 1.35, Math.max(0, (nightFactor - 0.2) * 1.25));
    for (let i = 0; i < this.windowMats.length; i++) this.windowMats[i].emissiveIntensity = winGlow;
    const haloOp = nightFactor > 0.35 ? (nightFactor - 0.35) * 0.52 : 0;
    for (let i = 0; i < this.lampHalos.length; i++) this.lampHalos[i].opacity = haloOp;
    const ptInt = nightFactor > 0.35 ? (nightFactor - 0.35) * 2.6 : 0;
    for (let i = 0; i < this.lampPoints.length; i++) this.lampPoints[i].intensity = ptInt;

    // Keep sky dome centered on camera/player
    this.skyDome.position.set(focusX, 0, focusZ);
  }

  update(dt, focusX, focusZ) {
    this.updateDayNight(dt, focusX, focusZ);

    // Gentle ocean wave shimmer + beach foam breath
    this.oceanTime += dt;
    for (const m of this.packageMeshes) if (m.group.visible) { m.core.rotation.y += dt * 2.8; m.core.position.y = .95 + Math.sin(this.oceanTime * 3.8) * .18; }
    this.foamMesh.position.x = 184.5 + Math.sin(this.oceanTime * 1.4) * 1.1;
    this.oceanMesh.position.y = -0.18 + Math.sin(this.oceanTime * 1.1) * 0.08;

    // Palm breeze sway
    for (let i = 0; i < this.palms.length; i++) {
      const p = this.palms[i];
      p.crown.rotation.z = Math.sin(this.oceanTime * 1.6 + p.phase) * 0.06;
      p.crown.rotation.x = Math.cos(this.oceanTime * 1.2 + p.phase) * 0.04;
    }

    // Pulse garage beacon
    if (this.garageRing) {
      const s = 1 + Math.sin(this.oceanTime * 3.5) * 0.06;
      this.garageRing.scale.set(s, s, 1);
    }

    // Update knocked props physics
    for (let i = 0; i < this.props.length; i++) {
      const p = this.props[i];
      if (!p.knocked) continue;
      p.vy -= 22 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.25) {
        p.y = 0.25;
        p.vy = -p.vy * 0.32;
        p.vx *= 0.82;
        p.vz *= 0.82;
        p.rx *= 0.8;
        p.rz *= 0.8;
      }
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.x += p.rx * dt;
      p.mesh.rotation.z += p.rz * dt;
      p.resetTimer -= dt;
      if (p.resetTimer <= 0 && VS.dist2D(focusX, focusZ, p.origX, p.origZ) > 55) {
        p.knocked = false;
        p.x = p.origX; p.y = 0; p.z = p.origZ;
        p.vx = p.vy = p.vz = p.rx = p.rz = 0;
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.set(0, 0, 0);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.scene.remove(pt.mesh);
        pt.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      pt.vy -= pt.gravity * dt;
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.position.z += pt.vz * dt;
      if (pt.mesh.position.y < 0.12 && !pt.isSmoke) {
        pt.mesh.position.y = 0.12;
        pt.vy = -pt.vy * 0.35;
      }
      const ratio = pt.life / pt.maxLife;
      pt.mesh.material.opacity = pt.isSmoke ? ratio * 0.55 : ratio;
      if (pt.isSmoke) {
        pt.mesh.scale.setScalar(pt.baseSize * (1 + (1 - ratio) * 1.9));
      }
    }

    // Fade skid marks slowly
    for (let i = 0; i < this.skidMarks.length; i++) {
      const s = this.skidMarks[i];
      if (s.life > 0) {
        s.life -= dt;
        if (s.life < 3) s.mat.opacity = Math.max(0, (s.life / 3) * 0.45);
        if (s.life <= 0) s.mesh.visible = false;
      }
    }

    // Animate pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.age += dt;
      pk.mesh.children[0].rotation.y += dt * 2.6;
      pk.mesh.children[0].position.y = 0.8 + Math.sin(pk.age * 4) * 0.16;
      if (pk.age > 90) {
        this.scene.remove(pk.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }
};
