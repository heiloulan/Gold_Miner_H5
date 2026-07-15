import test from 'node:test';
import assert from 'node:assert/strict';

import { AssetStore } from '../src/assets.js';
import { SOUND_MANIFEST } from '../src/manifest.js';

function fakeAudio(clones = []) {
  return {
    clones,
    loop: false,
    volume: 1,
    currentTime: 0,
    playCount: 0,
    pauseCount: 0,
    play() {
      this.playCount += 1;
      return Promise.resolve();
    },
    pause() { this.pauseCount += 1; },
    cloneNode() {
      const clone = fakeAudio(clones);
      clones.push(clone);
      return clone;
    },
  };
}

test('音频清单使用经 SWF 与人工试听校准的语义映射', () => {
  assert.deepEqual(SOUND_MANIFEST, {
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
});

test('BGM 只创建一个循环实例，并正确响应标题页尝试、解锁、暂停、静音和停止', () => {
  const store = new AssetStore();
  const source = fakeAudio();
  store.sounds.set('bgm', source);

  store.setMusic('bgm', 0.24);
  assert.equal(source.clones.length, 1, '标题页会尝试自动播放；浏览器可自行拒绝该请求');
  const music = source.clones[0];
  assert.equal(music.loop, true);
  assert.equal(music.volume, 0.24);
  assert.equal(music.playCount, 1);

  store.setMusic('bgm', 0.24);
  assert.equal(source.clones.length, 1, '同一音乐不会叠加实例');
  store.unlockAudio();
  assert.equal(source.clones.length, 1);
  store.pauseMusic();
  assert.equal(music.pauseCount, 1);
  store.resumeMusic();
  assert.equal(music.playCount, 2);
  store.resumeMusic();
  assert.equal(music.playCount, 2, '逐帧同步不应反复调用已在播放的 BGM');
  store.toggleMuted();
  assert.equal(store.muted, true);
  assert.equal(music.pauseCount, 2);
  store.toggleMuted();
  assert.equal(store.muted, false);
  assert.equal(music.playCount, 3);
  store.stopMusic();
  assert.equal(music.pauseCount, 3);
  assert.equal(store.music, null);
});
