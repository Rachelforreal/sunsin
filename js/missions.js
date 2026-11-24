// VICE SUN '86 - Interlocking Mission System (5 Replayable Jobs -> Payouts -> Heat)
window.VS = window.VS || {};

VS.MissionSystem = class MissionSystem {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.missionIndex = 0;
    this.completedCount = 0;
    this.enemies = [];
    this.hubMeshes = [];
    this.waypointMesh = null;
    this.waypointRing = null;
    this.targetVehicle = null;
    this.pulseTime = 0;
    this.ownedProperties = {};
    this.propMeshes = [];
    this.incomeTimer = 20;
    this.activeRampage = null; this.rampageMeshes = []; this.completedRampages = {};

    this.definitions = [
      { id: 'ocean_run',        name: 'OCEAN RUN',        nameZh: '海滨走私急送', payout: 600,  desc: 'Grab the contraband case at South Beach Marina, dodge VCPD, and deliver to Club Malibu.' },
      { id: 'hot_wheels',       name: 'HOT WHEELS',       nameZh: '极速盗车单',   payout: 850,  desc: 'Boost the marked Cheetah \'86 near Ocean Drive and deliver it to Sunshine Autos Garage.' },
      { id: 'debt_col',         name: 'DEBT COLLECTION',  nameZh: '街头讨债清算', payout: 750,  desc: 'Clear 3 rival enforcers at Little Havana Plaza and claim the street stash.' },
      { id: 'midnight_ex',      name: 'MIDNIGHT EXPRESS', nameZh: '霓虹午夜狂飙', payout: 1000, desc: 'Blaze through 7 neon checkpoints across Ocean Drive & Downtown before time expires.' },
      { id: 'armored_hit',      name: 'ARMORED HEIST',    nameZh: '劫掠运钞车',   payout: 1200, desc: 'Ram or shoot the rival Cash Van until it drops the loot, then return to Sunshine Autos.' },
      { id: 'skyfall',          name: 'SKYFALL',          nameZh: '苍穹猎杀',     payout: 1600, desc: 'Use your RPG-7 or heavy fire to shoot down the airborne VCPD Armed Chopper!' },
      { id: 'iron_thunder',     name: 'IRON THUNDER',     nameZh: '钢铁惊雷',     payout: 2000, desc: 'Hijack the Military Rhino Tank at Westport Airfield and drive it to Sunshine Autos!' },
      { id: 'kingpin_standoff', name: 'KINGPIN STANDOFF', nameZh: '海湾大决战',   payout: 2600, desc: 'Storm Westport Cargo Airfield and wipe out all 5 cartel kingpin guards!' },
      { id: 'causeway_blitz', name: 'CAUSEWAY BLITZ', nameZh: '跨海大桥狂飙', payout: 1850, desc: 'Blaze across Starfish Causeway to the Island Lighthouse and back before time runs out!' },
      { id: 'lighthouse_raid', name: 'LIGHTHOUSE RAID', nameZh: '海星灯塔清剿', payout: 2400, desc: 'Storm Starfish Lighthouse Island and eliminate all 4 cartel lieutenants!' }
    ];

    this._buildPayphoneHubs();
    this._buildWaypointBeacon();
    this._buildPropertyHubs();
    this._buildRampageHubs();
  }

  _buildPayphoneHubs() {
    const pinkMat = new THREE.MeshBasicMaterial({ color: 0xff2a85, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const colMat = new THREE.MeshBasicMaterial({ color: 0xff2a85, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
    const boothMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });

    for (const hub of VS.CONFIG.MISSION_HUBS) {
      const g = new THREE.Group();
      g.position.set(hub.x, 0, hub.z);

      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.1, 0.5), boothMat);
      post.position.y = 1.05;
      post.castShadow = true;
      g.add(post);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.7), new THREE.MeshBasicMaterial({ color: 0xff4fa3 }));
      cap.position.y = 2.25;
      g.add(cap);

      const ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.75, 24), pinkMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.18;
      g.add(ring);

      const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 9, 16, 1, true), colMat);
      beam.position.y = 4.6;
      g.add(beam);

      this.game.scene.add(g);
      this.hubMeshes.push({ group: g, ring, hub });
    }
  }

  _buildWaypointBeacon() {
    this.waypointGroup = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffdf4d, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    this.waypointRing = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.2, 28), ringMat);
    this.waypointRing.rotation.x = -Math.PI / 2;
    this.waypointRing.position.y = 0.22;
    this.waypointGroup.add(this.waypointRing);

    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffdf4d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
    this.waypointBeam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 34, 18, 1, true), beamMat);
    this.waypointBeam.position.y = 17;
    this.waypointGroup.add(this.waypointBeam);

    this.waypointGroup.visible = false;
    this.game.scene.add(this.waypointGroup);
  }

  _buildPropertyHubs() {
    const props = VS.CONFIG.PROPERTIES || [];
    const signMat = new THREE.MeshLambertMaterial({ color: 0x111827 });

    for (const prop of props) {
      const g = new THREE.Group();
      const propY = (this.game.world && this.game.world.getDeckHeight) ? this.game.world.getDeckHeight(prop.x, prop.z, 0.5) : 0;
      g.position.set(prop.x, propY, prop.z);

      const post = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.9, 0.52), signMat);
      post.position.y = 0.95;
      post.castShadow = true;
      g.add(post);

      const crownMat = new THREE.MeshBasicMaterial({ color: 0x4ef2b8 });
      const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), crownMat);
      crown.position.y = 2.35;
      g.add(crown);

      const ringMat = new THREE.MeshBasicMaterial({ color: 0x4ef2b8, side: THREE.DoubleSide, transparent: true, opacity: 0.88 });
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.35, 3.1, 28), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.2;
      g.add(ring);

      const beamMat = new THREE.MeshBasicMaterial({ color: 0x4ef2b8, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.25, 11, 16, 1, true), beamMat);
      beam.position.y = 5.6;
      g.add(beam);

      this.game.scene.add(g);
      this.propMeshes.push({ group: g, ring, crown, ringMat, beamMat, crownMat, prop });
    }
    this.syncPropertyVisuals();
  }

  syncPropertyVisuals() {
    for (const pm of this.propMeshes) {
      const owned = !!this.ownedProperties[pm.prop.id];
      const hex = owned ? 0xffdf4d : 0x4ef2b8;
      pm.ringMat.color.setHex(hex);
      pm.beamMat.color.setHex(hex);
      pm.crownMat.color.setHex(hex);
      pm.beamMat.opacity = owned ? 0.14 : 0.22;
    }
  }

  getNearbyProperty() {
    const p = this.game.player;
    const props = VS.CONFIG.PROPERTIES || [];
    for (const prop of props) {
      if (!this.ownedProperties[prop.id] && VS.dist2D(p.x, p.z, prop.x, prop.z) < 6.0) {
        return prop;
      }
    }
    return null;
  }

  tryBuyNearbyProperty() {
    const prop = this.getNearbyProperty();
    if (!prop) return false;
    const g = this.game;
    if (g.player.spendCash(prop.price)) {
      this.ownedProperties[prop.id] = true;
      this.syncPropertyVisuals();
      g.audio.playMissionComplete();
      g.hud.showSplash(VS.t('产业收购成功', 'ASSET ACQUIRED'), VS.t(prop.nameZh, prop.name), '#4ef2b8', 2.6);
      g.hud.addFeed(VS.t('已收购「' + prop.nameZh + '」！每 20 秒自动分红 +$' + prop.income, 'Acquired ' + prop.name + '! +$' + prop.income + ' every 20s'), 'money');
      if (g.saveGame) g.saveGame();
      return true;
    }
    g.hud.addFeed(VS.t('现金不足，需要 $' + prop.price + ' 才能收购该产业！', 'Need $' + prop.price + ' to buy this asset!'), 'crime');
    return true;
  }

  _setWaypoint(x, z, colorHex = 0xffdf4d) {
    const wpY = (this.game.world && this.game.world.getDeckHeight) ? this.game.world.getDeckHeight(x, z, 0.5) : 0;
    this.waypointGroup.position.set(x, wpY, z);
    this.waypointRing.material.color.setHex(colorHex);
    this.waypointBeam.material.color.setHex(colorHex);
    this.waypointGroup.visible = true;
    if (this.active) {
      this.active.wpX = x;
      this.active.wpZ = z;
      this.active.wpColor = '#' + colorHex.toString(16).padStart(6, '0');
    }
  }

  _hideWaypoint() {
    this.waypointGroup.visible = false;
  }

  _clearMissionEntities() {
    for (const en of this.enemies) {
      this.game.scene.remove(en.root);
    }
    this.enemies = [];
    if (this.targetVehicle && this.targetVehicle !== this.game.player.vehicle) {
      this.targetVehicle.isMissionTarget = false;
    }
    this.targetVehicle = null;
    this._hideWaypoint();
  }

  _spawnEnemy(x, z, hp = 75) {
    const root = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: 0xe63946 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x1d1e26 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xdfa87e });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.64, 0.28), shirt);
    torso.position.y = 1.05; torso.castShadow = true;
    root.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skin);
    head.position.y = 1.56;
    root.add(head);
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.06), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    shades.position.set(0, 1.58, 0.16);
    root.add(shades);
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.68, 0.2), pants);
    leftLeg.position.set(-0.13, 0.36, 0);
    root.add(leftLeg);
    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.68, 0.2), pants);
    rightLeg.position.set(0.13, 0.36, 0);
    root.add(rightLeg);

    // Floating red target diamond above enemy head
    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: 0xff2a6d }));
    marker.position.y = 2.35;
    root.add(marker);

    root.position.set(x, 0, z);
    this.game.scene.add(root);
    this.enemies.push({
      root, leftLeg, rightLeg, marker,
      x, z, vx: 0, vz: 0, yaw: 0,
      hp, dead: false, deathTimer: 0, stunTimer: 0,
      attackCd: 0.8, walkPhase: 0,
      isCop: false, isEnemy: true
    });
  }

  _buildRampageHubs() {
    for(const r of (VS.CONFIG.RAMPAGES||[])){const group=new THREE.Group();group.position.set(r.x,0,r.z);const mat=new THREE.MeshStandardMaterial({color:0xff6b00,emissive:0xff3b00,emissiveIntensity:1.2});const beacon=new THREE.Mesh(new THREE.OctahedronGeometry(1.1),mat);beacon.position.y=1.5;group.add(beacon);this.game.scene.add(group);this.rampageMeshes.push({group,beacon,r});}
  }
  getNearbyRampage(){if(this.active||this.activeRampage)return null;const p=this.game.player;for(const r of (VS.CONFIG.RAMPAGES||[]))if(VS.dist2D(p.x,p.z,r.x,r.z)<5.2)return r;return null;}
  startRampage(r){const p=this.game.player;this._clearMissionEntities();const savedWeapon=p.weaponId,savedAmmo=p.ammo[r.weaponId]||0,hadWeapon=!!p.ownedWeapons[r.weaponId];p.ownedWeapons[r.weaponId]=true;p.ammo[r.weaponId]=999;p.selectWeapon(r.weaponId);for(let i=0;i<r.targetKills+2;i++){const a=i*Math.PI*2/(r.targetKills+2),d=14+(i%3)*5,c=this.game.world.resolveCircleCollision(r.x+Math.cos(a)*d,r.z+Math.sin(a)*d,.6);this._spawnEnemy(c.x,c.z,100);}this.activeRampage={def:r,kills:0,timer:r.duration,savedWeapon,savedAmmo,hadWeapon};this.game.hud.showSplash(VS.t('狂暴挑战开启','RAMPAGE!'),VS.t(r.nameZh,r.nameEn),'#ff6b00',2.4);this.game.audio.playClick();}
  _finishRampage(won){const a=this.activeRampage;if(!a)return;const p=this.game.player,r=a.def;p.ammo[r.weaponId]=won?Math.max(a.savedAmmo,12):a.savedAmmo;if(!a.hadWeapon)p.ownedWeapons[r.weaponId]=false;if(a.savedWeapon)p.selectWeapon(a.savedWeapon);this._clearMissionEntities();this.activeRampage=null;if(won){this.completedRampages[r.id]=true;p.addCash(r.reward);this.game.audio.playMissionComplete();this.game.hud.showSplash(VS.t('狂暴挑战成功！','RAMPAGE PASSED!'),'+$'+r.reward,'#ff9f1c',2.8);if(this.game.saveGame)this.game.saveGame();}}
  completeRampage(){this._finishRampage(true);}
  onVehicleDestroyed(v){if(this.activeRampage){this.activeRampage.kills++;if(this.activeRampage.kills>=this.activeRampage.def.targetKills)this.completeRampage();}}
  getNearbyPrompt() {
    const prop = this.getNearbyProperty();
    if (prop) {
      return VS.t('收购产业: ' + prop.nameZh + ' ($' + prop.price + ' · 每20秒分红+$' + prop.income + ')', 'Buy Asset: ' + prop.name + ' ($' + prop.price + ' -> +$' + prop.income + '/20s)');
    }
    if (this.active) return null;
    const r=this.getNearbyRampage(); if(r)return VS.t('开启街头狂暴挑战: '+r.nameZh+' (+$'+r.reward+')','Start Street Rampage: '+r.nameEn+' (+$'+r.reward+')');
    const p = this.game.player;
    for (const hub of VS.CONFIG.MISSION_HUBS) {
      if (VS.dist2D(p.x, p.z, hub.x, hub.z) < 5.5) {
        const nextDef = this.definitions[this.missionIndex % this.definitions.length];
        const mName = VS.t(nextDef.nameZh, nextDef.name);
        return VS.t(`接取任务: ${mName} (+$${nextDef.payout + this.completedCount * 50})`, `Start Job: ${mName} (+$${nextDef.payout + this.completedCount * 50})`);
      }
    }
    return null;
  }

  tryStartNearbyMission() {
    if (this.active||this.activeRampage) return false;
    const r=this.getNearbyRampage();if(r){this.startRampage(r);return true;}
    const p = this.game.player;
    for (const hub of VS.CONFIG.MISSION_HUBS) {
      if (VS.dist2D(p.x, p.z, hub.x, hub.z) < 5.5) {
        this.startMission(this.missionIndex % this.definitions.length);
        return true;
      }
    }
    return false;
  }

  startMission(defIdx) {
    this._clearMissionEntities();
    const def = this.definitions[defIdx % this.definitions.length];
    const bonus = this.completedCount * 50;
    const payout = def.payout + bonus;

    this.active = {
      id: def.id,
      name: def.name,
      nameZh: def.nameZh,
      payout,
      stage: 0,
      timer: 0,
      objectiveText: def.desc,
      wpX: 0,
      wpZ: 0,
      wpColor: '#ffdf4d',
      checkpoints: [],
      cpIdx: 0,
      enemiesLeft: 0
    };

    if (def.id === 'ocean_run') {
      this.active.timer = 85;
      this.active.objectiveText = VS.t('驱车前往南部游艇码头，拿走走私手提箱。', 'Drive to South Beach Marina Pier to grab the contraband briefcase.');
      this._setWaypoint(VS.CONFIG.MARINA_POS.x, VS.CONFIG.MARINA_POS.z, 0xffdf4d);
    } else if (def.id === 'hot_wheels') {
      this.active.timer = 90;
      const v = this.game.vehicleManager.spawnVehicle('cheetah', 113.5, -42, Math.PI, 0xffdf4d);
      v.isMissionTarget = true;
      this.targetVehicle = v;
      this.active.objectiveText = VS.t('前往海滨大道北侧，偷走停在路边的金色猎豹超跑！', "Steal the gold Cheetah '86 parked on North Ocean Drive!");
      this._setWaypoint(v.x, v.z, 0xffdf4d);
    } else if (def.id === 'debt_col') {
      this.active.timer = 95;
      const pl = VS.CONFIG.HAVANA_PLAZA;
      this._spawnEnemy(pl.x - 10, pl.z + 8);
      this._spawnEnemy(pl.x + 11, pl.z + 6);
      this._spawnEnemy(pl.x, pl.z - 12);
      this.active.enemiesLeft = 3;
      this.active.objectiveText = VS.t('前往小哈瓦那广场，消灭 3 名敌对打手（剩余 3 人）。', 'Eliminate 3 rival enforcers at Little Havana Plaza (3 left).');
      this._setWaypoint(pl.x, pl.z, 0xff2a6d);
    } else if (def.id === 'midnight_ex') {
      this.active.timer = 80;
      this.active.checkpoints = [
        { x: 120, z: -20 },
        { x: 120, z: -120 },
        { x: 20,  z: -180 },
        { x: -80, z: -80 },
        { x: -80, z: 20 },
        { x: 20,  z: 120 },
        { x: 120, z: 75 }
      ];
      this.active.cpIdx = 0;
      this.active.objectiveText = VS.t('穿越全城 7 个霓虹检查点！(1 / 7)', 'Hit all 7 neon street checkpoints! (1 / 7)');
      this._setWaypoint(this.active.checkpoints[0].x, this.active.checkpoints[0].z, 0x00f0ff);
      if (this.game.police) this.game.police.setMinimumStars(1, VS.t('非法街头飙车', 'Illegal Street Race'));
    } else if (def.id === 'armored_hit') {
      this.active.timer = 105;
      const van = this.game.vehicleManager.spawnVehicle('van', 15.8, -40, 0, 0x1e293b);
      van.aiDriver = true;
      van.laneAxis = 'z';
      van.laneDir = 1;
      van.laneCoord = 15.8;
      van.aiTargetSpeed = 16;
      van.maxHp = 150;
      van.hp = 150;
      van.isMissionTarget = true;
      this.targetVehicle = van;
      this.active.objectiveText = VS.t('拦截敌对运钞车！撞击或扫射将其耐久打到 40% 以下！', 'Intercept & wreck the rival Cash Van (ram or shoot it below 40% HP)!');
      this._setWaypoint(van.x, van.z, 0xff2a6d);
    } else if (def.id === 'skyfall') {
      this.active.timer = 110;
      const g = this.game;
      g.player.ownedWeapons.rpg = true;
      g.player.ammo.rpg = Math.max(g.player.ammo.rpg || 0, 6);
      g.player.selectWeapon('rpg');
      if (g.police) {
        g.police.setMinimumStars(3, VS.t('防空火力挑衅', 'Airspace Threat'));
        g.police.heliRespawnCd = 0;
        if (!g.police.heli && g.police._spawnHeli) g.police._spawnHeli();
      }
      this.active.objectiveText = VS.t('已配发 RPG 火箭筒！瞄准天空击落 VCPD 武装直升机！', 'RPG-7 equipped! Shoot down the airborne VCPD Helicopter!');
      const hx = g.police && g.police.heli ? g.police.heli.x : g.player.x;
      const hz = g.police && g.police.heli ? g.police.heli.z : g.player.z - 40;
      this._setWaypoint(hx, hz, 0xff4d00);
    } else if (def.id === 'iron_thunder') {
      this.active.timer = 130;
      const tank = this.game.vehicleManager.spawnVehicle('tank', -230, 22, 0);
      tank.isMissionTarget = true;
      this.targetVehicle = tank;
      this._spawnEnemy(-225, 25);
      this._spawnEnemy(-235, 25);
      this.active.objectiveText = VS.t('前往西区货运机场，夺取军方重装犀牛坦克！', 'Head to Westport Airfield and hijack the Military Rhino Tank!');
      this._setWaypoint(tank.x, tank.z, 0xffdf4d);
    } else if (def.id === 'causeway_blitz') {
      this.active.timer = 85; this.active.checkpoints = [{x:155,z:-24},{x:214,z:-24},{x:276,z:-24},{x:298,z:-36},{x:276,z:4},{x:155,z:-24}]; this.active.cpIdx=0;
      this.active.objectiveText = VS.t('飞驰冲过跨海大桥与海星岛 6 个检查点！(1 / 6)', 'Hit all 6 Causeway & Island checkpoints! (1 / 6)');
      this._setWaypoint(155, -24, 0x00f0ff);
      if (this.game.police) this.game.police.setMinimumStars(2, VS.t('跨海大桥狂飙', 'Causeway Street Race'));
    } else if (def.id === 'lighthouse_raid') {
      this.active.timer = 120;
      const pts = [[295,-28],[304,-22],[292,-38],[286,-14]];
      for (const [x,z] of pts) {
        const c = this.game.world.resolveCircleCollision(x, z, 0.6);
        this._spawnEnemy(c.x, c.z, 125);
        this.enemies[this.enemies.length - 1].root.position.y = 0.42;
      }
      this.active.enemiesLeft = 4;
      this.active.objectiveText = VS.t('跨越跨海大桥强攻海星岛，歼灭 4 名灯塔庄园头目（剩余 4 人）！', 'Cross Starfish Causeway and eliminate all 4 Lighthouse cartel bosses (4 left)!');
      this._setWaypoint(295, -28, 0xff2a6d);
    } else if (def.id === 'kingpin_standoff') {
      this.active.timer = 125;
      const offsets = [[-10, 6], [10, 6], [-8, -8], [8, -8], [0, 11]];
      for (const [ox, oz] of offsets) {
        const c = this.game.world.resolveCircleCollision(-230 + ox, 15 + oz, 0.6);
        this._spawnEnemy(c.x, c.z, 115);
      }
      this.active.enemiesLeft = 5;
      this.active.objectiveText = VS.t('强攻西区货运机场，歼灭全部 5 名毒枭护卫（剩余 5 人）！', 'Storm Westport Cargo Airfield and wipe out all 5 cartel kingpin guards (5 left)!');
      this._setWaypoint(-230, 15, 0xff2a6d);
    }

    this.game.audio.playClick();
    this.game.hud.addFeed(VS.t(`任务开始: ${def.nameZh}（赏金 $${payout}）`, `JOB STARTED: ${def.name} ($${payout} reward)`), 'money');
  }

  completeActiveMission() {
    if (!this.active) return;
    const payout = this.active.payout;
    const name = VS.t(this.active.nameZh, this.active.name);
    this.game.player.addCash(payout);
    this.completedCount++;
    this.missionIndex++;
    this._clearMissionEntities();
    this.active = null;

    this.game.audio.playMissionComplete();
    this.game.hud.showSplash(VS.t('任务完成', 'MISSION PASSED'), `${name}  +$${payout}`, '#4ef2b8', 3.0);
    this.game.hud.addFeed(VS.t(`赚到 $${payout}！快去阳光车库（蓝标 G）升级座驾吧！`, `Earned $${payout}! Spend it at Sunshine Autos Garage (Cyan G).`), 'money');
    if (this.game.saveGame) this.game.saveGame();
  }

  failActiveMission(reason = 'TIME UP') {
    if(this.activeRampage){this._finishRampage(false);return;}
    if (!this.active) return;
    const name = VS.t(this.active.nameZh, this.active.name);
    this._clearMissionEntities();
    this.active = null;
    this.game.hud.addFeed(VS.t(`任务失败 (${name}): ${reason}`, `Job Failed (${name}): ${reason}`), 'crime');
  }

  onVehicleEntered(v) {
    if (!this.active) return;
    if (this.active.id === 'hot_wheels' && this.active.stage === 0 && v === this.targetVehicle) {
      this.active.stage = 1;
      this.active.objectiveText = VS.t('警报拉响！甩掉警车把超跑开回阳光汽车改装厂！', 'Alarm tripped! Outrun VCPD and deliver the Cheetah to Sunshine Autos Garage!');
      this._setWaypoint(VS.CONFIG.GARAGE_POS.x, VS.CONFIG.GARAGE_POS.z + 2, 0x00f0ff);
      if (this.game.police) this.game.police.setMinimumStars(2, VS.t('高价超跑盗窃', 'High-Value Car Theft'));
    } else if (this.active.id === 'iron_thunder' && this.active.stage === 0 && v === this.targetVehicle) {
      this.active.stage = 1;
      this.active.objectiveText = VS.t('已夺取犀牛坦克！按左键/J/空格可开炮轰击，开回阳光改装厂！', 'Tank hijacked! Left-click/J/Space to fire cannon, deliver to Sunshine Autos!');
      this._setWaypoint(VS.CONFIG.GARAGE_POS.x, VS.CONFIG.GARAGE_POS.z + 2, 0x00f0ff);
      if (this.game.police) this.game.police.setMinimumStars(4, VS.t('军方重装坦克失窃', 'Military Tank Hijacked'));
    }
  }

  onHeliDestroyed() {
    if (this.active && this.active.id === 'skyfall') {
      this.completeActiveMission();
    }
  }

  onVehicleRam(other, impact) {
    if (!this.active || this.active.id !== 'armored_hit' || this.active.stage !== 0) return;
    if (other === this.targetVehicle) {
      other.applyDamage(impact * 2.2, this.game);
    }
  }

  onNPCKilled(npc) {
    if (this.activeRampage && npc.isEnemy) { const a=this.activeRampage; a.kills++; if(a.kills>=a.def.targetKills)this.completeRampage(); else if(this.enemies.filter(e=>!e.dead).length<2) for(let i=0;i<2;i++)this._spawnEnemy(a.def.x+18*Math.cos(i*Math.PI),a.def.z+18*Math.sin(i*Math.PI),100); }
    if (!this.active || (this.active.id !== 'debt_col' && this.active.id !== 'kingpin_standoff' && this.active.id !== 'lighthouse_raid')) return;
    if (npc.isEnemy) {
      this.active.enemiesLeft = Math.max(0, this.active.enemiesLeft - 1);
      if (this.active.enemiesLeft > 0) {
        if (this.active.id === 'kingpin_standoff') {
          this.active.objectiveText = VS.t(`强攻西区货运机场，歼灭毒枭护卫（剩余 ${this.active.enemiesLeft} 人）！`, `Storm Westport Cargo Airfield and wipe out cartel guards (${this.active.enemiesLeft} left)!`);
        } else if (this.active.id === 'lighthouse_raid') {
          this.active.objectiveText = VS.t(`清剿海星岛灯塔庄园头目（剩余 ${this.active.enemiesLeft} 人）！`, `Eliminate Starfish Lighthouse cartel bosses (${this.active.enemiesLeft} left)!`);
        } else {
          this.active.objectiveText = VS.t(`消灭小哈瓦那广场的敌对打手（剩余 ${this.active.enemiesLeft} 人）。`, `Eliminate rival enforcers at Little Havana Plaza (${this.active.enemiesLeft} left).`);
        }
      } else {
        this.completeActiveMission();
      }
    }
  }

  getHUDState() {
    if (this.activeRampage) { const a=this.activeRampage,r=a.def,sec=Math.max(0,Math.ceil(a.timer)); return {title:VS.t('狂暴: '+r.nameZh,'RAMPAGE: '+r.nameEn),desc:VS.t('限时歼灭目标: '+a.kills+' / '+r.targetKills,'Targets eliminated: '+a.kills+' / '+r.targetKills),timerText:String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}; }
    if (!this.active) {
      const nextDef = this.definitions[this.missionIndex % this.definitions.length];
      const mName = VS.t(nextDef.nameZh, nextDef.name);
      return {
        title: VS.t('自由漫游', 'FREE ROAM'),
        desc: VS.t(`前往粉色电话亭 [M] 接单「${mName}」(+$${nextDef.payout + this.completedCount * 50})，或去车库 [G] 改装。`, `Head to any pink Payphone [M] for "${nextDef.name}" (+$${nextDef.payout + this.completedCount * 50}) or visit Garage [G].`),
        timerText: null
      };
    }
    const sec = Math.max(0, Math.ceil(this.active.timer));
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    const mName = VS.t(this.active.nameZh, this.active.name);
    return {
      title: VS.t(`任务: ${mName} ($${this.active.payout})`, `JOB: ${this.active.name} ($${this.active.payout})`),
      desc: this.active.objectiveText,
      timerText: `${mm}:${ss}`
    };
  }

  getRadarBlips() {
    if (this.active) {
      return [{ x: this.active.wpX, z: this.active.wpZ, color: this.active.wpColor || '#ffdf4d', label: '!' }];
    }
    const blips = VS.CONFIG.MISSION_HUBS.map((h) => ({ x: h.x, z: h.z, color: '#ff4fa3', label: 'M' }));
    for(const r of (VS.CONFIG.RAMPAGES||[]))blips.push({x:r.x,z:r.z,color:'#ff9f1c',label:'R'});
    for (const pr of (VS.CONFIG.PROPERTIES || [])) {
      blips.push({
        x: pr.x,
        z: pr.z,
        color: this.ownedProperties[pr.id] ? '#ffdf4d' : '#4ef2b8',
        label: '$'
      });
    }
    return blips;
  }

  update(dt) {
    this.pulseTime += dt;
    const g = this.game;

    if (g.started) {
      this.incomeTimer -= dt;
      if (this.incomeTimer <= 0) {
        this.incomeTimer = 20;
        let total = 0;
        for (const pr of (VS.CONFIG.PROPERTIES || [])) {
          if (this.ownedProperties[pr.id]) total += pr.income;
        }
        if (total > 0) {
          g.player.addCash(total);
          g.audio.playCash();
          g.hud.addFeed(VS.t('名下产业分红到账 +$' + total, 'Empire Asset Dividend +$' + total), 'money');
          if (g.saveGame) g.saveGame();
        }
      }
    }

    for (const pm of this.propMeshes) {
      const sc = 1 + Math.sin(this.pulseTime * 3.6) * 0.08;
      pm.ring.scale.set(sc, sc, 1);
      pm.crown.rotation.y += dt * 2.2;
    }

    // Pulse payphone rings when in free roam
    for (const hm of this.hubMeshes) {
      hm.group.visible = !this.active;
      const sc = 1 + Math.sin(this.pulseTime * 4) * 0.08;
      hm.ring.scale.set(sc, sc, 1);
    }

    for(const rm of this.rampageMeshes){rm.group.visible=!this.active&&!this.activeRampage;rm.beacon.rotation.y+=dt*1.5;rm.beacon.scale.setScalar(1+Math.sin(this.pulseTime*4)*.1);}
    if (this.waypointGroup.visible) {
      const sc = 1 + Math.sin(this.pulseTime * 5) * 0.1;
      this.waypointRing.scale.set(sc, sc, 1);
    }

    // Update active mission enemies
    const p = g.player;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      if (en.dead) {
        en.deathTimer -= dt;
        en.root.rotation.x = Math.PI / 2;
        const deckY = g.world.getDeckHeight ? g.world.getDeckHeight(en.x, en.z, 0.5) : 0;
        en.root.position.set(en.x, deckY + 0.25, en.z);
        en.marker.visible = false;
        continue;
      }
      en.marker.rotation.y += dt * 3;
      const d = VS.dist2D(en.x, en.z, p.x, p.z);
      if (en.stunTimer > 0) {
        en.stunTimer -= dt;
        en.vx *= Math.pow(0.06, dt);
        en.vz *= Math.pow(0.06, dt);
      } else if (d < 42) {
        const ang = Math.atan2(p.x - en.x, p.z - en.z);
        en.yaw = ang;
        const spd = d > 2.4 ? 4.8 : 0;
        en.vx = Math.sin(ang) * spd;
        en.vz = Math.cos(ang) * spd;
        en.attackCd -= dt;
        if (en.attackCd <= 0 && !p.isDead) {
          if (d < 2.5 && !p.vehicle) {
            en.attackCd = 0.9;
            p.takeDamage(11);
            g.audio.playPunch(true);
            g.addCameraShake(0.18);
          } else if (d < 20 && g.world.hasLineOfSight(en.x, en.z, p.x, p.z)) {
            en.attackCd = 1.45;
            p.spawnTracer(en.x, 1.3, en.z, p.x + VS.rand(-1, 1), 1.2, p.z + VS.rand(-1, 1), 0xff4fa3);
            g.audio.playGunshot(false);
            if (Math.random() < 0.4) {
              if (p.vehicle) p.vehicle.applyDamage(7, g);
              else p.takeDamage(8);
            }
          }
        }
      } else {
        en.vx *= 0.85; en.vz *= 0.85;
      }

      const col = g.world.resolveCircleCollision(en.x + en.vx * dt, en.z + en.vz * dt, 0.45);
      en.x = col.x; en.z = col.z;

      if (p.vehicle && VS.dist2D(en.x, en.z, p.vehicle.x, p.vehicle.z) < 2.2 && Math.hypot(p.vehicle.vx, p.vehicle.vz) > 4.5) {
        g.damageNPC(en, 85, p.vehicle.vx, p.vehicle.vz, 'vehicle');
        g.audio.playCrash(0.35);
      }

      en.walkPhase += dt * Math.hypot(en.vx, en.vz) * 2.4;
      const sw = Math.sin(en.walkPhase) * 0.6;
      en.leftLeg.rotation.x = sw;
      en.rightLeg.rotation.x = -sw;
      const deckY = g.world.getDeckHeight ? g.world.getDeckHeight(en.x, en.z, 0.5) : 0;
      en.root.position.set(en.x, deckY, en.z);
      en.root.rotation.y = en.yaw;
    }

    if(this.activeRampage){this.activeRampage.timer-=dt;g.player.ammo[this.activeRampage.def.weaponId]=999;if(this.activeRampage.timer<=0){this._finishRampage(false);g.hud.addFeed(VS.t('狂暴挑战超时失败！','RAMPAGE FAILED: TIME EXPIRED'),'crime');}return;}
    if (!this.active) return;

    // Mission countdown timer
    this.active.timer -= dt;
    if (this.active.timer <= 0) {
      this.failActiveMission(VS.t('任务超时', 'TIME EXPIRED'));
      return;
    }

    const a = this.active;
    const distToWp = VS.dist2D(p.x, p.z, a.wpX, a.wpZ);

    if (a.id === 'causeway_blitz') {
      if (distToWp < 8.5) {
        a.cpIdx++;
        if (a.cpIdx >= a.checkpoints.length) this.completeActiveMission();
        else {
          const cp = a.checkpoints[a.cpIdx];
          a.objectiveText = VS.t(`飞驰冲过跨海大桥与海星岛检查点！(${a.cpIdx + 1} / 6)`, `Hit all 6 Causeway & Island checkpoints! (${a.cpIdx + 1} / 6)`);
          this._setWaypoint(cp.x, cp.z, 0x00f0ff);
        }
      }
    } else if (a.id === 'lighthouse_raid') {
      if(a.enemiesLeft<=0)this.completeActiveMission();
    } else if (a.id === 'ocean_run') {
      if (a.stage === 0 && distToWp < 6.5) {
        a.stage = 1;
        a.objectiveText = VS.t('遭到埋伏！把走私品送到北海滩马里布俱乐部！', 'Ambush! Deliver the contraband to Club Malibu (North Beach)!');
        this._setWaypoint(VS.CONFIG.CLUB_MALIBU.x + 12, VS.CONFIG.CLUB_MALIBU.z + 18, 0x00f0ff);
        g.audio.playCash();
        if (g.police) g.police.setMinimumStars(2, VS.t('走私交易暴露', 'Smuggling Bust'));
      } else if (a.stage === 1 && distToWp < 7.5) {
        this.completeActiveMission();
      }
    } else if (a.id === 'hot_wheels') {
      if (a.stage === 0 && this.targetVehicle) {
        if (this.targetVehicle.destroyed) { this.failActiveMission(VS.t('目标车辆被毁', 'TARGET CAR DESTROYED')); return; }
        this._setWaypoint(this.targetVehicle.x, this.targetVehicle.z, 0xffdf4d);
      } else if (a.stage === 1) {
        if (this.targetVehicle && this.targetVehicle.destroyed) { this.failActiveMission(VS.t('目标车辆被毁', 'TARGET CAR DESTROYED')); return; }
        if (p.vehicle === this.targetVehicle && distToWp < 8.5) {
          this.completeActiveMission();
        }
      }
    } else if (a.id === 'midnight_ex') {
      if (distToWp < 8.5) {
        g.audio.playCash();
        a.cpIdx++;
        if (a.cpIdx >= a.checkpoints.length) {
          this.completeActiveMission();
        } else {
          const cp = a.checkpoints[a.cpIdx];
          a.objectiveText = VS.t(`穿越全城 7 个霓虹检查点！(${a.cpIdx + 1} / ${a.checkpoints.length})`, `Hit all 7 neon street checkpoints! (${a.cpIdx + 1} / ${a.checkpoints.length})`);
          this._setWaypoint(cp.x, cp.z, 0x00f0ff);
        }
      }
    } else if (a.id === 'armored_hit') {
      if (a.stage === 0 && this.targetVehicle) {
        this._setWaypoint(this.targetVehicle.x, this.targetVehicle.z, 0xff2a6d);
        if (this.targetVehicle.hp < this.targetVehicle.maxHp * 0.42 || this.targetVehicle.destroyed) {
          a.stage = 1;
          a.objectiveText = VS.t('抢到钞袋！火速送回阳光汽车改装厂！', 'Loot secured! Deliver the heist bag to Sunshine Autos Garage!');
          this._setWaypoint(VS.CONFIG.GARAGE_POS.x, VS.CONFIG.GARAGE_POS.z + 2, 0x4ef2b8);
          g.audio.playCash();
          if (g.police) g.police.setMinimumStars(3, VS.t('劫掠运钞车', 'Armored Van Heist'));
        }
      } else if (a.stage === 1 && distToWp < 8.5) {
        this.completeActiveMission();
      }
    } else if (a.id === 'skyfall') {
      if (g.police?.heli) {
        this._setWaypoint(g.police.heli.x, g.police.heli.z, 0xff4d00);
      }
    } else if (a.id === 'iron_thunder') {
      if (this.targetVehicle && this.targetVehicle.destroyed) {
        this.failActiveMission(VS.t('目标坦克被毁', 'TARGET TANK DESTROYED'));
        return;
      }
      if (a.stage === 0 && this.targetVehicle) {
        this._setWaypoint(this.targetVehicle.x, this.targetVehicle.z, 0xffdf4d);
      } else if (a.stage === 1 && p.vehicle === this.targetVehicle && distToWp < 9.5) {
        this.completeActiveMission();
      }
    }
  }
};
