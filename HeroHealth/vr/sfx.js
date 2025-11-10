// === /HeroHealth/vr/sfx.js (2025-11-10 release-safe) ===
// Minimal safe SFX system — ใช้ได้ทุก environment (WebXR / GitHub Pages / mobile)
// ปลอดภัยแม้ไม่มีไฟล์เสียงจริง

export class SFX {
  constructor(base = '') {
    this.base = base;
    this.enabled = true;
    this.cache = {};
    this.context = null;
  }

  /* ---------- Basic Controls ---------- */
  unlock() {
    // เรียกใน touch/gesture แรก เพื่อให้ AudioContext ทำงานได้ใน iOS/Android
    try {
      if (!this.context)
        this.context = new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === 'suspended')
        this.context.resume();
    } catch {}
  }

  attachPageVisibilityAutoMute() {
    document.addEventListener('visibilitychange', () => {
      this.enabled = !document.hidden;
    });
  }

  /* ---------- Core ---------- */
  async _load(url) {
    if (!this.context) this.unlock();
    if (!this.context) return null;
    if (this.cache[url]) return this.cache[url];

    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      const decoded = await this.context.decodeAudioData(buf);
      this.cache[url] = decoded;
      return decoded;
    } catch {
      return null;
    }
  }

  async _play(url, vol = 1.0) {
    if (!this.enabled || !url) return;
    try {
      const ctx = this.context;
      if (!ctx) return;
      const buf = await this._load(url);
      if (!buf) return;
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.buffer = buf;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
    } catch {}
  }

  /* ---------- Gameplay SFX ---------- */
  popGood() {
    // เสียงคลิกสั้นๆ (หรือใช้ dummy beep)
    try {
      const ctx = this.context;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }

  popBad() {
    // เสียง buzz สั้น
    try {
      const ctx = this.context;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 140;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }

  playCoach(name) {
    // ตัวอย่าง: this.playCoach('greatjob') → เล่นไฟล์ /sounds/greatjob.mp3 ถ้ามี
    if (!name) return;
    const url = `${this.base}/sounds/${name}.mp3`;
    this._play(url, 0.9);
  }

  play(name) {
    // generic (ใช้แทนทุกอย่าง)
    const url = `${this.base}/${name}.mp3`;
    this._play(url);
  }
}

// Singleton (optional)
export const sfx = new SFX('');
if (typeof window !== 'undefined') window.SFX = sfx;

export default { SFX, sfx };