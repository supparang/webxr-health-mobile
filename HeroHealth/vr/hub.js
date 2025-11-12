// === /HeroHealth/vr/hub.js (2025-11-12 LATEST) ===
// - ผูกปุ่ม "เริ่มเกม" หน้า index.vr.html (#btnStart และ #vrStartBtn)
// - เลือกโหมดจากเมนู [data-mode]
// - โหลดโหมดจาก /HeroHealth/modes/*.js (relative: ../modes/*.js)
// - เรียก api.start() ทันทีหลัง boot() สำเร็จ
// - รองรับ ?mode=&difficulty=&duration=&goal=&autostart=1
console.log('[Hub] initializing');

export class GameHub {
  constructor() {
    const q = new URLSearchParams(location.search);
    this.mode       = q.get('mode') || 'goodjunk';
    this.difficulty = q.get('difficulty') || q.get('diff') || 'normal';
    this.duration   = Number(q.get('duration') || 60);
    this.goal       = Number(q.get('goal') || 40);
    this.autostart  = q.get('autostart') === '1';

    // DOM
    this.spawnHost  = document.getElementById('spawnHost') ||
                      document.getElementById('spawnZone') ||
                      this._ensureSpawnHost();
    this.questPanel = document.getElementById('questPanel') || null;
    this.hudRoot    = document.getElementById('hudRoot') || document.body;
    this.menu       = document.getElementById('modeMenu') || null;
    this.startPanel = document.getElementById('startPanel') || null;
    this.startLbl   = document.getElementById('startLbl') || null;
    this.btnStart   = document.getElementById('btnStart') || null;
    this.vrStartBtn = document.getElementById('vrStartBtn') || null;

    this.current = null;
    this.running = false;

    this._wireUI();
    this._bindPauseResume();
    this._announceHUDReady();

    // autostart (ถ้าต้องการ)
    if (this.autostart) {
      setTimeout(()=>this.startGame(), 60);
    }
  }

  // ---------- UI ----------
  _wireUI(){
    // ปุ่มเริ่มเกม (DOM)
    if (this.btnStart) {
      this.btnStart.addEventListener('click', (ev)=>{
        try{ ev.preventDefault(); }catch(_){}
        this.startGame();
      });
    }

    // ปุ่มเริ่มเกม (VR)
    if (this.vrStartBtn) {
      this.vrStartBtn.addEventListener('click', (ev)=>{
        try{ ev.preventDefault(); }catch(_){}
        this.startGame();
      });
    }

    // เมนูเลือกโหมด
    if (this.menu) {
      const items = this.menu.querySelectorAll('[data-mode]');
      for (let i=0;i<items.length;i++){
        const el = items[i];
        el.addEventListener('click',(ev)=>{
          try{ ev.preventDefault(); }catch(_){}
          const m = el.getAttribute('data-mode') || 'goodjunk';
          this.selectMode(m);
        });
      }
    }

    // แสดงข้อความโหมดปัจจุบันบน start label
    this._updateStartLabel();
  }

  selectMode(mode){
    this.mode = mode || 'goodjunk';
    this._updateStartLabel();
    // โชว์แผงเริ่มเกม, ซ่อนเมนู
    if (this.startPanel) this.startPanel.setAttribute('visible', true);
    if (this.menu) this.menu.setAttribute('visible', false);
  }

  _updateStartLabel(){
    if (!this.startLbl) return;
    try {
      this.startLbl.setAttribute('troika-text', `value: เริ่ม: ${String(this.mode||'GOODJUNK').toUpperCase()}`);
    } catch(_){}
  }

