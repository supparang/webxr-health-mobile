// === Coach (voice / BGM / SFX) — 2025-11-05 ===
// ใช้ได้ทั้งแบบ ES module และแบบแนบเป็น window.Coach
// - ปลอดภัยต่อ Autoplay: ต้องมี gesture ก่อนถึงจะเปิดเสียง
// - ถ้าไฟล์เสียงหาย เกมยังเล่นได้ (เงียบเฉย ๆ)
// - มี TTS ภาษาไทย fallback

const BANK = {
  bgm_main:       'assets/audio/bgm_loop.mp3',   // BGM วน
  pop:            'assets/audio/pop.mp3',        // คลิก good
  boo:            'assets/audio/boo.mp3',        // โดน junk
  cheer_ok:       'assets/audio/cheer_ok.mp3',   // milestone
  cheer_victory:  'assets/audio/cheer_victory.mp3', // ชนะ/ผ่านภารกิจ
  cheer_fever:    'assets/audio/cheer_fever.mp3' // เข้า Fever (ถ้ามี)
};

class Coach {
  constructor(){
    this.ctx = null;
    this.buffers = {};
    this._bgmNode = null;
    this._userInteracted = false; // กัน autoplay
    this._bindFirstGesture();
  }

  _bindFirstGesture(){
    const once = () => {
      this._userInteracted = true;
      document.removeEventListener('pointerdown', once, true);
      document.removeEventListener('keydown', once, true);
      this._ensure(); // เตรียม AudioContext
    };
    document.addEventListener('pointerdown', once, true);
    document.addEventListener('keydown', once, true);
  }

  async _ensure(){
    if(!this.ctx){
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return null;
      this.ctx = new Ctx();
      // บางเบราว์เซอร์ต้อง resume หลัง gesture
      try { await this.ctx.resume(); } catch {}
    }
    return this.ctx;
  }

  async _load(name){
    if(!this.ctx) return null;
    if(this.buffers[name]) return this.buffers[name];
    const url = BANK[name]; if(!url) return null;
    try{
      const res = await fetch(url); if(!res.ok) return null;
      const arr = await res.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(arr);
      this.buffers[name] = buf;
      return buf;
    }catch{ return null; }
  }

  async sfx(name){
    try{
      if(!this._userInteracted) return; // รอให้ผู้ใช้กดก่อน
      const ctx = await this._ensure(); if(!ctx) return;
      const buf = await this._load(name); if(!buf) return;
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start();
    }catch{}
  }

  async playBGM(name='bgm_main'){
    try{
      if(!this._userInteracted) return; // ต้องมี gesture ก่อน
      const ctx = await this._ensure(); if(!ctx) return;
      const buf = await this._load(name); if(!buf) return;
      this.stopBGM();
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      src.connect(ctx.destination); src.start(); this._bgmNode = src;
    }catch{}
  }

  stopBGM(){
    try{ this._bgmNode?.stop(); }catch{} this._bgmNode=null;
  }

  say(text){
    // Fallback เป็น TTS ภาษาไทย (เงียบถ้า browser ไม่รองรับ)
    if(!text) return;
    if('speechSynthesis' in window){
      try{
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'th-TH'; u.rate = 1.0; u.pitch = 1.0;
        window.speechSynthesis.cancel(); // ตัดคิวเก่า
        window.speechSynthesis.speak(u);
      }catch{}
    }
  }

  cheer(level='ok'){
    if(level==='victory') return this.sfx('cheer_victory');
    if(level==='great')   return this.sfx('cheer_ok');
    if(level==='fever')   return this.sfx('cheer_fever');
    return this.sfx('cheer_ok');
  }
}

// รองรับได้ทั้ง ES module และการอ้างผ่าน window.Coach
export { Coach };
if (typeof window !== 'undefined') {
  window.Coach = window.Coach || Coach;
}
