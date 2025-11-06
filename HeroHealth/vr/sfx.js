// === vr/sfx.js (2025-11-06 enhanced) ===
export class SFX {
  constructor(basePath = './assets/audio/') {
    this.base = basePath;
    this.cache = new Map();     // key -> Audio element
    this.playing = new Map();   // key -> timestamp array (for limiter)
    this.globalVol = 1.0;
    this.muted = false;

    this.bgm = null;            // background music Audio
    this.preloadList = [
      'pop.mp3','boo.mp3','star.mp3','diamond.mp3',
      'fever_start.mp3','fever_bgm.mp3','fever_end.mp3',
      'coach_start_th.mp3','coach_clear_th.mp3',
      'coach_mode_goodjunk.mp3','coach_mode_groups.mp3',
      'coach_mode_hydration.mp3','coach_mode_plate.mp3'
    ];
    this._preloadAll();
  }

  // ----------------------------
  _preloadAll() {
    for (const f of this.preloadList) this._preload(f);
  }

  _preload(name) {
    const url = this.base + name;
    if (this.cache.has(url)) return;
    const a = new Audio(url);
    a.preload = 'auto';
    this.cache.set(url, a);
  }

  _play(name, vol = 1, limitMs = 100) {
    if (this.muted) return;
    const url = this.base + name;
    let proto = this.cache.get(url);
    if (!proto) { this._preload(name); proto = this.cache.get(url); }

    // simple limiter: ถ้าเล่นซ้ำภายใน limitMs จะไม่สร้างใหม่
    const now = performance.now();
    const arr = this.playing.get(name) || [];
    const recent = arr.filter(t => now - t < limitMs);
    if (recent.length > 4) return; // จำกัดไม่ให้ซ้อนเกิน 4 เสียงภายในช่วงเวลาเดียวกัน
    arr.push(now);
    this.playing.set(name, arr);

    // clone node เพื่อให้เล่นพร้อมกันได้
    try {
      const snd = proto.cloneNode();
      snd.volume = Math.max(0, Math.min(1, vol * this.globalVol));
      snd.play().catch(()=>{});
      // cleanup after play
      snd.addEventListener('ended', ()=>snd.remove());
    } catch (e) {
      console.warn('[SFX] play failed', name, e);
    }
  }

  setVolume(v) {
    this.globalVol = Math.max(0, Math.min(1, v));
    if (this.bgm) this.bgm.volume = 0.6 * this.globalVol;
  }

  mute(on=true) {
    this.muted = on;
    if (this.bgm) this.bgm.muted = on;
  }

  // ----------------------------
  // Sound effects
  popGood()  { this._play('pop.mp3', 1); }
  popBad()   { this._play('boo.mp3', 0.8); }
  star()     { this._play('star.mp3', 0.9); }
  diamond()  { this._play('diamond.mp3', 1); }

  // ----------------------------
  // Fever sequence
  feverStart() {
    this._play('fever_start.mp3', 1);
    this.playBGM('fever_bgm.mp3', 0.6, true);
  }

  feverEnd() {
    this._play('fever_end.mp3', 1);
    this.stopBGM();
  }

  // ----------------------------
  // Coach voice system
  playCoach(tag) {
    const map = {
      start:'coach_start_th.mp3',
      clear:'coach_clear_th.mp3',
      mode_goodjunk:'coach_mode_goodjunk.mp3',
      mode_groups:'coach_mode_groups.mp3',
      mode_hydration:'coach_mode_hydration.mp3',
      mode_plate:'coach_mode_plate.mp3'
    };
    const file = map[tag] || 'coach_start_th.mp3';
    this._play(file, 1);
  }

  // ----------------------------
  // Background music management
  playBGM(file, vol=0.5, loop=true) {
    if (this.muted) return;
    try {
      this.stopBGM();
      const url = this.base + file;
      const a = new Audio(url);
      a.loop = loop;
      a.volume = Math.max(0, Math.min(1, vol * this.globalVol));
      a.play().catch(()=>{});
      this.bgm = a;
    } catch (e) {
      console.warn('[SFX] bgm failed', e);
    }
  }

  stopBGM() {
    try {
      if (this.bgm) { this.bgm.pause(); this.bgm.remove(); this.bgm = null; }
    } catch {}
  }
}
