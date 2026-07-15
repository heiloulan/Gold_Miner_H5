import {
  ART_REG,
  CLAW_ASSETS,
  CLAW_REG,
  EXPLOSION_REG,
  GOLD_SCREEN_BG,
  HUD_LAYOUT,
  MINER,
  PAUSE_LAYOUT,
  PIVOT,
  PLAY_BG,
  SCREEN_LOGO,
  SCREEN_PANEL,
  SHOP_LAYOUT,
  SHOP_LEAVE,
  STAGE,
  SWF_SCALE,
  TYPE_DEFS,
} from './config.js';
import {
  angleToDirection,
  clawRotation,
  distanceToStageEdge,
  hookTip,
} from './geometry.js';
import { ANIMATIONS } from './manifest.js';
import { animationFrameIndex } from './update.js';

const FONT = "'Trebuchet MS', 'Segoe UI', Verdana, sans-serif";

function imageReady(image) {
  return image?.complete && image.naturalWidth > 0;
}

function drawCentered(ctx, image, x, y, scale, flip = false) {
  if (!imageReady(image)) return;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

export function minerLayout() {
  const scale = MINER.scale;
  return {
    left: PIVOT.x - MINER.hookAnchor.x * scale,
    top: STAGE.groundY - MINER.composite.height * scale,
    scale,
  };
}

// 按原版 PlaceObject2 矩阵绘制一张矢量导出 PNG：
// placement 为 SWF 原始舞台坐标/矩阵，整体再乘 ×1.3 舞台换算；
// PNG 以字符局部 bounds 尺寸铺回，因此与原版矢量完全对位。
function drawPlaced(ctx, assets, placement, registration = ART_REG[placement.key]) {
  const image = assets.image(placement.key);
  if (!imageReady(image) || !registration) return;
  const [xMin, yMin, width, height] = registration;
  ctx.save();
  ctx.transform(
    placement.a * SWF_SCALE,
    placement.b * SWF_SCALE,
    placement.c * SWF_SCALE,
    placement.d * SWF_SCALE,
    placement.tx * SWF_SCALE,
    placement.ty * SWF_SCALE,
  );
  ctx.drawImage(image, xMin, yMin, width, height);
  ctx.restore();
}

// 全屏金块墙（主时间轴 GOAL/过关/失败屏的公共背景拼贴）。
function drawGoldScreenBase(ctx, assets) {
  ctx.fillStyle = '#3f66b0';
  ctx.fillRect(0, 0, STAGE.width, STAGE.height);
  for (const placement of GOLD_SCREEN_BG) drawPlaced(ctx, assets, placement);
}

function drawLogo(ctx, assets) {
  drawPlaced(ctx, assets, SCREEN_LOGO);
}

function screenText(ctx, text, x, baseline, size, fill, { stroke = null, align = 'center' } = {}) {
  ctx.textAlign = align;
  ctx.font = `bold ${size}px ${FONT}`;
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(2, size / 9);
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, baseline);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, baseline);
}

const PANEL_CENTER_X = SCREEN_PANEL.tx * SWF_SCALE;

// 原版 f15–48 / f52–86：金块墙 + 面板 + “Your First/Next Goal is” + 绿色目标额。
function drawGoalSplash(ctx, state, assets) {
  drawGoldScreenBase(ctx, assets);
  drawPlaced(ctx, assets, SCREEN_PANEL);
  drawLogo(ctx, assets);
  const title = state.run.level === 1 ? 'Your First Goal is' : 'Your Next Goal is';
  screenText(ctx, title, PANEL_CENTER_X, 194, 38, '#ffe95c');
  screenText(ctx, `$${state.run.goal}`, PANEL_CENTER_X, 262, 60, '#00cc00');
}

