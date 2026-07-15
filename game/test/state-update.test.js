import test from 'node:test';
import assert from 'node:assert/strict';

import { createRng } from '../src/random.js';
import { HOOK_BASE_LENGTH, PIVOT } from '../src/config.js';
import {
  createGameState,
  enterShop,
  sceneUsesBgm,
  startNewRun,
} from '../src/state.js';
import { updateGame, useDynamite } from '../src/update.js';

test('ready → play → shop → play 场景流与累计分数', () => {
  const state = createGameState({ rng: createRng(2) });
  state.scene = 'ready';
  startNewRun(state);
  assert.equal(state.scene, 'play');
  assert.equal(state.run.level, 1);
  state.run.score = 700;
  enterShop(state);
  assert.equal(state.scene, 'shop');
  assert.equal(state.shop.nextLevel, 2);
  assert.equal(state.run.score, 700);
});

test('59 号背景音乐属于准备页、商店与开场 GOAL 横幅，不入挖矿本体', () => {
  assert.equal(sceneUsesBgm('ready'), true);
  assert.equal(sceneUsesBgm('shop'), true);
  // 原版 StartSound 59 在 f15/f52 横幅处触发，横幅结束进入挖矿即静音。
  assert.equal(sceneUsesBgm('play', 1.8), true);
  for (const scene of ['loading', 'play', 'pause', 'over', 'win']) {
    assert.equal(sceneUsesBgm(scene, 0), false, scene);
  }
});

test('失败后新开一轮重置分数、炸药、增益和等级', () => {
  const state = createGameState({ rng: createRng(3) });
  state.scene = 'over';
  state.run.level = 7;
  state.run.score = 9999;
  state.inventory.dynamite = 5;
  state.activeBuffs.rock = true;
  state.pendingBuffs.clover = true;
  startNewRun(state);
  assert.equal(state.scene, 'play');
  assert.equal(state.run.level, 1);
  assert.equal(state.run.score, 0);
  assert.equal(state.inventory.dynamite, 0);
  assert.equal(state.activeBuffs.rock, false);
  assert.equal(state.pendingBuffs.clover, false);
});

test('本页已开启的秘籍跨失败重开保留，但不会作为存档写入', () => {
  const state = createGameState({ rng: createRng(3) });
  state.scene = 'over';
  state.secret.autoAimEnabled = true;
  startNewRun(state);
  assert.equal(state.secret.autoAimEnabled, true);
  assert.equal(state.secret.inputBuffer, '');
  assert.equal(state.secret.noticeTime, 0);
});

test('计时结束按累计目标先进过关展示再入商店，或进入失败页', () => {
  const winner = createGameState({ rng: createRng(1) });
  winner.scene = 'play';
  winner.run.time = 0.01;
  winner.run.score = winner.run.goal;
  const sounds = [];
  updateGame(winner, 0.02, key => sounds.push(key));
  // 原版 f94 'yes'：先播 StartSound 63 + 约 2 s “You made it” 展示。
  assert.equal(winner.scene, 'win');
  assert.deepEqual(sounds, ['win']);
  for (let step = 0; step < 60 && winner.scene === 'win'; step += 1) {
    updateGame(winner, 0.05);
  }
  assert.equal(winner.scene, 'shop');

  const loser = createGameState({ rng: createRng(1) });
  loser.scene = 'play';
  loser.run.time = 0.01;
  loser.run.score = loser.run.goal - 1;
  updateGame(loser, 0.02);
  assert.equal(loser.scene, 'over');
});

