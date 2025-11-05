// === Coach (voice/BGM/SFX minimal) ===
const BANK = {
  bgm_main: 'assets/audio/bgm_loop.mp3',
  pop:      'assets/audio/pop.mp3',
  boo:      'assets/audio/boo.mp3',
  cheer_ok: 'assets/audio/cheer_ok.mp3',
  cheer_victory: 'assets/audio/cheer_victory.mp3'
};

export class Coach{
  constructor(){
    this.ctx = null;
    this.buffers = {};
    this._bgmNode = null;
  }
  async _ensure(){
    if(!this.ctx){
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = Ctx? new Ctx(): null;
    }
  }
  async _load(name){
    if(!this.ctx) return null;
    if(this.buffers[name]) return this.buffers[name];
    const url = BANK[name]; if(!url) return null;
    const res = await fetch(url).catch(()=>null); if(!res||!res.ok) return null;
    const arr = await res.arrayBuffer();
    const buf = await this.ctx.decodeAudioData(arr).catch(()=>null);
    this.buffers[name] = buf; return buf;
  }
  async sfx(name){
    try{
      await this._ensure(); if(!this.ctx) return;
      const buf = await this._load(name); if(!buf) return;
      const src = this.ctx.createBufferSource(); src.buffer = buf; src.connect(this.ctx.destination); src.start();
    }catch{}
  }
  async playBGM(name='bgm_main'){
    try{
      await this._ensure(); if(!this.ctx) return;
      const buf = await this._load(name); if(!buf) return;
      this.stopBGM();
      const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      src.connect(this.ctx.destination); src.start(); this._bgmNode = src;
    }catch{}
  }
  stopBGM(){
    try{ this._bgmNode?.stop(); }catch{} this._bgmNode=null;
  }
  say(text){ // placeholder: ใส่ TTS ภายหลังได้
    // console.log('[Coach]', text);
    if('speechSynthesis' in window){
      try{
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'th-TH'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
      }catch{}
    }
  }
  cheer(level='ok'){
    if(level==='victory') this.sfx('cheer_victory');
    else if(level==='great') this.sfx('cheer_ok');
    else this.sfx('cheer_ok');
  }
}
