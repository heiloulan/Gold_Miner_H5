import test from 'node:test';
import assert from 'node:assert/strict';

import { PAUSE_LAYOUT, PIVOT, SHOP_LAYOUT } from '../src/config.js';
import { directionToTarget } from '../src/geometry.js';
import { bindInput } from '../src/input.js';
import { createRng } from '../src/random.js';
import { createGameState, openDebugShop } from '../src/state.js';
import { updateGame } from '../src/update.js';

function event(key) {
  return { key, prevented: false, preventDefault() { this.prevented = true; } };
}

function inputHarness(state) {
  const canvasListeners = new Map();
  const windowListeners = new Map();
  const sounds = [];
  const canvas = {
    style: {},
    addEventListener(type, listener) { canvasListeners.set(type, listener); },
    getBoundingClientRect() { return { left: 100, top: 78, width: 715, height: 520 }; },
  };
  const assets = {
    muted: false,
    unlockCount: 0,
    stopMusicCount: 0,
    musicKey: 'bgm',
    play(key) { sounds.push(key); },
    unlockAudio() {
      this.unlockCount += 1;
      this.musicKeyAtUnlock = this.musicKey;
    },
    stopMusic() {
      this.stopMusicCount += 1;
      this.musicKey = null;
    },
    toggleMuted() { this.muted = !this.muted; },
  };
  globalThis.window = {
    addEventListener(type, listener) { windowListeners.set(type, listener); },
  };
  bindInput(canvas, state, assets);
  return { canvas, canvasListeners, windowListeners, assets, sounds };
}

function keydown(listeners, key) {
  const input = event(key);
  listeners.get('keydown')(input);
  return input;
}

function click(listeners, x, y, button = 0) {
  listeners.get('pointerdown')({ button, clientX: 100 + x, clientY: 78 + y });
}

test('秘籍开启前地下点击不产生准星，手动发射仍可用', () => {
  const state = createGameState({ rng: createRng(44) });
  state.scene = 'play';
  state.world.items = [];
  const { canvas, canvasListeners, windowListeners, sounds } = inputHarness(state);

  click(canvasListeners, 140, 400);
  assert.equal(state.aim, null);
  assert.equal(state.hook.phase, 'swing');
  assert.equal(canvas.style.cursor, 'default');

  keydown(windowListeners, 'ArrowDown');
  assert.equal(state.hook.phase, 'extend');
  assert.deepEqual(sounds, ['click']);
});

test('开始进入 GOAL 横幅时 BGM 不被输入掐断（原版 59 覆盖到横幅）', () => {
  const state = createGameState({ rng: createRng(44) });
  state.scene = 'ready';
  const { canvasListeners, assets } = inputHarness(state);

  click(canvasListeners, 350, 260);
  assert.equal(state.scene, 'play');
  assert.ok(state.run.introTime > 0);
  assert.equal(assets.stopMusicCount, 0, '横幅期间沿用 59，由 syncMusic 按场景停止');
});

test('离开商店播放店主 yes/no 段，动画播完才进入下一关', () => {
  const state = createGameState({ rng: createRng(42) });
  openDebugShop(state);
  const { canvasListeners, windowListeners, sounds } = inputHarness(state);

  // 未购买任何商品 → 'no' 段（原版帧 26–38，声音 132）。
  click(canvasListeners, SHOP_LAYOUT.nextButton.x, SHOP_LAYOUT.nextButton.y);
  assert.equal(state.scene, 'shop');
  assert.equal(state.shop.leaving.kind, 'no');
  assert.deepEqual(sounds, ['click', 'purchaseFailure']);

  // 动画期间商店不再响应重复点击/按键。
  click(canvasListeners, SHOP_LAYOUT.nextButton.x, SHOP_LAYOUT.nextButton.y);
  keydown(windowListeners, 'Enter');
  assert.equal(sounds.length, 2);

  for (let step = 0; step < 30 && state.scene === 'shop'; step += 1) {
    updateGame(state, 0.05);
  }
  assert.equal(state.scene, 'play');

  // 买过任一商品 → 'yes' 段（原版帧 19–25，声音 88）。
  const buyer = createGameState({ rng: createRng(42) });
  openDebugShop(buyer);
  const harness = inputHarness(buyer);
  const index = buyer.shop.offers.findIndex(offer => offer.available);
  click(harness.canvasListeners, SHOP_LAYOUT.slots[index].x, SHOP_LAYOUT.slots[index].y);
  assert.equal(buyer.shop.offers[index].purchased, true);
  keydown(harness.windowListeners, 'Enter');
  assert.equal(buyer.shop.leaving.kind, 'yes');
  assert.equal(harness.sounds.at(-1), 'purchaseSuccess');
  for (let step = 0; step < 30 && buyer.scene === 'shop'; step += 1) {
    updateGame(buyer, 0.05);
  }
  assert.equal(buyer.scene, 'play');
});

