import { HUD_LAYOUT, PAUSE_LAYOUT, SHOP_LAYOUT, STAGE } from './config.js';
import { projectAim } from './geometry.js';
import { purchaseOffer } from './shop.js';
import {
  beginShopLeave,
  enterPauseCheatKey,
  startNewRun,
  togglePause,
} from './state.js';
import { abortExtend, endLevelEarly, launchManual, useDynamite } from './update.js';

function canvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * STAGE.width / rect.width,
    y: (event.clientY - rect.top) * STAGE.height / rect.height,
  };
}

function contains(rect, point) {
  return point.x >= rect.x - rect.w / 2
    && point.x <= rect.x + rect.w / 2
    && point.y >= rect.y - rect.h / 2
    && point.y <= rect.y + rect.h / 2;
}

function shopSlotAt(point) {
  return SHOP_LAYOUT.slots.findIndex(slot => contains(slot, point));
}

export function bindInput(canvas, state, assets) {
  const sound = (key, volume) => assets.play(key, volume);
  const unlockAudio = () => assets.unlockAudio?.();
  const syncCursor = () => {
    canvas.style.cursor = state.scene === 'play' && state.secret.autoAimEnabled
      ? 'crosshair'
      : 'default';
  };
  const toggleMute = () => {
    if (assets.toggleMuted) assets.toggleMuted();
    else assets.muted = !assets.muted;
  };
  const toggleGamePause = () => {
    if (!togglePause(state)) return false;
    sound('click');
    syncCursor();
    return true;
  };

  canvas.addEventListener('pointermove', event => {
    if (state.scene !== 'shop' || !state.shop) return;
    const index = shopSlotAt(canvasPoint(canvas, event));
    state.shop.hovered = index >= 0 ? index : null;
  });

  canvas.addEventListener('pointerleave', () => {
    if (state.shop) state.shop.hovered = null;
  });

  // 原版店主离店：播放 yes/no 段（声音 88/132），动画期间商店不再响应。
  const leaveShop = () => {
    const kind = beginShopLeave(state);
    if (!kind) return false;
    sound(kind === 'yes' ? 'purchaseSuccess' : 'purchaseFailure');
    syncCursor();
    return true;
  };

  canvas.addEventListener('pointerdown', event => {
    const point = canvasPoint(canvas, event);
    // 原版 StartSound 59 覆盖标题/商店与紧随其后的 GOAL 横幅，横幅结束
    // 由 syncMusic 按场景停止，这里不需要提前掐断。
    unlockAudio();
    if (event.button === 2) return;
    if (event.button !== 0) return;

    if (state.scene === 'pause') {
      if (contains(PAUSE_LAYOUT.resumeButton, point)) toggleGamePause();
      return;
    }
    if (state.scene === 'play' && contains(PAUSE_LAYOUT.hudButton, point)) {
      toggleGamePause();
      return;
    }
    if (state.scene === 'play' && contains(HUD_LAYOUT.endButton, point)) {
      sound('click');
      endLevelEarly(state, sound);
      syncCursor();
      return;
    }
    if (state.scene === 'ready') {
      sound('click');
      startNewRun(state);
      syncCursor();
      return;
    }
    if (state.scene === 'over') {
      sound('click');
      startNewRun(state);
      syncCursor();
      return;
    }
    if (state.scene === 'shop') {
      if (state.shop?.leaving) return;
      if (contains(SHOP_LAYOUT.nextButton, point)) {
        sound('click');
        leaveShop();
        return;
      }
      const offerIndex = shopSlotAt(point);
      if (offerIndex >= 0) {
        sound('click');
        const result = purchaseOffer(state, offerIndex);
        if (result.ok) {
          sound('purchaseSuccess');
          if (result.offer.id === 'strength') sound('power');
        } else if (result.reason === 'insufficient' || result.reason === 'full') {
          sound('purchaseFailure');
        }
      }
      return;
    }
    if (state.scene !== 'play'
      || !state.secret.autoAimEnabled
      || state.hook.phase !== 'swing'
      || point.y <= STAGE.groundY + 10) return;
    state.aim = projectAim(point);
  });

  canvas.addEventListener('contextmenu', event => {
    event.preventDefault();
  });

  window.addEventListener('keydown', event => {
    unlockAudio();
    if (event.key === 'm' || event.key === 'M') {
      toggleMute();
      return;
    }
    if ((event.key === 'Escape' || event.key === 'p' || event.key === 'P') && toggleGamePause()) {
      event.preventDefault();
      return;
    }
    if (state.scene === 'pause') {
      const enabled = enterPauseCheatKey(state, event.key);
      if (/^[a-z]$/i.test(event.key)) {
        event.preventDefault();
      }
      if (enabled) syncCursor();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      useDynamite(state, sound);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (state.scene === 'play' && abortExtend(state, sound)) event.preventDefault();
      return;
    }

    if (state.scene === 'shop' && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      if (state.shop?.leaving) return;
      sound('click');
      leaveShop();
      return;
    }
    if ((state.scene === 'ready' || state.scene === 'over')
      && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      sound('click');
      startNewRun(state);
      syncCursor();
      return;
    }
    if (state.scene === 'play'
      && state.hook.phase === 'swing'
      && (event.key === 'ArrowDown' || event.key === ' ')) {
      event.preventDefault();
      launchManual(state, sound);
    }
  });

  syncCursor();
}
