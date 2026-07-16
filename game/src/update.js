import {
  BLAST,
  EXPLOSION_SCALE,
  HOOK,
  MOLE,
  PIVOT,
  SHOP_LEAVE,
  STAGE,
  SWF_SCALE,
  SWING,
  TYPE_DEFS,
  itemValue,
  pullSpeed,
} from './config.js';
import {
  angleToDirection,
  crossedAngle,
  directionToTarget,
  hookTip,
  pointInHitbox,
} from './geometry.js';
import { ANIMATIONS } from './manifest.js';
import { resolveBagReward } from './levels.js';
import {
  enterGameOver,
  enterShop,
  enterWin,
  setMinerClip,
  startNextLevel,
} from './state.js';

const TWO_PI = Math.PI * 2;
const THROW_DESTROY_TIME = 3 / 18;
const THROW_END_TIME = 5 / 18;

export function launchToward(state, target, sound = () => {}) {
  if (state.scene !== 'play'
    || state.run.introTime > 0
    || state.hook.phase !== 'swing') return false;
  const direction = directionToTarget(target, PIVOT);
  state.hook.phase = 'extend';
  state.hook.flightDir = { ...direction };
  state.hook.extension = 0;
  state.hook.caught = null;
  state.aim = null;
  sound('click');
  return true;
}

export function launchManual(state, sound = () => {}) {
  const targetDirection = angleToDirection(state.hook.swingAngle);
  return launchToward(state, {
    x: PIVOT.x + targetDirection.x * 100,
    y: PIVOT.y + targetDirection.y * 100,
  }, sound);
}

// 原版按钮 293（左/右方向键）：只在下放前段（Sprite 298 第 3–10 帧）存活，
// 触发后矿工转为收绳姿势、空钩按 stickBonus 快速路径收回。
export function abortExtend(state, sound = () => {}) {
  const hook = state.hook;
  if (state.scene !== 'play'
    || hook.phase !== 'extend'
    || hook.extension > HOOK.abortExtension) return false;
  hook.caught = null;
  hook.phase = 'retract';
  sound('click');
  return true;
}

// 原版主时间轴按钮 202：关卡内点击立即 gotoAndPlay('end') 提前结算。
export function endLevelEarly(state, sound = () => {}) {
  if (state.scene !== 'play' || state.run.introTime > 0) return false;
  finishByTime(state, sound);
  return true;
}

export function useDynamite(state, sound = () => {}) {
  const hook = state.hook;
  if (state.scene !== 'play'
    || hook.phase !== 'retract'
    || !hook.caught
    || state.inventory.dynamite <= 0) return false;
  state.inventory.dynamite -= 1;
  hook.phase = 'dynamite';
  hook.dynamiteElapsed = 0;
  hook.dynamiteDestroyed = false;
  setMinerClip(state, 'dynamite');
  sound('click');
  return true;
}

function desiredMinerClip(state) {
  if (state.hook.phase === 'dynamite') return 'dynamite';
  if (state.miner.celebrationTime > 0) return 'yay';
  // 原版矿工在任何收绳期间（含空钩）都播放摇柄动画（Sprite 248 循环）。
  if (state.hook.phase === 'retract') return 'pull';
  return 'idle';
}

function updateMinerAnimation(state, dt) {
  if (state.miner.celebrationTime > 0) {
    state.miner.celebrationTime = Math.max(0, state.miner.celebrationTime - dt);
  }
  setMinerClip(state, desiredMinerClip(state));
  state.miner.elapsed += dt;
}

export function animationFrameIndex(animation, elapsed) {
  const raw = Math.floor(elapsed * animation.fps);
  return animation.mode === 'loop'
    ? raw % animation.frames.length
    : Math.min(raw, animation.frames.length - 1);
}

function settleBag(state, item, sound) {
  const reward = resolveBagReward(
    state.rng,
    state.activeBuffs.clover,
    state.inventory.dynamite,
  );
  if (reward.kind === 'cash') {
    state.run.score += reward.value;
    addPopup(state, `$${reward.value}`, reward.value >= 100);
    sound('bagReward');
    return reward.value;
  }
  if (reward.kind === 'power') {
    state.run.bagPower = true;
    addPopup(state, reward.label, true);
    sound('bagReward');
    sound('power');
    return 0;
  }
  if (reward.kind === 'empty') {
    addPopup(state, reward.label, false);
    sound('bagReward');
    return 0;
  }
  state.inventory.dynamite = Math.min(5, state.inventory.dynamite + reward.amount);
  addPopup(state, reward.label, true);
  sound('bagReward');
  sound('power');
  return 0;
}

function addPopup(state, label, good) {
  state.effects.popups.push({ x: PIVOT.x, y: PIVOT.y + 30, label, elapsed: 0, good });
}

