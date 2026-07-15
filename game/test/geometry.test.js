import test from 'node:test';
import assert from 'node:assert/strict';

import { PIVOT, SWING } from '../src/config.js';
import {
  angleToDirection,
  clawRotation,
  crossedAngle,
  directionToTarget,
  hookTip,
  pointInHitbox,
  projectAim,
} from '../src/geometry.js';
import { createGameState } from '../src/state.js';
import { launchManual, launchToward, updateGame } from '../src/update.js';

const close = (actual, expected, epsilon = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≉ ${expected}`);
};

test('目标方向会归一化', () => {
  const direction = directionToTarget({ x: PIVOT.x + 30, y: PIVOT.y + 40 });
  close(direction.x, 0.6);
  close(direction.y, 0.8);
  close(Math.hypot(direction.x, direction.y), 1);
});

test('超出摆幅的准星投影到同一条边界射线', () => {
  const aim = projectAim({ x: 790, y: PIVOT.y + 20 });
  close(aim.angle, SWING.amplitude);
  close(aim.direction.x, Math.sin(SWING.amplitude));
  close(aim.direction.y, Math.cos(SWING.amplitude));
  close((aim.x - PIVOT.x) * aim.direction.y, (aim.y - PIVOT.y) * aim.direction.x, 1e-7);
  assert.equal(aim.projected, true);
});

test('自动越角检测覆盖穿过目标与接近目标两种情况', () => {
  assert.equal(crossedAngle(-0.1, 0.1, 0), true);
  assert.equal(crossedAngle(0.5, 0.6, 0), false);
  assert.equal(crossedAngle(0.005, 0.02, 0), true);
});

test('发射后轨迹与锁定 flightDir 共线且方向不再变化', () => {
  const state = createGameState({ rng: () => 0.5 });
  state.scene = 'play';
  state.world.items = [];
  const target = { x: 610, y: 360 };
  assert.equal(launchToward(state, target), true);
  const reference = { ...state.hook.flightDir };

  for (let index = 0; index < 5; index += 1) {
    updateGame(state, 0.05);
    const tip = hookTip(state.hook);
    close((tip.x - PIVOT.x) * reference.y, (tip.y - PIVOT.y) * reference.x, 1e-7);
    close(state.hook.flightDir.x, reference.x);
    close(state.hook.flightDir.y, reference.y);
  }
});

test('左、中、右目标均沿 pivot → target 方向直射', () => {
  for (const x of [140, 400, 660]) {
    const state = createGameState({ rng: () => 0.5 });
    state.scene = 'play';
    state.world.items = [];
    const target = { x, y: 400 };
    launchToward(state, target);
    const expected = directionToTarget(target);
    close(state.hook.flightDir.x, expected.x);
    close(state.hook.flightDir.y, expected.y);
  }
});

test('自动发射在越角瞬间重新使用 pivot 到准星的方向', () => {
  const state = createGameState({ rng: () => 0 });
  state.scene = 'play';
  state.world.items = [];
  state.swingTime = 0;
  state.hook.swingAngle = -0.001;
  state.aim = projectAim({ x: PIVOT.x, y: 400 });
  updateGame(state, 0.01);
  assert.equal(state.hook.phase, 'extend');
  close(state.hook.flightDir.x, 0);
  close(state.hook.flightDir.y, 1);
});

test('手动发射锁定按键瞬间的摆动方向', () => {
  const state = createGameState({ rng: () => 0.5 });
  state.scene = 'play';
  state.hook.swingAngle = -0.63;
  assert.equal(launchManual(state), true);
  const expected = angleToDirection(-0.63);
  close(state.hook.flightDir.x, expected.x);
  close(state.hook.flightDir.y, expected.y);
});

test('爪口局部向下轴经旋转后分别对准左右飞行方向', () => {
  for (const angle of [-0.9, 0, 0.9]) {
    const direction = angleToDirection(angle);
    const rotation = clawRotation(direction);
    const transformedDown = { x: -Math.sin(rotation), y: Math.cos(rotation) };
    close(transformedDown.x, direction.x);
    close(transformedDown.y, direction.y);
  }
});

test('碰撞使用 SWF box 对应的矩形边界而非通用圆半径', () => {
  const item = { x: 100, y: 200 };
  const box = { halfW: 20, halfH: 5 };
  assert.equal(pointInHitbox({ x: 119.9, y: 204.9 }, item, box), true);
  assert.equal(pointInHitbox({ x: 100, y: 205.1 }, item, box), false);
  assert.equal(pointInHitbox({ x: 120.1, y: 200 }, item, box), false);
});