// 原版 f94–130 'yes'：面板与文字自 0.28 缩放到 1（锚点约 y=129），停留展示。
function drawWinScreen(ctx, state, assets) {
  drawGoldScreenBase(ctx, assets);
  const elapsed = Math.max(0, 2 - state.run.winTime);
  const scale = Math.min(1, 0.28 + 0.72 * (elapsed / 0.55));
  const panelTy = 165.7 - (1 - scale) * 36.7;
  drawPlaced(ctx, assets, {
    ...SCREEN_PANEL, a: scale, b: 0, c: 0, d: scale, ty: panelTy,
  });
  drawLogo(ctx, assets);
  const anchorY = 129 * SWF_SCALE;
  const line = (text, restBaseline) => {
    const y = anchorY + (restBaseline - anchorY) * scale;
    screenText(ctx, text, PANEL_CENTER_X, y, 38 * scale, '#ffe95c');
  };
  line('You made it to', 200);
  line('the next Level!', 248);
}

// 原版 f140–169 'no'：面板从画面上方滑落，随后显示 endText 与重玩提示。
function drawGameOverScreen(ctx, state, assets) {
  drawGoldScreenBase(ctx, assets);
  // 原版失败屏（f140–169）没有 Gold Miner 标志：面板滑落到其位置。
  const progress = Math.min(1, state.run.overElapsed / 1.1);
  const panelTy = 36.9 + (148.9 - 36.9) * progress;
  drawPlaced(ctx, assets, { ...SCREEN_PANEL, ty: panelTy });
  const panelCenterY = panelTy * SWF_SCALE;
  screenText(ctx, 'You Did Not', PANEL_CENTER_X, panelCenterY - 22, 38, '#ffe95c');
  screenText(ctx, 'Reach Your Goal', PANEL_CENTER_X, panelCenterY + 26, 38, '#ffe95c');
  if (state.run.overElapsed >= 1.4) {
    // 原版 endText 逐字：You scored N Points at Gold Miner!
    screenText(ctx, `You scored ${state.run.score} Points at Gold Miner!`, PANEL_CENTER_X, panelCenterY + 128, 22, '#fff');
    screenText(ctx, `到达第 ${state.run.level} 关 · 点击或按 Enter 重新开始`, PANEL_CENTER_X, panelCenterY + 162, 16, '#fdeeb2');
  }
}

function drawReadyScreen(ctx, state, assets) {
  drawGoldScreenBase(ctx, assets);
  drawPlaced(ctx, assets, SCREEN_PANEL);
  drawLogo(ctx, assets);
  screenText(ctx, '黄金矿工', PANEL_CENTER_X, 190, 42, '#ffe95c');
  screenText(ctx, '摆钩对准目标后按 ↓ 或空格发射', PANEL_CENTER_X, 236, 18, '#fff');
  screenText(ctx, '点击任意处开始', PANEL_CENTER_X, 268, 18, '#fff');
  if (state.loadErrors.length) {
    screenText(ctx, `有 ${state.loadErrors.length} 个资源加载失败，请检查静态服务器。`, PANEL_CENTER_X, 310, 14, '#ff9980');
  }
}

function drawLoadingScreen(ctx, state, assets) {
  ctx.fillStyle = '#20180f';
  ctx.fillRect(0, 0, STAGE.width, STAGE.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd75e';
  ctx.font = `bold 40px ${FONT}`;
  ctx.fillText(`加载中 ${assets.loaded}/${assets.total}`, STAGE.width / 2, STAGE.height / 2);
}

function drawPlayBackground(ctx, assets) {
  ctx.fillStyle = '#e0a865';
  ctx.fillRect(0, 0, STAGE.width, STAGE.height);
  for (const placement of PLAY_BG) drawPlaced(ctx, assets, placement);
}

function drawItems(ctx, state, assets) {
  for (const item of state.world.items) {
    if (!item.alive) continue;
    // 原版抓取即 T{x}.gotoAndStop(2) 移除场上美术，改由钩爪帧显示成品。
    if (item.hooked) continue;
    const def = TYPE_DEFS[item.type];
    if (def.animation) {
      const animation = ANIMATIONS[def.animation];
      const index = animationFrameIndex(animation, item.animationTime);
      drawCentered(
        ctx,
        assets.image(animation.frames[index]),
        item.x,
        item.y,
        def.drawScale,
        item.vx > 0,
      );
    } else {
      drawCentered(ctx, assets.image(def.asset), item.x, item.y, def.drawScale);
    }
    if (state.debug) {
      ctx.strokeStyle = 'rgb(0 255 255 / 65%)';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        item.x - def.hitbox.halfW,
        item.y - def.hitbox.halfH,
        def.hitbox.halfW * 2,
        def.hitbox.halfH * 2,
      );
    }
  }
}

