// 原版舞台 550×400，H5 等比 ×1.3 → 715×520，无水平边距（0,0 对齐）。
// groundY 为矿工组合底边（原版 y≈60.15 → 78.2），地层美术自 y≈87 起。
export const SWF_SCALE = 1.3;
export const STAGE = Object.freeze({ width: 715, height: 520, groundY: 78.2 });

// 原版 Sprite 299：摆动一个整周期 84 帧（18 FPS ≈ 4.67 s），矩阵峰值 ≈ ±68°，
// 且每关从随机相位开始（frame 2 的 random(82)）。
export const SWING = Object.freeze({
  amplitude: 68 * Math.PI / 180,
  period: 84 / 18,
});

// 原版 Sprite 298：下放 ~9.9 px/帧（×1.3 舞台换算 ≈ 232 px/s）；最大深度
// 407 局部 px（≈ 509 H5 px 的 extension）；空钩/被炸/力量状态按每 tick 跳 15 帧收回。
// abortExtension 对应原版仅在伸出第 3–10 帧存活的左右键“收手”按钮。
export const HOOK = Object.freeze({
  extendSpeed: 232,
  emptyRetractSpeed: 555,
  maxExtension: 509,
  abortExtension: 103,
});

// 原版 Sprite 317/319：地鼠本地 ~4.95 px/帧，经 ob 缩放 0.5959 与 ×1.3 舞台换算 ≈ 69 px/s；
// 单程 381.7 本地 px ≈ 296 H5 px；端点随机停顿（frame 80/189 的 random(20) 跳帧 ≈ 0.2–1.3 s）。
export const MOLE = Object.freeze({
  speed: 69,
  patrolSpan: 296,
  pauseMin: 0.2,
  pauseMax: 1.3,
});

// 原版 L 帧把 miner（Sprite 254）放在 (285.85,34.75)、缩放 0.3891；
// 导出 PNG 为 2× 采样，故 H5 绘制缩放 = 0.3891 × 1.3 / 2 ≈ 0.25292。
export const MINER = Object.freeze({
  composite: Object.freeze({ width: 330, height: 299 }),
  scale: 0.3891 * SWF_SCALE / 2,
  hookAnchor: Object.freeze({ x: 99.2, y: 240.4 }),
  platformOffset: Object.freeze({ x: 0, y: 270 }),
  sourceOffsets: Object.freeze({
    idle: Object.freeze({ x: 29, y: 43 }),
    pull: Object.freeze({ x: 28, y: 10 }),
    dynamite: Object.freeze({ x: 28, y: 10 }),
    yay: Object.freeze({ x: 31, y: 0 }),
  }),
});

// 原版摆钩组 C（Sprite 299）放在 (275.5,48.6)：钩子支点取其精确换算值。
const assemblyTop = STAGE.groundY - MINER.composite.height * MINER.scale;
export const PIVOT = Object.freeze({
  x: 275.5 * SWF_SCALE,
  y: assemblyTop + MINER.hookAnchor.y * MINER.scale,
});
export const HOOK_BASE_LENGTH = STAGE.groundY - PIVOT.y;

export const GOALS = Object.freeze([
  650, 1195, 2010, 3095, 4450,
  6075, 7970, 10135, 12570, 15275,
]);

export function goalForLevel(level) {
  const index = Math.max(1, Math.floor(level)) - 1;
  return index < GOALS.length
    ? GOALS[index]
    : GOALS.at(-1) + (index - GOALS.length + 1) * 2705;
}

const hitbox = (width, height = width) => Object.freeze({
  halfW: width / 2,
  halfH: height / 2,
});

