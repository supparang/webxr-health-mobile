// === /HeroHealth/vr/hub.js (ensure HUD announce + default export) ===
export class GameHub {
  constructor(){
    var q=new URLSearchParams(location.search);
    this.mode=q.get('mode')||null;
    this.goal=toNum(q.get('goal'),40);
    this.duration=toNum(q.get('duration'),60);
    this.difficulty=q.get('difficulty')||'normal';

    this.spawnHost=document.getElementById('spawnHost')||document.getElementById('spawnZone')||this._ensureSpawnHost();
    this.questPanel=document.getElementById('questPanel')||null;
    this.hudRoot=document.getElementById('hudRoot')||document.body;
    this.menu=document.getElementById('modeMenu')||null;
    this.startPanel=document.getElementById('startPanel')||null;
    this.startLbl=document.getElementById('startLbl')||null;
    this.bootBox=document.getElementById('bootStatus')||null;

    this.current=null; this.running=false;
    this._showBoot('Hub ready');
    this._bindPause(); this._bindVisibility(); this._wireQuestPanelUpdates();
    this._announceHUDReady(); this._scheduleAnnounceBurst();
    if(this.mode) this.selectMode(this.mode);
  }
  selectMode(mode){
    this.mode=mode||'goodjunk';
    var heads=(this.hudRoot&&this.hudRoot.querySelectorAll)?this.hudRoot.querySelectorAll('a-entity[troika-text]'):[];
    if(heads&&heads.length) safeSetTroikaText(heads[0],'โหมด: '+this.mode);
    if(this.startLbl) safeSetTroikaText(this.startLbl,'เริ่ม: '+this.mode.toUpperCase());
    if(this.startPanel) this.startPanel.setAttribute('visible',true);
    if(this.menu) this.menu.setAttribute('visible',false);
    this._announceHUDReady();
  }
  async startGame(){
    if(this.running) return; this.running=true;
    if(this.menu) this.menu.setAttribute('visible',false);
    if(this.startPanel) this.startPanel.setAttribute('visible',false);

    if(this.questPanel){
      this.questPanel.setAttribute('visible',true);
      var tQ=document.getElementById('tQ'); if(tQ) safeSetTroikaText(tQ,'สุ่มมิชชัน 3 อย่าง / เก็บแต้มให้ถึงเป้า!');
    }
    this._announceHUDReady(); this._scheduleAnnounceBurst();

    var moduleMap={
      goodjunk:'./modes/goodjunk.safe.js',
      groups:'./modes/groups.safe.js',
      hydration:'./modes/hydration.quest.js',
      plate:'./modes/plate.quest.js'
    };
    var rel=moduleMap[this.mode||'goodjunk']||moduleMap.goodjunk;

    var url; try{ url=new URL(rel, import.meta.url).toString(); }catch(_){ url=rel; }
    var mod=await this._importWithRetry(url,2).catch(function(){return null;});
    if(mod && typeof mod.boot==='function'){
      this._showBoot('Loaded mode: '+this.mode);
      try{
        var api=await mod.boot({
          host:this.spawnHost, duration:this.duration, difficulty:this.difficulty, goal:this.goal,
          emit:function(type,detail){ try{ window.dispatchEvent(new CustomEvent('hha:'+type,{detail})); }catch(_){} }
        });
        this.current=api||{};
      }catch(e){
        this._showBoot('Mode boot error → fallback inline (if any)');
        return this._fallbackInline();
      }
      var self=this;
      window.addEventListener('hha:end', function(e){ var d=(e&&e.detail)?e.detail:{reason:'done'}; self._endGame(d); }, {once:true});
    }else{
      this._showBoot('Mode import failed → Inline fallback'); this._fallbackInline();
    }
  }

