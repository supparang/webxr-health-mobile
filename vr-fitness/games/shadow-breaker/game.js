/* games/shadow-breaker/game.js
   Shadow Breaker (Classic feel kept) + Difficulty/Assist + Boss Names + Punch Pads + Coach Tips
   - ไม่หักคะแนนจากการ “ไม่กด”
   - Bomb = เมื่อ "กด" จะตัดคอมโบทันที (ไม่มีลดสกอร์)
   - ดาว 5 ระดับ (★ 0–5) ในสรุปผล
*/
(function(){
  "use strict";

  // ------------------ Helpers & Globals ------------------
  const byId   = (id)=>document.getElementById(id);
  const clamp  = (n,a,b)=>Math.max(a,Math.min(b,n));
  const HUB_URL   = "https://supparang.github.io/webxr-health-mobile/vr-fitness/";
  const ASSET_BASE= (document.querySelector('meta[name="asset-base"]')?.content || '').replace(/\/+$/,'');

  // Feature switches (เปิดทุกตัวตามที่ขอ)
  const FX = {
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

  function safeRemove(el){ try{
    if(!el) return;
    if(!el.isConnected && !el.parentNode) return;
    if(el.parentNode) el.parentNode.removeChild(el);
    else if(el.remove) el.remove();
  }catch(_e){} }

  // ------------------ SFX ------------------
  const SFX = {
    slash:     new Audio(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect:   new Audio(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss:      new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`),
    heavy:     new Audio(`${ASSET_BASE}/assets/sfx/heavy.wav`),
    combo:     new Audio(`${ASSET_BASE}/assets/sfx/combo.wav`),
    hp_hit:    new Audio(`${ASSET_BASE}/assets/sfx/hp_hit.wav`),
    boss_roar: new Audio(`${ASSET_BASE}/assets/sfx/boss_roar.wav`),
    tel_slash: new Audio(`${ASSET_BASE}/assets/sfx/tel_slash.wav`),
    tel_shock: new Audio(`${ASSET_BASE}/assets/sfx/tel_shock.wav`),
    success:   new Audio(`${ASSET_BASE}/assets/sfx/success.wav`),
    ui:        new Audio(`${ASSET_BASE}/assets/sfx/success.wav`),
    boom:      new Audio(`${ASSET_BASE}/assets/sfx/miss.wav`)
  };
  Object.values(SFX).forEach(a=>{ try{ a.preload='auto'; a.crossOrigin='anonymous'; }catch(_){} });

  const _sfxLastPlay = new Map();
  function playSfx(a, guardMs=120, vol=1){
    try{
      const now=performance.now();
      if(_sfxLastPlay.get(a) && now - _sfxLastPlay.get(a) < guardMs) return;
      _sfxLastPlay.set(a, now);
      a.volume = vol;
      a.currentTime=0; a.play();
    }catch(_){}
  }
  function sfxPlay(a, guard=120, vol=1){
    if(FX.sfxNormalize) playSfx(a,guard,vol);
    else try{ a.currentTime=0; a.play(); }catch(_){}
  }

  // ------------------ Difficulty & Assist ------------------
  function getQ(k){ return new URLSearchParams(location.search).get(k); }

  const DIFFS = {
    easy:   { bossHP:0.60, padSpawn:1.50, padLife:1.60, attackTime:1.45, feverAt:15, bombRate:0.00, delayScale:1.25, title:'EASY'   },
    normal: { bossHP:1.00, padSpawn:1.00, padLife:1.00, attackTime:1.00, feverAt:25, bombRate:0.12, delayScale:1.00, title:'NORMAL' },
    hard:   { bossHP:1.20, padSpawn:0.85, padLife:0.90, attackTime:0.90, feverAt:25, bombRate:0.18, delayScale:0.95, title:'HARD'   },
    final:  { bossHP:1.35, padSpawn:0.78, padLife:0.85, attackTime:0.85, feverAt:25, bombRate:0.22, delayScale:0.90, title:'FINAL'  }
  };
  let DIFF = DIFFS.normal;
  const ASSIST = (getQ('assist')==='1');

  function getDiffKey(){
    try{
      const q = getQ('diff');
      if (q && DIFFS[q]) return q;
      const ls = localStorage.getItem('sb_diff');
      if (ls && DIFFS[ls]) return ls;
    }catch(_){}
    return 'normal';
  }

  function applyDifficulty(){
    const key = getDiffKey();
    DIFF = DIFFS[key] || DIFFS.normal;

    // ปรับฐานของ Punch Pad
    padSpawnIntBase = Math.round(1500 * DIFF.padSpawn);
    padLifeBase     = Math.round(1200 * DIFF.padLife);

    // แสดงใน HUD (ถ้ามี)
    const rDiff = byId('rDiff');
    if (rDiff){
      rDiff.textContent = (DIFF.title||'NORMAL');
    }
  }

  // ปรับช่วงเวลาโจมตีบอส/แพทเทิร์น (ยืดบน Easy)
  function Tm(ms){
    let t = ms * DIFF.attackTime;
    if (ASSIST) t *= 1.15;
    return Math.round(t);
  }
  // ปรับดีเลย์ก่อนโจมตีถัดไป
  function nextDelayScale(ms){
    let t = ms * DIFF.delayScale;
    if (ASSIST) t *= 1.10;
    return Math.round(t);
  }

  // ------------------ State ------------------
  let running=false, paused=false;
  let timer=null;
  let padTimer=null;
  let coachHypeTimer=null;

  let score=0, combo=0, maxCombo=0, hits=0, spawns=0, timeLeft=60;
  let feverUntil = 0;
  let bossDown = false;  // สำหรับคำนวนดาว 5 ระดับ

  // Boss Roster (ชื่อบอส)
  const BOSSES = [
    { id:'RazorFist',   title:'RAZORFIST',   color:'#ff3355', baseHP:1000 },
    { id:'AshOni',      title:'ASH ONI',     color:'#ffa133', baseHP:1200 },
    { id:'Nightblade',  title:'NIGHTBLADE',  color:'#7a5cff', baseHP:1400 },
    { id:'VoidEmperor', title:'VOID EMPEROR',color:'#8cf5ff', baseHP:1800 }
  ];
  let bossIndex = 0;

  const BOSS = { active:false, busy:false, phase:1, hp:0, max:1000, name:'', color:'#ff3355' };

  function applyHudToggles(){
    if(FX.hudReadable || FX.accessibility){
      const hud = byId('hud');
      if(hud){ hud.style.font='600 15px system-ui'; hud.style.padding='8px 12px'; }
    }
    if(FX.accessibility){
      const bossBar=byId('bossBar'); if(bossBar){ bossBar.style.borderColor='#fff'; bossBar.style.background='#000'; }
    }
  }

  function scoringMul(){ return (FX.feverMode && performance.now()<feverUntil)? 1.5 : 1.0; }
  function onComboChanged(){
    if(FX.comboBadges && combo>0 && combo%10===0){
      try{ window.APP?.badge?.('Combo x'+(combo/10)); }catch(_){ console.log('Combo', combo); }
      sfxPlay(SFX.combo,150,0.9);
    }
    if(FX.feverMode && combo>= (DIFF.feverAt||25)){
      const oldFever = feverUntil;
      feverUntil = performance.now()+8000;
      if(performance.now()>oldFever){
        try{ window.APP?.badge?.('FEVER!'); }catch(_){}
      }
    }
    if(combo>maxCombo) maxCombo=combo;
  }

  const _ignoreStreak = { ring:0, blade:0, core:0, pad:0 };
  function coachTipOnce(kind){
    if(!FX.coachTips) return;
    _ignoreStreak[kind] = (_ignoreStreak[kind]||0) + 1;
    if(_ignoreStreak[kind]===3){
      const msg = kind==='ring' ? 'โฟกัสตอนวงแหวนขยายเกือบสุด'
               : kind==='blade' ? 'ดาบ: แตะทันทีหลังสัญญาณ'
               : kind==='core' ? 'เพชร: แตะทันทีเพื่อคอมโบ'
               : 'Pad: แตะภายในเวลาที่กำหนด';
      let t=byId('coachTip');
      if(!t){
        t=document.createElement('div'); t.id='coachTip';
        Object.assign(t.style,{position:'fixed',left:'12px',bottom:'56px',zIndex:9999,
          background:'rgba(0,0,0,.65)',color:'#e6f7ff',padding:'6px 10px',borderRadius:'10px',font:'600 12px system-ui'});
        document.body.appendChild(t);
      }
      t.textContent='Coach: '+msg; t.style.opacity='1';
      setTimeout(()=>{ t.style.opacity='0'; },1800);
    }
  }
  function resetIgnore(kind){ _ignoreStreak[kind]=0; }

  function floatText(text, color, pos){
    const e=document.createElement('a-entity'), p=pos.clone(); p.y+=0.2;
    e.setAttribute('text',{value:text,color,align:'center',width:2.6});
    e.setAttribute('position',`${p.x} ${p.y} ${p.z}`);
    e.setAttribute('scale','0.001 0.001 0.001');
    e.setAttribute('animation__in',{property:'scale',to:'1 1 1',dur:90,easing:'easeOutQuad'});
    e.setAttribute('animation__rise',{property:'position',to:`${p.x} ${p.y+0.6} ${p.z}`,dur:600,easing:'easeOutQuad'});
    e.setAttribute('animation__fade',{property:'opacity',
