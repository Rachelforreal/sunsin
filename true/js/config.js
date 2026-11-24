// VICE SUN '86 - Shared Configuration, World Layout, Localization & Archetypes
window.VS = window.VS || {};

VS.lang = 'zh';
VS.t = (zh, en) => (VS.lang === 'zh' ? zh : en);
VS.vehName = (spec) => (VS.lang === 'zh' && spec.nameZh ? spec.nameZh : spec.name);
VS.wpnName = (w) => (VS.lang === 'zh' && w.nameZh ? w.nameZh : w.name);

VS.CONFIG = {
  WORLD_HALF: 360, // expanded playable city from -340..+188 on X, -340..+300 on Z
  ROAD_WIDTH: 18,
  SIDEWALK_WIDTH: 5,
  // Road centerlines on X (North-South avenues) and Z (East-West cross streets)
  // X = 120 is Ocean Drive (runs right alongside the beach!)
  AVENUE_X: [-280, -180, -80, 20, 120],
  STREET_Z: [-280, -180, -80, 20, 120, 220],
  BEACH_X_START: 136,
  OCEAN_X_START: 182,

  // Key Landmarks
  GARAGE_POS: { x: -126, z: 72 },       // Sunshine Autos Garage (South-West district)
  GARAGE_SPAWN: { x: -126, z: 96, yaw: 0 },
  HOSPITAL_POS: { x: -24, z: -130 },    // Ocean View Hospital
  PRECINCT_POS: { x: -130, z: -130 },   // VCPD Downtown Precinct
  CLUB_MALIBU: { x: 86, z: -128 },      // Neon nightclub north of Ocean Drive
  MARINA_POS: { x: 146, z: 142 },       // South Beach Marina Pier
  HAVANA_PLAZA: { x: -28, z: 70 },      // Little Havana Plaza

  // Mission Payphone Hubs (start points when in Free Roam)
  MISSION_HUBS: [
    { x: 104, z: 36, name: 'Ocean Drive Payphone' },
    { x: -70, z: 36, name: 'Little Havana Booth' },
    { x: 34, z: -64, name: 'Downtown Plaza Phone' }
  ],

  // Day-Night Cycle: 1 full day = 220 real seconds (~3.6 mins), starts at 13:30 sunny afternoon
  DAY_DURATION_SEC: 220,
  START_HOUR: 13.5,

  // Vehicle Archetypes (Reinforced chassis durability for fun arcade mayhem)
  VEHICLES: {
    cheetah: {
      id: 'cheetah',
      name: "Cheetah '86",
      nameZh: '猎豹 \'86 超跑',
      style: 'supercar',
      length: 4.5, width: 2.05, height: 1.18,
      mass: 1280,
      maxSpeed: 54,        // m/s (~120 mph)
      engineForce: 34,
      brakeForce: 42,
      grip: 8.4,
      driftGrip: 2.6,
      turnRate: 2.65,
      maxHp: 320,
      gearRatios: [3.4, 2.25, 1.62, 1.22, 0.94],
      colors: [0xff2a6d, 0xfff5e4, 0xffd23f, 0x00e5ff, 0xff5a36],
      engineBaseHz: 68
    },
    sabre: {
      id: 'sabre',
      name: 'Sabre Turbo',
      nameZh: '军刀涡轮肌肉车',
      style: 'muscle',
      length: 4.8, width: 2.02, height: 1.36,
      mass: 1580,
      maxSpeed: 46,
      engineForce: 30,
      brakeForce: 36,
      grip: 7.2,
      driftGrip: 2.1,
      turnRate: 2.45,
      maxHp: 380,
      gearRatios: [3.2, 2.15, 1.52, 1.14, 0.88],
      colors: [0x2ec4b6, 0xe71d36, 0xff9f1c, 0x3a86ff, 0x22222b],
      engineBaseHz: 52
    },
    oceanic: {
      id: 'oceanic',
      name: 'Oceanic Cruiser',
      nameZh: '海洋复古轿车',
      style: 'sedan',
      length: 4.9, width: 2.0, height: 1.45,
      mass: 1650,
      maxSpeed: 39,
      engineForce: 23,
      brakeForce: 32,
      grip: 7.5,
      driftGrip: 2.7,
      turnRate: 2.25,
      maxHp: 360,
      gearRatios: [3.1, 2.05, 1.45, 1.08, 0.85],
      colors: [0x72efdd, 0xff99c8, 0xfefae0, 0x8ecae6, 0xf4a261],
      engineBaseHz: 58
    },
    van: {
      id: 'van',
      name: 'Rumpo Van',
      nameZh: '重型厢式货车',
      style: 'van',
      length: 5.3, width: 2.18, height: 2.1,
      mass: 2450,
      maxSpeed: 33,
      engineForce: 19,
      brakeForce: 27,
      grip: 6.8,
      driftGrip: 2.9,
      turnRate: 1.9,
      maxHp: 480,
      gearRatios: [3.5, 2.3, 1.58, 1.15, 0.9],
      colors: [0xf1faee, 0x457b9d, 0xe9c46a, 0xd62828],
      engineBaseHz: 44
    },
    police: {
      id: 'police',
      name: 'VCPD Cruiser',
      nameZh: 'VCPD 警用巡逻车',
      style: 'police',
      length: 4.95, width: 2.04, height: 1.48,
      mass: 1750,
      maxSpeed: 48,
      engineForce: 31,
      brakeForce: 38,
      grip: 8.2,
      driftGrip: 2.6,
      turnRate: 2.5,
      maxHp: 360,
      gearRatios: [3.3, 2.2, 1.55, 1.16, 0.9],
      colors: [0x1b2432],
      engineBaseHz: 56,
      isPolice: true
    },
    infernus: {
      id: 'infernus',
      name: 'Infernus Vice',
      nameZh: '炼狱罪恶原型车',
      style: 'supercar',
      length: 4.65, width: 2.12, height: 1.12,
      mass: 1220,
      maxSpeed: 62,
      engineForce: 40,
      brakeForce: 46,
      grip: 9.2,
      driftGrip: 2.5,
      turnRate: 2.8,
      maxHp: 420,
      gearRatios: [3.5, 2.35, 1.7, 1.28, 0.96],
      colors: [0x00f0ff],
      engineBaseHz: 76,
      underglow: 0xff2a85
    },
    tank: {
      id: 'tank',
      name: 'Rhino Tank',
      nameZh: '军方犀牛坦克',
      style: 'tank',
      length: 6.1, width: 3.1, height: 2.2,
      mass: 6800,
      maxSpeed: 22,
      engineForce: 18,
      brakeForce: 30,
      grip: 9.5,
      driftGrip: 6.5,
      turnRate: 1.65,
      maxHp: 1400,
      gearRatios: [3.6, 2.5, 1.8, 1.35, 1.05],
      colors: [0x4a5d3b],
      engineBaseHz: 36,
      isPolice: true,
      isTank: true
    }
  },

  // Purchasable Empire Properties (GTA Vice City endgame assets -> passive income)
  PROPERTIES: [
    { id: 'prop_malibu',   x: 96,   z: -112, price: 2200, income: 180, name: 'Club Malibu Asset',       nameZh: '马里布夜总会产业' },
    { id: 'prop_marina',   x: 142,  z: 132,  price: 2800, income: 240, name: 'South Beach Yacht Club',   nameZh: '南滩游艇码头产业' },
    { id: 'prop_airfield', x: -206, z: 18,   price: 3600, income: 320, name: 'Westport Cargo Airfield',  nameZh: '西区货运机场产业' },
    { id: 'prop_island',   x: 284,  z: -18,  price: 4500, income: 420, name: 'Starfish Lighthouse Villa', nameZh: '海星岛灯塔庄园产业' }
  ],

  // 10 Hidden Neon Tiki Packages across landmarks (Endgame exploration & permanent perks)
  HIDDEN_PACKAGES: [
    { id: 'pkg_0', x: 158,  y: 0,   z: 142,  hintZh: '南滩游艇码头栈桥尽头',   hintEn: 'Marina Pier Tip' },
    { id: 'pkg_1', x: 92,   y: 0,   z: -117, hintZh: '马里布俱乐部 VIP 吧台前', hintEn: 'Club Malibu VIP Bar' },
    { id: 'pkg_2', x: -258, y: 0,   z: 20,   hintZh: '西区机场货运机库深处',   hintEn: 'Westport Cargo Hangar' },
    { id: 'pkg_3', x: 86,   y: 0.6, z: -230, hintZh: '北湾海岸直升机停机坪',   hintEn: 'North Bay Helipad' },
    { id: 'pkg_4', x: -21,  y: 0,   z: 70,   hintZh: '小哈瓦那中心喷泉广场旁', hintEn: 'Havana Fountain Plaza' },
    { id: 'pkg_5', x: -126, y: 0,   z: 56,   hintZh: '阳光车行后巷角落',       hintEn: 'Behind Sunshine Autos' },
    { id: 'pkg_6', x: -12,  y: 4.2, z: -12,  hintZh: '市中心立体停车场二层顶棚', hintEn: 'Downtown Parking Roof Deck' },
    { id: 'pkg_7', x: 302,  y: 0.4, z: -38,  hintZh: '海星岛灯塔脚下',         hintEn: 'Starfish Island Lighthouse' },
    { id: 'pkg_8', x: 168,  y: 0,   z: -24,  hintZh: '跨海大桥起点沙滩桥头',   hintEn: 'Causeway Beachhead' },
    { id: 'pkg_9', x: -130, y: 0,   z: -112, hintZh: 'VCPD 警局正门台阶前',    hintEn: 'VCPD Precinct Steps' }
  ],

  // Repeatable Street Rampage Challenges (30s intense combat challenges)
  RAMPAGES: [
    { id: 'ramp_havana',   x: -44,  z: 84,  weaponId: 'shotgun', targetKills: 6, duration: 32, reward: 950,  nameZh: '小哈瓦那霰弹狂飙', nameEn: 'Havana Shotgun Rampage' },
    { id: 'ramp_westport', x: -218, z: -38, weaponId: 'rpg',     targetKills: 5, duration: 35, reward: 1300, nameZh: '西区机场火箭狂轰', nameEn: 'Airfield RPG Rampage' }
  ],

  WEAPONS: {
    fists:   { id: 'fists',   slot: 1, name: 'FISTS',        nameZh: '赤手空拳',     type: 'melee',   damage: 26, range: 2.4,  cooldown: 0.32 },
    bat:     { id: 'bat',     slot: 2, name: 'NEON BAT',     nameZh: '霓虹棒球棍',   type: 'melee',   damage: 52, range: 3.1,  cooldown: 0.38, cleave: true },
    pistol:  { id: 'pistol',  slot: 3, name: '9MM PISTOL',   nameZh: '9mm 手枪',     type: 'gun',     damage: 34, range: 48,   cooldown: 0.30, spread: 0.024, color: 0xffe066 },
    smg:     { id: 'smg',     slot: 4, name: 'MAC-10 SMG',   nameZh: 'MAC-10 冲锋枪', type: 'gun',     damage: 21, range: 42,   cooldown: 0.11, spread: 0.055, color: 0xff85c0 },
    shotgun: { id: 'shotgun', slot: 5, name: 'PUMP SHOTGUN', nameZh: '泵动霰弹枪',    type: 'shotgun', damage: 22, pellets: 6,  range: 24, cooldown: 0.68, spread: 0.14, color: 0xffb703 },
    rpg:     { id: 'rpg',     slot: 6, name: 'RPG-7',        nameZh: 'RPG 火箭筒',    type: 'rocket',  damage: 260, range: 95,  cooldown: 1.35, blastRadius: 8.5, color: 0xff4d00 }
  }
};

