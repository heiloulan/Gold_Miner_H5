import {
  EMPTY_BUFFS,
  goalForLevel,
  newBuffs,
  SWING,
} from './config.js';
import { angleToDirection } from './geometry.js';
import { generateLevel } from './levels.js';
import { createShop } from './shop.js';

export function createHook() {
  return {
    phase: 'swing',
    swingAngle: 0,
    flightDir: angleToDirection(0),
    extension: 0,
    caught: null,
    dynamiteElapsed: 0,
    dynamiteDestroyed: false,
  };
}

/**
 * 59 号配乐属于原版的非挖矿界面：标题/准备页、商店，以及每关开场的
 * “GOAL $x” 全屏横幅（原版 StartSound 59 就在 f15/f52 横幅处触发）。
 * 挖矿本体、过关展示、暂停与失败页都不保留背景音乐。
 */
export function sceneUsesBgm(scene, introTime = 0) {
  return scene === 'ready' || scene === 'shop' || (scene === 'play' && introTime > 0);
}

export function createGameState({ rng = Math.random, debug = false } = {}) {
  return {
    scene: 'loading',
    rng,
    debug,
    loadErrors: [],
    run: {
      level: 1,
      score: 0,
      goal: goalForLevel(1),
      time: 60,
      bagPower: false,
      introTime: 0,
      winTime: 0,
      overElapsed: 0,
    },
    world: { items: [] },
    hook: createHook(),
    inventory: { dynamite: 0 },
    activeBuffs: newBuffs(),
    pendingBuffs: newBuffs(),
    shop: null,
    aim: null,
    secret: {
      autoAimEnabled: false,
      inputBuffer: '',
      noticeTime: 0,
    },
    swingTime: rng() * SWING.period,
    miner: { clip: 'idle', elapsed: 0, celebrationTime: 0 },
    effects: { popups: [], booms: [] },
  };
}

export function setMinerClip(state, clip) {
  if (state.miner.clip === clip) return;
  state.miner.clip = clip;
  state.miner.elapsed = 0;
}

export function startLevel(state, level, { activatePending = false } = {}) {
  if (activatePending) {
    state.activeBuffs = newBuffs(state.pendingBuffs);
    state.pendingBuffs = newBuffs();
  }
  state.run.level = level;
  state.run.goal = goalForLevel(level);
  state.run.time = 60;
  state.run.bagPower = false;
  // 原版每关先播约 33 帧（约 1.8 s）的全屏 “GOAL $x” 横幅（主时间轴
  // f15–48 / f52–86，金块墙 + 面板 + “Your First/Next Goal is”）。横幅期间
  // 关卡尚未出场：模拟完全冻结、不能发射，横幅结束后才开始摆钩与计时。
  state.run.introTime = 1.8;
  state.run.winTime = 0;
  state.run.overElapsed = 0;
  state.world.items = generateLevel(level, state.rng);
  state.hook = createHook();
  // 原版 Sprite 299 frame 2：每关摆钩从随机相位开始（random(82) 跳帧）。
  state.swingTime = state.rng() * SWING.period;
  state.aim = null;
  state.shop = null;
  state.miner = { clip: 'idle', elapsed: 0, celebrationTime: 0 };
  state.effects = { popups: [], booms: [] };
  state.scene = 'play';
}

export function startNewRun(state) {
  state.run.score = 0;
  state.inventory.dynamite = 0;
  state.activeBuffs = newBuffs();
  state.pendingBuffs = newBuffs();
  state.secret.inputBuffer = '';
  state.secret.noticeTime = 0;
  startLevel(state, 1);
}

export function togglePause(state) {
  if (state.scene === 'play') {
    state.scene = 'pause';
    return true;
  }
  if (state.scene === 'pause') {
    state.scene = 'play';
    return true;
  }
  return false;
}

export function enterPauseCheatKey(state, key) {
  if (state.scene !== 'pause' || state.secret.autoAimEnabled) return false;
  if (!/^[a-z]$/i.test(key)) {
    state.secret.inputBuffer = '';
    return false;
  }
  const code = 'whosyourdaddy';
  state.secret.inputBuffer = `${state.secret.inputBuffer}${key.toLowerCase()}`.slice(-code.length);
  if (state.secret.inputBuffer !== code) return false;
  state.secret.autoAimEnabled = true;
  state.secret.inputBuffer = '';
  state.secret.noticeTime = 1.8;
  return true;
}

// 原版主时间轴 f94 'yes'：StartSound 63 + 约 36 帧（2 s）的
// “You made it to the next Level!” 缩放展示，f130 才放置商店。
export function enterWin(state) {
  state.run.winTime = 2;
  state.aim = null;
  state.scene = 'win';
}

// 原版 f140 'no'：面板从画面上方滑落，随后 f169 显示 endText 与重玩按钮。
export function enterGameOver(state) {
  state.run.overElapsed = 0;
  state.aim = null;
  state.scene = 'over';
}

export function enterShop(state) {
  const nextLevel = state.run.level + 1;
  state.activeBuffs = newBuffs(EMPTY_BUFFS);
  state.pendingBuffs = newBuffs(EMPTY_BUFFS);
  state.shop = createShop(nextLevel, state.rng, state.inventory.dynamite);
  state.aim = null;
  state.scene = 'shop';
}

// 原版商店门按钮 81：买过任一商品 → 帧 19 'yes'（店主开心，声音 88），
// 否则帧 26 'no'（店主不悦，声音 132）；动画播完才 _root.play() 进下一关。
export function beginShopLeave(state) {
  if (state.scene !== 'shop' || !state.shop || state.shop.leaving) return null;
  const kind = state.shop.offers.some(offer => offer.purchased) ? 'yes' : 'no';
  state.shop.leaving = { kind, elapsed: 0 };
  return kind;
}

export function startNextLevel(state) {
  if (state.scene !== 'shop' || !state.shop) return false;
  startLevel(state, state.shop.nextLevel, { activatePending: true });
  return true;
}

export function openDebugShop(state) {
  state.run.level = 1;
  state.run.score = 5000;
  state.inventory.dynamite = 0;
  state.activeBuffs = newBuffs();
  state.pendingBuffs = newBuffs();
  enterShop(state);
}
