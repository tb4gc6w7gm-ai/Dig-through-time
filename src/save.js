// Сохранения: автосохранение (текущая игра) + 3 ручных слота. Позже можно заменить на облачные сохранения площадки.
window.DTT = window.DTT || {};

DTT.Save = (function () {
  const AUTO = 'dtt_v2_auto';
  const SLOT = (n) => 'dtt_v2_slot' + n;
  const BOOT = 'dtt_v2_boot';   // sessionStorage: пропустить титульный экран после перезагрузки

  function fresh() {
    const now = Date.now();
    return {
      v: 2,
      seed: (Math.random() * 1e9) | 0,
      coins: 0, pick: 0, bag: 0, lamp: 0, torches: 3, hearts: DTT.HEARTS_BASE,
      skin: 0, skinsOwned: [0],
      bagItems: [], mods: {}, placed: [], museum: [], flags: {},
      px: null, py: null, lang: null, maxDepth: 0,
      seen: '', open: '',
      house: { lvl: 0, items: [] },
      decor: [],
      farm: { built: false, plots: [{ crop: null, t0: 0 }, { crop: null, t0: 0 }], animals: [], barn: {} },
      lodge: { built: false, gnomes: 0, tools: 0, storage: 0, stored: 0, lastTick: now },
      startedAt: now, playMs: 0, savedAt: now,
    };
  }

  function read(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.v !== 2) return null;
      return Object.assign(fresh(), data);
    } catch (e) {
      return null;
    }
  }
  function write(key, state) {
    try {
      state.savedAt = Date.now();
      localStorage.setItem(key, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }
  function remove(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }

  function meta(state) {
    if (!state) return null;
    return { savedAt: state.savedAt, coins: state.coins, depth: state.maxDepth, museum: state.museum.length, playMs: state.playMs };
  }

  // Битовые маски «видел / открыто» для карты → base64
  function packBits(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  }
  function unpackBits(str, len) {
    const out = new Uint8Array(len);
    if (!str) return out;
    try {
      const s = atob(str);
      for (let i = 0; i < Math.min(len, s.length); i++) out[i] = s.charCodeAt(i);
    } catch (e) { /* испорченная маска — начинаем с пустой */ }
    return out;
  }

  function bootFlag(v) {
    try {
      if (v === undefined) { const x = sessionStorage.getItem(BOOT); sessionStorage.removeItem(BOOT); return x; }
      sessionStorage.setItem(BOOT, v);
    } catch (e) { return null; }
    return null;
  }

  return {
    fresh,
    loadAuto: () => read(AUTO),
    saveAuto: (s) => write(AUTO, s),
    clearAuto: () => remove(AUTO),
    loadSlot: (n) => read(SLOT(n)),
    saveSlot: (n, s) => write(SLOT(n), s),
    slotMeta: (n) => meta(read(SLOT(n))),
    autoMeta: () => meta(read(AUTO)),
    packBits, unpackBits, bootFlag,
  };
})();