// 原版爆炸特效 Sprite 263：14 帧星芒动画，TNT 与炸药命中各按原版缩放播放。
function drawBooms(ctx, state, assets) {
  const animation = ANIMATIONS.explosion;
  const [xMin, yMin, width, height] = EXPLOSION_REG;
  for (const boom of state.effects.booms) {
    const image = assets.image(animation.frames[animationFrameIndex(animation, boom.elapsed)]);
    if (!imageReady(image)) continue;
    const scale = (boom.scale ?? 1) * SWF_SCALE;
    ctx.drawImage(image, boom.x + xMin * scale, boom.y + yMin * scale, width * scale, height * scale);
  }
}

function drawPopups(ctx, state) {
  ctx.textAlign = 'center';
  ctx.font = `bold 20px ${FONT}`;
  for (const popup of state.effects.popups) {
    const alpha = Math.max(0, 1 - popup.elapsed / 1.2);
    ctx.fillStyle = popup.good
      ? `rgba(255, 220, 60, ${alpha})`
      : `rgba(230, 230, 230, ${alpha})`;
    ctx.fillText(popup.label, popup.x, popup.y - popup.elapsed * 40);
  }
}

// 原版钩爪帧选择：摆动/下放/空钩 = Sprite 291 帧 1（张开空爪）；
// 抓住物件 = 帧 TYPE_DEFS[type].claw（爪 + 物件成品美术）；
// 炸药销毁后 = 帧 20（空爪），与 claw.gotoAndStop(...) 语义一致。
function clawAssetKey(hook) {
  if (hook.caught) return `claw_hold_${TYPE_DEFS[hook.caught.type].claw}`;
  if (hook.dynamiteDestroyed) return CLAW_ASSETS.empty;
  return CLAW_ASSETS.open;
}