test('炸药阶段暂停收绳，单独播放并销毁物件且不计分', () => {
  const state = createGameState({ rng: createRng(5) });
  const item = { type: 'gold_big', x: 500, y: 300, alive: true, hooked: true };
  state.scene = 'play';
  state.world.items = [item];
  state.run.score = 0;
  state.run.time = 60;
  state.inventory.dynamite = 1;
  state.hook.phase = 'retract';
  state.hook.extension = 100;
  state.hook.caught = item;
  state.hook.flightDir = { x: 0.6, y: 0.8 };

  const sounds = [];
  const sound = key => sounds.push(key);
  assert.equal(useDynamite(state, sound), true);
  assert.equal(state.inventory.dynamite, 0);
  assert.equal(state.miner.clip, 'dynamite');
  updateGame(state, 0.05, sound);
  updateGame(state, 0.05, sound);
  assert.equal(state.hook.extension, 100, '投掷动画期间收绳暂停');
  assert.equal(item.alive, true);
  updateGame(state, 0.05, sound);
  updateGame(state, 0.05, sound);
  assert.equal(item.alive, false);
  assert.equal(state.hook.caught, null);
  assert.equal(state.run.score, 0);
  assert.equal(state.effects.booms.length, 1);
  assert.deepEqual(sounds, ['click', 'explosion']);
  updateGame(state, 0.05, sound);
  updateGame(state, 0.05, sound);
  assert.equal(state.hook.phase, 'retract');
  updateGame(state, 0.05, sound);
  assert.ok(state.hook.extension < 100, '动画结束后空钩继续收回');
});

test('无炸药或未抓住物件时不能进入投掷状态', () => {
  const state = createGameState({ rng: createRng(5) });
  state.scene = 'play';
  state.hook.phase = 'retract';
  state.inventory.dynamite = 1;
  assert.equal(useDynamite(state), false);
  state.hook.caught = { type: 'gold_big', alive: true, hooked: true };
  state.inventory.dynamite = 0;
  assert.equal(useDynamite(state), false);
});

test('音效事件使用校准后的收绳、收获、钱袋、力量与爆炸语义', () => {
  const normal = createGameState({ rng: () => 0 });
  normal.scene = 'play';
  normal.world.items = [{ type: 'gold_tiny', x: PIVOT.x, y: PIVOT.y + HOOK_BASE_LENGTH + 10, alive: true, hooked: false }];
  normal.hook.phase = 'extend';
  const normalSounds = [];
  updateGame(normal, 0.05, key => normalSounds.push(key));
  assert.deepEqual(normalSounds, ['reel']);

  const diamond = createGameState({ rng: () => 0 });
  const diamondItem = { type: 'diamond', x: 400, y: 200, alive: true, hooked: true };
  diamond.scene = 'play';
  diamond.world.items = [diamondItem];
  diamond.hook.phase = 'retract';
  diamond.hook.extension = 0;
  diamond.hook.caught = diamondItem;
  const diamondSounds = [];
  updateGame(diamond, 0.01, key => diamondSounds.push(key));
  assert.deepEqual(diamondSounds, ['coinHigh']);

  const bag = createGameState({ rng: () => 0.55 });
  const bagItem = { type: 'bag', x: 400, y: 200, alive: true, hooked: true, weight: 3 };
  bag.scene = 'play';
  bag.world.items = [bagItem];
  bag.hook.phase = 'retract';
  bag.hook.extension = 0;
  bag.hook.caught = bagItem;
  const bagSounds = [];
  updateGame(bag, 0.01, key => bagSounds.push(key));
  assert.deepEqual(bagSounds, ['bagReward', 'power']);

  // 原版 TNT 木箱是正常抓取：原地爆炸特效 + 声音 264，然后照常拖回 $1。
  const tnt = createGameState({ rng: () => 0 });
  tnt.scene = 'play';
  tnt.world.items = [{ type: 'tnt', x: PIVOT.x, y: PIVOT.y + HOOK_BASE_LENGTH + 10, alive: true, hooked: false }];
  tnt.hook.phase = 'extend';
  const tntSounds = [];
  updateGame(tnt, 0.05, key => tntSounds.push(key));
  assert.deepEqual(tntSounds, ['explosion', 'reel']);
  assert.equal(tnt.hook.caught, tnt.world.items[0]);
  assert.equal(tnt.effects.booms.length, 1);
});

test('失败与倒计时不再误播背景音乐或钱币声', () => {
  const state = createGameState({ rng: createRng(1) });
  state.scene = 'play';
  state.run.time = 0.01;
  state.run.score = 0;
  const sounds = [];
  updateGame(state, 0.02, key => sounds.push(key));
  assert.equal(state.scene, 'over');
  assert.deepEqual(sounds, []);
});
