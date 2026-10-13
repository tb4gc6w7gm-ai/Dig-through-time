// Враги: крысы в руинах и Крысиный король в большом зале.
window.DTT = window.DTT || {};

DTT.Enemies = (function () {
  const { TILE, SURF, ARENA } = DTT;

  function init(scene) {
    scene.enemies = scene.physics.add.group();
    scene.physics.add.collider(scene.enemies, scene.fg);
    scene.physics.add.overlap(scene.player, scene.enemies, (p, e) => {
      if (e.getData('dead')) return;
      scene.hurt(1, e.x, 'hurt');
    });
    if (!scene.anims.exists('ratwalk')) {
      scene.anims.create({ key: 'ratwalk', frames: [0, 1].map((f) => ({ key: 'rat', frame: f })), frameRate: 8, repeat: -1 });
      scene.anims.create({ key: 'kingwalk', frames: [0, 1].map((f) => ({ key: 'ratking', frame: f })), frameRate: 5, repeat: -1 });
    }
  }

  function spawnRat(scene, px, py) {
    const r = scene.enemies.create(px, py, 'rat', 0).setDepth(4);
    r.body.setSize(12, 7).setOffset(2, 8);
    r.body.setMaxVelocity(200, 380);
    r.setData({ kind: 'rat', hp: DTT.RAT.hp, dir: Math.random() < 0.5 ? -1 : 1, stun: 0 });
    r.play('ratwalk');
    return r;
  }

  function spawnBoss(scene) {
    const x = ((ARENA.x0 + ARENA.x1) / 2) * TILE, y = (SURF + ARENA.d1) * TILE;
    const b = scene.enemies.create(x, y, 'ratking', 0).setDepth(4);
    b.body.setSize(24, 18).setOffset(5, 13);
    b.body.setMaxVelocity(300, 400);
    b.setData({ kind: 'boss', hp: DTT.BOSS.hp, dir: -1, stun: 0, tSummon: 4, tJump: 6 });
    b.play('kingwalk');
    scene.boss = b;
    DTT.UI.banner(DTT.UI.t('boss_name'));
    DTT.UI.bossBar(1, DTT.UI.t('boss_name'));
    scene.sfx.boss();
    return b;
  }

  function removeBoss(scene) {
    if (!scene.boss) return;
    scene.boss.destroy();
    scene.boss = null;
    DTT.UI.bossBar(null);
  }

  function update(scene, dt) {
    const p = scene.player;
    scene.enemies.getChildren().forEach((e) => {
      if (e.getData('dead')) return;
      const b = e.body;
      let stun = e.getData('stun');
      if (stun > 0) { e.setData('stun', stun - dt); return; }
      if (e.getData('kind') === 'rat') {
        let dir = e.getData('dir');
        if ((dir < 0 && b.blocked.left) || (dir > 0 && b.blocked.right)) dir = -dir;
        // рядом с игроком крыса бежит на него
        if (Math.abs(p.x - e.x) < 80 && Math.abs(p.y - e.y) < 20) dir = Math.sign(p.x - e.x) || dir;
        e.setData('dir', dir);
        b.setVelocityX(dir * DTT.RAT.speed);
        e.setFlipX(dir < 0);
      } else {
        // Крысиный король
        const dir = Math.sign(p.x - e.x) || 1;
        e.setData('dir', dir);
        e.setFlipX(dir < 0);
        if (b.blocked.down) b.setVelocityX(dir * DTT.BOSS.speed);
        let ts = e.getData('tSummon') - dt, tj = e.getData('tJump') - dt;
        if (ts <= 0) {
          ts = 5.5;
          const rats = scene.enemies.getChildren().filter((r) => r.getData('kind') === 'rat' && !r.getData('dead')).length;
          if (rats < 6) { spawnRat(scene, e.x - 10, e.y - 8); spawnRat(scene, e.x + 10, e.y - 8); }
          scene.sfx.squeak();
        }
        if (tj <= 0 && b.blocked.down) {
          tj = 4 + Math.random() * 3;
          b.setVelocity(dir * 150, -260);
          scene.time.delayedCall(700, () => { if (scene.boss) scene.cameras.main.shake(150, 0.004); });
        }
        e.setData({ tSummon: ts, tJump: tj });
      }
    });
  }

  // Удар киркой по врагам перед игроком. Возвращает true, если кого-то задели.
  function strike(scene, dir, dmg) {
    const p = scene.player;
    let hit = false;
    scene.enemies.getChildren().forEach((e) => {
      if (e.getData('dead')) return;
      const boss = e.getData('kind') === 'boss';
      const reach = boss ? 30 : 20;
      const dx = (e.x - p.x) * dir;
      if (dx < -4 || dx > reach || Math.abs(e.body.center.y - p.body.center.y) > (boss ? 22 : 12)) return;
      hit = true;
      const hp = e.getData('hp') - dmg;
      e.setData('hp', hp);
      e.setTintFill(0xffffff);
      scene.time.delayedCall(80, () => e.active && e.clearTint());
      e.body.setVelocity(dir * (boss ? 60 : 140), boss ? -40 : -90);
      e.setData('stun', boss ? 0.15 : 0.35);
      scene.floatText(e.x, e.y - 12, '-' + dmg, '#e43b44');
      if (boss) DTT.UI.bossBar(Math.max(0, hp) / DTT.BOSS.hp, DTT.UI.t('boss_name'));
      if (hp <= 0) kill(scene, e);
    });
    return hit;
  }

  function kill(scene, e) {
    e.setData('dead', true);
    const boss = e.getData('kind') === 'boss';
    scene.burstAt(e.x, e.y, boss ? 0xfeae34 : 0x8b9bb4, boss ? 30 : 8);
    const coins = boss ? DTT.BOSS.coins : DTT.RAT.coins;
    scene.S.coins += coins;
    scene.floatText(e.x, e.y - 18, '+' + coins, '#fee761');
    scene.dirty = true;
    e.destroy();
    if (boss) {
      scene.boss = null;
      scene.onBossDefeated();
    } else {
      scene.sfx.squeak();
    }
  }

  return { init, spawnRat, spawnBoss, removeBoss, update, strike };
})();
