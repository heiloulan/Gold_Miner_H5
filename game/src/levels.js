import { MOLE, SWF_SCALE, TYPE_DEFS } from './config.js';
import { LAYOUTS, layoutLevelFor } from './layouts.js';
import { randomInt } from './random.js';

// SWF 550×400 → H5 715×520：等比 ×1.3，无边距（见 FLASH_PARITY.md §1）。

export function rollBagWeight(rng) {
  switch (randomInt(rng, 1, 4)) {
    case 1: return randomInt(rng, 1, 9);
    case 2: return -randomInt(rng, 1, 5);
    case 3: return 9;
    default: return -1;
  }
}

// 原版 Sprite 214 子对象 onClipEvent(load) 的逐字节还原：
// 无幸运草 w2=1..6：1–2 现金 $1..600；3 空袋（bscore 保持 0，无任何反馈）；
// 4 力量；5 库存 <3 时炸药、否则现金 $100..199；6 现金 $800。
// 有幸运草：1 力量；2–3 库存 <3 时炸药、否则现金 $300..599；4–6 现金 $700。
export function resolveBagReward(rng, hasClover, dynamiteCount) {
  const roll = randomInt(rng, 1, 6);
  if (hasClover) {
    if (roll === 1) return { kind: 'power', label: '力量增强！' };
    if (roll <= 3) {
      return dynamiteCount < 3
        ? { kind: 'dynamite', amount: 1, label: '获得炸药！' }
        : { kind: 'cash', value: randomInt(rng, 300, 599) };
    }
    return { kind: 'cash', value: 700 };
  }

  if (roll <= 2) return { kind: 'cash', value: randomInt(rng, 1, 600) };
  if (roll === 3) return { kind: 'empty', label: '空袋子…' };
  if (roll === 4) return { kind: 'power', label: '力量增强！' };
  if (roll === 5) {
    return dynamiteCount < 3
      ? { kind: 'dynamite', amount: 1, label: '获得炸药！' }
      : { kind: 'cash', value: randomInt(rng, 100, 199) };
  }
  return { kind: 'cash', value: 800 };
}

// 原版关卡：主时间轴 frame 48/86 的 gotoAndStop("L" + level + "_" + (random(3)+1))。
// 第 10 关之后布局按 4..10 循环（frame 52 的 level=4 重置），目标继续上涨。
export function generateLevel(level, rng) {
  const variants = LAYOUTS[layoutLevelFor(level)];
  const layout = variants[randomInt(rng, 1, variants.length) - 1];
  return layout.map(([type, swfX, swfY, mirror]) => {
    const item = {
      type,
      x: swfX * SWF_SCALE,
      y: swfY * SWF_SCALE,
      alive: true,
      hooked: false,
      layoutRadius: TYPE_DEFS[type].layoutRadius,
      animationTime: rng() * 10,
    };
    if (type === 'bag') item.weight = rollBagWeight(rng);
    if (type === 'mole' || type === 'mole_d') {
      // 原版地鼠从放置点出发单侧巡逻：默认向左 patrolSpan，镜像放置则向右。
      item.originX = item.x + (mirror ? MOLE.patrolSpan / 2 : -MOLE.patrolSpan / 2);
      item.vx = (mirror ? 1 : -1) * MOLE.speed;
      item.pause = 0;
    }
    return item;
  });
}
