// VICE SUN '86 - Weighted Vehicle Physics, 5-Speed Gearbox, Drifts/Skids, Crashes & 3D 80s Cars
window.VS = window.VS || {};

VS.Vehicle = class Vehicle {
  constructor(scene, spec, x, z, yaw = 0, colorOverride = null) {
    this.scene = scene;
    this.spec = spec;
    this.color = colorOverride !== null ? colorOverride : VS.pick(spec.colors);

    this.x = x;
    this.y = 0;
    this.z = z;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.yaw = yaw;
    this.angularVel = 0;
    this.airTime = 0;
    this.cannonCd = 0;

    // Derived motion readouts
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.steerAngle = 0;
    this.skidIntensity = 0;

    // Gearbox & RPM
    this.gear = 1; // 1..5, -1 = R
    this.gearLabel = '1';
    this.rpmNorm = 0.14; // 0..1
    this.shiftCut = 0;

    // Suspension pitch & roll (visual weight transfer!)
    this.pitch = 0;
    this.pitchVel = 0;
    this.roll = 0;
    this.rollVel = 0;
    this.prevForwardSpeed = 0;

    // Health, fire & destruction
    this.maxHp = spec.maxHp;
    this.hp = spec.maxHp;
    this.burningTimer = 0;
    this.destroyed = false;
    this.smokeTick = 0;
    this.skidTick = 0;

    // Ownership & AI flags
    this.driver = null;
    this.aiDriver = false;
    this.isPoliceAI = false;
    this.isMissionTarget = false;
    this.sirenOn = false;
    this.sirenPhase = Math.random() * 6;
    this.braking = false;

    // Traffic AI lane tracking
    this.laneAxis = 'z';
    this.laneDir = 1;
    this.laneCoord = x;
    this.aiTargetSpeed = VS.rand(12, 18);
    this.aiStuckTimer = 0;

    this._buildMesh();
  }

  _buildMesh() {
    const s = this.spec;
    this.root = new THREE.Group();
    this.chassis = new THREE.Group();
    this.root.add(this.chassis);

    this.bodyMat = new THREE.MeshPhongMaterial({ color: this.color, shininess: 85, specular: 0x666666 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x181c24 });
    const glassMat = new THREE.MeshPhongMaterial({ color: 0x12263a, shininess: 120, specular: 0x90e0ef });
    const chromeMat = new THREE.MeshPhongMaterial({ color: 0xdce4ec, shininess: 110 });
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6cc });
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0xaa1122 });

    const baseH = s.style === 'tank' ? 0.92 : (s.style === 'van' ? 0.95 : (s.style === 'supercar' ? 0.56 : 0.68));
    const baseY = 0.36 + baseH / 2;
    const lower = new THREE.Mesh(new THREE.BoxGeometry(s.width, baseH, s.length), this.bodyMat);
    lower.position.y = baseY;
    lower.castShadow = true;
    lower.receiveShadow = true;
    this.chassis.add(lower);

    if (s.style === 'tank') {
      const armorDark = new THREE.MeshLambertMaterial({ color: 0x2d3a24 });
      const treadMat = new THREE.MeshLambertMaterial({ color: 0x16191e });
      // Armored left & right heavy caterpillar treads
      [-s.width * 0.46, s.width * 0.46].forEach((tx) => {
        const tread = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.92, s.length * 1.04), treadMat);
        tread.position.set(tx, 0.48, 0);
        tread.castShadow = true;
        this.chassis.add(tread);
      });
      // Angled front glacis plate
      const glacis = new THREE.Mesh(new THREE.BoxGeometry(s.width * 0.72, 0.45, 1.3), armorDark);
      glacis.position.set(0, baseY + 0.2, s.length * 0.38);
      glacis.rotation.x = 0.35;
      this.chassis.add(glacis);
      // Rotating turret + long 120mm cannon barrel + commander hatch
      this.turret = new THREE.Group();
      this.turret.position.set(0, baseY + baseH / 2 + 0.05, -0.2);
      const tBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 2.55), armorDark);
      tBody.position.y = 0.36;
      tBody.castShadow = true;
      this.turret.add(tBody);
      const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.16, 10), this.bodyMat);
      hatch.position.set(-0.35, 0.78, -0.35);
      this.turret.add(hatch);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 4.1, 8), darkMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.42, 2.85);
      barrel.castShadow = true;
      this.turret.add(barrel);
      const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.15, 0.38, 8), darkMat);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(0, 0.42, 4.95);
      this.turret.add(muzzle);
      // Military star emblem on turret side
      const starBadge = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.26, 0.26), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
      starBadge.position.set(0, 0.38, -0.2);
      this.turret.add(starBadge);
      this.chassis.add(this.turret);
    } else if (s.style === 'supercar') {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(s.width * 0.78, 0.46, s.length * 0.44), glassMat);
      cab.position.set(0, baseY + baseH / 2 + 0.19, -0.2);
      cab.castShadow = true;
      this.chassis.add(cab);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(s.width * 0.72, 0.1, s.length * 0.34), this.bodyMat);
      roof.position.set(0, baseY + baseH / 2 + 0.43, -0.22);
      this.chassis.add(roof);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(s.width * 0.96, 0.08, 0.34), this.bodyMat);
      wing.position.set(0, baseY + baseH / 2 + 0.28, -s.length / 2 + 0.25);
      this.chassis.add(wing);
      [-0.75, 0.75].forEach((sx) => {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.2), darkMat);
        strut.position.set(sx, baseY + baseH / 2 + 0.13, -s.length / 2 + 0.25);
        this.chassis.add(strut);
      });
    } else if (s.style === 'van') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(s.width * 0.96, 1.05, s.length * 0.78), this.bodyMat);
      box.position.set(0, baseY + baseH / 2 + 0.48, -0.35);
      box.castShadow = true;
      this.chassis.add(box);
      const ws = new THREE.Mesh(new THREE.BoxGeometry(s.width * 0.88, 0.56, 0.14), glassMat);
      ws.position.set(0, baseY + baseH / 2 + 0.42, s.length * 0.32);
      this.chassis.add(ws);
    } else {
      const cabLen = s.style === 'muscle' ? s.length * 0.44 : s.length * 0.5;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(s.width * 0.84, 0.56, cabLen), glassMat);
      cab.position.set(0, baseY + baseH / 2 + 0.26, -0.18);
      cab.castShadow = true;
      this.chassis.add(cab);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(s.width * 0.8, 0.12, cabLen * 0.84), s.isPolice ? new THREE.MeshLambertMaterial({ color: 0xf8fafc }) : this.bodyMat);
      roof.position.set(0, baseY + baseH / 2 + 0.55, -0.18);
      this.chassis.add(roof);

      if (s.style === 'muscle') {
        const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 1.15), darkMat);
        scoop.position.set(0, baseY + baseH / 2 + 0.06, 0.95);
        this.chassis.add(scoop);
      }
      if (s.isPolice) {
        const doors = new THREE.Mesh(new THREE.BoxGeometry(s.width + 0.04, baseH * 0.85, s.length * 0.46), new THREE.MeshLambertMaterial({ color: 0xf8fafc }));
        doors.position.set(0, baseY, -0.05);
        this.chassis.add(doors);
        const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.28), darkMat);
        barBase.position.set(0, baseY + baseH / 2 + 0.66, -0.15);
        this.chassis.add(barBase);
        this.redLightMat = new THREE.MeshBasicMaterial({ color: 0xff1e42 });
        this.blueLightMat = new THREE.MeshBasicMaterial({ color: 0x00b4ff });
        const rl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.26), this.redLightMat);
        rl.position.set(-0.34, baseY + baseH / 2 + 0.74, -0.15);
        this.chassis.add(rl);
        const bl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.26), this.blueLightMat);
        bl.position.set(0.34, baseY + baseH / 2 + 0.74, -0.15);
        this.chassis.add(bl);
        const pushbar = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.42, 0.18), darkMat);
        pushbar.position.set(0, baseY - 0.05, s.length / 2 + 0.12);
        this.chassis.add(pushbar);
      }
    }

    if (s.style !== 'tank') {
      const fBumper = new THREE.Mesh(new THREE.BoxGeometry(s.width * 0.98, 0.18, 0.16), chromeMat);
      fBumper.position.set(0, 0.42, s.length / 2 + 0.04);
      this.chassis.add(fBumper);
      const rBumper = new THREE.Mesh(new THREE.BoxGeometry(s.width * 0.98, 0.18, 0.16), chromeMat);
      rBumper.position.set(0, 0.42, -s.length / 2 - 0.04);
      this.chassis.add(rBumper);

      // Front grille, rear license plate, side mirrors & dual exhausts for sharper vehicle detail
      const grille = new THREE.Mesh(new THREE.BoxGeometry(s.width * 0.44, 0.2, 0.07), darkMat);
      grille.position.set(0, baseY + 0.02, s.length / 2 + 0.025);
      this.chassis.add(grille);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.05), new THREE.MeshBasicMaterial({ color: 0xfef3c7 }));
      plate.position.set(0, baseY - 0.08, -s.length / 2 - 0.03);
      this.chassis.add(plate);
      [-s.width * 0.54, s.width * 0.54].forEach((mx) => {
        const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.14), this.bodyMat);
        mirror.position.set(mx, baseY + baseH / 2 + 0.10, s.length * 0.14);
        this.chassis.add(mirror);
      });
      [-0.42, 0.42].forEach((ex) => {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 6), chromeMat);
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(ex, 0.33, -s.length / 2 - 0.06);
        this.chassis.add(pipe);
      });
    }

    [-s.width * 0.34, s.width * 0.34].forEach((lx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.08), headMat);
      hl.position.set(lx, baseY + 0.04, s.length / 2 + 0.03);
      this.chassis.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), this.tailMat);
      tl.position.set(lx, baseY + 0.05, -s.length / 2 - 0.03);
      this.chassis.add(tl);
    });

    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b2, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(s.width * 1.4, 9.5), this.beamMat);
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(0, 0.1, s.length / 2 + 4.8);
    this.root.add(beam);

    if (s.underglow) {
      this._addUnderglow(s.underglow);
    }

    this.wheelPivots = [];
    this.wheelMeshes = [];
    const wheelGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.28, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x16181e });
    const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8);
    hubGeo.rotateZ(Math.PI / 2);

    const wx = s.width * 0.48;
    const wzF = s.length * 0.31;
    const wzR = -s.length * 0.31;
    [[-wx, wzF, true], [wx, wzF, true], [-wx, wzR, false], [wx, wzR, false]].forEach(([px, pz, isFront]) => {
      const piv = new THREE.Group();
      piv.position.set(px, 0.37, pz);
      const wMesh = new THREE.Group();
      wMesh.add(new THREE.Mesh(wheelGeo, tireMat));
      wMesh.add(new THREE.Mesh(hubGeo, chromeMat));
      piv.add(wMesh);
      this.root.add(piv);
      this.wheelPivots.push({ piv, isFront });
      this.wheelMeshes.push(wMesh);
    });

    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.yaw;
    this.scene.add(this.root);
  }

  _addUnderglow(hex) {
    if (this.underglowMesh) return;
    const mat = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide });
    this.underglowMesh = new THREE.Mesh(new THREE.PlaneGeometry(this.spec.width * 1.15, this.spec.length * 1.05), mat);
    this.underglowMesh.rotation.x = -Math.PI / 2;
    this.underglowMesh.position.y = 0.08;
    this.root.add(this.underglowMesh);
  }

  repaint(newColorHex) {
    this.color = newColorHex;
    if (!this.spec.isPolice) {
      this.bodyMat.color.setHex(newColorHex);
    }
    this.hp = this.maxHp;
    this.destroyed = false;
    this.burningTimer = 0;
  }

  applyDamage(dmg, game, isExplosion = false) {
    if (this.destroyed) return;
    const armorMult = this.driver ? (0.65 / (1 + game.player.upgrades.armor * 0.45)) : 1.0;
    const capped = (isExplosion && !this.driver) ? (dmg * armorMult) : Math.min(dmg * armorMult, this.maxHp * 0.26);
    this.hp = Math.max(0, this.hp - capped);
    if (this.hp <= 0) {
      if (isExplosion && !this.driver) {
        this.explode(game);
      } else if (this.burningTimer <= 0) {
        this.burningTimer = 3.0;
        if (this.driver) {
          game.hud.addFeed(VS.t('引擎起火！快按 [F] 跳车！', 'ENGINE ON FIRE! Bail out [F]!'), 'crime');
        }
      }
    }
  }

  fireTankCannon(game, aimYaw, lockTarget = null) {
    if (this.cannonCd > 0 || this.destroyed) return false;
    this.cannonCd = 1.15;
    const wYaw = aimYaw !== undefined ? aimYaw : (this.yaw + (this.turret ? this.turret.rotation.y : 0));
    if (this.turret) {
      this.turret.rotation.y = VS.angleDiff(this.yaw, wYaw);
    }
    const mzX = this.x + Math.sin(wYaw) * 5.0;
    const mzY = this.y + 1.85;
    const mzZ = this.z + Math.cos(wYaw) * 5.0;
    for (let i = 0; i < 12; i++) game.world.spawnParticle({ x: mzX, y: mzY, z: mzZ, vx: VS.rand(-4, 4), vy: VS.rand(1, 7), vz: VS.rand(-4, 4), color: i % 2 ? 0xff6b00 : 0x9b8b78, life: VS.rand(0.22, 0.55), isSmoke: i % 3 === 0 });
    const dy = (lockTarget && lockTarget.y)
      ? (lockTarget.y - mzY) / Math.max(10, VS.dist2D(this.x, this.z, lockTarget.x, lockTarget.z))
      : -0.015;
    game.player.spawnRocket(game, mzX, mzY, mzZ, Math.sin(wYaw), dy, Math.cos(wYaw), 58, 9.5, 380, this);
    this.pitchVel -= 1.5;
    this.vx -= Math.sin(wYaw) * 1.8;
    this.vz -= Math.cos(wYaw) * 1.8;
    game.addCameraShake(0.5);
    game.audio.playExplosion();
    return true;
  }

  explode(game) {
    if (this.destroyed) return;
    this.destroyed = true;
    this.burningTimer = 0;
    this.bodyMat.color.setHex(0x1f1f24);
    this.vx *= 0.2;
    this.vz *= 0.2;
    game.world.spawnExplosion(this.x, (this.y || 0) + 0.8, this.z);
    game.audio.playExplosion();
    game.addCameraShake(1.0);
    if (game.missions && game.missions.onVehicleDestroyed) {
      game.missions.onVehicleDestroyed(this);
    }
    if (this.driver) {
      this.driver.takeDamage(999);
    }
    if (!this.driver && VS.dist2D(this.x, this.z, game.player.x, game.player.z) < 7.5) {
      game.player.takeDamage(55);
    }
    if (game.police && VS.dist2D(this.x, this.z, game.player.x, game.player.z) < 28) {
      game.police.reportCrime(VS.t('车辆爆炸', 'Vehicle Explosion'), 40);
    }
  }

  updatePhysics(dt, controls, game) {
    if (this.cannonCd > 0) this.cannonCd -= dt;
    const s = this.spec;
    const upg = this.driver ? game.player.upgrades : { engine: 0, turbo: 0, armor: 0 };
    const maxSpeed = s.maxSpeed * (1 + upg.engine * 0.11);
    const engineForce = s.engineForce * (1 + upg.engine * 0.16);
    const baseGrip = s.grip * (1 + upg.turbo * 0.12);
    const driftGrip = s.driftGrip * (1 + upg.turbo * 0.08);

    if (this.destroyed) {
      this.vx *= Math.pow(0.05, dt);
      this.vz *= Math.pow(0.05, dt);
      this.forwardSpeed = 0;
      this.rpmNorm = 0;
      this.skidIntensity = 0;
      return;
    }

    if (this.driver === game.player && s.isTank && this.turret && game.getAimYaw) {
      const targetLocalYaw = VS.angleDiff(this.yaw, game.getAimYaw());
      this.turret.rotation.y += VS.angleDiff(this.turret.rotation.y, targetLocalYaw) * Math.min(1, dt * 7.5);
    }

    if (this.burningTimer > 0) {
      this.burningTimer -= dt;
      if (this.burningTimer <= 0) {
        this.explode(game);
        return;
      }
    }

    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);

    let vFwd = this.vx * fx + this.vz * fz;
    let vLat = this.vx * rx + this.vz * rz;

    const throttle = controls.throttle || 0;
    const brake = controls.brake || 0;
    const steer = controls.steer || 0;
    const handbrake = !!controls.handbrake;

    if (this.shiftCut > 0) this.shiftCut -= dt;
    let accel = 0;
    this.braking = false;

    if (throttle > 0.05) {
      if (vFwd < -1.2) {
        accel = s.brakeForce * throttle;
        this.braking = true;
      } else {
        if (this.gear < 1) this.gear = 1;
        const gearTop = (maxSpeed / s.gearRatios[4]) * (s.gearRatios[4] / s.gearRatios[this.gear - 1]) * 1.05;
        const speedRatioInGear = Math.max(0, vFwd) / Math.max(6, gearTop);

        if (this.gear < 5 && speedRatioInGear > 0.93 && this.shiftCut <= 0) {
          this.gear++;
          this.shiftCut = 0.13;
          this.pitchVel -= 0.9;
          if (this.driver) game.audio.playGearShift(upg.turbo > 0);
        } else if (this.gear > 1 && speedRatioInGear < 0.36 && this.shiftCut <= 0) {
          this.gear--;
          this.shiftCut = 0.08;
        }

        const torqueCurve = 0.85 + 0.35 * Math.sin(VS.clamp(speedRatioInGear, 0, 1) * Math.PI);
        const gearMult = 0.72 + (s.gearRatios[this.gear - 1] / 3.0) * 0.65;
        const cutMult = this.shiftCut > 0 ? 0.25 : 1.0;
        accel = engineForce * throttle * torqueCurve * gearMult * cutMult * (1 - VS.clamp(vFwd / maxSpeed, 0, 0.98) * 0.62);
        this.rpmNorm = VS.clamp(0.18 + speedRatioInGear * 0.78 + (this.shiftCut > 0 ? -0.18 : 0.06), 0.14, 1.0);
        this.gearLabel = String(this.gear);
      }
    } else if (brake > 0.05) {
      if (vFwd > 1.2) {
        accel = -s.brakeForce * brake;
        this.braking = true;
        this.rpmNorm = VS.lerp(this.rpmNorm, 0.22, dt * 6);
      } else {
        this.gear = -1;
        this.gearLabel = 'R';
        accel = -engineForce * 0.55 * brake * (1 - VS.clamp(-vFwd / 16, 0, 0.95));
        this.rpmNorm = VS.clamp(0.2 + (Math.abs(vFwd) / 16) * 0.6, 0.18, 0.85);
      }
    } else {
      this.rpmNorm = VS.lerp(this.rpmNorm, 0.14 + VS.clamp(Math.abs(vFwd) / maxSpeed, 0, 1) * 0.35, dt * 5);
      if (vFwd > 0.5) {
        while (this.gear > 1) {
          const gTop = (maxSpeed / s.gearRatios[4]) * (s.gearRatios[4] / s.gearRatios[this.gear - 1]);
          if (vFwd < gTop * 0.42) this.gear--;
          else break;
        }
        this.gearLabel = String(this.gear);
      } else if (Math.abs(vFwd) <= 0.5) {
        this.gear = 1;
        this.gearLabel = '1';
      }
    }

    if (handbrake) {
      this.braking = true;
      vFwd *= Math.pow(0.22, dt);
      if (throttle < 0.05 && Math.abs(vFwd) < 0.8) {
        vFwd = 0;
        vLat = 0;
      }
    }

    vFwd += accel * dt;
    vFwd *= Math.pow(0.84, dt);
    if (Math.abs(vFwd) < 0.08 && throttle < 0.05 && brake < 0.05) vFwd = 0;

    const targetSteer = steer * 0.58;
    this.steerAngle = VS.lerp(this.steerAngle, targetSteer, Math.min(1, dt * 11));
    const speedSign = vFwd >= -0.1 ? 1 : -1;
    const speedFactor = VS.clamp(Math.abs(vFwd) / 6.5, 0, 1) * (1 - VS.clamp(Math.abs(vFwd) / (maxSpeed * 1.45), 0, 0.48));
    const driftBoost = handbrake ? 1.42 : 1.0;
    const targetAngVel = steer * s.turnRate * speedFactor * driftBoost * speedSign;
    this.angularVel = VS.lerp(this.angularVel, targetAngVel, Math.min(1, dt * (handbrake ? 6.5 : 9.5)));
    this.yaw += this.angularVel * dt;

    const nfx = Math.sin(this.yaw);
    const nfz = Math.cos(this.yaw);
    const nrx = Math.cos(this.yaw);
    const nrz = -Math.sin(this.yaw);

    // Reproject world velocity onto new yaw axes so turning creates genuine lateral slip!
    const oldVx = fx * vFwd + rx * vLat;
    const oldVz = fz * vFwd + rz * vLat;
    vFwd = oldVx * nfx + oldVz * nfz;
    vLat = oldVx * nrx + oldVz * nrz;

    const slipRatio = Math.abs(vLat) / Math.max(4, Math.abs(vFwd));
    const isDrifting = handbrake || slipRatio > 0.22;
    const activeGrip = isDrifting ? driftGrip : baseGrip;
    vLat *= Math.exp(-activeGrip * dt);

    if (this.x > 138 && this.x < 185 && (this.z < -33 || this.z > -15) && this.y < 0.25) {
      vFwd *= Math.pow(0.62, dt);
    }

    this.vx = nfx * vFwd + nrx * vLat;
    this.vz = nfz * vFwd + nrz * vLat;
    this.forwardSpeed = vFwd;
    this.lateralSpeed = vLat;

    const nextX = this.x + this.vx * dt;
    const nextZ = this.z + this.vz * dt;

    const colRad = Math.min(s.width, s.length) * 0.62;
    const col = game.world.resolveCircleCollision(nextX, nextZ, colRad);
    this.x = col.x;
    this.z = col.z;

    if (col.hit) {
      const vn = this.vx * col.nx + this.vz * col.nz;
      if (vn < 0) {
        const impactSpeed = -vn;
        this.vx -= (1 + 0.28) * vn * col.nx;
        this.vz -= (1 + 0.28) * vn * col.nz;
        this.vx *= 0.72;
        this.vz *= 0.72;

        if (impactSpeed > 9.5) {
          const severity = VS.clamp((impactSpeed - 7) / 28, 0.15, 1.0);
          this.pitchVel += severity * 2.1;
          this.applyDamage((impactSpeed - 5) * 0.55, game);
          if (this.driver) {
            game.audio.playCrash(severity);
            game.addCameraShake(severity * 0.65);
          }
          const sx = this.x - col.nx * colRad;
          const sz = this.z - col.nz * colRad;
          for (let i = 0; i < Math.ceil(severity * 10); i++) {
            game.world.spawnParticle({
              x: sx, y: 0.75, z: sz,
              vx: col.nx * VS.rand(3, 9) + VS.rand(-4, 4),
              vy: VS.rand(2, 7),
              vz: col.nz * VS.rand(3, 9) + VS.rand(-4, 4),
              color: i % 2 === 0 ? 0xffdf4d : 0xff7b00,
              life: VS.rand(0.25, 0.5)
            });
          }
        }
      }
    }

    if (Math.hypot(this.vx, this.vz) > 3.5) {
      if (game.world.knockPropsNear(this.x, this.z, colRad + 0.4, this.vx, this.vz, this.driver ? game.audio : null)) {
        if (this.driver) game.addCameraShake(0.14);
      }
    }

    const longAccel = (vFwd - this.prevForwardSpeed) / Math.max(0.008, dt);
    this.prevForwardSpeed = vFwd;
    const targetPitch = VS.clamp(-longAccel * 0.0042, -0.11, 0.11);
    const targetRoll = VS.clamp(-this.angularVel * Math.abs(vFwd) * 0.0028, -0.13, 0.13);

    this.pitchVel += ((targetPitch - this.pitch) * 58 - this.pitchVel * 8.5) * dt;
    this.pitch += this.pitchVel * dt;
    this.rollVel += ((targetRoll - this.roll) * 54 - this.rollVel * 8.0) * dt;
    this.roll += this.rollVel * dt;

    // 3D Stunt Ramp Jump & Gravity
    const deckY = (game.world && game.world.getDeckHeight) ? game.world.getDeckHeight(this.x, this.z, this.y) : 0;
    const rInfo = (game.world && game.world.getRampInfo) ? game.world.getRampInfo(this.x, this.z) : null;
    if (rInfo && rInfo.ramp && this.y <= (rInfo.ramp.baseY || 0) + rInfo.y + 0.55) {
      const rampSurfaceY = (rInfo.ramp.baseY || 0) + rInfo.y;
      this.y = rampSurfaceY;
      this._lastRampId = rInfo.ramp.id;
      const rSpd = this.vx * rInfo.ramp.dirX + this.vz * rInfo.ramp.dirZ;
      if (rSpd > 5) {
        this.vy = Math.max(this.vy, rSpd * rInfo.slope * 1.15);
        this.pitch = -rInfo.slope * 0.8;
      }
    } else if (this.y > deckY + 0.02 || this.vy > 0) {
      this.vy -= 22 * dt;
      this.y += this.vy * dt;
      this.airTime += dt;
      if (this.y <= deckY) {
        this.y = deckY;
        this.vy = 0;
        if (this.airTime > 0.60 && this.driver === game.player) {
          game.completedStunts = game.completedStunts || {};
          const rid = this._lastRampId !== undefined && this._lastRampId !== null ? 'r' + this._lastRampId : null;
          const isFirst = rid && !game.completedStunts[rid];
          if (isFirst) game.completedStunts[rid] = true;
          const bonus = Math.round(this.airTime * (isFirst ? 650 : 350));
          game.player.addCash(bonus); game.audio.playMissionComplete();
          game.hud.showSplash(isFirst ? VS.t('独特飞车特技！', 'UNIQUE STUNT!') : VS.t('飞车特技！', 'STUNT JUMP!'), '+$' + bonus, '#00f0ff', 1.9);
          game.hud.addFeed(isFirst ? `${Object.keys(game.completedStunts).length}/7 ${VS.t('独特特技奖励', 'Unique Stunt Bonus')} +$${bonus}` : VS.t('飞车特技成功！奖励 +$' + bonus, 'Unique Stunt Jump! +$' + bonus), 'money');
          if (isFirst && game.saveGame) game.saveGame();
        }
        this._lastRampId = null; this.airTime = 0;
      }
    } else {
      this.y = deckY;
      this.airTime = 0;
    }

    const lateralSlide = Math.abs(vLat);
    const burnout = this.driver && handbrake && throttle > 0.5 && Math.abs(vFwd) > 1.5;
    const skidRaw = burnout ? 0.85 : VS.clamp((lateralSlide - 2.6) / 8.5, 0, 1);
    this.skidIntensity = VS.lerp(this.skidIntensity, skidRaw, Math.min(1, dt * 10));

    this.skidTick -= dt;
    if (this.skidIntensity > 0.16 && this.skidTick <= 0 && Math.hypot(this.vx, this.vz) > 3.0) {
      this.skidTick = 0.035;
      const rearDist = -s.length * 0.31;
      const halfW = s.width * 0.44;
      const travelYaw = Math.atan2(this.vx, this.vz);
      [-halfW, halfW].forEach((side) => {
        const wx = this.x + nfx * rearDist + nrx * side;
        const wz = this.z + nfz * rearDist + nrz * side;
        game.world.addSkidMark(wx, wz, travelYaw, 0.32 + this.skidIntensity * 0.44);
        if (Math.random() < 0.72) {
          game.world.spawnParticle({
            x: wx, y: 0.2, z: wz,
            vx: -this.vx * 0.15 + VS.rand(-1, 1),
            vy: VS.rand(0.8, 2.0),
            vz: -this.vz * 0.15 + VS.rand(-1, 1),
            color: 0xe2e8f0,
            size: 0.75 + this.skidIntensity * 0.65,
            life: 0.58,
            gravity: -1.2,
            isSmoke: true
          });
        }
      });
    }

    this.smokeTick -= dt;
    const hpRatio = this.hp / this.maxHp;
    if (hpRatio < 0.55 && this.smokeTick <= 0) {
      this.smokeTick = hpRatio < 0.25 ? 0.06 : 0.15;
      const hoodX = this.x + nfx * (s.length * 0.36);
      const hoodZ = this.z + nfz * (s.length * 0.36);
      game.world.spawnParticle({
        x: hoodX + VS.rand(-0.3, 0.3), y: 1.05, z: hoodZ + VS.rand(-0.3, 0.3),
        vx: VS.rand(-0.8, 0.8), vy: VS.rand(1.8, 3.4), vz: VS.rand(-0.8, 0.8),
        color: hpRatio < 0.25 ? (Math.random() < 0.45 ? 0xff5a1f : 0x1e1e24) : 0x94a3b8,
        size: hpRatio < 0.25 ? 1.0 : 0.7,
        life: 0.7,
        gravity: -1.5,
        isSmoke: true
      });
    }

    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.yaw;
    this.chassis.rotation.x = this.pitch;
    this.chassis.rotation.z = this.roll;

    const wheelSpin = (vFwd / 0.37) * dt;
    for (let i = 0; i < this.wheelPivots.length; i++) {
      if (this.wheelPivots[i].isFront) {
        this.wheelPivots[i].piv.rotation.y = this.steerAngle;
      }
      this.wheelMeshes[i].rotation.x += wheelSpin;
    }

    this.tailMat.color.setHex(this.braking ? 0xff2244 : 0x881122);
    const night = game.world.getTimeInfo().isNight;
    this.beamMat.opacity = night ? 0.24 : 0.0;

    if (s.isPolice && this.redLightMat && this.blueLightMat) {
      if (this.sirenOn || this.isPoliceAI) {
        this.sirenPhase += dt * 11;
        const flip = Math.sin(this.sirenPhase) > 0;
        this.redLightMat.color.setHex(flip ? 0xff1144 : 0x440814);
        this.blueLightMat.color.setHex(!flip ? 0x00ccff : 0x062b44);
      } else {
        this.redLightMat.color.setHex(0x881422);
        this.blueLightMat.color.setHex(0x114488);
      }
    }
  }
};

