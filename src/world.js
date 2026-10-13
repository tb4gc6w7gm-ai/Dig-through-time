// Генерация мира по seed: блоки, задний план, артефакты, руины, лава, зал босса.
window.DTT = window.DTT || {};

DTT.World = (function () {
  function hash(x, y, s) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function noise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s);
    const c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  }

  // Случайное блуждание с шагом не больше 1 — линия без диагональных дыр
  function walk(R, n, center, spread) {
    const out = new Int16Array(n);
    let v = center;
    for (let x = 0; x < n; x++) {
      const r = R();
      if (r < 0.3) v--; else if (r > 0.7) v++;
      v = Math.max(center - spread, Math.min(center + spread, v));
      out[x] = v;
    }
    return out;
  }

  function generate(seed) {
    const { W, H, SURF, SEAM1, SEAL, END_D, T, MINE_X, MINE_DEPTH, ARENA } = DTT;
    const R = DTT.Art.rng(seed);
    const fg = new Int16Array(W * H).fill(-1);
    const bg = new Int16Array(W * H).fill(-1);
    const cave = new Uint8Array(W * H);
    const at = (x, y) => y * W + x;
    const set = (x, y, v) => { fg[at(x, y)] = v; };

    const seam = walk(R, W, SEAM1, 3);
    const bottom = walk(R, W, END_D, 3);

    for (let y = SURF; y < H; y++) {
      const d = y - SURF;
      for (let x = 0; x < W; x++) {
        const i = at(x, y);
        const s = seam[x];

        // ---- задний план ----
        if (d <= 3) bg[i] = T.W_DIRT;
        else if (d < s) bg[i] = d + (noise(x * 0.09, y * 0.09, seed + 3) - 0.5) * 10 < 6 ? T.W_DIRT : T.W_STONE;
        else if (d <= s + 1) bg[i] = T.W_STONE;
        else bg[i] = d + (noise(x * 0.07, y * 0.07, seed + 5) - 0.5) * 12 >= 100 ? T.W_DARK : T.W_CLAY;

        // ---- блоки ----
        if (x === 0 || x === W - 1 || d >= bottom[x] || y === H - 1) { set(x, y, T.BEDROCK); continue; }

        // деревня: копать можно только в стволе шахты
        if (d <= 3) {
          if (x === MINE_X) { set(x, y, d === 0 ? T.HATCH : -1); continue; }
          set(x, y, d === 0 ? T.VGRASS : T.VDIRT);
          continue;
        }
        if (x === MINE_X && d <= MINE_DEPTH) { set(x, y, -1); continue; }

        const ore = (k, f, th) => noise(x * f, y * f, seed + k) > th;

        // Эпоха I
        if (d < s) {
          const dd = d + (noise(x * 0.09, y * 0.09, seed + 3) - 0.5) * 10;
          let t = dd < 6 ? T.DIRT : T.STONE;
          if (dd < 30 && ore(1, 0.18, 0.68)) t = T.DIRT;
          if (dd >= 33 && ore(2, 0.2, dd >= 48 ? 0.38 : 0.5)) t = T.GRANITE;
          if (d >= 4 && ore(11, 0.42, 0.78)) t = T.COAL;
          if (d >= 10 && ore(12, 0.45, 0.8)) t = T.COPPER;
          if (d >= 24 && ore(13, 0.45, 0.81)) t = T.IRON;
          if (d >= 40 && ore(14, 0.55, 0.85)) t = T.QUARTZ;
          if (d > 8 && d < s - 3 && noise(x * 0.14, y * 0.22, seed + 7) > 0.7) { t = -1; cave[i] = 1; }
          set(x, y, t);
          continue;
        }

        // шов времени, 2 блока толщиной
        if (d <= s + 1) { set(x, y, T.SEAM); continue; }

        // печать под залом босса
        if (d === SEAL || d === SEAL + 1) { set(x, y, T.SEAL); continue; }
        if (d > SEAL + 1) { set(x, y, T.DARK); continue; }

        // Эпоха II
        let t;
        if (d <= s + 5) {
          // переходная зона: камень первой эпохи вперемешку с глиной
          t = hash(x, y, seed + 9) < 0.55 - (d - s - 2) * 0.12 ? T.STONE : T.CLAY;
        } else {
          const dd = d + (noise(x * 0.07, y * 0.07, seed + 5) - 0.5) * 12;
          t = dd >= 100 ? T.DARK : T.CLAY;
        }
        if (ore(41, 0.45, 0.8)) t = T.SILVER;
        if (t === T.CLAY && d >= 85 && ore(42, 0.5, 0.85)) t = T.GOLD;
        if (t === T.DARK && ore(43, 0.5, 0.8)) t = T.GOLD;
        if (t === T.DARK && d >= 115 && ore(44, 0.55, 0.86)) t = T.RUBY;
        if (d > s + 6 && d < ARENA.d0 - 3 && noise(x * 0.13, y * 0.2, seed + 8) > 0.72) { t = -1; cave[i] = 1; }
        set(x, y, t);
      }
    }

    // ---- лава: лужи на дне глубоких пещер (снизу вверх, не глубже 2 блоков) ----
    const solid = (x, y) => { const v = fg[at(x, y)]; return v >= 0 && v !== T.LAVA; };
    for (let y = H - 2; y > SURF; y--) {
      const d = y - SURF;
      if (d < 42) break;
      for (let x = 1; x < W - 1; x++) {
        if (!cave[at(x, y)]) continue;
        const th = d >= 90 ? 0.45 : 0.6;
        if (noise(x * 0.2, y * 0.2, seed + 21) < th) continue;
        const below = fg[at(x, y + 1)];
        if (solid(x, y + 1) || (below === T.LAVA && solid(x, y + 2))) set(x, y, T.LAVA);
      }
    }

    // ---- руины: комнаты с кирпичными стенами ----
    const rooms = [];
    for (let tries = 0; tries < 60 && rooms.length < 12; tries++) {
      const w = 7 + Math.floor(R() * 8), h = 3;
      const x0 = 3 + Math.floor(R() * (W - w - 6));
      const y0 = SURF + 68 + Math.floor(R() * 62);
      const x1 = x0 + w - 1, y1 = y0 + h - 1;
      const clash = rooms.some((r) => x0 - 3 < r.x1 && x1 + 3 > r.x0 && y0 - 3 < r.y1 && y1 + 3 > r.y0);
      if (clash) continue;
      rooms.push({ x0, x1, y0, y1 });
    }
    rooms.sort((a, b) => a.y0 - b.y0);
    const carveRoom = (x0, x1, y0, y1) => {
      for (let y = y0 - 1; y <= y1 + 1; y++) {
        for (let x = x0 - 1; x <= x1 + 1; x++) {
          const wall = y < y0 || y > y1 || x < x0 || x > x1;
          bg[at(x, y)] = T.W_BRICK;
          if (wall) set(x, y, hash(x, y, seed + 31) < 0.12 && y <= y1 ? T.CLAY : T.BRICK);
          else set(x, y, -1);
        }
      }
    };
    const sconces = [];
    rooms.forEach((r) => {
      carveRoom(r.x0, r.x1, r.y0, r.y1);
      sconces.push([Math.floor((r.x0 + r.x1) / 2), r.y0 + 1]);
    });

    // ---- зал босса ----
    const ay0 = SURF + ARENA.d0, ay1 = SURF + ARENA.d1;
    carveRoom(ARENA.x0, ARENA.x1, ay0, ay1);
    for (let x = ARENA.x0 + 3; x < ARENA.x1; x += 8) sconces.push([x, ay0 + 1]);
    // каменные колонны-укрытия
    [18, 31, 45].forEach((x) => { set(x, ay1, T.BRICK); set(x, ay1 - 1, T.BRICK); });

    // ---- артефакты ----
    const arts = {};
    const used = new Set();
    for (const a of DTT.ARTIFACTS) {
      if (a.boss) continue;
      let x, y;
      if (a.era === 2 && rooms.length) {
        let best = null;
        rooms.forEach((r, k) => {
          if (used.has(k)) return;
          if (!best || Math.abs(r.y0 - SURF - a.d) < Math.abs(rooms[best].y0 - SURF - a.d)) best = k;
        });
        if (best !== null) {
          used.add(best);
          const r = rooms[best];
          x = r.x1; y = r.y1;
        }
      }
      if (x === undefined) {
        y = SURF + a.d;
        do { x = 3 + Math.floor(R() * (W - 6)); } while (Math.abs(x - MINE_X) < 2);
      }
      set(x, y, a.era === 2 ? T.ART_M : T.ART);
      arts[at(x, y)] = a.id;
    }

    // ---- крысы в комнатах поглубже ----
    const rats = [];
    rooms.forEach((r) => {
      if (r.y0 - SURF < 74) return;
      const n = 1 + (R() < 0.5 ? 1 : 0);
      for (let k = 0; k < n; k++) rats.push([r.x0 + 1 + Math.floor(R() * (r.x1 - r.x0 - 2)), r.y1]);
    });

    return { fg, bg, arts, sconces, rats, seam };
  }

  return { generate };
})();
