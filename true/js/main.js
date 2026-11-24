// VICE SUN '86 - Main Game Loop, Camera Rig, Input & System Orchestrator
window.VS = window.VS || {};

VS.Game = class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.94;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, 950);

    this.audio = new VS.Audio();
    this.world = new VS.World(this.scene);
    this.player = new VS.Player(this.scene);
    this.hud = new VS.HUD();

    // Optional / Milestone 2 & 3 systems (wired cleanly when present)
    this.vehicles = [];
    this.vehicleManager = VS.VehicleManager ? new VS.VehicleManager(this) : null;
    this.livingCity = VS.LivingCity ? new VS.LivingCity(this) : null;
    this.police = VS.PoliceSystem ? new VS.PoliceSystem(this) : null;
    this.missions = VS.MissionSystem ? new VS.MissionSystem(this) : null;
    this.garage = VS.GarageSystem ? new VS.GarageSystem(this) : null;

    // Game State
    this.started = false;
    this.collectedPackages = {};
    this.completedStunts = {};
    this.garageOpen = false;
    this.recoverTimer = 0;

    // Camera State
    this.camYaw = 0;       // 0 looks toward -Z (North up Ocean Drive!)
    this.camPitch = 0.24;
    this.camPos = new THREE.Vector3(109, 6, 58);
    this.camTarget = new THREE.Vector3(109, 1.8, 48);
    this.cameraShake = 0;
    this.titleOrbit = 0;

    // Input State
    this.input = {
      up: false, down: false, left: false, right: false,
      joyX: 0, joyY: 0,
      sprint: false, handbrake: false,
      camLeft: false, camRight: false,
      mouseDown: false,
      carFireDown: false
    };
    this.isDraggingMouse = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.camTouchId = null;
    this.joyTouchId = null;
    this._saveTick = 5.0;
    this._loadedFromSave = false;
    this._defaultWeapons = Object.assign({}, this.player.ownedWeapons);
    this._defaultAmmo = Object.assign({}, this.player.ammo);
    this._defaultWeaponId = this.player.weaponId;

    this._bindEvents();
    this._bindTouchAndTools();
    this.loadGame();

    // Expose hook for debugging/automated QA
    window.__GAME__ = this;

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this._loop(t));
  }

  _bindEvents() {
    window.addEventListener('beforeunload', () => { if (this.started) this.saveGame(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && this.started) this.saveGame(); });
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.getElementById('play-btn').addEventListener('click', () => {
      this.startGame();
    });

    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
        e.preventDefault();
      }
      if (!this.started) {
        if (code === 'Enter' || code === 'Space') this.startGame();
        return;
      }

      if (this.garageOpen) {
        if (code === 'Escape' || code === 'KeyF' || code === 'KeyE') {
          if (this.garage) this.garage.close();
        }
        return;
      }

      this.audio.unlock();

      if (code === 'KeyW' || code === 'ArrowUp') this.input.up = true;
      if (code === 'KeyS' || code === 'ArrowDown') this.input.down = true;
      if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') this.input.right = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.sprint = true;
      if (code === 'Space') {
        this.input.handbrake = true;
        if (!this.player.vehicle) {
          this.player.performAttack(this, this.getAimYaw());
        } else if (this.player.vehicle.spec.isTank && this.player.performVehicleAttack) {
          this.player.performVehicleAttack(this, this.getAimYaw());
        }
      }
      if (code === 'KeyQ') this.input.camLeft = true;
      if (code === 'KeyE') this.input.camRight = true;
      if (code === 'KeyJ') {
        if (this.player.vehicle) {
          if (this.player.performVehicleAttack) this.player.performVehicleAttack(this, this.getAimYaw());
        } else {
          this.player.performAttack(this, this.getAimYaw());
        }
      }
      if (code === 'KeyF') this.handleInteract();
      if (code === 'Digit1') this.player.selectWeapon('fists');
      if (code === 'Digit2') this.player.selectWeapon('bat');
      if (code === 'Digit3') this.player.selectWeapon('pistol');
      if (code === 'Digit4') this.player.selectWeapon('smg');
      if (code === 'Digit5') this.player.selectWeapon('shotgun');
      if (code === 'Digit6') this.player.selectWeapon('rpg');
      if (code === 'KeyC' && !this.player.vehicle && this.player.toggleCrouch) {
        const cr = this.player.toggleCrouch();
        this.hud.addFeed(cr ? VS.t('已进入战术蹲伏（靠近墙体/车辆自动获得掩体减伤）', 'Tactical Crouch ON (hug walls/cars for 62% Cover protection)') : VS.t('已起身站立', 'Stood up'));
      }
      if (code === 'KeyR' && this.player.vehicle) {
        const st = this.audio.cycleStation();
        this.hud.addFeed(VS.t(`已切换电台: ${st}`, `Radio tuned to ${st}`));
      }
      if (code === 'KeyH' && this.player.vehicle) {
        if (this.player.vehicle.spec.isPolice) {
          this.player.vehicle.sirenOn = !this.player.vehicle.sirenOn;
          this.hud.addFeed(this.player.vehicle.sirenOn ? VS.t('警笛已开启', 'VCPD Siren ON') : VS.t('警笛已关闭', 'VCPD Siren OFF'));
        } else {
          this.audio.playHorn();
          if (this.livingCity) this.livingCity.alertHorn(this.player.x, this.player.z);
        }
      }
      if (code === 'KeyT') {
        this.world.advanceTime(4);
        const ti = this.world.getTimeInfo();
        this.hud.addFeed(VS.t(`时间已跳至 ${ti.str} (${ti.phase})`, `Time skipped to ${ti.str} (${ti.phase})`));
      }
      if (code === 'KeyN') {
        const m = this.audio.toggleMute();
        this.hud.addFeed(m ? VS.t('已静音', 'Audio Muted') : VS.t('已恢复音效', 'Audio Unmuted'));
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.input.up = false;
      if (code === 'KeyS' || code === 'ArrowDown') this.input.down = false;
      if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') this.input.right = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.sprint = false;
      if (code === 'Space') this.input.handbrake = false;
      if (code === 'KeyQ') this.input.camLeft = false;
      if (code === 'KeyE') this.input.camRight = false;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.started || this.garageOpen) return;
      this.audio.unlock();
      if (e.button === 0) {
        const wasDragging = this.isDraggingMouse || this.camTouchId !== null;
        this.input.mouseDown = !wasDragging;
        this.isDraggingMouse = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        if (!wasDragging) {
          if (!this.player.vehicle) {
            this.player.performAttack(this, this.getAimYaw());
          } else if (this.player.performVehicleAttack) {
            this.player.performVehicleAttack(this, this.getAimYaw());
          }
        }
      } else if (e.button === 2) {
        this.isDraggingMouse = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    window.addEventListener('wheel', (e) => {
      if (!this.started || this.garageOpen || e.deltaY === 0) return;
      const order = ['fists', 'bat', 'pistol', 'smg', 'shotgun', 'rpg'].filter((w) => this.player.ownedWeapons[w]);
      if (order.length <= 1) return;
      const cur = Math.max(0, order.indexOf(this.player.weaponId));
      const dir = e.deltaY > 0 ? 1 : -1;
      this.player.selectWeapon(order[(cur + dir + order.length) % order.length]);
    }, { passive: true });

    window.addEventListener('mouseup', () => {
      this.input.mouseDown = false;
      this.isDraggingMouse = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.started || this.garageOpen) return;
      if (document.pointerLockElement === this.canvas) {
        this.camYaw -= e.movementX * 0.0032;
        this.camPitch = VS.clamp(this.camPitch + e.movementY * 0.0024, 0.06, 0.72);
      } else if (this.isDraggingMouse) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.camYaw -= dx * 0.0055;
        this.camPitch = VS.clamp(this.camPitch + dy * 0.004, 0.06, 0.72);
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _bindTouchAndTools() {
    const updateTouchLayout = () => {
      const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || window.innerWidth <= 900;
      document.body.classList.toggle('touch-mode', isTouch);
    };
    updateTouchLayout();
    window.addEventListener('resize', updateTouchLayout);

    // Language toggle buttons (title screen & HUD)
    const toggleLang = () => {
      VS.lang = VS.lang === 'zh' ? 'en' : 'zh';
      this.hud.applyStaticI18n();
      if (this.garageOpen && this.garage) this.garage.render();
      this.hud.addFeed(VS.lang === 'zh' ? '已切换至中文界面' : 'Switched to English UI');
    };
    const btnStartLang = document.getElementById('lang-btn-start');
    const btnHudLang = document.getElementById('btn-lang');
    if (btnStartLang) btnStartLang.addEventListener('click', toggleLang);
    if (btnHudLang) btnHudLang.addEventListener('click', toggleLang);

    const btnTime = document.getElementById('btn-time');
    if (btnTime) btnTime.addEventListener('click', () => {
      this.audio.unlock();
      this.world.advanceTime(4);
      const ti = this.world.getTimeInfo();
      this.hud.addFeed(VS.t(`时间已跳至 ${ti.str} (${ti.phase})`, `Time skipped to ${ti.str} (${ti.phase})`));
    });
    const btnMute = document.getElementById('btn-mute');
    if (btnMute) btnMute.addEventListener('click', () => {
      this.audio.unlock();
      const m = this.audio.toggleMute();
      this.hud.addFeed(m ? VS.t('已静音', 'Audio Muted') : VS.t('已恢复音效', 'Audio Unmuted'));
    });

    // Virtual Joystick (on-foot smooth 360 walk & sprint)
    const joyZone = document.getElementById('joy-zone');
    const joyKnob = document.getElementById('joy-knob');
    const handleJoyMove = (clientX, clientY) => {
      const rect = joyZone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const maxR = rect.width * 0.38;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
      joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.input.joyX = dx / maxR;
      this.input.joyY = -dy / maxR; // up = +1
      this.input.sprint = dist > maxR * 0.88;
    };
    const resetJoy = () => {
      this.joyTouchId = null;
      joyKnob.style.transform = 'translate(0px, 0px)';
      this.input.joyX = 0;
      this.input.joyY = 0;
      this.input.sprint = false;
    };
    if (joyZone) {
      joyZone.addEventListener('touchstart', (e) => {
        e.preventDefault(); this.audio.unlock();
        const t = e.changedTouches[0];
        this.joyTouchId = t.identifier;
        handleJoyMove(t.clientX, t.clientY);
      }, { passive: false });
      joyZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          if (t.identifier === this.joyTouchId) handleJoyMove(t.clientX, t.clientY);
        }
      }, { passive: false });
      joyZone.addEventListener('touchend', (e) => {
        for (const t of e.changedTouches) if (t.identifier === this.joyTouchId) resetJoy();
      });
      joyZone.addEventListener('touchcancel', resetJoy);
    }

    // Hold-button helper for touch & mouse clicks on mobile buttons
    const bindHold = (id, onDown, onUp) => {
      const el = document.getElementById(id);
      if (!el) return;
      const start = (e) => { e.preventDefault(); e.stopPropagation(); this.audio.unlock(); el.classList.add('pressed'); onDown(); };
      const end = (e) => { e.preventDefault(); el.classList.remove('pressed'); if (onUp) onUp(); };
      el.addEventListener('touchstart', start, { passive: false });
      el.addEventListener('touchend', end, { passive: false });
      el.addEventListener('touchcancel', end);
      el.addEventListener('mousedown', start);
      el.addEventListener('mouseup', end);
      el.addEventListener('mouseleave', () => { if (el.classList.contains('pressed')) { el.classList.remove('pressed'); if (onUp) onUp(); } });
    };

    bindHold('t-left',  () => { this.input.left = true; },  () => { this.input.left = false; });
    bindHold('t-right', () => { this.input.right = true; }, () => { this.input.right = false; });
    bindHold('t-gas',   () => { this.input.up = true; },    () => { this.input.up = false; });
    bindHold('t-brake', () => { this.input.down = true; },  () => { this.input.down = false; });
    bindHold('t-drift', () => { this.input.handbrake = true; }, () => { this.input.handbrake = false; });
    bindHold('t-sprint',() => { this.input.sprint = true; }, () => { this.input.sprint = false; });
    bindHold('t-fire',  () => {
      this.input.mouseDown = true;
      if (!this.player.vehicle) { this.player.performAttack(this, this.getAimYaw()); this.nudgeCameraToLock(0.28); }
    }, () => { this.input.mouseDown = false; });
    bindHold('t-car-fire', () => {
      this.input.carFireDown = true;
      if (this.player.vehicle && this.player.performVehicleAttack) {
        this.player.performVehicleAttack(this, this.getAimYaw());
        this.nudgeCameraToLock(0.28);
      }
    }, () => { this.input.carFireDown = false; });

    const bindTap = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      const fire = (e) => { e.preventDefault(); e.stopPropagation(); this.audio.unlock(); fn(); };
      el.addEventListener('touchstart', fire, { passive: false });
      el.addEventListener('click', fire);
    };
    bindTap('t-use-foot', () => this.handleInteract());
    bindTap('t-crouch', () => { if (!this.player.vehicle && this.player.toggleCrouch) this.player.toggleCrouch(); });
    bindTap('t-use-car', () => this.handleInteract());
    bindTap('t-wpn', () => {
      const order = ['fists', 'bat', 'pistol', 'smg', 'shotgun', 'rpg'].filter((w) => this.player.ownedWeapons[w]);
      const idx = (order.indexOf(this.player.weaponId) + 1) % order.length;
      this.player.selectWeapon(order[idx]);
    });
    bindTap('t-radio', () => {
      if (this.player.vehicle) {
        const st = this.audio.cycleStation();
        this.hud.addFeed(VS.t(`已切换电台: ${st}`, `Radio tuned to ${st}`));
      }
    });
    bindTap('t-horn', () => {
      if (!this.player.vehicle) return;
      if (this.player.vehicle.spec.isPolice) {
        this.player.vehicle.sirenOn = !this.player.vehicle.sirenOn;
      } else {
        this.audio.playHorn();
        if (this.livingCity) this.livingCity.alertHorn(this.player.x, this.player.z);
      }
    });

    // Touch-drag anywhere on canvas to orbit camera smoothly
    this.canvas.addEventListener('touchstart', (e) => {
      if (!this.started || this.garageOpen) return;
      this.audio.unlock();
      if (this.camTouchId === null && e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        this.camTouchId = t.identifier;
        this.lastMouseX = t.clientX;
        this.lastMouseY = t.clientY;
        this.isDraggingMouse = true;
      }
    }, { passive: true });
    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.started || this.garageOpen) return;
      for (const t of e.changedTouches) {
        if (t.identifier === this.camTouchId) {
          const dx = t.clientX - this.lastMouseX;
          const dy = t.clientY - this.lastMouseY;
          this.lastMouseX = t.clientX;
          this.lastMouseY = t.clientY;
          this.camYaw -= dx * 0.007;
          this.camPitch = VS.clamp(this.camPitch + dy * 0.005, 0.06, 0.72);
        }
      }
    }, { passive: true });
    const endCamTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.camTouchId) {
          this.camTouchId = null;
          this.isDraggingMouse = false;
        }
      }
    };
    this.canvas.addEventListener('touchend', endCamTouch);
    this.canvas.addEventListener('touchcancel', endCamTouch);
  }

  saveGame() {
    try {
      const payload = {
        collectedPackages: Object.assign({}, this.collectedPackages),
        completedStunts: Object.assign({}, this.completedStunts),
        completedRampages: this.missions && this.missions.completedRampages ? Object.assign({}, this.missions.completedRampages) : {},
        cash: this.player.cash,
        armor: this.player.armor,
        ownedWeapons: Object.assign({}, this.player.ownedWeapons),
        ammo: Object.assign({}, this.player.ammo),
        weaponId: this.player.weaponId,
        upgrades: Object.assign({}, this.player.upgrades),
        unlockedCars: Object.assign({}, this.player.unlockedCars),
        completedCount: this.missions ? this.missions.completedCount : 0,
        missionIndex: this.missions ? this.missions.missionIndex : 0,
        ownedProperties: this.missions ? Object.assign({}, this.missions.ownedProperties) : {}
      };
      localStorage.setItem('vice_sun_86_save_v1', JSON.stringify(payload));
    } catch (err) {
      // Ignore storage errors
    }
  }

  loadGame() {
    try {
      const raw = localStorage.getItem('vice_sun_86_save_v1');
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return false;
      this.collectedPackages = Object.assign({}, data.collectedPackages || {});
      this.completedStunts = Object.assign({}, data.completedStunts || {});
      if (this.missions) this.missions.completedRampages = Object.assign({}, data.completedRampages || {});
      if (this.world && this.world.syncPackages) this.world.syncPackages(this.collectedPackages);
      if (typeof data.cash === 'number') this.player.cash = data.cash;
      if (typeof data.armor === 'number') this.player.armor = data.armor;
      if (data.ownedWeapons && typeof data.ownedWeapons === 'object') {
        Object.assign(this.player.ownedWeapons, data.ownedWeapons);
      }
      if (data.ammo && typeof data.ammo === 'object') {
        Object.assign(this.player.ammo, data.ammo);
      }
      if (data.upgrades && typeof data.upgrades === 'object') {
        Object.assign(this.player.upgrades, data.upgrades);
      }
      if (data.unlockedCars && typeof data.unlockedCars === 'object') {
        this.player.unlockedCars = Object.assign({}, data.unlockedCars);
      }
      if (typeof data.weaponId === 'string' && this.player.ownedWeapons[data.weaponId]) {
        this.player.weaponId = data.weaponId;
      }
      this.player.selectWeapon(this.player.weaponId);
      if (this.missions) {
        if (typeof data.completedCount === 'number') this.missions.completedCount = data.completedCount;
        if (typeof data.missionIndex === 'number') this.missions.missionIndex = data.missionIndex;
        if (data.ownedProperties && typeof data.ownedProperties === 'object') {
          this.missions.ownedProperties = Object.assign({}, data.ownedProperties);
        }
        if (this.missions.syncPropertyVisuals) this.missions.syncPropertyVisuals();
      }
      this._loadedFromSave = true;
      return true;
    } catch (err) {
      return false;
    }
  }

  resetSave() {
    try {
      localStorage.removeItem('vice_sun_86_save_v1');
    } catch (err) {
      // Ignore storage errors
    }
    this.collectedPackages = {};
    this.completedStunts = {};
    if (this.missions) this.missions.completedRampages = {};
    if (this.world && this.world.syncPackages) this.world.syncPackages({});
    this.player.cash = 250;
    this.player.armor = 0;
    this.player.upgrades = { engine: 0, turbo: 0, armor: 0 };
    this.player.unlockedCars = {};
    this.player.ownedWeapons = Object.assign({}, this._defaultWeapons);
    this.player.ammo = Object.assign({}, this._defaultAmmo);
    this.player.selectWeapon(this._defaultWeaponId || 'pistol');
    if (this.missions) {
      this.missions.completedCount = 0;
      this.missions.missionIndex = 0;
      this.missions.ownedProperties = {};
      if (this.missions.syncPropertyVisuals) this.missions.syncPropertyVisuals();
    }
    this._loadedFromSave = false;
    if (this.garageOpen && this.garage) this.garage.render();
    this.audio.playClick();
    this.hud.addFeed(VS.t('本地存档已重置！', 'Save data reset!'), 'info');
  }

  startGame() {
    if (this.started) return;
    this.started = true;
    this.audio.unlock();
    this.hud.showGameUI();
    this.hud.addFeed(VS.t('欢迎来到罪恶阳光 \'86！已配备随身手枪与冲锋枪，快去抢车或接任务吧！', "Welcome to Vice Sun '86! You're armed — grab a ride or answer the pink Payphone."), 'info');
    if (this._loadedFromSave) {
      this.hud.addFeed(VS.t('已自动读取本地存档进度！', 'Local auto-save progress restored!'), 'money');
    }
  }

  nudgeCameraToLock(strength = 0.24) {
    if (!document.body.classList.contains('touch-mode') || !this.player.lockedTarget) return;
    const lt = this.player.lockedTarget;
    const ox = this.player.vehicle ? this.player.vehicle.x : this.player.x;
    const oz = this.player.vehicle ? this.player.vehicle.z : this.player.z;
    const desiredCamYaw = Math.atan2(ox - lt.x, oz - lt.z);
    this.camYaw += VS.angleDiff(this.camYaw, desiredCamYaw) * strength;
  }

  onPackageCollected(pkg) {
    this.collectedPackages[pkg.id] = true;
    const count = Object.keys(this.collectedPackages).length;
    const total = (VS.CONFIG.HIDDEN_PACKAGES || []).length || 10;
    this.player.addCash(500);
    this.audio.playMissionComplete();
    this.hud.showSplash(VS.t('发现隐藏图腾！', 'HIDDEN PACKAGE!'), `${count} / ${total} (+$500)`, '#c77dff', 2.3);
    if (count === 3) { this.player.armor = 100; this.hud.addFeed(VS.t('集齐 3 个隐藏图腾：赠送满额防弹衣！', '3 Packages Bonus: Full Body Armor!')); }
    if (count === 6) { this.player.ammo.shotgun = (this.player.ammo.shotgun || 0) + 24; this.player.ammo.rpg = (this.player.ammo.rpg || 0) + 10; this.player.addCash(1500); this.hud.addFeed(VS.t('集齐 6 个隐藏图腾：重火力弹药补给 + $1,500！', '6 Packages Bonus: Heavy Ammo + $1,500!')); }
    if (count === 10) { this.player.unlockedCars.infernus = true; this.player.unlockedCars.tank = true; this.player.addCash(5000); this.hud.addFeed(VS.t('集齐全部 10 个图腾：已免费解锁炼狱超跑与军方犀牛坦克 + $5,000！', 'All 10 Packages! Unlocked Infernus & Rhino Tank + $5,000!')); }
    this.saveGame();
  }

  getAimYaw() {
    // Camera forward vector is (-sin(camYaw), -cos(camYaw)); player yaw=atan2(dirX, dirZ)
    return Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw));
  }

  addCameraShake(amount) {
    this.cameraShake = Math.min(1.2, this.cameraShake + amount);
  }

  getCombatTargets() {
    const out = [];
    if (this.livingCity && this.livingCity.peds) {
      for (const ped of this.livingCity.peds) out.push(ped);
    }
    if (this.police && this.police.footCops) {
      for (const cop of this.police.footCops) out.push(cop);
    }
    if (this.missions && this.missions.enemies) {
      for (const en of this.missions.enemies) out.push(en);
    }
    return out;
  }

  damageNPC(npc, dmg, knockVx, knockVz, source = 'melee') {
    if (!npc || npc.dead) return;
    npc.hp -= dmg;
    npc.vx = (npc.vx || 0) + knockVx;
    npc.vz = (npc.vz || 0) + knockVz;
    npc.stunTimer = 0.35;

    // Hit sparks
    for (let i = 0; i < 6; i++) {
      this.world.spawnParticle({
        x: npc.x, y: 1.2, z: npc.z,
        vx: knockVx * 0.35 + VS.rand(-3, 3),
        vy: VS.rand(2, 6),
        vz: knockVz * 0.35 + VS.rand(-3, 3),
        color: npc.isEnemy || npc.isCop ? 0xff4fa3 : 0xffd166,
        life: 0.35
      });
    }

    if (npc.isCop) {
      if (this.police) this.police.reportCrime(VS.t('袭警', 'Assaulting VCPD Officer'), 45);
    } else if (!npc.isEnemy) {
      if (this.police) this.police.reportCrime(VS.t('街头斗殴', 'Street Assault'), 18);
      if (this.livingCity && this.livingCity.onPedAttacked) {
        this.livingCity.onPedAttacked(npc, source);
      } else if (this.livingCity) {
        this.livingCity.panicNear(npc.x, npc.z, 18);
      }
    }

    if (npc.hp <= 0) {
      npc.dead = true;
      npc.deathTimer = 6.0;
      const dropCash = npc.isEnemy ? VS.rand(75, 130) : (npc.isCop ? 60 : VS.rand(25, 65));
      this.world.spawnPickup(npc.x, npc.z, 'cash', Math.round(dropCash));
      if (npc.isCop && !this.player.ownedWeapons.pistol) {
        this.player.ownedWeapons.pistol = true;
        this.player.ammo.pistol += 18;
        this.hud.addFeed(VS.t('捡到 VCPD 9mm 手枪！按 [2] 装备。', 'Picked up VCPD 9mm Pistol! Press [2] to equip.'), 'money');
      } else if (npc.isCop) {
        this.player.ammo.pistol += 12;
      }
      if (this.missions) this.missions.onNPCKilled(npc);
    }
  }

  handleInteract() {
    if (this.recoverTimer > 0) return;

    // 1. Check Garage Entry first (works both on foot & in car!)
    if (this.garage && this.garage.isPlayerInBay()) {
      this.garage.open();
      return;
    }

    // 1b. Check Empire Property Purchase
    if (this.missions && this.missions.tryBuyNearbyProperty && this.missions.tryBuyNearbyProperty()) {
      return;
    }

    // 2. Check Mission Payphone Start (if not in active mission)
    if (this.missions && this.missions.tryStartNearbyMission()) {
      return;
    }

    // 3. Exit / Enter / Carjack Vehicle
    if (this.player.vehicle) {
      if (this.vehicleManager) this.vehicleManager.exitVehicle(this.player);
    } else if (this.vehicleManager) {
      this.vehicleManager.tryEnterNearestVehicle(this.player);
    }
  }

  triggerPlayerDown(reason = 'WASTED') {
    if (this.recoverTimer > 0) return;
    this.recoverTimer = 3.0;
    this.player.isDead = reason === 'WASTED';
    if (this.player.vehicle && this.vehicleManager) {
      this.vehicleManager.exitVehicle(this.player, true);
    }
    const fine = Math.min(this.player.cash, reason === 'BUSTED' ? 150 : 100);
    this.player.cash -= fine;
    if (this.missions) this.missions.failActiveMission(reason);
    if (this.police) this.police.clearWanted(true);
    this.hud.showSplash(
      reason === 'BUSTED' ? VS.t('被 捕', 'BUSTED') : VS.t('你 挂 了', 'WASTED'),
      reason === 'BUSTED' ? VS.t(`警局保释金 -$${fine}`, `VCPD Bail -$${fine}`) : VS.t(`海景医院医疗费 -$${fine}`, `Ocean View Hospital -$${fine}`),
      reason === 'BUSTED' ? '#38bdf8' : '#ff2a6d',
      2.9
    );
    this._respawnReason = reason;
  }

  _finishRespawn() {
    const dest = this._respawnReason === 'BUSTED' ? VS.CONFIG.PRECINCT_POS : VS.CONFIG.HOSPITAL_POS;
    this.player.x = dest.x + 14;
    this.player.z = dest.z + 24;
    this.player.vx = 0;
    this.player.vz = 0;
    this.player.y = this.world.getDeckHeight ? this.world.getDeckHeight(this.player.x, this.player.z, 0) : 0;
    this.player.healFull();
    this.hud.addFeed(this._respawnReason === 'BUSTED' ? VS.t('已从 VCPD 警局保释出狱。', 'Released from VCPD Precinct.') : VS.t('已从海景医院康复出院。', 'Discharged from Ocean View Medical.'));
    this.saveGame();
  }

  _updatePrompts() {
    if (!this.started || this.garageOpen || this.recoverTimer > 0) {
      this.hud.setPrompt(null, null);
      return;
    }
    if (this.garage && this.garage.isPlayerInBay()) {
      this.hud.setPrompt('F', VS.t('进入阳光汽车改装厂 (喷漆/升级/买车)', 'Enter Sunshine Autos Garage (Respray / Upgrades / Cars)'));
      return;
    }
    if (this.missions) {
      const mp = this.missions.getNearbyPrompt();
      if (mp) {
        this.hud.setPrompt('F', mp);
        return;
      }
    }
    if (!this.player.vehicle && this.vehicleManager) {
      const nv = this.vehicleManager.findNearestVehicle(this.player.x, this.player.z, 4.6);
      if (nv) {
        const verb = nv.aiDriver ? VS.t('抢劫驾驶', 'Carjack') : VS.t('驾驶', 'Drive');
        this.hud.setPrompt('F', `${verb} ${VS.vehName(nv.spec)}`);
        return;
      }
    }
    this.hud.setPrompt(null, null);
  }

  _updateCamera(dt) {
    if (!this.started) {
      // Lush cinematic orbit panning over sunny Ocean Drive & beach behind title card
      this.titleOrbit += dt * 0.14;
      const cx = 104 + Math.cos(this.titleOrbit) * 44;
      const cz = 18 + Math.sin(this.titleOrbit) * 52;
      this.camera.position.set(cx, 22, cz);
      this.camera.lookAt(110, 6, -10);
      return;
    }

    // Keyboard camera orbit fallback (Q/E)
    if (this.input.camLeft) this.camYaw += dt * 2.1;
    if (this.input.camRight) this.camYaw -= dt * 2.1;

    const p = this.player;
    let dist = 7.4;
    let height = 2.7;
    let lookY = 1.6;

    if (p.vehicle) {
      const v = p.vehicle;
      const speedRatio = VS.clamp(Math.abs(v.forwardSpeed) / 45, 0, 1);
      dist = 8.8 + speedRatio * 3.0;
      height = 3.2 + speedRatio * 0.8;
      lookY = 1.4;
      // Gently align chase camera behind vehicle heading when driving & not dragging mouse
      if (!this.isDraggingMouse && Math.abs(v.forwardSpeed) > 2.2) {
        // Vehicle forward is (sin(yaw), cos(yaw)), so camera behind it has camYaw = yaw + PI
        const desiredYaw = v.forwardSpeed >= -0.5 ? (v.yaw + Math.PI) : v.yaw;
        this.camYaw += VS.angleDiff(this.camYaw, desiredYaw) * Math.min(1, dt * 3.4);
      }
      this.camera.fov = VS.lerp(this.camera.fov, 60 + speedRatio * 12, Math.min(1, dt * 5));
      this.camera.updateProjectionMatrix();
    } else {
      this.camera.fov = VS.lerp(this.camera.fov, 60, Math.min(1, dt * 5));
      this.camera.updateProjectionMatrix();
    }

    const horiz = Math.cos(this.camPitch) * dist;
    const vert = Math.sin(this.camPitch) * dist + height * 0.55;
    const desiredX = p.x + Math.sin(this.camYaw) * horiz;
    const desiredZ = p.z + Math.cos(this.camYaw) * horiz;
    const desiredY = p.y + vert;

    // Pull camera in slightly if it clips inside a building
    let safeX = desiredX, safeZ = desiredZ;
    for (let s = 1; s >= 0.35; s -= 0.15) {
      const tx = VS.lerp(p.x, desiredX, s);
      const tz = VS.lerp(p.z, desiredZ, s);
      let inside = false;
      for (let i = 0; i < this.world.colliders.length; i++) {
        const b = this.world.colliders[i];
        if (b.height > 2.5 && tx > b.minX - 0.5 && tx < b.maxX + 0.5 && tz > b.minZ - 0.5 && tz < b.maxZ + 0.5) {
          inside = true; break;
        }
      }
      if (!inside) { safeX = tx; safeZ = tz; break; }
    }

    const followLerp = Math.min(1, dt * 11);
    this.camPos.x = VS.lerp(this.camPos.x, safeX, followLerp);
    this.camPos.y = VS.lerp(this.camPos.y, Math.max(1.5, desiredY), followLerp);
    this.camPos.z = VS.lerp(this.camPos.z, safeZ, followLerp);

    let shakeX = 0, shakeY = 0;
    if (this.cameraShake > 0.01) {
      shakeX = (Math.random() - 0.5) * this.cameraShake * 0.8;
      shakeY = (Math.random() - 0.5) * this.cameraShake * 0.8;
      this.cameraShake = Math.max(0, this.cameraShake - dt * 2.8);
    }

    this.camera.position.set(this.camPos.x + shakeX, this.camPos.y + shakeY, this.camPos.z);
    this.camTarget.set(p.x, p.y + lookY, p.z);
    this.camera.lookAt(this.camTarget);
  }

  _loop(now) {
    requestAnimationFrame((t) => this._loop(t));
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    if (this.garageOpen) {
      // Pause world sim cleanly while in garage menu
      this.audio.updateContinuous(dt, { inVehicle: false, rpmNorm: 0, throttle: 0, skidIntensity: 0, sirenProximity: 0 });
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.recoverTimer > 0) {
      this.recoverTimer -= dt;
      if (this.recoverTimer <= 0) this._finishRespawn();
    }

    // Automatic firing for held SMG / vehicle drive-by & tank cannon
    if (this.started) {
      this._saveTick -= dt;
      if (this._saveTick <= 0) {
        this._saveTick = 5.0;
        this.saveGame();
      }
      if (this.input.mouseDown) {
        if (!this.player.vehicle && this.player.attackCooldown <= 0) {
          this.player.performAttack(this, this.getAimYaw());
          this.nudgeCameraToLock(0.10);
        } else if (this.player.vehicle && this.player.performVehicleAttack) {
          this.player.performVehicleAttack(this, this.getAimYaw());
        }
      }
      if (this.input.carFireDown && this.player.vehicle && this.player.performVehicleAttack) {
        this.player.performVehicleAttack(this, this.getAimYaw());
      }
    }

    // Core simulation updates
    this.world.update(dt, this.player.x, this.player.z);

    if (this.started && this.recoverTimer <= 0) {
      this.player.update(dt, this.input, this.camYaw, this.world, this);
      if (this.player.hp <= 0 && !this.player.isDead) {
        this.triggerPlayerDown('WASTED');
      }
    }

    if (this.vehicleManager) this.vehicleManager.update(dt);
    if (this.livingCity) this.livingCity.update(dt);
    if (this.police) this.police.update(dt);
    if (this.missions) this.missions.update(dt);

    // Continuous Procedural Audio Feed
    const v = this.player.vehicle;
    const sirenProx = this.police ? this.police.getNearestSirenProximity() : 0;
    this.audio.updateContinuous(dt, {
      inVehicle: !!v && this.started,
      rpmNorm: v ? v.rpmNorm : 0,
      throttle: v ? (this.input.up ? 1 : 0) : 0,
      baseHz: v ? v.spec.engineBaseHz : 58,
      skidIntensity: v ? v.skidIntensity : 0,
      sirenProximity: this.started ? sirenProx : 0,
      sirenManual: !!(v && v.spec.isPolice && v.sirenOn)
    });

    this._updatePrompts();
    this._updateCamera(dt);
    if (this.started) {
      this.hud.update(dt, this);
      if (this.livingCity && this.livingCity.updateSpeechBubbles) {
        this.livingCity.updateSpeechBubbles(this.camera);
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  new VS.Game();
});