// claw = 原版钩爪时间轴（Sprite 291/292）中该物件的“爪握持”帧号：
// 抓取后原版隐藏场上物件、由钩爪帧直接显示“爪 + 物件”成品美术
// （claw.gotoAndStop(object)），因此任何抓取角度下画面都成立。
export const TYPE_DEFS = Object.freeze({
  gold_big: Object.freeze({ asset: 'gold_500', value: 500, weight: 9, drawScale: 1, hitbox: hitbox(61.2), layoutRadius: 38, claw: 5 }),
  gold_mid: Object.freeze({ asset: 'gold_250', value: 250, weight: 8, drawScale: 0.77, hitbox: hitbox(47), layoutRadius: 30, claw: 4 }),
  gold_small: Object.freeze({ asset: 'gold_100', value: 100, weight: 7, drawScale: 0.65, hitbox: hitbox(23.8), layoutRadius: 19, claw: 3 }),
  gold_tiny: Object.freeze({ asset: 'gold_50', value: 50, weight: 3, drawScale: 0.65, hitbox: hitbox(12.5), layoutRadius: 13, claw: 2 }),
  rock_big: Object.freeze({ asset: 'rock_big', value: 20, weight: 9, drawScale: 0.65, hitbox: hitbox(28.4), layoutRadius: 30, valueBuff: 'rock', claw: 8 }),
  rock_small: Object.freeze({ asset: 'rock_small', value: 11, weight: 8, drawScale: 0.48, hitbox: hitbox(23.6, 19.5), layoutRadius: 22, valueBuff: 'rock', claw: 14 }),
  diamond: Object.freeze({ asset: 'diamond', value: 600, weight: 2, drawScale: 0.39, hitbox: hitbox(13.2), layoutRadius: 13, valueBuff: 'diamond', claw: 11 }),
  mole: Object.freeze({ animation: 'mole', value: 2, weight: 3, drawScale: 0.39, hitbox: hitbox(19.5), layoutRadius: 17, claw: 6 }),
  mole_d: Object.freeze({ animation: 'mole_d', value: 602, weight: 5, drawScale: 0.39, hitbox: hitbox(19.5), layoutRadius: 18, valueBuff: 'diamond', claw: 10 }),
  bone: Object.freeze({ asset: 'bone', value: 7, weight: 3, drawScale: 0.39, hitbox: hitbox(24.4, 13), layoutRadius: 18, claw: 7 }),
  skull: Object.freeze({ asset: 'skull', value: 20, weight: 2, drawScale: 0.39, hitbox: hitbox(21.9), layoutRadius: 17, claw: 13 }),
  tnt: Object.freeze({ asset: 'tnt', value: 1, weight: 2, drawScale: 0.39, hitbox: hitbox(39.4, 48.8), layoutRadius: 27, claw: 9 }),
  bag: Object.freeze({ asset: 'bag', value: 0, weight: 0, drawScale: 0.39, hitbox: hitbox(31.2), layoutRadius: 24, claw: 12 }),
});

export const EMPTY_BUFFS = Object.freeze({
  strength: false,
  clover: false,
  rock: false,
  diamond: false,
});

export function newBuffs(source = EMPTY_BUFFS) {
  return {
    strength: Boolean(source.strength),
    clover: Boolean(source.clover),
    rock: Boolean(source.rock),
    diamond: Boolean(source.diamond),
  };
}

export function itemValue(item, activeBuffs = EMPTY_BUFFS) {
  const def = TYPE_DEFS[item.type];
  if (item.type === 'bag') return item.value ?? 0;
  if (def.valueBuff === 'rock' && activeBuffs.rock) return def.value * 3;
  if (def.valueBuff === 'diamond' && activeBuffs.diamond) return def.value + 300;
  return def.value;
}

// 原版 Sprite 298 收绳是“每 tick 跳 N 帧”：常规 N = minerStrength - weight，无上限；
// 袋子力量（/:strength）与重量 -1（stickBonus）走固定 N = 15 的快速路径，与重量无关。
// 37 px/s 为 18 FPS 单帧位移 ×1.3 舞台换算。
export const PULL_UNIT = 37;

export function pullSpeed(item, activeBuffs = EMPTY_BUFFS, bagPower = false) {
  const weight = item.weight ?? TYPE_DEFS[item.type].weight;
  if (bagPower || weight === -1) return PULL_UNIT * 15;
  const strength = activeBuffs.strength ? 12 : 10;
  return PULL_UNIT * Math.max(1, strength - weight);
}

export const SHOP_LAYOUT = Object.freeze({
  backgroundScale: 0.64,
  slots: Object.freeze([
    Object.freeze({ x: 74, y: 388, w: 100, h: 142 }),
    Object.freeze({ x: 180, y: 388, w: 100, h: 142 }),
    Object.freeze({ x: 286, y: 388, w: 100, h: 142 }),
    Object.freeze({ x: 392, y: 388, w: 100, h: 142 }),
    Object.freeze({ x: 498, y: 388, w: 100, h: 142 }),
  ]),
  nextButton: Object.freeze({ x: 620, y: 476, w: 148, h: 38 }),
});

// 原版离店动画（Sprite 133）：标签 yes = 帧 19–25（买过任一商品，声音 88），
// 标签 no = 帧 26–38（未购买，声音 132），18 FPS 播完一次后进入下一关。
export const SHOP_LEAVE = Object.freeze({
  yes: Object.freeze({ prefix: 'shop_yes', frames: 7 }),
  no: Object.freeze({ prefix: 'shop_no', frames: 13 }),
  fps: 18,
});

export const PAUSE_LAYOUT = Object.freeze({
  hudButton: Object.freeze({ x: 42, y: 500, w: 72, h: 26 }),
  resumeButton: Object.freeze({ x: 357.5, y: 316, w: 174, h: 46 }),
});

