// === /HeroHealth/vr/hub.js (2025-11-12 stable path + autostart) ===
export default class GameHub {
  constructor(){
    this.currentMode = null;
    this.difficulty  = 'normal';
    this.ctrl        = null;

    // map โหมด → path (ไม่มี /vr/ นำหน้า)
    this.modeMap = {
      goodjunk : './modes/goodjunk.safe.js',
      groups   : './modes/groups.safe.js',
      hydration: './modes/hydration.safe.js',
      plate    : './modes/plate.safe.js'
    };

    this.readParams();
    this.wireHudReady();
    this.autoStartIfNeeded();
    console.log('[Hub] Hub ready');
  }

  readParams(){
    const q = new URLSearchParams(location.search);
    this.currentMode = q.get('mode') || 'goodjunk';
    this.difficulty  = q.get('diff') || q.get('difficulty') || 'normal';
    this.autostart   = (q.get('autostart') === '1' || q.get('start') === '1');
  }

  wireHudReady(){
    // แจ้งว่าพร้อมให้ ui-fever.js มาจับย้าย fever bar
    const announce = () => {
      window.dispatchEvent(new CustomEvent('hha:hud-ready',
        { detail:{ anchorId:'hudTop', scoreBox:true }}));
    };
    announce();
    let t=0, id=setInterval(()=>{ announce(); if(++t>15) clearInterval(id); },150);
    console.log('[Hub] HUD ready announced');
  }

  async startGame(){
    try{
      await this.loadMode(this.currentMode);
      if (this.ctrl && this.ctrl.start) this.ctrl.start();
    }catch(err){
      console.warn('[Hub] startGame failed:', err);
    }
  }

  async loadMode(mode){
    const url = this.modeMap[mode] || this.modeMap.goodjunk;
    // ยกเลิกของเดิม (กันคลิกซ้อน)
    try { window.dispatchEvent(new Event('hha:mode-dispose')); } catch(_){}

    // โหลดโมดูลโหมด
    const mod = await import(/* @vite-ignore */ url + '?v=' + Date.now());
    if (!mod || !mod.boot) throw new Error('Mode module invalid: ' + url);

    // boot โหมด
    const ctrl = await mod.boot({
      difficulty: this.difficulty,
      duration  : 60
    });
    this.ctrl = ctrl || {};
    console.log('[Hub] Mode loaded:', mode);
  }

  selectMode(mode){
    this.currentMode = mode || 'goodjunk';
    // เปลี่ยนเฉพาะโหมด (ไม่ autostart) — ปุ่มเริ่มจะเรียก startGame()
  }

  autoStartIfNeeded(){
    if (this.autostart || this.currentMode){
      // เงียบ ๆ รอ DOM พร้อมอีกนิดกันซ้ำกับ main.js
      setTimeout(()=>this.startGame(), 150);
    }
  }
}