function drawHook(ctx, state, assets) {
  const tip = hookTip(state.hook);
  const direction = state.hook.phase === 'swing'
    ? angleToDirection(state.hook.swingAngle)
    : state.hook.flightDir;
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(PIVOT.x, PIVOT.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();

  const image = assets.image(clawAssetKey(state.hook));
  if (!imageReady(image)) return;
  const [xMin, yMin, width, height] = CLAW_REG;
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(clawRotation(direction));
  ctx.drawImage(
    image,
    xMin * SWF_SCALE,
    yMin * SWF_SCALE,
    width * SWF_SCALE,
    height * SWF_SCALE,
  );
  ctx.restore();
}

function drawMiner(ctx, state, assets) {
  const layout = minerLayout();
  const platform = assets.image('miner_platform');
  if (imageReady(platform)) {
    ctx.drawImage(
      platform,
      layout.left + MINER.platformOffset.x * layout.scale,
      layout.top + MINER.platformOffset.y * layout.scale,
      platform.naturalWidth * layout.scale,
      platform.naturalHeight * layout.scale,
    );
  }

  const animation = ANIMATIONS[state.miner.clip];
  const frameIndex = animationFrameIndex(animation, state.miner.elapsed);
  const frame = assets.image(animation.frames[frameIndex]);
  if (!imageReady(frame)) return;
  const offset = MINER.sourceOffsets[animation.anchor];
  ctx.drawImage(
    frame,
    layout.left + offset.x * layout.scale,
    layout.top + offset.y * layout.scale,
    frame.naturalWidth * layout.scale,
    frame.naturalHeight * layout.scale,
  );
}

function drawAim(ctx, state) {
  if (!state.aim || state.scene !== 'play') return;
  const aim = state.aim;
  const visible = Math.floor(aim.blink * 4) % 2 === 0;
  ctx.strokeStyle = visible ? '#ff4040' : '#ffd040';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(aim.x, aim.y, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(aim.x - 20, aim.y);
  ctx.lineTo(aim.x + 20, aim.y);
  ctx.moveTo(aim.x, aim.y - 20);
  ctx.lineTo(aim.x, aim.y + 20);
  ctx.stroke();

  const distance = distanceToStageEdge(aim.direction);
  ctx.setLineDash([4, 8]);
  ctx.strokeStyle = 'rgb(255 255 255 / 35%)';
  ctx.beginPath();
  ctx.moveTo(PIVOT.x, PIVOT.y);
  ctx.lineTo(PIVOT.x + aim.direction.x * distance, PIVOT.y + aim.direction.y * distance);
  ctx.stroke();
  ctx.setLineDash([]);
}

function hudText(ctx, text, x, baseline, size, fill, { stroke = false, align = 'left' } = {}) {
  ctx.textAlign = align;
  ctx.font = `bold ${size}px ${FONT}`;
  if (stroke) {
    ctx.strokeStyle = '#1c1305';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, baseline);
  }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, baseline);
}

// 原版 L 帧 HUD：Money/$score、Goal/$goal 在左，Exit Level 按钮 202 与
// Time:/Level: 在右，炸药库存显示（dynMov, 351.3,46）在蓝拱右侧。
function drawHud(ctx, state, assets) {
  hudText(ctx, 'Money', 12, 32, 21, '#181818');
  hudText(ctx, `$${state.run.score}`, 77, 33, 26, '#00b400', { stroke: true });
  hudText(ctx, 'Goal', 28, 62, 17, '#6b5300');
  hudText(ctx, `$${state.run.goal}`, 76, 64, 22, '#ff9000', { stroke: true });
  hudText(ctx, 'Time:', 617, 38, 20, '#161616');
  hudText(ctx, `${Math.ceil(state.run.time)}`, 672, 38, 24, state.run.time < 10 ? '#ff2a00' : '#e04800');
  hudText(ctx, 'Level:', 617, 63, 20, '#161616');
  hudText(ctx, `${state.run.level}`, 674, 63, 24, '#e04800');

  if (state.inventory.dynamite > 0) {
    const icon = assets.image('shop_dynamite');
    if (imageReady(icon)) {
      const height = 30;
      const width = icon.naturalWidth * (height / icon.naturalHeight);
      ctx.drawImage(icon, 448, 44, width, height);
      hudText(ctx, `×${state.inventory.dynamite}`, 452 + width, 68, 16, '#3d2c12');
    }
  }

  // 原版 Exit Level 按钮（202）＝随时提前结算。
  drawPlaced(ctx, assets, { tx: 429.2, ty: 27, a: 1, b: 0, c: 0, d: 1, key: 'hud_exit' });
  hudText(ctx, 'Exit', HUD_LAYOUT.endButton.x + 2, 28, 17, '#8a6414', { align: 'center' });
  hudText(ctx, 'Level', HUD_LAYOUT.endButton.x + 2, 48, 17, '#8a6414', { align: 'center' });

  if (state.scene === 'play') {
    const button = PAUSE_LAYOUT.hudButton;
    roundedRect(ctx, button.x - button.w / 2, button.y - button.h / 2, button.w, button.h, 7);
    ctx.fillStyle = 'rgb(56 34 12 / 72%)';
    ctx.fill();
    ctx.strokeStyle = 'rgb(213 161 74 / 80%)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    hudText(ctx, '⏸ 暂停', button.x, button.y + 4, 12, '#fff0b6', { align: 'center' });
  }
  hudText(ctx, assets.muted ? '🔇' : '🔊', STAGE.width - 12, STAGE.height - 10, 13, '#f7dfa6', { align: 'right' });

  if (state.debug) {
    const hook = state.hook;
    ctx.textAlign = 'left';
    ctx.font = '12px monospace';
    ctx.fillStyle = '#fff';
    const direction = hook.flightDir;
    ctx.fillText(
      `phase=${hook.phase} swing=${hook.swingAngle.toFixed(3)} dir=(${direction.x.toFixed(3)},${direction.y.toFixed(3)}) ext=${hook.extension.toFixed(1)}`,
      14,
      STAGE.height - 8,
    );
  }
}

