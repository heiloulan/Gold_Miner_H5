function frameKeys(prefix, count) {
  return Array.from({ length: count }, (_, index) => `${prefix}_${index}`);
}

export const ANIMATIONS = Object.freeze({
  // 原版爆炸特效 Sprite 263（TNT 木箱帧 2 / 飞行炸药命中），18 FPS 播一次。
  explosion: Object.freeze({ frames: frameKeys('explosion', 14), fps: 18, mode: 'once', anchor: 'center' }),
  idle: Object.freeze({ frames: frameKeys('miner_idle', 5), fps: 18, mode: 'once', anchor: 'idle' }),
  pull: Object.freeze({ frames: frameKeys('miner_pull', 20), fps: 18, mode: 'loop', anchor: 'pull' }),
  dynamite: Object.freeze({ frames: frameKeys('miner_dynamite', 5), fps: 18, mode: 'once', anchor: 'dynamite' }),
  yay: Object.freeze({ frames: frameKeys('miner_yay', 6), fps: 18, mode: 'once', anchor: 'yay' }),
  mole: Object.freeze({ frames: frameKeys('mole', 7), fps: 18, mode: 'loop', anchor: 'center' }),
  mole_d: Object.freeze({ frames: frameKeys('mole_d', 7), fps: 18, mode: 'loop', anchor: 'center' }),
});

// 原版屏幕/HUD/钩爪矢量导出（见 FLASH_PARITY.md §12）：
// screen_* 为全屏金块墙拼贴与面板，bg_* 为关卡内背景层，
// claw_* 为 Sprite 291/292 的爪帧（hold_N 的 N = 原版 object 编号），
// shop_yes_* / shop_no_* 为店主离店动画（Sprite 133 帧 19–25 / 26–38）。
function numberedImages(prefix, start, count) {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => [
    `${prefix}_${start + index}`,
    `${prefix}_${start + index}.png`,
  ]));
}

const screenImages = {
  screen_gold_bg: 'screen_gold_bg.png',
  screen_nugget: 'screen_nugget.png',
  screen_nugget_shine: 'screen_nugget_shine.png',
  screen_panel: 'screen_panel.png',
  logo: 'logo.png',
  bg_underground: 'bg_underground.png',
  bg_hud: 'bg_hud.png',
  bg_hud_glow: 'bg_hud_glow.png',
  hud_exit: 'hud_exit.png',
  claw_open: 'claw_open.png',
  claw_empty: 'claw_empty.png',
  ...numberedImages('claw_hold', 2, 13),
  ...numberedImages('shop_yes', 0, 7),
  ...numberedImages('shop_no', 0, 13),
};

const staticImages = {
  ...screenImages,
  gold_500: 'gold_big.png',
  gold_250: 'gold_mid.png',
  gold_100: 'gold_tiny.png',
  gold_50: 'gold_small.png',
  rock_big: 'rock_big.png',
  rock_small: 'rock_small.png',
  diamond: 'diamond.png',
  tnt: 'tnt.png',
  bag: 'bag.png',
  skull: 'skull.png',
  bone: 'bone.png',
  miner_platform: 'miner_platform.png',
  shop_background: 'shop_background.png',
  shop_dynamite: 'shop_dynamite.png',
  shop_strength: 'shop_strength.png',
  shop_clover: 'shop_clover.png',
  shop_rock: 'shop_rock.png',
  shop_diamond: 'shop_diamond.png',
};

const animationImages = Object.fromEntries(
  Object.values(ANIMATIONS).flatMap(animation =>
    animation.frames.map(key => [key, `${key}.png`]),
  ),
);

export const IMAGE_MANIFEST = Object.freeze({ ...staticImages, ...animationImages });

export const SOUND_MANIFEST = Object.freeze({
  bgm: 'snd_59.wav',
  win: 'snd_63.wav',
  click: 'snd_114.wav',
  purchaseSuccess: 'snd_88.wav',
  purchaseFailure: 'snd_132.wav',
  reel: 'snd_229.wav',
  coin: 'snd_246.wav',
  explosion: 'snd_264.wav',
  bagReward: 'snd_267.wav',
  power: 'snd_271.wav',
  coinHigh: 'snd_304.wav',
});
