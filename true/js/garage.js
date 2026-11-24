// VICE SUN '86 - Sunshine Autos Garage: Pay & Spray, Upgrades, Street Armory & Dream Cars
window.VS = window.VS || {};

VS.GarageSystem = class GarageSystem {
  constructor(game) {
    this.game = game;
    this.modal = document.getElementById('garage-modal');
    this.body = document.getElementById('garage-body');
    this.cashEl = document.getElementById('garage-cash');

    document.getElementById('garage-close').addEventListener('click', () => this.close());
    const resetBtn = document.getElementById('garage-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (this.game.resetSave) this.game.resetSave();
      });
    }
    this.modal.addEventListener('click', (e) => { if (e.target === this.modal) this.close(); });
  }

  isPlayerInBay() {
    const gPos = VS.CONFIG.GARAGE_POS;
    return VS.dist2D(this.game.player.x, this.game.player.z, gPos.x, gPos.z + 2) < 9.5;
  }

  open() {
    this.game.garageOpen = true;
    // Release held movement keys so car doesn't run away on resume
    Object.keys(this.game.input).forEach((k) => { this.game.input[k] = false; });
    this.render();
    this.modal.style.display = 'flex';
    this.game.audio.playClick();
  }

  close() {
    this.game.garageOpen = false;
    this.modal.style.display = 'none';
    this.game.audio.playClick();
  }

  render() {
    const p = this.game.player;
    const pol = this.game.police;
    this.cashEl.textContent = '$' + p.cash.toLocaleString();
    const ms = this.game.missions;
    const progress = `<div class="garage-section" style="border:1px solid rgba(0,240,255,.35);padding:10px;margin-bottom:12px"><h3>${VS.t('帝国进度', 'EMPIRE PROGRESS')}</h3><div>${VS.t('任务', 'Missions')}: ${ms ? ms.completedCount : 0} | ${VS.t('产业', 'Assets')}: ${ms ? Object.keys(ms.ownedProperties || {}).length : 0}/4 | ${VS.t('图腾', 'Packages')}: ${Object.keys(this.game.collectedPackages || {}).length}/10 | ${VS.t('特技跳跃', 'Stunts')}: ${Object.keys(this.game.completedStunts || {}).length}/7 | ${VS.t('暴走', 'Rampages')}: ${Object.keys(ms && ms.completedRampages || {}).length}/2</div></div>`;

    const engPrices = [400, 800, 1400];
    const turPrices = [350, 700, 1200];
    const armPrices = [400, 800, 1300];

    const sections = [
      {
        title: VS.t('喷漆修车 / 消除通缉', 'PAY & SPRAY / HEAT CLEAR'),
        items: [
          {
            id: 'respray',
            title: VS.t('极速喷漆 & 车身全修', 'Pay & Spray Service'),
            desc: p.vehicle
              ? VS.t(`瞬间修复 ${VS.vehName(p.vehicle.spec)}、换上迈阿密新涂装，并立刻清除所有通缉星。`, `Repair ${p.vehicle.spec.name}, fresh Miami paint, and instantly clear all Wanted Stars.`)
              : VS.t('乔装换装、恢复 100% 生命值，并立刻清除所有通缉星。', 'Change disguise, heal to 100% HP, and clear all Wanted Stars.'),
            price: 200,
            btnLabel: pol && pol.wantedStars > 0 ? VS.t('立即消星 ($200)', 'DROP HEAT ($200)') : VS.t('喷漆修复 ($200)', 'RESPRAY & REPAIR ($200)')
          }
        ]
      },
      {
        title: VS.t('全车性能改装（对所有座驾生效）', 'PERFORMANCE TUNING (APPLIES TO ALL RIDES)'),
        items: [
          {
            id: 'upg_engine',
            title: VS.t(`引擎强化 (Lv ${p.upgrades.engine}/3)`, `Engine Tune (Lv ${p.upgrades.engine}/3)`),
            desc: VS.t('提升马力、起步提速，每级额外增加 11% 极速。', 'Higher horsepower, faster acceleration & +11% top speed per tier.'),
            price: p.upgrades.engine < 3 ? engPrices[p.upgrades.engine] : 0,
            maxed: p.upgrades.engine >= 3
          },
          {
            id: 'upg_turbo',
            title: VS.t(`涡轮 & 漂移胎 (Lv ${p.upgrades.turbo}/3)`, `Turbo & Drift Tires (Lv ${p.upgrades.turbo}/3)`),
            desc: VS.t('更稳过弯抓地力、换挡泄压阀音效，2级解锁霓虹底盘灯。', 'Sharper corner grip, turbo blowoff audio on shifts, + neon underglow at Lv 2.'),
            price: p.upgrades.turbo < 3 ? turPrices[p.upgrades.turbo] : 0,
            maxed: p.upgrades.turbo >= 3
          },
          {
            id: 'upg_armor',
            title: VS.t(`防撞装甲底盘 (Lv ${p.upgrades.armor}/3)`, `Reinforced Chassis (Lv ${p.upgrades.armor}/3)`),
            desc: VS.t('大幅降低撞击与子弹伤害，撞警车更霸道。', 'Reduces crash/bullet damage and adds ramming weight against VCPD.'),
            price: p.upgrades.armor < 3 ? armPrices[p.upgrades.armor] : 0,
            maxed: p.upgrades.armor >= 3
          }
        ]
      },
      {
        title: VS.t('街头军火 & 防护装备', 'STREET ARMORY & GEAR'),
        items: [
          {
            id: 'wpn_pistol',
            title: VS.t('9mm 手枪弹药 (+36 发)', '9mm Pistol (+36 rds)'),
            desc: VS.t('精准可靠的半自动手枪，按 [3] 键装备。', 'Reliable semi-auto sidearm. Press [3] to equip.'),
            price: p.ownedWeapons.pistol ? 120 : 300,
            btnLabel: p.ownedWeapons.pistol ? VS.t('补充 36 发 ($120)', 'BUY 36 RDS ($120)') : VS.t('购买手枪 ($300)', 'BUY PISTOL ($300)')
          },
          {
            id: 'wpn_smg',
            title: VS.t('MAC-10 冲锋枪弹药 (+90 发)', 'MAC-10 SMG (+90 rds)'),
            desc: VS.t('80年代高射速冲锋枪，扫射爽快，按 [4] 键装备。', 'High rate-of-fire 80s submachine gun. Press [4] to equip.'),
            price: p.ownedWeapons.smg ? 180 : 750,
            btnLabel: p.ownedWeapons.smg ? VS.t('补充 90 发 ($180)', 'BUY 90 RDS ($180)') : VS.t('购买冲锋枪 ($750)', 'BUY MAC-10 ($750)')
          },
          {
            id: 'wpn_shotgun',
            title: VS.t('泵动霰弹枪 (+16 发)', 'Pump Shotgun (+16 shells)'),
            desc: VS.t('近战 6 弹丸重型散射火力，按 [5] 键装备。', 'Heavy 6-pellet close-range scattergun. Press [5] to equip.'),
            price: p.ownedWeapons.shotgun ? 160 : 450,
            btnLabel: p.ownedWeapons.shotgun ? VS.t('补充 16 发 ($160)', 'BUY 16 SHELLS ($160)') : VS.t('购买霰弹枪 ($450)', 'BUY SHOTGUN ($450)')
          },
          {
            id: 'wpn_rpg',
            title: VS.t('RPG 火箭筒 (+5 发)', 'RPG-7 Launcher (+5 rockets)'),
            desc: VS.t('反载具与防空高爆重武器，按 [6] 键装备。', 'Explosive anti-vehicle & anti-air launcher. Press [6] to equip.'),
            price: p.ownedWeapons.rpg ? 320 : 900,
            btnLabel: p.ownedWeapons.rpg ? VS.t('补充 5 发 ($320)', 'BUY 5 ROCKETS ($320)') : VS.t('购买火箭筒 ($900)', 'BUY RPG-7 ($900)')
          },
          {
            id: 'gear_vest',
            title: VS.t('凯夫拉防弹衣 + 急救包', 'Kevlar Vest + Medkit'),
            desc: VS.t('立刻补满 100% 护甲和 100% 生命值。', 'Refills 100% Armor and 100% Health.'),
            price: 220,
            btnLabel: VS.t('立即穿戴 ($220)', 'EQUIP ($220)')
          }
        ]
      },
      {
        title: VS.t('展厅梦想豪车（直接提车到街头）', 'SHOWROOM DREAM RIDES (DELIVERED TO DRIVEWAY)'),
        items: [
          {
            id: 'car_sabre',
            title: VS.t('军刀涡轮肌肉车', 'Sabre Turbo Muscle'),
            desc: VS.t('重型 V8 扭矩、绵长拉烟漂移，经典迈阿密肌肉猛兽。', 'Heavy V8 torque, long smoky drifts, classic Miami muscle.'),
            price: 500,
            owned: !!p.unlockedCars.sabre
          },
          {
            id: 'car_cheetah',
            title: VS.t("猎豹 '86 超跑", "Cheetah '86 Supercar"),
            desc: VS.t('犀利楔形车身，轻松甩开四星拦截警队。', 'Razor-sharp wedge exotic built to outrun 4-star interceptors.'),
            price: 1200,
            owned: !!p.unlockedCars.cheetah
          },
          {
            id: 'car_infernus',
            title: VS.t('炼狱罪恶原型车', 'Infernus Vice Prototype'),
            desc: VS.t('极速 140 MPH 霓虹底盘终极超跑，海滨大道之王。', '140 MPH custom neon-underglow beast. King of Ocean Drive.'),
            price: 2400,
            owned: !!p.unlockedCars.infernus
          },
          {
            id: 'car_tank',
            title: VS.t('军方犀牛坦克', 'Military Rhino Tank'),
            desc: VS.t('重装防爆主战坦克，左键/J/空格发射高爆主炮，横扫街头！', 'Armored battle tank with explosive cannon (Click/J/Space). Unstoppable!'),
            price: 6500,
            owned: !!p.unlockedCars.tank
          }
        ]
      }
    ];

    this.body.innerHTML = progress + sections.map((sec) => `
      <div class="garage-section">
        <h3>${sec.title}</h3>
        <div class="garage-grid">
          ${sec.items.map((it) => {
            let label = it.btnLabel || VS.t(`购买 ($${it.price})`, `BUY ($${it.price})`);
            let cls = 'shop-btn';
            let disabled = false;
            if (it.maxed) { label = VS.t('已满级', 'MAXED OUT'); disabled = true; }
            else if (it.owned) { label = VS.t('免费提车上街', 'PULL TO STREET (FREE)'); cls += ' owned'; }
            else if (p.cash < it.price) { disabled = true; }
            return `
              <div class="shop-item">
                <div>
                  <div class="shop-item-title">${it.title}</div>
                  <div class="shop-item-desc">${it.desc}</div>
                </div>
                <button class="${cls}" data-action="${it.id}" ${disabled ? 'disabled' : ''}>${label}</button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');

    this.body.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => this._handlePurchase(btn.dataset.action));
    });
  }

  _deliverCar(typeId) {
    const g = this.game;
    const p = g.player;
    const sp = VS.CONFIG.GARAGE_SPAWN;

    if (p.vehicle) g.vehicleManager.exitVehicle(p, true);

    const v = g.vehicleManager.spawnVehicle(typeId, sp.x, sp.z, sp.yaw);
    if (p.upgrades.turbo >= 2 && !v.spec.isTank) v._addUnderglow(0x00f0ff);
    v.driver = p;
    p.vehicle = v;
    p.x = v.x; p.z = v.z;
    g.audio.playCarEnter();
    g.hud.addFeed(VS.t(`已将 ${VS.vehName(v.spec)} 开上阳光大道！`, `Delivered ${v.spec.name} onto Sunshine Drive!`), 'money');
    this.close();
  }

  _handlePurchase(id) {
    const g = this.game;
    const p = g.player;

    if (id === 'respray') {
      if (!p.spendCash(200)) return;
      if (p.vehicle) {
        const freshColor = VS.pick([0xff2a85, 0x00f0ff, 0xffd23f, 0x4ef2b8, 0xc77dff, 0xff6b35, 0xffffff]);
        p.vehicle.repaint(freshColor);
      }
      p.healFull();
      if (g.police) g.police.clearWanted(true);
      g.audio.playMissionComplete();
      g.hud.addFeed(VS.t('喷漆修车完成！所有通缉星已清除！', 'Pay & Spray complete! Car restored & Wanted Level cleared!'), 'money');
      if (g.saveGame) g.saveGame();
      this.render();
      return;
    }

    if (id === 'upg_engine' && p.upgrades.engine < 3) {
      const cost = [400, 800, 1400][p.upgrades.engine];
      if (!p.spendCash(cost)) return;
      p.upgrades.engine++;
      g.audio.playCash();
      g.hud.addFeed(VS.t(`引擎强化已升至 ${p.upgrades.engine} 级！`, `Engine Tune upgraded to Level ${p.upgrades.engine}!`), 'money');
      if (g.saveGame) g.saveGame();
      this.render();
      return;
    }
    if (id === 'upg_turbo' && p.upgrades.turbo < 3) {
      const cost = [350, 700, 1200][p.upgrades.turbo];
      if (!p.spendCash(cost)) return;
      p.upgrades.turbo++;
      if (p.vehicle && p.upgrades.turbo >= 2 && !p.vehicle.spec.isTank) p.vehicle._addUnderglow(0x00f0ff);
      g.audio.playCash();
      g.hud.addFeed(VS.t(`涡轮与漂移胎已升至 ${p.upgrades.turbo} 级！`, `Turbo & Tires upgraded to Level ${p.upgrades.turbo}!`), 'money');
      if (g.saveGame) g.saveGame();
      this.render();
      return;
    }
    if (id === 'upg_armor' && p.upgrades.armor < 3) {
      const cost = [400, 800, 1300][p.upgrades.armor];
      if (!p.spendCash(cost)) return;
      p.upgrades.armor++;
      g.audio.playCash();
      g.hud.addFeed(VS.t(`防撞装甲底盘已升至 ${p.upgrades.armor} 级！`, `Reinforced Chassis upgraded to Level ${p.upgrades.armor}!`), 'money');
      if (g.saveGame) g.saveGame();
      this.render();
      return;
    }

    if (id === 'wpn_pistol') {
      const cost = p.ownedWeapons.pistol ? 120 : 300;
      if (!p.spendCash(cost)) return;
      p.ownedWeapons.pistol = true;
      p.ammo.pistol += 36;
      p.selectWeapon('pistol');
      g.audio.playCash();
      g.hud.addFeed(VS.t('9mm 手枪与弹药已就绪！按 [2] 装备。', '9mm Pistol & ammo ready! Press [2].'), 'money');
      if (g.saveGame) g.saveGame();
      this.render();
      return;
    }
    if (id === 'wpn_smg') {
      const cost = p.ownedWeapons.smg ? 180 : 750;
      if (!p.spendCash(cost)) return;
      p.ownedWeapons.smg = true;
      p.ammo.smg += 90;
      p.selectWeapon('smg');
      g.audio.playCash();
      g.hud.addFeed(VS.t('MAC-10 冲锋枪与弹药已就绪！按 [3] 装备。', 'MAC-10 SMG & ammo ready! Press [3].'), 'money');
      if (g.saveGame) g.saveGame();
      this.render();
      return;
    }
    if (id === 'wpn_shotgun') {
      const cost = p.ownedWeapons.shotgun ? 160 : 450;
      if (!p.spendCash(cost)) return;
      p.ownedWeapons.shotgun = true;
      p.ammo.shotgun = (p.ammo.shotgun || 0) + 16;
      p.selectWeapon('shotgun');
      g.audio.playCash();
      g.hud.addFeed(VS.t('泵动霰弹枪与弹药已就绪！按 [4] 装备。', 'Pump Shotgun & shells ready! Press [4].'), 'money');
      if (g.saveGame) g.saveGame();
      this.render();
      return;
    }
    if (id === 'wpn_rpg') {
      const cost = p.ownedWeapons.rpg ? 320 : 900;
      if (!p.spendCash(cost)) return;
      p.ownedWeapons.rpg = true;
      p.ammo.rpg = (p.ammo.rpg || 0) + 5;
      p.selectWeapon('rpg');
      g.audio.playCash();
      g.hud.addFeed(VS.t('RPG 火箭筒与高爆弹已就绪！按 [5] 装备。', 'RPG-7 & rockets ready! Press [5].'), 'money');
      if (g.saveGame) g.saveGame();
      this.render();
      return;
    }
    if (id === 'gear_vest') {
      if (!p.spendCash(220)) return;
      p.hp = p.maxHp;
      p.armor = p.maxArmor;
      g.audio.playCash();
      g.hud.addFeed(VS.t('防弹衣与生命值已补满！', 'Full Kevlar Vest & Health restored!'), 'money');
      if (g.saveGame) g.saveGame();
      this.render();
      return;
    }

    const carMap = { car_sabre: ['sabre', 500], car_cheetah: ['cheetah', 1200], car_infernus: ['infernus', 2400], car_tank: ['tank', 6500] };
    if (carMap[id]) {
      const [typeId, cost] = carMap[id];
      if (!p.unlockedCars[typeId]) {
        if (!p.spendCash(cost)) return;
        p.unlockedCars[typeId] = true;
        g.audio.playMissionComplete();
      }
      if (g.saveGame) g.saveGame();
      this._deliverCar(typeId);
    }
  }
};
