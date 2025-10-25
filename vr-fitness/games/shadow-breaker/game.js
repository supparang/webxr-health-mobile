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
   - เป้า 3 มิติ + แตกกระจาย + จอสั่น
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

  /* ===== 3D Break FX + Screen Shake ===== */
  function screenShake(intensity, duration){
    intensity = intensity || 0.03; // ระยะสั่น
    duration  = duration  || 160;  // ms
    var sceneEl = document.querySelector('a-scene');
    if(!sceneEl || !sceneEl.camera) return;
    var camEnt = sceneEl.camera.el || sceneEl.camera; // เผื่อกรณี a-entity
    if(!camEnt || !camEnt.object3D) return;

    var start = performance.now();
    var basePos = camEnt.object3D.position.clone();
    var baseRot = camEnt.object3D.rotation.clone();

    function tick(){
      var t = performance.now() - start;
      if (t >= duration){
        camEnt.object3D.position.copy(basePos);
        camEnt.object3D.rotation.copy(baseRot);
        return;
      }
      camEnt.object3D.position.set(
        basePos.x + (Math.random()*2-1)*intensity,
        basePos.y + (Math.random()*2-1)*intensity,
        basePos.z
      );
      camEnt.object3D.rotation.set(
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
    var COUNT = 10 + Math.floor(Math.random()*6); // 10–15 ชิ้น
    for(var i=0;i<COUNT;i++){
      var f = document.createElement('a-box');
      var s = 0.035 + Math.random()*0.06;
      f.setAttribute('width', s.toFixed(3));
      f.setAttribute('height', (s*0.6 + Math.random()*0.05).toFixed(3));
      f.setAttribute('depth', (s*0.6 + Math.random()*0.05).toFixed(3));
      f.setAttribute('material','color:'+(color||'#9be7ff')+'; opacity:0.95; metalness:0.1; roughness:0.5; transparent:true');
      f.setAttribute('position', pos.x+' '+pos.y+' '+pos.z);

      // กระเด็นออก + หมุน + จาง
      var dx=(Math.random()*2-1)*0.8, dy=(Math.random()*2-1)*0.8, dz=(Math.random()*2-1)*0.2 - 0.1;
      var dur = 420 + Math.floor(Math.random()*240);
      f.setAttribute('animation__move', {
        property:'position',
        to: (pos.x+dx)+' '+(pos.y+dy)+' '+(pos.z+dz),
        dur: dur,
        easing:'easeOutQuad'
      });
      f.setAttribute('animation__rot', {
        property:'rotation',
        to: (Math.random()*360|0)+' '+(Math.random()*360|0)+' '+(Math.random()*360|0),
        dur: dur,
        easing:'easeOutQuad'
      });
      f.setAttribute('animation__fade', {
        property:'material.opacity',
        to: 0,
        dur: Math.max(200, dur-140),
        delay: 120,
        easing:'linear'
      });
      arena.appendChild(f);
      (function(ff,dd){ setTimeout(function(){ safeRemove(ff); }, dd+180); })(f,dur);
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
    if(!byId('sbTut')){
      var t=document.createElement('div'); t.id='sbTut';
      Object.assign(t.style,{ position:'fixed', left:0, top:0, right:0, bottom:0, display:'none',
        alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.65)',
        color:'#e6f7ff', zIndex:99998 });
      t.innerHTML = ''+
        '<div style="background:#0b1118;border:1px solid #213546;border-radius:14px;padding:16px 18px;max-width:720px;width:92vw">'+
        '  <h3 style="margin:0 0 8px;font:800 18px system-ui;color:#9bd1ff">Tutorial · Shadow Breaker</h3>'+
        '  <p style="margin:4px 0 10px;font:600 13px system-ui;color:#d9f3ff">แตะ/คลิก <b>เป้าเดโม</b> ให้ครบ <b>3 ครั้ง</b> เพื่อเริ่มเกมจริง</p>'+
        '  <div style="display:flex;gap:8px;justify-content:flex-end">'+
        '    <button id="sbTutSkip" style="padding:8px 12px;border-radius:10px;border:1px solid #2a465c;background:transparent;color:#a8cfe6;font:700 12px system-ui">Skip</button>'+
        '    <button id="sbTutStart" style="padding:8px 12px;border-radius:10px;border:0;background:#0e2233;color:#e6f7ff;font:700 12px system-ui">Start Practice</button>'+
        '  </div>'+
        '</div>';
      document.body.appendChild(t);
    }
  }

  function updateMicroGoalHUD(){
    var box=byId('microGoal'); if(!box) return;
    var t=byId('mgText'), tm=byId('mgTimer');
    if(!goalActive){ box.style.display='none'; return; }
    var remain = Math.max(0, Math.ceil((goalEndsAt - performance.now())/1000));
    if(t && tm){
      var txt = goalType==='points' ? 'Micro-goal: เก็บให้ถึง '+goalTarget+' คะแนน!' : 'Micro-goal: ชกให้โดน '+goalTarget+' ครั้ง!';
      t.textContent = txt + ' ';
      tm.textContent = '('+remain+'s)';
    }
    box.style.display='block';
  }

  function scoringMul(){ return (FX.feverMode && performance.now()<feverUntil)? 1.5 : 1.0; }
  function onComboChanged(){
    if(combo===10 || combo===20 || combo===30){ sfxPlay(SFX.cheer,160,1); }
    if(FX.comboBadges && combo>0 && (combo%10===0)){ sfxPlay(SFX.combo,150,0.9); }
    var feverAt = (DIFF.feverAt||25);
    if(FX.feverMode && combo>= feverAt){
      var old=feverUntil; feverUntil = performance.now()+8000;
      if(performance.now()>old){ /* badge optional */ }
    }
    if(combo>maxCombo) maxCombo=combo;
    try{ SBAnalytics && SBAnalytics.event && SBAnalytics.event('combo',{value:combo}); }catch(_){}
  }

  var _ignoreStreak = { ring:0, blade:0, core:0, pad:0 };
  function coachTipOnce(kind){
    if(!FX.coachTips) return;
    _ignoreStreak[kind] = (_ignoreStreak[kind]||0) + 1;
    if(_ignoreStreak[kind]===3){
      var msg = (kind==='ring') ? 'โฟกัสตอนวงแหวนขยายเกือบสุด'
               : (kind==='blade') ? 'ดาบ: แตะทันทีหลังสัญญาณ'
               : (kind==='core') ? 'เพชร: แตะทันทีเพื่อคริติคอล'
               : 'Pad: แตะภายในเวลาที่กำหนด';
      var t=byId('coachTip');
      if(!t){
        t=document.createElement('div'); t.id='coachTip';
        Object.assign(t.style,{position:'fixed',left:'12px',bottom:'56px',zIndex:9999,
          background:'rgba(0,0,0,.65)',color:'#e6f7ff',padding:'6px 10px',borderRadius:'10px',font:'600 12px system-ui'});
        document.body.appendChild(t);
      }
      t.textContent='Coach: '+msg; t.style.opacity='1';
      setTimeout(function(){ t.style.opacity='0'; },1800);
    }
  }
  function resetIgnore(kind){ _ignoreStreak[kind]=0; }

  function floatText(text, color, pos){
    var e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.2;
    e.setAttribute('text',{value:text,color:color,align:'center',width:2.6});
    e.setAttribute('position',p.x+" "+p.y+" "+p.z);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:(p.x+" "+(p.y+0.6)+" "+p.z),dur:600,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',to:0,dur:480,delay:160,easing:'linear'});
    byId('arena').appendChild(e); setTimeout(function(){ safeRemove(e); },820);
  }

  function updateHUD(){ byId('score').textContent = Math.round(score); byId('combo').textContent = combo; byId('time').textContent  = timeLeft; updateMicroGoalHUD(); }
  function setPhase(n){ var el=byId('phaseLabel'); if(el) el.textContent='Phase '+n; }

  // ---------- Boss Anchor: singleton ----------
  function killAllBossAnchors(){ var xs=document.querySelectorAll('#bossAnchor'); for(var i=0;i<xs.length;i++){ try{ xs[i].remove(); }catch(_){}} }
  function killAllBossNames(){ var xs=document.querySelectorAll('#bossNameLabel, .boss-name'); for(var i=0;i<xs.length;i++){ try{ xs[i].remove(); }catch(_){}} }
  function getBossAnchor(){
    var a = document.getElementById('bossAnchor');
    if (a) return a;
    killAllBossAnchors(); killAllBossNames();
    var arena = byId('arena');
    a = document.createElement('a-entity');
    a.id='bossAnchor'; a.setAttribute('position','0 1.5 -3');
    var head=document.createElement('a-sphere'); head.setAttribute('radius','0.35'); head.setAttribute('color','#1a1a1a'); head.setAttribute('position','0 0 0');
    var mask=document.createElement('a-box');   mask.setAttribute('depth','0.06');   mask.setAttribute('width','0.55');   mask.setAttribute('height','0.45');   mask.setAttribute('color', BOSS.color || '#ff3355');   mask.setAttribute('position','0 0 0.25');
    a.appendChild(head); a.appendChild(mask); arena.appendChild(a);
    return a;
  }
  function setBossNameLabel(text){
    var a = getBossAnchor();
    killAllBossNames();
    var olds=a.querySelectorAll('.boss-name'); for(var i=0;i<olds.length;i++){ try{ olds[i].remove(); }catch(_){ } }
    var nameLabel = document.createElement('a-entity');
    nameLabel.id='bossNameLabel'; nameLabel.classList.add('boss-name');
    nameLabel.setAttribute('text',{value:(text||'BOSS'), color:'#e6f7ff', align:'center', width:3.2});
    nameLabel.setAttribute('position','0 0.62 0.1');
    a.appendChild(nameLabel);
    var rBoss = byId('rBoss'); if(rBoss) rBoss.textContent = text || 'BOSS';
  }

  // ------------------ Boss UI ------------------
  function bossShowUI(s){ var bar=byId('bossBar'); if(bar) bar.style.display=s?'block':'none'; }
  function bossSetHP(v){
    var was=BOSS.hp; BOSS.hp=clamp(v,0,BOSS.max);
    var fill=byId('bossHPFill'); if(fill) fill.style.width=((BOSS.hp/BOSS.max)*100)+'%';
    if(BOSS.phase===1 && BOSS.hp<=BOSS.max*0.5) enterPhase2();
    if(BOSS.hp<=0 && was>0) onBossDefeated();
  }
  function bossDamage(amount, pos){
    var final = Math.max(1, Math.round(amount * scoringMul()));
    sfxPlay(SFX.hp_hit,90,0.95);
    bossSetHP(BOSS.hp - final);
    // VFX flash
    try{
      var a=getBossAnchor(); var mask=a && a.querySelector('a-box');
      if(mask){
        var orig=mask.getAttribute('material')||'';
        mask.setAttribute('material', (orig?orig+'; ':'')+'emissive:#ff4444; emissiveIntensity:0.85');
        setTimeout(function(){ mask.setAttribute('material', orig); }, 120);
      }
    }catch(_){}
    if(pos) floatText('-'+final,'#ffccdd',pos);
  }
  function bossIntro(){
    var a = getBossAnchor();
    var mask = a.querySelector('a-box'); if(mask) mask.setAttribute('color', BOSS.color || '#ff3355');
    setBossNameLabel(BOSS.name || 'BOSS');
    sfxPlay(SFX.boss_roar,200,0.9);
    bossShowUI(true); bossSetHP(BOSS.max); setPhase(1);
  }

  // ------------------ Boss patterns ------------------
  var _lastPattern = '';
  function pickPattern(){
    var pool=['ring','blade','core'];
    if(FX.fairScheduler && _lastPattern){
      var alt=pool.filter(function(p){ return p!==_lastPattern; });
      var p=alt[Math.floor(Math.random()*alt.length)];
      _lastPattern=p; return p;
    }
    var p2=pool[Math.floor(Math.random()*pool.length)];
    _lastPattern=p2; return p2;
  }

  window.__sbStartT = 0;
  function nextDelay(base){
    if(!FX.gentleCurve) return nextDelayScale(base);
    var sec=(performance.now()-window.__sbStartT)/1000;
    var ease=Math.min(1, sec/45);
    var scaled=base*(1-0.2*ease);
    return Math.max(220, nextDelayScale(Math.round(scaled)));
  }

  function scheduleNext(){
    if(!running || !BOSS.active || BOSS.busy) return;
    BOSS.busy=true;
    var which = pickPattern();
    if(which==='ring') doRing();
    else if(which==='blade') doBlade();
    else doCore();
  }
  function doneAttack(delay){
    delay = delay||520;
    BOSS.busy=false;
    if(!running) return;
    window.__sbNextTO = setTimeout(scheduleNext, nextDelay(delay));
  }

  function doRing(){
    sfxPlay(SFX.tel_shock,120,1.0);
    var r=document.createElement('a-ring'); r.classList.add('clickable','boss-attack');
    r.setAttribute('position','0 1.2 -2.6'); r.setAttribute('radius-inner','0.05'); r.setAttribute('radius-outer','0.07');
    r.setAttribute('material','color:#ffd166;opacity:.95;shader:flat');
    if(FX.pointerHitBoost || ASSIST){ r.setAttribute('radius-outer', (0.07+0.04).toFixed(2)); }
    byId('arena').appendChild(r);

    var hit=false;
    var start=performance.now(), T=Tm(720);
    function step(){
      if(!r.parentNode || !running) return;
      var t=(performance.now()-start)/T, base=0.07+t*0.95;
      r.setAttribute('radius-inner', Math.max(0.01, base-0.02));
      r.setAttribute('radius-outer', base);
      if(t>=1){ if(!hit){ coachTipOnce('ring'); } safeRemove(r); doneAttack(nextDelayScale(460)); return; }
      window.__sbRaf = requestAnimationFrame(step);
    }
    r.addEventListener('click', function(){
      if(hit) return; hit=true;
      var p=r.object3D.getWorldPosition(new THREE.Vector3());
      floatText('BREAK','#00ffa3',p);
      combo++; onComboChanged(); hits++; score+=Math.round(14*scoringMul()); updateHUD();
      resetIgnore('ring');
      bossDamage(20,p);
      safeRemove(r); doneAttack(nextDelayScale(420));
    });
    step();
  }

  function doBlade(){
    sfxPlay(SFX.tel_slash,120,1.0);
    var g=document.createElement('a-entity'); g.classList.add('clickable','boss-attack');
    g.setAttribute('geometry','primitive: box; height: 0.04; width: 1.2; depth: 0.04');
    g.setAttribute('material','color:#5de1ff;opacity:.95;transparent:true');
    g.setAttribute('rotation','0 0 '+(-35+Math.round(Math.random()*70)));
    g.setAttribute('position','0 1.35 -2.2');
    byId('arena').appendChild(g);
    var ok=false;
    var T=Tm(560); var t0=performance.now();
    function timer(){
      if(!g.parentNode || !running) return;
      if(performance.now()-t0 >= T){
        if(!ok){ coachTipOnce('blade'); } safeRemove(g); doneAttack(nextDelayScale(520)); return;
      }
      window.__sbRaf = requestAnimationFrame(timer);
    }
    g.addEventListener('click', function(){
      if(ok) return; ok=true;
      var p=g.object3D.getWorldPosition(new THREE.Vector3());
      floatText('PARRY','#00d0ff',p);
      combo++; onComboChanged(); hits++; score+=Math.round(12*scoringMul()); updateHUD();
      resetIgnore('blade');
      bossDamage(16,p);
      safeRemove(g); doneAttack(nextDelayScale(460));
    });
    timer();
  }

  function doCore(){
    var g=document.createElement('a-icosahedron'); g.classList.add('clickable','boss-attack');
    g.setAttribute('position','0 1.6 -2.4'); g.setAttribute('radius','0.18'); g.setAttribute('color','#00ffa3');
    byId('arena').appendChild(g);
    var grabbed=false;
    var T=Tm(700); var t0=performance.now();
    function timer(){
      if(!g.parentNode || !running) return;
      if(performance.now()-t0 >= T){
        if(!grabbed){ coachTipOnce('core'); } safeRemove(g); doneAttack(nextDelayScale(480)); return;
      }
      window.__sbRaf = requestAnimationFrame(timer);
    }
    g.addEventListener('click', function(){
      if(grabbed) return; grabbed=true;
      var p=g.object3D.getWorldPosition(new THREE.Vector3());
      floatText('CRITICAL!','#00ffa3',p);
      sfxPlay(SFX.success,130,1.0);
      combo++; onComboChanged(); hits++; score+=Math.round(22*scoringMul()); updateHUD();
      resetIgnore('core');
      bossDamage(28,p);
      safeRemove(g); doneAttack(nextDelayScale(520));
    });
    timer();
  }

  // ------------------ Punch Pads ------------------
  var PAD_SPEC = [
    { id:'circle',   color:'#00d0ff', shape:'circle',   seg:32,   radius:0.22,   score:10,  dmg:10 },
    { id:'triangle', color:'#ffd166', shape:'circle',   seg:3,    radius:0.26,   score:12,  dmg:12 },
    { id:'square',   color:'#ff6b6b', shape:'box',      size:0.4,               score:12,  dmg:12 },
    { id:'pentagon', color:'#a899ff', shape:'circle',   seg:5,    radius:0.26,   score:14,  dmg:14 },
    { id:'hexagon',  color:'#00ffa3', shape:'circle',   seg:6,    radius:0.26,   score:16,  dmg:14 },
    { id:'diamond',  color:'#c0ffee', shape:'icosa',    r:0.19,                score:22,  dmg:18 },
    { id:'bomb',     color:'#222222', shape:'sphere',   r:0.20,  emissive:'#ff4444', score:0,  dmg:0, bomb:true }
  ];
  var padSpawnIntBase = 1500;
  var padLifeBase     = 1200;

  function isEarly15s(){ return (performance.now() - startTimeMs) < 15000; }

  function nextPadInterval(){
    var base = padSpawnIntBase;
    if(isEarly15s()){ base = Math.round(base * (1.10 + Math.random()*0.05)); }
    if(!FX.gentleCurve) return base;
    var sec=(performance.now()-window.__sbStartT)/1000;
    var ease=Math.min(1, sec/40);
    return Math.max(700, Math.round(base*(1-0.35*ease)));
  }
  function nextPadLife(){
    if(!FX.gentleCurve) return padLifeBase;
    var sec=(performance.now()-window.__sbStartT)/1000;
    var ease=Math.min(1, sec/40);
    return Math.max(800, Math.round(padLifeBase*(1-0.2*ease)));
  }

  function spawnPad(){
    if(!running || starting) return;

    var pool;
    if (DIFF === DIFFS.easy) pool = PAD_SPEC.filter(function(p){return !p.bomb;});
    else {
      var includeBomb = Math.random() < (DIFF.bombRate||0);
      pool = includeBomb ? PAD_SPEC.slice() : PAD_SPEC.filter(function(p){return !p.bomb;});
    }
    var spec = pool[Math.floor(Math.random()*pool.length)];

    var x = (Math.random()*2.2 - 1.1).toFixed(2);
    var y = (Math.random()*0.7 + 1.1).toFixed(2);
    var z = -2.3;

    var el;
    if(spec.shape==='box'){
      el = document.createElement('a-box'); var s = spec.size || 0.36; el.setAttribute('width', s); el.setAttribute('height', s); el.setAttribute('depth', s);
    }else if(spec.shape==='icosa'){
      el = document.createElement('a-icosahedron'); el.setAttribute('radius', spec.r || 0.18);
    }else if(spec.shape==='sphere'){
      el = document.createElement('a-sphere'); el.setAttribute('radius', spec.r || 0.20);
    }else{
      // เป้า 3 มิติ: ใช้ a-cylinder ให้เป็นดิสก์/พอลิกอน 3D
      el = document.createElement('a-cylinder');
      var rad = spec.radius || 0.24;
      el.setAttribute('radius', rad);
      el.setAttribute('height', 0.08); // หนาเล็กน้อย
      el.setAttribute('rotation','90 0 0'); // ให้หน้าดิสก์หันหาผู้เล่น
      if (spec.seg){ el.setAttribute('segments-radial', spec.seg); }
    }

    el.classList.add('clickable','sb-pad');
    el.setAttribute('position', x+" "+y+" "+z);
    var mat = spec.bomb
      ? 'color:'+spec.color+'; metalness:0.2; roughness:0.5; emissive:'+(spec.emissive||'#aa0000')+'; emissiveIntensity:0.6;'
      : 'color:'+spec.color+'; metalness:0.1; roughness:0.4;';
    el.setAttribute('material', mat + ' opacity:0.95; transparent:true');

    if(FX.pointerHitBoost || ASSIST){
      var collider = document.createElement('a-entity');
      collider.setAttribute('geometry','primitive: circle; radius: 0.34; segments: 24');
      collider.setAttribute('material','color:#ffffff; opacity:0.001; transparent:true');
      collider.classList.add('clickable');
      el.appendChild(collider);
      collider.addEventListener('click', function(){ el.emit('click'); });
      collider.addEventListener('mousedown', function(){ el.emit('click'); });
    }

    byId('arena').appendChild(el);

    var clicked=false;
    var killT = setTimeout(function(){ if(clicked) return; coachTipOnce('pad'); safeRemove(el); }, nextPadLife());

    function onClick(){
      if(clicked) return; clicked=true;
      clearTimeout(killT);
      var p = el.object3D.getWorldPosition(new THREE.Vector3());
      safeRemove(el);

      if(spec.bomb){
        combo = 0; onComboChanged(); updateHUD();
        floatText('BOMB! Combo reset','#ff7766',p);
        sfxPlay(SFX.boom,120,1.0);
        screenShake(0.04, 220); // ระเบิดแรงกว่า
        try{ SBAnalytics && SBAnalytics.event && SBAnalytics.event('bombHit'); }catch(_){}
        return;
      }

      // แตกกระจาย + จอสั่น
      explodeShardsAt(p, (spec.color||'#00d0ff'));
      screenShake(0.028, 160);

      hits++; combo++; onComboChanged();
      var add = Math.round((spec.score||10) * scoringMul());
      score += add;
      if(goalActive && goalType==='hits') goalProgressHits++;
      updateHUD();
      floatText('HIT +'+add,(spec.color||'#00d0ff'),p);
      sfxPlay(SFX.slash,120,1.0);
      bossDamage(spec.dmg||10, p);
      resetIgnore('pad');
      try{ SBAnalytics && SBAnalytics.event && SBAnalytics.event('padHit'); }catch(_){}
    }
    el.addEventListener('click', onClick);
    el.addEventListener('mousedown', onClick);
  }

  // ------------------ Boss flow ------------------
  function enterPhase2(){ BOSS.phase=2; setPhase(2); }
  function onBossDefeated(){
    bossDown = true;
    BOSS.active=false; floatText('BOSS DEFEATED','#00ffa3', new THREE.Vector3(0,1.6,-2.4));
    score+=250; updateHUD();
    bossIndex++;
    if (bossIndex < BOSSES.length){ setTimeout(function(){ spawnBossByIndex(bossIndex); }, 900); }
    else { requestEnd(); }
  }
  function spawnBossByIndex(i){
    if (i >= BOSSES.length) { requestEnd(); return; }
    var cfg = BOSSES[i];
    BOSS.active=true; BOSS.busy=false; BOSS.phase=1;
    BOSS.name  = cfg.title;
    BOSS.color = cfg.color;
    BOSS.max   = Math.round(cfg.baseHP * DIFF.bossHP);
    BOSS.hp    = BOSS.max;
    bossIntro();
    setBossNameLabel(BOSS.name||'BOSS');
    try{ SBAnalytics && SBAnalytics.onBoss && SBAnalytics.onBoss(BOSS.name); }catch(_){}
    setTimeout(scheduleNext, 700);
  }

  // ------------------ Tutorial-first-play ------------------
  function hasSeenTutorial(){ try{ return !!localStorage.getItem('sb_tut_done'); }catch(_){ return false; } }
  function markTutorialDone(){ try{ localStorage.setItem('sb_tut_done','1'); }catch(_){ } }

  function runTutorialThenCountdown(){
    var tut=byId('sbTut'); if(!tut){ doCountdownAndPlay(); return; }
    tut.style.display='flex';
    var arena = byId('arena');
    var hitCount = 0, demoEl=null;

    function spawnDemoPad(){
      safeRemove(demoEl);
      demoEl = document.createElement('a-entity');
      demoEl.classList.add('clickable');
      demoEl.setAttribute('geometry','primitive: circle; radius: 0.28; segments: 24');
      demoEl.setAttribute('material','color:#00ffa3; opacity:0.95; transparent:true;');
      demoEl.setAttribute('position','0 1.3 -2.2');
      arena.appendChild(demoEl);
      var collider=document.createElement('a-entity');
      collider.setAttribute('geometry','primitive: circle; radius: 0.36; segments: 24');
      collider.setAttribute('material','color:#fff; opacity:0.001; transparent:true');
      collider.classList.add('clickable');
      demoEl.appendChild(collider);
      function onHit(){
        hitCount++;
        floatText('OK','#00ffa3', demoEl.object3D.getWorldPosition(new THREE.Vector3()));
        sfxPlay(SFX.success,120,1);
        safeRemove(demoEl);
        if(hitCount>=3){ finish(); } else { setTimeout(spawnDemoPad, 300); }
      }
      demoEl.addEventListener('click', onHit);
      demoEl.addEventListener('mousedown', onHit);
      collider.addEventListener('click', function(){ demoEl.emit('click'); });
      collider.addEventListener('mousedown', function(){ demoEl.emit('click'); });
    }

    function finish(){
      markTutorialDone();
      tut.style.display='none';
      doCountdownAndPlay();
    }

    byId('sbTutStart').onclick = function(){ spawnDemoPad(); };
    byId('sbTutSkip').onclick  = function(){ markTutorialDone(); tut.style.display='none'; doCountdownAndPlay(); };
  }

  // ------------------ Count-down ------------------
  function doCountdownAndPlay(){
    var cd=byId('sbCountdown'), num=byId('sbCountdownNum');
    if(!cd || !num){ actuallyStartPlay(); return; }
    starting=true;
    cd.style.display='flex';
    var n=5; num.textContent = n;
    function tick(){
      if(n<=0){ cd.style.display='none'; starting=false; actuallyStartPlay(); return; }
      num.textContent = n;
      sfxPlay(SFX.ui,140,1);
      n--;
      setTimeout(tick, 1000);
    }
    setTimeout(tick, 0);
  }

  // ------------------ Game flow ------------------
  function clearArena(){ var a=byId('arena'); if(!a) return; var kids=a.children; var arr=[]; for(var i=0;i<kids.length;i++) arr.push(kids[i]); arr.forEach(function(c){ safeRemove(c); }); }

  function start(){
    if(running || starting) return;
    applyDifficulty();
    timeLeft = clamp(DIFF.matchSec|0, 60, 120);
    updateHUD();
    if(!hasSeenTutorial()){ runTutorialThenCountdown(); }
    else { doCountdownAndPlay(); }
  }

  function actuallyStartPlay(){
    if(running) return;
    running=true; paused=false;
    window.__sbStartT = performance.now();
    startTimeMs = performance.now();
    score=0; combo=0; maxCombo=0; hits=0; spawns=0; feverUntil=0; bossDown=false;
    softEnding=false; clearTimeout(softEndTO);
    goalActive=false; clearTimeout(goalTO);

    byId('results').style.display='none';
    updateHUD(); bossShowUI(false); clearArena();

    bossIndex = 0; // เริ่มที่บอสตัวแรก
    // Analytics start hook
    try{
      var diffKeyNow = getDiffKey();
      SBAnalytics && SBAnalytics.onStart && SBAnalytics.onStart({diffKey: diffKeyNow, bossName: BOSSES[0].title});
    }catch(_){}
    spawnBossByIndex(bossIndex);

    clearInterval(timer);
    timer = setInterval(function(){
      if(!running) return;
      timeLeft--; byId('time').textContent=timeLeft;
      trySpawnMicroGoal(); updateHUD();
      if(timeLeft<=0) requestEnd();
    },1000);

    function tickSpawn(){
      if(!running || paused) return;
      spawnPad();
      var next = nextPadInterval();
      padTimer = setTimeout(tickSpawn, next);
    }
    clearTimeout(padTimer); tickSpawn();

    clearInterval(coachHypeTimer);
    coachHypeTimer = setInterval(function(){
      if(!running) return;
      if(Math.random()<0.5){
        var msgs=['สุดยอด!','ดีมาก!','จังหวะมาแล้ว!','ต่อเนื่องไว้!','เก่งมาก!'];
        var m = msgs[Math.floor(Math.random()*msgs.length)];
        var t=byId('coachTip');
        if(!t){
          t=document.createElement('div'); t.id='coachTip';
          Object.assign(t.style,{position:'fixed',left:'12px',bottom:'56px',zIndex:9999,
            background:'rgba(0,0,0,.65)',color:'#e6f7ff',padding:'6px 10px',borderRadius:'10px',font:'600 12px system-ui'});
          document.body.appendChild(t);
        }
        t.textContent='Coach: '+m; t.style.opacity='1';
        setTimeout(function(){ t.style.opacity='0'; },1500);
      }
    }, 12000);
  }

  // Micro-goals
  function trySpawnMicroGoal(){
    if(goalActive) return;
    var elapsed = (performance.now()-startTimeMs)/1000;
    if(elapsed < 15) return;
    if(performance.now() - lastGoalStart < 28000) return;

    goalActive=true;
    lastGoalStart = performance.now();
    goalEndsAt    = performance.now() + 10000;
    goalType = (Math.random()<0.55) ? 'points' : 'hits';
    if(goalType==='points'){
      var base = (getDiffKey()==='easy') ? 40 : 60;
      goalTarget = base + Math.floor(Math.random()*25);
      goalBaselineScore = score;
    }else{
      goalTarget = (getDiffKey()==='easy') ? 4 : 6;
      goalProgressHits = 0;
    }
    updateMicroGoalHUD();

    clearTimeout(goalTO);
    goalTO = setTimeout(function(){
      var success=false;
      if(goalType==='points'){ success = (score - goalBaselineScore) >= goalTarget; }
      else{ success = (goalProgressHits >= goalTarget); }
      var box=byId('microGoal');
      if(success){ score += 50; updateHUD(); if(box){ box.style.background='rgba(7,32,20,.9)'; box.style.borderColor='#2a5'; } sfxPlay(SFX.success,150,1); }
      else{ if(box){ box.style.background='rgba(32,10,10,.9)'; box.style.borderColor='#522'; } sfxPlay(SFX.miss,150,1); }
      setTimeout(function(){ goalActive=false; if(box){ box.style.display='none'; box.style.background='rgba(8,14,22,.85)'; box.style.borderColor='#234'; } }, 900);
    }, 10000);
  }

  // ดาว 5 ระดับ
  function computeStars(){
    var s = 0;
    if(bossDown) s += 1;
    if(maxCombo >= 15) s += 1;
    if(maxCombo >= 30) s += 1;
    if(score >= 300) s += 1;
    if(timeLeft >= 10) s += 1;
    return clamp(s,0,5);
  }

  // Soft-end
  function requestEnd(){
    if(!running) return;
    if(softEnding) return;
    softEnding=true;
    try{ clearTimeout(padTimer); }catch(_){}
    try{ clearTimeout(window.__sbNextTO); }catch(_){}
    try{ cancelAnimationFrame(window.__sbRaf); }catch(_){}
    softEndTO = setTimeout(finalizeEnd, 1000);
  }

  function finalizeEnd(){
    if(!running) return;
    running=false; paused=false;
    try{ clearInterval(timer); }catch(_){}
    try{ clearTimeout(padTimer); }catch(_){}
    try{ clearTimeout(window.__sbNextTO); }catch(_){}
    try{ cancelAnimationFrame(window.__sbRaf); }catch(_){}
    try{ clearInterval(coachHypeTimer); }catch(_){}
    bossShowUI(false);

    var acc = maxCombo>0 ? Math.min(100, Math.round((hits/(hits+_ignoreStreak.ring+_ignoreStreak.blade+_ignoreStreak.core+_ignoreStreak.pad+1))*100)) : 0;
    byId('rScore').textContent = Math.round(score);
    byId('rMaxCombo').textContent = maxCombo;
    byId('rAcc').textContent = acc + '%';

    var stars = computeStars();
    var rStars = byId('rStars'); if(rStars){ rStars.textContent = Array(stars+1).join('★') + Array(5 - stars + 1).join('☆'); }
    var rBoss = byId('rBoss');  if(rBoss) rBoss.textContent = BOSS.name || '—';
    var rDiff = byId('rDiff');  if(rDiff) rDiff.textContent = (DIFF.title || 'NORMAL');

    if(FX.richResults){
      var extra = byId('rExtra');
      if(!extra){ extra = document.createElement('div'); extra.id='rExtra'; extra.style.marginTop='8px'; var card=byId('results'); if(card){ var cardC=card.querySelector('.card'); if(cardC) cardC.appendChild(extra);} }
      if(extra){ extra.innerHTML = 'Time Left: <b>'+Math.max(0,timeLeft)+'s</b>'; }
    }

    byId('results').style.display='flex';
    sfxPlay(SFX.ui,140,1);

    // Analytics end hook
    try{
      SBAnalytics && SBAnalytics.onEnd && SBAnalytics.onEnd({
        score: Math.round(score),
        combo: maxCombo,
        stars: stars,
        cleared: !!bossDown
      });
    }catch(_){}
  }

  function bankNow(){
    var add=Math.floor(combo*3);
    score+=add; combo=0; updateHUD();
    try{ SBAnalytics && SBAnalytics.event && SBAnalytics.event('bank'); }catch(_){}
  }

  // ------------------ Mouse raycast fallback ------------------
  (function pointerRaycast(){
    var sceneEl = document.querySelector('a-scene'); if(!sceneEl) return;
    var raycaster = new THREE.Raycaster();
    var mouse = new THREE.Vector2();
    function pick(clientX, clientY){
      var cam = sceneEl.camera; if(!cam) return;
      mouse.x =  (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, cam);
      if(FX.pointerHitBoost){ raycaster.far = 100; }
      var clickables = document.querySelectorAll('.clickable');
      var objs=[], i;
      for(i=0;i<clickables.length;i++){
        var o = clickables[i].object3D; if(!o) continue;
        o.traverse(function(c){ objs.push(c); });
      }
      var hitsR = raycaster.intersectObjects(objs,true);
      if(hitsR && hitsR.length){
        var obj=hitsR[0].object;
        while(obj && !obj.el) obj=obj.parent;
        if(obj && obj.el){ obj.el.emit('click'); }
      }
    }
    window.addEventListener('mousedown', function(e){ pick(e.clientX,e.clientY); }, {passive:true});
    window.addEventListener('touchstart', function(e){ var t=e.touches && e.touches[0]; if(t) pick(t.clientX,t.clientY); }, {passive:true});
  })();

  // ------------------ Wire Buttons ------------------
  function wire(){
    var startBtn = byId('startBtn');
    if(startBtn) startBtn.addEventListener('click', start);
    var replayBtn = byId('replayBtn');
    if(replayBtn) replayBtn.addEventListener('click', function(){ byId('results').style.display='none'; start(); });
    var pauseBtn = byId('pauseBtn');
    if(pauseBtn){
      pauseBtn.addEventListener('click', function(){
        if(!running) return;
        paused=!paused;
        if(paused){
          clearInterval(timer);
          try{ cancelAnimationFrame(window.__sbRaf); }catch(_){}
          try{ clearTimeout(padTimer); }catch(_){}
        }else{
          timer = setInterval(function(){
            timeLeft--; byId('time').textContent=timeLeft; trySpawnMicroGoal(); updateHUD(); if(timeLeft<=0) requestEnd();
          },1000);
          var next = nextPadInterval();
          padTimer = setTimeout(function tick(){
            if(!running||paused) return;
            spawnPad(); padTimer=setTimeout(tick,nextPadInterval());
          }, next);
        }
      });
    }
    var bankBtn = byId('bankBtn');
    if(bankBtn) bankBtn.addEventListener('click', bankNow);
    var backBtn = byId('backBtn');
    if(backBtn) backBtn.addEventListener('click', function(){ location.href = HUB_URL; });
    var enterVRBtn = byId('enterVRBtn');
    if(enterVRBtn) enterVRBtn.addEventListener('click', function(){ try{ var sc=document.querySelector('a-scene'); if(sc && sc.enterVR) sc.enterVR(); }catch(_){ } });

    addEventListener('keydown', function(ev){
      if(ev.code==='Space'){
        ev.preventDefault();
        if(!running && !starting) start();
        else if(running && pauseBtn){ pauseBtn.click(); }
      }
      if(ev.code==='Escape'){ requestEnd(); }
      if(ev.key==='`'){ var d=byId('debug'); if(d) d.style.display = (d.style.display==='none'?'block':'none'); }
    });
  }

  function boot(){ wire(); updateHUD(); applyHudToggles(); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', boot); }
  else { boot(); }

  if(FX.safetyCleanup){
    window.addEventListener('beforeunload', function(){
      try{ clearInterval(timer); }catch(_){}
      try{ clearTimeout(padTimer); }catch(_){}
      try{ clearTimeout(window.__sbNextTO); }catch(_){}
      try{ cancelAnimationFrame(window.__sbRaf); }catch(_){}
      try{ clearInterval(coachHypeTimer); }catch(_){}
      try{ clearTimeout(softEndTO); }catch(_){}
      try{ clearTimeout(goalTO); }catch(_){}
    });
  }

  /* ===== How to Play (Quick) ===== */
  (function installHowTo(){
    var style = document.createElement('style');
    style.textContent = ''+
    '#sbHelpBtn{position:fixed;left:160px;bottom:12px;z-index:9999;padding:8px 12px;border-radius:10px;border:0;background:#123047;color:#e6f7ff;font:600 12px system-ui;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)}'+
    '#sbHelpBtn:hover{filter:brightness(1.1)}'+
    '#sbHowTo{position:fixed;inset:0;z-index:99998;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.65)}'+
    '#sbHowTo .card{width:min(820px,92vw);max-height:86vh;overflow:auto;background:#0b1118;border:1px solid #213546;border-radius:14px;padding:16px 18px;color:#e6f7ff;box-shadow:0 10px 30px rgba(0,0,0,.45)}'+
    '#sbHowTo h2{margin:0 0 8px;font:800 18px/1.2 system-ui;letter-spacing:.3px}'+
    '#sbHowTo p,#sbHowTo li{font:500 13px/1.5 system-ui;color:#d9f3ff}'+
    '#sbHowTo .cta{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}'+
    '#sbHowTo .btn{padding:8px 12px;border-radius:10px;border:0;font:700 12px system-ui;cursor:pointer}'+
    '#sbHowTo .btn.primary{background:#0e2233;color:#e6f7ff}'+
    '#sbHowTo .btn.ghost{background:transparent;color:#a8cfe6;border:1px solid #2a465c}';
    document.head.appendChild(style);

    var btn = document.createElement('button');
    btn.id = 'sbHelpBtn'; btn.type='button'; btn.textContent='❓ How to Play';
    document.body.appendChild(btn);

    var wrap = document.createElement('section');
    wrap.id = 'sbHowTo';
    wrap.innerHTML = ''+
      '<div class="card" role="dialog" aria-labelledby="sbHowToTitle" aria-modal="true">'+
      '  <h2 id="sbHowToTitle">วิธีการเล่น · Shadow Breaker</h2>'+
      '  <ul>'+
      '    <li>ชกเป้าหลากรูปทรงเพื่อลด HP บอส • เลี่ยง Bomb (รีเซ็ตคอมโบ)</li>'+
      '    <li>Space = Start/Pause, Esc = End, B = Bank</li>'+
      '    <li>คอมโบถึงเกณฑ์ = Fever x1.5 • มี Cheer SFX ที่ 10/20/30</li>'+
      '  </ul>'+
      '  <div class="cta">'+
      '    <button class="btn ghost" id="sbHowToClose">Close</button>'+
      '    <button class="btn primary" id="sbHowToStart">Start Now</button>'+
      '  </div>'+
      '</div>';
    document.body.appendChild(wrap);

    function openHowTo(){ wrap.style.display = 'flex'; }
    function closeHowTo(){ wrap.style.display = 'none'; }

    btn.addEventListener('click', openHowTo);
    wrap.addEventListener('click', function(e){ if(e.target===wrap) closeHowTo(); });
    wrap.querySelector('#sbHowToClose').addEventListener('click', closeHowTo);
    wrap.querySelector('#sbHowToStart').addEventListener('click', function(){ closeHowTo(); var s=byId('startBtn'); if(s) s.click(); });

    try{
      var KEY='sb_seenHowTo_v1';
      if(!localStorage.getItem(KEY)){
        setTimeout(openHowTo, 300);
        localStorage.setItem(KEY,'1');
      }
    }catch(_){}
  })();

  /* ===== Difficulty Dock (Easy / Normal / Hard / Final) ===== */
  (function installDifficultyDock(){
    if (document.getElementById('sbDiffDock')) return;
    function getQ2(k){ return new URLSearchParams(location.search).get(k); }
    var DIFF_KEYS = { easy:1, normal:1, hard:1, final:1 };
    var current = getQ2('diff') ||
      (function(){ try{return localStorage.getItem('sb_diff');}catch(_){ return null; } })() ||
      ((window.APP && APP.story && APP.story.difficulty) ? APP.story.difficulty : null) ||
      'normal';
    var picked = DIFF_KEYS[current] ? current : 'normal';

    var style = document.createElement('style');
    style.textContent = ''+
      '#sbDiffDock{position:fixed;right:12px;bottom:12px;z-index:99999;display:flex;align-items:center;gap:8px;background:rgba(10,16,24,.78);backdrop-filter:saturate(1.1) blur(4px);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:8px 10px;color:#e6f7ff;font:600 12px system-ui;}'+
      '#sbDiffSel{appearance:none;background:#0e2233;color:#e6f7ff;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:6px 28px 6px 10px;font:600 12px system-ui;cursor:pointer;}'+
      '.chev{margin-left:-22px;pointer-events:none;user-select:none;}';
    document.head.appendChild(style);

    var dock = document.createElement('div');
    dock.id = 'sbDiffDock';
    dock.innerHTML = ''+
      '<label for="sbDiffSel" title="เลือกความยาก (Alt+D)">Difficulty</label>'+
      '<select id="sbDiffSel" aria-label="Difficulty">'+
      '  <option value="easy">Easy</option>'+
      '  <option value="normal">Normal</option>'+
      '  <option value="hard">Hard</option>'+
      '  <option value="final">Final</option>'+
      '</select>'+
      '<span class="chev">▼</span>';
    document.body.appendChild(dock);

    var sel = dock.querySelector('#sbDiffSel');
    sel.value = picked;

    sel.addEventListener('change', function(e){
      var v = e.target.value;
      try{ localStorage.setItem('sb_diff', v); }catch(_){}
      try{ if(window.APP){ APP.story = APP.story || {}; APP.story.difficulty = v; } }catch(_){}
      var url = new URL(location.href);
      url.searchParams.set('diff', v);
      location.href = url.pathname + '?' + url.searchParams.toString();
    }, { passive:true });

    document.addEventListener('keydown', function(ev){
      if ((ev.altKey || ev.metaKey) && (ev.key==='d' || ev.key==='D')){ sel.focus(); }
    });
  })();

})(); 

/* ===== SB Analytics & Profile (drop-in, hooks wired) ===== */
(function(){
  if (window.SBAnalytics) return;

  var LS_KEY = 'sb_profile_v1';
  var LS_RUN = 'sb_recent_runs_v1';
  var MAX_RECENT = 15;

  function nowISO(){ return new Date().toISOString(); }
  function loadJSON(k, fallback){
    try{ var s=localStorage.getItem(k); return s? JSON.parse(s): fallback; }catch(_){ return fallback; }
  }
  function saveJSON(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} }

  function blankProfile(){
    return {
      version:1,
      created: nowISO(),
      lastPlayed: null,
      plays: 0,
      clears: 0,
      timePlayedSec: 0,
      bestScore: 0,
      bestCombo: 0,
      bestStars: 0,
      bestByDiff: {
        easy:   {score:0, combo:0, stars:0},
        normal: {score:0, combo:0, stars:0},
        hard:   {score:0, combo:0, stars:0},
        final:  {score:0, combo:0, stars:0}
      },
      bossClears: { RAZORFIST:0, 'ASH ONI':0, NIGHTBLADE:0, 'VOID EMPEROR':0 },
      totals: { bankPresses:0, padHits:0, bombHits:0 }
    };
  }
  function ensureProfile(){
    var p = loadJSON(LS_KEY, null);
    if(!p){ p=blankProfile(); saveJSON(LS_KEY,p); }
    p.bestByDiff = p.bestByDiff || blankProfile().bestByDiff;
    p.bossClears = p.bossClears || blankProfile().bossClears;
    p.totals     = p.totals     || blankProfile().totals;
    return p;
  }
  function updateBests(p, diffKey, score, combo, stars){
    if (score > p.bestScore) p.bestScore = score;
    if (combo > p.bestCombo) p.bestCombo = combo;
    if (stars > p.bestStars) p.bestStars = stars;
    var slot = p.bestByDiff[diffKey] || (p.bestByDiff[diffKey]={score:0,combo:0,stars:0});
    if (score > slot.score) slot.score = score;
    if (combo > slot.combo) slot.combo = combo;
    if (stars > slot.stars) slot.stars = stars;
  }

  var RUN = { startedAt:null, diffKey:'normal', bossName:null, cleared:false, score:0, combo:0, stars:0, duration:0 };

  function recordRunEnd(){
    var p = ensureProfile();
    p.lastPlayed = nowISO();
    p.plays += 1;
    if (RUN.cleared && RUN.bossName) {
      p.clears += 1;
      p.bossClears[RUN.bossName] = (p.bossClears[RUN.bossName]||0) + 1;
    }
    if (RUN.startedAt){ RUN.duration = Math.max(0, Math.round((Date.now()-RUN.startedAt)/1000)); p.timePlayedSec += RUN.duration; }
    updateBests(p, RUN.diffKey, RUN.score|0, RUN.combo|0, RUN.stars|0);
    saveJSON(LS_KEY, p);

    var rec = loadJSON(LS_RUN, []);
    rec.unshift({ t: nowISO(), diff: RUN.diffKey, boss: RUN.bossName||'—', cleared: !!RUN.cleared, score: RUN.score|0, combo: RUN.combo|0, stars: RUN.stars|0, dur: RUN.duration|0 });
    if(rec.length>MAX_RECENT) rec.length=MAX_RECENT;
    saveJSON(LS_RUN, rec);
  }

  window.SBAnalytics = {
    onStart: function(o){ o=o||{}; RUN.startedAt=Date.now(); RUN.diffKey=o.diffKey||'normal'; RUN.bossName=o.bossName||RUN.bossName; RUN.cleared=false; RUN.score=0; RUN.combo=0; RUN.stars=0; RUN.duration=0; },
    onBoss:  function(name){ RUN.bossName=name||RUN.bossName; },
    onEnd:   function(o){ o=o||{}; if(typeof o.score==='number') RUN.score=o.score; if(typeof o.combo==='number') RUN.combo=o.combo; if(typeof o.stars==='number') RUN.stars=o.stars; RUN.cleared=!!o.cleared; recordRunEnd(); },
    event:   function(type,payload){ payload=payload||{}; var p=ensureProfile(); if(type==='bank') p.totals.bankPresses++; if(type==='padHit') p.totals.padHits++; if(type==='bombHit') p.totals.bombHits++; saveJSON(LS_KEY,p); if(type==='combo' && payload.value && (payload.value===10||payload.value===20||payload.value===30)){ try{ window.APP && APP.badge && APP.badge('CHEER! Combo '+payload.value); }catch(_){}} },
    getProfile: function(){ return ensureProfile(); },
    resetProfile: function(){ try{ localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_RUN); }catch(_){} },
    recent: function(){ return loadJSON(LS_RUN, []); }
  };

  // ---- Stats UI (ปุ่ม 📊) ----
  (function(){
    var css = ''+
      '#sbStatsBtn{position:fixed;left:260px;bottom:12px;z-index:9999;padding:8px 12px;border-radius:10px;border:0;background:#0f2536;color:#e6f7ff;font:700 12px system-ui;cursor:pointer}'+
      '#sbStats{position:fixed;inset:0;z-index:99998;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6)}'+
      '#sbStats .card{width:min(900px,94vw);max-height:85vh;overflow:auto;background:#0b1118;border:1px solid #213546;border-radius:14px;padding:16px;color:#e6f7ff;box-shadow:0 10px 30px rgba(0,0,0,.45)}'+
      '#sbStats h2{margin:0 0 8px;font:800 18px/1.2 system-ui}'+
      '#sbStats table{width:100%;border-collapse:collapse;margin-top:8px}'+
      '#sbStats th,#sbStats td{border-bottom:1px solid #1c3142;padding:6px 8px;font:600 12px system-ui}'+
      '#sbStats .row{display:flex;gap:14px;flex-wrap:wrap}'+
      '#sbStats .box{flex:1 1 260px;padding:10px;border:1px solid #213546;border-radius:10px;background:#0f1722}'+
      '#sbStats .cta{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}'+
      '#sbStats .btn{padding:8px 12px;border-radius:10px;border:0;font:700 12px system-ui;cursor:pointer}'+
      '#sbStats .btn.primary{background:#0e2233;color:#e6f7ff}'+
      '#sbStats .btn.warn{background:#3b0a0a;color:#ffdcdc}'+
      '#sbStats textarea{width:100%;min-height:120px;background:#0b1118;color:#d9f3ff;border:1px solid #213546;border-radius:10px;padding:8px;font:600 12px/1.4 ui-monospace,Consolas,monospace}'+
      '@media (max-width:720px){ #sbStatsBtn{left:12px;bottom:96px} }';
    var style = document.createElement('style'); style.textContent=css; document.head.appendChild(style);

    var btn = document.createElement('button'); btn.id='sbStatsBtn'; btn.textContent='📊 Stats'; document.body.appendChild(btn);
    var wrap = document.createElement('section'); wrap.id='sbStats'; wrap.innerHTML = ''+
      '<div class="card">'+
      '  <h2>สถิติ & โปรไฟล์ผู้เล่น</h2>'+
      '  <div class="row" id="sbStatsSummary"></div>'+
      '  <h3 style="margin:10px 0 4px">Recent Runs</h3>'+
      '  <table id="sbStatsRecent"><thead><tr><th>เวลา</th><th>โหมด</th><th>บอส</th><th>เคลียร์</th><th>สกอร์</th><th>คอมโบ</th><th>★</th><th>ระยะเวลา</th></tr></thead><tbody></tbody></table>'+
      '  <h3 style="margin:10px 0 4px">Export / Import</h3>'+
      '  <textarea id="sbExportBox" placeholder="โปรไฟล์จะปรากฏที่นี่…"></textarea>'+
      '  <div class="cta">'+
      '    <button class="btn primary" id="sbDoExport">Export</button>'+
      '    <button class="btn primary" id="sbDoImport">Import</button>'+
      '    <button class="btn warn" id="sbReset">Reset Profile</button>'+
      '    <button class="btn" id="sbClose">Close</button>'+
      '  </div>'+
      '</div>';
    document.body.appendChild(wrap);

    function render(){
      var p = SBAnalytics.getProfile();
      var r = SBAnalytics.recent();
      var sum = document.getElementById('sbStatsSummary');
      sum.innerHTML = ''+
        '<div class="box"><b>เล่นทั้งหมด</b><div>'+p.plays+'</div></div>'+
        '<div class="box"><b>เคลียร์</b><div>'+p.clears+'</div></div>'+
        '<div class="box"><b>เวลารวม</b><div>'+Math.round(p.timePlayedSec/60)+' นาที</div></div>'+
        '<div class="box"><b>Best Score</b><div>'+p.bestScore+'</div></div>'+
        '<div class="box"><b>Best Combo</b><div>'+p.bestCombo+'</div></div>'+
        '<div class="box"><b>Best Stars</b><div>'+p.bestStars+' ★</div></div>'+
        '<div class="box"><b>Bank ทั้งหมด</b><div>'+p.totals.bankPresses+'</div></div>'+
        '<div class="box"><b>Pad Hits</b><div>'+p.totals.padHits+'</div></div>'+
        '<div class="box"><b>Bomb Hits</b><div>'+p.totals.bombHits+'</div></div>';
      var tb = document.querySelector('#sbStatsRecent tbody');
      tb.innerHTML = r.map(function(x){
        var dt = (x.t||'').split('T'); var d=dt[0]||'', tt=(dt[1]||'').slice(0,8);
        return '<tr>'+
          '<td>'+d+' '+tt+'</td>'+
          '<td>'+x.diff+'</td>'+
          '<td>'+x.boss+'</td>'+
          '<td>'+(x.cleared?'✓':'')+'</td>'+
          '<td>'+x.score+'</td>'+
          '<td>'+x.combo+'</td>'+
          '<td>'+x.stars+'</td>'+
          '<td>'+(x.dur||0)+'s</td>'+
        '</tr>';
      }).join('');
      document.getElementById('sbExportBox').value = JSON.stringify({profile:p, recent:r}, null, 2);
    }

    btn.onclick = function(){ render(); wrap.style.display='flex'; };
    wrap.addEventListener('click', function(e){ if(e.target===wrap) wrap.style.display='none'; });
    wrap.querySelector('#sbClose').onclick = function(){ wrap.style.display='none'; };
    wrap.querySelector('#sbDoExport').onclick = function(){ render(); };
    wrap.querySelector('#sbReset').onclick = function(){ SBAnalytics.resetProfile(); render(); };
    wrap.querySelector('#sbDoImport').onclick = function(){
      try{
        var obj = JSON.parse(document.getElementById('sbExportBox').value||'{}');
        if (obj.profile) localStorage.setItem(LS_KEY, JSON.stringify(obj.profile));
        if (obj.recent)  localStorage.setItem(LS_RUN, JSON.stringify(obj.recent));
        render();
      }catch(e){ alert('Import ไม่สำเร็จ: JSON ไม่ถูกต้อง'); }
    };
  })();

})();
