// Звуки синтезируются на лету (Web Audio): без файлов, мягко и с разбросом высоты,
// чтобы частые удары киркой не превращались в однообразный долбёж.
window.DTT = window.DTT || {};

DTT.Sfx = (function () {
  let ctx = null, master = null, echo = null, noiseBuf = null;
  const s = { volume: 0.7 };
  const last = {};
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- цепочка: звуки → общий тембр → компрессор → колонки; плюс шина эха ----------
  function ac() {
    if (s.volume <= 0) return null;
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 4;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass'; tone.frequency.value = 7000;     // срезаем писклявый верх
      master = ctx.createGain();
      master.connect(tone).connect(comp).connect(ctx.destination);
      // эхо «в пещере»: короткая задержка с затуханием
      echo = ctx.createGain(); echo.gain.value = 0.22;
      const dl = ctx.createDelay(1); dl.delayTime.value = 0.16;
      const fb = ctx.createGain(); fb.gain.value = 0.3;
      const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 2200;
      echo.connect(dl); dl.connect(damp).connect(fb).connect(dl); damp.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      setVolume(s.volume);
    }
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
    return ctx;
  }
  function setVolume(v) {
    s.volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = s.volume * 0.55;
  }
  function throttle(key, ms) {
    const now = performance.now();
    if (last[key] && now - last[key] < ms) return false;
    last[key] = now;
    return true;
  }
  function out(g, opts) {
    g.connect(master);
    if (opts.echo) { const e = ctx.createGain(); e.gain.value = opts.echo; g.connect(e).connect(echo); }
  }

  // тон с мягкой атакой и экспоненциальным затуханием
  function osc(type, f0, f1, dur, vol, opts) {
    const a = ac(); if (!a) return;
    opts = opts || {};
    const t = a.currentTime + (opts.delay || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const at = opts.attack || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
    o.connect(g); out(g, opts);
    o.start(t); o.stop(t + at + dur + 0.05);
  }

  // шум через фильтр (можно с «проездом» частоты)
  function noise(dur, vol, type, freq, opts) {
    const a = ac(); if (!a) return;
    opts = opts || {};
    const t = a.currentTime + (opts.delay || 0);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noiseBuf;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = opts.q || 1;
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const at = opts.attack || 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
    src.connect(f).connect(g); out(g, opts);
    src.start(t, Math.random() * 0.5); src.stop(t + at + dur + 0.05);
  }

  // ---------- материал блока ----------
  function kind(tileIndex) {
    const T = DTT.T, def = DTT.DEFS[tileIndex] || {};
    if (def.seam || def.seal) return 'magic';
    if (def.value || def.artifact) return 'ore';
    if ([T.DIRT, T.GRASS, T.CLAY, T.RUBBLE].includes(tileIndex)) return 'soft';
    return 'hard';
  }

  const PENTA = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];

  // iOS: AudioContext запускается/возобновляется только внутри жеста пользователя
  ['touchend', 'click', 'keydown'].forEach((ev) => document.addEventListener(ev, () => ac(), { passive: true }));

  // вкладка в фоне — звук на паузе
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  return Object.assign(s, {
    unlock: ac,
    setVolume,

    // удар киркой: земля — глухо, камень — сухой щелчок, руда — с лёгким звоном
    hit(tileIndex) {
      if (!throttle('hit', 90)) return;
      const k = kind(tileIndex);
      if (k === 'soft') {
        noise(0.07, 0.16, 'lowpass', rnd(450, 650));
        osc('sine', rnd(110, 140), 70, 0.07, 0.12);
      } else {
        noise(0.035, 0.1, 'bandpass', rnd(1700, 2500), { q: 1.4 });
        osc('triangle', rnd(650, 850), 420, 0.035, 0.035);
        if (k === 'ore') osc('sine', rnd(1500, 1900), 0, 0.14, 0.022, { echo: 0.5 });
        if (k === 'magic') osc('sine', rnd(500, 560), rnd(800, 900), 0.2, 0.03, { echo: 0.8 });
      }
    },
    // блок рассыпался
    brk(tileIndex) {
      const k = kind(tileIndex);
      if (k === 'soft') noise(0.16, 0.16, 'lowpass', 900, { to: 180 });
      else noise(0.18, 0.13, 'lowpass', 2400, { to: 350 });
      osc('sine', rnd(85, 100), 45, 0.13, 0.13);
    },
    // руда в рюкзак: короткая «нотка», выше для дорогой руды
    ore(value) {
      if (!throttle('ore', 60)) return;
      const base = value >= 100 ? 1047 : value >= 40 ? 880 : value >= 12 ? 784 : 659;
      const n = PENTA[Math.floor(Math.random() * 3)];
      osc('sine', base * n, 0, 0.07, 0.05, { echo: 0.4 });
      osc('sine', base * n * 1.5, 0, 0.1, 0.04, { delay: 0.06, echo: 0.4 });
    },
    coin() {
      if (!throttle('coin', 80)) return;
      osc('triangle', 1046, 0, 0.06, 0.06);
      osc('triangle', 1568, 0, 0.18, 0.06, { delay: 0.07, echo: 0.3 });
    },
    buy() {
      noise(0.05, 0.08, 'lowpass', 500);
      osc('triangle', 784, 0, 0.06, 0.05, { delay: 0.03 });
      osc('triangle', 1175, 0, 0.16, 0.055, { delay: 0.1, echo: 0.3 });
    },
    // «нельзя»: мягкое «буп», не чаще раза в полсекунды
    deny() {
      if (!throttle('deny', 500)) return;
      osc('sine', 260, 190, 0.1, 0.07);
    },
    art() {
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        osc('triangle', f, 0, 0.22, 0.045, { delay: i * 0.08, echo: 0.7 });
        osc('sine', f * 2, 0, 0.12, 0.015, { delay: i * 0.08 + 0.02 });
      });
    },
    rope() { noise(0.35, 0.07, 'bandpass', 300, { to: 1800, q: 2, attack: 0.05 }); },
    hatch() {
      noise(0.1, 0.1, 'bandpass', 650, { q: 5 });
      osc('triangle', 170, 110, 0.12, 0.06);
      noise(0.25, 0.05, 'bandpass', 900, { to: 300, q: 2, delay: 0.1 });
    },
    door() {
      noise(0.05, 0.12, 'lowpass', 300);
      noise(0.05, 0.1, 'lowpass', 280, { delay: 0.11 });
    },
    torch() {
      noise(0.25, 0.08, 'bandpass', 700, { to: 1600, q: 1.5, attack: 0.03 });
      for (let i = 0; i < 4; i++) noise(0.012, 0.05, 'highpass', 3000, { delay: 0.05 + i * rnd(0.04, 0.08) });
    },
    plant() { osc('sine', 480, 900, 0.06, 0.05); },
    hurt() {
      if (!throttle('hurt', 300)) return;
      osc('sine', 420, 170, 0.17, 0.1);
      noise(0.08, 0.08, 'lowpass', 900);
    },
    sizzle() { noise(0.3, 0.06, 'highpass', 2800, { attack: 0.02 }); },
    rumble() {
      noise(1.3, 0.22, 'lowpass', 180, { attack: 0.2, to: 90 });
      osc('sine', 52, 34, 1.2, 0.12, { attack: 0.15 });
    },
    swing() { noise(0.08, 0.05, 'bandpass', 1200, { to: 3000, q: 1.2 }); },
    squeak() {
      if (!throttle('squeak', 400)) return;
      osc('sine', rnd(2100, 2400), rnd(2800, 3100), 0.05, 0.02);
    },
    seam() {
      osc('sine', 220, 440, 0.9, 0.06, { attack: 0.05, echo: 0.8 });
      osc('sine', 330, 660, 0.9, 0.04, { attack: 0.05, echo: 0.8 });
      noise(0.8, 0.04, 'highpass', 4000, { attack: 0.2 });
    },
    boss() {
      [110, 130.8, 164.8].forEach((f, i) => osc('triangle', f, 0, 1.4, 0.07, { delay: i * 0.25, attack: 0.08, echo: 0.6 }));
      noise(1.2, 0.12, 'lowpass', 150, { attack: 0.3 });
    },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => osc('triangle', f, 0, 0.3, 0.06, { delay: i * 0.11, echo: 0.5 })); },

    // ---------- атмосфера под землёй ----------
    drip() { osc('sine', rnd(1300, 1800), rnd(450, 600), 0.06, rnd(0.015, 0.03), { echo: 1 }); },
    bubble() { osc('sine', rnd(160, 220), rnd(320, 420), 0.09, 0.025); },
    ui() { if (throttle('ui', 60)) osc('triangle', 1250, 0, 0.025, 0.02); },
  });
})();
