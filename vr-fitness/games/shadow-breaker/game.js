/* games/shadow-breaker/game.js
   Shadow Breaker (Classic feel kept)
   - Difficulty/Assist + Boss Names + Punch Pads + Coach Tips
   - ไม่หักคะแนนจากการ “ไม่กด”
   - Bomb = เมื่อ "กด" จะตัดคอมโบทันที (ไม่มีลดสกอร์)
   - ดาว 5 ระดับ (★ 0–5) ในสรุปผล
   - Match length by difficulty (Easy=90s / Normal=85s / Hard=80s / Final=75s)
   - Tutorial-first-play (สั้น) + 5s Count-down
   - Early-Ease 15s, Cheer SFX, Micro-goals, VFX flash, Soft-end
   - Analytics เล็ก ๆ + Save/Load โปรไฟล์ (Stats/Export/Import)
   - Pad 3D + แตกกระจาย + จอสั่น
*/
(function(){
  "use strict";

  // ------------------ Helpers & Globals ------------------
  function byId(id){ return document.getElementById(id); }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  var HUB_URL = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";
  var metaAB = document.querySelector('meta[name="asset-base"]');
  var ASSET_BASE = (metaAB && metaAB.content ? metaAB.content : "").replace(/\/+$/,"");

  // Feature switches (เปิดทั้งหมด)
  var FX = {
    pacingSmooth:    true,
    pointerHitBoost: true,
    sfxNormalize:    true,
    hudReadable:     true,
    gentleCurve:     true,
    fairScheduler:   true,
    comboBadges:     true,
    feverMode:       true,
    accessibility:   true,
    richResults:     true,
    coachTips:       true,
    safetyCleanup:   true
  };

  function safeRemove(el){
    try{
      if(!el) return;
      if(el.parentNode) el.parentNode.removeChild(el);
      else if(el.remove) el.remove();
    }catch(_e){}
  }

  // ===== 3D Break FX + Screen Shake =====
  function worldPosOf(el){
    try{ return el.object3D.getWorldPosition(new THREE.Vector3()); }catch(_){ return new THREE.Vector3(0,0,-2.2); }
  }
  function screenShake(intensity, duration){
    intensity = intensity || 0.03;
    duration  = duration  || 180;  // ms
    var sceneEl = document.querySelector('a-scene'); if(!sceneEl) return;
    var camEl = (sceneEl.camera && sceneEl.camera.el) || sceneEl.querySelector('[camera]');
    if(!camEl || !camEl.object3D) return;
    var obj = camEl.object3D;
    var start = performance.now();
    var basePos = obj.position.clone();
    var baseRot = obj.rotation.clone();
    function tick(){
      var t = performance.now() - start;
      if (t >= duration){
        obj.position.copy(basePos);
        obj.rotation.copy(baseRot);
        return;
      }
      obj.position.set(
        basePos.x + (Math.random()*2-1)*intensity,
        basePos.y + (Math.random()*2-1)*intensity,
        basePos.z
      );
      obj.rotation.set(
        baseRot.x + (Math.random()*2-1)*intensity*0.8,
        baseRot.y + (Math.random()*2-1)*intensity*0.8,
        baseRot.z
      );
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  function explodeShardsAt(pos, color){
    var arena = byId('arena'); if(!arena) return;
    var COUNT = 10 + Math.floor(Math.random()*6); // 10–15
    for(var i=0;i<COUNT;i++){
      var f = document.createElement('a-box');
      var s = 0.04 + Math.random()*0.06;
      f.setAttribute('width', s.toFixed(3));
      f.setAttribute('height', (s*0.6 + Math.random()*0.05).toFixed(3));
      f.setAttribute('depth', (s*0.6 + Math.random()*0.05).toFixed(3));
      f.setAttribute('material','color:'+(color||'#9be7ff')+'; opacity:0.95; metalness:0.1; roughness:0.5; transparent:true');
      f.setAttribute('position', pos.x+' '+pos.y+' '+pos.z);
      var dx=(Math.random()*2-1)*0.8, dy=(Math.random()*2-1)*0.8, dz=(Math.random()*2-1)*0.2 - 0.1;
      var dur = 400 + Math.floor(Math.random()*250);
      f.setAttribute('animation__move', { property:'position', to: (pos.x+dx)+' '+(pos.y+dy)+' '+(pos.z+dz), dur: dur, easing:'easeOutQuad' });
      f.setAttribute('animation__rot',  { property:'rotation', to: (Math.random()*360|0)+' '+(Math.random()*360|0)+' '+(Math.random()*360|0), dur: dur, easing:'easeOutQuad' });
      f.setAttribute('animation__fade', { property:'material.opacity', to: 0, dur: Math.max(180, dur-120), delay: 120, easing:'linear' });
      arena.appendChild(f);
      (function(ff,dd){ setTimeout(function(){ safeRemove(ff); }, dd+160); })(f,dur);
    }
  }

  // ------------------ SFX ------------------
  var SFX = {
    slash:     new Audio(ASSET_BASE+"/assets/sfx/slash.wav"),
    perfect:   new Audio(ASSET_BASE+"/assets/sfx/perfect.wav"),
    miss:      new Audio(ASSET_BASE+"/assets/sfx/miss.wav"),
    heavy:     new Audio(ASSET_BASE+"/assets/sfx/heavy.wav"),
    combo:     new Audio(ASSET_BASE+"/assets/sfx/combo.wav"),
    hp_hit:    new Audio(ASSET_BASE+"/assets/sfx/hp_hit.wav"),
    boss_roar: new Audio(ASSET_BASE+"/assets/sfx/boss_roar.wav"),
    tel_slash: new Audio(ASSET_BASE+"/assets/sfx/tel_slash.wav"),
    tel_shock: new Audio(ASSET_BASE+"/assets/sfx/tel_shock.wav"),
    success:   new Audio(ASSET_BASE+"/assets/sfx/success.wav"),
    ui:        new Audio(ASSET_BASE+"/assets/sfx/success.wav"),
    boom:      new Audio(ASSET_BASE+"/assets/sfx/miss.wav"),
    cheer:     new Audio(ASSET_BASE+"/assets/sfx/combo.wav")
  };
try {
  Object.keys(SFX).forEach(function(k){
    SFX[k].preload = 'auto';
    SFX[k].crossOrigin = 'anonymous';
  });
} catch(_) {}

  var _sfxLastPlay = new Map();
  function playSfx(a, guardMs, vol){
    guardMs = guardMs||120; vol = (typeof vol==='number'? vol:1);
    try{
      var now=performance.now();
      if(_sfxLastPlay.get(a) && now - _sfxLastPlay.get(a) < guardMs) return;
      _sfxLastPlay.set(a, now);
      a.volume = vol; a.currentTime=0; a.play();
    }catch(_){}
  }
  function sfxPlay(a, guard, vol){
    if(FX.sfxNormalize) playSfx(a,guard,vol);
    else try{ a.currentTime=0; a.play(); }catch(_){}
  }

  // ------------------ Difficulty & Assist ------------------
  function getQ(k){ return new URLSearchParams(location.search).get(k); }

  var DIFFS = {
    easy:   { bossHP:0.60, padSpawn:1.50, padLife:1.60, attackTime:1.45, feverAt:15, bombRate:0.00, delayScale:1.25, title:'EASY',   matchSec:90 },
    normal: { bossHP:1.00, padSpawn:1.00, padLife:1.00, attackTime:1.00, feverAt:25, bombRate:0.12, delayScale:1.00, title:'NORMAL', matchSec:85 },
    hard:   { bossHP:1.20, padSpawn:0.85, padLife:0.90, attackTime:0.90, feverAt:25, bombRate:0.18, delayScale:0.95, title:'HARD',   matchSec:80 },
    final:  { bossHP:1.35, padSpawn:0.78, padLife:0.85, attackTime:0.85, feverAt:25, bombRate:0.22, delayScale:0.90, title:'FINAL',  matchSec:75 }
  };
  var DIFF = DIFFS.normal;
  var ASSIST = (getQ('assist')==='1');

  function getDiffKey(){
    try{
      var q = getQ('diff'); if(q && DIFFS[q]) return q;
      var ls = localStorage.getItem('sb_diff'); if(ls && DIFFS[ls]) return ls;
    }catch(_){}
    return 'normal';
  }

  function applyDifficulty(){
    var key = getDiffKey();
    DIFF = DIFFS[key] || DIFFS.normal;
    padSpawnIntBase = Math.round(1500 * DIFF.padSpawn);
    padLifeBase     = Math.round(1200 * DIFF.padLife);
    var rDiff = byId('rDiff'); if(rDiff){ rDiff.textContent = (DIFF.title||'NORMAL'); }
  }

  function Tm(ms){ var t = ms * DIFF.attackTime; if (ASSIST) t *= 1.15; return Math.round(t); }
  function nextDelayScale(ms){ var t = ms * DIFF.delayScale; if (ASSIST) t *= 1.10; return Math.round(t); }

  // ------------------ State ------------------
  var running=false, paused=false, starting=false;
  var timer=null, padTimer=null, coachHypeTimer=null;
  var score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=85;
  var startTimeMs=0, feverUntil=0, bossDown=false;
  var softEnding=false, softEndTO=null;

  // Micro-goals
  var goalActive=false, goalTO=null, goalEndsAt=0, lastGoalStart=0, goalTarget=0, goalType='points', goalBaselineScore=0, goalProgressHits=0;

  // Boss Roster
  var BOSSES = [
    { id:'RazorFist',   title:'RAZORFIST',    color:'#ff3355', baseHP:1000 },
    { id:'AshOni',      title:'ASH ONI',      color:'#ffa133', baseHP:1200 },
    { id:'Nightblade',  title:'NIGHTBLADE',   color:'#7a5cff', baseHP:1400 },
    { id:'VoidEmperor', title:'VOID EMPEROR', color:'#8cf5ff', baseHP:1800 }
  ];
  var bossIndex = 0;
  var BOSS = { active:false, busy:false, phase:1, hp:0, max:1000, name:'', color:'#ff3355' };

  // HUD tweaks
  function applyHudToggles(){
    if(FX.hudReadable || FX.accessibility){
      var hud = byId('hud');
      if(hud){ hud.style.font='600 15px system-ui'; hud.style.padding='8px 12px'; }
    }
    if(FX.accessibility){
      var bossBar=byId('bossBar'); if(bossBar){ bossBar.style.borderColor='#fff'; bossBar.style.background='#000'; }
    }
    if(!byId('microGoal')){
      var mg=document.createElement('div');
      mg.id='microGoal';
      var mgStyle = {
        position:'fixed', left:'50%', top:'10px', zIndex:9999,
        background:'rgba(8,14,22,.85)', color:'#e6f7ff', padding:'6px 10px',
        border:'1px solid #234', borderRadius:'10px', display:'none'
      };
      Object.assign(mg.style, mgStyle);
      mg.style.transform='translateX(-50%)';
      mg.style.font='700 12px system-ui';
      mg.innerHTML = '<span id="mgText"></span> <span id="mgTimer" style="opacity:.9"></span>';
      document.body.appendChild(mg);
    }
    if(!byId('sbCountdown')){
      var c=document.createElement('div'); c.id='sbCountdown';
      Object.assign(c.style,{ position:'fixed', left:0, top:0, right:0, bottom:0, display:'none',
        alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.55)',
        color:'#e6f7ff', zIndex:99999, font:'900 56px/1 system-ui' });
      c.innerHTML = '<div id="sbCountdownNum">5</div>';
      document.body.appendChild(c);
    }