// 原版主时间轴按钮 202（Exit Level）：中心 (429.2,27)，随时可点击提前结算。
export const HUD_LAYOUT = Object.freeze({
  endButton: Object.freeze({ x: 429.2 * SWF_SCALE, y: 27 * SWF_SCALE, w: 78, h: 52 }),
});

// —— 原版矢量导出 PNG 的注册信息：[xMin, yMin, width, height]，
// 均为字符局部 SWF px（导出 PNG 为 2× 采样，绘制时按 bounds 尺寸铺回）。
export const ART_REG = Object.freeze({
  screen_gold_bg: Object.freeze([-280.4, -204.4, 561.0, 408.8]),
  screen_nugget: Object.freeze([-22.6, -20.6, 45.2, 41.2]),
  screen_nugget_shine: Object.freeze([133.6, -4.8, 187.0, 170.6]),
  screen_panel: Object.freeze([-157.6, -71.4, 315.2, 142.9]),
  logo: Object.freeze([-108.4, -16.3, 219.1, 32.6]),
  bg_underground: Object.freeze([-278.0, -168.6, 556.0, 337.2]),
  bg_hud: Object.freeze([-3.2, -3.2, 556.9, 265.9]),
  bg_hud_glow: Object.freeze([-277.5, -31.5, 555.0, 63.1]),
  hud_exit: Object.freeze([-28.8, -21.2, 57.5, 42.4]),
});

// 钩爪帧（Sprite 291/292）的共用画布注册：原点即绳端锚点。
export const CLAW_REG = Object.freeze([-74.8, -40.9, 148.9, 138.7]);

// 原版爆炸特效 Sprite 263 的画布注册与两种触发缩放：
// TNT 木箱帧 2 以 2.2416 播放，飞行炸药命中（Sprite 265 帧 3）以 0.4495。
export const EXPLOSION_REG = Object.freeze([-66.3, -61.2, 130.5, 122.4]);
export const EXPLOSION_SCALE = Object.freeze({ tnt: 2.2416, dynamite: 0.4495 });

// 摆动/下放期的空爪、炸药销毁后的空爪。
export const CLAW_ASSETS = Object.freeze({ open: 'claw_open', empty: 'claw_empty' });

const placed = (key, tx, ty, a = 1, b = 0, c = 0, d = a) =>
  Object.freeze({ key, tx, ty, a, b, c, d });

// 金块墙全屏底（主时间轴 f15–48/f52–86/f94–130/f140+ 的公共背景拼贴，
// 逐条转录自 PlaceObject2：shape 52 基底 + shape 2 / sprite 28 金块对）。
export const GOLD_SCREEN_BG = Object.freeze([
  placed('screen_gold_bg', 274.6, 201.45),
  placed('screen_nugget', 70.9, 231.95, 4.7551),
  placed('screen_nugget_shine', -167.2, 144.9),
  placed('screen_nugget', 470.95, 286.95, 2.9112, 3.7502, -3.7502, 2.9112),
  placed('screen_nugget_shine', 393.85, 45.85, 0.6122, 0.7887, -0.7887, 0.6122),
  placed('screen_nugget', 319.45, 321.85, 2.9883, -0.0369, 0.0369, 2.9883),
  placed('screen_nugget_shine', 169.15, 269, 0.6285, -0.0078, 0.0078, 0.6285),
  placed('screen_nugget', 203.95, 368.1, -5.3547, 1.2675, 1.2675, 5.3547),
  placed('screen_nugget_shine', 448.9, 206.55, -1.1261, 0.2666, 0.2666, 1.1261),
  placed('screen_nugget', 284.65, 50.7, 2.9883, -0.0369, 0.0369, 2.9883),
  placed('screen_nugget_shine', 134.35, -2.15, 0.6285, -0.0078, 0.0078, 0.6285),
  placed('screen_nugget', 444.45, 58, 5.3858, 1.0939, 1.0939, -5.3858),
  placed('screen_nugget_shine', 154.75, 101.9, 1.1327, 0.23, 0.23, -1.1327),
  placed('screen_nugget', 118.8, 76.8, -0.0451, 4.7397, -4.7397, -0.0451),
  placed('screen_nugget_shine', 207.85, -159.7, -0.0095, 0.9968, -0.9968, -0.0095),
]);

// 关卡内背景（L 帧 depth 1–3）：地层、HUD 橙条+蓝拱+地面、深蓝渐晕。
export const PLAY_BG = Object.freeze([
  placed('bg_underground', 274.8, 235.6),
  placed('bg_hud', 0, 0),
  placed('bg_hud_glow', 274.8, 28.8),
]);

// 全屏面板（shape 55）与 Gold Miner 标志（shape 6）的原版放置。
export const SCREEN_PANEL = placed('screen_panel', 280.65, 165.7);
export const SCREEN_LOGO = placed('logo', 279.4, 53.4, 1.2182);
