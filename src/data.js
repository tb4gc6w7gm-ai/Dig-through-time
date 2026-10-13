// Игровые константы, блоки, апгрейды, деревня, ферма, гномы, скины. Баланс правится здесь.
window.DTT = window.DTT || {};

DTT.TILE = 16;
DTT.W = 64;             // ширина мира в тайлах
DTT.SURF = 12;          // строка поверхности (глубина 0)
DTT.SEAM1 = 60;         // примерная глубина шва I → II (волнистый)
DTT.SEAL = 150;         // печать под залом босса
DTT.END_D = 156;        // примерная глубина коренной породы
DTT.H = DTT.SURF + DTT.END_D + 8;
DTT.MINE_X = 32;        // столбец входа в шахту
DTT.MINE_DEPTH = 4;     // глубина готового ствола
DTT.SPAWN_TX = 34;      // где появляется шахтёр

// Индексы тайлов в тайлсете
DTT.T = {
  GRASS: 0, DIRT: 1, STONE: 2, COAL: 3, COPPER: 4, IRON: 5, GRANITE: 6, QUARTZ: 7,
  ART: 8, SEAM: 9, BRICK: 10, SILVER: 11, BEDROCK: 12, ART_M: 13,
  CLAY: 14, DARK: 15, GOLD: 16, RUBY: 17, LAVA: 18, LAVA2: 19, RUBBLE: 20,
  VGRASS: 21, VDIRT: 22, SEAL: 23,
  W_DIRT: 24, W_STONE: 25, W_BRICK: 26, W_CLAY: 27, W_DARK: 28, HATCH: 29,
};
DTT.TILE_COUNT = 30;
DTT.FIRST_WALL = DTT.T.W_DIRT;

// hp — секунды копания при скорости ×1; tier — нужный уровень кирки; value — цена руды
(function () {
  const T = DTT.T;
  DTT.DEFS = {
    [T.GRASS]:   { hp: 0.3, tier: 1, color: 0x63c74d },
    [T.DIRT]:    { hp: 0.35, tier: 1, color: 0xb86f50 },
    [T.STONE]:   { hp: 0.8, tier: 1, color: 0x8b9bb4 },
    [T.COAL]:    { hp: 0.9, tier: 1, value: 4, color: 0x262b44 },
    [T.COPPER]:  { hp: 1.1, tier: 1, value: 8, color: 0xe4a672 },
    [T.IRON]:    { hp: 1.5, tier: 2, value: 16, color: 0xe8b796 },
    [T.GRANITE]: { hp: 1.6, tier: 2, color: 0x5a6988 },
    [T.QUARTZ]:  { hp: 2.0, tier: 3, value: 40, color: 0x2ce8f5 },
    [T.ART]:     { hp: 1.0, tier: 1, artifact: true, color: 0xfee761 },
    [T.SEAM]:    { hp: 3.0, tier: 3, color: 0xfeae34, seam: true },
    [T.BRICK]:   { hp: 1.4, tier: 3, color: 0x8b9bb4 },
    [T.SILVER]:  { hp: 1.8, tier: 3, value: 60, color: 0xffffff },
    [T.BEDROCK]: { hp: Infinity, tier: 99, color: 0x181425 },
    [T.ART_M]:   { hp: 1.4, tier: 3, artifact: true, color: 0xfee761 },
    [T.CLAY]:    { hp: 1.0, tier: 3, color: 0x9e5a45 },
    [T.DARK]:    { hp: 2.0, tier: 4, color: 0x3a4466 },
    [T.GOLD]:    { hp: 2.2, tier: 4, value: 110, color: 0xfeae34 },
    [T.RUBY]:    { hp: 2.8, tier: 5, value: 220, color: 0xe43b44 },
    [T.LAVA]:    { hp: Infinity, tier: 99, liquid: true, color: 0xf77622 },
    [T.LAVA2]:   { hp: Infinity, tier: 99, liquid: true, color: 0xf77622 },
    [T.RUBBLE]:  { hp: 0.5, tier: 1, color: 0x8b9bb4 },
    [T.VGRASS]:  { hp: Infinity, tier: 98, village: true, color: 0x63c74d },
    [T.VDIRT]:   { hp: Infinity, tier: 98, village: true, color: 0xb86f50 },
    [T.SEAL]:    { hp: 3.0, tier: 4, color: 0xb55088, seal: true },
    [T.HATCH]:   { hp: Infinity, tier: 98, village: true, hatch: true, color: 0x733e39 },
  };
})();

