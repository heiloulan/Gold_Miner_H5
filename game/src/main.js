import { AssetStore } from './assets.js';
import { PIVOT } from './config.js';
import { projectAim } from './geometry.js';
import { bindInput } from './input.js';
import { createRng } from './random.js';
import { renderGame } from './render.js';
import {
  createGameState,
  enterGameOver,
  enterWin,
  openDebugShop,
  sceneUsesBgm,
  startNewRun,
} from './state.js';
import { updateGame } from './update.js';

const canvas = document.querySelector('#cv');
const context = canvas.getContext('2d');
const hash = new URLSearchParams(location.hash.slice(1));
const seed = hash.has('seed') ? Number(hash.get('seed')) : Date.now();
const rng = createRng(seed);
const state = createGameState({ rng, debug: hash.has('dbg') });
const assets = new AssetStore('assets/');
const sound = (key, volume) => assets.play(key, volume);

bindInput(canvas, state, assets);
window.__goldMiner = { state, assets, seed };

function configureDebugScene() {
  if (hash.get('scene') === 'shop') {
    openDebugShop(state);
    return;
  }
  // 调试直达原版过关展示 / 失败页（见 AGENTS.md §9）。
  if (hash.get('scene') === 'win') {
    startNewRun(state);
    state.run.score = 650;
    enterWin(state);
    return;
  }
  if (hash.get('scene') === 'over') {
    startNewRun(state);
    state.run.score = 385;
    enterGameOver(state);
    return;
  }
  state.scene = 'ready';
  if (!hash.has('auto')) return;
  startNewRun(state);
  if (hash.has('aimgold') && hash.has('dbg')) {
    state.secret.autoAimEnabled = true;
    const gold = state.world.items.find(item => item.type.startsWith('gold'));
    if (gold) state.aim = projectAim(gold, PIVOT);
  }
  const simulations = Number(hash.get('sim'));
  if (Number.isFinite(simulations) && simulations > 0) {
    for (let index = 0; index < simulations; index += 1) updateGame(state, 1 / 60, sound);
  }
}

assets.load().then(errors => {
  state.loadErrors = errors;
  configureDebugScene();
  syncMusic();
});

function syncMusic() {
  if (!sceneUsesBgm(state.scene, state.run.introTime)) {
    assets.stopMusic();
    return;
  }
  assets.setMusic('bgm');
  assets.resumeMusic();
}

let previous = performance.now();
function frame(now) {
  const delta = Math.min(0.05, (now - previous) / 1000);
  previous = now;
  updateGame(state, delta, sound);
  syncMusic();
  canvas.style.cursor = state.scene === 'play' && state.secret.autoAimEnabled
    ? 'crosshair'
    : 'default';
  renderGame(context, state, assets);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
