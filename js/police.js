// VICE SUN '86 - Crime Heat, 5-Star Wanted System, VCPD Pursuit AI & Roadblocks
window.VS = window.VS || {};

VS.PoliceSystem = class PoliceSystem {
  constructor(game) {
    this.game = game;
    this.heat = 0;           // 0..500
    this.wantedStars = 0;    // 0..5
    this.cops = [];          // Active VCPD pursuit vehicles
    this.tanks = [];         // 4-5 star Military Rhino Tanks
    this.footCops = [];      // On-foot VCPD officers
    this.roadblocks = [];    // Spawned roadblock vehicles
    this.heli = null;        // 3+ star VCPD Armed Helicopter
    this.jet = null;         // 5-star Air Force Fighter Jet flyby
    this.shells = [];        // Flying tank shells & jet airstrike rockets

    this.evadeTimer = 0;
    this.isEvading = false;
    this.evadeNotified = false;
    this.spawnTimer = 0;
    this.tankSpawnTimer = 0;
    this.jetCooldown = 4.0;
    this.heliRespawnCd = 0;
    this.roadblockCooldown = 0;
    this.bustProgress = 0;
    this.lastCrimeFeed = 0;
  }

  _heatToStars(h) {
    if (h >= 420) return 5;
    if (h >= 300) return 4;
    if (h >= 185) return 3;
    if (h >= 90) return 2;
    if (h >= 24) return 1;
    return 0;
  }

  reportCrime(label, amount) {
    if (this.game.recoverTimer > 0) return;
    const prevStars = this.wantedStars;
    this.heat = VS.clamp(this.heat + amount, 0, 500);
    this.wantedStars = this._heatToStars(this.heat);
    this.evadeTimer = 0;
    this.isEvading = false;

    const now = performance.now();
    if (now - this.lastCrimeFeed > 1200 || this.wantedStars > prevStars) {
      this.lastCrimeFeed = now;
      this.game.hud.addFeed(VS.t(`犯罪行为: ${label} (+${Math.round(amount)} 热度)`, `CRIME: ${label} (+${Math.round(amount)} Heat)`), 'crime');
    }

    if (this.wantedStars > prevStars) {
      this.game.audio.playWantedUp();
      const escalate = {
        3: VS.t('3 星通缉！VCPD 警用武装直升机升空追踪！', '3 STARS! VCPD Armed Helicopter airborne!'),
        4: VS.t('4 星通缉！军方犀牛坦克已开上街头拦截！', '4 STARS! Military Rhino Tank deployed!'),
        5: VS.t('5 星最高通缉！空军喷气战机与重装坦克全面围剿！', '5 STARS! Air Force Fighter Jet & Heavy Armor inbound!')
      };
      const msg = escalate[this.wantedStars] || VS.t(`通缉升至 ${this.wantedStars} 星！VCPD 警队已出动！`, `WANTED LEVEL ${this.wantedStars} STAR${this.wantedStars > 1 ? 'S' : ''}! VCPD dispatched!`);
      this.game.hud.addFeed(msg, 'crime');
      this.spawnTimer = 0.2;
      if (this.wantedStars >= 4) this.tankSpawnTimer = 0.4;
      if (this.wantedStars >= 5) this.jetCooldown = 1.5;
    }
  }

  setMinimumStars(stars, reason = 'VCPD Alert') {
    const thresholds = [0, 35, 110, 210, 325, 445];
    const targetHeat = thresholds[VS.clamp(stars, 0, 5)];
    if (this.heat < targetHeat) {
      this.reportCrime(reason, targetHeat - this.heat);
    }
  }

  clearWanted(silent = false) {
    this.heat = 0;
    this.wantedStars = 0;
    this.evadeTimer = 0;
    this.isEvading = false;
    this.evadeNotified = false;
    this.bustProgress = 0;

    // Release active pursuit cruisers & tanks cleanly
    for (const c of this.cops) {
      if (c !== this.game.player.vehicle) {
        this.game.vehicleManager.removeVehicle(c);
      } else {
        c.isPoliceAI = false;
      }
    }
    this.cops = [];

    for (const tk of this.tanks) {
      if (tk !== this.game.player.vehicle) {
        this.game.vehicleManager.removeVehicle(tk);
      } else {
        tk.isPoliceAI = false;
      }
    }
    this.tanks = [];

    if (this.heli) {
      this.game.scene.remove(this.heli.root);
      this.game.scene.remove(this.heli.spotMesh);
      this.heli = null;
    }
    if (this.jet) {
      this.game.scene.remove(this.jet.root);
      this.jet = null;
    }
    for (const sh of this.shells) {
      this.game.scene.remove(sh.mesh);
      if (sh.warnRing) this.game.scene.remove(sh.warnRing);
    }
    this.shells = [];

    for (const rb of this.roadblocks) {
      if (rb !== this.game.player.vehicle) this.game.vehicleManager.removeVehicle(rb);
    }
    this.roadblocks = [];

    for (const fc of this.footCops) {
      this.game.scene.remove(fc.root);
    }
    this.footCops = [];

    if (!silent) {
      this.game.hud.addFeed(VS.t('成功甩掉追捕！VCPD 已取消通缉。', 'Heat cleared! VCPD called off the chase.'), 'money');
    }
  }

  getNearestSirenProximity() {
    if (this.wantedStars === 0) return 0;
    const px = this.game.player.x;
    const pz = this.game.player.z;
    let bestD = 999;
    for (const c of this.cops) {
      if (c.destroyed) continue;
      const d = VS.dist2D(px, pz, c.x, c.z);
      if (d < bestD) bestD = d;
    }
    return VS.clamp(1 - bestD / 115, 0, 1);
  }

  _spawnCopCruiser(typeId = 'police') {
    const cfg = VS.CONFIG;
    const px = this.game.player.x;
    const pz = this.game.player.z;

    for (let attempt = 0; attempt < 25; attempt++) {
      const axis = Math.random() < 0.5 ? 'z' : 'x';
      let x, z, yaw;
      if (axis === 'z') {
        const ax = VS.pick(cfg.AVENUE_X);
        x = ax + VS.pick([-4.2, 4.2]);
        z = VS.clamp(pz + VS.pick([-1, 1]) * VS.rand(64, 115), -315, 275);
        yaw = z > pz ? Math.PI : 0;
      } else {
        const sz = VS.pick(cfg.STREET_Z);
        z = sz + VS.pick([-4.2, 4.2]);
        x = VS.clamp(px + VS.pick([-1, 1]) * VS.rand(64, 115), -310, 124);
        yaw = x > px ? -Math.PI / 2 : Math.PI / 2;
      }
      const d = VS.dist2D(x, z, px, pz);
      if (d < 50 || d > 145) continue;
      if (this.game.world.resolveCircleCollision(x, z, typeId === 'tank' ? 3.2 : 2.5).hit) continue;

      const v = this.game.vehicleManager.spawnVehicle(typeId, x, z, yaw);
      v.isPoliceAI = true;
      v.sirenOn = typeId === 'police';
      v.aiStuckTimer = 0;
      v.reverseTimer = 0;
      v.deployCooldown = 2.5;
      v.fireCd = 2.6;
      if (typeId === 'tank') this.tanks.push(v);
      else this.cops.push(v);
      return v;
    }
    return null;
  }

  _spawnHeli() {
    if (this.heli) return this.heli;
    const root = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x162447 });
    const white = new THREE.MeshLambertMaterial({ color: 0xf8fafc });
    const glass = new THREE.MeshPhongMaterial({ color: 0x12324d, shininess: 120, specular: 0x90e0ef });
    const dark = new THREE.MeshLambertMaterial({ color: 0x1e2430 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 5.4), navy);
    root.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.55, 3.6), white);
    stripe.position.y = -0.2;
    root.add(stripe);
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.25, 2.2), glass);
    cockpit.position.set(0, 0.25, 2.1);
    root.add(cockpit);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 5.8), navy);
    tail.position.set(0, 0.3, -5.0);
    root.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 1.2), white);
    fin.position.set(0, 0.9, -7.4);
    root.add(fin);
    // Landing skids
    [-1.25, 1.25].forEach((sx) => {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 4.6), dark);
      skid.position.set(sx, -1.5, 0.2);
      root.add(skid);
    });
    // Spinning main rotor & tail rotor
    const mainRotor = new THREE.Group();
    mainRotor.position.set(0, 1.45, 0);
    mainRotor.add(new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.1, 0.36), dark));
    mainRotor.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 10.8), dark));
    root.add(mainRotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 0.22), dark);
    tailRotor.position.set(0.45, 0.85, -7.5);
    root.add(tailRotor);
    // Red/Blue warning strobes
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2a55 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x00d9ff });
    const strobeL = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 6), redMat);
    strobeL.position.set(-1.3, -0.4, 1.2);
    const strobeR = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 6), blueMat);
    strobeR.position.set(1.3, -0.4, 1.2);
    root.add(strobeL, strobeR);

    const px = this.game.player.x;
    const pz = this.game.player.z;
    const hx = px + 65;
    const hz = pz - 65;
    root.position.set(hx, 26, hz);
    this.game.scene.add(root);

    // Ground searchlight disc
    const spotMesh = new THREE.Mesh(
      new THREE.CircleGeometry(6.8, 22),
      new THREE.MeshBasicMaterial({ color: 0xe0f7ff, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false })
    );
    spotMesh.rotation.x = -Math.PI / 2;
    spotMesh.position.set(hx, 0.16, hz);
    this.game.scene.add(spotMesh);

    this.heli = {
      root, mainRotor, tailRotor, redMat, blueMat, spotMesh,
      x: hx, y: 26, z: hz, yaw: 0, orbitAngle: Math.random() * 6,
      fireCd: 2.2, strobePhase: 0,
      hp: 160, maxHp: 160, isHeli: true
    };
    return this.heli;
  }

  damageHeli(dmg) {
    if (!this.heli) return;
    this.heli.hp -= dmg;
    for (let i = 0; i < 5; i++) {
      this.game.world.spawnParticle({
        x: this.heli.x + VS.rand(-1.2, 1.2),
        y: this.heli.y + VS.rand(-0.8, 0.8),
        z: this.heli.z + VS.rand(-1.2, 1.2),
        vx: VS.rand(-6, 6),
        vy: VS.rand(-3, 6),
        vz: VS.rand(-6, 6),
        color: i % 2 === 0 ? 0xff7b00 : 0xffe066,
        size: 0.65,
        life: 0.42
      });
    }
    if (this.heli.hp <= 0) {
      const hx = this.heli.x, hy = this.heli.y, hz = this.heli.z;
      this.game.world.spawnExplosion(hx, hy, hz);
      this.game.audio.playExplosion();
      this.game.addCameraShake(0.95);
      this.game.scene.remove(this.heli.root);
      this.game.scene.remove(this.heli.spotMesh);
      this.heli = null;
      this.heliRespawnCd = 22;
      this.game.player.addCash(400);
      this.game.hud.addFeed(VS.t('击落 VCPD 武装直升机！赏金 +$400！', 'Shot down VCPD Chopper! +$400 Bounty!'), 'money');
      if (this.game.missions && this.game.missions.onHeliDestroyed) {
        this.game.missions.onHeliDestroyed();
      }
    }
  }

  _spawnFighterJet() {
    if (this.jet) return this.jet;
    const root = new THREE.Group();
    const hullMat = new THREE.MeshPhongMaterial({ color: 0x94a3b8, shininess: 90 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x334155 });
    const glassMat = new THREE.MeshPhongMaterial({ color: 0x0f172a, shininess: 140, specular: 0x38bdf8 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7b00 });

    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 11.5), hullMat);
    root.add(fuselage);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.95, 3.6, 6), darkMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0, 7.5);
    root.add(nose);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.85, 3.2), glassMat);
    canopy.position.set(0, 0.82, 2.4);
    root.add(canopy);
    // Swept delta wings + twin tail fins
    const wings = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.24, 3.6), hullMat);
    wings.position.set(0, -0.05, -0.8);
    root.add(wings);
    [-1.1, 1.1].forEach((fx) => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 2.4), darkMat);
      fin.position.set(fx, 1.3, -4.4);
      fin.rotation.z = fx > 0 ? -0.25 : 0.25;
      root.add(fin);
    });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.62, 3.2, 8), flameMat);
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(0, 0, -7.2);
    root.add(flame);

    const p = this.game.player;
    const approachYaw = Math.random() * Math.PI * 2;
    const dx = Math.sin(approachYaw);
    const dz = Math.cos(approachYaw);
    const sx = p.x - dx * 210;
    const sz = p.z - dz * 210;
    root.position.set(sx, 24, sz);
    root.rotation.y = approachYaw;
    this.game.scene.add(root);

    this.game.hud.addFeed(VS.t('空军喷气战机正在低空俯冲！注意躲避轰炸！', 'AIR FORCE JET INBOUND! Watch for airstrikes!'), 'crime');
    this.jet = {
      root, flame,
      x: sx, y: 24, z: sz,
      vx: dx * 72, vz: dz * 72,
      yaw: approachYaw,
      life: 6.2,
      dropsLeft: 3,
      dropTimer: 1.8
    };
    return this.jet;
  }

  _fireExplosiveProjectile(fromX, fromY, fromZ, targetX, targetZ, speed = 42, isAirstrike = false) {
    const dx = targetX - fromX;
    const dy = 0.5 - fromY;
    const dz = targetZ - fromZ;
    const dist = Math.hypot(dx, dy, dz) || 1;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(isAirstrike ? 0.42 : 0.3, 6, 6),
      new THREE.MeshBasicMaterial({ color: isAirstrike ? 0xff4d00 : 0xffdf4d })
    );
    mesh.position.set(fromX, fromY, fromZ);
    this.game.scene.add(mesh);

    let warnRing = null;
    if (isAirstrike) {
      warnRing = new THREE.Mesh(
        new THREE.RingGeometry(2.6, 3.4, 20),
        new THREE.MeshBasicMaterial({ color: 0xff2a55, side: THREE.DoubleSide, transparent: true, opacity: 0.78 })
      );
      warnRing.rotation.x = -Math.PI / 2;
      warnRing.position.set(targetX, 0.18, targetZ);
      this.game.scene.add(warnRing);
    }

    this.shells.push({
      mesh, warnRing,
      x: fromX, y: fromY, z: fromZ,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      vz: (dz / dist) * speed,
      life: Math.min(3.2, dist / speed + 0.15),
      radius: isAirstrike ? 6.8 : 5.2
    });
  }

  _spawnRoadblockAhead() {
    const p = this.game.player;
    const cfg = VS.CONFIG;
    if (!p.vehicle || Math.hypot(p.vehicle.vx, p.vehicle.vz) < 12) return;

    // Pick nearest avenue/street ahead of player
    const leadX = p.x + Math.sin(p.yaw) * 78;
    const leadZ = p.z + Math.cos(p.yaw) * 78;
    // Snap to closest avenue centerline
    let bestAx = cfg.AVENUE_X[0], bestDist = 999;
    for (const ax of cfg.AVENUE_X) {
      const d = Math.abs(leadX - ax);
      if (d < bestDist) { bestDist = d; bestAx = ax; }
    }
    if (bestDist > 22) return;
    const rz = VS.clamp(leadZ, -300, 265);
    if (VS.dist2D(bestAx, rz, p.x, p.z) < 48) return;

    // Clear old distant roadblocks first
    for (let i = this.roadblocks.length - 1; i >= 0; i--) {
      const rb = this.roadblocks[i];
      if (rb !== p.vehicle) this.game.vehicleManager.removeVehicle(rb);
    }
    this.roadblocks = [];

    // Place 2 angled VCPD cruisers forming a dramatic barricade with a narrow drift gap!
    [-4.8, 4.8].forEach((dx, idx) => {
      const rb = this.game.vehicleManager.spawnVehicle('police', bestAx + dx, rz, idx === 0 ? 1.32 : -1.32);
      rb.sirenOn = true;
      rb.isPoliceAI = false;
      this.roadblocks.push(rb);
    });
    this.game.hud.addFeed(VS.t('前方出现 VCPD 警车路障！', 'VCPD ROADBLOCK AHEAD!'), 'crime');
    this.roadblockCooldown = 36;
  }

  _spawnFootCop(x, z) {
    if (this.footCops.length >= 6) return;
    const root = new THREE.Group();
    const navyMat = new THREE.MeshLambertMaterial({ color: 0x162447 });
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xebb991 });
    const badgeMat = new THREE.MeshBasicMaterial({ color: 0xffdf4d });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.64, 0.28), navyMat);
    torso.position.y = 1.05; torso.castShadow = true;
    root.add(torso);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.04), badgeMat);
    badge.position.set(0.12, 1.15, 0.15);
    root.add(badge);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skinMat);
    head.position.y = 1.55;
    root.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.38), navyMat);
    cap.position.set(0, 1.72, 0.03);
    root.add(cap);
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.68, 0.2), navyMat);
    leftLeg.position.set(-0.13, 0.36, 0);
    root.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.68, 0.2), navyMat);
    rightLeg.position.set(0.13, 0.36, 0);
    root.add(rightLeg);

    root.position.set(x, 0, z);
    this.game.scene.add(root);
    this.footCops.push({
      root, leftLeg, rightLeg,
      x, z, vx: 0, vz: 0, yaw: 0,
      hp: 65, dead: false, deathTimer: 0, stunTimer: 0,
      attackCd: 0.6, walkPhase: 0,
      isCop: true, isEnemy: false
    });
  }

  computeCopCarControls(v, dt) {
    const p = this.game.player;
    const speed = Math.hypot(v.vx, v.vz);

    // Stuck recovery: reverse & turn cleanly if wedged on a building
    if (v.reverseTimer > 0) {
      v.reverseTimer -= dt;
      return { throttle: 0, brake: 0.85, steer: v.reverseSteer || 1, handbrake: false };
    }
    if (speed < 1.6) {
      v.aiStuckTimer += dt;
      if (v.aiStuckTimer > 1.35) {
        v.aiStuckTimer = 0;
        v.reverseTimer = 0.95;
        v.reverseSteer = Math.random() < 0.5 ? 1 : -1;
      }
    } else {
      v.aiStuckTimer = Math.max(0, v.aiStuckTimer - dt * 2);
    }

    // Lead player's movement slightly when player is driving
    const leadT = p.vehicle ? 0.65 : 0.1;
    const tx = p.x + (p.vehicle ? p.vehicle.vx * leadT : 0);
    const tz = p.z + (p.vehicle ? p.vehicle.vz * leadT : 0);
    const dist = VS.dist2D(v.x, v.z, tx, tz);

    // If player is on foot and cop car is close, stop and deploy officer!
    if (!p.vehicle && dist < 13) {
      v.deployCooldown -= dt;
      if (v.deployCooldown <= 0) {
        v.deployCooldown = 7.0;
        const sx = v.x + Math.cos(v.yaw) * 2.4;
        const sz = v.z - Math.sin(v.yaw) * 2.4;
        this._spawnFootCop(sx, sz);
      }
      return { throttle: 0, brake: 1.0, steer: 0, handbrake: true };
    }

    // Simple obstacle-avoidance whisker check ahead
    let desiredYaw = Math.atan2(tx - v.x, tz - v.z);
    const probeDist = 11;
    const pxFwd = v.x + Math.sin(v.yaw) * probeDist;
    const pzFwd = v.z + Math.cos(v.yaw) * probeDist;
    if (this.game.world.resolveCircleCollision(pxFwd, pzFwd, 1.8).hit) {
      const leftFree = !this.game.world.resolveCircleCollision(v.x + Math.sin(v.yaw + 0.65) * probeDist, v.z + Math.cos(v.yaw + 0.65) * probeDist, 1.6).hit;
      desiredYaw = v.yaw + (leftFree ? 0.9 : -0.9);
    }

    const yawErr = VS.angleDiff(v.yaw, desiredYaw);
    const steer = VS.clamp(yawErr * 1.85, -1, 1);

    // Slower, fair pursuit speeds so skilled drivers can break line-of-sight and cool down stars!
    const maxChaseSpeed = v.spec.isTank ? 14.5 : (17 + this.wantedStars * 2.8);
    const sharpTurn = Math.abs(yawErr) > 0.85;
    return {
      throttle: sharpTurn ? 0.30 : (speed < maxChaseSpeed ? 0.78 : 0.22),
      brake: sharpTurn && speed > 13 ? 0.5 : 0,
      steer,
      handbrake: sharpTurn && speed > 15
    };
  }

  update(dt) {
    const g = this.game;
    const p = g.player;

    if (this.roadblockCooldown > 0) this.roadblockCooldown -= dt;
    if (this.heliRespawnCd > 0) this.heliRespawnCd -= dt;

    // Always update in-flight shells/rockets even if wanted clears mid-air
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const sh = this.shells[i];
      sh.life -= dt;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.z += sh.vz * dt;
      sh.mesh.position.set(sh.x, sh.y, sh.z);
      const hitGround = sh.y <= 0.6 || sh.life <= 0;
      const hitPlayer = VS.dist2D(sh.x, sh.z, p.x, p.z) < 2.2 && sh.y < 2.6;
      if (hitGround || hitPlayer) {
        g.world.spawnExplosion(sh.x, 0.8, sh.z);
        g.audio.playExplosion();
        const dp = VS.dist2D(sh.x, sh.z, p.x, p.z);
        if (dp < sh.radius + 10) g.addCameraShake(VS.clamp(1 - dp / 22, 0.2, 0.85));
        if (dp < sh.radius && !p.isDead) {
          const dmg = (1 - dp / sh.radius) * 32 + 12;
          if (p.vehicle) p.vehicle.applyDamage(dmg * 1.4, g);
          else p.takeDamage(dmg);
        }
        g.scene.remove(sh.mesh);
        if (sh.warnRing) g.scene.remove(sh.warnRing);
        this.shells.splice(i, 1);
      }
    }

    // Subtle natural heat decay when wantedStars === 0 (petty heat cools down)
    if (this.wantedStars === 0 && this.heat > 0) {
      this.heat = Math.max(0, this.heat - dt * 5);
      return;
    }
    if (this.wantedStars === 0) return;

    // 1. Maintain pursuit squad size based on Wanted Stars (slower respawn cadence)
    const desiredCops = Math.min(4, this.wantedStars);
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i];
      if (!c.isPoliceAI || c.driver === p) {
        this.cops.splice(i, 1);
        continue;
      }
      if (c.destroyed || VS.dist2D(c.x, c.z, p.x, p.z) > 210) {
        g.vehicleManager.removeVehicle(c);
        this.cops.splice(i, 1);
      }
    }

    this.spawnTimer -= dt;
    if (this.cops.length < desiredCops && this.spawnTimer <= 0) {
      this._spawnCopCruiser('police');
      this.spawnTimer = 5.0;
    }

    // Spawn Roadblocks at 3+ stars
    if (this.wantedStars >= 3 && this.roadblockCooldown <= 0) {
      this._spawnRoadblockAhead();
    }

    // 1B. 3+ Stars -> VCPD Armed Helicopter with searchlight & bursts
    let heliSeesPlayer = false;
    if (this.wantedStars >= 3) {
      if (!this.heli && this.heliRespawnCd <= 0) this._spawnHeli();
      if (this.heli) {
        const h = this.heli;
        h.orbitAngle += dt * 0.42;
        h.strobePhase += dt * 8;
        h.mainRotor.rotation.y += dt * 24;
        h.tailRotor.rotation.x += dt * 30;
        const alt = Math.floor(h.strobePhase) % 2 === 0;
        h.redMat.color.setHex(alt ? 0xff1e42 : 0x440a14);
        h.blueMat.color.setHex(alt ? 0x0a2544 : 0x00d9ff);

        const targetX = p.x + Math.cos(h.orbitAngle) * 26;
        const targetZ = p.z + Math.sin(h.orbitAngle) * 26;
        const dx = targetX - h.x;
        const dz = targetZ - h.z;
        const dTarget = Math.hypot(dx, dz) || 1;
        const moveSpd = Math.min(20, dTarget * 1.15); // Slower than sports cars so players can outrun heli!
        h.x += (dx / dTarget) * moveSpd * dt;
        h.z += (dz / dTarget) * moveSpd * dt;
        h.yaw = Math.atan2(p.x - h.x, p.z - h.z);
        h.root.position.set(h.x, h.y + Math.sin(h.orbitAngle * 2) * 0.7, h.z);
        h.root.rotation.y = h.yaw;

        const dPlayerH = VS.dist2D(h.x, h.z, p.x, p.z);
        // Searchlight tracks smoothly toward player
        const lx = VS.lerp(h.spotMesh.position.x, p.x, Math.min(1, dt * 2.5));
        const lz = VS.lerp(h.spotMesh.position.z, p.z, Math.min(1, dt * 2.5));
        h.spotMesh.position.set(lx, 0.16, lz);
        if (dPlayerH < 34) heliSeesPlayer = true;

        h.fireCd -= dt;
        if (h.fireCd <= 0 && dPlayerH < 46 && !p.isDead) {
          h.fireCd = 2.4;
          const aimX = p.x + VS.rand(-2.2, 2.2);
          const aimZ = p.z + VS.rand(-2.2, 2.2);
          p.spawnTracer(h.x, h.y - 1.2, h.z, aimX, 1.1, aimZ, 0x38bdf8);
          g.audio.playGunshot(true);
          if (VS.dist2D(aimX, aimZ, p.x, p.z) < 2.1) {
            if (p.vehicle) p.vehicle.applyDamage(12, g);
            else p.takeDamage(9);
          }
        }
      }
    } else if (this.heli) {
      g.scene.remove(this.heli.root);
      g.scene.remove(this.heli.spotMesh);
      this.heli = null;
    }

    // 1C. 4+ Stars -> Military Rhino Tanks with rotating turrets & explosive shells!
    const desiredTanks = this.wantedStars >= 5 ? 2 : (this.wantedStars >= 4 ? 1 : 0);
    for (let i = this.tanks.length - 1; i >= 0; i--) {
      const tk = this.tanks[i];
      if (!tk.isPoliceAI || tk.driver === p) {
        this.tanks.splice(i, 1);
        continue;
      }
      if (tk.destroyed || VS.dist2D(tk.x, tk.z, p.x, p.z) > 220) {
        g.vehicleManager.removeVehicle(tk);
        this.tanks.splice(i, 1);
        continue;
      }
      // Rotate turret smoothly toward player & fire tank shells when in range
      if (tk.turret) {
        const worldAng = Math.atan2(p.x - tk.x, p.z - tk.z);
        const localTarget = VS.angleDiff(tk.yaw, worldAng);
        tk.turret.rotation.y += VS.angleDiff(tk.turret.rotation.y, localTarget) * Math.min(1, dt * 3.5);
      }
      tk.fireCd = (tk.fireCd || 2.5) - dt;
      const dtank = VS.dist2D(tk.x, tk.z, p.x, p.z);
      if (tk.fireCd <= 0 && dtank < 62 && dtank > 10 && g.world.hasLineOfSight(tk.x, tk.z, p.x, p.z) && !p.isDead) {
        tk.fireCd = 3.8;
        const aimAng = Math.atan2(p.x - tk.x, p.z - tk.z);
        const mzX = tk.x + Math.sin(aimAng) * 4.5;
        const mzZ = tk.z + Math.cos(aimAng) * 4.5;
        this._fireExplosiveProjectile(mzX, 1.9, mzZ, p.x + VS.rand(-2.5, 2.5), p.z + VS.rand(-2.5, 2.5), 42, false);
        g.audio.playExplosion();
      }
    }
    this.tankSpawnTimer -= dt;
    if (this.tanks.length < desiredTanks && this.tankSpawnTimer <= 0) {
      this._spawnCopCruiser('tank');
      this.tankSpawnTimer = 8.0;
    }

    // 1D. 5 Stars -> Air Force Fighter Jet high-speed low-altitude airstrike passes!
    if (this.wantedStars >= 5) {
      if (!this.jet) {
        this.jetCooldown -= dt;
        if (this.jetCooldown <= 0) {
          this._spawnFighterJet();
          this.jetCooldown = 12.0;
        }
      } else {
        const jt = this.jet;
        jt.life -= dt;
        jt.x += jt.vx * dt;
        jt.z += jt.vz * dt;
        jt.root.position.set(jt.x, jt.y, jt.z);
        jt.root.rotation.z = Math.sin(jt.life * 2.5) * 0.28;
        jt.flame.scale.set(1, 0.8 + Math.random() * 0.5, 1);
        jt.dropTimer -= dt;
        if (jt.dropsLeft > 0 && jt.dropTimer <= 0 && VS.dist2D(jt.x, jt.z, p.x, p.z) < 120) {
          jt.dropsLeft--;
          jt.dropTimer = 0.48;
          this._fireExplosiveProjectile(jt.x, jt.y - 1.2, jt.z, p.x + VS.rand(-9, 9), p.z + VS.rand(-9, 9), 38, true);
        }
        if (jt.life <= 0) {
          g.scene.remove(jt.root);
          this.jet = null;
        }
      }
    } else if (this.jet) {
      g.scene.remove(this.jet.root);
      this.jet = null;
    }

    // 2. Update On-Foot Officers (slower chase & narrower sight radius)
    let closestThreat = 999;
    let copSeesPlayer = heliSeesPlayer;

    for (const c of this.cops) {
      if (c.destroyed) continue;
      const d = VS.dist2D(c.x, c.z, p.x, p.z);
      if (d < closestThreat) closestThreat = d;
      if (d < 38 && g.world.hasLineOfSight(c.x, c.z, p.x, p.z)) copSeesPlayer = true;
    }
    for (const tk of this.tanks) {
      if (tk.destroyed) continue;
      const d = VS.dist2D(tk.x, tk.z, p.x, p.z);
      if (d < closestThreat) closestThreat = d;
      if (d < 44 && g.world.hasLineOfSight(tk.x, tk.z, p.x, p.z)) copSeesPlayer = true;
    }

    for (let i = this.footCops.length - 1; i >= 0; i--) {
      const fc = this.footCops[i];
      if (fc.dead) {
        fc.deathTimer -= dt;
        fc.root.rotation.x = Math.PI / 2;
        fc.root.position.set(fc.x, 0.25, fc.z);
        if (fc.deathTimer <= 0) {
          g.scene.remove(fc.root);
          this.footCops.splice(i, 1);
        }
        continue;
      }

      const d = VS.dist2D(fc.x, fc.z, p.x, p.z);
      if (d > 95) {
        g.scene.remove(fc.root);
        this.footCops.splice(i, 1);
        continue;
      }
      if (d < closestThreat) closestThreat = d;
      if (d < 30 && g.world.hasLineOfSight(fc.x, fc.z, p.x, p.z)) copSeesPlayer = true;

      if (fc.stunTimer > 0) {
        fc.stunTimer -= dt;
        fc.vx *= Math.pow(0.06, dt);
        fc.vz *= Math.pow(0.06, dt);
      } else {
        const ang = Math.atan2(p.x - fc.x, p.z - fc.z);
        fc.yaw = ang;
        const spd = d > 2.2 ? 4.3 : 0;
        fc.vx = Math.sin(ang) * spd;
        fc.vz = Math.cos(ang) * spd;

        fc.attackCd -= dt;
        if (fc.attackCd <= 0 && !p.isDead) {
          if (d < 2.4 && !p.vehicle) {
            fc.attackCd = 0.95;
            p.takeDamage(9);
            g.audio.playPunch(true);
            g.addCameraShake(0.18);
          } else if (this.wantedStars >= 2 && d < 24 && g.world.hasLineOfSight(fc.x, fc.z, p.x, p.z)) {
            fc.attackCd = 1.25;
            p.spawnTracer(fc.x, 1.35, fc.z, p.x + VS.rand(-1, 1), 1.2, p.z + VS.rand(-1, 1), 0x38bdf8);
            g.audio.playGunshot(false);
            if (Math.random() < (p.vehicle ? 0.25 : 0.45)) {
              if (p.vehicle) p.vehicle.applyDamage(7, g);
              else p.takeDamage(8);
            }
          }
        }
      }

      const col = g.world.resolveCircleCollision(fc.x + fc.vx * dt, fc.z + fc.vz * dt, 0.45);
      fc.x = col.x; fc.z = col.z;

      // Vehicle hit check on foot cop
      if (p.vehicle && VS.dist2D(fc.x, fc.z, p.vehicle.x, p.vehicle.z) < 2.2 && Math.hypot(p.vehicle.vx, p.vehicle.vz) > 5) {
        g.damageNPC(fc, 90, p.vehicle.vx, p.vehicle.vz, 'vehicle');
        g.audio.playCrash(0.35);
      }

      fc.walkPhase += dt * Math.hypot(fc.vx, fc.vz) * 2.5;
      const sw = Math.sin(fc.walkPhase) * 0.65;
      fc.leftLeg.rotation.x = sw;
      fc.rightLeg.rotation.x = -sw;
      fc.root.position.set(fc.x, 0, fc.z);
      fc.root.rotation.y = fc.yaw;
    }

    // 3. BUSTED arrest check (more forgiving 4.2s window to escape)
    const playerSpeed = p.vehicle ? Math.hypot(p.vehicle.vx, p.vehicle.vz) : Math.hypot(p.vx, p.vz);
    if (closestThreat < 5.2 && playerSpeed < 1.8 && !p.isDead && g.recoverTimer <= 0) {
      this.bustProgress += dt;
      if (this.bustProgress > 4.2) {
        this.bustProgress = 0;
        g.triggerPlayerDown('BUSTED');
        return;
      }
    } else {
      this.bustProgress = Math.max(0, this.bustProgress - dt * 1.8);
    }

    // 4. Generous Line-of-Sight Evasion & Star Cooldown!
    if (!copSeesPlayer) {
      this.evadeTimer += dt;
      this.isEvading = this.evadeTimer > 1.2;
      if (this.isEvading && !this.evadeNotified) {
        this.evadeNotified = true;
        g.hud.addFeed(VS.t('已脱离警方视线！保持隐蔽片刻即可消星...', 'Out of sight! Stay hidden to lose your Wanted Level...'), 'money');
      }
      const neededEvade = 6.5 + this.wantedStars * 1.4;
      if (this.evadeTimer >= neededEvade) {
        this.clearWanted(false);
      }
    } else {
      this.evadeTimer = 0;
      this.isEvading = false;
      this.evadeNotified = false;
    }
  }
};
