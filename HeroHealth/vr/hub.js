// === /HeroHealth/vr/hub.js (2025-11-12) ===
export class GameHub {
  constructor() {
    // URL params
    const q = new URLSearchParams(location.search);
    this.mode       = q.get('mode') || null;
    this.goal       = toNum(q.get('goal'), 40);
    this.duration   = toNum(q.get('duration'), 60);
    this.difficulty = q.get('difficulty') || q.get('diff') || 'normal'; // alias diff

    // DOM bindings
    this.spawnHost  = document.getElementById('spawnHost') || document.getElementById('spawnZone') || this._ensureSpawnHost();
    this.questPanel = document.getElementById('questPanel') || null;
    this.hudRoot    = document.getElementById('hudRoot') || document.body;
    this.menu       = document.getElementById('modeMenu') || null;
    this.startPanel = document.getElementById('startPanel') || null;
    this.startLbl   = document.getElementById('startLbl') || null;
    this.bootBox    = document.getElementById('bootStatus') || null;

    this.current = null;
    this.running = false;

    this._showBoot('Hub ready');

    // wire events
    this._bindPause();
    this._bindVisibility();
    this._wireQuestPanelUpdates();

    // HUD ready announce
    this._announceHUDReady();
    this._scheduleAnnounceBurst();

    if (this.mode) this.selectMode(this.mode);
    // expose for modal overlay if needed
    try { window.hub = this; } catch(_){}
  }

  // -------- public API --------
  selectMode(mode) {
    this.mode = mode || 'goodjunk';

    const heads = (this.hudRoot && this.hudRoot.querySelectorAll) ? this.hudRoot.querySelectorAll('a-entity[troika-text]') : [];
    if (heads && heads.length) safeSetTroikaText(heads[0], 'โหมด: ' + this.mode);
    if (this.startLbl) safeSetTroikaText(this.startLbl, 'เริ่ม: ' + this.mode.toUpperCase());
    if (this.startPanel) this.startPanel.setAttribute('visible', true);
    if (this.menu) this.menu.setAttribute('visible', false);

    this._announceHUDReady();
  }