function settleCaught(state, sound) {
  const item = state.hook.caught;
  if (!item) return;
  let value = 0;
  if (item.type === 'bag') {
    value = settleBag(state, item, sound);
  } else {
    value = itemValue(item, state.activeBuffs);
    state.run.score += value;
    addPopup(state, `$${value}`, value >= 100);
    sound(item.type === 'diamond' || item.type === 'mole_d' ? 'coinHigh' : 'coin');
  }
  if (value >= 250) state.miner.celebrationTime = ANIMATIONS.yay.frames.length / ANIMATIONS.yay.fps;
  item.alive = false;
  item.hooked = false;
}

function returnHook(state, sound) {
  settleCaught(state, sound);
  state.hook.caught = null;
  state.hook.extension = 0;
  state.hook.phase = 'swing';
  state.hook.dynamiteDestroyed = false;
  if (state.world.items.every(item => !item.alive) && state.run.score >= state.run.goal) {
    enterWin(state);
    sound('win');
  }
}

function updateDynamite(state, dt, sound) {
  const hook = state.hook;
  hook.dynamiteElapsed += dt;
  if (!hook.dynamiteDestroyed && hook.dynamiteElapsed >= THROW_DESTROY_TIME) {
    hook.dynamiteDestroyed = true;
    if (hook.caught) {
      hook.caught.alive = false;
      hook.caught.hooked = false;
      const tip = hookTip(hook);
      state.effects.booms.push({ x: tip.x, y: tip.y, elapsed: 0, scale: EXPLOSION_SCALE.dynamite });
      hook.caught = null;
      sound('explosion');
    }
  }
  if (hook.dynamiteElapsed >= THROW_END_TIME) hook.phase = 'retract';
}

function updateHook(state, dt, sound) {
  const hook = state.hook;
  if (hook.phase === 'swing') {
    const current = hook.swingAngle;
    state.swingTime += dt;
    const next = SWING.amplitude * Math.sin(state.swingTime * TWO_PI / SWING.period);
    hook.swingAngle = next;
    if (state.aim && crossedAngle(current, next, state.aim.angle)) {
      const target = { x: state.aim.x, y: state.aim.y };
      launchToward(state, target, sound);
    }
    return;
  }

  if (hook.phase === 'dynamite') {
    updateDynamite(state, dt, sound);
    return;
  }

  if (hook.phase === 'extend') {
    hook.extension += HOOK.extendSpeed * dt;
    const tip = hookTip(hook);
    for (const item of state.world.items) {
      if (!item.alive || item.hooked) continue;
      if (!pointInHitbox(tip, item, TYPE_DEFS[item.type].hitbox)) continue;
      // 原版 TNT 木箱（object 9）也是正常抓取：原地播放爆炸（Sprite 331 帧 2 +
      // 声音 264），钩子照样拖回 $1 的安慰奖；范围伤害由爆炸剪辑自身的
      // 传感器帧承担（见 applyBlastDamage / config.BLAST）。
      if (item.type === 'tnt') {
        state.effects.booms.push({ x: item.x, y: item.y, elapsed: 0, scale: EXPLOSION_SCALE.tnt });
        sound('explosion');
      }
      item.hooked = true;
      hook.caught = item;
      hook.phase = 'retract';
      sound('reel');
      break;
    }
    if (hook.phase === 'extend'
      && (hook.extension >= HOOK.maxExtension
        || tip.x < 6 || tip.x > STAGE.width - 6 || tip.y > STAGE.height - 6)) {
      hook.phase = 'retract';
    }
    return;
  }

  if (hook.phase === 'retract') {
    const speed = hook.caught
      ? pullSpeed(hook.caught, state.activeBuffs, state.run.bagPower)
      : HOOK.emptyRetractSpeed;
    hook.extension = Math.max(0, hook.extension - speed * dt);
    if (hook.caught) {
      const tip = hookTip(hook);
      hook.caught.x = tip.x;
      hook.caught.y = tip.y + TYPE_DEFS[hook.caught.type].hitbox.halfH * 0.6;
    }
    if (hook.extension <= 0) returnHook(state, sound);
  }
}

// 原版地鼠（Sprite 317/319）在放置点附近往返巡逻，端点随机停顿后掉头，
// 不会横穿整张地图。巡逻带以放置点为中心、总宽 MOLE.patrolSpan，夹在舞台内。
function updateWorld(state, dt) {
  for (const item of state.world.items) {
    if (!item.alive) continue;
    item.animationTime += dt;
    if ((item.type !== 'mole' && item.type !== 'mole_d') || item.hooked) continue;
    if (item.pause > 0) {
      item.pause = Math.max(0, item.pause - dt);
      if (item.pause === 0) item.vx = -item.vx;
      continue;
    }
    // 巡逻带允许伸出舞台：原版有从画面外走进来的地鼠（如 L6_1 的 x=-118）。
    const origin = item.originX ?? item.x;
    const minX = origin - MOLE.patrolSpan / 2;
    const maxX = origin + MOLE.patrolSpan / 2;
    item.x += item.vx * dt;
    if (item.x <= minX || item.x >= maxX) {
      item.x = Math.min(maxX, Math.max(minX, item.x));
      item.pause = MOLE.pauseMin + state.rng() * (MOLE.pauseMax - MOLE.pauseMin);
    }
  }
}

