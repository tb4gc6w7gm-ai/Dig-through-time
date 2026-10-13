// Деревня на поверхности: здания, ферма, животные, гномы, украшения. Перестраивается при покупках.
window.DTT = window.DTT || {};

DTT.Village = (function () {
  const { TILE, SURF, MINE_X } = DTT;
  const G = SURF * TILE;           // линия земли в пикселях
  const tx = (x) => x * TILE;

  let objs = [];
  let crops = [];
  let animals = [];

  function add(scene, o) { objs.push(o); return o; }

  function build(scene) {
    objs.forEach((o) => { scene.tweens.killTweensOf(o); o.destroy(); });
    objs = []; crops = []; animals = [];
    const S = scene.S;
    const img = (x, key, depth) => add(scene, scene.add.image(x, G, key).setOrigin(0, 1).setDepth(depth || 1));

    // облака
    [[40, 22, 0.5], [380, 40, 0.35], [700, 16, 0.45], [960, 34, 0.4]].forEach(([x, y, sp]) => {
      const c = add(scene, scene.add.image(x, y, 'cloud').setDepth(0.5).setAlpha(0.9));
      scene.tweens.add({ targets: c, x: x + 140, duration: 40000 / sp, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });

    // ---- ферма ----
    if (S.farm.built) {
      img(tx(10), 'barn');
      for (let i = 0; i < 8; i++) {
        if (i < S.farm.plots.length) {
          add(scene, scene.add.image(tx(2 + i) + 8, G, 'soil').setOrigin(0.5, 1).setDepth(1.15));
          const spr = add(scene, scene.add.image(tx(2 + i) + 8, G, 'crops', 0).setOrigin(0.5, 1).setDepth(1.2));
          crops.push(spr);
        }
      }
      [13, 14, 15].forEach((x) => add(scene, scene.add.image(tx(x), G, 'fence').setOrigin(0, 1).setDepth(1.6)));
      S.farm.animals.forEach((a, i) => {
        const spr = add(scene, scene.add.sprite(tx(13) + 4 + ((i * 13) % 40), G - 1, a.type, 0).setOrigin(0.5, 1).setDepth(1.4));
        spr.setData({ dir: i % 2 ? 1 : -1, t: Math.random() * 3 });
        animals.push(spr);
      });
    } else {
      img(tx(8), 'sign', 1.2);
    }

    // ---- дом ----
    const houseKey = ['house0', 'house1', 'house2'][S.house.lvl];
    const hw = { house0: 32, house1: 48, house2: 64 }[houseKey];
    add(scene, scene.add.image(tx(18) + 8 - hw / 2, G, houseKey).setOrigin(0, 1).setDepth(1));

    img(tx(21), 'hall');
    img(tx(26), 'shop');
    add(scene, scene.add.image(tx(MINE_X) + 8, G, 'headframe').setOrigin(0.5, 1).setDepth(1));
    img(tx(36), 'museum');
    if (S.lodge.built) img(tx(41), 'lodge'); else img(tx(42), 'sign', 1.2);
    img(tx(45), 'tailor');

    // ---- украшения ----
    const has = (id) => S.decor.includes(id);
    if (has('flowers')) [25, 30, 35, 44, 49].forEach((x) => img(tx(x), 'flowers', 1.3));
    if (has('lamps')) [29, 34, 40, 48].forEach((x) => img(tx(x), 'lamp', 1.1));
    if (has('well')) img(tx(50), 'well');
    if (has('flags')) [16, 52, 58].forEach((x) => img(tx(x), 'flags', 1.1));
    if (has('fountain')) img(tx(53), 'fountain');
    if (has('statue')) img(tx(56), 'statue');
    if (has('mill')) {
      img(tx(59), 'mill');
      const bl = add(scene, scene.add.image(tx(59) + 24, G - 46, 'blades').setDepth(1.05));
      scene.tweens.add({ targets: bl, angle: 360, duration: 9000, repeat: -1 });
    }

    // ---- гномы ходят между своим домом и шахтой ----
    const n = S.lodge.built ? Math.min(S.lodge.gnomes, 4) : 0;
    for (let i = 0; i < n; i++) {
      const g = add(scene, scene.add.sprite(tx(42), G, 'gnome', 0).setOrigin(0.5, 1).setDepth(1.5).setFlipX(true));
      g.play('gnomewalk');
      scene.tweens.add({
        targets: g, x: tx(MINE_X) + 8, duration: 5200, delay: i * 1600, yoyo: true, repeat: -1, hold: 900, repeatDelay: 900,
        onYoyo: () => g.setFlipX(false), onRepeat: () => g.setFlipX(true),
      });
    }
    refresh(scene);
  }

  // обновить стадии урожая
  function refresh(scene) {
    const S = scene.S, now = Date.now();
    crops.forEach((spr, i) => {
      const p = S.farm.plots[i];
      const info = DTT.Sim.plotInfo(S, p, now);
      spr.setVisible(!info.empty);
      if (!info.empty) spr.setFrame(['wheat', 'carrot', 'pumpkin'].indexOf(info.crop) * 4 + info.stage);
    });
  }

  // животные бродят по загону
  function update(scene, dt) {
    animals.forEach((a) => {
      let t = a.getData('t') - dt, dir = a.getData('dir');
      if (t <= 0) {
        t = 1 + Math.random() * 3;
        dir = Math.random() < 0.4 ? 0 : Math.random() < 0.5 ? -1 : 1;
        a.setFrame(dir === 0 ? 1 : 0);
      }
      if (dir) {
        a.x += dir * 8 * dt;
        if (a.x < tx(13) + 4) { a.x = tx(13) + 4; dir = 1; }
        if (a.x > tx(16) - 4) { a.x = tx(16) - 4; dir = -1; }
        a.setFlipX(dir < 0);
      }
      a.setData({ t, dir });
    });
  }

  return { build, refresh, update };
})();