  async startGame() {
    if (this.running) return;
    this.running = true;

    if (this.menu) this.menu.setAttribute('visible', false);
    if (this.startPanel) this.startPanel.setAttribute('visible', false);

    if (this.questPanel) {
      this.questPanel.setAttribute('visible', true);
      const tQ = document.getElementById('tQ');
      if (tQ) safeSetTroikaText(tQ, 'สุ่มมิชชัน 3 อย่าง / เก็บแต้มให้ถึงเป้า!');
    }

    // re-announce HUD ready (fever dock)
    this._announceHUDReady();
    this._scheduleAnnounceBurst();

    const mode = this.mode || 'goodjunk';
    const moduleMap = {
      goodjunk : './modes/goodjunk.safe.js',
      groups   : './modes/groups.safe.js',
      hydration: './modes/hydration.quest.js',
      plate    : './modes/plate.quest.js'
    };
    const rel = moduleMap[mode] || moduleMap.goodjunk;

    // safe URL build
    let url;
    try { url = new URL(rel, import.meta.url).toString(); }
    catch(_) { url = rel; }

    const mod = await this._importWithRetry(url, 2).catch(()=>null);

    if (mod && typeof mod.boot === 'function') {
      this._showBoot('Loaded mode: ' + mode);
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
      } catch (e) {
        this._showBoot('Mode boot error → fallback inline (if any)');
        return this._fallbackInline();
      }

      const onEnd = (e)=>{
        const d = (e && e.detail) ? e.detail : {reason:'done'};
        this._endGame(d);
      };
      window.addEventListener('hha:end', onEnd, {once:true});
    } else {
      this._showBoot('Mode import failed → Inline fallback');
      this._fallbackInline();
    }
  }

  // -------- internals --------
  _fallbackInline(){
    if (window.inlineGoodJunkBoot) {
      window.inlineGoodJunkBoot({
        host: this.spawnHost,
        duration: this.duration,
        difficulty: this.difficulty,
        goal: this.goal
      });
      const onEnd=(e)=>{ this._endGame((e && e.detail) ? e.detail : {reason:'done'}); };
      window.addEventListener('hha:end', onEnd, {once:true});
    } else {
      this._showBoot('No fallback available.');
      this._endGame({reason:'failed'});
    }
  }

  _ensureSpawnHost() {
    const host = document.createElement('div');
    host.id = 'spawnZone';
    host.style.position = 'absolute';
    host.style.inset = '0';
    host.style.pointerEvents = 'none';
    (document.querySelector('.game-wrap') || document.body).appendChild(host);
    return host;
  }

  _showBoot(msg) {
    if (this.bootBox && this.bootBox.firstElementChild) {
      this.bootBox.firstElementChild.innerHTML = '<strong>Status:</strong> ' + escapeHtml(msg);
    } else {
      try { console.log('[Hub]', msg); } catch(_){}
    }
  }

  _bindPause() {
    window.addEventListener('hha:pause', ()=>{
      if (this.current && this.current.pause) { try { this.current.pause(); } catch(_){} }
    });
    window.addEventListener('hha:resume', ()=>{
      if (this.current && this.current.resume) { try { this.current.resume(); } catch(_){} }
    });
  }

  _bindVisibility() {
    const pauseLike = ()=>{ try{ window.dispatchEvent(new Event('hha:pause')); }catch(_){} };
    const resumeLike= ()=>{ try{ window.dispatchEvent(new Event('hha:resume')); }catch(_){} };
    const onVis = ()=>{ if (document.hidden) pauseLike(); else resumeLike(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', pauseLike);
    window.addEventListener('focus', resumeLike);
  }

  _wireQuestPanelUpdates(){
    const onQuest=(ev)=>{
      if (!this.questPanel) return;
      const tQ = document.getElementById('tQ'); if (!tQ) return;
      try {
        const d = ev && ev.detail ? ev.detail : null; if (!d) return;
        const g = d.goal ? (d.goal.label + ' ' + fmtProg(d.goal.prog, d.goal.target)) : '';
        const m = d.mini ? (d.mini.label + ' ' + fmtProg(d.mini.prog, d.mini.target)) : '';
        const text = g && m ? (g+' | '+m) : (g || m || '');
        safeSetTroikaText(tQ, text || 'สุ่มมิชชัน 3 อย่าง / เก็บแต้มให้ถึงเป้า!');
      } catch(_){}
    };
    window.addEventListener('hha:quest', onQuest);
  }

  _announceHUDReady(){
    try {
      const anchor =
        document.querySelector('#hudTop .score-box') ||
        document.querySelector('.hud-top .score-box') ||
        document.querySelector('[data-hud="scorebox"]') ||
        document.querySelector('#hudTop') ||
        document.querySelector('.hud-top');

      if (anchor) {
        window.dispatchEvent(new CustomEvent('hha:hud-ready', { detail: { anchorId: 'hudTop', scoreBox: true } }));
        this._showBoot('HUD ready announced');
        return true;
      }
    } catch(_){}
    return false;
  }

  _scheduleAnnounceBurst(){
    let tries=0, max=20;
    const id=setInterval(()=>{
      if(this._announceHUDReady()){ clearInterval(id); return; }
      tries++; if(tries>=max) clearInterval(id);
    },150);
  }

  async _importWithRetry(url, retries){
    let lastErr;
    for(let i=0;i<=retries;i++){
      try{
        let u;
        try { u = new URL(url, location.href); }
        catch(_) { u = { toString:()=>String(url), searchParams: { set:()=>{} } }; }
        if(u && u.searchParams && u.searchParams.set){ u.searchParams.set('v', String(Date.now())); }
        // eslint-disable-next-line no-eval
        const mod = await import(u.toString());
        return mod;
      }catch(e){
        lastErr = e;
        this._showBoot('Load failed ('+(i+1)+'/'+(retries+1)+'): '+(e && e.message ? e.message : e));
        await delay(200);
      }
    }
    throw lastErr;
  }

  async _endGame(detail) {
    try { if (this.current && this.current.pause) this.current.pause(); } catch(_){}
    try { if (this.current && this.current.stop)  await this.current.stop(); } catch(_){}

    this.current = null;
    this.running = false;

    if (this.menu) this.menu.setAttribute('visible', true);
    if (this.startPanel) this.startPanel.setAttribute('visible', true);

    const resultLbl = document.getElementById('resultLbl');
    if (resultLbl) {
      let txt;
      if (detail && detail.reason === 'win')          txt = 'จบเกม: ชนะ! คะแนน ' + (detail.score!=null?detail.score:'-');
      else if (detail && detail.reason === 'timeout') txt = 'จบเกม: หมดเวลา คะแนน ' + (detail.score!=null?detail.score:'-');
      else                                            txt = 'จบเกม';
      safeSetTroikaText(resultLbl, txt);
      resultLbl.setAttribute('visible', true);
    }

    this._showBoot('Ended ('+ (detail && detail.reason ? detail.reason : 'done') +')');
  }
}

export default GameHub;

// ---------- helpers ----------
function toNum(n, d){ n = Number(n); return (isFinite(n) ? n : d); }
function delay(ms){ return new Promise((r)=>setTimeout(r, ms)); }
function safeSetTroikaText(el, value){
  try { el.setAttribute('troika-text', 'value', String(value)); } catch(_){}
}
function escapeHtml(s){
  return String(s).replace(/[&<>'"]/g, (c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function fmtProg(p, t){
  const pp = Number(p)||0, tt = Number(t)||0;
  return tt>0 ? '('+pp+'/'+tt+')' : '('+pp+')';
}