DTT.PICK_COLORS = ['#b86f50', '#8b9bb4', '#d77643', '#c0cbdc', '#feae34', '#2ce8f5', '#63c74d', '#e43b44', '#68386c', '#fee761'];

DTT.UPGRADES = {
  pick: {
    cost:  [0, 40, 120, 300, 600, 1100, 1900, 3200, 5200, 8500],
    power: [1, 1.5, 2, 2.6, 3.3, 4.2, 5.2, 6.5, 8, 10],
    tier:  [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
    dmg:   [1, 2, 3, 4, 6, 8, 11, 14, 18, 24],
  },
  bag: {
    cost: [0, 30, 80, 180, 350, 650, 1100, 1800, 2900, 4500],
    cap:  [8, 12, 16, 22, 28, 36, 45, 56, 70, 90],
  },
  lamp: {
    cost:   [0, 50, 150, 350, 700, 1300, 2300, 4000],
    radius: [3, 3.5, 4, 4.5, 5, 5.5, 6, 7],
    rated:  [8, 18, 32, 48, 70, 95, 125, 170],   // до этой глубины фонарь светит в полную силу
  },
  torches: { cost: 15, amount: 5 },
};
DTT.TORCH_RADIUS = 4.5;

DTT.HEARTS_BASE = 3;
DTT.REGEN_SEC = 8;           // +1 сердце на поверхности

// Артефакты: d — примерная глубина, era — раздел музея
DTT.ARTIFACTS = [
  { id: 'cap', d: 6, era: 1 },
  { id: 'phone', d: 14, era: 1 },
  { id: 'helmet', d: 24, era: 1 },
  { id: 'diary1', d: 34, era: 1 },
  { id: 'soldier', d: 44, era: 1 },
  { id: 'diary2', d: 54, era: 1 },
  { id: 'signet', d: 70, era: 2 },
  { id: 'coin', d: 82, era: 2 },
  { id: 'map', d: 94, era: 2 },
  { id: 'diary3', d: 106, era: 2 },
  { id: 'hourglass', d: 118, era: 2 },
  { id: 'diary4', d: 130, era: 2 },
  { id: 'crown', d: 0, era: 2, boss: true },
];

// Зал босса (глубины включительно — внутреннее пространство)
DTT.ARENA = { d0: 139, d1: 145, x0: 10, x1: 53 };

DTT.RAT = { hp: 3, speed: 34, coins: 6 };
DTT.BOSS = { hp: 150, speed: 42, coins: 1000 };

// ---------- деревня ----------
// x0..x1 — тайлы, где у двери появляется подсказка «↑»
DTT.BUILDINGS = [
  { id: 'farm', x0: 2, x1: 15, cost: 150 },
  { id: 'house', x0: 17, x1: 19 },
  { id: 'hall', x0: 21, x1: 24 },
  { id: 'shop', x0: 26, x1: 28 },
  { id: 'museum', x0: 36, x1: 39 },
  { id: 'lodge', x0: 41, x1: 43, cost: 250 },
  { id: 'tailor', x0: 45, x1: 47 },
];

DTT.HOUSE = { cost: [0, 400, 1500], slots: [4, 7, 10] };
DTT.FURNITURE = [
  { id: 'bed', cost: 60, heart: true },
  { id: 'table', cost: 40 },
  { id: 'chair', cost: 25 },
  { id: 'rug', cost: 70 },
  { id: 'plant', cost: 35 },
  { id: 'shelf', cost: 120 },
  { id: 'chest', cost: 90 },
  { id: 'painting', cost: 150 },
  { id: 'fireplace', cost: 250, heart: true },
  { id: 'clock', cost: 200 },
  { id: 'trophy', cost: 0, boss: true },
];
DTT.FURNITURE_BONUS = 2;   // % к цене руды за каждый предмет без сердца

DTT.DECOR = [
  { id: 'flowers', cost: 80 },
  { id: 'well', cost: 150 },
  { id: 'flags', cost: 180 },
  { id: 'lamps', cost: 250 },
  { id: 'mill', cost: 700, effect: 'mill' },
  { id: 'fountain', cost: 900 },
  { id: 'statue', cost: 1800 },
];
DTT.DECOR_BONUS = 3;       // % к цене руды за каждую постройку
DTT.MILL_SPEED = 0.75;     // мельница ускоряет рост на 25%

// ---------- ферма ----------
DTT.FARM = {
  plotCost: [0, 0, 50, 80, 120, 170, 230, 300],   // 2 грядки бесплатно, максимум 8
  maxPerAnimal: 3,
};
DTT.CROPS = {
  wheat:   { seed: 4, time: 90, sell: 10 },
  carrot:  { seed: 10, time: 240, sell: 28 },
  pumpkin: { seed: 30, time: 600, sell: 85 },
};
DTT.ANIMALS = {
  chicken: { cost: 80, food: 'wheat', time: 120, product: 'egg' },
  sheep:   { cost: 220, food: 'carrot', time: 300, product: 'wool' },
  cow:     { cost: 400, food: 'pumpkin', time: 480, product: 'milk' },
};
DTT.PRODUCTS = { egg: 20, wool: 55, milk: 150 };

// ---------- гномы ----------
DTT.LODGE = {
  hire:    [120, 260, 480, 800, 1300, 2000],        // цена каждого следующего гнома
  toolsCost: [0, 200, 500, 1000, 2000, 3500],
  toolsMult: [1, 1.5, 2.2, 3, 4, 5.5],
  storageCost: [0, 300, 900, 2500],
  storage:   [400, 1200, 3000, 8000],
  offlineCapH: 8,
};
// монет в минуту на одного гнома
DTT.gnomeRate = (maxDepth, tools) => 1.2 * (1 + maxDepth / 20) * DTT.LODGE.toolsMult[tools];

// ---------- скины ----------
DTT.SKINS = [
  { id: 'miner', cost: 0, c: { hat: '#feae34', hatD: '#f77622', shirt: '#be4a2f', body: '#124e89', bodyL: '#0099db', skin: '#e8b796', skinD: '#c28569' } },
  { id: 'red', cost: 100, c: { hat: '#e43b44', hatD: '#a22633', shirt: '#ead4aa', body: '#3e2731', bodyL: '#733e39', skin: '#e8b796', skinD: '#c28569' } },
  { id: 'forest', cost: 150, c: { hat: '#3e8948', hatD: '#265c42', shirt: '#ead4aa', body: '#733e39', bodyL: '#b86f50', skin: '#e8b796', skinD: '#c28569' } },
  { id: 'knight', cost: 400, c: { hat: '#c0cbdc', hatD: '#8b9bb4', shirt: '#a22633', body: '#5a6988', bodyL: '#8b9bb4', skin: '#e8b796', skinD: '#c28569' } },
  { id: 'ninja', cost: 600, c: { hat: '#262b44', hatD: '#181425', shirt: '#e43b44', body: '#262b44', bodyL: '#3a4466', skin: '#e8b796', skinD: '#c28569' } },
  { id: 'robot', cost: 900, c: { hat: '#8b9bb4', hatD: '#5a6988', shirt: '#2ce8f5', body: '#5a6988', bodyL: '#c0cbdc', skin: '#c0cbdc', skinD: '#8b9bb4' } },
  { id: 'astro', cost: 1300, c: { hat: '#ffffff', hatD: '#c0cbdc', shirt: '#f77622', body: '#c0cbdc', bodyL: '#ffffff', skin: '#e8b796', skinD: '#c28569' } },
  { id: 'gold', cost: 3000, c: { hat: '#fee761', hatD: '#feae34', shirt: '#feae34', body: '#f77622', bodyL: '#fee761', skin: '#e8b796', skinD: '#c28569' } },
];
