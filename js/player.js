// VICE SUN '86 - Third-Person Player Controller, Melee Combo & Shooting
window.VS = window.VS || {};

VS.Player = class Player {
  constructor(scene) {
    this.scene = scene;
    // Start right on sunny Ocean Drive facing the hotels & beach!
    this.x = 110.2;
    this.y = 0;
    this.z = 44;
    this.vx = 0;
    this.vz = 0;
    this.yaw = Math.PI; // facing north up Ocean Drive
    this.radius = 0.55;

    this.hp = 100;
    this.maxHp = 100;
    this.armor = 0;
    this.maxArmor = 100;
    this.cash = 250;

    // Weapons & Ammo (Spawn armed and ready!)
    this.ownedWeapons = { fists: true, bat: true, pistol: true, smg: true, shotgun: true, rpg: true };
    this.ammo = { pistol: 48, smg: 90, shotgun: 20, rpg: 8 };
    this.weaponId = 'pistol';
    this.attackCooldown = 0;
    this.comboIndex = 0;
    this.comboTimer = 0;
    this.attackAnim = 0;

    // Vehicle reference
    this.vehicle = null;
    this.isCrouching = false;
    this.inCover = false;
    this.enterCooldown = 0;
    this.walkCycle = 0;
    this.hurtFlash = 0;
    this.isDead = false;

    // Garage upgrade levels (apply to any car player drives!)
    this.upgrades = { engine: 0, turbo: 0, armor: 0 };
    this.unlockedCars = {};

    // Active tracers & rockets
    this.tracers = [];
    this.rockets = [];
    this.lockedTarget = null;

    this._buildMesh();
  }

  _buildMesh() {
    this.root = new THREE.Group();

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xf1c29b });
    const jacketMat = new THREE.MeshLambertMaterial({ color: 0x00c2cb }); // Iconic 80s Miami Vice turquoise blazer
    const jacketDarkMat = new THREE.MeshLambertMaterial({ color: 0x009aa3 });
    const teeMat = new THREE.MeshLambertMaterial({ color: 0xff5e99 });    // Hot pink undershirt
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0xf1f5f9 });  // Crisp white linen slacks
    const beltMat = new THREE.MeshLambertMaterial({ color: 0x1e1b24 });
    const goldMat = new THREE.MeshPhongMaterial({ color: 0xffd23f, shininess: 110 });
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const soleMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x2b1d14 });
    const shadesMat = new THREE.MeshPhongMaterial({ color: 0x090b12, shininess: 140, specular: 0x7df9ff });

    // Torso (tailored blazer, lapels, belt & neck)
    this.torso = new THREE.Group();
    this.torso.position.y = 1.08;
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.64, 0.30), jacketMat);
    jacket.castShadow = true;
    this.torso.add(jacket);
    // Broad 80s blazer shoulders
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.16, 0.32), jacketMat);
    shoulders.position.set(0, 0.25, 0);
    shoulders.castShadow = true;
    this.torso.add(shoulders);
    // Front undershirt V-panel
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.56, 0.14), teeMat);
    shirt.position.set(0, 0.02, 0.10);
    this.torso.add(shirt);
    // Blazer lapels & collar
    [-0.13, 0.13].forEach((lx) => {
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.05), jacketDarkMat);
      lapel.position.set(lx, 0.08, 0.16);
      lapel.rotation.z = lx > 0 ? 0.14 : -0.14;
      this.torso.add(lapel);
    });
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.11, 0.34), jacketDarkMat);
    collar.position.set(0, 0.34, -0.02);
    this.torso.add(collar);
    // Leather belt + gold buckle
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.08, 0.32), beltMat);
    belt.position.set(0, -0.31, 0);
    this.torso.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.04), goldMat);
    buckle.position.set(0, -0.31, 0.16);
    this.torso.add(buckle);
    // Neck cylinder
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 8), skinMat);
    neck.position.set(0, 0.39, 0);
    this.torso.add(neck);
    this.root.add(this.torso);

    // Head (sculpted hair, sideburns, ears, aviator shades)
    this.head = new THREE.Group();
    this.head.position.set(0, 0.58, 0);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.34, 0.31), skinMat);
    skull.castShadow = true;
    this.head.add(skull);
    // Ears
    [-0.165, 0.165].forEach((ex) => {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.07), skinMat);
      ear.position.set(ex, 0.0, 0);
      this.head.add(ear);
    });
    // Swept 80s hair volume + back fade
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.35), hairMat);
    hairTop.position.set(0, 0.16, -0.01);
    this.head.add(hairTop);
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.22, 0.1), hairMat);
    hairBack.position.set(0, 0.04, -0.14);
    this.head.add(hairBack);
    const hairBang = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.08), hairMat);
    hairBang.position.set(0.02, 0.14, 0.16);
    hairBang.rotation.z = -0.12;
    this.head.add(hairBang);
    // Gold-framed aviator sunglasses
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.025, 0.05), goldMat);
    bridge.position.set(0, 0.05, 0.155);
    this.head.add(bridge);
    [-0.08, 0.08].forEach((sx) => {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.05), shadesMat);
      lens.position.set(sx, 0.02, 0.16);
      this.head.add(lens);
    });
    this.torso.add(this.head);

    // Arms (rolled 80s blazer sleeves + bare forearms + gold watch on left wrist, gun in right hand)
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(0.37, 0.24, 0);
    const laUpper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.17), jacketMat);
    laUpper.position.y = -0.14; laUpper.castShadow = true;
    this.leftArm.add(laUpper);
    const laCuff = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.07, 0.185), jacketDarkMat);
    laCuff.position.y = -0.30;
    this.leftArm.add(laCuff);
    const laFore = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.24, 0.13), skinMat);
    laFore.position.y = -0.44;
    this.leftArm.add(laFore);
    const watch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.145), goldMat);
    watch.position.y = -0.49;
    this.leftArm.add(watch);
    this.torso.add(this.leftArm);

    this.rightArm = new THREE.Group();
    this.rightArm.position.set(-0.37, 0.24, 0);
    const raUpper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, 0.17), jacketMat);
    raUpper.position.y = -0.14; raUpper.castShadow = true;
    this.rightArm.add(raUpper);
    const raCuff = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.07, 0.185), jacketDarkMat);
    raCuff.position.y = -0.30;
    this.rightArm.add(raCuff);
    const raFore = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.24, 0.13), skinMat);
    raFore.position.y = -0.44;
    this.rightArm.add(raFore);

    // Detailed Gun models attached to right hand (Pistol vs MAC-10 SMG)
    const gunMetal = new THREE.MeshPhongMaterial({ color: 0x1e2430, shininess: 90 });
    const gunSlide = new THREE.MeshPhongMaterial({ color: 0x475569, shininess: 110 });
    this.pistolMesh = new THREE.Group();
    const pSlide = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.32), gunSlide);
    pSlide.position.set(0, -0.52, 0.18);
    const pGrip = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.14, 0.09), gunMetal);
    pGrip.position.set(0, -0.60, 0.06);
    pGrip.rotation.x = 0.22;
    this.pistolMesh.add(pSlide, pGrip);
    this.rightArm.add(this.pistolMesh);

    this.smgMesh = new THREE.Group();
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.13, 0.36), gunMetal);
    sBody.position.set(0, -0.52, 0.20);
    const sBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 6), gunSlide);
    sBarrel.rotation.x = Math.PI / 2;
    sBarrel.position.set(0, -0.51, 0.44);
    const sMag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.07), gunSlide);
    sMag.position.set(0, -0.66, 0.14);
    this.smgMesh.add(sBody, sBarrel, sMag);
    this.rightArm.add(this.smgMesh);

    const woodMat = new THREE.MeshLambertMaterial({ color: 0x7c4a21 });
    const oliveMat = new THREE.MeshLambertMaterial({ color: 0x4b5d3b });
    const warheadMat = new THREE.MeshPhongMaterial({ color: 0x9a5b25, shininess: 80 });

    this.shotgunMesh = new THREE.Group();
    const sgStock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.24), woodMat);
    sgStock.position.set(0, -0.55, 0.02);
    sgStock.rotation.x = 0.14;
    const sgReceiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.10, 0.22), gunMetal);
    sgReceiver.position.set(0, -0.51, 0.22);
    const sgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.48, 8), gunMetal);
    sgBarrel.rotation.x = Math.PI / 2;
    sgBarrel.position.set(0, -0.49, 0.50);
    const sgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.38, 6), gunSlide);
    sgTube.rotation.x = Math.PI / 2;
    sgTube.position.set(0, -0.535, 0.45);
    const sgPump = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.075, 0.18), woodMat);
    sgPump.position.set(0, -0.545, 0.44);
    this.shotgunMesh.add(sgStock, sgReceiver, sgBarrel, sgTube, sgPump);
    this.rightArm.add(this.shotgunMesh);

    this.rpgMesh = new THREE.Group();
    const rpgTube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.70, 10), oliveMat);
    rpgTube.rotation.x = Math.PI / 2;
    rpgTube.position.set(0, -0.50, 0.10); // extends [z: -0.25..+0.45]
    const rpgBell = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.055, 0.08, 10), gunMetal);
    rpgBell.rotation.x = Math.PI / 2;
    rpgBell.position.set(0, -0.50, -0.26);
    const rpgGrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.08), woodMat);
    rpgGrip.position.set(0, -0.60, 0.14);
    const rpgWarhead = new THREE.Mesh(new THREE.ConeGeometry(0.088, 0.24, 8), warheadMat);
    rpgWarhead.rotation.x = Math.PI / 2;
    rpgWarhead.position.set(0, -0.50, 0.55);
    this.rpgMesh.add(rpgTube, rpgBell, rpgGrip, rpgWarhead);
    this.rightArm.add(this.rpgMesh);

    this.batMesh = new THREE.Group();
    const batBody = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.10, 1.05, 10), new THREE.MeshPhongMaterial({ color: 0x9b5b32, shininess: 65 }));
    batBody.rotation.z = -0.28; batBody.position.set(-0.02, -0.52, 0.22);
    const batGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.28, 8), new THREE.MeshBasicMaterial({ color: 0xff3ca6 }));
    batGrip.position.set(-0.02, -0.90, 0.32);
    this.batMesh.add(batBody, batGrip); this.batMesh.visible = false; this.rightArm.add(this.batMesh);

    this.gunMesh = this.pistolMesh; // backwards compat ref
    this._syncWeaponMeshes();

    this.muzzleFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe066 })
    );
    this.muzzleFlash.position.set(0, -0.52, 0.48);
    this.muzzleFlash.visible = false;
    this.rightArm.add(this.muzzleFlash);
    this.torso.add(this.rightArm);

    // Legs (tailored linen slacks + two-tone sneakers)
    [-0.14, 0.14].forEach((lx, idx) => {
      const leg = new THREE.Group();
      leg.position.set(lx, 0.74, 0);
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.64, 0.21), pantsMat);
      thigh.position.y = -0.32; thigh.castShadow = true;
      leg.add(thigh);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.09, 0.30), shoeMat);
      shoe.position.set(0, -0.66, 0.04);
      leg.add(shoe);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.31), soleMat);
      sole.position.set(0, -0.72, 0.04);
      leg.add(sole);
      this.root.add(leg);
      if (idx === 0) this.leftLeg = leg;
      else this.rightLeg = leg;
    });

    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.yaw;
    this.scene.add(this.root);
  }

  _syncWeaponMeshes() {
    if (this.pistolMesh) this.pistolMesh.visible = this.weaponId === 'pistol';
    if (this.smgMesh) this.smgMesh.visible = this.weaponId === 'smg';
    if (this.shotgunMesh) this.shotgunMesh.visible = this.weaponId === 'shotgun';
    if (this.rpgMesh) this.rpgMesh.visible = this.weaponId === 'rpg';
    if (this.batMesh) this.batMesh.visible = this.weaponId === 'bat';
  }

  selectWeapon(id) {
    if (!this.ownedWeapons[id]) return false;
    this.weaponId = id;
    this._syncWeaponMeshes();
    return true;
  }

  getWeaponLabel() {
    const w = VS.CONFIG.WEAPONS[this.weaponId];
    if (w.type === 'melee') return { name: VS.wpnName(w), sub: VS.t('近战', 'MELEE') };
    return { name: VS.wpnName(w), sub: `${this.ammo[this.weaponId] || 0} ${VS.t('发', 'RDS')}` };
  }

  takeDamage(amount) {
    if (this.isDead) return;
    if (!this.vehicle && this.inCover) amount *= 0.38;
    let rem = amount;
    if (this.armor > 0) {
      const absorb = Math.min(this.armor, rem * 0.75);
      this.armor -= absorb;
      rem -= absorb;
    }
    this.hp = Math.max(0, this.hp - rem);
    this.hurtFlash = 0.25;
  }

  healFull() {
    this.hp = this.maxHp;
    this.isDead = false;
    this.isCrouching = false;
    this.inCover = false;
  }

  toggleCrouch(force) { this.isCrouching = typeof force === 'boolean' ? force : !this.isCrouching; return this.isCrouching; }

  addCash(amt) {
    this.cash = Math.max(0, Math.round(this.cash + amt));
  }

  spendCash(amt) {
    if (this.cash < amt) return false;
    this.cash -= amt;
    return true;
  }

  spawnTracer(fromX, fromY, fromZ, toX, toY, toZ, color = 0xffe066) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(fromX, fromY, fromZ),
      new THREE.Vector3(toX, toY, toZ)
    ]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  findAutoAimTarget(game, aimYaw, maxRange = 42) {
    if (!game) return null;
    const ox = this.vehicle ? this.vehicle.x : this.x;
    const oz = this.vehicle ? this.vehicle.z : this.z;
    const isTouch = typeof document !== 'undefined' && document.body && document.body.classList.contains('touch-mode');
    const cone = isTouch ? 1.05 : 0.30;
    let bestHostile = null;
    let bestHostileScore = Infinity;
    let bestNeutral = null;
    let bestNeutralScore = Infinity;

    if (game.getCombatTargets) {
      const targets = game.getCombatTargets();
      for (let i = 0; i < targets.length; i++) {
        const npc = targets[i];
        if (!npc || npc.dead) continue;
        const d = VS.dist2D(ox, oz, npc.x, npc.z);
        if (d > maxRange || d < 0.15) continue;
        const ang = Math.abs(VS.angleDiff(aimYaw, Math.atan2(npc.x - ox, npc.z - oz)));
        if (ang > cone) continue;
        if (game.world && game.world.hasLineOfSight && !game.world.hasLineOfSight(ox, oz, npc.x, npc.z)) continue;
        const isHostile = !!(npc.isEnemy || npc.isCop || npc.state === 'fight_player' || npc.state === 'brawl');
        const score = d + (ang / cone) * 10;
        if (isHostile) {
          if (score < bestHostileScore) {
            bestHostileScore = score;
            bestHostile = npc;
          }
        } else if (isTouch && score < bestNeutralScore) {
          bestNeutralScore = score;
          bestNeutral = npc;
        }
      }
    }

    if (maxRange >= 40 && game.police && game.police.heli) {
      const h = game.police.heli;
      const d = VS.dist2D(ox, oz, h.x, h.z);
      if (d <= maxRange) {
        const ang = Math.abs(VS.angleDiff(aimYaw, Math.atan2(h.x - ox, h.z - oz)));
        if (ang <= cone) {
          const score = d + (ang / cone) * 10;
          if (score < bestHostileScore) {
            bestHostileScore = score;
            bestHostile = h;
          }
        }
      }
    }

    if (maxRange >= 30 && game.world && game.world.hasLineOfSight) {
      const vehicles = [];
      if (game.police) vehicles.push(...(game.police.cops || []), ...(game.police.tanks || []));
      if (game.missions && game.missions.active && game.missions.active.id === 'armored_hit' && game.missions.targetVehicle) vehicles.push(game.missions.targetVehicle);
      for (const v of vehicles) {
        if (!v || v.destroyed || v === this.vehicle) continue;
        const d = VS.dist2D(ox, oz, v.x, v.z), ang = Math.abs(VS.angleDiff(aimYaw, Math.atan2(v.x - ox, v.z - oz)));
        if (d > maxRange || d < 0.15 || ang > cone || !game.world.hasLineOfSight(ox, oz, v.x, v.z)) continue;
        const score = d + (ang / cone) * 10;
        if (score < bestHostileScore) { bestHostileScore = score; bestHostile = v; }
      }
    }
    if (bestHostile) return bestHostile.applyDamage ? { ...bestHostile, y: (bestHostile.y || 0) + 1.15 } : { ...bestHostile, y: bestHostile === game.police?.heli ? bestHostile.y : (bestHostile.y || 0) + 1.25 };
    return bestNeutral ? { ...bestNeutral, y: (bestNeutral.y || 0) + 1.25 } : null;
  }

  spawnRocket(game, x, y, z, dx, dy, dz, speed, blastRadius, maxDmg, ignoreVehicle = null) {
    const len = Math.hypot(dx, dy, dz) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const nz = dz / len;

    const mesh = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.10, 0.52, 8),
      new THREE.MeshBasicMaterial({ color: 0xff6b00 })
    );
    body.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.11, 0.24, 8),
      new THREE.MeshBasicMaterial({ color: 0xffdf4d })
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 0.36;
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2a00 })
    );
    flame.position.z = -0.32;
    mesh.add(body, tip, flame);
    mesh.position.set(x, y, z);
    mesh.lookAt(x + nx, y + ny, z + nz);
    this.scene.add(mesh);

    this.rockets.push({
      mesh, x, y, z,
      vx: nx * speed,
      vy: ny * speed,
      vz: nz * speed,
      life: 2.6,
      radius: blastRadius,
      maxDmg,
      ignoreVehicle
    });
  }

  detonateExplosion(game, x, y, z, radius, maxDmg, ignoreVehicle = null) {
    if (!game) return;
    game.world.spawnExplosion(x, Math.max(0.6, y), z);
    game.audio.playExplosion();
    game.addCameraShake(0.85);

    if (game.getCombatTargets) {
      const targets = game.getCombatTargets();
      for (const npc of targets) {
        if (npc.dead) continue;
        const d = VS.dist2D(x, z, npc.x, npc.z);
        if (d <= radius) {
          const falloff = VS.clamp(1 - (d / radius) * 0.65, 0.25, 1.0);
          const ang = Math.atan2(npc.x - x, npc.z - z);
          game.damageNPC(npc, maxDmg * falloff, Math.sin(ang) * 18 * falloff, Math.cos(ang) * 18 * falloff, 'explosion');
        }
      }
    }

    if (game.vehicles) {
      for (const v of game.vehicles) {
        if (v === ignoreVehicle || v.destroyed) continue;
        const d = VS.dist2D(x, z, v.x, v.z);
        if (d <= radius) {
          const falloff = VS.clamp(1 - Math.max(0, d - 1.8) / radius, 0.25, 1.0);
          const mult = !v.driver ? (v.spec.isTank ? (maxDmg > 300 ? 1.35 : 1.85) : 2.0) : 1.0;
          v.applyDamage(falloff * maxDmg * mult, game, true);
        }
      }
    }

    if (game.police && game.police.heli) {
      const h = game.police.heli;
      const d3 = Math.hypot(h.x - x, h.y - y, h.z - z);
      if (d3 <= radius + 5) {
        game.police.damageHeli(maxDmg);
      }
    }

    if (game.police) {
      game.police.reportCrime(VS.t('重火器爆炸', 'Explosive Ordnance'), 35);
    }
  }

  _fireBulletRay(game, startX, startY, startZ, yaw, spread, range, damage, color, knockForce, ignoreVehicle = null) {
    const jitter = (Math.random() - 0.5) * (spread > 0.1 ? spread * 1.6 : spread);
    const dirX = Math.sin(yaw + jitter);
    const dirZ = Math.cos(yaw + jitter);

    let bestDist = range;
    let bestNPC = null;
    let bestVeh = null;
    let hitHeli = false;
    let endY = startY - 0.1;

    // Check building stop distance along ray
    for (let d = 1.5; d <= range; d += 1.5) {
      const px = startX + dirX * d;
      const pz = startZ + dirZ * d;
      let blocked = false;
      for (let i = 0; i < game.world.colliders.length; i++) {
        const b = game.world.colliders[i];
        if (b.height > 1.2 && px > b.minX && px < b.maxX && pz > b.minZ && pz < b.maxZ) {
          bestDist = d; blocked = true; break;
        }
      }
      if (blocked) break;
    }

    // Ray vs NPCs
    const targets = game.getCombatTargets();
    for (const npc of targets) {
      if (npc.dead) continue;
      const toX = npc.x - startX;
      const toZ = npc.z - startZ;
      const proj = toX * dirX + toZ * dirZ;
      if (proj > 0 && proj < bestDist) {
        const perpSq = (toX * toX + toZ * toZ) - proj * proj;
        if (perpSq < 0.85 * 0.85) {
          bestDist = proj;
          bestNPC = npc;
          bestVeh = null;
        }
      }
    }

    // Ray vs Vehicles
    if (game.vehicles) {
      for (const v of game.vehicles) {
        if (v === ignoreVehicle) continue;
        const toX = v.x - startX;
        const toZ = v.z - startZ;
        const proj = toX * dirX + toZ * dirZ;
        if (proj > 0 && proj < bestDist) {
          const perpSq = (toX * toX + toZ * toZ) - proj * proj;
          if (perpSq < 1.55 * 1.55) {
            bestDist = proj;
            bestVeh = v;
            bestNPC = null;
          }
        }
      }
    }

    // Ray vs Police Helicopter
    if (!bestNPC && !bestVeh && game.police && game.police.heli) {
      const h = game.police.heli;
      const toX = h.x - startX;
      const toZ = h.z - startZ;
      const proj = toX * dirX + toZ * dirZ;
      if (proj > 0 && proj <= range) {
        const perpSq = (toX * toX + toZ * toZ) - proj * proj;
        if (perpSq < 3.8 * 3.8) {
          bestDist = proj;
          endY = h.y;
          hitHeli = true;
        }
      }
    }

    const endX = startX + dirX * bestDist;
    const endZ = startZ + dirZ * bestDist;
    this.spawnTracer(startX, startY, startZ, endX, endY, endZ, color);

    if (hitHeli && game.police) {
      game.police.damageHeli(damage);
    } else if (bestNPC) {
      game.damageNPC(bestNPC, damage, dirX * knockForce, dirZ * knockForce, 'gun');
    } else if (bestVeh) {
      bestVeh.applyDamage(damage * 0.55, game);
      for (let s = 0; s < 4; s++) {
        game.world.spawnParticle({ x: endX, y: 1.1, z: endZ, vx: VS.rand(-5, 5), vy: VS.rand(2, 6), vz: VS.rand(-5, 5), color: 0xffe066, life: 0.28 });
      }
    } else {
      // Wall spark
      game.world.spawnParticle({ x: endX, y: 1.2, z: endZ, vx: -dirX * 3, vy: 3, vz: -dirZ * 3, color: 0xffffff, life: 0.22 });
    }
  }

  performVehicleAttack(game, aimYaw) {
    if (!this.vehicle || this.isDead) return;
    if (this.vehicle.spec.isTank) {
      const lock = this.findAutoAimTarget(game, aimYaw, 68);
      const tyaw = lock ? Math.atan2(lock.x - this.vehicle.x, lock.z - this.vehicle.z) : aimYaw;
      this.vehicle.fireTankCannon(game, tyaw, lock);
      return;
    }
    if (this.attackCooldown > 0) return;
    const preferred = ['smg', 'pistol', 'shotgun'].includes(this.weaponId) && this.ownedWeapons[this.weaponId] && this.ammo[this.weaponId] > 0 ? this.weaponId : null;
    const wId = preferred || ((this.ownedWeapons.smg && this.ammo.smg > 0) ? 'smg' : ((this.ownedWeapons.pistol && this.ammo.pistol > 0) ? 'pistol' : null));
    if (!wId) return;
    this.ammo[wId]--;
    this.attackCooldown = wId === 'smg' ? 0.14 : (wId === 'shotgun' ? 0.68 : 0.30);
    const lock = this.findAutoAimTarget(game, aimYaw, wId === 'shotgun' ? 24 : 38);
    const dyaw = lock ? Math.atan2(lock.x - this.vehicle.x, lock.z - this.vehicle.z) : aimYaw;
    if (wId === 'shotgun') {
      for (let p = 0; p < 6; p++) {
        this._fireBulletRay(game, this.vehicle.x, (this.vehicle.y || 0) + 1.35, this.vehicle.z, dyaw, 0.14, 24, 20, 0xffb703, 10, this.vehicle);
      }
    } else {
      this._fireBulletRay(game, this.vehicle.x, (this.vehicle.y || 0) + 1.35, this.vehicle.z, dyaw, 0.04, 38, 22, 0xffe066, 7, this.vehicle);
    }
    if (game.world && game.world.spawnParticle) game.world.spawnParticle({ x: this.vehicle.x - Math.cos(this.vehicle.yaw) * 0.9, y: (this.vehicle.y || 0) + 1.35, z: this.vehicle.z + Math.sin(this.vehicle.yaw) * 0.9, vx: VS.rand(-1, 1), vy: 1.5, vz: VS.rand(-1, 1), color: 0xffe066, life: 0.12 });
    game.audio.playGunshot(wId === 'smg');
    if (game.livingCity) game.livingCity.alertGunshot(this.vehicle.x, this.vehicle.z);
  }

  performAttack(game, aimYaw) {
    if (this.vehicle || this.isDead || this.attackCooldown > 0) return;
    const w = VS.CONFIG.WEAPONS[this.weaponId];
    let lock = null;
    if (w.type !== 'melee') {
      lock = this.findAutoAimTarget(game, aimYaw, w.range);
      if (lock) aimYaw = Math.atan2(lock.x - this.x, lock.z - this.z);
    }
    this.attackCooldown = w.cooldown;

    if (w.type === 'melee') {
      if (this.weaponId === 'bat') w.range = 3.1;
      const meleeLock = this.findAutoAimTarget(game, aimYaw, w.range + 1.4);
      if (meleeLock) this.yaw = Math.atan2(meleeLock.x - this.x, meleeLock.z - this.z);
      this.comboIndex = (this.comboIndex + 1) % 3;
      this.comboTimer = 0.75;
      this.attackAnim = 0.28;
      // Face aim direction slightly if moving
      const fx = Math.sin(this.yaw);
      const fz = Math.cos(this.yaw);
      const hitX = this.x + fx * 1.4;
      const hitZ = this.z + fz * 1.4;
      let hitTarget = false;

      // Hit NPCs (pedestrians, enforcers, on-foot cops)
      const targets = game.getCombatTargets();
      for (const npc of targets) {
        if (npc.dead) continue;
        const d = VS.dist2D(hitX, hitZ, npc.x, npc.z);
        if (d < w.range) {
          const dmg = this.comboIndex === 2 ? w.damage * 1.5 : w.damage;
          if (this.weaponId === 'bat' && (npc.x - this.x) * fx + (npc.z - this.z) * fz < 0) continue;
          game.damageNPC(npc, dmg, fx * (this.weaponId === 'bat' ? 15 : (this.comboIndex === 2 ? 12 : 6)), fz * (this.weaponId === 'bat' ? 15 : (this.comboIndex === 2 ? 12 : 6)), 'melee');
          hitTarget = true;
        }
      }

      // Knock props with melee
      if (game.world.knockPropsNear(hitX, hitZ, 1.5, fx * 9, fz * 9, game.audio)) {
        hitTarget = true;
      }

      // Hit nearby cars slightly for chaos!
      if (game.vehicles) {
        for (const v of game.vehicles) {
          if (VS.dist2D(this.x, this.z, v.x, v.z) < (this.weaponId === 'bat' ? 3.1 : 2.6)) {
            v.applyDamage(this.weaponId === 'bat' ? 24 : 8, game);
            hitTarget = true;
            game.world.spawnParticle({ x: hitX, y: 1.0, z: hitZ, vx: VS.rand(-4, 4), vy: 4, vz: VS.rand(-4, 4), color: 0xffe066, life: 0.35 });
          }
        }
      }

      game.audio.playPunch(hitTarget);
      if (hitTarget) {
        game.addCameraShake(this.comboIndex === 2 ? 0.35 : 0.16);
      }
    } else {
      if ((this.ammo[this.weaponId] || 0) <= 0) {
        game.hud.addFeed(VS.t('子弹耗尽！已切换为赤手空拳。', 'Out of ammo! Switching to Fists.'), 'crime');
        this.selectWeapon('fists');
        return;
      }
      this.ammo[this.weaponId]--;
      this.yaw = aimYaw;

      if (w.type === 'rocket') {
        this.attackAnim = 0.25;
        this.muzzleFlash.visible = true;
        setTimeout(() => { if (this.muzzleFlash) this.muzzleFlash.visible = false; }, 70);
        const rStartY = (this.y || 0) + (this.isCrouching ? 1.05 : 1.45);
        const dy = (lock && lock.y !== undefined) ? (lock.y - rStartY) / Math.max(8, VS.dist2D(this.x, this.z, lock.x, lock.z)) : 0.01;
        this.spawnRocket(
          game,
          this.x + Math.sin(this.yaw) * 0.9, rStartY, this.z + Math.cos(this.yaw) * 0.9,
          Math.sin(this.yaw), dy, Math.cos(this.yaw),
          46, w.blastRadius, w.damage
        );
        game.audio.playGunshot(false);
        game.addCameraShake(0.32);
        if (game.livingCity) game.livingCity.alertGunshot(this.x, this.z);
        return;
      }

      this.attackAnim = w.type === 'shotgun' ? 0.24 : 0.16;
      this.muzzleFlash.visible = true;
      setTimeout(() => { if (this.muzzleFlash) this.muzzleFlash.visible = false; }, 55);

      const startX = this.x + Math.sin(this.yaw) * 0.7;
      const startY = (this.y || 0) + (this.isCrouching ? 1.0 : 1.35);
      const startZ = this.z + Math.cos(this.yaw) * 0.7;
      const spread = w.spread * (this.inCover ? 0.55 : (this.isCrouching ? 0.75 : 1.0));
      if (w.type === 'shotgun') {
        const pellets = w.pellets || 6;
        for (let p = 0; p < pellets; p++) {
          this._fireBulletRay(game, startX, startY, startZ, this.yaw, spread, w.range, w.damage, w.color, 11);
        }
      } else {
        this._fireBulletRay(game, startX, startY, startZ, this.yaw, spread, w.range, w.damage, w.color, 8);
      }

      game.audio.playGunshot(this.weaponId === 'smg');
      game.addCameraShake(w.type === 'shotgun' ? 0.32 : (this.weaponId === 'smg' ? 0.12 : 0.2));
      // Gunfire in public scares nearby peds & adds slight heat
      if (game.livingCity) game.livingCity.alertGunshot(this.x, this.z);
    }
  }

  update(dt, input, cameraYaw, world, game) {
    // Update bullet tracers & rockets even while in car
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      if (tr.life <= 0) {
        this.scene.remove(tr.line);
        tr.line.geometry.dispose();
        tr.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.life -= dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.z += r.vz * dt;
      r.mesh.position.set(r.x, r.y, r.z);

      if (world && world.spawnParticle) {
        world.spawnParticle({
          x: r.x + VS.rand(-0.12, 0.12),
          y: r.y + VS.rand(-0.12, 0.12),
          z: r.z + VS.rand(-0.12, 0.12),
          vx: VS.rand(-0.8, 0.8),
          vy: VS.rand(0.5, 1.6),
          vz: VS.rand(-0.8, 0.8),
          color: Math.random() < 0.35 ? 0xff7b00 : 0x94a3b8,
          size: 0.55,
          life: 0.38,
          gravity: -0.6,
          isSmoke: true
        });
      }

      const rGround = (world && world.getDeckHeight) ? world.getDeckHeight(r.x, r.z, r.y) : 0;
      let hit = r.y <= rGround + 0.35 || r.life <= 0;
      if (!hit && world && world.colliders) {
        for (let j = 0; j < world.colliders.length; j++) {
          const b = world.colliders[j];
          if (b.height > r.y && r.x > b.minX && r.x < b.maxX && r.z > b.minZ && r.z < b.maxZ) {
            hit = true;
            break;
          }
        }
      }
      if (!hit && game && game.vehicles) {
        for (let j = 0; j < game.vehicles.length; j++) {
          const v = game.vehicles[j];
          if (v !== r.ignoreVehicle && !v.destroyed && VS.dist2D(r.x, r.z, v.x, v.z) < 2.2 && r.y < (v.y || 0) + 2.6) {
            hit = true;
            break;
          }
        }
      }
      if (!hit && game && game.getCombatTargets) {
        const targets = game.getCombatTargets();
        for (let j = 0; j < targets.length; j++) {
          const npc = targets[j];
          const npcY = (npc.root && npc.root.position) ? npc.root.position.y : 0;
          if (!npc.dead && VS.dist2D(r.x, r.z, npc.x, npc.z) < 1.4 && r.y < npcY + 2.3) {
            hit = true;
            break;
          }
        }
      }
      if (!hit && game && game.police && game.police.heli) {
        const heli = game.police.heli;
        if (VS.dist2D(r.x, r.z, heli.x, heli.z) < 4.5 && Math.abs(r.y - heli.y) < 3.5) {
          hit = true;
        }
      }

      if (hit) {
        this.detonateExplosion(game, r.x, r.y, r.z, r.radius, r.maxDmg, r.ignoreVehicle);
        this.scene.remove(r.mesh);
        this.rockets.splice(i, 1);
      }
    }

    if (this.enterCooldown > 0) this.enterCooldown -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.comboTimer > 0) this.comboTimer -= dt;
    if (this.attackAnim > 0) this.attackAnim -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;

    if (this.vehicle) {
      this.isCrouching = false; this.inCover = false;
      this.root.visible = false;
      this.x = this.vehicle.x;
      this.y = this.vehicle.y || 0;
      if (world.checkPackagePickup && game.onPackageCollected) { const pkg = world.checkPackagePickup(this.x, this.y, this.z); if (pkg) game.onPackageCollected(pkg); }
      this.z = this.vehicle.z;
      this.yaw = this.vehicle.yaw;
      this.lockedTarget = (!this.isDead && game && game.getAimYaw)
        ? this.findAutoAimTarget(game, game.getAimYaw(), 55)
        : null;
      return;
    }

    this.root.visible = true;
    if (this.isDead) {
      this.lockedTarget = null;
      this.root.rotation.x = Math.PI / 2;
      this.root.position.set(this.x, 0.3, this.z);
      return;
    }
    this.root.rotation.x = 0;
    this.lockedTarget = (this.weaponId !== 'fists' && game && game.getAimYaw)
      ? this.findAutoAimTarget(game, game.getAimYaw(), VS.CONFIG.WEAPONS[this.weaponId].range)
      : null;

    // Camera-relative movement (supports both WASD keyboard and mobile virtual joystick)
    let moveFwd = (input.up ? 1 : 0) - (input.down ? 1 : 0) + (input.joyY || 0);
    let moveRight = (input.right ? 1 : 0) - (input.left ? 1 : 0) + (input.joyX || 0);
    const mag = Math.hypot(moveFwd, moveRight);
    const moving = mag > 0.12;

    const speed = Math.min(this.isCrouching ? 4.2 : Infinity, (input.sprint ? 11.2 : 6.6) * Math.min(1, mag));
    const nearCoverObj = (world.colliders || []).some((b) => b.height >= 1.0 && Math.hypot(this.x - VS.clamp(this.x, b.minX, b.maxX), this.z - VS.clamp(this.z, b.minZ, b.maxZ)) < 1.45) || (game.vehicles || []).some((v) => !v.destroyed && Math.hypot(v.vx || 0, v.vz || 0) < 4 && VS.dist2D(this.x, this.z, v.x, v.z) < 2.8);
    this.inCover = this.isCrouching && nearCoverObj;
    const deckY = world.getDeckHeight ? world.getDeckHeight(this.x, this.z, this.y) : 0;
    this.y = VS.lerp(this.y, deckY, Math.min(1, dt * 16));
    if (world.checkPackagePickup && game.onPackageCollected) { const pkg = world.checkPackagePickup(this.x, this.y, this.z); if (pkg) game.onPackageCollected(pkg); }
    if (moving) {
      moveFwd /= mag;
      moveRight /= mag;
      // Camera forward is (-sin(cameraYaw), -cos(cameraYaw))
      const camFwdX = -Math.sin(cameraYaw);
      const camFwdZ = -Math.cos(cameraYaw);
      const camRightX = Math.cos(cameraYaw);
      const camRightZ = -Math.sin(cameraYaw);

      const dirX = camFwdX * moveFwd + camRightX * moveRight;
      const dirZ = camFwdZ * moveFwd + camRightZ * moveRight;

      this.vx = VS.lerp(this.vx, dirX * speed, Math.min(1, dt * 14));
      this.vz = VS.lerp(this.vz, dirZ * speed, Math.min(1, dt * 14));

      const targetYaw = Math.atan2(dirX, dirZ);
      this.yaw += VS.angleDiff(this.yaw, targetYaw) * Math.min(1, dt * 14);
    } else {
      this.vx *= Math.pow(0.001, dt);
      this.vz *= Math.pow(0.001, dt);
    }

    const nextX = this.x + this.vx * dt;
    const nextZ = this.z + this.vz * dt;
    const col = world.resolveCircleCollision(nextX, nextZ, this.radius);
    this.x = col.x;
    this.z = col.z;

    // Collide gently against parked/slow vehicles on foot
    if (game.vehicles) {
      for (const v of game.vehicles) {
        const dx = this.x - v.x;
        const dz = this.z - v.z;
        const d = Math.hypot(dx, dz);
        const minD = 2.0;
        if (d < minD && d > 0.01) {
          this.x = v.x + (dx / d) * minD;
          this.z = v.z + (dz / d) * minD;
        }
      }
    }

    // Collect world pickups (cash / health / armor)
    for (let i = world.pickups.length - 1; i >= 0; i--) {
      const pk = world.pickups[i];
      if (VS.dist2D(this.x, this.z, pk.x, pk.z) < 2.2 && Math.abs((this.y || 0) - (pk.mesh.position.y || 0)) < 2.2) {
        if (pk.type === 'cash') {
          this.addCash(pk.amount);
          game.hud.addFeed(VS.t(`拾取现金 +$${pk.amount}`, `Picked up $${pk.amount}`), 'money');
          game.audio.playCash();
        } else if (pk.type === 'health') {
          this.hp = Math.min(this.maxHp, this.hp + pk.amount);
          game.hud.addFeed(VS.t(`恢复生命 +${pk.amount} HP`, `Restored +${pk.amount} HP`), 'money');
          game.audio.playCash();
        } else if (pk.type === 'armor') {
          this.armor = Math.min(this.maxArmor, this.armor + pk.amount);
          game.hud.addFeed(VS.t(`拾取防弹衣 +${pk.amount} ARM`, `Picked up Body Armor +${pk.amount}`), 'money');
          game.audio.playCash();
        }
        this.scene.remove(pk.mesh);
        world.pickups.splice(i, 1);
      }
    }

    // Limb animation
    const curSpd = Math.hypot(this.vx, this.vz);
    if (curSpd > 0.4) {
      this.walkCycle += dt * (input.sprint ? 14 : 9.5);
      const swing = Math.sin(this.walkCycle) * (input.sprint ? 0.9 : 0.58);
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.75;
      this.rightArm.rotation.x = swing * 0.75;
      this.torso.position.y = this.isCrouching ? 0.78 : 1.08 + Math.abs(Math.sin(this.walkCycle)) * 0.06;
    } else {
      this.leftLeg.rotation.x *= 0.8;
      this.rightLeg.rotation.x *= 0.8;
      this.leftArm.rotation.x *= 0.8;
      this.rightArm.rotation.x *= 0.8;
      this.torso.position.y = this.isCrouching ? 0.78 : 1.08;
      this.leftLeg.rotation.x = this.isCrouching ? -0.55 : this.leftLeg.rotation.x;
      this.rightLeg.rotation.x = this.isCrouching ? 0.45 : this.rightLeg.rotation.x;
    }

    // Gun aiming pose / melee punch swing override
    if (this.weaponId !== 'fists') {
      this.rightArm.rotation.x = this.weaponId === 'bat' ? -1.15 + (this.attackAnim > 0 ? Math.sin((this.attackAnim / 0.28) * Math.PI) * 2.1 : 0) : -1.35 + (this.attackAnim > 0 ? 0.35 : 0);
    } else if (this.attackAnim > 0) {
      const punch = Math.sin((this.attackAnim / 0.28) * Math.PI);
      if (this.comboIndex === 0) {
        this.rightArm.rotation.x = -1.65 * punch;
        this.torso.rotation.y = -0.35 * punch;
      } else if (this.comboIndex === 1) {
        this.leftArm.rotation.x = -1.65 * punch;
        this.torso.rotation.y = 0.35 * punch;
      } else {
        this.rightLeg.rotation.x = -1.3 * punch;
        this.torso.rotation.y = 0.5 * punch;
      }
    } else {
      this.torso.rotation.y = 0;
    }

    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.yaw;
  }
};