test('Esc、P、HUD 按钮和暂停页按钮都能暂停或恢复，暂停冻结模拟', () => {
  const state = createGameState({ rng: createRng(1) });
  state.scene = 'play';
  state.run.time = 42;
  state.hook.swingAngle = 0.4;
  state.miner.elapsed = 0.3;
  state.effects.popups.push({ x: 1, y: 2, elapsed: 0, label: '$1', good: false });
  state.world.items = [{ type: 'mole', x: 300, y: 300, alive: true, hooked: false, vx: 48, animationTime: 0 }];
  const { canvasListeners, windowListeners } = inputHarness(state);

  const paused = keydown(windowListeners, 'Escape');
  assert.equal(paused.prevented, true);
  assert.equal(state.scene, 'pause');
  const snapshot = structuredClone({
    time: state.run.time,
    hook: state.hook,
    item: state.world.items[0],
    miner: state.miner,
    effects: state.effects,
  });
  updateGame(state, 0.05);
  assert.deepEqual({
    time: state.run.time,
    hook: state.hook,
    item: state.world.items[0],
    miner: state.miner,
    effects: state.effects,
  }, snapshot);

  click(canvasListeners, PAUSE_LAYOUT.resumeButton.x, PAUSE_LAYOUT.resumeButton.y);
  assert.equal(state.scene, 'play');
  click(canvasListeners, PAUSE_LAYOUT.hudButton.x, PAUSE_LAYOUT.hudButton.y);
  assert.equal(state.scene, 'pause');
  keydown(windowListeners, 'P');
  assert.equal(state.scene, 'play');
});

test('秘籍只能在暂停页输入；开启后点击可替换准星且 Esc 只暂停', () => {
  const state = createGameState({ rng: createRng(44) });
  state.scene = 'play';
  state.world.items = [];
  const { canvas, canvasListeners, windowListeners } = inputHarness(state);

  for (const letter of 'whosyourdaddy') keydown(windowListeners, letter);
  assert.equal(state.secret.autoAimEnabled, false);
  keydown(windowListeners, 'P');
  for (const letter of 'whosyourdaddx') keydown(windowListeners, letter);
  assert.equal(state.secret.autoAimEnabled, false);
  for (const letter of 'whosyourdaddy') keydown(windowListeners, letter);
  assert.equal(state.secret.autoAimEnabled, true);
  assert.ok(state.secret.noticeTime > 0);
  keydown(windowListeners, 'Escape');
  assert.equal(state.scene, 'play');
  assert.equal(canvas.style.cursor, 'crosshair');

  click(canvasListeners, 140, 400);
  assert.ok(state.aim);
  const firstAim = { ...state.aim };
  click(canvasListeners, 660, 400);
  assert.notEqual(state.aim.x, firstAim.x);
  const pendingAim = { ...state.aim };
  canvasListeners.get('contextmenu')({ preventDefault() {} });
  assert.deepEqual(state.aim, pendingAim);
  keydown(windowListeners, 'Escape');
  assert.equal(state.scene, 'pause');
  assert.deepEqual(state.aim, pendingAim);
  keydown(windowListeners, 'Escape');
  assert.equal(state.scene, 'play');
  const expected = directionToTarget({ x: 660, y: 400 }, PIVOT);
  for (let step = 0; step < 400 && state.hook.phase === 'swing'; step += 1) {
    updateGame(state, 1 / 120);
  }
  assert.equal(state.hook.phase, 'extend');
  assert.ok(Math.abs(state.hook.flightDir.x - expected.x) < 1e-9);
  assert.ok(Math.abs(state.hook.flightDir.y - expected.y) < 1e-9);
});

test('商店购买与手动静音走校准后的 UI 音效', () => {
  const state = createGameState({ rng: createRng(42) });
  openDebugShop(state);
  const { canvasListeners, windowListeners, assets, sounds } = inputHarness(state);
  const index = state.shop.offers.findIndex(offer => offer.available);
  const offer = state.shop.offers[index];
  const slot = SHOP_LAYOUT.slots[index];
  const score = state.run.score;
  click(canvasListeners, slot.x, slot.y);
  assert.equal(state.scene, 'shop');
  assert.equal(offer.purchased, true);
  assert.ok(state.run.score < score);
  assert.deepEqual(sounds.slice(0, 2), ['click', 'purchaseSuccess']);

  const failureOffer = state.shop.offers.find(offer => !offer.purchased);
  failureOffer.available = true;
  failureOffer.price = state.run.score + 1;
  const failureIndex = state.shop.offers.indexOf(failureOffer);
  click(canvasListeners, SHOP_LAYOUT.slots[failureIndex].x, SHOP_LAYOUT.slots[failureIndex].y);
  assert.equal(sounds.at(-1), 'purchaseFailure');

  keydown(windowListeners, 'M');
  assert.equal(assets.muted, true);
});
