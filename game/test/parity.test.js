import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ART_REG,
  GOALS,
  GOLD_SCREEN_BG,
  MINER,
  MOLE,
  PIVOT,
  PLAY_BG,
  SCREEN_LOGO,
  SCREEN_PANEL,
  SHOP_LEAVE,
  STAGE,
  SWF_SCALE,
  TYPE_DEFS,
  goalForLevel,
  itemValue,
  pullSpeed,
} from '../src/config.js';
import { LAYOUTS, layoutLevelFor } from '../src/layouts.js';
import { generateLevel, resolveBagReward, rollBagWeight } from '../src/levels.js';
import { createRng } from '../src/random.js';
import { ANIMATIONS, IMAGE_MANIFEST } from '../src/manifest.js';
import { minerLayout } from '../src/render.js';
import { animationFrameIndex } from '../src/update.js';

function sequenceRng(values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

test('前十关目标与第十一关后的延伸规则一致', () => {
  assert.deepEqual(GOALS, [650, 1195, 2010, 3095, 4450, 6075, 7970, 10135, 12570, 15275]);
  assert.equal(goalForLevel(11), 17980);
  assert.equal(goalForLevel(12), 20685);
});

test('全部物件的原版分值和重量被固定', () => {
  const expected = {
    gold_big: [500, 9, 1, 30.6, 30.6],
    gold_mid: [250, 8, 0.77, 23.5, 23.5],
    gold_small: [100, 7, 0.65, 11.9, 11.9],
    gold_tiny: [50, 3, 0.65, 6.25, 6.25],
    rock_big: [20, 9, 0.65, 14.2, 14.2],
    rock_small: [11, 8, 0.48, 11.8, 9.75],
    diamond: [600, 2, 0.39, 6.6, 6.6],
    mole: [2, 3, 0.39, 9.75, 9.75],
    mole_d: [602, 5, 0.39, 9.75, 9.75],
    bone: [7, 3, 0.39, 12.2, 6.5],
    skull: [20, 2, 0.39, 10.95, 10.95],
    tnt: [1, 2, 0.39, 19.7, 24.4],
    bag: [0, 0, 0.39, 15.6, 15.6],
  };
  for (const [type, [value, weight, scale, halfW, halfH]] of Object.entries(expected)) {
    assert.equal(TYPE_DEFS[type].value, value, `${type} value`);
    assert.equal(TYPE_DEFS[type].weight, weight, `${type} weight`);
    assert.equal(TYPE_DEFS[type].drawScale, scale, `${type} drawScale`);
    assert.equal(TYPE_DEFS[type].hitbox.halfW, halfW, `${type} hitbox width`);
    assert.equal(TYPE_DEFS[type].hitbox.halfH, halfH, `${type} hitbox height`);
  }
});

test('石头与钻石加成只改变对应物件价值', () => {
  assert.equal(itemValue({ type: 'rock_big' }, { rock: true }), 60);
  assert.equal(itemValue({ type: 'rock_small' }, { rock: true }), 33);
  assert.equal(itemValue({ type: 'diamond' }, { diamond: true }), 900);
  assert.equal(itemValue({ type: 'mole_d' }, { diamond: true }), 902);
  assert.equal(itemValue({ type: 'gold_big' }, { rock: true, diamond: true }), 500);
});

test('18 FPS 力量/重量拉取速度：常规差值路径与固定 15 帧快速路径', () => {
  assert.equal(pullSpeed({ type: 'gold_big' }), 37);
  assert.equal(pullSpeed({ type: 'diamond' }), 296);
  assert.equal(pullSpeed({ type: 'diamond' }, { strength: true }), 370);
  // 原版 /:strength==1 走固定跳 15 帧路径，与重量无关。
  assert.equal(pullSpeed({ type: 'diamond' }, {}, true), 555);
  assert.equal(pullSpeed({ type: 'gold_big' }, {}, true), 555);
  // 原版重量 -1 被转成 stickBonus，同样固定 15。
  assert.equal(pullSpeed({ type: 'bag', weight: -1 }), 555);
  // 其余负重量走常规差值：10 - (-5) = 15。
  assert.equal(pullSpeed({ type: 'bag', weight: -5 }), 555);
  assert.equal(pullSpeed({ type: 'bag', weight: -3 }), 481);
});

test('神秘袋四种重量分支', () => {
  assert.equal(rollBagWeight(sequenceRng([0.0, 0.5])), 5);
  assert.equal(rollBagWeight(sequenceRng([0.26, 0.5])), -3);
  assert.equal(rollBagWeight(sequenceRng([0.51])), 9);
  assert.equal(rollBagWeight(sequenceRng([0.99])), -1);
});

test('神秘袋普通与幸运草奖励分支（原版 Sprite 214 骰面）', () => {
  // 无幸运草：1–2 现金、3 空袋、4 力量、5 炸药（库存 <3）、6 $800。
  assert.deepEqual(resolveBagReward(sequenceRng([0.0, 0.5]), false, 0), { kind: 'cash', value: 301 });
  assert.equal(resolveBagReward(sequenceRng([0.34]), false, 0).kind, 'empty');
  assert.equal(resolveBagReward(sequenceRng([0.55]), false, 0).kind, 'power');
  assert.equal(resolveBagReward(sequenceRng([0.72]), false, 2).kind, 'dynamite');
  assert.deepEqual(resolveBagReward(sequenceRng([0.72, 0.5]), false, 3), { kind: 'cash', value: 150 });
  assert.deepEqual(resolveBagReward(sequenceRng([0.99]), false, 0), { kind: 'cash', value: 800 });
  // 有幸运草：1 力量、2–3 炸药（库存 <3）、4–6 $700，永无空袋。
  assert.equal(resolveBagReward(sequenceRng([0.0]), true, 0).kind, 'power');
  assert.equal(resolveBagReward(sequenceRng([0.4]), true, 2).kind, 'dynamite');
  assert.deepEqual(resolveBagReward(sequenceRng([0.4, 0.5]), true, 3), { kind: 'cash', value: 450 });
  assert.deepEqual(resolveBagReward(sequenceRng([0.9]), true, 0), { kind: 'cash', value: 700 });
});

test('原版 30 套布局：物件数、随机三选一可复现、地鼠按镜像方向巡逻', () => {
  const first = generateLevel(4, createRng(2026));
  const second = generateLevel(4, createRng(2026));
  assert.deepEqual(first, second);
  // 原版 things 数量：L1=15、L2=20、L3=17、L4=18、L5=22。
  const expectCounts = { 1: 15, 2: 20, 3: 17, 4: 18, 5: 22 };
  for (const [level, count] of Object.entries(expectCounts)) {
    for (const variant of LAYOUTS[level]) assert.equal(variant.length, count, `L${level}`);
  }
  // 第 10 关之后布局按 4..10 循环。
  assert.equal(layoutLevelFor(10), 10);
  assert.equal(layoutLevelFor(11), 4);
  assert.equal(layoutLevelFor(17), 10);
  assert.equal(layoutLevelFor(18), 4);
  const moles = first.filter(item => item.type === 'mole' || item.type === 'mole_d');
  assert.ok(moles.length > 0);
  for (const mole of moles) {
    assert.equal(Math.abs(mole.vx), MOLE.speed);
    assert.ok(Number.isFinite(mole.originX));
  }
  // 同一 seed 序列下三个变体都可能被选中。
  const chosen = new Set();
  for (let seed = 0; seed < 40; seed += 1) {
    chosen.add(JSON.stringify(generateLevel(1, createRng(seed)).map(item => [item.x, item.y])));
  }
  assert.equal(chosen.size, 3);
});

test('动画片段边界、帧率和播放模式互不混用', () => {
  assert.equal(ANIMATIONS.pull.frames.length, 20);
  assert.equal(ANIMATIONS.dynamite.frames.length, 5);
  assert.equal(ANIMATIONS.idle.frames.length, 5);
  assert.equal(ANIMATIONS.yay.frames.length, 6);
  assert.equal(ANIMATIONS.mole.fps, 18);
  assert.equal(ANIMATIONS.pull.fps, 18);
  assert.equal(ANIMATIONS.pull.mode, 'loop');
  assert.equal(ANIMATIONS.dynamite.mode, 'once');
  assert.equal(new Set([...ANIMATIONS.pull.frames, ...ANIMATIONS.dynamite.frames]).size, 25);
  assert.equal(animationFrameIndex(ANIMATIONS.pull, 20 / 18), 0);
  assert.equal(animationFrameIndex(ANIMATIONS.idle, 99), 4);
  assert.equal(animationFrameIndex(ANIMATIONS.yay, 99), 5);
});

test('组合锚点固定支点且平台底边贴地误差不超过 1 px', () => {
  const layout = minerLayout();
  const pivotX = layout.left + MINER.hookAnchor.x * layout.scale;
  const platformBottom = layout.top + (MINER.platformOffset.y + 27) * layout.scale;
  // 原版摆钩组 C 放在 x=275.5（×1.3 = 358.15），miner 缩放 0.3891×1.3/2。
  assert.ok(Math.abs(pivotX - 275.5 * SWF_SCALE) < 1e-9);
  assert.ok(Math.abs(PIVOT.x - 275.5 * SWF_SCALE) < 1e-9);
  assert.ok(Math.abs(MINER.scale - 0.3891 * SWF_SCALE / 2) < 1e-9);
  assert.ok(Math.abs(platformBottom - STAGE.groundY) <= 1);
  for (const anchor of ['idle', 'pull', 'dynamite', 'yay']) {
    assert.ok(MINER.sourceOffsets[anchor]);
  }
});

test('每种物件都映射到原版钩爪 Sprite 291/292 的专属握持帧', () => {
  // 原版 claw.gotoAndStop(object)：object 编号 2..14 一一对应，无重复。
  const frames = Object.values(TYPE_DEFS).map(def => def.claw);
  assert.equal(frames.length, 13);
  assert.deepEqual([...frames].sort((a, b) => a - b), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  for (const frame of frames) {
    assert.ok(IMAGE_MANIFEST[`claw_hold_${frame}`], `claw_hold_${frame}`);
  }
  assert.ok(IMAGE_MANIFEST.claw_open);
  assert.ok(IMAGE_MANIFEST.claw_empty);
});

test('原版屏幕/HUD 拼贴的每个放置项都有清单资产与注册信息', () => {
  for (const placement of [...GOLD_SCREEN_BG, ...PLAY_BG, SCREEN_PANEL, SCREEN_LOGO]) {
    assert.ok(IMAGE_MANIFEST[placement.key], `manifest: ${placement.key}`);
    assert.ok(ART_REG[placement.key], `registration: ${placement.key}`);
  }
  assert.ok(IMAGE_MANIFEST.hud_exit);
  // 店主离店动画：yes 7 帧 / no 13 帧（Sprite 133 帧 19–25 / 26–38，18 FPS）。
  assert.equal(SHOP_LEAVE.fps, 18);
  for (let index = 0; index < SHOP_LEAVE.yes.frames; index += 1) {
    assert.ok(IMAGE_MANIFEST[`shop_yes_${index}`], `shop_yes_${index}`);
  }
  for (let index = 0; index < SHOP_LEAVE.no.frames; index += 1) {
    assert.ok(IMAGE_MANIFEST[`shop_no_${index}`], `shop_no_${index}`);
  }
});

test('舞台为原版 550×400 的等比 ×1.3（无边距），布局坐标纯缩放换算', () => {
  assert.equal(STAGE.width, 715);
  assert.equal(STAGE.height, 520);
  assert.equal(SWF_SCALE, 1.3);
  const level = generateLevel(1, createRng(7));
  for (const item of level) {
    assert.ok(item.x <= 550 * SWF_SCALE + 60 && item.x >= -160, `x=${item.x}`);
    assert.ok(item.y <= 400 * SWF_SCALE + 10 && item.y >= 100, `y=${item.y}`);
  }
});