function roundedRect(ctx, x, y, width, height, radius = 10) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function drawShopCard(ctx, state, assets, offer, slot, index) {
  const left = slot.x - slot.w / 2;
  const top = slot.y - slot.h / 2;
  const hovered = state.shop.hovered === index;
  roundedRect(ctx, left, top, slot.w, slot.h, 10);
  ctx.fillStyle = hovered ? 'rgb(255 242 185 / 94%)' : 'rgb(255 246 210 / 88%)';
  ctx.fill();
  ctx.strokeStyle = hovered ? '#f39b21' : '#86511d';
  ctx.lineWidth = hovered ? 3 : 2;
  ctx.stroke();

  const image = assets.image(offer.icon);
  if (imageReady(image)) {
    const iconScale = Math.min(66 / image.naturalWidth, 58 / image.naturalHeight);
    drawCentered(ctx, image, slot.x, top + 39, iconScale);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4a2a0b';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(offer.name, slot.x, top + 82);
  ctx.font = 'bold 17px Arial';
  ctx.fillStyle = offer.available ? '#a31c12' : '#777';
  ctx.fillText(offer.purchased ? '已购买' : offer.available ? `$${offer.price}` : '未上架', slot.x, top + 108);
  ctx.font = '12px sans-serif';
  ctx.fillText(offer.available ? '点击购买' : '本轮不可购买', slot.x, top + 133);

  if (!offer.available) {
    roundedRect(ctx, left, top, slot.w, slot.h, 10);
    ctx.fillStyle = 'rgb(70 50 35 / 25%)';
    ctx.fill();
  }
}

function drawShopBackdrop(ctx, assets, key) {
  ctx.fillStyle = '#a96525';
  ctx.fillRect(0, 0, STAGE.width, STAGE.height);
  const background = assets.image(key);
  if (imageReady(background)) {
    const width = background.naturalWidth * SHOP_LAYOUT.backgroundScale;
    const height = background.naturalHeight * SHOP_LAYOUT.backgroundScale;
    ctx.drawImage(background, (STAGE.width - width) / 2, 8, width, height);
  }
}

function drawShop(ctx, state, assets) {
  // 原版店主离店动画（Sprite 133 帧 19–25 / 26–38）：整幅帧画面直接替换商店。
  const leaving = state.shop.leaving;
  if (leaving) {
    const clip = SHOP_LEAVE[leaving.kind];
    const frame = Math.min(clip.frames - 1, Math.floor(leaving.elapsed * SHOP_LEAVE.fps));
    drawShopBackdrop(ctx, assets, `${clip.prefix}_${frame}`);
    return;
  }

  drawShopBackdrop(ctx, assets, 'shop_background');
  ctx.fillStyle = '#5b3214';
  ctx.fillRect(0, 0, STAGE.width, 56);
  ctx.fillStyle = '#ffe28a';
  ctx.font = 'bold 25px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`第 ${state.shop.nextLevel} 关商店`, 18, 31);
  ctx.textAlign = 'right';
  ctx.fillText(`余额 $${state.run.score}　🧨 ${state.inventory.dynamite}/5`, STAGE.width - 18, 31);

  const hovered = state.shop.hovered == null ? null : state.shop.offers[state.shop.hovered];
  roundedRect(ctx, 24, 56, 500, 76, 13);
  ctx.fillStyle = 'rgb(255 250 225 / 91%)';
  ctx.fill();
  ctx.strokeStyle = '#754313';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#4a2a0b';
  ctx.textAlign = 'left';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(hovered ? hovered.name : '老板提示', 42, 82);
  ctx.font = '14px sans-serif';
  ctx.fillText(hovered ? hovered.description : '商品只对下一关生效；炸药会永久保留。点击商品不会开始下一关。', 42, 109);

  state.shop.offers.forEach((offer, index) => {
    drawShopCard(ctx, state, assets, offer, SHOP_LAYOUT.slots[index], index);
  });

  const button = SHOP_LAYOUT.nextButton;
  roundedRect(ctx, button.x - button.w / 2, button.y - button.h / 2, button.w, button.h, 9);
  ctx.fillStyle = '#d88919';
  ctx.fill();
  ctx.strokeStyle = '#653708';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff5c5';
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('下一关 ▶', button.x, button.y + 6);
  ctx.textAlign = 'left';
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#ffefbf';
  ctx.fillText('Enter / Space 也可继续', 18, 508);

  if (state.shop.messageTime > 0) {
    roundedRect(ctx, STAGE.width / 2 - 100, 432, 200, 36, 9);
    ctx.fillStyle = 'rgb(45 24 8 / 86%)';
    ctx.fill();
    ctx.fillStyle = '#ffe37a';
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(state.shop.message, STAGE.width / 2, 456);
  }
}

function drawPauseOverlay(ctx, state) {
  if (state.scene !== 'pause') return;
  ctx.fillStyle = 'rgb(0 0 0 / 55%)';
  ctx.fillRect(0, 0, STAGE.width, STAGE.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd75e';
  ctx.font = `bold 42px ${FONT}`;
  ctx.fillText('游戏暂停', STAGE.width / 2, STAGE.height / 2 - 58);
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(
    state.secret.noticeTime > 0 ? '秘籍已开启' : '按 Esc、P 或点击按钮继续',
    STAGE.width / 2,
    STAGE.height / 2 - 16,
  );
  const button = PAUSE_LAYOUT.resumeButton;
  roundedRect(ctx, button.x - button.w / 2, button.y - button.h / 2, button.w, button.h, 10);
  ctx.fillStyle = '#d88919';
  ctx.fill();
  ctx.strokeStyle = '#653708';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff5c5';
  ctx.textAlign = 'center';
  ctx.font = 'bold 19px sans-serif';
  ctx.fillText('继续游戏', button.x, button.y + 7);
}

export function renderGame(ctx, state, assets) {
  ctx.clearRect(0, 0, STAGE.width, STAGE.height);
  switch (state.scene) {
    case 'loading':
      drawLoadingScreen(ctx, state, assets);
      return;
    case 'ready':
      drawReadyScreen(ctx, state, assets);
      return;
    case 'win':
      drawWinScreen(ctx, state, assets);
      return;
    case 'over':
      drawGameOverScreen(ctx, state, assets);
      return;
    case 'shop':
      drawShop(ctx, state, assets);
      return;
    default:
  }
  // 开场全屏 GOAL 横幅：关卡尚未出场（原版 f15–48 / f52–86）。
  if (state.run.introTime > 0) {
    drawGoalSplash(ctx, state, assets);
    drawPauseOverlay(ctx, state);
    return;
  }
  drawPlayBackground(ctx, assets);
  drawHud(ctx, state, assets);
  drawItems(ctx, state, assets);
  drawBooms(ctx, state, assets);
  // 原版深度顺序：miner(159) 在下、摆钩组 C(174) 在上。
  drawMiner(ctx, state, assets);
  drawHook(ctx, state, assets);
  drawAim(ctx, state);
  drawPopups(ctx, state);
  drawPauseOverlay(ctx, state);
}
