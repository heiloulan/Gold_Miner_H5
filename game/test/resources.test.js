import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { IMAGE_MANIFEST, SOUND_MANIFEST } from '../src/manifest.js';

const assetsDirectory = fileURLToPath(new URL('../assets/', import.meta.url));

test('运行时清单恰好声明 126 张 PNG 与 11 个 WAV，且文件全部存在', async () => {
  assert.equal(Object.keys(IMAGE_MANIFEST).length, 126);
  assert.equal(Object.keys(SOUND_MANIFEST).length, 11);
  const declared = new Set([...Object.values(IMAGE_MANIFEST), ...Object.values(SOUND_MANIFEST)]);
  for (const file of declared) {
    const info = await stat(path.join(assetsDirectory, file));
    assert.ok(info.size > 0, file);
  }
});

test('运行时资源目录没有遗漏声明的 PNG/WAV', async () => {
  const files = (await readdir(assetsDirectory))
    .filter(file => /\.(png|wav)$/i.test(file))
    .sort();
  const declared = [...Object.values(IMAGE_MANIFEST), ...Object.values(SOUND_MANIFEST)].sort();
  assert.deepEqual(files, declared);
});