  _fallbackInline(){
    if(window.inlineGoodJunkBoot){
      window.inlineGoodJunkBoot({host:this.spawnHost,duration:this.duration,difficulty:this.difficulty,goal:this.goal});
      var self=this; window.addEventListener('hha:end', function(e){ self._endGame((e&&e.detail)?e.detail:{reason:'done'}); }, {once:true});
    }else{ this._showBoot('No fallback available.'); this._endGame({reason:'failed'}); }
  }
  _ensureSpawnHost(){
    var host=document.createElement('div'); host.id='spawnZone'; host.style.position='absolute'; host.style.inset='0'; host.style.pointerEvents='none';
    (document.querySelector('.game-wrap')||document.body).appendChild(host); return host;
  }
  _showBoot(msg){
    if(this.bootBox&&this.bootBox.firstElementChild){ this.bootBox.firstElementChild.innerHTML='<strong>Status:</strong> '+escapeHtml(msg); }
    else { try{ console.log('[Hub]',msg); }catch(_){} }
  }
  _bindPause(){
    var self=this;
    window.addEventListener('hha:pause', function(){ if(self.current&&self.current.pause){ try{ self.current.pause(); }catch(_){}}});
    window.addEventListener('hha:resume', function(){ if(self.current&&self.current.resume){ try{ self.current.resume(); }catch(_){}}});
  }
  _bindVisibility(){
    var self=this; function pauseLike(){ try{ window.dispatchEvent(new Event('hha:pause')); }catch(_){}} function resumeLike(){ try{ window.dispatchEvent(new Event('hha:resume')); }catch(_){}} 
    function onVis(){ if(document.hidden) pauseLike(); else resumeLike(); }
    document.addEventListener('visibilitychange', onVis); window.addEventListener('blur', pauseLike); window.addEventListener('focus', resumeLike);
  }
  _wireQuestPanelUpdates(){
    var self=this;
    window.addEventListener('hha:quest', function(ev){
      if (!self.questPanel) return;
      var tQ=document.getElementById('tQ'); if(!tQ) return;
      var d=ev&&ev.detail||null; if(!d) return;
      var g=d.goal? (d.goal.label+' '+fmtProg(d.goal.prog,d.goal.target)) : '';
      var m=d.mini? (d.mini.label+' '+fmtProg(d.mini.prog,d.mini.target)) : '';
      var text=g&&m?(g+' | '+m):(g||m||'สุ่มมิชชัน 3 อย่าง / เก็บแต้มให้ถึงเป้า!');
      safeSetTroikaText(tQ,text);
    });
  }
  _announceHUDReady(){
    try{
      var anchor = document.querySelector('#hudTop .score-box, .hud-top .score-box, [data-hud="scorebox"], #hudTop, .hud-top');
      if(anchor){ window.dispatchEvent(new CustomEvent('hha:hud-ready',{detail:{anchorId:'hudTop',scoreBox:true}})); this._showBoot('HUD ready announced'); return true; }
    }catch(_){}
    return false;
  }
  _scheduleAnnounceBurst(){
    var self=this, tries=0, max=20, id=setInterval(function(){ if(self._announceHUDReady()){ clearInterval(id); return; } if(++tries>=max) clearInterval(id); },150);
  }
  async _importWithRetry(url,retries){
    var lastErr;
    for(var i=0;i<=retries;i++){
      try{
        var u; try{ u=new URL(url,location.href);}catch(_){ u={toString:()=>String(url), searchParams:{set:function(){}}}; }
        if(u && u.searchParams && u.searchParams.set) u.searchParams.set('v', String(Date.now()));
        // eslint-disable-next-line no-eval
        var mod=await import(u.toString()); return mod;
      }catch(e){ lastErr=e; this._showBoot('Load failed ('+(i+1)+'/'+(retries+1)+'): '+(e&&e.message?e.message:e)); await new Promise(r=>setTimeout(r,200)); }
    }
    throw lastErr;
  }
  async _endGame(detail){
    try{ if(this.current&&this.current.pause) this.current.pause(); }catch(_){}
    try{ if(this.current&&this.current.stop) await this.current.stop(); }catch(_){}
    this.current=null; this.running=false;
    if(this.menu) this.menu.setAttribute('visible',true);
    if(this.startPanel) this.startPanel.setAttribute('visible',true);
    var resultLbl=document.getElementById('resultLbl');
    if(resultLbl){
      var txt = (detail&&detail.reason==='win')?('จบเกม: ชนะ! คะแนน '+(detail.score!=null?detail.score:'-')):
                (detail&&detail.reason==='timeout')?('จบเกม: หมดเวลา คะแนน '+(detail.score!=null?detail.score:'-')):'จบเกม';
      safeSetTroikaText(resultLbl,txt); resultLbl.setAttribute('visible',true);
    }
    this._showBoot('Ended ('+(detail&&detail.reason?detail.reason:'done')+')');
  }
}
function toNum(n,d){ n=Number(n); return (isFinite(n)?n:d); }
function safeSetTroikaText(el,val){ try{ el.setAttribute('troika-text','value',String(val)); }catch(_){}} 
function escapeHtml(s){ return String(s).replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function fmtProg(p,t){ var pp=Number(p)||0, tt=Number(t)||0; return tt>0?('('+pp+'/'+tt+')'):('('+pp+')'); }

export default GameHub;
