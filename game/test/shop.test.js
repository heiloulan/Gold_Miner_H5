import test from 'node:test';
import assert from 'node:assert/strict';

import { createRng } from '../src/random.js';
import { createShop, purchaseOffer } from '../src/shop.js';
import {
  createGameState,
  enterShop,
  startNextLevel,
} from '../src/state.js';

test('五种商品价格始终落在原版边界内', () => {
  for (let seed = 0; seed < 1000; seed += 1) {
    const level = seed % 25 + 1;
    const shop = createShop(level, createRng(seed), 0);
    const byId = Object.fromEntries(shop.offers.map(offer => [offer.id, offer]));
    assert.ok(byId.dynamite.price >= 2 * level + 1 && byId.dynamite.price <= 2 * level + 300);
    assert.ok(byId.strength.price >= 100 && byId.strength.price <= 399);
    assert.ok(byId.clover.price >= 2 * level + 1 && byId.clover.price <= 52 * level);
    assert.ok(byId.rock.price >= 1 && byId.rock.price <= 150);
    assert.ok(byId.diamond.price >= 201 && byId.diamond.price <= 200 + 100 * level);
  }
});

test('固定 seed 大样本上架率接近 40/40/60/50%，炸药按库存上架', () => {
  const counts = { strength: 0, clover: 0, rock: 0, diamond: 0 };
  const sampleSize = 8000;
  for (let seed = 0; seed < sampleSize; seed += 1) {
    const shop = createShop(5, createRng(seed), 0);
    for (const id of Object.keys(counts)) {
      if (shop.offers.find(offer => offer.id === id).available) counts[id] += 1;
    }
    assert.equal(shop.offers[0].available, true);
  }
  const targets = { strength: 0.4, clover: 0.4, rock: 0.6, diamond: 0.5 };
  for (const [id, target] of Object.entries(targets)) {
    assert.ok(Math.abs(counts[id] / sampleSize - target) < 0.02, `${id}: ${counts[id] / sampleSize}`);
  }
  assert.equal(createShop(5, createRng(1), 5).offers[0].available, false);
});

function shopState(score = 1000) {
  const state = createGameState({ rng: createRng(9) });
  state.scene = 'shop';
  state.run.score = score;
  state.shop = createShop(2, createRng(12), 0);
  return state;
}

test('余额不足不会购买或出现负分', () => {
  const state = shopState(0);
  const offer = state.shop.offers[1];
  offer.available = true;
  offer.price = 100;
  assert.deepEqual(purchaseOffer(state, 1), { ok: false, reason: 'insufficient' });
  assert.equal(state.run.score, 0);
  assert.equal(offer.purchased, false);
});

test('每项每店只买一次，炸药立即入库且最多五个', () => {
  const state = shopState(1000);
  const offer = state.shop.offers[0];
  offer.available = true;
  offer.price = 50;
  state.inventory.dynamite = 4;
  assert.equal(purchaseOffer(state, 0).ok, true);
  assert.equal(state.inventory.dynamite, 5);
  assert.equal(state.run.score, 950);
  assert.equal(purchaseOffer(state, 0).reason, 'unavailable');
  assert.equal(state.inventory.dynamite, 5);
  assert.equal(state.run.score, 950);
});

test('商店增益只进入下一关并在该关结束时失效', () => {
  const state = createGameState({ rng: createRng(4) });
  state.run.level = 1;
  state.run.score = 1000;
  state.activeBuffs.rock = true;
  enterShop(state);
  assert.equal(state.activeBuffs.rock, false, '上一关增益在进商店时失效');

  const strength = state.shop.offers[1];
  strength.available = true;
  strength.price = 100;
  assert.equal(purchaseOffer(state, 1).ok, true);
  assert.equal(state.pendingBuffs.strength, true);
  assert.equal(state.activeBuffs.strength, false);
  const scoreAfterPurchase = state.run.score;

  assert.equal(startNextLevel(state), true);
  assert.equal(state.scene, 'play');
  assert.equal(state.run.level, 2);
  assert.equal(state.activeBuffs.strength, true);
  assert.equal(state.pendingBuffs.strength, false);
  assert.equal(state.run.score, scoreAfterPurchase);

  enterShop(state);
  assert.equal(state.activeBuffs.strength, false);
});

test('四种增益商品分别写入对应 pendingBuffs 字段', () => {
  const ids = ['strength', 'clover', 'rock', 'diamond'];
  ids.forEach((id, offset) => {
    const state = shopState(5000);
    const index = offset + 1;
    state.shop.offers[index].available = true;
    state.shop.offers[index].price = 1;
    assert.equal(state.shop.offers[index].id, id);
    assert.equal(purchaseOffer(state, index).ok, true);
    assert.equal(state.pendingBuffs[id], true);
  });
});
