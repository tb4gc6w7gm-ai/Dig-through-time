// HTML-интерфейс поверх канваса: HUD, подсказки, окна зданий, меню, сохранения, мини-карта.
window.DTT = window.DTT || {};

DTT.UI = (function () {
  const $ = (id) => document.getElementById(id);
  let lang = 'en';
  let toastTimer = 0, bannerTimer = 0;
  let current = null;           // { name, render }
  let act = () => {};
  let promptHandler = null;
  const hudCache = {};
  const touch = { left: false, right: false, up: false, down: false };

  // ---------- тексты ----------
  function get(dict, key) {
    return key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);
  }
  function t(key, vars) {
    let s = get(DTT.STRINGS[lang], key);
    if (s == null) s = get(DTT.STRINGS.en, key);
    if (s == null) s = key;
    if (vars && typeof s === 'string') for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  function artText(id) { const a = DTT.ARTIFACT_TEXT[id]; return a[lang] || a.en; }
  function detectLang() {
    const n = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return DTT.STRINGS[n] ? n : 'en';
  }
  function fmtDur(ms) {
    const min = Math.max(1, Math.round(ms / 60000));
    const h = Math.floor(min / 60), m = min % 60;
    return ((h ? h + ' ' + t('h') + ' ' : '') + (m || !h ? m + ' ' + t('m') : '')).trim();
  }
  function fmtSec(ms) {
    const s = Math.ceil(ms / 1000);
    return s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : s + 's';
  }
  const coin = (v) => `<i class="coin"></i>${v}`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function setLang(l) {
    lang = l;
    document.documentElement.lang = l;
    $('btn-map').querySelector('span').textContent = t('map');
    $('btn-menu').querySelector('span').textContent = t('menu');
    $('btn-rope').querySelector('span').textContent = t('rope');
    $('btn-torch').querySelector('span').textContent = t('torch');
    for (const k in hudCache) delete hudCache[k];
    if (current) current.render();
  }

  // ---------- HUD ----------
  function setText(id, v) {
    if (hudCache[id] === v) return;
    hudCache[id] = v;
    $(id).textContent = v;
  }
  function setHUD(h) {
    setText('hud-coins', String(h.coins));
    setText('hud-depth', h.depth + ' m');
    setText('hud-bag', h.bagN + '/' + h.bagCap);
    setText('hud-torches', String(h.torches));
    $('hud-bag-wrap').classList.toggle('warn', h.bagN >= h.bagCap);
    const hk = h.hearts + '/' + h.maxHearts;
    if (hudCache.hearts !== hk) {
      hudCache.hearts = hk;
      $('hud-hearts').innerHTML = Array.from({ length: h.maxHearts }, (_, i) => `<i class="heart ${i < h.hearts ? '' : 'empty'}"></i>`).join('');
    }
    if (hudCache.pick !== h.pick) {
      hudCache.pick = h.pick;
      $('hud-pick').src = DTT.Art.pickIconURL(h.pick);
    }
  }

  function toast(msg, ms) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2600);
  }
  function banner(text) {
    const el = $('banner');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }
  function bossBar(k, name) {
    const el = $('bossbar');
    if (k == null) { el.hidden = true; return; }
    el.hidden = false;
    $('bossbar-name').textContent = name;
    $('bossbar-fill').style.width = Math.max(0, k * 100) + '%';
  }
  function prompt(text, onClick) {
    const el = $('prompt');
    promptHandler = onClick || null;
    if (!text) { el.hidden = true; return; }
    if (el.textContent !== text) el.textContent = text;
    el.hidden = false;
  }

  // ---------- модалка ----------
  function show(name, render, local) {
    current = { name, render, local };
    $('modal').hidden = false;
    render();
  }
  function paint(html, kind) {
    $('panel').innerHTML = html;
    $('panel').className = 'panel ' + (kind || '');
    $('panel').querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (current && current.local && current.local(b.dataset.act, b.dataset.arg)) return;
      act(b.dataset.act, b.dataset.arg, b.dataset.arg2);
    }));
    $('panel').querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  }
  function close() {
    const was = current && current.name;
    $('modal').hidden = true;
    current = null;
    if (was === 'artifact' && artifactQueue.length) showArtifact(...artifactQueue.shift());
  }
  function isOpen() { return current !== null; }
  function refresh(names) {
    if (current && (!names || names.includes(current.name))) current.render();
  }
  const foot = (left) => `<div class="foot">${left || '<span></span>'}<button class="close" data-close>${t('close')}</button></div>`;
  const btn = (label, a, arg, opts) => {
    const o = opts || {};
    return `<button class="buy ${o.dim ? 'dim' : ''} ${o.ghost ? 'ghost' : ''}" data-act="${a}" ${arg != null ? `data-arg="${arg}"` : ''} ${o.arg2 != null ? `data-arg2="${o.arg2}"` : ''} ${o.disabled ? 'disabled' : ''}>${label}</button>`;
  };
  const head = (title, right) => `<h2>${title} <span class="coins">${right || ''}</span></h2>`;

  // ---------- магазин ----------
  function openShop(S) {
    show('shop', () => {
      const U = DTT.UPGRADES;
      const row = (key, icon, title, lvl, maxLvl, stat, cost) => {
        const maxed = lvl >= maxLvl;
        return `<div class="row">${icon}
          <div class="row-main"><b>${title}</b> <small>${key === 'torches' ? '' : maxed ? t('max') : t('lvl') + ' ' + (lvl + 1) + '/' + (maxLvl + 1)}</small>
          <div class="stat">${stat}</div></div>
          ${maxed ? btn(t('max'), '', null, { disabled: true }) : btn(coin(cost), 'buy', key, { dim: S.coins < cost })}</div>`;
      };
      const pn = t('pick_names');
      const pMax = U.pick.cost.length - 1, pNext = Math.min(S.pick + 1, pMax);
      const img = (src) => `<img class="ico" src="${src}" alt="">`;
      paint(head(t('b_shop'), coin(S.coins)) +
        row('pick', img(DTT.Art.pickIconURL(pNext)), t('pickaxe') + ': ' + pn[S.pick] + (S.pick < pMax ? ' → ' + pn[pNext] : ''), S.pick, pMax,
          t('stat_pick', { p: U.pick.power[S.pick], d: U.pick.dmg[S.pick], t: U.pick.tier[S.pick] }), U.pick.cost[pNext]) +
        row('bag', '<i class="ico bagi big"></i>', t('backpack'), S.bag, U.bag.cost.length - 1,
          t('stat_bag', { c: U.bag.cap[S.bag] }), U.bag.cost[Math.min(S.bag + 1, U.bag.cost.length - 1)]) +
        row('lamp', '<i class="ico lampi"></i>', t('lantern'), S.lamp, U.lamp.cost.length - 1,
          t('stat_lamp', { r: U.lamp.radius[S.lamp], m: U.lamp.rated[S.lamp] }), U.lamp.cost[Math.min(S.lamp + 1, U.lamp.cost.length - 1)]) +
        row('torches', '<i class="ico torchi big"></i>', t('torches_pack'), 0, 1, t('stat_torch', { n: S.torches }), U.torches.cost) +
        foot(), 'shop');
    });
  }

  // ---------- музей ----------
  function openMuseum(S) {
    let selected = null;
    show('museum', () => {
      const slot = (a) => {
        const found = S.museum.includes(a.id);
        return `<button class="slot ${found ? 'found' : ''} ${selected === a.id ? 'sel' : ''}" data-act="museum_sel" data-arg="${a.id}">
          <img src="${DTT.Art.iconURL(a.id)}" alt=""><span>${found ? artText(a.id)[0] : t('unknown')}</span></button>`;
      };
      const era = (n) => DTT.ARTIFACTS.filter((a) => a.era === n).map(slot).join('');
      let note = '';
      if (selected) {
        note = S.museum.includes(selected)
          ? `<b>${artText(selected)[0]}</b><p>${artText(selected)[1]}</p>` : `<p>${t('unknown_text')}</p>`;
      }
      paint(head(t('b_museum'), S.museum.length + '/' + DTT.ARTIFACTS.length) +
        `<h3>${t('museum_era1')}</h3><div class="grid">${era(1)}</div>
         <h3>${t('museum_era2')}</h3><div class="grid">${era(2)}</div>
         <div class="note">${note}</div>` + foot(), 'museum');
    }, (a, arg) => {
      if (a !== 'museum_sel') return false;
      selected = arg;
      current.render();
      return true;
    });
  }

  function showArtifact(id, n, total) {
    if (current && current.name === 'artifact') { artifactQueue.push([id, n, total]); return; }
    const [name, text] = artText(id);
    show('artifact', () => paint(`
      <div class="found-label">${t('artifact_found')}</div>
      <img class="big-icon" src="${DTT.Art.iconURL(id)}" alt="">
      <h2 class="center">${name}</h2>
      <p class="story">${text}</p>
      <div class="sub">${t('added_museum', { n, t: total })}</div>
      <div class="foot center"><button class="close" data-close>${t('ok')}</button></div>`, 'artifact'));
  }
  const artifactQueue = [];

  // ---------- портной ----------
  function openTailor(S) {
    show('tailor', () => {
      const cards = DTT.SKINS.map((s, i) => {
        const owned = S.skinsOwned.includes(i), on = S.skin === i;
        const b = on ? btn(t('equipped'), '', null, { disabled: true })
          : owned ? btn(t('equip'), 'skin', i, { ghost: true }) : btn(coin(s.cost), 'skin', i, { dim: S.coins < s.cost });
        return `<div class="card ${on ? 'on' : ''}"><img src="${DTT.Art.skinURL(i)}" alt=""><span>${t('skins.' + s.id)}</span>${b}</div>`;
      }).join('');
      paint(head(t('b_tailor'), coin(S.coins)) + `<div class="cards">${cards}</div>` + foot(), 'tailor');
    });
  }

  // ---------- ратуша ----------
  function openHall(S) {
    show('hall', () => {
      const rows = DTT.DECOR.map((d) => {
        const built = S.decor.includes(d.id);
        const note = '+' + DTT.DECOR_BONUS + '%' + (d.effect === 'mill' ? ' · ' + t('mill_note') : '');
        return `<div class="row"><div class="row-main"><b>${t('decor.' + d.id)}</b><div class="stat">${note}</div></div>
          ${built ? btn(t('owned'), '', null, { disabled: true }) : btn(coin(d.cost), 'decor', d.id, { dim: S.coins < d.cost })}</div>`;
      }).join('');
      paint(head(t('b_hall'), coin(S.coins)) +
        `<p class="text">${t('hall_text', { b: DTT.DECOR_BONUS })}</p>
         <p class="text gold">${t('village_bonus', { b: DTT.Sim.sellBonus(S) })}</p>` + rows + foot(), 'hall');
    });
  }

  // ---------- дом ----------
  function openHouse(S) {
    show('house', () => {
      const H = DTT.HOUSE, lvl = S.house.lvl;
      const names = t('house_names');
      const used = S.house.items.filter((id) => id !== 'trophy').length;
      const rows = DTT.FURNITURE.map((f) => {
        const own = S.house.items.includes(f.id);
        const note = f.heart ? t('f_heart') : f.boss ? (S.flags.bossDead ? '' : t('f_boss')) : t('f_bonus', { b: DTT.FURNITURE_BONUS });
        let b;
        if (own) b = btn(t('owned'), '', null, { disabled: true });
        else if (f.boss) b = btn(S.flags.bossDead ? t('buy') : '🔒', 'furn', f.id, { disabled: !S.flags.bossDead, ghost: true });
        else b = btn(coin(f.cost), 'furn', f.id, { dim: S.coins < f.cost || used >= H.slots[lvl] });
        return `<div class="row slim"><div class="row-main"><b>${t('furn.' + f.id)}</b><div class="stat">${note}</div></div>${b}</div>`;
      }).join('');
      const up = lvl < H.cost.length - 1
        ? `<div class="row"><div class="row-main"><b>${t('house_up', { n: names[lvl + 1] })}</b><div class="stat">${t('slots', { n: H.slots[lvl], m: H.slots[lvl + 1] })}</div></div>${btn(coin(H.cost[lvl + 1]), 'house_up', null, { dim: S.coins < H.cost[lvl + 1] })}</div>`
        : '';
      paint(head(t('b_house') + ' · ' + names[lvl], coin(S.coins)) +
        `<canvas id="interior" width="192" height="108"></canvas>
         <div class="split"><span class="text">${t('slots', { n: used, m: H.slots[lvl] })}</span>${btn(t('rest'), 'rest', null, { ghost: true })}</div>` +
        up + rows + foot(), 'house');
      DTT.Art.drawInterior($('interior'), lvl, S.house.items, 0);
    });
  }

  // ---------- ферма ----------
  function openFarm(S) {
    show('farm', () => {
      const F = S.farm;
      if (!F.built) return paintBuild('farm', S);
      const now = Date.now();
      const cropIcon = (crop, stage) => `<img class="ico" src="${DTT.Art.spriteURL('crops', ['wheat', 'carrot', 'pumpkin'].indexOf(crop) * 4 + stage)}" alt="">`;
      const plots = F.plots.map((p, i) => {
        const info = DTT.Sim.plotInfo(S, p, now);
        if (info.empty) {
          const seeds = Object.keys(DTT.CROPS).map((c) =>
            `<button class="mini ${S.coins < DTT.CROPS[c].seed ? 'dim' : ''}" data-act="plant" data-arg="${i}" data-arg2="${c}">${cropIcon(c, 3)}<span>${DTT.CROPS[c].seed}</span></button>`).join('');
          return `<div class="plot"><div class="plot-name">${t('plot_empty')}</div><div class="seeds">${seeds}</div></div>`;
        }
        return `<div class="plot ${info.ready ? 'ready' : ''}">${cropIcon(info.crop, info.stage)}
          <div class="plot-name">${t('crop.' + info.crop)}</div>
          ${info.ready ? `<div class="ok">${t('ready')}</div>` : `<div class="bar"><i style="width:${info.k * 100}%"></i></div><small>${fmtSec(info.left)}</small>`}</div>`;
      }).join('');
      const nextPlot = DTT.FARM.plotCost[F.plots.length];
      const anyReady = F.plots.some((p) => DTT.Sim.plotInfo(S, p, now).ready);

      const animals = Object.keys(DTT.ANIMALS).map((type) => {
        const A = DTT.ANIMALS[type];
        const list = F.animals.filter((a) => a.type === type);
        const hungry = list.filter((a) => !a.fedAt).length;
        const ready = list.filter((a) => DTT.Sim.animalInfo(a, now).ready).length;
        const busy = list.filter((a) => a.fedAt && !DTT.Sim.animalInfo(a, now).ready);
        const soon = busy.length ? Math.min(...busy.map((a) => DTT.Sim.animalInfo(a, now).left)) : 0;
        const status = [hungry ? `<span class="warn-t">${t('hungry')}: ${hungry}</span>` : '', ready ? `<span class="ok">${t('ready')}: ${ready}</span>` : '', soon ? fmtSec(soon) : ''].filter(Boolean).join(' · ');
        const full = list.length >= DTT.FARM.maxPerAnimal;
        return `<div class="row slim"><img class="ico" src="${DTT.Art.productURL(type)}" alt="">
          <div class="row-main"><b>${t('animal.' + type)} ×${list.length}</b>
          <div class="stat">${t('eats', { f: t('crop.' + A.food) })} → ${t('product.' + A.product)} ${status ? '· ' + status : ''}</div></div>
          ${full ? btn(t('max'), '', null, { disabled: true }) : btn(coin(A.cost), 'animal', type, { dim: S.coins < A.cost })}</div>`;
      }).join('');

      const barnItems = [...Object.keys(DTT.CROPS), ...Object.keys(DTT.PRODUCTS)].map((k) => {
        const n = F.barn[k] || 0;
        const icon = DTT.CROPS[k] ? cropIcon(k, 3) : `<img class="ico" src="${DTT.Art.productURL(k)}" alt="">`;
        return `<span class="barn-item ${n ? '' : 'zero'}">${icon}${n}</span>`;
      }).join('');

      paint(head(t('b_farm'), coin(S.coins)) +
        `<h3>${t('plots')}</h3><div class="plots">${plots}</div>
         <div class="split">${btn(t('harvest_all'), 'harvest', null, { ghost: true, disabled: !anyReady })}
           ${nextPlot != null ? btn(t('buy_plot') + ' ' + coin(nextPlot), 'plot', null, { dim: S.coins < nextPlot }) : ''}</div>
         <h3>${t('animals')}</h3>${animals}
         <div class="split">${btn(t('feed_all'), 'feed', null, { ghost: true, disabled: !F.animals.some((a) => !a.fedAt) })}
           ${btn(t('collect_all'), 'collect_animals', null, { ghost: true, disabled: !F.animals.some((a) => DTT.Sim.animalInfo(a, now).ready) })}</div>
         <h3>${t('barn')}</h3><div class="barn">${barnItems}</div>
         <div class="split">${btn(t('sell_crops'), 'sell_crops', null, { ghost: true })}${btn(t('sell_products'), 'sell_products', null, { ghost: true })}</div>` +
        foot(), 'farm');
    });
  }

  // ---------- дом гномов ----------
  function openLodge(S) {
    show('lodge', () => {
      const L = S.lodge, D = DTT.LODGE;
      if (!L.built) return paintBuild('lodge', S);
      const hireCost = D.hire[L.gnomes];
      const toolsNext = D.toolsCost[L.tools + 1], storNext = D.storageCost[L.storage + 1];
      const rate = Math.round(DTT.Sim.lodgeRatePerMin(S) * 60);
      const cap = DTT.Sim.lodgeCap(S);
      const gnomeIcons = Array.from({ length: D.hire.length }, (_, i) => `<i class="gnome ${i < L.gnomes ? '' : 'off'}"></i>`).join('');
      paint(head(t('b_lodge'), coin(S.coins)) +
        `<p class="text">${t('lodge_text')}</p>
         <div class="gnomes">${gnomeIcons}</div>
         <div class="row"><div class="row-main"><b>${t('gnomes', { n: L.gnomes, m: D.hire.length })}</b><div class="stat">${t('rate', { r: rate })}</div></div>
           ${hireCost != null ? btn(coin(hireCost), 'hire', null, { dim: S.coins < hireCost }) : btn(t('max'), '', null, { disabled: true })}</div>
         <div class="row"><div class="row-main"><b>${t('tools')}</b> <small>${t('lvl')} ${L.tools + 1}/${D.toolsCost.length}</small><div class="stat">×${D.toolsMult[L.tools]}</div></div>
           ${toolsNext != null ? btn(coin(toolsNext), 'tools', null, { dim: S.coins < toolsNext }) : btn(t('max'), '', null, { disabled: true })}</div>
         <div class="row"><div class="row-main"><b>${t('storage')}</b> <small>${t('lvl')} ${L.storage + 1}/${D.storage.length}</small><div class="stat">${cap}</div></div>
           ${storNext != null ? btn(coin(storNext), 'storage', null, { dim: S.coins < storNext }) : btn(t('max'), '', null, { disabled: true })}</div>
         <div class="row gold-row"><div class="row-main"><b>${t('stored', { s: Math.floor(L.stored), c: cap })}</b>
           <div class="bar"><i style="width:${Math.min(100, L.stored / cap * 100)}%"></i></div></div>
           ${btn(t('collect'), 'collect_gnomes', null, { disabled: L.stored < 1 })}</div>
         <p class="text small">${t('depth_note', { d: S.maxDepth })}</p>` + foot(), 'lodge');
    });
  }

  function paintBuild(id, S) {
    const b = DTT.BUILDINGS.find((x) => x.id === id);
    paint(head(t('build_site', { name: t('b_' + id) }), coin(S.coins)) +
      `<p class="text">${t(id === 'farm' ? 'farm_text' : 'lodge_text')}</p>
       <div class="split center">${btn(t('build') + ' ' + coin(b.cost), 'build', id, { dim: S.coins < b.cost })}</div>` + foot(), 'build');
  }

  // ---------- меню и сохранения ----------
  function openMenu(vol) {
    show('menu', () => paint(head(t('menu_title')) + `
      <div class="menu-list">
        <button class="big-btn" data-close>${t('continue')}</button>
        <button class="big-btn" data-act="slots" data-arg="save">${t('save')}</button>
        <button class="big-btn" data-act="slots" data-arg="load">${t('load')}</button>
        <button class="big-btn ghost" data-act="new">${t('new_game')}</button>
        <div class="split"><label class="vol">${t('sound')}<input id="vol" type="range" min="0" max="10" step="1" value="${Math.round(vol * 10)}"></label>
        <button class="big-btn ghost small" data-act="lang">${lang.toUpperCase()}</button></div>
      </div>`, 'menu'));
    $('vol').addEventListener('input', (e) => act('volume', e.target.value));
  }
  function slotLine(m) {
    if (!m) return `<span class="muted">${t('empty_slot')}</span>`;
    const date = new Date(m.savedAt).toLocaleString(lang, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `${date} · ${coin(m.coins)} · ${m.depth} m · ${m.museum}/${DTT.ARTIFACTS.length}`;
  }
  function openSlots(mode) {
    show('slots', () => {
      let rows = '';
      if (mode === 'load') {
        const a = DTT.Save.autoMeta();
        rows += `<div class="row"><div class="row-main"><b>${t('autosave')}</b><div class="stat">${slotLine(a)}</div></div>
          ${btn(t('load'), 'load', 'auto', { disabled: !a })}</div>`;
      }
      for (let n = 1; n <= 3; n++) {
        const m = DTT.Save.slotMeta(n);
        rows += `<div class="row"><div class="row-main"><b>${t('slot', { n })}</b><div class="stat">${slotLine(m)}</div></div>
          ${mode === 'save' ? btn(t('save'), 'save', n) : btn(t('load'), 'load', n, { disabled: !m })}</div>`;
      }
      paint(head(t(mode === 'save' ? 'save' : 'load')) + rows + foot(), 'slots');
    });
  }

  function openWelcome(r) {
    show('welcome', () => paint(`<h2 class="center">${t('welcome')}</h2>
      <p class="text center">${t('away', { t: fmtDur(r.away) })}</p>
      ${r.gnomes ? `<div class="row slim"><i class="gnome"></i><div class="row-main">${t('w_gnomes', { v: r.gnomes })}</div></div>` : ''}
      ${r.crops ? `<div class="row slim"><img class="ico" src="${DTT.Art.spriteURL('crops', 3)}" alt=""><div class="row-main">${t('w_crops', { n: r.crops })}</div></div>` : ''}
      ${r.products ? `<div class="row slim"><img class="ico" src="${DTT.Art.productURL('egg')}" alt=""><div class="row-main">${t('w_products', { n: r.products })}</div></div>` : ''}
      <div class="foot center"><button class="close" data-close>${t('ok')}</button></div>`, 'welcome'));
  }

  // ---------- мини-карта ----------
  const MAP_S = 2;
  let mapCanvas = null, mapCtx = null;
  function initMap() {
    mapCanvas = $('minimap-canvas');
    mapCanvas.width = DTT.W * MAP_S;
    mapCanvas.height = DTT.H * MAP_S;
    mapCtx = mapCanvas.getContext('2d');
    mapCtx.fillStyle = '#181425';
    mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
  }
  // state: 0 неизвестно, 1 камень, 2 проход, 3 лава
  const MAP_COL = ['#181425', '#3a4466', '#c0cbdc', '#f77622', '#7fd6f0', '#63c74d'];
  function mapPaint(x, y, state) {
    mapCtx.fillStyle = MAP_COL[state];
    mapCtx.fillRect(x * MAP_S, y * MAP_S, MAP_S, MAP_S);
  }
  function mapPlayer(tx, ty) {
    const box = $('minimap');
    const k = box.clientWidth / mapCanvas.width || 1;     // на телефоне карта уменьшена
    const h = box.clientHeight / k;
    const off = Math.max(0, Math.min(mapCanvas.height - h, ty * MAP_S - h / 2));
    const tr = `scale(${k}) translateY(${-off}px)`;
    if (mapCanvas.style.transform !== tr) mapCanvas.style.transform = tr;
    const dot = $('minimap-dot');
    dot.style.left = (tx * MAP_S * k - 1) + 'px';
    dot.style.top = ((ty * MAP_S - off) * k - 1) + 'px';
  }
  function openMap(px, py) {
    show('map', () => {
      paint(head(t('map_title')) + `<p class="text small">${t('map_hint')}</p>
        <div class="bigmap"><img id="bigmap-img" src="${mapCanvas.toDataURL()}" alt=""><i class="dot" style="left:${px * MAP_S * 2 - 3}px;top:${py * MAP_S * 2 - 3}px"></i></div>` + foot(), 'map');
      const bm = $('panel').querySelector('.bigmap');
      bm.scrollTop = Math.max(0, py * MAP_S * 2 - bm.clientHeight / 2);
    });
  }

  // ---------- кнопки и сенсор ----------
  function init(handlers) {
    act = handlers.act;
    $('btn-map').addEventListener('click', handlers.map);
    $('btn-menu').addEventListener('click', handlers.menu);
    $('btn-rope').addEventListener('click', handlers.rope);
    $('btn-torch').addEventListener('click', handlers.torch);
    $('prompt').addEventListener('click', () => promptHandler && promptHandler());
    $('minimap').addEventListener('click', handlers.map);
    $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') close(); });

    const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (isTouch) document.body.classList.add('touch');
    document.querySelectorAll('[data-touch]').forEach((b) => {
      const k = b.dataset.touch;
      const on = (e) => { e.preventDefault(); touch[k] = true; b.classList.add('on'); };
      const off = (e) => { e.preventDefault(); touch[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('pointerleave', off);
    });
    initMap();
    return isTouch;
  }

  return {
    t, init, setAct: (fn) => { act = fn; }, setLang, detectLang, getLang: () => lang, setHUD, toast, banner, bossBar, prompt,
    openShop, openMuseum, openTailor, openHall, openHouse, openFarm, openLodge, openMenu, openSlots,
    openWelcome, openMap, showArtifact, close, isOpen, refresh, touch,
    mapPaint, mapPlayer, panel: () => current && current.name,
  };
})();
