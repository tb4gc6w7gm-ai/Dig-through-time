// Запись превью-видео прямо из игры.
// Подключается в открытую игру (через консоль): кадры прокручиваются вручную
// по 30 к/с и отправляются на devserver в release/frames/<name>/.
// Потом: tools/make-videos.sh склеивает кадры в mp4.
window.REC = (function () {
  const FPS = 30, DT = 1000 / FPS;
  let t = performance.now(), n = 0, name = 'landscape';
  const copy = document.createElement('canvas');

  // демо-состояние: отстроенная деревня, сильная кирка и яркий фонарь
  function demoState() {
    const s = DTT.Save.fresh(), now = Date.now();
    s.seed = 424242;
    s.lang = 'en';
    Object.assign(s, { coins: 4200, pick: 6, bag: 8, lamp: 7, torches: 30, maxDepth: 70 });
    s.flags = { hintDig: true, hintSell: true, hintDark: true, era1: true, era2: true, sconces: true, seam1: true };
    s.house = { lvl: 2, items: ['bed', 'table', 'rug', 'plant', 'shelf', 'fireplace'] };
    s.decor = ['flowers', 'well', 'flags', 'lamps', 'mill', 'fountain', 'statue'];
    s.farm = {
      built: true,
      plots: ['wheat', 'carrot', 'pumpkin', 'wheat', 'carrot', 'wheat'].map((c, i) => ({ crop: c, t0: now - (i % 3 + 1) * 160000 })),
      animals: [{ type: 'chicken', fedAt: null }, { type: 'chicken', fedAt: null }, { type: 'sheep', fedAt: null }, { type: 'cow', fedAt: null }],
      barn: {},
    };
    s.lodge = { built: true, gnomes: 4, tools: 2, storage: 1, stored: 0, lastTick: now };
    s.px = 23 * 16 + 8; s.py = (DTT.SURF - 1) * 16 + 8;
    return s;
  }
  function prepare() {
    // иначе игра при перезагрузке запишет своё автосохранение поверх демо
    if (window.DTT && DTT.game && DTT.game.scene.getScene('play')) DTT.game.scene.getScene('play').noSave = true;
    localStorage.setItem('dtt_v2_auto', JSON.stringify(demoState()));
    sessionStorage.setItem('dtt_v2_boot', 'continue');
    location.reload();
  }

  const sc = () => DTT.game.scene.getScene('play');
  const keys = () => DTT.UI.touch;
  function release() { const k = keys(); k.left = k.right = k.up = k.down = false; }

  async function shot() {
    const gl = DTT.game.canvas;
    if (copy.width !== gl.width) { copy.width = gl.width; copy.height = gl.height; }
    copy.getContext('2d').drawImage(gl, 0, 0);       // снимок в том же такте, пока буфер WebGL цел
    const blob = await new Promise((r) => copy.toBlob(r, 'image/png'));
    n++;
    await fetch(`/release/frames/${name}/f${String(n).padStart(4, '0')}.png`, { method: 'PUT', body: blob });
  }
  // прокрутить игру на N кадров; each(i) вызывается перед каждым кадром
  async function play(frames, each) {
    for (let i = 0; i < frames; i++) {
      if (each) each(i);
      t += DT;
      DTT.game.step(t, DT);
      await shot();
    }
  }
  function warp(tx, ty) {
    const p = sc().player;
    p.body.reset(tx * 16 + 8, ty * 16 + 8);
    p.body.setVelocity(0, 0);
    sc().cameras.main.centerOn(p.x, p.y);
  }
  function fadeIn() { sc().cameras.main.fadeIn(280, 24, 20, 37); }
  function fadeOut() { sc().cameras.main.fadeOut(240, 24, 20, 37); }
  function clearTiles(cells) { cells.forEach(([x, y]) => { if (sc().fg.getTileAt(x, y)) sc().setTile(x, y, -1); }); }

  // лучшее место для копания: больше всего руды в окне 6×5 на глубине 18–45
  function oreSpot() {
    const S = DTT.SURF, fg = sc().fg;
    let best = null;
    for (let y = S + 18; y < S + 45; y++) for (let x = 4; x < DTT.W - 10; x++) {
      let ore = 0;
      for (let dy = -1; dy < 4; dy++) for (let dx = 1; dx < 7; dx++) {
        const tl = fg.getTileAt(x + dx, y + dy);
        if (tl && DTT.DEFS[tl.index].value) ore++;
      }
      if (!best || ore > best.ore) best = { x, y, ore };
    }
    return best;
  }

  async function record(videoName) {
    name = videoName; n = 0; t = performance.now();
    const S = sc().S, k = keys();
    DTT.UI.close();
    release();
    // на время записи урон отключён (неуязвимость заставила бы шахтёра мигать)
    sc().hurt = () => {};
    const keepAlive = () => { sc().invuln = 0; };

    // 1) деревня: идём к люку и спускаемся (3.6 с)
    warp(24, DTT.SURF - 1);
    fadeIn();
    await play(108, (i) => {
      const px = sc().tilePos()[0];
      k.right = px < DTT.MINE_X;
      if (px >= DTT.MINE_X && i > 40) { k.right = false; k.down = true; }
    });
    release();
    await play(6, () => { k.down = true; });
    fadeOut();
    await play(8);
    release();

    // 2) копаем руду под землёй с факелом рядом (4.6 с)
    const spot = oreSpot();
    clearTiles([[spot.x, spot.y], [spot.x - 1, spot.y]]);
    sc().fg.putTileAt(DTT.T.STONE, spot.x, spot.y + 1);
    sc().fg.putTileAt(DTT.T.STONE, spot.x - 1, spot.y + 1);
    sc().addTorch(spot.x - 1, spot.y, false);
    warp(spot.x, spot.y);
    fadeIn();
    await play(138, (i) => {
      keepAlive();
      k.right = i < 95;
      k.down = i >= 95;
    });
    release();
    fadeOut();
    await play(8);

    // 3) руины второй эпохи: крыса у факелов (3 с)
    const rat = sc().enemies.getChildren().find((e) => e.getData('kind') === 'rat');
    if (rat) {
      // пустая клетка той же комнаты левее крысы
      const rx = Math.floor(rat.x / 16), ry = Math.floor(rat.body.center.y / 16);
      let wx = rx - 1;
      for (let dx = 4; dx >= 1; dx--) if (!sc().fg.getTileAt(rx - dx, ry)) { wx = rx - dx; break; }
      warp(wx, ry);
    }
    fadeIn();
    await play(90, (i) => {
      keepAlive();
      const r = sc().enemies.getChildren().find((e) => e.getData('kind') === 'rat' && Math.abs(e.y - sc().player.y) < 24);
      const dir = r ? Math.sign(r.x - sc().player.x) : 1;
      k.right = dir > 0; k.left = dir < 0;
    });
    release();
    fadeOut();
    await play(8);

    // 4) Крысиный король (4.4 с)
    S.flags.bossDead = false;
    const A = DTT.ARENA;
    warp(A.x0 + 16, DTT.SURF + A.d1);
    fadeIn();
    await play(132, (i) => {
      keepAlive();
      const b = sc().boss;
      if (!b) return;
      if (b.getData('hp') < 40) b.setData('hp', 120);      // бой не должен кончиться посреди ролика
      // держим дистанцию удара, чтобы шахтёр не залезал внутрь короля
      const dx = b.x - sc().player.x, dir = Math.sign(dx) || 1;
      const close = Math.abs(dx) < 24;
      k.right = close ? dir < 0 : dir > 0;
      k.left = close ? dir > 0 : dir < 0;
    });
    release();
    return { frames: n, seconds: (n / FPS).toFixed(1) };
  }

  return { prepare, record, oreSpot };
})();
