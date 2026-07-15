export function createRng(seed = Date.now()) {
  let state = (Number(seed) || 0) >>> 0;
  return function rng() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
