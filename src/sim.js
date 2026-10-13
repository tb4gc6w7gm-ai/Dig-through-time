// Логика деревни без графики: ферма, гномы, дом, бонусы. Всё считается по реальному времени.
window.DTT = window.DTT || {};

DTT.Sim = (function () {
  const furnitureOf = (id) => DTT.FURNITURE.find((f) => f.id === id);

  function maxHearts(S) {
    return DTT.HEARTS_BASE + S.house.items.filter((id) => furnitureOf(id) && furnitureOf(id).heart).length;
  }

  // % надбавки к цене руды
  function sellBonus(S) {
    const furn = S.house.items.filter((id) => { const f = furnitureOf(id); return f && !f.heart && !f.boss; }).length;
    return furn * DTT.FURNITURE_BONUS + S.decor.length * DTT.DECOR_BONUS;
  }
  function oreValue(S, items) {
    const raw = items.reduce((a, t) => a + (DTT.DEFS[t].value || 0), 0);
    return Math.round(raw * (1 + sellBonus(S) / 100));
  }

  // ---------- ферма ----------
  function growMs(S, crop) {
    return DTT.CROPS[crop].time * 1000 * (S.decor.includes('mill') ? DTT.MILL_SPEED : 1);
  }
  function plotInfo(S, plot, now) {
    if (!plot.crop) return { empty: true };
    const total = growMs(S, plot.crop);
    const k = Math.min(1, (now - plot.t0) / total);
    return { crop: plot.crop, k, ready: k >= 1, stage: k >= 1 ? 3 : k >= 0.5 ? 2 : k >= 0.15 ? 1 : 0, left: Math.max(0, total - (now - plot.t0)) };
  }
  function animalInfo(a, now) {
    if (!a.fedAt) return { hungry: true };
    const total = DTT.ANIMALS[a.type].time * 1000;
    const k = Math.min(1, (now - a.fedAt) / total);
    return { k, ready: k >= 1, left: Math.max(0, total - (now - a.fedAt)) };
  }

  function plant(S, i, crop) {
    const p = S.farm.plots[i];
    const seed = DTT.CROPS[crop].seed;
    if (!p || p.crop || S.coins < seed) return false;
    S.coins -= seed;
    p.crop = crop; p.t0 = Date.now();
    return true;
  }
  function harvest(S, i, now) {
    const p = S.farm.plots[i];
    if (!p || !plotInfo(S, p, now).ready) return false;
    S.farm.barn[p.crop] = (S.farm.barn[p.crop] || 0) + 1;
    p.crop = null; p.t0 = 0;
    return true;
  }
  function harvestAll(S, now) {
    let n = 0;
    S.farm.plots.forEach((p, i) => { if (harvest(S, i, now)) n++; });
    return n;
  }
  function feedAll(S, now) {
    let fed = 0, missing = 0;
    S.farm.animals.forEach((a) => {
      if (a.fedAt) return;
      const food = DTT.ANIMALS[a.type].food;
      if ((S.farm.barn[food] || 0) > 0) { S.farm.barn[food]--; a.fedAt = now; fed++; } else missing++;
    });
    return { fed, missing };
  }
  function collectAll(S, now) {
    let n = 0;
    S.farm.animals.forEach((a) => {
      if (animalInfo(a, now).ready) {
        const prod = DTT.ANIMALS[a.type].product;
        S.farm.barn[prod] = (S.farm.barn[prod] || 0) + 1;
        a.fedAt = null; n++;
      }
    });
    return n;
  }
  function sellBarn(S, kind) {
    const prices = kind === 'crops'
      ? Object.fromEntries(Object.entries(DTT.CROPS).map(([k, v]) => [k, v.sell]))
      : DTT.PRODUCTS;
    let total = 0;
    Object.keys(prices).forEach((k) => {
      const n = S.farm.barn[k] || 0;
      total += n * prices[k];
      S.farm.barn[k] = 0;
    });
    S.coins += total;
    return total;
  }

  // ---------- гномы ----------
  function lodgeRatePerMin(S) {
    const L = S.lodge;
    if (!L.built || !L.gnomes) return 0;
    return DTT.gnomeRate(S.maxDepth, L.tools) * L.gnomes;
  }
  function lodgeCap(S) { return DTT.LODGE.storage[S.lodge.storage]; }
  function tickLodge(S, now) {
    const L = S.lodge;
    const elapsed = Math.max(0, Math.min(now - (L.lastTick || now), DTT.LODGE.offlineCapH * 3600 * 1000));
    L.lastTick = now;
    const before = L.stored;
    L.stored = Math.min(lodgeCap(S), L.stored + lodgeRatePerMin(S) * elapsed / 60000);
    return L.stored - before;
  }

  // Что произошло, пока игрока не было
  function offlineReport(S, now) {
    const away = now - (S.savedAt || now);
    if (away < 60 * 1000) return null;
    const gnomes = Math.floor(tickLodge(S, now));
    const crops = S.farm.plots.filter((p) => plotInfo(S, p, now).ready).length;
    const products = S.farm.animals.filter((a) => animalInfo(a, now).ready).length;
    if (!gnomes && !crops && !products) return null;
    return { away, gnomes, crops, products };
  }

  return {
    maxHearts, sellBonus, oreValue, growMs, plotInfo, animalInfo,
    plant, harvest, harvestAll, feedAll, collectAll, sellBarn,
    lodgeRatePerMin, lodgeCap, tickLodge, offlineReport,
  };
})();
