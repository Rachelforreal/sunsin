// VICE SUN '86 - HUD, Minimap Radar, Speedometer & Overlay Controller
window.VS = window.VS || {};

VS.HUD = class HUD {
  constructor() {
    this.elHud = document.getElementById('hud');
    this.elStart = document.getElementById('start-screen');
    this.elCash = document.getElementById('cash-display');
    this.elClockPhase = document.getElementById('clock-phase');
    this.elClockTime = document.getElementById('clock-time');
    this.elHpFill = document.getElementById('hp-fill');
    this.elArmorFill = document.getElementById('armor-fill');
    this.elWeapon = document.getElementById('weapon-badge');
    this.elStars = Array.from(document.querySelectorAll('#wanted-row .star'));
    this.elHeatWrap = document.getElementById('heat-bar-wrap');
    this.elHeatFill = document.getElementById('heat-fill');
    this.elDistrict = document.getElementById('district-name');
    this.elMissionTitle = document.getElementById('mission-title');
    this.elMissionDesc = document.getElementById('mission-desc');
    this.elMissionTimer = document.getElementById('mission-timer');
    this.elFeed = document.getElementById('feed');
    this.elPrompt = document.getElementById('prompt-box');
    this.elVehHud = document.getElementById('vehicle-hud');
    this.elVehName = document.getElementById('veh-name');
    this.elSpeedVal = document.getElementById('speed-val');
    this.elGearBox = document.getElementById('gear-box');
    this.elRpmFill = document.getElementById('rpm-fill');
    this.elVehHpFill = document.getElementById('veh-hp-fill');
    this.elRadioPill = document.getElementById('radio-pill');
    this.elCrosshair = document.getElementById('crosshair');
    this.elLockReticle = document.getElementById('lock-reticle');
    this._projVec = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
    this.elSplash = document.getElementById('splash-banner');
    this.elSplashTitle = document.getElementById('splash-title');
    this.elSplashSub = document.getElementById('splash-sub');

    this.miniCanvas = document.getElementById('minimap');
    this.miniCtx = this.miniCanvas.getContext('2d');

    this.elJoyZone = document.getElementById('joy-zone');
    this.elSteerPad = document.getElementById('steer-pad');
    this.elFootPad = document.getElementById('touch-right-foot');
    this.elCarPad = document.getElementById('touch-right-car');
    this.elUseFoot = document.getElementById('t-use-foot');
    this.elUseCar = document.getElementById('t-use-car');
    this.elFireBtn = document.getElementById('t-fire');
    this.elCarFireBtn = document.getElementById('t-car-fire');

    this.splashTimer = 0;
    this.blinkPhase = 0;
    this.applyStaticI18n();
  }

  applyStaticI18n() {
    const dict = {
      heat: ['热度', 'HEAT'],
      btnTime: ['昼夜', 'TIME'],
      btnMute: ['静音', 'MUTE'],
      legJob: ['任务', 'JOB'],
      legGarage: ['车库', 'GARAGE'],
      legCops: ['警车', 'COPS'],
      chassis: ['耐久', 'CHASSIS'],
      hint: [
        'WASD 移动/驾驶 | Space 漂移/拳击 | F 抢车/买产业 | 1-6 武器(球棒/霰弹/RPG) | C 蹲伏掩体 | 车内点击/J 开炮射击 | 自动存档',
        'WASD Move/Drive | Space Drift/Kick | F Steal/Buy Asset | 1-6 Weapons (Bat/Shotgun/RPG) | C Crouch/Cover | Click/J Car Shoot | Auto-Save'
      ],
      tWpn: ['武器', 'GUN'],
      tCrouch: ['蹲掩', 'COVER'],
      tUse: ['上车/F', 'USE/F'],
      tSprint: ['冲刺', 'RUN'],
      tFire: ['开火', 'FIRE'],
      tCarFire: ['开炮', 'CANNON'],
      tRadio: ['电台', 'FM'],
      tHorn: ['鸣笛', 'HORN'],
      tExit: ['下车/F', 'EXIT'],
      tDrift: ['漂移', 'DRIFT'],
      tBrake: ['刹车', 'BRAKE'],
      tGas: ['油门', 'GAS'],
      kicker: ['80年代迈阿密海滨开放世界', 'MIAMI COASTAL SANDBOX'],
      gameTitle: ["罪恶阳光 '86", "VICE SUN '86"],
      gameSub: [
        '街头火拼、飙车抢车、摆脱警匪追击、接单赚钱并打造你的梦幻车库。落地自带武器，支持电脑与手机触屏！',
        'Walk, brawl, boost cars, outrun VCPD, run jobs, and build your dream garage. Starts armed, desktop & mobile ready!'
      ],
      cMove: ['移动 / 驾驶', 'Move / Drive'],
      cCam: ['视角旋转', 'Camera Orbit'],
      cCamK: ['鼠标拖拽 / Q E', 'Mouse / Q E'],
      cUse: ['抢车 / 上下车 / 交互', 'Steal Car / Interact'],
      cDrift: ['手刹漂移 / 冲刺', 'Handbrake / Sprint'],
      cFight: ['拳击 / 开火射击', 'Punch / Shoot'],
      cFightK: ['左键 / J', 'Click / J'],
      cWpn: ['切换武器 (1-6 球棒/霰弹/RPG)', 'Switch Weapon (1-6 Bat/Shotgun/RPG)'],
      cWpnK: ['1 - 6 / 滚轮', '1 - 6 / Wheel'],
      cCrouch: ['蹲伏掩体', 'Crouch / Cover'],
      cRadio: ['车载电台 / 鸣笛警笛', 'Car Radio / Horn'],
      cTime: ['切换昼夜 / 静音', 'Skip Time / Mute'],
      playBtn: ['进入罪恶阳光', 'ENTER VICE SUN'],
      garageTitle: ['阳光汽车改装厂', 'SUNSHINE AUTOS GARAGE'],
      garageSub: [
        '喷漆消星修车、全车性能改装、购买军火装备或提走你的梦想超跑。',
        'Respray to drop heat, tune your ride, stock up, or pull a new car onto the street.'
      ],
      garageReset: ['重置存档', 'RESET SAVE'],
      garageExit: ['返回街头 [ESC]', 'EXIT [ESC]']
    };
    const idx = VS.lang === 'zh' ? 0 : 1;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      if (dict[k]) el.textContent = dict[k][idx];
    });
    document.title = VS.t("罪恶阳光 '86 — VICE SUN '86", "VICE SUN '86 — Open-World Miami Crime");
  }

  showGameUI() {
    this.elStart.style.display = 'none';
    this.elHud.style.display = 'block';
  }

  addFeed(text, kind = 'info') {
    const div = document.createElement('div');
    div.className = 'feed-item' + (kind === 'crime' ? ' crime' : (kind === 'money' ? ' money' : ''));
    div.textContent = text;
    this.elFeed.appendChild(div);
    while (this.elFeed.children.length > 5) {
      this.elFeed.removeChild(this.elFeed.firstChild);
    }
    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 4200);
  }

  showSplash(title, sub = '', color = '#ff4fa3', duration = 2.6) {
    this.elSplashTitle.textContent = title;
    this.elSplashTitle.style.color = color;
    this.elSplashSub.textContent = sub;
    this.elSplash.style.display = 'flex';
    this.splashTimer = duration;
  }

  setPrompt(keyLabel, text) {
    const active = !!text;
    if (this.elUseFoot) this.elUseFoot.classList.toggle('highlight', active);
    if (this.elUseCar) this.elUseCar.classList.toggle('highlight', active);
    if (!active) {
      this.elPrompt.style.display = 'none';
      return;
    }
    this.elPrompt.innerHTML = `<kbd>${keyLabel}</kbd>${text}`;
    this.elPrompt.style.display = 'block';
  }

  update(dt, game) {
    this.blinkPhase += dt * 7;

    if (this.splashTimer > 0) {
      this.splashTimer -= dt;
      if (this.splashTimer <= 0) this.elSplash.style.display = 'none';
    }

    const p = game.player;
    this.elCash.textContent = '$' + p.cash.toLocaleString();
    this.elHpFill.style.width = VS.clamp((p.hp / p.maxHp) * 100, 0, 100) + '%';
    this.elArmorFill.style.width = VS.clamp((p.armor / p.maxArmor) * 100, 0, 100) + '%';

    const wl = p.getWeaponLabel();
    const coverBadge = !p.vehicle && (p.inCover || p.isCrouching) ? ` <span style="color:#00f0ff">[${p.inCover ? VS.t('掩体', 'COVER') : VS.t('蹲伏', 'CROUCH')}]</span>` : '';
    this.elWeapon.innerHTML = `${wl.name} <span>${wl.sub}</span>${coverBadge}`;
    const crouchBtn = document.getElementById('t-crouch');
    if (crouchBtn) crouchBtn.classList.toggle('active-toggle', !!p.isCrouching);
    this.elCrosshair.style.display = (!p.vehicle && p.weaponId !== 'fists' && game.started && !game.garageOpen) ? 'block' : 'none';

    if (this.elLockReticle) {
      const lt = p.lockedTarget;
      if (lt && !lt.dead && !lt.destroyed && game.started && !game.garageOpen && this._projVec) {
        this._projVec.set(lt.x, lt.y || 1.2, lt.z).project(game.camera);
        if (this._projVec.z >= -1 && this._projVec.z <= 1) {
          const sx = (this._projVec.x * 0.5 + 0.5) * window.innerWidth;
          const sy = (-this._projVec.y * 0.5 + 0.5) * window.innerHeight;
          this.elLockReticle.style.left = sx + 'px';
          this.elLockReticle.style.top = sy + 'px';
          this.elLockReticle.style.display = 'block';
        } else {
          this.elLockReticle.style.display = 'none';
        }
      } else {
        this.elLockReticle.style.display = 'none';
      }
    }

    const ti = game.world.getTimeInfo();
    this.elClockPhase.textContent = ti.phase;
    this.elClockTime.textContent = ti.str;
    this.elDistrict.textContent = VS.getDistrictName(p.x, p.z);

    // Wanted Stars & Heat
    const police = game.police;
    const stars = police ? police.wantedStars : 0;
    const cooling = police ? police.isEvading : false;
    const flashAlt = Math.floor(this.blinkPhase) % 2 === 0;
    this.elStars.forEach((el, idx) => {
      const active = idx < stars;
      el.classList.toggle('active', active);
      el.classList.toggle('alert-red', active && !cooling && flashAlt);
      el.classList.toggle('alert-blue', active && !cooling && !flashAlt);
      el.classList.toggle('cooling', active && cooling && flashAlt);
    });
    if (police && (police.heat > 0 || stars > 0)) {
      this.elHeatWrap.style.display = 'flex';
      this.elHeatFill.style.width = VS.clamp((police.heat / 500) * 100, 0, 100) + '%';
    } else {
      this.elHeatWrap.style.display = 'none';
    }

    // Mission Status
    if (game.missions) {
      const ms = game.missions.getHUDState();
      this.elMissionTitle.textContent = ms.title;
      this.elMissionDesc.textContent = ms.desc;
      if (ms.timerText) {
        this.elMissionTimer.style.display = 'block';
        this.elMissionTimer.textContent = ms.timerText;
      } else {
        this.elMissionTimer.style.display = 'none';
      }
    }

    // Vehicle HUD & Mobile Touch Pad Mode Switch
    const inCar = !!p.vehicle;
    if (this.elJoyZone) {
      this.elJoyZone.style.display = inCar ? 'none' : 'block';
      this.elSteerPad.style.display = inCar ? 'flex' : 'none';
      this.elFootPad.style.display = inCar ? 'none' : 'flex';
      this.elCarPad.style.display = inCar ? 'flex' : 'none';
    }
    if (this.elFireBtn) {
      this.elFireBtn.textContent = p.weaponId === 'bat' ? VS.t('挥棒', 'SWING') : (p.weaponId === 'fists' ? VS.t('拳击', 'PUNCH') : VS.t('开火', 'FIRE'));
    }
    if (inCar) {
      const v = p.vehicle;
      if (this.elCarFireBtn) {
        this.elCarFireBtn.textContent = v.spec.isTank ? VS.t('开炮', 'CANNON') : VS.t('射击', 'SHOOT');
      }
      this.elVehHud.style.display = 'flex';
      this.elVehName.textContent = VS.vehName(v.spec);
      const mph = Math.round(Math.abs(v.forwardSpeed) * 2.237);
      this.elSpeedVal.textContent = String(mph);
      this.elGearBox.textContent = v.gearLabel;
      this.elRpmFill.style.width = VS.clamp(v.rpmNorm * 100, 8, 100) + '%';
      const hpPct = VS.clamp((v.hp / v.maxHp) * 100, 0, 100);
      this.elVehHpFill.style.width = hpPct + '%';
      this.elVehHpFill.style.background = hpPct > 50 ? '#4ef2b8' : (hpPct > 22 ? '#ffdf4d' : '#ff2a6d');
      this.elRadioPill.textContent = `${VS.t('电台', 'RADIO')}: ${game.audio.getStationName()} [R]`;
    } else {
      this.elVehHud.style.display = 'none';
    }

    this._drawMinimap(game);
  }

  _drawMinimap(game) {
    const ctx = this.miniCtx;
    const w = this.miniCanvas.width;
    const h = this.miniCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 0.56; // pixels per meter
    const p = game.player;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#182235';
    ctx.fillRect(0, 0, w, h);

    const toMini = (wx, wz) => ({
      x: cx + (wx - p.x) * scale,
      y: cy + (wz - p.z) * scale
    });

    // Beach & Ocean on East side (+X)
    const beachStart = toMini(VS.CONFIG.BEACH_X_START, p.z).x;
    const oceanStart = toMini(VS.CONFIG.OCEAN_X_START, p.z).x;
    ctx.fillStyle = '#d9ba73';
    ctx.fillRect(beachStart, 0, w - beachStart, h);
    ctx.fillStyle = '#0096c7';
    ctx.fillRect(oceanStart, 0, w - oceanStart, h);

    // Starfish Causeway Bridge and Starfish Island
    const bridgeA = toMini(166, -26), bridgeB = toMini(260, -22);
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 8 * scale; ctx.beginPath(); ctx.moveTo(bridgeA.x, bridgeA.y); ctx.lineTo(bridgeB.x, bridgeB.y); ctx.stroke();
    const islandTL = toMini(258, -66), islandBR = toMini(330, 26);
    ctx.fillStyle = '#d9ba73'; ctx.fillRect(islandTL.x, islandTL.y, islandBR.x - islandTL.x, islandBR.y - islandTL.y);
    ctx.fillStyle = '#2a3b4c'; ctx.fillRect(islandTL.x + 9, islandTL.y + 10, islandBR.x - islandTL.x - 18, islandBR.y - islandTL.y - 20);

    // Roads
    ctx.fillStyle = '#3c4659';
    const rw = VS.CONFIG.ROAD_WIDTH * scale;
    for (const ax of VS.CONFIG.AVENUE_X) {
      const mx = toMini(ax, 0).x;
      ctx.fillRect(mx - rw / 2, 0, rw, h);
    }
    for (const sz of VS.CONFIG.STREET_Z) {
      const my = toMini(0, sz).y;
      ctx.fillRect(0, my - rw / 2, beachStart, rw);
    }

    for (const pkg of (VS.CONFIG.HIDDEN_PACKAGES || [])) {
      if (game.collectedPackages && game.collectedPackages[pkg.id]) continue;
      const pp = toMini(pkg.x, pkg.z);
      if (pp.x >= 0 && pp.x <= w && pp.y >= 0 && pp.y <= h) { ctx.fillStyle = '#c77dff'; ctx.beginPath(); ctx.arc(pp.x, pp.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
    }

    // Garage Blip (Cyan Square)
    const gPos = VS.CONFIG.GARAGE_POS;
    const gp = toMini(gPos.x, gPos.z);
    this._drawClampedBlip(ctx, gp.x, gp.y, cx, cy, 78, '#00f0ff', 'G');

    // Mission Objective or Payphone Blips (Pink)
    if (game.missions) {
      const blips = game.missions.getRadarBlips();
      for (const b of blips) {
        const bp = toMini(b.x, b.z);
        this._drawClampedBlip(ctx, bp.x, bp.y, cx, cy, 78, b.color || '#ff4fa3', b.label || 'M');
      }
    }

    // Police Cruisers, Military Tanks, Helicopter & Fighter Jet on Radar
    if (game.police) {
      const isRed = Math.floor(this.blinkPhase * 1.4) % 2 === 0;
      if (game.police.cops) {
        for (const c of game.police.cops) {
          const cp = toMini(c.x, c.z);
          if (Math.hypot(cp.x - cx, cp.y - cy) < 84) {
            ctx.fillStyle = isRed ? '#ff2a55' : '#38bdf8';
            ctx.beginPath();
            ctx.arc(cp.x, cp.y, 4.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      if (game.police.tanks) {
        for (const tk of game.police.tanks) {
          const tp = toMini(tk.x, tk.z);
          this._drawClampedBlip(ctx, tp.x, tp.y, cx, cy, 78, '#a3e635', 'T');
        }
      }
      if (game.police.heli) {
        const hp = toMini(game.police.heli.x, game.police.heli.z);
        this._drawClampedBlip(ctx, hp.x, hp.y, cx, cy, 78, isRed ? '#38bdf8' : '#ffffff', 'H');
      }
      if (game.police.jet) {
        const jp = toMini(game.police.jet.x, game.police.jet.z);
        this._drawClampedBlip(ctx, jp.x, jp.y, cx, cy, 78, '#ff7b00', 'J');
      }
    }

    // Nearby regular cars (subtle grey dots)
    if (game.vehicles) {
      ctx.fillStyle = 'rgba(226,232,240,0.48)';
      for (const v of game.vehicles) {
        if (v === p.vehicle || v.spec.isPolice) continue;
        const vp = toMini(v.x, v.z);
        if (Math.hypot(vp.x - cx, vp.y - cy) < 80) {
          ctx.fillRect(vp.x - 2, vp.y - 2, 4, 4);
        }
      }
    }

    // Player Arrow at Center
    ctx.save();
    ctx.translate(cx, cy);
    // In world space: yaw=0 faces +Z (South/down on minimap), yaw=PI faces -Z (North/up)
    ctx.rotate(-p.yaw + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0d0a1a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawClampedBlip(ctx, x, y, cx, cy, maxR, color, letter) {
    let dx = x - cx;
    let dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d > maxR) {
      dx = (dx / d) * maxR;
      dy = (dy / d) * maxR;
    }
    const bx = cx + dx;
    const by = cy + dy;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d0a1a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#0d0a1a';
    ctx.font = '900 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, bx, by + 0.5);
  }
};