  // ---------- Start Game ----------
  async startGame(){
    if (this.running) return;
    this.running = true;

    // UI toggle
    if (this.menu) this.menu.setAttribute('visible', false);
    if (this.startPanel) this.startPanel.setAttribute('visible', false);
    if (this.questPanel) this.questPanel.setAttribute('visible', true);

    // แจ้ง HUD พร้อม (เผื่อ fever bar จะ dock ใต้ score)
    this._announceHUDReady(true);

    // แผนที่พาธโมดูล (hub.js อยู่ใน /HeroHealth/vr/ → โหมดอยู่ ../modes/)
    const moduleMap = {
      goodjunk : '../modes/goodjunk.safe.js',
      groups   : '../modes/groups.safe.js',
      hydration: '../modes/hydration.quest.js',
      plate    : '../modes/plate.quest.js'
    };
    const rel = moduleMap[this.mode] || moduleMap.goodjunk;

    let url;
    try { url = new URL(rel, import.meta.url).toString(); }
    catch { url = rel; }

    const mod = await this._importWithRetry(url, 2).catch(()=>null);

    if (mod && typeof mod.boot === 'function') {
      try {
        const api = await mod.boot({
          host: this.spawnHost,
          duration: this.duration,
          difficulty: this.difficulty,
          goal: this.goal,
          emit: (type, detail)=>{
            try { window.dispatchEvent(new CustomEvent('hha:'+type, {detail})); } catch(_){}
          }
        });
        this.current = api || {};

        // ✅ เริ่มเกม (สำคัญ!)
        if (this.current && typeof this.current.start === 'function') {
          this.current.start();
        } else {
          console.warn('[Hub] mode controller has no .start()');
        }

        // รอจบเกมเพื่อรีเซ็ตสถานะ + โชว์สรุป (main.js overlay จะดัก hha:end)
        const onEnd = (e)=>{
          const d = (e && e.detail) ? e.detail : {reason:'done'};
          this._endGame(d);
        };
        window.addEventListener('hha:end', onEnd, {once:true});

      } catch (e) {
        console.warn('[Hub] Mode boot error', e);
        this.running = false;
        this._showStartAgain();
      }
    } else {
      console.warn('[Hub] Mode import failed', url);
      this.running = false;
      this._showStartAgain();
    }
  }

  // ---------- Helpers ----------
  _showStartAgain(){
    if (this.startPanel) this.startPanel.setAttribute('visible', true);
    if (this.menu) this.menu.setAttribute('visible', true);
  }

  async _endGame(detail){
    try { if (this.current && this.current.pause) this.current.pause(); } catch(_){}
    try { if (this.current && this.current.stop)  await this.current.stop(); } catch(_){}
    this.current = null;
    this.running = false;

    // แสดงป้ายบนฉาก VR เผื่อ overlay DOM ถูกปิด
    const resultLbl = document.getElementById('resultLbl');
    if (resultLbl) {
      const txt = (detail && detail.reason==='win')    ? 'จบเกม: ชนะ!'
                : (detail && detail.reason==='timeout')? 'จบเกม: หมดเวลา'
                : 'จบเกม';
      try { resultLbl.setAttribute('troika-text', `value: ${txt}`); resultLbl.setAttribute('visible', true); } catch(_){}
    }

    // เปิดเมนูใหม่
    this._showStartAgain();
  }

  _ensureSpawnHost(){
    const host = document.createElement('div');
    host.id = 'spawnZone';
    host.style.position = 'absolute';
    host.style.inset = '0';
    host.style.pointerEvents = 'none';
    (document.querySelector('.game-wrap') || document.body).appendChild(host);
    return host;
  }

  _bindPauseResume(){
    const pauseLike = ()=>{ try{ window.dispatchEvent(new Event('hha:pause')); }catch(_){ } };
    const resumeLike= ()=>{ try{ window.dispatchEvent(new Event('hha:resume')); }catch(_){ } };
    document.addEventListener('visibilitychange', ()=>{ if (document.hidden) pauseLike(); else resumeLike(); });
    window.addEventListener('blur', pauseLike);
    window.addEventListener('focus', resumeLike);
  }

  _announceHUDReady(burst){
    // ส่งสัญญาณให้ ui-fever.js ย้าย fever bar ไป dock ใต้ score-box
    try {
      const ev = new CustomEvent('hha:hud-ready', { detail: { anchorId: 'hudTop', scoreBox: true } });
      window.dispatchEvent(ev);
      if (burst) {
        let i=0; const id=setInterval(()=>{
          try{ window.dispatchEvent(ev); }catch(_){}
          if (++i>15) clearInterval(id);
        },150);
      }
    } catch(_){}
  }

  async _importWithRetry(url, retries){
    let lastErr;
    for (let i=0;i<=retries;i++){
      try{
        let u;
        try { u = new URL(url, location.href); }
        catch { u = { toString(){ return String(url); }, searchParams:{ set(){} } }; }
        if (u && u.searchParams && u.searchParams.set) {
          u.searchParams.set('v', String(Date.now()));
        }
        // eslint-disable-next-line no-eval
        const mod = await import(u.toString());
        return mod;
      }catch(e){
        lastErr = e;
        console.warn('[Hub] Load failed ('+(i+1)+'/'+(retries+1)+'):', e?.message || e);
        await new Promise(r=>setTimeout(r, 200));
      }
    }
    throw lastErr;
  }
}

export default GameHub;

// Auto-init
window.addEventListener('DOMContentLoaded', ()=>{ new GameHub(); });