// Utility helpers
VS.clamp = (v, min, max) => Math.max(min, Math.min(max, v));
VS.lerp = (a, b, t) => a + (b - a) * t;
VS.dist2D = (ax, az, bx, bz) => Math.hypot(bx - ax, bz - az);
VS.angleDiff = (a, b) => {
  let d = (b - a + Math.PI) % (Math.PI * 2);
  if (d < 0) d += Math.PI * 2;
  return d - Math.PI;
};
VS.rand = (min, max) => min + Math.random() * (max - min);
VS.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

VS.getDistrictName = function (x, z) {
  if (x > 188) return VS.t('跨海大桥 · 海星灯塔岛', 'STARFISH BRIDGE & ISLAND');
  if (x > 134) return VS.t('罪恶海滩 · 游艇码头', 'VICE BEACH & MARINA');
  if (z < -190) return VS.t('北湾度假大道', 'NORTH BAY RESORTS');
  if (z > 135) return VS.t('南湾海滨新区', 'SOUTH BAY BOULEVARD');
  if (x < -190) return VS.t('西区工业港', 'WESTPORT INDUSTRIAL');
  if (x > 65 && z < -60) return VS.t('北海滩 · 马里布俱乐部', 'NORTH BEACH / CLUB MALIBU');
  if (x > 65) return VS.t('海滨大道', 'OCEAN DRIVE');
  if (x < -80 && z > 20) return VS.t('阳光车行改装区', 'SUNSHINE GARAGE DISTRICT');
  if (z > 20) return VS.t('小哈瓦那', 'LITTLE HAVANA');
  if (x < -75 && z < -60) return VS.t('VCPD 警局 · 城市西区', 'VCPD PRECINCT / DOWNTOWN WEST');
  return VS.t('迈阿密市中心', 'DOWNTOWN MIAMI');
};