VS.VehicleManager = class VehicleManager {
  constructor(game) {
    this.game = game;
    this.vehicles = game.vehicles;
    this._spawnStarterParkedCars();
  }

  _spawnStarterParkedCars() {
    const starters = [
      { id: 'cheetah', x: 113.5, z: 36, yaw: Math.PI, color: 0xff2a6d },
      { id: 'sabre',   x: 113.5, z: 10, yaw: Math.PI, color: 0x2ec4b6 },
      { id: 'oceanic', x: 126.5, z: 54, yaw: 0,       color: 0xffd23f },
      { id: 'van',     x: -68,   z: 27, yaw: Math.PI / 2, color: 0xf1faee },
      { id: 'police',  x: -116,  z: -104, yaw: Math.PI / 2, color: 0x1b2432 }
    ];
    for (const st of starters) {
      this.spawnVehicle(st.id, st.x, st.z, st.yaw, st.color);
    }
  }

  spawnVehicle(typeId, x, z, yaw = 0, colorOverride = null) {
    const spec = VS.CONFIG.VEHICLES[typeId] || VS.CONFIG.VEHICLES.oceanic;
    const v = new VS.Vehicle(this.game.scene, spec, x, z, yaw, colorOverride);
    this.vehicles.push(v);
    return v;
  }

  removeVehicle(v) {
    const idx = this.vehicles.indexOf(v);
    if (idx >= 0) this.vehicles.splice(idx, 1);
    this.game.scene.remove(v.root);
  }

  findNearestVehicle(x, z, maxDist = 4.6) {
    let best = null, bestD = maxDist;
    for (const v of this.vehicles) {
      if (v.destroyed) continue;
      const d = VS.dist2D(x, z, v.x, v.z);
      if (d < bestD) { bestD = d; best = v; }
    }
    return best;
  }

  tryEnterNearestVehicle(player) {
    if (player.enterCooldown > 0) return false;
    const v = this.findNearestVehicle(player.x, player.z, 4.8);
    if (!v) return false;

    const wasTraffic = v.aiDriver || v.isPoliceAI;
    v.aiDriver = false;
    v.isPoliceAI = false;
    v.driver = player;
    player.vehicle = v;
    player.enterCooldown = 0.4;

    if (player.upgrades.turbo >= 2) v._addUnderglow(0x00f0ff);

    this.game.audio.playCarEnter();

    if (wasTraffic) {
      if (this.game.livingCity) {
        const sideX = v.x + Math.cos(v.yaw) * 2.2;
        const sideZ = v.z - Math.sin(v.yaw) * 2.2;
        this.game.livingCity.spawnFleeingDriver(sideX, sideZ);
      }
      if (this.game.police) {
        this.game.police.reportCrime(v.spec.isPolice ? VS.t('盗窃警车', 'Stole VCPD Cruiser') : VS.t('当街抢车', 'Grand Theft Auto'), v.spec.isPolice ? 65 : 32);
      }
      this.game.hud.addFeed(VS.t(`已抢走 ${VS.vehName(v.spec)}！`, `Carjacked ${v.spec.name}!`), 'crime');
    } else {
      this.game.hud.addFeed(VS.t(`正在驾驶 ${VS.vehName(v.spec)}。按 [R] 切电台，[Space] 漂移。`, `Driving ${v.spec.name}. Press [R] for Radio, [Space] to Drift.`));
    }

    if (this.game.missions) this.game.missions.onVehicleEntered(v);
    return true;
  }

  exitVehicle(player, forced = false) {
    const v = player.vehicle;
    if (!v) return;
    v.driver = null;
    player.vehicle = null;
    player.enterCooldown = 0.4;
    const exitX = v.x - Math.cos(v.yaw) * 2.15;
    const exitZ = v.z + Math.sin(v.yaw) * 2.15;
    const safe = this.game.world.resolveCircleCollision(exitX, exitZ, player.radius);
    player.x = safe.x;
    player.z = safe.z;
    player.vx = v.vx * 0.35;
    player.vz = v.vz * 0.35;
    if (!forced) this.game.audio.playClick();
  }

  update(dt) {
    const g = this.game;
    const inp = g.input;

    // Long-session vehicle GC: clean up distant wrecks or excess abandoned cars to maintain steady FPS
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if (v === g.player.vehicle || v.isMissionTarget || v.aiDriver || v.isPoliceAI) continue;
      const d = VS.dist2D(v.x, v.z, g.player.x, g.player.z);
      if ((v.destroyed && d > 55) || (this.vehicles.length > 26 && d > 110)) {
        this.removeVehicle(v);
      }
    }

    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      if (v.driver === g.player) {
        v.updatePhysics(dt, {
          throttle: inp.up ? 1 : 0,
          brake: inp.down ? 1 : 0,
          steer: (inp.left ? 1 : 0) - (inp.right ? 1 : 0),
          handbrake: inp.handbrake
        }, g);
      } else if (v.isPoliceAI && g.police) {
        const ctrl = g.police.computeCopCarControls(v, dt);
        v.updatePhysics(dt, ctrl, g);
      } else if (v.aiDriver && g.livingCity) {
        const ctrl = g.livingCity.computeTrafficControls(v, dt);
        v.updatePhysics(dt, ctrl, g);
      } else {
        v.updatePhysics(dt, { throttle: 0, brake: 0, steer: 0, handbrake: true }, g);
      }
    }

    for (let i = 0; i < this.vehicles.length; i++) {
      const a = this.vehicles[i];
      const radA = Math.min(a.spec.width, a.spec.length) * 0.72;
      for (let j = i + 1; j < this.vehicles.length; j++) {
        const b = this.vehicles[j];
        const radB = Math.min(b.spec.width, b.spec.length) * 0.72;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        const minD = radA + radB;
        if (dist < minD && dist > 0.001) {
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = minD - dist;

          const massA = a.spec.mass * (a.driver ? 1 + g.player.upgrades.armor * 0.3 : 1);
          const massB = b.spec.mass * (b.driver ? 1 + g.player.upgrades.armor * 0.3 : 1);
          const invA = 1 / massA;
          const invB = 1 / massB;
          const invSum = invA + invB;

          a.x -= nx * overlap * (invA / invSum);
          a.z -= nz * overlap * (invA / invSum);
          b.x += nx * overlap * (invB / invSum);
          b.z += nz * overlap * (invB / invSum);

          const rvx = b.vx - a.vx;
          const rvz = b.vz - a.vz;
          const velAlongNormal = rvx * nx + rvz * nz;

          if (velAlongNormal < 0) {
            const restitution = 0.32;
            const impulse = -(1 + restitution) * velAlongNormal / invSum;
            a.vx -= impulse * invA * nx;
            a.vz -= impulse * invA * nz;
            b.vx += impulse * invB * nx;
            b.vz += impulse * invB * nz;

            const relImpact = -velAlongNormal;
            if (relImpact > 8.0) {
              const sev = VS.clamp((relImpact - 5) / 26, 0.18, 1.0);
              a.pitchVel += sev * 1.6;
              b.pitchVel += sev * 1.6;
              a.applyDamage((relImpact - 4) * 0.48 * VS.clamp(massB / massA, 0.5, 1.6), g);
              b.applyDamage((relImpact - 4) * 0.48 * VS.clamp(massA / massB, 0.5, 1.6), g);

              const involvesPlayer = a.driver === g.player || b.driver === g.player;
              if (involvesPlayer) {
                g.audio.playCrash(sev);
                g.addCameraShake(sev * 0.55);
                const other = a.driver === g.player ? b : a;
                if (other.spec.isPolice && g.police) {
                  g.police.reportCrime(VS.t('冲撞警车', 'Ramming VCPD Cruiser'), 40);
                } else if (relImpact > 13 && g.police) {
                  g.police.reportCrime(VS.t('危险驾驶撞车', 'Reckless Collision'), 12);
                }
                if (g.missions) g.missions.onVehicleRam(other, relImpact);
              }

              const mx = (a.x + b.x) * 0.5;
              const mz = (a.z + b.z) * 0.5;
              for (let k = 0; k < Math.ceil(sev * 9); k++) {
                g.world.spawnParticle({
                  x: mx, y: 0.75, z: mz,
                  vx: VS.rand(-7, 7), vy: VS.rand(2, 7), vz: VS.rand(-7, 7),
                  color: k % 2 === 0 ? 0xffdf4d : 0xff4fa3,
                  life: 0.35
                });
              }
            }
          }
        }
      }
    }
  }
};
