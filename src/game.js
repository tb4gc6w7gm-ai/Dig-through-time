// Основная сцена: копание, свет, жизни, лава, обвалы, деревня, босс, сохранения.
window.DTT = window.DTT || {};

(function () {
  const { TILE, W, H, SURF, SEAL, T, DEFS, UPGRADES: U, ARENA, SPAWN_TX } = DTT;
  const UI = DTT.UI, Sim = DTT.Sim;
  const SPAWN_X = SPAWN_TX * TILE + 8;
  const SPAWN_Y = (SURF - 1) * TILE + 8;
  const SPEED = 75, JUMP = 195;
  const BITS = Math.ceil((W * H) / 8);
  // всё, кроме воздуха и лавы, — твёрдое
  const SOLID = Object.keys(DEFS).map(Number).filter((i) => !DEFS[i].liquid);

  const Sfx = DTT.Sfx;

  class Play extends Phaser.Scene {
    constructor() { super('play'); }

    create() {
      const S = this.S = DTT.pendingState;
      this.sfx = Sfx;
      Sfx.setVolume(S.flags.vol != null ? S.flags.vol : S.flags.mute ? 0 : 0.7);
      this.dripT = 4;
      this.bubbleT = 2;
      DTT.Art.makeAll(this, S);
      UI.setLang(S.lang || UI.detectLang());

      // ---- мир ----
      const world = DTT.World.generate(S.seed);
      this.world = world;
      this.arts = world.arts;
      for (const k in S.mods) world.fg[+k] = S.mods[k];

      this.map = this.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: W, height: H });
      const ts = this.map.addTilesetImage('tiles', 'tiles', TILE, TILE, 1, 2);
      this.bg = this.map.createBlankLayer('bg', ts).setDepth(0);
      this.fg = this.map.createBlankLayer('fg', ts).setDepth(2);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (world.bg[i] >= 0) this.bg.putTileAt(world.bg[i], x, y);
          if (world.fg[i] >= 0) this.fg.putTileAt(world.fg[i], x, y);
        }
      }
      this.fg.setCollision(SOLID);

      // ---- UI и память карты ----
      const isTouch = UI.init({
        act: (a, arg, arg2) => this.act(a, arg, arg2),
        map: () => { const [x, y] = this.tilePos(); UI.openMap(x, y); },
        menu: () => { Sfx.ui(); UI.openMenu(Sfx.volume); },
        rope: () => this.rope(),
        torch: () => this.placeTorch(),
      });
      const seen = DTT.Save.unpackBits(S.seen, BITS), open = DTT.Save.unpackBits(S.open, BITS);
      this.mem = new Uint8Array(W * H);
      const bit = (arr, i) => (arr[i >> 3] >> (i & 7)) & 1;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          let m = 0;
          if (y < SURF) m = 4;
          else if (bit(seen, i)) {
            const tile = this.fg.getTileAt(x, y);
            m = bit(open, i) ? 2 : tile && DEFS[tile.index].liquid ? 3 : tile && tile.index === T.VGRASS ? 5 : 1;
          }
          this.mem[i] = m;
          if (m) UI.mapPaint(x, y, m);
        }
      }

      // ---- деревня ----
      this.anims.create({ key: 'gnomewalk', frames: [0, 1].map((f) => ({ key: 'gnome', frame: f })), frameRate: 6, repeat: -1 });
      this.cameras.main.setBackgroundColor('#7fd6f0');
      DTT.Village.build(this);

      // ---- факелы ----
      this.anims.create({ key: 'flame', frames: [0, 1].map((f) => ({ key: 'torch', frame: f })), frameRate: 6, repeat: -1 });
      this.lights = [];
      world.sconces.forEach(([x, y]) => this.addTorch(x, y, false));
      S.placed.forEach(([x, y]) => this.addTorch(x, y, false));

      // ---- игрок ----
      let sx = SPAWN_X, sy = SPAWN_Y;
      if (S.px != null && !this.fg.getTileAt(Math.floor(S.px / TILE), Math.floor(S.py / TILE))) { sx = S.px; sy = S.py; }
      this.physics.world.setBounds(0, 0, W * TILE, H * TILE);
      const p = this.player = this.physics.add.sprite(sx, sy, 'miner', 0).setDepth(5);
      p.body.setSize(10, 13).setOffset(3, 3);
      p.body.setMaxVelocity(300, 380);
      p.setCollideWorldBounds(true);
      this.physics.add.collider(p, this.fg);
      const fr = (arr) => arr.map((f) => ({ key: 'miner', frame: f }));
      this.anims.create({ key: 'idle', frames: fr([0]) });
      this.anims.create({ key: 'walk', frames: fr([1, 0, 2, 0]), frameRate: 10, repeat: -1 });
      this.anims.create({ key: 'dig', frames: fr([3, 4]), frameRate: 9, repeat: -1 });
      S.hearts = Math.min(S.hearts, Sim.maxHearts(S));

      this.crack = this.add.image(0, 0, 'cracks', 0).setOrigin(0).setDepth(4).setVisible(false);
      this.digT = null;
      this.warnAt = {};
      this.invuln = 0;
      this.atkCd = 0;
      this.regenT = 0;
      this.boss = null;
      this.wasUnder = this.tilePos()[1] >= SURF;

      // ---- враги ----
      DTT.Enemies.init(this);
      world.rats.forEach(([x, y]) => DTT.Enemies.spawnRat(this, x * TILE + 8, y * TILE + 8));

      // ---- камера ----
      const cam = this.cameras.main;
      cam.setBounds(0, 0, W * TILE, H * TILE);
      cam.startFollow(p, true, 0.2, 0.2);
      cam.setRoundPixels(true);
      const fit = () => {
        const w = this.scale.width, h = this.scale.height;
        let z = Math.max(2, Math.min(4, Math.floor(Math.min(w, h) / 200)));
        z = Math.max(z, Math.ceil(w / (W * TILE)));
        cam.setZoom(z);
      };
      this.scale.on('resize', fit);
      fit();

      // ---- ввод: только стрелки ----
      this.cur = this.input.keyboard.createCursorKeys();
      this.input.keyboard.on('keydown', () => Sfx.unlock());
      this.input.on('pointerdown', () => Sfx.unlock());
      this.prevTouchUp = false;

      // ---- пока тебя не было ----
      const rep = Sim.offlineReport(S, Date.now());
      if (rep) UI.openWelcome(rep);
      else Sim.tickLodge(S, Date.now());
      if (!S.flags.hintDig) this.time.delayedCall(600, () => UI.toast(UI.t(isTouch ? 'hint_dig_touch' : 'hint_dig'), 7000));

      // ---- таймеры ----
      this.dirty = true;
      this.time.addEvent({ delay: 5000, loop: true, callback: () => this.persist() });
      this.time.addEvent({
        delay: 1000, loop: true, callback: () => {
          Sim.tickLodge(S, Date.now());
          DTT.Village.refresh(this);
          UI.refresh(['farm', 'lodge']);
          S.playMs += 1000;
          this.dirty = true;
        },
      });
      this.time.addEvent({ delay: 450, loop: true, callback: () => this.animateLava() });
      const flush = () => this.persist(true);
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    }

    // ================= утилиты =================
    persist(force) {
      if (this.noSave || (!this.dirty && !force)) return;
      const S = this.S, b = this.player.body;
      S.px = b.center.x; S.py = b.center.y;
      const seen = new Uint8Array(BITS), open = new Uint8Array(BITS);
      for (let i = 0; i < this.mem.length; i++) {
        const m = this.mem[i];
        if (m && m !== 4) { seen[i >> 3] |= 1 << (i & 7); if (m === 2) open[i >> 3] |= 1 << (i & 7); }
      }
      S.seen = DTT.Save.packBits(seen);
      S.open = DTT.Save.packBits(open);
      DTT.Save.saveAuto(S);
      this.dirty = false;
    }

    reloadWith(flag) {
      this.noSave = true;
      DTT.Save.bootFlag(flag);
      location.reload();
    }

    warn(key, sfx) {
      const now = this.time.now;
      if (this.warnAt[key] && now - this.warnAt[key] < 1800) return;
      this.warnAt[key] = now;
      UI.toast(UI.t(key));
      if (sfx !== false) Sfx.deny();
    }

    floatText(x, y, str, color) {
      const txt = this.add.text(x, y, str, {
        fontFamily: 'PS2P', fontSize: '8px', color: color || '#fee761', stroke: '#181425', strokeThickness: 2, resolution: 4,
      }).setOrigin(0.5).setDepth(7);
      this.tweens.add({ targets: txt, y: y - 14, alpha: 0, duration: 800, ease: 'Quad.out', onComplete: () => txt.destroy() });
    }

    burstAt(cx, cy, color, n) {
      for (let i = 0; i < (n || 8); i++) {
        const r = this.add.rectangle(cx, cy, 2, 2, i % 3 ? color : 0x181425).setDepth(6);
        this.tweens.add({
          targets: r, x: cx + Phaser.Math.Between(-16, 16), y: cy + Phaser.Math.Between(-14, 8), alpha: 0,
          duration: Phaser.Math.Between(300, 600), ease: 'Quad.out', onComplete: () => r.destroy(),
        });
      }
    }

    addTorch(x, y, save) {
      const spr = this.add.sprite(x * TILE + 8, y * TILE + 8, 'torch', 0).setDepth(3).play('flame');
      this.lights.push({ x: x + 0.5, y: y + 0.5, spr, phase: Math.random() * 10 });
      if (save) { this.S.placed.push([x, y]); this.dirty = true; }
    }
    removeTorchAt(x, y) {
      const i = this.lights.findIndex((l) => Math.floor(l.x) === x && Math.floor(l.y) === y);
      if (i < 0) return;
      this.lights[i].spr.destroy();
      this.lights.splice(i, 1);
      this.S.placed = this.S.placed.filter(([a, b]) => a !== x || b !== y);
    }

    setTile(x, y, v) {
      this.S.mods[y * W + x] = v;
      if (v < 0) this.fg.removeTileAt(x, y);
      else this.fg.putTileAt(v, x, y);
      this.dirty = true;
    }

    tilePos() {
      const b = this.player.body;
      return [Math.floor(b.center.x / TILE), Math.floor(b.center.y / TILE)];
    }
    onSurface() { return this.tilePos()[1] < SURF; }
    depthOf(ty) { return Math.max(0, ty - (SURF - 1)); }

    // ================= жизни =================
    hurt(n, fromX, key) {
      if (this.invuln > 0 || this.noSave || this.roping) return;
      const S = this.S;
      S.hearts -= n;
      this.invuln = 1.4;
      const dir = Math.sign(this.player.x - fromX) || 1;
      this.player.body.setVelocity(dir * 130, -210);
      this.cameras.main.shake(120, 0.004);
      Sfx.hurt();
      this.dirty = true;
      if (S.hearts <= 0) return this.faint();
      UI.toast(UI.t(key));
    }

    faint() {
      const S = this.S;
      S.bagItems = [];
      S.hearts = Sim.maxHearts(S);
      DTT.Enemies.removeBoss(this);
      const cam = this.cameras.main;
      this.roping = true;
      cam.fadeOut(400, 24, 20, 37);
      cam.once('camerafadeoutcomplete', () => {
        this.player.body.reset(SPAWN_X, SPAWN_Y);
        this.resetDig();
        cam.fadeIn(500, 24, 20, 37);
        this.roping = false;
        this.wasUnder = false;
        UI.toast(UI.t('fainted'), 5000);
      });
    }

    // ================= действия =================
    rope() {
      Sfx.unlock();
      if (this.onSurface() || this.roping) return;
      this.roping = true;
      Sfx.rope();
      const cam = this.cameras.main;
      cam.fadeOut(220, 24, 20, 37);
      cam.once('camerafadeoutcomplete', () => {
        DTT.Enemies.removeBoss(this);
        this.player.body.reset(SPAWN_X, SPAWN_Y);
        this.resetDig();
        cam.fadeIn(260, 24, 20, 37);
        this.roping = false;
        this.dirty = true;
      });
    }

    // люк над стволом: ↓ проваливает в шахту
    enterMine() {
      Sfx.unlock();
      Sfx.hatch();
      this.player.body.reset(DTT.MINE_X * TILE + 8, (SURF + 1) * TILE + 8);
      this.resetDig();
    }

    placeTorch() {
      Sfx.unlock();
      const S = this.S;
      const [x, y] = this.tilePos();
      if (y < SURF) return;
      if (S.torches <= 0) return this.warn('no_torches');
      if (this.lights.some((l) => Math.floor(l.x) === x && Math.floor(l.y) === y)) return this.warn('torch_here');
      S.torches--;
      this.addTorch(x, y, true);
      Sfx.torch();
    }

    sell() {
      const S = this.S;
      if (!S.bagItems.length) return;
      const n = S.bagItems.length;
      const v = Sim.oreValue(S, S.bagItems);
      S.coins += v;
      S.bagItems = [];
      UI.toast(UI.t('sold', { n, v }));
      this.floatText(this.player.x, this.player.y - 10, '+' + v);
      Sfx.coin();
      this.dirty = true;
    }

    // Обвал: засыпает кусок уже выкопанного тоннеля. Где — не говорим.
    caveIn() {
      const S = this.S;
      const cands = Object.keys(S.mods).map(Number).filter((i) => {
        if (S.mods[i] !== -1) return false;
        const x = i % W, y = Math.floor(i / W);
        return y - SURF >= 6 && !this.fg.getTileAt(x, y);
      });
      if (cands.length < 20 || Math.random() > 0.45) return;
      const start = cands[Math.floor(Math.random() * cands.length)];
      const want = 4 + Math.floor(Math.random() * 7);
      const queue = [start], done = new Set([start]);
      const filled = [];
      while (queue.length && filled.length < want) {
        const i = queue.shift();
        const x = i % W, y = Math.floor(i / W);
        filled.push([x, y]);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const j = (y + dy) * W + (x + dx);
          if (!done.has(j) && S.mods[j] === -1 && y + dy - SURF >= 6 && !this.fg.getTileAt(x + dx, y + dy)) { done.add(j); queue.push(j); }
        });
      }
      filled.forEach(([x, y]) => { this.setTile(x, y, T.RUBBLE); this.removeTorchAt(x, y); });
      Sfx.rumble();
      this.cameras.main.shake(500, 0.003);
      UI.toast(UI.t('cave_in'), 5000);
    }

    openBuilding(id) {
      Sfx.unlock();
      Sfx.door();
      const S = this.S;
      ({
        farm: () => UI.openFarm(S), house: () => UI.openHouse(S), hall: () => UI.openHall(S), shop: () => UI.openShop(S),
        museum: () => UI.openMuseum(S), lodge: () => UI.openLodge(S), tailor: () => UI.openTailor(S),
      })[id]();
    }

    // Все кнопки окон приходят сюда
    act(a, arg, arg2) {
      const S = this.S, now = Date.now();
      const pay = (cost) => {
        if (S.coins < cost) { this.warn('not_enough'); return false; }
        S.coins -= cost; Sfx.buy(); return true;
      };
      let rebuild = false;
      switch (a) {
        case 'buy': {
          if (arg === 'torches') { if (pay(U.torches.cost)) S.torches += U.torches.amount; break; }
          const cost = U[arg].cost[S[arg] + 1];
          if (cost == null || !pay(cost)) break;
          S[arg]++;
          if (arg === 'pick') DTT.Art.redrawMiner(this, S.skin, S.pick);
          break;
        }
        case 'skin': {
          const i = +arg;
          if (!S.skinsOwned.includes(i)) { if (!pay(DTT.SKINS[i].cost)) break; S.skinsOwned.push(i); }
          S.skin = i;
          DTT.Art.redrawMiner(this, S.skin, S.pick);
          break;
        }
        case 'decor': {
          const d = DTT.DECOR.find((x) => x.id === arg);
          if (!S.decor.includes(arg) && pay(d.cost)) { S.decor.push(arg); rebuild = true; }
          break;
        }
        case 'house_up': {
          const cost = DTT.HOUSE.cost[S.house.lvl + 1];
          if (cost != null && pay(cost)) { S.house.lvl++; rebuild = true; }
          break;
        }
        case 'furn': {
          const f = DTT.FURNITURE.find((x) => x.id === arg);
          if (S.house.items.includes(arg)) break;
          if (f.boss) { if (S.flags.bossDead) S.house.items.push(arg); break; }
          const used = S.house.items.filter((id) => id !== 'trophy').length;
          if (used >= DTT.HOUSE.slots[S.house.lvl]) { this.warn('no_room'); break; }
          if (pay(f.cost)) { S.house.items.push(arg); if (f.heart) S.hearts++; }
          break;
        }
        case 'rest':
          S.hearts = Sim.maxHearts(S);
          UI.toast(UI.t('rested'));
          break;
        case 'build': {
          const b = DTT.BUILDINGS.find((x) => x.id === arg);
          if (pay(b.cost)) {
            if (arg === 'farm') S.farm.built = true;
            if (arg === 'lodge') { S.lodge.built = true; S.lodge.lastTick = now; }
            rebuild = true;
          }
          break;
        }
        case 'plant':
          if (!Sim.plant(S, +arg, arg2)) this.warn('not_enough'); else Sfx.plant();
          break;
        case 'harvest':
          if (Sim.harvestAll(S, now)) Sfx.coin();
          break;
        case 'plot': {
          const cost = DTT.FARM.plotCost[S.farm.plots.length];
          if (cost != null && pay(cost)) { S.farm.plots.push({ crop: null, t0: 0 }); rebuild = true; }
          break;
        }
        case 'animal': {
          const n = S.farm.animals.filter((x) => x.type === arg).length;
          if (n < DTT.FARM.maxPerAnimal && pay(DTT.ANIMALS[arg].cost)) { S.farm.animals.push({ type: arg, fedAt: null }); rebuild = true; }
          break;
        }
        case 'feed': {
          const r = Sim.feedAll(S, now);
          if (r.missing) this.warn('no_food', !r.fed);
          if (r.fed) Sfx.plant();
          break;
        }
        case 'collect_animals':
          if (Sim.collectAll(S, now)) Sfx.coin();
          break;
        case 'sell_crops': case 'sell_products': {
          const v = Sim.sellBarn(S, a === 'sell_crops' ? 'crops' : 'products');
          if (v) { Sfx.coin(); UI.toast('+' + v); }
          break;
        }
        case 'hire': {
          const cost = DTT.LODGE.hire[S.lodge.gnomes];
          if (cost != null && pay(cost)) { Sim.tickLodge(S, now); S.lodge.gnomes++; rebuild = true; }
          break;
        }
        case 'tools': case 'storage': {
          const key = a === 'tools' ? 'toolsCost' : 'storageCost';
          const cost = DTT.LODGE[key][S.lodge[a] + 1];
          if (cost != null && pay(cost)) { Sim.tickLodge(S, now); S.lodge[a]++; }
          break;
        }
        case 'collect_gnomes': {
          Sim.tickLodge(S, now);
          const v = Math.floor(S.lodge.stored);
          if (v > 0) { S.coins += v; S.lodge.stored -= v; Sfx.coin(); UI.toast('+' + v); }
          break;
        }
        case 'slots':
          UI.openSlots(arg);
          return;
        case 'save': {
          const n = +arg;
          if (DTT.Save.slotMeta(n) && !confirm(UI.t('confirm_over', { n }))) return;
          this.persist(true);
          DTT.Save.saveSlot(n, S);
          UI.toast(UI.t('saved', { n }));
          UI.refresh();
          return;
        }
        case 'load': {
          if (arg === 'auto') { this.persist(true); this.reloadWith('continue'); return; }
          const n = +arg;
          if (!confirm(UI.t('confirm_load', { n }))) return;
          const st = DTT.Save.loadSlot(n);
          if (!st) return;
          DTT.Save.saveAuto(st);
          this.reloadWith('continue');
          return;
        }
        case 'new':
          if (!confirm(UI.t('confirm_new'))) return;
          DTT.Save.clearAuto();
          this.reloadWith('new');
          return;
        case 'volume':
          // ползунок: без перерисовки меню, иначе он «отпускается» при перетаскивании
          Sfx.setVolume(+arg / 10);
          S.flags.vol = Sfx.volume;
          Sfx.coin();
          this.dirty = true;
          return;
        case 'lang': {
          const o = ['en', 'ru', 'es'];
          S.lang = o[(o.indexOf(UI.getLang()) + 1) % 3];
          UI.setLang(S.lang);
          break;
        }
      }
      this.dirty = true;
      if (rebuild) DTT.Village.build(this);
      UI.refresh();
    }

    onBossDefeated() {
      const S = this.S;
      S.flags.bossDead = true;
      UI.bossBar(null);
      UI.banner(UI.t('boss_win'));
      Sfx.win();
      this.cameras.main.shake(500, 0.006);
      this.enemies.getChildren().slice().forEach((e) => e.destroy());
      if (!S.museum.includes('crown')) {
        S.museum.push('crown');
        this.time.delayedCall(1200, () => UI.showArtifact('crown', S.museum.length, DTT.ARTIFACTS.length));
      }
      this.persist(true);
    }

    // ================= копание =================
    resetDig() {
      this.digT = null;
      this.crack.setVisible(false);
    }

    dig(tx, ty, dt) {
      const S = this.S;
      const tile = this.fg.getTileAt(tx, ty);
      if (!tile) return this.resetDig();
      const def = DEFS[tile.index];
      if (def.liquid) return this.resetDig();
      if (def.village) { this.warn('village_ground', false); return this.resetDig(); }
      if (def.tier >= 99) {
        this.warn(ty - SURF > SEAL ? 'end_content' : 'bedrock', false);
        return this.resetDig();
      }
      if (def.seal && !S.flags.bossDead) { this.warn('seal_locked'); return this.resetDig(); }
      if (def.tier > U.pick.tier[S.pick]) { this.warn('need_pick'); return this.resetDig(); }
      if (def.value && S.bagItems.length >= U.bag.cap[S.bag]) { this.warn('bag_full'); return this.resetDig(); }

      if (!this.digT || this.digT.x !== tx || this.digT.y !== ty) this.digT = { x: tx, y: ty, prog: 0, hitAt: 0 };
      const d = this.digT;
      d.prog += (dt * U.pick.power[S.pick]) / def.hp;
      d.hitAt -= dt;
      if (d.hitAt <= 0) { Sfx.hit(tile.index); d.hitAt = 0.22; }
      this.digging = true;
      this.crack.setPosition(tx * TILE, ty * TILE).setFrame(Math.min(3, Math.floor(d.prog * 4))).setVisible(true);
      if (d.prog >= 1) this.breakTile(tx, ty, tile);
    }

    breakTile(tx, ty, tile) {
      const S = this.S;
      const type = tile.index, def = DEFS[type];
      const idx = ty * W + tx;
      this.setTile(tx, ty, -1);
      this.resetDig();
      this.burstAt(tx * TILE + 8, ty * TILE + 8, def.color);
      Sfx.brk(type);
      S.flags.hintDig = true;

      const [px, py] = this.tilePos();
      if (tx === px && ty === py + 1) this.player.x = tx * TILE + 8;

      if (def.value) {
        S.bagItems.push(type);
        Sfx.ore(def.value);
        this.floatText(tx * TILE + 8, ty * TILE + 4, '+' + def.value, '#ffffff');
        if (!S.flags.hintSell) { S.flags.hintSell = true; UI.toast(UI.t('hint_sell'), 4000); }
      }
      if (def.artifact) {
        const id = this.arts[idx];
        if (id && !S.museum.includes(id)) {
          S.museum.push(id);
          Sfx.art();
          this.persist(true);
          UI.showArtifact(id, S.museum.length, DTT.ARTIFACTS.length);
        }
      }
      if (def.seam) {
        if (!S.flags.seam1) { S.flags.seam1 = true; Sfx.seam(); this.cameras.main.shake(400, 0.006); UI.toast(UI.t('seam_broken'), 4500); }
      } else if (def.seal) {
        if (!S.flags.seal) { S.flags.seal = true; Sfx.seam(); this.cameras.main.shake(500, 0.008); UI.toast(UI.t('seal_broken'), 5000); }
      } else if (def.hp >= 1.5) {
        this.cameras.main.shake(70, 0.002);
      }
    }

    // ================= свет =================
    ambient(y) {
      const d = y - SURF;
      if (d < 2) return 1;
      return Math.max(d > 62 ? 0.04 : 0.07, 1 - (d - 1) * 0.14);
    }
    // фонарь тускнеет ниже своей «рабочей» глубины
    lampRadius(depth) {
      const S = this.S;
      let r = U.lamp.radius[S.lamp];
      const over = depth - U.lamp.rated[S.lamp];
      if (over > 0) r *= Math.max(0.3, 1 - over / 25);
      return Math.max(1.3, r);
    }

    animateLava() {
      const v = this.cameras.main.worldView;
      const x0 = Math.max(0, Math.floor(v.x / TILE)), x1 = Math.min(W - 1, Math.ceil(v.right / TILE));
      const y0 = Math.max(0, Math.floor(v.y / TILE)), y1 = Math.min(H - 1, Math.ceil(v.bottom / TILE));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = this.fg.getTileAt(x, y);
        if (t && (t.index === T.LAVA || t.index === T.LAVA2)) t.index = t.index === T.LAVA ? T.LAVA2 : T.LAVA;
      }
    }

    relight(time, depth) {
      const cam = this.cameras.main, v = cam.worldView, b = this.player.body;
      const x0 = Math.max(0, Math.floor(v.x / TILE) - 1), x1 = Math.min(W - 1, Math.ceil(v.right / TILE) + 1);
      const y0 = Math.max(0, Math.floor(v.y / TILE) - 1), y1 = Math.min(H - 1, Math.ceil(v.bottom / TILE) + 1);
      const pcx = b.center.x / TILE, pcy = b.center.y / TILE;
      const lr = this.lampRadius(depth) * (1 + 0.025 * Math.sin(time * 0.012));
      const TR = DTT.TORCH_RADIUS;
      const near = this.lights.filter((l) => l.x > x0 - TR && l.x < x1 + TR && l.y > y0 - TR && l.y < y1 + TR)
        .map((l) => ({ x: l.x, y: l.y, r: TR * (1 + 0.05 * Math.sin(time * 0.009 + l.phase)) }));
      let lava = false;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const t = this.fg.getTileAt(x, y);
        if (t && DEFS[t.index].liquid) { near.push({ x: x + 0.5, y: y + 0.5, r: 2.6 }); lava = true; }
      }

      this.lavaNear = lava;
      for (let y = y0; y <= y1; y++) {
        const amb = this.ambient(y);
        for (let x = x0; x <= x1; x++) {
          const cx = x + 0.5, cy = y + 0.5;
          let warm = Math.max(0, Math.min(1, 1.2 - Math.hypot(cx - pcx, cy - pcy) / lr));
          for (const l of near) {
            const w = 1.15 - Math.hypot(cx - l.x, cy - l.y) / l.r;
            if (w > warm) warm = Math.min(1, w);
          }
          let L, r, g, bl;
          if (warm > amb) { L = Math.round(warm * 6) / 6; r = 255 * L; g = 228 * L; bl = 190 * L; }
          else { L = Math.round(amb * 6) / 6; r = g = bl = 255 * L; }
          const tint = ((r | 0) << 16) | ((g | 0) << 8) | (bl | 0);
          const f = this.fg.getTileAt(x, y);
          if (f) f.tint = DEFS[f.index].liquid ? 0xffffff : tint;
          const k = this.bg.getTileAt(x, y);
          if (k) k.tint = tint;

          // память карты: всё освещённое считается увиденным
          if (L >= 0.33 && y >= SURF) {
            const i = y * W + x;
            const m = !f ? 2 : DEFS[f.index].liquid ? 3 : f.index === T.VGRASS ? 5 : 1;
            if (this.mem[i] !== m) { this.mem[i] = m; UI.mapPaint(x, y, m); }
          }
        }
      }
    }

    // ================= цикл =================
    update(time, delta) {
      const dt = Math.min(delta, 50) / 1000;
      const S = this.S, p = this.player, b = p.body;
      const ui = UI.isOpen() || this.roping;
      const c = this.cur, tch = UI.touch;
      let L = !ui && (c.left.isDown || tch.left);
      let R = !ui && (c.right.isDown || tch.right);
      let Dn = !ui && (c.down.isDown || tch.down);
      let Up = !ui && (c.up.isDown || tch.up);
      const upTap = !ui && (Phaser.Input.Keyboard.JustDown(c.up) || (tch.up && !this.prevTouchUp));
      this.prevTouchUp = tch.up;
      const [px, py] = this.tilePos();
      const depth = this.depthOf(py);

      // ---- деревня: подсказка у дверей; ↑ открывает здание, а не прыгает ----
      let building = null;
      if (py < SURF && b.blocked.down) building = DTT.BUILDINGS.find((bd) => px >= bd.x0 && px <= bd.x1);
      const onHatch = py === SURF - 1 && px === DTT.MINE_X && b.blocked.down;
      if (building) {
        UI.prompt(UI.t('hint_enter', { name: UI.t('b_' + building.id) }), () => this.openBuilding(building.id));
        if (upTap) this.openBuilding(building.id);
        Up = false;
      } else if (onHatch) {
        UI.prompt(UI.t('mine_down'), () => this.enterMine());
        if (Dn) { this.enterMine(); Dn = false; }
      } else UI.prompt(null);

      // ---- цель копания ----
      let target = null;
      if (Dn && b.blocked.down) target = [px, py + 1];
      else if (L && b.blocked.left) target = [px - 1, py];
      else if (R && b.blocked.right) target = [px + 1, py];

      // мышь / палец
      const ptr = this.input.activePointer;
      let tapAttack = 0;
      if (!target && !ui && ptr.isDown && !L && !R && !Dn && !Up) {
        const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
        const tx = Math.floor(wp.x / TILE), ty = Math.floor(wp.y / TILE);
        const nearEnemy = this.enemies.getChildren().find((e) => Math.abs(e.x - wp.x) < 14 && Math.abs(e.y - wp.y) < 14);
        if (nearEnemy && Math.abs(nearEnemy.x - p.x) < 34) tapAttack = Math.sign(nearEnemy.x - p.x) || 1;
        else if (Math.abs(tx - px) <= 1 && Math.abs(ty - py) <= 1 && this.fg.getTileAt(tx, ty)) {
          target = [tx, ty];
          if (tx !== px) p.setFlipX(tx < px);
        } else {
          const dx = wp.x - b.center.x;
          if (dx < -4) L = true; else if (dx > 4) R = true;
          if (wp.y < b.top - 10 && Math.abs(dx) < 40) Up = true;
        }
      }

      let vx = 0;
      if (L) vx -= SPEED;
      if (R) vx += SPEED;
      if (this.invuln < 1.1) b.setVelocityX(vx);
      if (vx) p.setFlipX(vx < 0);
      if (Up && b.blocked.down) b.setVelocityY(-JUMP);

      // ---- атака: стрелка в сторону врага ----
      this.atkCd -= dt;
      let attacking = false;
      const atkDir = tapAttack || (L ? -1 : R ? 1 : 0);
      if (atkDir && this.atkCd <= 0 && this.enemies.countActive()) {
        if (DTT.Enemies.strike(this, atkDir, U.pick.dmg[S.pick])) {
          this.atkCd = 0.38; attacking = true; Sfx.swing(); p.setFlipX(atkDir < 0);
        }
      }
      if (this.atkCd > 0.2) attacking = true;

      this.digging = false;
      if (target && !attacking) this.dig(target[0], target[1], dt);
      else if (this.digT) this.resetDig();

      if (this.digging || attacking) p.anims.play('dig', true);
      else if (vx && b.blocked.down) p.anims.play('walk', true);
      else p.anims.play('idle', true);

      // ---- лава и неуязвимость ----
      this.invuln = Math.max(0, this.invuln - dt);
      p.setAlpha(this.invuln > 0 && Math.floor(time / 80) % 2 ? 0.4 : 1);
      if (this.touchesLava()) {
        if (this.invuln <= 0) Sfx.sizzle();
        this.hurt(1, p.x, 'lava'); b.setVelocityY(-260);
      }

      // ---- атмосфера: капель в шахте и бульканье лавы рядом ----
      if (depth > 4 && !ui) {
        this.dripT -= dt;
        if (this.dripT <= 0) { Sfx.drip(); this.dripT = 5 + Math.random() * 8; }
        this.bubbleT -= dt;
        if (this.bubbleT <= 0) {
          this.bubbleT = 1.5 + Math.random() * 3;
          if (this.lavaNear) Sfx.bubble();
        }
      }

      DTT.Enemies.update(this, dt);

      // ---- поверхность: продажа, обвалы, здоровье ----
      const surface = py < SURF;
      if (surface && b.blocked.down) {
        this.sell();
        if (this.wasUnder) { this.wasUnder = false; this.warnedLamp = false; this.caveIn(); }
        if (S.hearts < Sim.maxHearts(S)) {
          this.regenT += dt;
          if (this.regenT >= DTT.REGEN_SEC) { this.regenT = 0; S.hearts++; this.dirty = true; }
        }
      }
      if (!surface) this.wasUnder = true;

      // ---- глубина, подсказки, эпохи, босс ----
      if (depth > S.maxDepth) { S.maxDepth = depth; this.dirty = true; }
      if (depth >= 6 && !S.flags.era1) { S.flags.era1 = true; UI.banner(UI.t('era1')); }
      if (depth >= 10 && !S.flags.hintDark) { S.flags.hintDark = true; UI.toast(UI.t('hint_dark'), 4500); }
      if (depth >= 64 && !S.flags.era2) { S.flags.era2 = true; UI.banner(UI.t('era2')); this.dirty = true; }
      if (!this.warnedLamp && depth > U.lamp.rated[S.lamp] + 6) { this.warnedLamp = true; UI.toast(UI.t('lamp_weak'), 4500); }
      const bgt = this.bg.getTileAt(px, py);
      if (!S.flags.sconces && bgt && bgt.index === T.W_BRICK && depth > 64) { S.flags.sconces = true; UI.toast(UI.t('sconces'), 4000); }
      const inArena = px >= ARENA.x0 && px <= ARENA.x1 && py - SURF >= ARENA.d0 && py - SURF <= ARENA.d1;
      if (inArena && !S.flags.bossDead && !this.boss) DTT.Enemies.spawnBoss(this);
      if (b.velocity.x || b.velocity.y) this.dirty = true;

      document.getElementById('btn-rope').classList.toggle('dim', surface);
      document.getElementById('btn-torch').classList.toggle('dim', surface);
      UI.setHUD({
        coins: S.coins, depth, bagN: S.bagItems.length, bagCap: U.bag.cap[S.bag], torches: S.torches,
        hearts: S.hearts, maxHearts: Sim.maxHearts(S), pick: S.pick,
      });
      UI.mapPlayer(px, py);
      DTT.Village.update(this, dt);
      this.relight(time, depth);
    }

    touchesLava() {
      const b = this.player.body;
      const xs = [b.left + 2, b.right - 2], ys = [b.top + 2, b.bottom - 1];
      for (const x of xs) for (const y of ys) {
        const t = this.fg.getTileAt(Math.floor(x / TILE), Math.floor(y / TILE));
        if (t && DEFS[t.index].liquid) return true;
      }
      return false;
    }
  }

  // ================= запуск =================
  function start(S) {
    UI.close();
    DTT.pendingState = S;
    DTT.game = new Phaser.Game({
      type: Phaser.WEBGL,
      parent: 'game',
      pixelArt: true,
      roundPixels: true,
      backgroundColor: '#181425',
      scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
      physics: { default: 'arcade', arcade: { gravity: { y: 650 }, debug: false } },
      scene: [Play],
    });
  }

  // Сразу в игру: продолжение автосохранения или новая игра. Слоты — в меню.
  function boot() {
    const auto = DTT.Save.loadAuto();
    UI.setLang((auto && auto.lang) || UI.detectLang());
    const flag = DTT.Save.bootFlag();
    if (auto && flag !== 'new') return start(auto);
    const s = DTT.Save.fresh();
    s.lang = UI.getLang();
    start(s);
  }

  const fontsReady = document.fonts && document.fonts.load
    ? Promise.race([
      Promise.all([document.fonts.load('8px PS2P', 'A'), document.fonts.load('8px PS2P', 'Я')]),
      new Promise((r) => setTimeout(r, 1000)),
    ])
    : Promise.resolve();
  fontsReady.then(boot, boot);
})();
