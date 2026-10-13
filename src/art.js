// Процедурный пиксель-арт. Палитра Endesga 32, всё рисуется кодом.
window.DTT = window.DTT || {};

DTT.Art = (function () {
  const C = {
    k: '#181425', k2: '#262b44', k3: '#3a4466', g1: '#5a6988', g2: '#8b9bb4', g3: '#c0cbdc', w: '#ffffff',
    dirt: '#b86f50', dirtD: '#733e39', dirtDD: '#3e2731', dirtL: '#e4a672', sand: '#ead4aa',
    grass: '#63c74d', grassD: '#3e8948', grassDD: '#265c42', red: '#e43b44', redD: '#a22633', rust: '#be4a2f',
    orange: '#f77622', copper: '#d77643', yellow: '#feae34', gold: '#fee761',
    skin: '#e8b796', skinD: '#c28569', blue: '#124e89', blueL: '#0099db', cyan: '#2ce8f5', purple: '#68386c',
    pink: '#f6757a', magenta: '#b55088', clay: '#9e5a45', clayD: '#6e3b32',
  };

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return [c, ctx];
  }

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const P = (ctx) => ({
    ctx,
    r: (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); },
    p: (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); },
    line: (pts, c) => { ctx.fillStyle = c; pts.forEach(([x, y]) => ctx.fillRect(x, y, 1, 1)); },
  });

  // ================= тайлы =================
  function speckle(d, R, base, dark, light, nDark, nLight) {
    d.r(0, 0, 16, 16, base);
    for (let i = 0; i < nDark; i++) d.p((R() * 16) | 0, (R() * 16) | 0, dark);
    for (let i = 0; i < nLight; i++) d.p((R() * 16) | 0, (R() * 16) | 0, light);
  }
  function stoneBase(d, R) {
    speckle(d, R, C.g1, C.k3, C.g2, 22, 12);
    for (let i = 0; i < 2; i++) {
      const x = (R() * 13) | 0, y = (R() * 14) | 0;
      d.p(x, y, C.k3); d.p(x + 1, y, C.k3); d.p(x + 2, y + 1, C.k3);
    }
  }
  function graniteBase(d, R) {
    speckle(d, R, C.k3, C.k2, C.g1, 26, 16);
    for (let i = 0; i < 6; i++) d.p((R() * 16) | 0, (R() * 16) | 0, C.purple);
  }
  function clayBase(d, R) {
    speckle(d, R, C.clay, C.clayD, C.dirtL, 26, 6);
    for (let y = 3; y < 16; y += 5) for (let x = 0; x < 16; x++) if (R() < 0.5) d.p(x, y, C.clayD);
  }
  function darkBase(d, R) {
    speckle(d, R, C.k2, C.k, C.k3, 24, 14);
    for (let i = 0; i < 4; i++) d.p((R() * 16) | 0, (R() * 16) | 0, C.purple);
  }
  function brickBase(d) {
    d.r(0, 0, 16, 16, C.k2);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let bx = -8; bx < 16; bx += 8) {
        const x = bx + off, y = row * 4;
        const x0 = Math.max(0, x), x1 = Math.min(16, x + 7);
        if (x1 <= x0) continue;
        d.r(x0, y, x1 - x0, 3, C.g1);
        d.r(x0, y, x1 - x0, 1, C.g2);
      }
    }
  }
  function blob(d, R, x, y, main, hi, sh) {
    d.r(x, y, 3, 2, main);
    if (R() < 0.6) d.r(x + 1, y + 2, 2, 1, main);
    d.p(x, y, hi);
    d.p(x + 2, y + 1, sh);
  }
  function blobs(d, R, n, main, hi, sh) {
    const spots = [[2, 2], [9, 3], [4, 9], [11, 10], [7, 6]];
    for (let i = 0; i < n; i++) {
      const s = spots[(i + ((R() * 5) | 0)) % 5];
      blob(d, R, s[0] + ((R() * 2) | 0), s[1] + ((R() * 2) | 0), main, hi, sh);
    }
  }
  function gems(d, list, main, hi, sh) {
    list.forEach(([x, y]) => { d.r(x, y, 3, 3, main); d.p(x, y, hi); d.p(x + 2, y + 2, sh); d.p(x + 1, y - 1, main); });
  }
  function glint(d, x, y) {
    d.r(x, y + 1, 4, 3, C.yellow);
    d.r(x + 1, y, 2, 1, C.gold);
    d.p(x + 1, y + 1, C.gold);
    d.p(x + 3, y + 3, C.orange);
    d.p(x + 5, y - 1, C.w);
    d.p(x + 6, y - 2, C.w);
  }
  function lava(d, shift) {
    d.r(0, 0, 16, 16, C.orange);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const v = Math.sin((x + shift) * 0.8 + y * 0.5) + Math.sin(y * 0.9 - (x - shift) * 0.4);
      if (v > 1.1) d.p(x, y, C.gold); else if (v > 0.3) d.p(x, y, C.yellow); else if (v < -1.1) d.p(x, y, C.red);
    }
    d.r(0, 0, 16, 1, C.gold);
  }
  function grassTop(d, R) {
    speckle(d, R, C.dirt, C.dirtD, C.dirtL, 18, 4);
    d.r(0, 0, 16, 3, C.grass);
    for (let x = 0; x < 16; x++) {
      if (R() < 0.5) d.p(x, 3, C.grass);
      if (R() < 0.35) d.p(x, 0, C.grassD);
    }
    d.r(0, 4, 16, 1, C.dirtD);
  }

  function drawTile(i, d, R) {
    const T = DTT.T;
    switch (i) {
      case T.GRASS: case T.VGRASS: grassTop(d, R); break;
      case T.DIRT: case T.VDIRT: case T.W_DIRT: speckle(d, R, C.dirt, C.dirtD, C.dirtL, 22, 5); break;
      case T.STONE: case T.W_STONE: stoneBase(d, R); break;
      case T.COAL: stoneBase(d, R); blobs(d, R, 4, C.k, C.k3, C.k); break;
      case T.COPPER: stoneBase(d, R); blobs(d, R, 3, C.copper, C.dirtL, C.rust); break;
      case T.IRON: stoneBase(d, R); blobs(d, R, 3, C.skin, C.w, C.skinD); break;
      case T.GRANITE: graniteBase(d, R); break;
      case T.QUARTZ:
        graniteBase(d, R);
        [[3, 4], [9, 2], [7, 9], [12, 10]].forEach(([x, y]) => { d.r(x, y, 2, 4, C.cyan); d.p(x, y, C.w); d.p(x + 1, y + 3, C.blueL); });
        break;
      case T.ART: stoneBase(d, R); glint(d, 5, 7); break;
      case T.SEAM:
        d.r(0, 0, 16, 16, C.orange);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const v = Math.sin(x * 0.7 + y * 0.35) + Math.sin(y * 1.1 - x * 0.2);
          if (v > 1.1) d.p(x, y, C.gold); else if (v > 0.4) d.p(x, y, C.yellow); else if (v < -1.2) d.p(x, y, C.red);
        }
        break;
      case T.BRICK: case T.W_BRICK: brickBase(d); break;
      case T.SILVER: clayBase(d, R); blobs(d, R, 3, C.g3, C.w, C.g2); break;
      case T.BEDROCK: speckle(d, R, C.k, C.k2, C.k3, 30, 10); break;
      case T.ART_M: brickBase(d); glint(d, 5, 7); break;
      case T.CLAY: case T.W_CLAY: clayBase(d, R); break;
      case T.DARK: case T.W_DARK: darkBase(d, R); break;
      case T.GOLD: darkBase(d, R); blobs(d, R, 3, C.yellow, C.gold, C.orange); break;
      case T.RUBY: darkBase(d, R); gems(d, [[3, 3], [10, 5], [6, 10]], C.red, C.pink, C.redD); break;
      case T.LAVA: lava(d, 0); break;
      case T.LAVA2: lava(d, 3); break;
      case T.RUBBLE:
        speckle(d, R, C.k3, C.k2, C.g1, 10, 4);
        for (let k = 0; k < 7; k++) {
          const x = (R() * 12) | 0, y = (R() * 12) | 0;
          d.r(x, y, 4, 3, k % 2 ? C.g1 : C.g2); d.p(x, y, C.g3); d.p(x + 3, y + 2, C.k2);
        }
        break;
      case T.SEAL:
        d.r(0, 0, 16, 16, C.purple);
        d.r(0, 0, 16, 1, C.magenta); d.r(0, 15, 16, 1, C.k2);
        [[7, 3], [3, 7], [11, 7], [7, 11]].forEach(([x, y]) => d.r(x, y, 2, 2, C.pink));
        d.r(6, 6, 4, 4, C.magenta); d.r(7, 7, 2, 2, C.w);
        break;
      case T.HATCH:
        speckle(d, R, C.dirtD, C.dirtDD, C.dirt, 10, 4);
        d.r(1, 0, 14, 5, C.dirt); d.r(1, 0, 14, 1, C.dirtL);
        [4, 8, 12].forEach((x) => d.r(x, 0, 1, 5, C.dirtD));
        d.r(1, 5, 14, 1, C.dirtDD); d.r(7, 2, 2, 1, C.k3);
        break;
    }
    if (i >= DTT.FIRST_WALL && i <= DTT.T.W_DARK) {
      d.r(0, 0, 16, 16, i === DTT.T.W_BRICK ? 'rgba(24,20,37,0.78)' : 'rgba(24,20,37,0.68)');
    }
  }

  function makeTileset(scene) {
    const n = DTT.TILE_COUNT, cell = 18;
    const [big, bctx] = canvas(n * cell, cell);
    for (let i = 0; i < n; i++) {
      const [c, ctx] = canvas(16, 16);
      drawTile(i, P(ctx), rng(1000 + i * 77));
      const ox = i * cell + 1, oy = 1;
      bctx.drawImage(c, ox, oy);
      bctx.drawImage(c, 0, 0, 16, 1, ox, oy - 1, 16, 1);
      bctx.drawImage(c, 0, 15, 16, 1, ox, oy + 16, 16, 1);
      bctx.drawImage(c, 0, 0, 1, 16, ox - 1, oy, 1, 16);
      bctx.drawImage(c, 15, 0, 1, 16, ox + 16, oy, 1, 16);
    }
    scene.textures.addCanvas('tiles', big);
  }

  // ================= шахтёр =================
  // frame: 0 стоит, 1-2 шаг, 3 замах, 4 удар
  function drawMiner(d, frame, skin, pickLvl) {
    const { r, p } = d;
    const c = skin.c;
    const legX = frame === 1 ? [4, 11] : frame === 2 ? [6, 8] : [5, 9];
    legX.forEach((x) => {
      r(x - 1, 12, 4, 4, C.k);
      r(x, 12, 2, 2, c.body);
      r(x, 14, 2, 1, C.dirtDD);
      r(x - 1, 14, 1, 1, C.dirtDD);
    });
    r(3, 8, 10, 5, C.k);
    r(4, 9, 8, 3, c.body);
    r(6, 9, 1, 3, c.bodyL);
    r(9, 9, 1, 3, c.bodyL);
    r(4, 9, 1, 2, c.shirt);
    r(11, 9, 1, 2, c.shirt);
    p(4, 11, c.skin);
    p(11, 11, c.skin);
    r(4, 5, 8, 4, C.k);
    r(5, 6, 6, 2, c.skin);
    r(5, 8, 6, 1, c.skinD);
    p(9, 6, C.k);
    r(4, 1, 8, 1, C.k);
    r(3, 2, 10, 3, C.k);
    r(4, 2, 7, 2, c.hat);
    r(3, 4, 10, 1, c.hatD);
    r(5, 2, 2, 1, C.w);
    r(11, 2, 2, 2, C.gold);
    p(13, 3, C.w);
    // кирка: цвет головки зависит от уровня
    const H = C.dirtD, M = DTT.PICK_COLORS[pickLvl] || C.g3;
    let head;
    if (frame === 3) {
      d.line([[3, 9], [2, 8], [2, 7], [1, 6]], H);
      head = [[0, 6], [0, 5], [1, 4], [2, 4], [3, 5]];
    } else if (frame === 4) {
      d.line([[12, 10], [13, 11], [14, 12]], H);
      head = [[13, 9], [14, 10], [15, 11], [15, 12], [15, 13], [14, 14]];
    } else {
      d.line([[12, 12], [12, 11], [12, 10], [12, 9], [12, 8]], H);
      head = [[10, 8], [11, 7], [12, 7], [13, 7], [14, 8]];
    }
    d.line(head, M);
    if (pickLvl >= 5) p(head[2][0], head[2][1], C.w);   // блеск у дорогих кирок
  }

  // Холст шахтёра можно перерисовать при смене скина или кирки
  function redrawMiner(scene, skinIdx, pickLvl) {
    const tex = scene.textures.get('miner');
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, 80, 16);
    const skin = DTT.SKINS[skinIdx] || DTT.SKINS[0];
    for (let f = 0; f < 5; f++) {
      ctx.save(); ctx.translate(f * 16, 0);
      drawMiner(P(ctx), f, skin, pickLvl);
      ctx.restore();
    }
    tex.refresh();
  }

  // ================= спрайты =================
  function addSheet(scene, key, frames, fw, fh, drawFn) {
    const [c, ctx] = canvas(frames * fw, fh);
    for (let f = 0; f < frames; f++) {
      ctx.save();
      ctx.translate(f * fw, 0);
      drawFn(P(ctx), f);
      ctx.restore();
    }
    const tex = scene.textures.addCanvas(key, c);
    for (let f = 0; f < frames; f++) tex.add(f, 0, f * fw, 0, fw, fh);
  }
  function addSingle(scene, key, w, h, drawFn) {
    const [c, ctx] = canvas(w, h);
    drawFn(P(ctx), ctx);
    scene.textures.addCanvas(key, c);
  }

  // тело-«треугольник»: крыша, пирамида
  function roof(d, x0, x1, yBase, color, color2) {
    for (let i = 0; x0 + i <= x1 - i; i++) d.r(x0 + i, yBase - i, x1 - x0 - 2 * i + 1, 1, i % 2 && color2 ? color2 : color);
  }
  function windowPx(d, x, y, w, h) {
    d.r(x, y, w, h, C.k); d.r(x + 1, y + 1, w - 2, h - 2, C.cyan); d.r(x + 1, y + 1, 2, 2, C.w);
  }
  function planks(d, x, y, w, h, base, line) {
    d.r(x, y, w, h, base);
    for (let yy = y + 2; yy < y + h; yy += 3) d.r(x, yy, w, 1, line);
  }

  const BUILD = {
    shop: (d) => {
      planks(d, 4, 16, 40, 24, C.dirt, C.dirtD);
      for (let i = 0; i < 9; i++) d.r(i * 2 + 2, 15 - i, 44 - i * 4, 1, i % 2 ? C.red : C.redD);
      d.r(0, 15, 48, 2, C.redD);
      d.r(20, 26, 8, 14, C.dirtDD); d.p(26, 33, C.yellow);
      windowPx(d, 8, 22, 8, 7); windowPx(d, 32, 22, 8, 7);
      d.r(17, 17, 14, 8, C.k); d.r(18, 18, 12, 6, C.sand);
      d.r(22, 19, 4, 4, C.yellow); d.r(23, 19, 2, 1, C.gold); d.r(23, 20, 2, 2, C.orange);
    },
    museum: (d) => {
      for (let i = 0; i < 7; i++) d.r(4 + i * 4, 12 - i, 48 - i * 8, 1, C.g2);
      d.r(2, 12, 52, 3, C.g3);
      d.r(4, 15, 48, 19, C.k3);
      for (let x = 6; x < 52; x += 10) { d.r(x, 15, 4, 19, C.w); d.r(x + 3, 15, 1, 19, C.g3); }
      d.r(0, 34, 56, 2, C.g3); d.r(0, 36, 56, 2, C.g2); d.r(0, 38, 56, 2, C.g1);
      d.r(25, 7, 6, 4, C.yellow);
    },
    hall: (d) => {
      d.r(6, 18, 44, 26, C.sand);
      for (let x = 6; x < 50; x += 6) d.r(x, 18, 1, 26, C.dirtL);
      roof(d, 2, 53, 18, C.blue, C.blueL);
      d.r(24, 0, 8, 10, C.sand); d.r(25, 1, 6, 6, C.w); d.p(28, 3, C.k); d.r(28, 2, 1, 2, C.k); d.r(28, 4, 2, 1, C.k);
      d.r(23, 10, 10, 1, C.blue);
      d.r(24, 32, 8, 12, C.dirtDD); d.r(27, 32, 1, 12, C.k);
      windowPx(d, 10, 24, 8, 8); windowPx(d, 38, 24, 8, 8);
      d.r(4, 43, 48, 1, C.dirtD);
    },
    lodge: (d) => {
      // землянка-гриб
      d.r(6, 22, 36, 18, C.sand);
      for (let x = 6; x < 42; x += 4) d.r(x, 22, 1, 18, C.dirtL);
      roof(d, 0, 47, 24, C.red, C.redD);
      d.r(0, 24, 48, 2, C.redD);
      [[10, 14], [22, 8], [34, 15], [16, 20], [30, 19]].forEach(([x, y]) => d.r(x, y, 3, 2, C.w));
      d.r(20, 28, 8, 12, C.dirtDD); d.r(20, 27, 8, 1, C.k); d.p(26, 34, C.yellow);
      windowPx(d, 9, 28, 6, 6); windowPx(d, 33, 28, 6, 6);
    },
    tailor: (d) => {
      planks(d, 4, 16, 40, 24, C.magenta, C.purple);
      roof(d, 0, 47, 16, C.k3, C.g1);
      d.r(0, 16, 48, 2, C.k2);
      d.r(20, 26, 8, 14, C.dirtDD); d.p(26, 33, C.yellow);
      windowPx(d, 8, 22, 8, 7); windowPx(d, 32, 22, 8, 7);
      // вывеска с ножницами
      d.r(18, 4, 12, 9, C.k); d.r(19, 5, 10, 7, C.sand);
      d.line([[21, 6], [22, 7], [23, 8], [24, 8], [25, 8], [26, 7], [27, 6]], C.k3);
      d.r(21, 9, 2, 2, C.red); d.r(26, 9, 2, 2, C.red);
    },
    barn: (d) => {
      planks(d, 3, 14, 42, 26, C.redD, C.rust);
      roof(d, 0, 47, 14, C.dirtD, C.dirtDD);
      d.r(0, 14, 48, 2, C.dirtDD);
      d.r(16, 22, 16, 18, C.w); d.r(18, 24, 12, 16, C.redD);
      d.line([[18, 24], [19, 25], [20, 26], [21, 27], [22, 28], [23, 29], [24, 30], [25, 31], [26, 32], [27, 33], [28, 34], [29, 35]], C.w);
      d.line([[29, 24], [28, 25], [27, 26], [26, 27], [25, 28], [24, 29], [23, 30], [22, 31], [21, 32], [20, 33], [19, 34], [18, 35]], C.w);
      d.r(21, 8, 6, 5, C.k); d.r(22, 9, 4, 3, C.yellow);
    },
    house0: (d) => {
      planks(d, 4, 14, 24, 18, C.dirt, C.dirtD);
      roof(d, 0, 31, 14, C.grassD, C.grassDD);
      d.r(13, 21, 6, 11, C.dirtDD); d.p(17, 26, C.yellow);
      windowPx(d, 6, 18, 5, 5);
      d.r(22, 2, 3, 8, C.k3); d.r(22, 1, 3, 1, C.g1);
    },
    house1: (d) => {
      d.r(4, 16, 40, 24, C.sand);
      for (let x = 4; x < 44; x += 5) d.r(x, 16, 1, 24, C.dirtL);
      roof(d, 0, 47, 16, C.redD, C.red);
      d.r(0, 16, 48, 2, C.dirtD);
      d.r(20, 27, 8, 13, C.dirtD); d.r(20, 26, 8, 1, C.k); d.p(26, 33, C.yellow);
      windowPx(d, 7, 21, 8, 8); windowPx(d, 33, 21, 8, 8);
      d.r(36, 0, 4, 9, C.k3);
    },
    house2: (d) => {
      d.r(4, 20, 56, 32, C.g3);
      for (let y = 20; y < 52; y += 4) d.r(4, y, 56, 1, C.g2);
      roof(d, 0, 63, 20, C.blue, C.k3);
      d.r(0, 20, 64, 2, C.k3);
      d.r(26, 34, 12, 18, C.dirtD); d.r(26, 33, 12, 1, C.k); d.r(31, 34, 1, 18, C.k); d.p(30, 43, C.yellow); d.p(33, 43, C.yellow);
      windowPx(d, 8, 25, 9, 9); windowPx(d, 47, 25, 9, 9); windowPx(d, 8, 38, 9, 9); windowPx(d, 47, 38, 9, 9);
      windowPx(d, 28, 4, 8, 8);
      d.r(50, 2, 5, 10, C.k3);
    },
    headframe: (d) => {
      const wood = C.dirtD, woodL = C.dirt;
      for (let y = 8; y < 56; y++) {
        const t = (y - 8) / 48;
        d.r(Math.round(22 - t * 18), y, 3, 1, wood);
        d.r(Math.round(24 + t * 18), y, 3, 1, wood);
      }
      d.r(8, 40, 33, 2, woodL); d.r(14, 26, 21, 2, woodL);
      // колесо
      for (let a = 0; a < 24; a++) {
        const x = 25 + Math.round(Math.cos(a / 24 * Math.PI * 2) * 6), y = 10 + Math.round(Math.sin(a / 24 * Math.PI * 2) * 6);
        d.p(x, y, C.k3);
      }
      d.r(24, 9, 3, 3, C.g1);
      d.line([[25, 4], [25, 16], [19, 10], [31, 10]], C.k3);
      // канат
      d.r(24, 16, 1, 40, C.sand);
      // фонарь
      d.r(30, 30, 4, 5, C.k); d.r(31, 31, 2, 3, C.gold);
    },
    sign: (d) => {
      d.r(7, 8, 2, 8, C.dirtD);
      d.r(1, 2, 14, 8, C.k); d.r(2, 3, 12, 6, C.yellow);
      d.line([[3, 4], [4, 5], [5, 6], [6, 7], [7, 4], [8, 5], [9, 6], [10, 7], [11, 4], [12, 5]], C.k);
    },
    fence: (d) => {
      d.r(1, 6, 2, 10, C.dirtD); d.r(13, 6, 2, 10, C.dirtD); d.r(0, 8, 16, 2, C.dirt); d.r(0, 12, 16, 2, C.dirt);
    },
    well: (d) => {
      d.r(4, 18, 24, 14, C.g1); for (let x = 4; x < 28; x += 6) d.r(x, 18, 1, 14, C.k3); d.r(4, 24, 24, 1, C.k3);
      d.r(6, 2, 2, 16, C.dirtD); d.r(24, 2, 2, 16, C.dirtD);
      roof(d, 2, 29, 4, C.redD, C.red);
      d.r(14, 6, 1, 8, C.sand); d.r(12, 13, 5, 4, C.dirt);
    },
    flags: (d) => {
      d.r(7, 2, 2, 30, C.g2); d.r(9, 3, 7, 5, C.red); d.r(9, 8, 5, 2, C.redD); d.p(7, 1, C.yellow);
    },
    lamp: (d) => {
      d.r(7, 8, 2, 24, C.k3); d.r(5, 31, 6, 1, C.k3);
      d.r(4, 2, 8, 7, C.k); d.r(5, 3, 6, 5, C.gold); d.r(6, 4, 2, 2, C.w); d.r(3, 1, 10, 1, C.k);
    },
    flowers: (d) => {
      [[2, C.red], [6, C.yellow], [10, C.pink], [13, C.blueL]].forEach(([x, col]) => {
        d.r(x, 11, 1, 5, C.grassD); d.r(x - 1, 9, 3, 2, col); d.p(x, 9, C.w);
      });
      d.r(0, 14, 16, 2, C.grassD);
    },
    fountain: (d) => {
      d.r(2, 22, 44, 10, C.g2); d.r(4, 22, 40, 3, C.blueL); d.r(2, 21, 44, 1, C.g3);
      d.r(21, 8, 6, 14, C.g2); d.r(16, 10, 16, 3, C.g3); d.r(17, 11, 14, 1, C.blueL);
      [[22, 3], [25, 2], [23, 6], [26, 5], [14, 14], [33, 14], [12, 18], [35, 18]].forEach(([x, y]) => d.r(x, y, 1, 2, C.cyan));
    },
    statue: (d) => {
      d.r(4, 38, 24, 10, C.g2); d.r(4, 38, 24, 1, C.g3); d.r(8, 42, 16, 1, C.g1);
      d.r(11, 14, 10, 24, C.g3); d.r(12, 8, 8, 7, C.g3); d.r(10, 6, 12, 3, C.g2);
      d.r(13, 10, 2, 1, C.g1); d.r(21, 14, 2, 14, C.g2); d.r(19, 4, 9, 2, C.g2); d.r(22, 4, 2, 12, C.g2);
      d.r(11, 30, 10, 1, C.g2);
    },
    mill: (d) => {
      for (let y = 20; y < 64; y++) {
        const half = 8 + Math.round((y - 20) * 0.2);
        d.r(24 - half, y, half * 2, 1, y % 4 ? C.sand : C.dirtL);
      }
      roof(d, 12, 35, 22, C.dirtD, C.dirtDD);
      d.r(20, 50, 8, 14, C.dirtDD);
      windowPx(d, 21, 32, 6, 6);
    },
    blades: (d) => {
      d.r(23, 0, 2, 48, C.dirtD); d.r(0, 23, 48, 2, C.dirtD);
      d.r(25, 2, 6, 20, C.w); d.r(17, 26, 6, 20, C.w); d.r(2, 17, 20, 6, C.w); d.r(26, 25, 20, 6, C.w);
      d.r(22, 22, 4, 4, C.k3);
    },
    soil: (d) => {
      d.r(1, 13, 14, 3, C.dirtD); d.r(2, 13, 12, 1, C.dirtDD); [3, 7, 11].forEach((x) => d.r(x, 14, 2, 1, C.dirtDD));
    },
    cloud: (d) => {
      d.r(6, 4, 22, 6, C.w); d.r(10, 1, 10, 4, C.w); d.r(3, 7, 28, 4, C.w); d.r(3, 10, 28, 1, C.g3);
    },
  };
  const BUILD_SIZE = {
    shop: [48, 40], museum: [56, 40], hall: [56, 44], lodge: [48, 40], tailor: [48, 40], barn: [48, 40],
    house0: [32, 32], house1: [48, 40], house2: [64, 52], headframe: [48, 56], sign: [16, 16], fence: [16, 16],
    well: [32, 32], flags: [16, 32], lamp: [16, 32], flowers: [16, 16], fountain: [48, 32], statue: [32, 48],
    mill: [48, 64], blades: [48, 48], cloud: [32, 12], soil: [16, 16],
  };

  // урожай: 3 культуры × 4 стадии
  function drawCrop(d, crop, stage) {
    d.r(1, 13, 14, 3, C.dirtD); d.r(2, 13, 12, 1, C.dirtDD);
    if (stage === 0) { [[4, 12], [8, 12], [12, 12]].forEach(([x, y]) => d.p(x, y, C.sand)); return; }
    const stems = [4, 8, 12];
    if (stage === 1) { stems.forEach((x) => { d.r(x, 10, 1, 3, C.grass); d.p(x - 1, 10, C.grass); }); return; }
    if (stage === 2) {
      stems.forEach((x) => { d.r(x, 6, 1, 7, C.grassD); d.p(x - 1, 8, C.grass); d.p(x + 1, 7, C.grass); });
      return;
    }
    if (crop === 'wheat') {
      stems.forEach((x) => { d.r(x, 5, 1, 8, C.dirtL); d.r(x - 1, 2, 3, 4, C.yellow); d.p(x, 1, C.gold); });
    } else if (crop === 'carrot') {
      stems.forEach((x) => { d.r(x - 1, 11, 3, 2, C.orange); d.r(x, 6, 1, 5, C.grass); d.p(x - 1, 7, C.grass); d.p(x + 1, 6, C.grass); });
    } else {
      d.r(3, 7, 10, 6, C.orange); d.r(2, 8, 12, 4, C.orange); d.r(5, 7, 1, 6, C.copper); d.r(10, 7, 1, 6, C.copper);
      d.r(7, 5, 2, 2, C.grassD); d.p(4, 8, C.dirtL);
    }
  }

  function makeAll(scene, S) {
    makeTileset(scene);
    const mt = scene.textures.createCanvas('miner', 80, 16);
    for (let f = 0; f < 5; f++) mt.add(f, 0, f * 16, 0, 16, 16);
    redrawMiner(scene, S.skin || 0, S.pick || 0);

    addSheet(scene, 'cracks', 4, 16, 16, ({ p }, f) => {
      const lines = [
        [[7, 7], [8, 7], [8, 8], [9, 9]],
        [[6, 6], [5, 5], [10, 9], [10, 10], [7, 8], [6, 9]],
        [[4, 4], [3, 4], [11, 11], [12, 11], [5, 10], [4, 11], [9, 6], [10, 5]],
        [[2, 3], [1, 2], [13, 12], [14, 13], [3, 12], [2, 13], [11, 4], [12, 3], [8, 12], [8, 13]],
      ];
      for (let i = 0; i <= f; i++) lines[i].forEach(([x, y]) => p(x, y, C.k));
    });

    addSheet(scene, 'torch', 2, 16, 16, ({ r, p }, f) => {
      r(7, 9, 2, 6, C.dirtD); r(6, 8, 4, 1, C.k3);
      r(7, 6, 2, 2, C.orange); r(7, 5, 2, 1, C.yellow);
      p(f ? 7 : 8, 4, C.yellow); p(f ? 8 : 7, 3, C.gold); p(f ? 6 : 9, 6, C.red);
    });

    addSheet(scene, 'rat', 2, 16, 16, ({ r, p, line }, f) => {
      line([[0, 12], [1, 13], [2, 13], [3, 12]], C.pink);
      r(3, 9, 9, 5, C.k3); r(4, 10, 7, 3, C.g1); r(5, 10, 3, 1, C.g2);
      r(11, 9, 4, 4, C.g1); p(14, 11, C.pink); p(13, 10, C.red); p(11, 8, C.pink); p(12, 8, C.pink);
      const lx = f ? [4, 9] : [5, 10];
      lx.forEach((x) => r(x, 14, 1, 2, C.k2));
    });

    addSheet(scene, 'ratking', 2, 32, 32, ({ r, p, line }, f) => {
      line([[0, 24], [1, 25], [2, 26], [3, 26], [4, 25], [5, 24]], C.pink);
      r(5, 13, 20, 14, C.k2); r(6, 14, 18, 12, C.k3); r(8, 15, 10, 3, C.g1);
      r(4, 12, 10, 12, C.redD); r(5, 13, 3, 10, C.red);   // мантия
      r(21, 11, 10, 10, C.k3); r(22, 12, 8, 8, C.g1);
      p(29, 16, C.pink); p(30, 16, C.pink); r(26, 13, 2, 2, C.red); p(26, 13, C.gold);
      r(21, 9, 2, 3, C.pink); r(28, 9, 2, 3, C.pink);
      // корона из ключей
      r(21, 6, 10, 3, C.yellow); [[21, 3], [24, 4], [27, 3], [30, 4]].forEach(([x, y]) => r(x, y, 1, 3, C.yellow));
      p(24, 7, C.red); p(28, 7, C.cyan);
      // зубы
      p(29, 19, C.w); p(30, 19, C.w);
      const lx = f ? [8, 19] : [10, 21];
      lx.forEach((x) => r(x, 27, 3, 5, C.k2));
    });

    addSheet(scene, 'gnome', 2, 16, 16, ({ r, p }, f) => {
      for (let i = 0; i < 5; i++) r(5 + Math.floor(i / 2), 1 + i, 6 - i, 1, C.red);
      r(4, 6, 8, 1, C.redD);
      r(5, 7, 6, 2, C.skin); p(9, 7, C.k);
      r(4, 9, 8, 3, C.w); r(5, 12, 6, 1, C.w);
      r(5, 10, 6, 3, C.blue);
      r(f ? 4 : 5, 13, 2, 3, C.dirtDD); r(f ? 10 : 9, 13, 2, 3, C.dirtDD);
      r(12, 6, 1, 7, C.dirtD); r(11, 5, 4, 1, C.g3);
    });

    const animal = {
      chicken: ({ r, p }, f) => {
        r(4, 8, 8, 5, C.w); r(3, 9, 2, 3, C.g3);
        const hx = f ? 11 : 10, hy = f ? 8 : 5;
        r(hx, hy, 4, 4, C.w); p(hx + 2, hy + 1, C.k); r(hx + 1, hy - 1, 2, 1, C.red); r(hx + 4, hy + 2, 2, 1, C.yellow);
        r(6, 13, 1, 3, C.orange); r(9, 13, 1, 3, C.orange);
      },
      sheep: ({ r, p }, f) => {
        r(3, 6, 10, 7, C.w); r(2, 7, 12, 5, C.sand); r(4, 6, 2, 2, C.w); r(8, 6, 2, 2, C.w);
        r(12, f ? 8 : 6, 4, 4, C.k2); p(14, f ? 9 : 7, C.w);
        r(4, 13, 2, 3, C.k2); r(10, 13, 2, 3, C.k2);
      },
      cow: ({ r, p }, f) => {
        r(1, 5, 12, 7, C.w); r(3, 6, 3, 3, C.k); r(8, 8, 3, 3, C.k);
        r(12, f ? 6 : 4, 4, 5, C.w); r(13, f ? 9 : 7, 3, 2, C.pink); p(13, f ? 6 : 4, C.k); p(12, f ? 5 : 3, C.sand);
        r(2, 12, 2, 4, C.g2); r(10, 12, 2, 4, C.g2); r(0, 6, 1, 4, C.k2);
      },
    };
    Object.keys(animal).forEach((k) => addSheet(scene, k, 2, 16, 16, animal[k]));

    const crops = ['wheat', 'carrot', 'pumpkin'];
    addSheet(scene, 'crops', 12, 16, 16, (d, f) => drawCrop(d, crops[Math.floor(f / 4)], f % 4));

    Object.keys(BUILD).forEach((k) => {
      const [w, h] = BUILD_SIZE[k];
      addSingle(scene, k, w, h, BUILD[k]);
    });
  }

  // ================= HTML-иконки (dataURL) =================
  const cache = {};
  function url(key, w, h, fn) {
    if (cache[key]) return cache[key];
    const [c, ctx] = canvas(w, h);
    fn(P(ctx), ctx);
    cache[key] = c.toDataURL();
    return cache[key];
  }

  const ICONS = {
    cap: ({ r }) => { r(4, 4, 8, 8, C.g2); r(3, 5, 10, 6, C.g2); r(5, 3, 6, 10, C.g2); r(5, 5, 6, 6, C.red); r(6, 6, 2, 1, C.w); },
    phone: ({ r, p }) => { r(5, 1, 7, 14, C.k); r(6, 2, 5, 10, C.blueL); [[7, 4], [8, 5], [9, 6], [8, 7], [9, 9]].forEach(([x, y]) => p(x, y, C.w)); },
    helmet: ({ r }) => { r(3, 5, 10, 5, C.yellow); r(4, 4, 8, 1, C.yellow); r(5, 3, 6, 1, C.yellow); r(2, 10, 12, 2, C.orange); r(6, 5, 4, 3, C.gold); r(7, 6, 2, 1, C.w); },
    diary1: ({ r }) => { r(3, 2, 10, 12, C.sand); r(11, 2, 2, 2, C.dirtL); for (let y = 4; y < 13; y += 2) r(4, y, 7, 1, C.dirtD); },
    soldier: ({ r, p }) => { r(6, 1, 4, 3, C.k); r(6, 4, 4, 3, C.skin); p(8, 5, C.k); r(5, 7, 6, 4, C.redD); r(6, 11, 4, 4, C.blue); r(11, 2, 1, 10, C.dirtD); },
    diary2: ({ r }) => { r(3, 2, 10, 12, C.sand); r(3, 12, 3, 2, C.dirtL); for (let y = 4; y < 11; y += 2) r(4, y, 8, 1, C.dirtD); r(9, 10, 3, 2, C.orange); },
    signet: ({ r, p }, ctx) => { r(4, 6, 8, 8, C.yellow); r(5, 3, 6, 4, C.gold); r(6, 4, 4, 2, C.redD); p(7, 4, C.red); ctx.clearRect(6, 8, 4, 4); },
    coin: ({ r, p }) => { r(4, 3, 8, 10, C.g3); r(3, 4, 10, 8, C.g3); r(5, 5, 6, 6, C.g2); r(7, 6, 2, 4, C.w); p(5, 4, C.w); },
    map: ({ r }) => { r(2, 3, 12, 10, C.sand); r(2, 3, 12, 1, C.dirtL); r(4, 6, 8, 1, C.orange); r(4, 8, 8, 1, C.clay); r(4, 10, 8, 1, C.k3); r(9, 5, 2, 2, C.red); },
    diary3: ({ r }) => { r(3, 2, 10, 12, C.sand); for (let y = 4; y < 13; y += 2) r(4, y, 7, 1, C.dirtD); r(10, 3, 2, 3, C.k3); },
    hourglass: ({ r, p }) => { r(4, 1, 8, 2, C.dirtD); r(4, 13, 8, 2, C.dirtD); r(5, 3, 6, 4, C.cyan); r(7, 7, 2, 2, C.cyan); r(5, 9, 6, 4, C.cyan); r(6, 3, 4, 2, C.yellow); p(7, 8, C.yellow); },
    diary4: ({ r }) => { r(3, 2, 10, 12, C.sand); for (let y = 4; y < 13; y += 2) r(4, y, 8, 1, C.dirtD); r(4, 11, 4, 2, C.red); },
    crown: ({ r, p }) => { r(2, 8, 12, 5, C.yellow); [[2, 4], [6, 5], [9, 4], [13, 5]].forEach(([x, y]) => r(x, y, 1, 4, C.yellow)); p(5, 10, C.red); p(8, 10, C.cyan); p(11, 10, C.grass); r(2, 12, 12, 1, C.orange); },
  };
  function iconURL(id) { return url('art_' + id, 16, 16, ICONS[id]); }

  function pickIconURL(lvl) {
    return url('pick_' + lvl, 16, 16, (d) => {
      d.line([[3, 13], [4, 12], [5, 11], [6, 10], [7, 9], [8, 8], [9, 7]], C.dirtD);
      d.line([[2, 14], [3, 14], [2, 13]], C.dirtDD);
      const M = DTT.PICK_COLORS[lvl];
      [[6, 3], [7, 3], [8, 3], [9, 4], [10, 5], [11, 6], [12, 7], [12, 8], [13, 9], [5, 2], [4, 2], [9, 3], [10, 4], [11, 5], [12, 6], [13, 8]].forEach(([x, y]) => d.p(x, y, M));
      if (lvl >= 5) { d.p(8, 3, C.w); d.p(12, 7, C.w); }
    });
  }
  function skinURL(idx) {
    return url('skin_' + idx, 16, 16, (d) => drawMiner(d, 0, DTT.SKINS[idx], 0));
  }
  function spriteURL(key, frame) {
    return url('spr_' + key + frame, 16, 16, (d) => {
      if (key === 'crops') drawCrop(d, ['wheat', 'carrot', 'pumpkin'][Math.floor(frame / 4)], frame % 4);
    });
  }
  const PRODUCT_ICONS = {
    egg: ({ r }) => { r(5, 4, 6, 9, C.w); r(4, 6, 8, 6, C.w); r(6, 5, 2, 2, C.g3); r(5, 12, 6, 1, C.sand); },
    wool: ({ r }) => { r(3, 5, 10, 7, C.w); r(2, 7, 12, 4, C.sand); [[4, 4], [8, 4], [11, 6]].forEach(([x, y]) => r(x, y, 2, 2, C.w)); },
    milk: ({ r }) => { r(5, 3, 6, 2, C.g2); r(4, 5, 8, 9, C.w); r(4, 8, 8, 2, C.blueL); r(5, 13, 6, 1, C.g3); },
    chicken: null, sheep: null, cow: null,
  };
  function productURL(id) {
    if (PRODUCT_ICONS[id]) return url('prod_' + id, 16, 16, PRODUCT_ICONS[id]);
    return url('ani_' + id, 16, 16, (d) => ANIMAL_DRAW[id](d, 0));
  }
  const ANIMAL_DRAW = {
    chicken: ({ r, p }) => { r(4, 8, 8, 5, C.w); r(3, 9, 2, 3, C.g3); r(10, 5, 4, 4, C.w); p(12, 6, C.k); r(11, 4, 2, 1, C.red); r(14, 7, 2, 1, C.yellow); r(6, 13, 1, 3, C.orange); r(9, 13, 1, 3, C.orange); },
    sheep: ({ r, p }) => { r(3, 6, 10, 7, C.w); r(2, 7, 12, 5, C.sand); r(12, 6, 4, 4, C.k2); p(14, 7, C.w); r(4, 13, 2, 3, C.k2); r(10, 13, 2, 3, C.k2); },
    cow: ({ r, p }) => { r(1, 5, 12, 7, C.w); r(3, 6, 3, 3, C.k); r(8, 8, 3, 3, C.k); r(12, 4, 4, 5, C.w); r(13, 7, 3, 2, C.pink); p(13, 4, C.k); r(2, 12, 2, 4, C.g2); r(10, 12, 2, 4, C.g2); },
  };

  // ================= интерьер дома =================
  const FURN = {
    bed: (d) => { d.r(4, 70, 40, 14, C.dirtD); d.r(4, 66, 6, 22, C.dirtD); d.r(6, 70, 36, 6, C.w); d.r(14, 70, 28, 8, C.red); d.r(15, 71, 26, 1, C.pink); d.r(7, 68, 6, 4, C.w); },
    table: (d) => { d.r(56, 72, 26, 3, C.dirt); d.r(58, 75, 2, 13, C.dirtD); d.r(78, 75, 2, 13, C.dirtD); d.r(64, 68, 4, 4, C.w); d.r(65, 66, 2, 2, C.orange); },
    chair: (d) => { d.r(84, 66, 2, 22, C.dirtD); d.r(84, 78, 9, 2, C.dirt); d.r(91, 80, 2, 8, C.dirtD); },
    rug: (d) => { d.r(50, 90, 70, 5, C.redD); d.r(52, 91, 66, 3, C.red); for (let x = 54; x < 116; x += 6) d.r(x, 92, 2, 1, C.yellow); },
    plant: (d) => { d.r(45, 80, 10, 8, C.rust); d.r(46, 80, 8, 1, C.copper); d.r(49, 66, 2, 14, C.grassD); d.r(44, 68, 6, 4, C.grass); d.r(50, 64, 6, 4, C.grass); d.r(46, 74, 4, 3, C.grassD); },
    shelf: (d) => {
      d.r(112, 36, 26, 52, C.dirtD); d.r(114, 38, 22, 48, C.dirtDD);
      [48, 62, 76].forEach((y) => d.r(114, y, 22, 2, C.dirt));
      const books = [C.red, C.blue, C.grassD, C.yellow, C.purple, C.orange];
      [40, 54, 68].forEach((y, row) => { for (let i = 0; i < 5; i++) d.r(116 + i * 4, y + (i % 2), 3, 8 - (i % 2), books[(i + row) % 6]); });
    },
    chest: (d) => { d.r(96, 76, 15, 12, C.dirt); d.r(96, 76, 15, 4, C.dirtD); d.r(96, 80, 15, 1, C.k3); d.r(102, 79, 3, 3, C.yellow); },
    painting: (d) => { d.r(22, 18, 28, 20, C.yellow); d.r(24, 20, 24, 16, C.cyan); d.r(24, 30, 24, 6, C.grassD); d.r(36, 24, 6, 6, C.gold); d.r(28, 28, 6, 3, C.w); },
    fireplace: (d, t) => {
      d.r(140, 50, 34, 38, C.g1); d.r(138, 48, 38, 4, C.g2); d.r(146, 60, 22, 28, C.k);
      for (let y = 52; y < 88; y += 4) d.r(140, y, 34, 1, C.k3);
      d.r(150, 80, 14, 4, C.dirtD);
      const f = t % 2;
      d.r(152, 72 - f, 10, 8 + f, C.orange); d.r(154, 70 + f, 6, 8, C.yellow); d.r(156, 74, 2, 4, C.gold);
    },
    clock: (d) => { d.r(178, 40, 12, 48, C.dirtD); d.r(180, 44, 8, 8, C.sand); d.p(184, 46, C.k); d.r(184, 47, 1, 3, C.k); d.r(181, 56, 6, 26, C.dirtDD); d.r(183, 66, 2, 12, C.yellow); },
    trophy: (d) => {
      d.r(150, 42, 14, 6, C.g2);
      d.r(151, 36, 12, 5, C.yellow); [[151, 33], [155, 34], [158, 33], [162, 34]].forEach(([x, y]) => d.r(x, y, 1, 3, C.yellow));
      d.p(154, 38, C.red); d.p(158, 38, C.cyan);
    },
  };
  function drawInterior(cnv, houseLvl, items, t) {
    const ctx = cnv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const d = P(ctx);
    const wall = [[C.dirt, C.dirtD], [C.sand, C.dirtL], [C.purple, C.magenta]][houseLvl];
    d.r(0, 0, 192, 108, wall[0]);
    for (let x = 0; x < 192; x += houseLvl === 2 ? 12 : 8) d.r(x, 0, 1, 88, wall[1]);
    if (houseLvl === 2) for (let x = 6; x < 192; x += 12) for (let y = 8; y < 88; y += 12) d.p(x, y, C.gold);
    d.r(0, 88, 192, 20, C.dirtD);
    for (let x = 0; x < 192; x += 16) d.r(x, 88, 1, 20, C.dirtDD);
    d.r(0, 88, 192, 1, C.dirtDD);
    d.r(84, 16, 24, 22, C.k); d.r(86, 18, 20, 18, C.cyan); d.r(95, 18, 1, 18, C.k); d.r(86, 26, 20, 1, C.k); d.r(87, 19, 4, 3, C.w);
    const order = ['rug', 'painting', 'shelf', 'fireplace', 'clock', 'bed', 'table', 'chair', 'chest', 'plant', 'trophy'];
    order.forEach((id) => { if (items.includes(id)) FURN[id](d, t || 0); });
  }

  return { makeAll, redrawMiner, iconURL, pickIconURL, skinURL, spriteURL, productURL, drawInterior, rng, C };
})();