// 传感器帧窗口内（SWF 第 9–13 帧）逐 tick 做 AABB 判定，命中的物件原地消失、
// 不给钱；被波及的 TNT 木箱按原版 gotoAndStop(2) 语义再次爆炸，形成连锁。
// 被钩住的物件豁免——原版抓取瞬间场上本体已 gotoAndStop(2) 隐藏，box 不存在。
function applyBlastDamage(state, boom, sound) {
  const frame = Math.floor(boom.elapsed * ANIMATIONS.explosion.fps);
  if (frame < BLAST.firstFrame || frame > BLAST.lastFrame) return;
  const k = boom.scale * SWF_SCALE;
  const xMin = boom.x + BLAST.rect.xMin * k;
  const xMax = boom.x + BLAST.rect.xMax * k;
  const yMin = boom.y + BLAST.rect.yMin * k;
  const yMax = boom.y + BLAST.rect.yMax * k;
  for (const item of state.world.items) {
    if (!item.alive || item.hooked) continue;
    const box = TYPE_DEFS[item.type].hitbox;
    if (item.x + box.halfW < xMin || item.x - box.halfW > xMax
      || item.y + box.halfH < yMin || item.y - box.halfH > yMax) continue;
    item.alive = false;
    if (item.type === 'tnt') {
      state.effects.booms.push({ x: item.x, y: item.y, elapsed: 0, scale: EXPLOSION_SCALE.tnt });
      sound('explosion');
    }
  }
}

function updateEffects(state, dt, sound) {
  state.effects.popups.forEach(popup => { popup.elapsed += dt; });
  state.effects.popups = state.effects.popups.filter(popup => popup.elapsed < 1.2);
  // 索引循环：连锁爆炸会在遍历中追加新 boom，其传感器要到自身第 9 帧才激活。
  for (let i = 0; i < state.effects.booms.length; i++) {
    const boom = state.effects.booms[i];
    boom.elapsed += dt;
    applyBlastDamage(state, boom, sound);
  }
  // 原版爆炸 Sprite 263 共 14 帧（18 FPS ≈ 0.78 s）。
  const boomDuration = ANIMATIONS.explosion.frames.length / ANIMATIONS.explosion.fps;
  state.effects.booms = state.effects.booms.filter(boom => boom.elapsed < boomDuration);
}

// 原版 f90 'end'：score >= goal → f94 'yes' 过关展示，否则 f140 'no'。
function finishByTime(state, sound) {
  state.run.time = 0;
  if (state.run.score >= state.run.goal) {
    enterWin(state);
    sound('win');
  } else {
    enterGameOver(state);
  }
}

export function updateGame(state, dt, sound = () => {}) {
  const delta = Math.min(0.05, Math.max(0, dt));
  if (state.scene === 'pause') {
    state.secret.noticeTime = Math.max(0, state.secret.noticeTime - delta);
    return;
  }
  if (state.scene === 'shop') {
    if (state.shop?.messageTime > 0) {
      state.shop.messageTime = Math.max(0, state.shop.messageTime - delta);
    }
    // 店主 yes/no 离店动画（18 FPS 单次）播完后才真正进入下一关。
    const leaving = state.shop?.leaving;
    if (leaving) {
      leaving.elapsed += delta;
      const clip = SHOP_LEAVE[leaving.kind];
      if (leaving.elapsed >= clip.frames / SHOP_LEAVE.fps) startNextLevel(state);
      return;
    }
  }
  // 原版 f94–130 过关展示约 2 s，结束后（f130）才放置商店。
  if (state.scene === 'win') {
    state.run.winTime = Math.max(0, state.run.winTime - delta);
    if (state.run.winTime === 0) enterShop(state);
    return;
  }
  if (state.scene === 'over') {
    state.run.overElapsed += delta;
    return;
  }
  updateEffects(state, delta, sound);
  updateMinerAnimation(state, delta);
  if (state.scene !== 'play') return;

  // 全屏 “GOAL $x” 横幅期间关卡尚未出场：模拟完全冻结，横幅结束才开始。
  if (state.run.introTime > 0) {
    state.run.introTime = Math.max(0, state.run.introTime - delta);
    return;
  }

  state.run.time -= delta;
  if (state.run.time <= 0) {
    finishByTime(state, sound);
    return;
  }

  if (state.aim) state.aim.blink += delta;
  updateWorld(state, delta);
  updateHook(state, delta, sound);
}
