// === Hero Health VR — GameHub (production, no optional chaining) ===
export class GameHub {
  constructor() {
    // --- URL params ---
    var q = new URLSearchParams(location.search);
    this.mode       = q.get('mode') || null;
    this.goal       = toNum(q.get('goal'), 40);
    this.duration   = toNum(q.get('duration'), 60);
    this.difficulty = q.get('difficulty') || 'normal';

    // --- DOM bindings ---
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
    this._bindPause();
    this._bindVisibility();

    if (this.mode) this.selectMode(this.mode);
  }

  // ---------- Public API ----------
  selectMode(mode) {
    this.mode = mode || 'goodjunk';

    var heads = (this.hudRoot && this.hudRoot.querySelectorAll) ? this.hudRoot.querySelectorAll('a-entity[troika-text]') : [];
    if (heads && heads.length) safeSetTroikaText(heads[0], 'โหมด: ' + this.mode);
    if (this.startLbl) safeSetTroikaText(this.startLbl, 'เริ่ม: ' + this.mode.toUpperCase());
    if (this.startPanel) this.startPanel.setAttribute('visible', true);
    if (this.menu) this.menu.setAttribute('visible', false);
  }

  async startGame() {
    if (this.running) return;
    this.running = true;

    if (this.menu) this.menu.setAttribute('visible', false);
    if (this.startPanel) this.startPanel.setAttribute('visible', false);

    if (this.questPanel) {
      this.questPanel.setAttribute('visible', true);
      var tQ = document.getElementById('tQ');
      if (tQ) safeSetTroikaText(tQ, 'สุ่มมิชชัน 3 อย่าง / เก็บแต้มให้ถึงเป้า!');
    }

    var mode = this.mode || 'goodjunk';
    var moduleMap = {
      goodjunk : './modes/goodjunk.safe.js',
      groups   : './modes/groups.safe.js',
      hydration: './modes/hydration.quest.js',
      plate    : './modes/plate.quest.js'
    };
    var rel = moduleMap[mode] || moduleMap.goodjunk;

    // สร้าง URL อย่างปลอดภัย (relative กับไฟล์นี้)
    var url;
    try { url = new URL(rel, import.meta.url).toString(); }
    catch (e) { url = rel; }

    var mod = await this._importWithRetry(url, 2).catch(function(){ return null; });

    if (mod && typeof mod.boot === 'function') {
      this._showBoot('Loaded mode: ' + mode);
      try {
        var api = await mod.boot({
          host: this.spawnHost,
          duration: this.duration,
          difficulty: this.difficulty,
          goal: this.goal,
          emit: function(type, detail){
            try { window.dispatchEvent(new CustomEvent('hha:'+type, {detail:detail})); } catch(_){}
          }
        });
        this.current = api || {};
      } catch (e) {
        this._showBoot('Mode boot error → fallback inline (if any)');
        return this._fallbackInline();
      }

      var self = this;
      var onEnd = function(e){
        var d = (e && e.detail) ? e.detail : {reason:'done'};
        self._endGame(d);
      };
      window.addEventListener('hha:end', onEnd, {once:true});
    } else {
      this._showBoot('Mode import failed → Inline fallback');
      this._fallbackInline();
    }
  }

  // ---------- Internals ----------
  _fallbackInline(){
    if (window.inlineGoodJunkBoot) {
      window.inlineGoodJunkBoot({
        host: this.spawnHost,
        duration: this.duration,
        difficulty: this.difficulty,
        goal: this.goal
      });
      var self = this;
      window.addEventListener('hha:end', function(e){
        self._endGame((e && e.detail) ? e.detail : {reason:'done'});
      }, {once:true});
    } else {
      this._showBoot('No fallback available.');
      this._endGame({reason:'failed'});
    }
  }

  _ensureSpawnHost() {
    var host = document.createElement('div');
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
    var self = this;
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
    var self = this;
    function pauseLike(){ try{ window.dispatchEvent(new Event('hha:pause')); }catch(_){} }
    function resumeLike(){ try{ window.dispatchEvent(new Event('hha:resume')); }catch(_){} }

    function onVis(){ if (document.hidden) pauseLike(); else resumeLike(); }
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', pauseLike);
    window.addEventListener('focus', resumeLike);
  }

  async _importWithRetry(url, retries){
    var lastErr;
    for (var i=0;i<=retries;i++){
      try{
        var u = new URL(url, location.href);
        u.searchParams.set('v', String(Date.now()));
        // dynamic import
        // eslint-disable-next-line no-eval
        var mod = await import(u.toString());
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
    try { if (this.current && this.current.pause) this.current.pause(); } catch {}
    try { if (this.current && this.current.stop)  await this.current.stop(); } catch {}

    this.current = null;
    this.running = false;

    if (this.menu) this.menu.setAttribute('visible', true);
    if (this.startPanel) this.startPanel.setAttribute('visible', true);

    var resultLbl = document.getElementById('resultLbl');
    if (resultLbl) {
      var txt;
      if (detail && detail.reason === 'win')       txt = 'จบเกม: ชนะ! คะแนน ' + (detail.score!=null?detail.score:'-');
      else if (detail && detail.reason === 'timeout') txt = 'จบเกม: หมดเวลา คะแนน ' + (detail.score!=null?detail.score:'-');
      else                                         txt = 'จบเกม';
      safeSetTroikaText(resultLbl, txt);
      resultLbl.setAttribute('visible', true);
    }

    this._showBoot('Ended ('+ (detail && detail.reason ? detail.reason : 'done') +')');
  }
}

// ---------- helpers ----------
function toNum(n, d){ n = Number(n); return (isFinite(n) ? n : d); }
function delay(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function safeSetTroikaText(el, value){
  try { el.setAttribute('troika-text', 'value', String(value)); } catch(_){}
}
function escapeHtml(s){
  return String(s).replace(/[&<>'"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]); });
}
