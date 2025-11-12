// === /HeroHealth/vr/hub.js (2025-11-12 LATEST, stable import & HUD wiring) ===
console.log('[Hub] initializing');

function toNum(n, d){ n = Number(n); return (isFinite(n) ? n : d); }
function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
function safeSetTroikaText(el, value){
  try { el.setAttribute('troika-text', 'value', String(value)); } catch(_){}
}
function escapeHtml(s){
  return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

export class GameHub {
  constructor() {
    // --- URL params ---
    const q = new URLSearchParams(location.search);
    this.mode       = q.get('mode') || 'goodjunk';
    this.goal       = toNum(q.get('goal'), 40);
    this.duration   = toNum(q.get('duration'), 60);
    this.difficulty = q.get('difficulty') || q.get('diff') || 'normal';

    // --- DOM bindings ---
    this.spawnHost  = document.getElementById('spawnHost') || document.getElementById('spawnZone') || this._ensureSpawnHost();
    this.questPanel = document.getElementById('questPanel') || null;
    this.hudRoot    = document.getElementById('hudRoot') || document.body;
    this.menu       = document.getElementById('modeMenu') || null;
    this.startPanel = document.getElementById('startPanel') || null;
    this.startLbl   = document.getElementById('startLbl') || null;
    this.bootBox    = document.getElementById('bootStatus') || null;

    // desktop/VR buttons (optional)
    this.domStartBtn = document.getElementById('btnStart') || null;
    this.vrStartBtn  = document.getElementById('vrStartBtn') || null;

    this.current = null;
    this.running = false;

    this._bindPause();
    this._bindVisibility();
    this._wireQuestPanelUpdates();
    this._wireButtons();

    this._announceHUDReady();
    this._scheduleAnnounceBurst();

    this._showBoot('Hub ready');
    window.dispatchEvent(new CustomEvent('hha:hub-ready'));

    // set initial mode label
    this.selectMode(this.mode);
  }

  // ---------- Public ----------
  selectMode(mode) {
    this.mode = mode || 'goodjunk';

    // update VR labels if present
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

    // announce HUD anchor for fever bar docking
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

    let mod = null;
    try {
      mod = await this._importWithRetry(rel, 2);
    } catch (e) {
      this._showBoot('Mode import failed → ' + (e && e.message ? e.message : e));
      return this._fallbackInline();
    }

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
        this._showBoot('Mode boot error → fallback inline');
        return this._fallbackInline();
      }

      // One-shot end
      const self = this;
      const onEnd = function(e){
        const d = (e && e.detail) ? e.detail : {reason:'done'};
        self._endGame(d);
      };
      window.addEventListener('hha:end', onEnd, {once:true});
    } else {
      this._showBoot('Module has no boot() → fallback inline');
      this._fallbackInline();
    }
  }

  // ---------- Internals ----------
  _wireButtons(){
    const start = (ev)=>{ try{ev && ev.preventDefault();}catch(_){ } this.startGame(); };
    if (this.domStartBtn) this.domStartBtn.addEventListener('click', start);
    if (this.vrStartBtn)  this.vrStartBtn.addEventListener('click', start);

    // mode menu clickers (if present)
    if (this.menu) {
      const nodes = this.menu.querySelectorAll('[data-mode]');
      for (let i=0;i<nodes.length;i++){
        const el = nodes[i];
        el.addEventListener('click', (e)=>{
          try{ e.preventDefault(); }catch(_){}
          const m = el.getAttribute('data-mode') || 'goodjunk';
          this.selectMode(m);
        });
      }
    }
  }

  _fallbackInline(){
    if (window.inlineGoodJunkBoot) {
      window.inlineGoodJunkBoot({
        host: this.spawnHost,
        duration: this.duration,
        difficulty: this.difficulty,
        goal: this.goal
      });
      const self = this;
      window.addEventListener('hha:end', function(e){
        self._endGame((e && e.detail) ? e.detail : {reason:'done'});
      }, {once:true});
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
    const self = this;
    window.addEventListener('hha:pause', function(){
      if (self.current && self.current.pause) {
        try { self.current.pause(); } catch(_){}
      }
    });
    window.addEventListener('hha:resume', function(){
      if (self.current && self.current.resume) {
        try { self.current.resume(); } catch(_){}
      }
    });
  }

  _bindVisibility() {
    const self = this;
    function pauseLike(){ try{ window.dispatchEvent(new Event('hha:pause')); }catch(_){} }
    function resumeLike(){ try{ window.dispatchEvent(new Event('hha:resume')); }catch(_){} }

    function onVis(){ if (document.hidden) pauseLike(); else resumeLike(); }
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', pauseLike);
    window.addEventListener('focus', resumeLike);
  }

  _wireQuestPanelUpdates(){
    const self = this;
    function onQuest(ev){
      if (!self.questPanel) return;
      const tQ = document.getElementById('tQ');
      if (!tQ) return;
      try {
        const d = ev && ev.detail ? ev.detail : null;
        if (!d) return;
        const g = d.goal ? (d.goal.label + ' ' + _fmtProg(d.goal.prog, d.goal.target)) : '';
        const m = d.mini ? (d.mini.label + ' ' + _fmtProg(d.mini.prog, d.mini.target)) : '';
        const text = g && m ? (g + ' | ' + m) : (g || m || 'สุ่มมิชชัน 3 อย่าง / เก็บแต้มให้ถึงเป้า!');
        safeSetTroikaText(tQ, text);
      } catch(_){}
    }
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
        const ev = new CustomEvent('hha:hud-ready', { detail: { anchorId: 'hudTop', scoreBox: true } });
        window.dispatchEvent(ev);
        this._showBoot('HUD ready announced');
        return true;
      }
    } catch(_){}
    return false;
  }

  _scheduleAnnounceBurst(){
    // ยิงซ้ำ ๆ กันเผื่อ HUD เพิ่ง mount ช้า
    const self = this;
    let tries = 0, maxTries = 20;
    const id = setInterval(function(){
      if (self._announceHUDReady()) { clearInterval(id); return; }
      tries++;
      if (tries >= maxTries) clearInterval(id);
    }, 150);
  }

  async _importWithRetry(rel, retries = 2){
    // Resolve จากตำแหน่งไฟล์นี้เสมอ → กัน /HeroHealth//HeroHealth และกันตก /modes/
    let baseUrl;
    try {
      baseUrl = new URL(rel, import.meta.url).toString();
    } catch {
      baseUrl = rel;
    }

    let lastErr;
    for (let i=0; i<=retries; i++){
      try {
        const bust = new URL(baseUrl);
        bust.searchParams.set('v', String(Date.now()));
        // eslint-disable-next-line no-eval
        const mod = await import(bust.toString());
        return mod;
      } catch (e) {
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

    // show VR fallback label
    const resultLbl = document.getElementById('resultLbl');
    if (resultLbl) {
      let txt;
      if (detail && detail.reason === 'win')          txt = 'จบเกม: ชนะ! คะแนน ' + (detail.score!=null?detail.score:'-');
      else if (detail && detail.reason === 'timeout') txt = 'จบเกม: หมดเวลา คะแนน ' + (detail.score!=null?detail.score:'-');
      else                                            txt = 'จบเกม';
      safeSetTroikaText(resultLbl, txt);
      resultLbl.setAttribute('visible', true);
    }

    if (this.menu) this.menu.setAttribute('visible', true);
    if (this.startPanel) this.startPanel.setAttribute('visible', true);

    this._showBoot('Ended ('+ (detail && detail.reason ? detail.reason : 'done') +')');
    // ปิดการคลิกของ layer เป้าหมาย (กัน “เป้ายังคลิกได้หลังจบ”)
    try {
      const layer = document.querySelector('.hha-layer');
      if (layer) layer.style.pointerEvents = 'none';
    } catch(_){}
  }
}

// helpers (local)
function _fmtProg(p, t){
  const pp = Number(p)||0, tt = Number(t)||0;
  return tt>0 ? '('+pp+'/'+tt+')' : '('+pp+')';
}

export default GameHub;
