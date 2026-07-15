import { IMAGE_MANIFEST, SOUND_MANIFEST } from './manifest.js';

export class AssetStore {
  constructor(baseUrl = 'assets/') {
    this.baseUrl = baseUrl;
    this.images = new Map();
    this.sounds = new Map();
    this.loaded = 0;
    this.total = Object.keys(IMAGE_MANIFEST).length + Object.keys(SOUND_MANIFEST).length;
    this.errors = [];
    this.muted = false;
    this.audioUnlocked = false;
    this.musicKey = null;
    this.musicVolume = 0.24;
    this.music = null;
    this.musicSuspended = false;
    this.musicAutoplayAttempted = false;
  }

  async load() {
    const images = Object.entries(IMAGE_MANIFEST).map(([key, file]) => this.#loadImage(key, file));
    const sounds = Object.entries(SOUND_MANIFEST).map(([key, file]) => this.#loadSound(key, file));
    await Promise.all([...images, ...sounds]);
    return this.errors;
  }

  image(key) {
    return this.images.get(key);
  }

  play(key, volume = 0.5) {
    if (this.muted) return;
    const source = this.sounds.get(key);
    if (!source) return;
    const audio = source.cloneNode();
    audio.volume = volume;
    audio.play().catch(() => {});
  }

  unlockAudio() {
    this.audioUnlocked = true;
    this.#startMusicIfAllowed();
  }

  setMusic(key, volume = 0.24) {
    if (this.musicKey === key && this.musicVolume === volume) {
      this.#startMusicIfAllowed({ allowAutoplay: true });
      return;
    }
    this.stopMusic();
    this.musicKey = key;
    this.musicVolume = volume;
    this.#startMusicIfAllowed({ allowAutoplay: true });
  }

  stopMusic() {
    if (this.music) {
      this.music.pause();
      this.music.currentTime = 0;
    }
    this.music = null;
    this.musicKey = null;
    this.musicSuspended = false;
    this.musicAutoplayAttempted = false;
  }

  pauseMusic() {
    this.musicSuspended = true;
    this.music?.pause();
  }

  resumeMusic() {
    const wasSuspended = this.musicSuspended;
    this.musicSuspended = false;
    this.#startMusicIfAllowed({ resumeExisting: wasSuspended, allowAutoplay: true });
  }

  toggleMuted() {
    this.muted = !this.muted;
    if (this.muted) this.music?.pause();
    else this.#startMusicIfAllowed({ resumeExisting: true, allowAutoplay: true });
    return this.muted;
  }

  #startMusicIfAllowed({ resumeExisting = false, allowAutoplay = false } = {}) {
    if (this.muted || this.musicSuspended || !this.musicKey) return;
    if (!this.audioUnlocked) {
      if (!allowAutoplay || this.musicAutoplayAttempted) return;
      this.musicAutoplayAttempted = true;
    }
    if (this.music) {
      if (resumeExisting) this.music.play().catch(() => {});
      return;
    }
    const source = this.sounds.get(this.musicKey);
    if (!source) return;
    const music = source.cloneNode();
    music.loop = true;
    music.volume = this.musicVolume;
    this.music = music;
    music.play().catch(() => {
      if (this.music === music) this.music = null;
    });
  }

  #loadImage(key, file) {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => { this.loaded += 1; resolve(); };
      image.onerror = () => {
        this.loaded += 1;
        this.errors.push(`${this.baseUrl}${file}`);
        resolve();
      };
      image.src = `${this.baseUrl}${file}`;
      this.images.set(key, image);
    });
  }

  #loadSound(key, file) {
    return new Promise(resolve => {
      const audio = new Audio();
      let settled = false;
      const done = error => {
        if (settled) return;
        settled = true;
        this.loaded += 1;
        if (error) this.errors.push(`${this.baseUrl}${file}`);
        resolve();
      };
      audio.addEventListener('canplaythrough', () => done(false), { once: true });
      audio.addEventListener('error', () => done(true), { once: true });
      audio.preload = 'auto';
      audio.src = `${this.baseUrl}${file}`;
      audio.load();
      this.sounds.set(key, audio);
    });
  }
}
