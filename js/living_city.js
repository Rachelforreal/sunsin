// VICE SUN '86 - Living City AI: Lane-Following Traffic & Reactive 80s Pedestrians
window.VS = window.VS || {};

VS.LivingCity = class LivingCity {
  constructor(game) {
    this.game = game;
    this.peds = [];
    this.trafficVehicles = [];
    this.maxTraffic = 15;
    this.maxPeds = 32;
    this.speechLayer = document.getElementById('speech-layer');
    this._projVec = new THREE.Vector3();

    this._initTraffic();
    this._initPeds();
  }

  _initTraffic() {
    const types = ['oceanic', 'oceanic', 'sabre', 'cheetah', 'van'];
    for (let i = 0; i < this.maxTraffic; i++) {
      const sp = this._pickTrafficSpawn(false);
      if (!sp) continue;
      const v = this.game.vehicleManager.spawnVehicle(VS.pick(types), sp.x, sp.z, sp.yaw);
      v.aiDriver = true;
      v.laneAxis = sp.axis;
      v.laneDir = sp.dir;
      v.laneCoord = sp.laneCoord;
      this.trafficVehicles.push(v);
    }
  }

  _pickTrafficSpawn(aroundPlayer = true) {
    const cfg = VS.CONFIG;
    const px = this.game.player.x;
    const pz = this.game.player.z;

    for (let attempt = 0; attempt < 25; attempt++) {
      const axis = Math.random() < 0.55 ? 'z' : 'x';
      const dir = Math.random() < 0.5 ? 1 : -1;
      let x, z, yaw, laneCoord;
      if (axis === 'z') {
        const ax = VS.pick(cfg.AVENUE_X);
        laneCoord = ax + (dir === 1 ? -4.2 : 4.2);
        x = laneCoord;
        z = VS.rand(-300, 260);
        yaw = dir === 1 ? 0 : Math.PI;
      } else {
        const sz = VS.pick(cfg.STREET_Z);
        laneCoord = sz + (dir === 1 ? 4.2 : -4.2);
        z = laneCoord;
        x = VS.rand(-285, 122);
        yaw = dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      }

      const dPlayer = VS.dist2D(x, z, px, pz);
      if (aroundPlayer && (dPlayer < 48 || dPlayer > 175)) continue;
      if (!aroundPlayer && dPlayer < 16) continue;

      let clear = true;
      for (const v of this.game.vehicles) {
        if (VS.dist2D(x, z, v.x, v.z) < 15) { clear = false; break; }
      }
      if (clear) return { x, z, yaw, axis, dir, laneCoord };
    }
    return null;
  }

  computeTrafficControls(v, dt) {
    const cfg = VS.CONFIG;

    if (v.laneAxis === 'z') {
      for (const sz of cfg.STREET_Z) {
        if (Math.abs(v.z - sz) < 2.5 && Math.random() < 0.015) {
          const newDir = Math.random() < 0.5 ? 1 : -1;
          if ((newDir === 1 && v.x < 105) || (newDir === -1 && v.x > -170)) {
            v.laneAxis = 'x';
            v.laneDir = newDir;
            v.laneCoord = sz + (newDir === 1 ? 4.2 : -4.2);
          }
        }
      }
      if (v.z > 285 && v.laneDir === 1) { v.laneDir = -1; v.laneCoord += 8.4; }
      if (v.z < -310 && v.laneDir === -1) { v.laneDir = 1; v.laneCoord -= 8.4; }
    } else {
      for (const ax of cfg.AVENUE_X) {
        if (Math.abs(v.x - ax) < 2.5 && Math.random() < 0.015) {
          const newDir = Math.random() < 0.5 ? 1 : -1;
          v.laneAxis = 'z';
          v.laneDir = newDir;
          v.laneCoord = ax + (newDir === 1 ? -4.2 : 4.2);
        }
      }
      if (v.x > 118 && v.laneDir === 1) { v.laneAxis = 'z'; v.laneDir = -1; v.laneCoord = 124.2; }
      if (v.x < -280 && v.laneDir === -1) { v.laneAxis = 'z'; v.laneDir = 1; v.laneCoord = -284.2; }
    }

    let tx, tz;
    if (v.laneAxis === 'z') {
      tx = v.laneCoord;
      tz = v.z + v.laneDir * 16;
    } else {
      tx = v.x + v.laneDir * 16;
      tz = v.laneCoord;
    }

    const desiredYaw = Math.atan2(tx - v.x, tz - v.z);
    const yawErr = VS.angleDiff(v.yaw, desiredYaw);
    const steer = VS.clamp(yawErr * 1.9, -1, 1);

    let blocked = false;
    const fx = Math.sin(v.yaw);
    const fz = Math.cos(v.yaw);
    for (const other of this.game.vehicles) {
      if (other === v) continue;
      const dx = other.x - v.x;
      const dz = other.z - v.z;
      const d = Math.hypot(dx, dz);
      if (d < 13) {
        const dot = (dx * fx + dz * fz) / (d || 1);
        if (dot > 0.72) { blocked = true; break; }
      }
    }
    if (!blocked && !this.game.player.vehicle) {
      const dx = this.game.player.x - v.x;
      const dz = this.game.player.z - v.z;
      const d = Math.hypot(dx, dz);
      if (d < 9.5 && (dx * fx + dz * fz) / (d || 1) > 0.78) blocked = true;
    }

    if (blocked) {
      return { throttle: 0, brake: 0.9, steer, handbrake: false };
    }

    const curSpeed = Math.hypot(v.vx, v.vz);
    const wantSpeed = Math.abs(yawErr) > 0.45 ? 9 : v.aiTargetSpeed;
    return {
      throttle: curSpeed < wantSpeed ? 0.65 : 0.0,
      brake: curSpeed > wantSpeed + 3 ? 0.4 : 0.0,
      steer,
      handbrake: false
    };
  }

  _buildPedMesh(shirtColor, pantsColor, skinColor) {
    const root = new THREE.Group();
    const sMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const topMat = new THREE.MeshLambertMaterial({ color: shirtColor });
    const botMat = new THREE.MeshLambertMaterial({ color: pantsColor });
    const shoeMat = new THREE.MeshLambertMaterial({ color: VS.pick([0x1e293b, 0xf8fafc, 0x3b2f2f]) });
    const hairMat = new THREE.MeshLambertMaterial({ color: VS.pick([0x241911, 0x5c3c24, 0xd4a359, 0x16161d, 0x8b2e2e]) });

    // Refined torso with shoulders, belt & neck
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.58, 0.25), topMat);
    torso.position.y = 1.04;
    torso.castShadow = true;
    root.add(torso);

    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.26), new THREE.MeshLambertMaterial({ color: 0x1e1b24 }));
    belt.position.y = 0.75;
    root.add(belt);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.095, 0.12, 6), sMat);
    neck.position.y = 1.38;
    root.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.30, 0.28), sMat);
    head.position.y = 1.56;
    head.castShadow = true;
    root.add(head);

    // Varied 80s hair styles (short swept, voluminous afro/bob, or cap)
    const hairStyle = Math.floor(Math.random() * 3);
    if (hairStyle === 0) {
      const hair = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.12, 0.31), hairMat);
      hair.position.set(0, 1.71, -0.01);
      root.add(hair);
    } else if (hairStyle === 1) {
      const hair = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.34), hairMat);
      hair.position.set(0, 1.66, -0.04);
      root.add(hair);
    } else {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.10, 0.35), topMat);
      cap.position.set(0, 1.72, 0.03);
      root.add(cap);
    }
    if (Math.random() < 0.45) {
      const shades = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.05), new THREE.MeshBasicMaterial({ color: 0x111118 }));
      shades.position.set(0, 1.58, 0.14);
      root.add(shades);
    }

    // Pivot-mounted limbs with sleeves & shoes
    const makeLeg = (lx) => {
      const piv = new THREE.Group();
      piv.position.set(lx, 0.72, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.62, 0.18), botMat);
      leg.position.y = -0.31; leg.castShadow = true;
      piv.add(leg);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 0.25), shoeMat);
      shoe.position.set(0, -0.66, 0.03);
      piv.add(shoe);
      root.add(piv);
      return piv;
    };
    const leftLeg = makeLeg(-0.12);
    const rightLeg = makeLeg(0.12);

    const makeArm = (ax) => {
      const piv = new THREE.Group();
      piv.position.set(ax, 1.28, 0);
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.22, 0.16), topMat);
      sleeve.position.y = -0.10;
      piv.add(sleeve);
      const fore = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.12), sMat);
      fore.position.y = -0.35;
      piv.add(fore);
      root.add(piv);
      return piv;
    };
    const leftArm = makeArm(-0.30);
    const rightArm = makeArm(0.30);

    return { root, leftLeg, rightLeg, leftArm, rightArm };
  }

  _pickSidewalkPos(nearPlayer = false) {
    const cfg = VS.CONFIG;
    const px = this.game.player.x;
    const pz = this.game.player.z;

    for (let a = 0; a < 20; a++) {
      let x, z;
      if (Math.random() < 0.25) {
        x = VS.rand(132, 165);
        z = VS.rand(-260, 220);
      } else {
        const ax = VS.pick(cfg.AVENUE_X);
        const side = Math.random() < 0.5 ? -10.8 : 10.8;
        x = ax + side;
        z = VS.rand(-280, 230);
      }
      const d = VS.dist2D(x, z, px, pz);
      if (nearPlayer && (d < 16 || d > 110)) continue;
      if (!nearPlayer && d < 8) continue;
      const col = this.game.world.resolveCircleCollision(x, z, 0.8);
      if (!col.hit) return { x, z };
    }
    return { x: 108, z: 25 };
  }

  _initPeds() {
    // Guarantee several lively pedestrians right on Ocean Drive near player start
    this._spawnPedAt(108.5, 30);
    this._spawnPedAt(108.5, 16);
    this._spawnPedAt(133.5, 34);
    this._spawnPedAt(133.5, 12);
    for (let i = 0; i < this.maxPeds - 4; i++) {
      const pos = this._pickSidewalkPos(false);
      this._spawnPedAt(pos.x, pos.z);
    }
  }

  _spawnPedAt(x, z, flee = false) {
    const shirtColors = [0xff6b9d, 0x00d9ff, 0xffd166, 0x72efdd, 0xffffff, 0xff9f1c, 0xc77dff, 0x4ef2b8];
    const pantsColors = [0xf8fafc, 0x3a86ff, 0x2b2d42, 0xf4a261, 0xff8fab];
    const skins = [0xf1c29b, 0xd99b6c, 0x8d5524, 0xfad4b8];
    const m = this._buildPedMesh(VS.pick(shirtColors), VS.pick(pantsColors), VS.pick(skins));
    m.root.position.set(x, 0, z);
    this.game.scene.add(m.root);

    const traits = ['aggressive', 'brawler', 'mouthy', 'timid'];
    const trait = VS.pick(traits);
    const ped = {
      ...m,
      x, z,
      vx: 0, vz: 0,
      yaw: Math.random() * Math.PI * 2,
      hp: trait === 'brawler' ? 65 : 50,
      dead: false,
      deathTimer: 0,
      stunTimer: 0,
      trait,
      state: flee ? 'flee' : 'walk', // 'walk' | 'flee' | 'fight_player' | 'brawl' | 'scold'
      fleeTimer: flee ? 8.0 : 0,
      fleeFromX: this.game.player.x,
      fleeFromZ: this.game.player.z,
      brawlTarget: null,
      aggroTimer: 0,
      scoldTimer: 0,
      bumpCd: 0,
      attackCd: 0.4,
      punchAnim: 0,
      speechText: '',
      speechKind: '',
      speechTimer: 0,
      bubbleEl: null,
      walkDirYaw: Math.random() < 0.5 ? 0 : Math.PI,
      turnTimer: VS.rand(2.5, 6.5),
      walkPhase: Math.random() * 6,
      isCop: false,
      isEnemy: false
    };
    this.peds.push(ped);
    return ped;
  }

  _say(ped, kind, linesZh, linesEn, duration = 2.6) {
    if (!ped || ped.dead) return;
    ped.speechText = VS.lang === 'zh' ? VS.pick(linesZh) : VS.pick(linesEn);
    ped.speechKind = kind;
    ped.speechTimer = duration;
  }

  _removeBubble(ped) {
    if (ped.bubbleEl && ped.bubbleEl.parentNode) {
      ped.bubbleEl.parentNode.removeChild(ped.bubbleEl);
    }
    ped.bubbleEl = null;
  }

  _startPedBrawl(a, b) {
    if (!a || !b || a === b || a.dead || b.dead) return;
    a.state = 'brawl'; a.brawlTarget = b; a.aggroTimer = 14;
    b.state = 'brawl'; b.brawlTarget = a; b.aggroTimer = 14;
    this._say(a, 'brawl',
      ['靠！你撞我干嘛？！', '长没长眼啊你！干他！', '妈的别推老子！'],
      ['Hey! Watch where you shove!', 'You wanna go, pal?!', 'Back off, asshole!']
    );
    this._say(b, 'brawl',
      ['就撞你怎么了！来单挑！', '嘴这么臭？欠揍！', '老子忍你很久了！'],
      ['Bring it on, punk!', 'Talk trash again!', 'You asked for it!']
    );
  }

  onPedAttacked(ped, source) {
    if (!ped || ped.dead) return;
    // Nearby bystander reaction: some panic, some brawlers jump in or brawl with neighbors
    for (const other of this.peds) {
      if (other === ped || other.dead) continue;
      const d = VS.dist2D(ped.x, ped.z, other.x, other.z);
      if (d < 11 && other.state === 'walk') {
        if (other.trait === 'brawler' && Math.random() < 0.45) {
          other.state = 'fight_player';
          other.aggroTimer = 12;
          this._say(other, 'angry',
            ['住手！敢打我兄弟？！', '妈的找死啊你！', '街头混战来啊！'],
            ['Hey! Leave him alone!', 'You messed with the wrong block!', 'Let\'s brawl!']
          );
        } else if (d < 7 && other.trait === 'aggressive' && Math.random() < 0.35) {
          // Sparks bystander chaos brawl with another nearby ped
          const rival = this.peds.find((o) => o !== other && o !== ped && !o.dead && VS.dist2D(o.x, o.z, other.x, other.z) < 7);
          if (rival) this._startPedBrawl(other, rival);
        } else {
          other.state = 'flee';
          other.fleeTimer = VS.rand(5, 9);
          other.fleeFromX = ped.x;
          other.fleeFromZ = ped.z;
          if (Math.random() < 0.45) {
            this._say(other, 'scared',
              ['救命啊！打人啦！', '疯子！快跑！', '报警报警！'],
              ['Help! Crazy maniac!', 'Run for it!', 'Call VCPD!']
            );
          }
        }
      }
    }

    if (ped.hp <= 0) return;
    if (ped.trait === 'aggressive' || ped.trait === 'brawler') {
      ped.state = 'fight_player';
      ped.aggroTimer = 14;
      this._say(ped, 'angry',
        ['草！敢打老子，弄死你！', '去你妈的！吃我一拳！', '找死是吧？！来啊！', '别跑！老子削死你！'],
        ['F*** you! You\'re dead!', 'Oh, you wanna fight?!', 'I\'ll kick your ass!', 'Come here, punk!']
      );
    } else if (ped.trait === 'mouthy' && source !== 'gun') {
      ped.state = 'flee';
      ped.fleeTimer = 8;
      ped.fleeFromX = this.game.player.x;
      ped.fleeFromZ = this.game.player.z;
      this._say(ped, 'angry',
        ['有病吧你！神经病！', '操！你给我等着！', '没素质的混蛋！'],
        ['Are you insane?! Screw you!', 'Asshole! Watch your back!', 'Maniac!']
      );
    } else {
      ped.state = 'flee';
      ped.fleeTimer = 9;
      ped.fleeFromX = this.game.player.x;
      ped.fleeFromZ = this.game.player.z;
      this._say(ped, 'scared',
        ['别打我！救命啊！', '大哥我错了别打！', '妈呀快跑！'],
        ['Don\'t hurt me! Help!', 'Please stop!', 'Aaaah!!']
      );
    }
  }

  _handlePedBump(ped, sourceX, sourceZ, byCar = false) {
    if (ped.bumpCd > 0 || ped.dead) return;
    ped.bumpCd = 2.0;

    // Check if bumped ped collided close to another ped -> spark a hilarious street brawl!
    const neighbor = this.peds.find((o) => o !== ped && !o.dead && o.state === 'walk' && VS.dist2D(o.x, o.z, ped.x, ped.z) < 4.5);
    if (neighbor && (ped.trait === 'brawler' || neighbor.trait === 'brawler' || Math.random() < 0.38)) {
      this._startPedBrawl(ped, neighbor);
      return;
    }

    if (ped.trait === 'aggressive' || ped.trait === 'brawler') {
      ped.state = 'fight_player';
      ped.aggroTimer = 11;
      this._say(ped, 'angry',
        byCar
          ? ['我靠！不会开车滚下去！', '瞎了狗眼啊撞老子！', '下车单挑！妈的！']
          : ['你特么长没长眼啊？！', '撞老子找抽是不是！', '滚开！信不信削你！'],
        byCar
          ? ['Hey! Learn to drive, idiot!', 'Get out of the car, punk!', 'F***ing maniac!']
          : ['Watch it, asshole!', 'You just bumped the wrong guy!', 'Wanna fight, punk?!']
      );
    } else if (ped.trait === 'mouthy') {
      ped.state = 'scold';
      ped.scoldTimer = 2.6;
      ped.yaw = Math.atan2(sourceX - ped.x, sourceZ - ped.z);
      this._say(ped, 'angry',
        byCar
          ? ['赶着投胎啊你？！', '靠！差点撞死我！', '没长眼睛吗混蛋！']
          : ['挤什么挤！赶着投胎啊？', '踩我鞋了靠！', '走路看路行不行！'],
        byCar
          ? ['Hey, I\'m walkin\' here!', 'Watch the paint, jerk!', 'Crazy driver!']
          : ['Hey! Watch where you\'re going!', 'My fresh sneakers! Jerk!', 'Excuse you?!']
      );
    } else {
      ped.state = 'flee';
      ped.fleeTimer = 6.5;
      ped.fleeFromX = sourceX;
      ped.fleeFromZ = sourceZ;
      this._say(ped, 'scared',
        ['哇啊！别撞我！', '对不起对不起我马上滚！', '救命啊疯子！'],
        ['Whoa! Don\'t hit me!', 'Sorry! I\'m outta here!', 'Yikes!']
      );
    }
  }

  updateSpeechBubbles(camera) {
    if (!this.speechLayer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const p of this.peds) {
      if (p.dead || p.speechTimer <= 0 || !p.speechText) {
        this._removeBubble(p);
        continue;
      }
      this._projVec.set(p.x, 2.25, p.z).project(camera);
      const visible = this._projVec.z < 1 && this._projVec.z > -1;
      if (!visible || VS.dist2D(p.x, p.z, this.game.player.x, this.game.player.z) > 42) {
        if (p.bubbleEl) p.bubbleEl.style.display = 'none';
        continue;
      }
      if (!p.bubbleEl) {
        const el = document.createElement('div');
        el.className = 'ped-bubble';
        this.speechLayer.appendChild(el);
        p.bubbleEl = el;
      }
      p.bubbleEl.style.display = 'block';
      p.bubbleEl.textContent = p.speechText;
      p.bubbleEl.className = 'ped-bubble' + (p.speechKind ? ' ' + p.speechKind : '');
      const sx = (this._projVec.x * 0.5 + 0.5) * w;
      const sy = (-this._projVec.y * 0.5 + 0.5) * h;
      p.bubbleEl.style.left = sx + 'px';
      p.bubbleEl.style.top = sy + 'px';
    }
  }

  spawnFleeingDriver(x, z) {
    const safe = this.game.world.resolveCircleCollision(x, z, 0.5);
    const driver = this._spawnPedAt(safe.x, safe.z, true);
    if (Math.random() < 0.45) {
      driver.state = 'fight_player';
      driver.aggroTimer = 10;
      this._say(driver, 'angry',
        ['操！那是老子的车！给我下来！', '抢劫啊！把车还我！'],
        ['Hey! That\'s my ride! Get out!', 'Thief! I\'ll kill you!']
      );
    } else {
      this._say(driver, 'scared',
        ['车给你别杀我！', '救命啊抢车啦！'],
        ['Take the car, don\'t shoot!', 'Help! Carjacker!']
      );
    }
  }

  panicNear(x, z, radius = 20) {
    for (const p of this.peds) {
      if (p.dead) continue;
      if (VS.dist2D(x, z, p.x, p.z) < radius && p.state !== 'fight_player' && p.state !== 'brawl') {
        p.state = 'flee';
        p.fleeTimer = VS.rand(6, 11);
        p.fleeFromX = x;
        p.fleeFromZ = z;
      }
    }
  }

  alertGunshot(x, z) {
    this.panicNear(x, z, 36);
    if (this.game.police) this.game.police.reportCrime(VS.t('当街开枪', 'Weapons Discharge'), 10);
  }

  alertHorn(x, z) {
    this.panicNear(x, z, 12);
  }

  update(dt) {
    const g = this.game;
    const px = g.player.x;
    const pz = g.player.z;

    for (let i = this.trafficVehicles.length - 1; i >= 0; i--) {
      const v = this.trafficVehicles[i];
      if (v.driver === g.player || !v.aiDriver) {
        this.trafficVehicles.splice(i, 1);
        continue;
      }
      if (v.destroyed || VS.dist2D(v.x, v.z, px, pz) > 215) {
        g.vehicleManager.removeVehicle(v);
        this.trafficVehicles.splice(i, 1);
      }
    }
    if (this.trafficVehicles.length < this.maxTraffic && Math.random() < dt * 2.5) {
      const sp = this._pickTrafficSpawn(true);
      if (sp) {
        const types = ['oceanic', 'oceanic', 'sabre', 'cheetah', 'van'];
        const v = g.vehicleManager.spawnVehicle(VS.pick(types), sp.x, sp.z, sp.yaw);
        v.aiDriver = true;
        v.laneAxis = sp.axis;
        v.laneDir = sp.dir;
        v.laneCoord = sp.laneCoord;
        this.trafficVehicles.push(v);
      }
    }

    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      if (p.speechTimer > 0) p.speechTimer -= dt;
      if (p.bumpCd > 0) p.bumpCd -= dt;
      if (p.attackCd > 0) p.attackCd -= dt;
      if (p.punchAnim > 0) p.punchAnim -= dt;

      if (p.dead) {
        this._removeBubble(p);
        p.deathTimer -= dt;
        p.root.rotation.x = Math.PI / 2;
        p.root.position.set(p.x, 0.25, p.z);
        p.vx *= Math.pow(0.05, dt);
        p.vz *= Math.pow(0.05, dt);
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        if (p.deathTimer <= 0) {
          g.scene.remove(p.root);
          this.peds.splice(i, 1);
        }
        continue;
      }

      // On-foot player bumping directly into pedestrian triggers interactive reaction!
      if (!g.player.vehicle && !g.player.isDead) {
        const dp = VS.dist2D(p.x, p.z, px, pz);
        if (dp < 1.05 && Math.hypot(g.player.vx, g.player.vz) > 2.2) {
          const pushX = (p.x - px) / (dp || 1);
          const pushZ = (p.z - pz) / (dp || 1);
          p.vx += pushX * 3.5;
          p.vz += pushZ * 3.5;
          this._handlePedBump(p, px, pz, false);
        }
      }

      if (p.stunTimer > 0) {
        p.stunTimer -= dt;
        p.vx *= Math.pow(0.06, dt);
        p.vz *= Math.pow(0.06, dt);
      } else if (p.state === 'fight_player') {
        p.aggroTimer -= dt;
        const dp = VS.dist2D(p.x, p.z, px, pz);
        if (p.aggroTimer <= 0 || dp > 32 || g.player.isDead) {
          p.state = 'walk';
        } else {
          const ang = Math.atan2(px - p.x, pz - p.z);
          p.yaw = ang;
          const stopDist = g.player.vehicle ? 2.8 : 1.75;
          const spd = dp > stopDist ? 5.2 : 0;
          p.vx = Math.sin(ang) * spd;
          p.vz = Math.cos(ang) * spd;
          if (dp <= stopDist + 0.45 && p.attackCd <= 0) {
            p.attackCd = 0.95;
            p.punchAnim = 0.28;
            g.audio.playPunch(true);
            if (!g.player.vehicle) {
              g.player.takeDamage(6);
              g.addCameraShake(0.14);
            } else {
              g.player.vehicle.applyDamage(5, g);
            }
            if (Math.random() < 0.45) {
              this._say(p, 'angry', ['吃老子一拳！', '让你嚣张！', '给爷趴下！'], ['Take that!', 'Had enough?!', 'Eat knuckles!'], 1.8);
            }
          }
        }
      } else if (p.state === 'brawl') {
        p.aggroTimer -= dt;
        const t = p.brawlTarget;
        if (!t || t.dead || p.aggroTimer <= 0 || VS.dist2D(p.x, p.z, t.x, t.z) > 20) {
          p.state = 'walk';
          p.brawlTarget = null;
        } else {
          const db = VS.dist2D(p.x, p.z, t.x, t.z);
          const ang = Math.atan2(t.x - p.x, t.z - p.z);
          p.yaw = ang;
          const spd = db > 1.55 ? 4.4 : 0;
          p.vx = Math.sin(ang) * spd;
          p.vz = Math.cos(ang) * spd;
          if (db <= 1.9 && p.attackCd <= 0) {
            p.attackCd = VS.rand(0.75, 1.15);
            p.punchAnim = 0.28;
            t.hp -= 12;
            t.stunTimer = 0.22;
            t.vx += Math.sin(ang) * 4;
            t.vz += Math.cos(ang) * 4;
            if (VS.dist2D(p.x, p.z, px, pz) < 22) g.audio.playPunch(true);
            if (Math.random() < 0.4) {
              this._say(p, 'brawl', ['打死你个王八蛋！', '还敢还手？！', '吃我组合拳！'], ['Take that, punk!', 'Hit me back?!', 'Knockout time!'], 1.8);
            }
            if (t.hp <= 0) {
              t.dead = true;
              t.deathTimer = 6.0;
              g.world.spawnPickup(t.x, t.z, 'cash', Math.round(VS.rand(20, 50)));
              this._say(p, 'brawl', ['哼，菜鸡！', '服不服！'], ['Stay down!', 'Yeah, that\'s right!'], 2.4);
              p.state = 'walk';
              p.brawlTarget = null;
            }
          }
        }
      } else if (p.state === 'scold') {
        p.scoldTimer -= dt;
        p.vx *= 0.7; p.vz *= 0.7;
        p.yaw = Math.atan2(px - p.x, pz - p.z);
        if (p.scoldTimer <= 0) p.state = 'walk';
      } else if (p.state === 'flee' || p.fleeTimer > 0) {
        p.fleeTimer -= dt;
        if (p.fleeTimer <= 0) p.state = 'walk';
        const ang = Math.atan2(p.x - p.fleeFromX, p.z - p.fleeFromZ);
        p.yaw = ang;
        const spd = 6.2;
        p.vx = Math.sin(ang) * spd;
        p.vz = Math.cos(ang) * spd;
      } else {
        p.turnTimer -= dt;
        if (p.turnTimer <= 0) {
          p.turnTimer = VS.rand(3, 8);
          p.walkDirYaw += VS.pick([-Math.PI / 2, 0, Math.PI / 2, Math.PI]);
        }
        p.yaw = p.walkDirYaw;
        const spd = 2.0;
        p.vx = Math.sin(p.yaw) * spd;
        p.vz = Math.cos(p.yaw) * spd;
      }

      const col = g.world.resolveCircleCollision(p.x + p.vx * dt, p.z + p.vz * dt, 0.45);
      p.x = col.x;
      p.z = col.z;
      if (col.hit) {
        p.walkDirYaw += Math.PI * 0.75;
      }

      for (const v of g.vehicles) {
        const d = VS.dist2D(p.x, p.z, v.x, v.z);
        if (d < 2.25) {
          const vSpd = Math.hypot(v.vx, v.vz);
          if (vSpd > 6.5) {
            g.damageNPC(p, vSpd * 3.0, v.vx * 0.9, v.vz * 0.9, 'vehicle');
            if (v.driver === g.player) {
              g.audio.playCrash(0.35);
              g.addCameraShake(0.2);
              if (g.police) g.police.reportCrime(VS.t('肇事撞人', 'Hit and Run'), 28);
            }
            break;
          } else if (vSpd > 1.2) {
            const pushX = (p.x - v.x) / (d || 1);
            const pushZ = (p.z - v.z) / (d || 1);
            p.x += pushX * 0.35;
            p.z += pushZ * 0.35;
            p.vx += pushX * 4.0;
            p.vz += pushZ * 4.0;
            if (v.driver === g.player) {
              this._handlePedBump(p, v.x, v.z, true);
            }
          } else {
            const pushX = (p.x - v.x) / (d || 1);
            const pushZ = (p.z - v.z) / (d || 1);
            p.x += pushX * 0.15;
            p.z += pushZ * 0.15;
          }
        }
      }

      const sp = Math.hypot(p.vx, p.vz);
      p.walkPhase += dt * (sp * 2.8);
      const sw = Math.sin(p.walkPhase) * Math.min(0.75, sp * 0.14);
      p.leftLeg.rotation.x = sw;
      p.rightLeg.rotation.x = -sw;
      if (p.punchAnim > 0) {
        const pf = Math.sin((p.punchAnim / 0.28) * Math.PI);
        p.rightArm.rotation.x = -1.65 * pf;
        p.leftArm.rotation.x = 0.4 * pf;
      } else if (p.state === 'scold') {
        p.rightArm.rotation.x = -1.1 + Math.sin(performance.now() * 0.015) * 0.35;
        p.leftArm.rotation.x = -0.5;
      } else {
        p.leftArm.rotation.x = -sw * 0.7;
        p.rightArm.rotation.x = sw * 0.7;
      }

      p.root.position.set(p.x, 0, p.z);
      p.root.rotation.y = p.yaw;

      if (VS.dist2D(p.x, p.z, px, pz) > 155) {
        const np = this._pickSidewalkPos(true);
        p.x = np.x; p.z = np.z; p.state = 'walk'; p.fleeTimer = 0; p.brawlTarget = null;
        this._removeBubble(p);
      }
    }

    if (this.peds.length < this.maxPeds && Math.random() < dt * 2.0) {
      const pos = this._pickSidewalkPos(true);
      this._spawnPedAt(pos.x, pos.z);
    }
  }
};
