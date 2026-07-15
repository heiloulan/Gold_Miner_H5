import { newBuffs } from './config.js';
import { randomInt } from './random.js';

export const SHOP_PRODUCTS = Object.freeze([
  Object.freeze({ id: 'dynamite', name: '炸药', icon: 'shop_dynamite', description: '抓住物件后按 ↑ 炸掉，不计分。库存最多 5 个。' }),
  Object.freeze({ id: 'strength', name: '力量药水', icon: 'shop_strength', description: '下一关力量由 10 提升到 12，拉重物更快。' }),
  Object.freeze({ id: 'clover', name: '幸运草', icon: 'shop_clover', description: '下一关改善神秘袋的奖励概率。' }),
  Object.freeze({ id: 'rock', name: '石头收藏书', icon: 'shop_rock', description: '下一关所有石头价值变为三倍。' }),
  Object.freeze({ id: 'diamond', name: '钻石抛光剂', icon: 'shop_diamond', description: '下一关钻石类物件额外增加 $300。' }),
]);

export function createShop(nextLevel, rng, dynamiteCount = 0) {
  const level = Math.max(1, nextLevel);
  const offers = SHOP_PRODUCTS.map(product => {
    let available = false;
    let price = 0;
    switch (product.id) {
      case 'dynamite':
        available = dynamiteCount < 5;
        price = randomInt(rng, 1, 300) + 2 * level;
        break;
      case 'strength':
        available = rng() < 0.4;
        price = randomInt(rng, 100, 399);
        break;
      case 'clover':
        available = rng() < 0.4;
        price = randomInt(rng, 1, 50 * level) + 2 * level;
        break;
      case 'rock':
        available = rng() < 0.6;
        price = randomInt(rng, 1, 150);
        break;
      case 'diamond':
        available = rng() < 0.5;
        price = randomInt(rng, 1, 100 * level) + 200;
        break;
      default:
    }
    return { ...product, available, price, purchased: false };
  });
  return { nextLevel: level, offers, hovered: null, message: '', messageTime: 0 };
}

export function purchaseOffer(state, offerIndex) {
  const offer = state.shop?.offers[offerIndex];
  if (!offer || !offer.available || offer.purchased) return { ok: false, reason: 'unavailable' };
  if (state.run.score < offer.price) {
    state.shop.message = '余额不足';
    state.shop.messageTime = 1.4;
    return { ok: false, reason: 'insufficient' };
  }
  if (offer.id === 'dynamite' && state.inventory.dynamite >= 5) {
    state.shop.message = '炸药库存已满';
    state.shop.messageTime = 1.4;
    return { ok: false, reason: 'full' };
  }

  state.run.score -= offer.price;
  offer.purchased = true;
  offer.available = false;
  if (offer.id === 'dynamite') {
    state.inventory.dynamite = Math.min(5, state.inventory.dynamite + 1);
  } else {
    state.pendingBuffs = newBuffs(state.pendingBuffs);
    state.pendingBuffs[offer.id] = true;
  }
  state.shop.message = `已购买：${offer.name}`;
  state.shop.messageTime = 1.4;
  return { ok: true, offer };
}
