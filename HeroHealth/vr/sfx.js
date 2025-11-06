// === vr/sfx.js (2025-11-06 enhanced + mobile-safe addons) ===
export class SFX {
  constructor(basePath = './assets/audio/') {
    // ใช้ URL แบบปลอดภัย (ทำงานได้ทั้ง localhost และ GitHub Pages โฟลเดอร์ย่อย)
    this.baseUrl = new URL(basePath, import.meta.url);

    this.cache = new Map();     // url -> Audio (prototype for cloning)
    this.playing = new Map();   // name -> timestamps[] (rate limiter)
    this.activeNodes = new Set(); // all cloned Audio currently playing

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

  // ---------- Utils ----------
  _url(file) {
    // รองรับส่งทั้ง 'name.mp3' หรือ 'subdir/name.mp3'
    return new URL(file, this.baseUrl).toString();
  }

  _preloadAll() { for (const f of this.preloadList) this._preload(f); }

  _preload(name) {
    const url = this._url(name);
    if (this.cache.has(url)) return;
    const a = new Audio(url);
    a.preload = 'auto';
    this.cache.set(url, a);
  }

  _pruneLimiter(name, limitMs) {
    const now = performance.now();
    const arr = this.playing.get(name) || [];
    const kept = arr.filter(t => now - t < limitMs);
    this.playing.set(name, kept);
    return kept;
  }

  _play(name, vol = 1, limitMs = 100) {
    if (this.muted) return;
    const url = this._url(name);
    let proto = this.cache.get(url);
    if (!proto) { this._preload(name); proto = this.cache.get(url); }

    // simple limiter (ป้องกันซ้อนถี่เกินไป)
    const arr = this._pruneLimiter(name, limitMs);
    if (arr.length > 4) return; // ซ้อนเกิน 4 เสียงภายในช่วงสั้น ๆ → ตัดทิ้ง
    arr.push(performance.now());
    this.playing.set(name, arr);

    try {
      const snd = proto.cloneNode();
      snd.volume = Math.max(0, Math.min(1, vol * this.globalVol));
      snd.muted = this.muted;
      this.activeNodes.add(snd);
      snd.play().catch(()=>{ /* iOS ยังไม่ unlock ก็จะเงียบ ซึ่งเราจะแก้ด้วย unlock() */ });

      const cleanup = () => { this.activeNodes.delete(snd); snd.remove(); };
      snd.addEventListener('ended', cleanup, { once:true });
      snd.addEventListener('pause', cleanup, { once:true });
    } catch (e) {
      console.warn('[SFX] play failed', name, e);
    }
  }

  setVolume(v) {
    this.globalVol = Math.max(0, Math.min(1, v));
    if (this.bgm) this.bgm.volume = 0.6 * this.globalVol;
  }

  mute(on = true) {
    this.muted = on;
    if (this.bgm) this.bgm.muted = on;
    for (const a of this.activeNodes) a.muted = on;
  }

  setBasePath(basePath) {
    this.baseUrl = new URL(basePath, import.meta.url);
  }

  // ---------- Mobile/iOS helpers ----------
  /**
   * เรียกครั้งเดียวหลัง user interaction (เช่น click/tap) เพื่อปลดล็อกการเล่นเสียงบน iOS/Safari
   */
  async unlock() {
    try {
      const test = new Audio(this._url('pop.mp3'));
      test.volume = 0; // เงียบ
      await test.play().catch(()=>{});
      test.pause(); test.remove();
    } catch {}
  }

  /**
   * ปิด/เปิด BGM อัตโนมัติเมื่อสลับแท็บ/พักหน้าจอ
   */
  attachPageVisibilityAutoMute() {
    const onVis = () => {
      if (document.hidden) this._autoPauseBGM();
      else this._autoResumeBGM();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', () => this._autoPauseBGM());
    window.addEventListener('focus', () => this._autoResumeBGM());
  }

  _autoPauseBGM() {
    try { if (this.bgm && !this.bgm.paused) this.bgm.pause(); } catch {}
  }
  _autoResumeBGM() {
    try { if (this.bgm && this.muted === false) this.bgm.play().catch(()=>{}); } catch {}
  }

  stopAllOneShots() {
    for (const a of Array.from(this.activeNodes)) {
      try { a.pause(); a.remove(); } catch {}
      this.activeNodes.delete(a);
    }
  }

  // ---------- One-shot SFX ----------
  popGood()  { this._play('pop.mp3', 1); }
  popBad()   { this._play('boo.mp3', 0.8); }
  star()     { this._play('star.mp3', 0.9); }
  diamond()  { this._play('diamond.mp3', 1); }

  // ---------- Fever sequence ----------
  feverStart() {
    this._play('fever_start.mp3', 1);
    this.playBGM('fever_bgm.mp3', 0.6, true);
  }
  feverEnd() {
    this._play('fever_end.mp3', 1);
    this.stopBGM();
  }

  // ---------- Coach voice ----------
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

  // ---------- BGM ----------
  playBGM(file, vol = 0.5, loop = true) {
    if (this.muted) return;
    try {
      this.stopBGM();
      const url = this._url(file);
      const a = new Audio(url);
      a.loop = loop;
      a.volume = Math.max(0, Math.min(1, vol * this.globalVol));
      a.muted = this.muted;
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
