'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN = window, DOC = document;
  const layer = DOC.getElementById('layer');
  if(!layer) throw new Error('Missing #layer');

  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();
  const safeJson = (o)=>{ try{ return JSON.stringify(o,null,2);}catch(e){return '{}';} };

  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','80'), 20, 300);
  const seedStr = String(cfg.seed || qs('seed', String(Date.now())));
  const pid = String(cfg.pid || qs('pid','anon')).trim()||'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));
  const cooldownRequired = !!cfg.cooldown || (qs('cooldown','0')==='1') || (qs('cd','0')==='1');

  function emojiFor(diffKey, phase, level=0){
    diffKey = String(diffKey||'normal').toLowerCase();
    const p = String(phase||'normal').toLowerCase();

    if(p==='storm'){
      if(diffKey==='easy') return '🌦️⚡';
      if(diffKey==='hard') return '🌪️⚡⚡⚡';
      return '🌩️⚡⚡';
    }
    if(p==='boss'){
      if(diffKey==='easy') return ['⛈️⚡','🌩️⚡','🌪️⚡'][Math.max(0,Math.min(2,level-1))];
      if(diffKey==='hard') return ['🌀🌩️⚡⚡','🌪️⚡⚡⚡','🌀🌪️⚡⚡⚡'][Math.max(0,Math.min(2,level-1))];
      return ['⛈️🌀⚡','🌩️⚡⚡','🌪️⚡⚡'][Math.max(0,Math.min(2,level-1))];
    }
    if(p==='final'){
      if(diffKey==='easy') return '🌩️👑⚡';
      if(diffKey==='hard') return '🌪️👑⚡⚡⚡🔥';
      return '🌪️👑⚡⚡';
    }
    return '💧';
  }

  function hhDayKey(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
  function cooldownDone(cat, game, pid){
    const day=hhDayKey();
    const kNew=`HHA_COOLDOWN_DONE:${cat}:${game}:${pid}:${day}`;
    const kOld=`HHA_COOLDOWN_DONE:${cat}:${pid}:${day}`;
    return (lsGet(kNew)==='1') || (lsGet(kOld)==='1');
  }
  function buildCooldownUrl({ hub, nextAfterCooldown, cat, gameKey, pid }){
    const gate = new URL('../warmup-gate.html', location.href);
    gate.searchParams.set('gatePhase','cooldown');
    gate.searchParams.set('cat', String(cat||'nutrition'));
    gate.searchParams.set('theme', String(gameKey||'hydration'));
    gate.searchParams.set('pid', String(pid||'anon'));
    if(hub) gate.searchParams.set('hub', String(hub));
    gate.searchParams.set('next', String(nextAfterCooldown || hub || '../hub.html'));
    return gate.toString();
  }

  function xmur3(str){
    str=String(str||'');
    let h=1779033703^str.length;
    for(let i=0;i<str.length;i++){
      h=Math.imul(h^str.charCodeAt(i),3432918353);
      h=(h<<13)|(h>>>19);
    }
    return function(){
      h=Math.imul(h^(h>>>16),2246822507);
      h=Math.imul(h^(h>>>13),3266489909);
      return (h^=(h>>>16))>>>0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a>>>=0;b>>>=0;c>>>=0;d>>>=0;
      let t=(a+b)|0;
      a=b^(b>>>9);
      b=(c+(c<<3))|0;
      c=(c<<21)|(c>>>11);
      d=(d+1)|0;
      t=(t+d)|0;
      c=(c+t)|0;
      return (t>>>0)/4294967296;
    };
  }
  function makeRng(seed){
    const s=xmur3(seed);
    return sfc32(s(),s(),s(),s());
  }
  const rng = makeRng(seedStr);
  const r01 = ()=> rng();
  const pick = (arr)=> arr[(r01()*arr.length)|0];

  const ui = {
    score: DOC.getElementById('uiScore'),
    time: DOC.getElementById('uiTime'),
    miss: DOC.getElementById('uiMiss'),
    expire: DOC.getElementById('uiExpire'),
    block: DOC.getElementById('uiBlock'),
    grade: DOC.getElementById('uiGrade'),
    water: DOC.getElementById('uiWater'),
    combo: DOC.getElementById('uiCombo'),
    shield: DOC.getElementById('uiShield'),
    phase: DOC.getElementById('uiPhase'),
    aiRisk: DOC.getElementById('aiRisk'),
    aiHint: DOC.getElementById('aiHint'),
    btnSfx: DOC.getElementById('btnSfx'),
    btnPause: DOC.getElementById('btnPause'),
    btnHelp: DOC.getElementById('btnHelp'),
    helpOverlay: DOC.getElementById('helpOverlay'),
    btnHelpStart: DOC.getElementById('btnHelpStart'),
    pauseOverlay: DOC.getElementById('pauseOverlay'),
    btnResume: DOC.getElementById('btnResume'),
    end: DOC.getElementById('end'),
    endTitle: DOC.getElementById('endTitle'),
    endSub: DOC.getElementById('endSub'),
    endGrade: DOC.getElementById('endGrade'),
    endScore: DOC.getElementById('endScore'),
    endMiss: DOC.getElementById('endMiss'),
    endWater: DOC.getElementById('endWater'),
    btnCopy: DOC.getElementById('btnCopy'),
    btnCopyEvents: DOC.getElementById('btnCopyEvents'),
    btnCopyTimeline: DOC.getElementById('btnCopyTimeline'),
    btnReplay: DOC.getElementById('btnReplay'),
    btnNextCooldown: DOC.getElementById('btnNextCooldown'),
    btnBackHub: DOC.getElementById('btnBackHub'),
    riskFill: DOC.getElementById('riskFill'),
    coachExplain: DOC.getElementById('coachExplain'),
  };

  const stageEl = DOC.getElementById('stage') || layer.parentElement;
  const zoneSign = DOC.getElementById('zoneSign');
  const btnZoneL = DOC.getElementById('btnZoneL');
  const btnZoneR = DOC.getElementById('btnZoneR');

  const SFX = (() => {
    let ctx = null, unlocked = false, enabled = true, volumeMul = 1.0;
    let last = new Map();
    try{
      const saved = localStorage.getItem('HHA_SFX_ENABLED');
      if(saved === '0') enabled = false;
    }catch(e){}
    function now(){ return (ctx && ctx.currentTime) ? ctx.currentTime : 0; }
    function ensure(){
      if(ctx) return ctx;
      const AC = WIN.AudioContext || WIN.webkitAudioContext;
      if(!AC) return null;
      ctx = new AC();
      return ctx;
    }
    async function unlock(){
      const c = ensure();
      if(!c) return;
      try{
        if(c.state === 'suspended') await c.resume();
        const o = c.createOscillator();
        const g = c.createGain();
        g.gain.value = 0.0001;
        o.connect(g); g.connect(c.destination);
        o.start();
        o.stop(c.currentTime + 0.01);
        unlocked = true;
      }catch(e){}
    }
    function setEnabled(v){
      enabled = !!v;
      try{ localStorage.setItem('HHA_SFX_ENABLED', enabled ? '1':'0'); }catch(e){}
    }
    function isEnabled(){ return enabled; }
    function setPhaseVolume(phase){
      if(phase==='storm') volumeMul = 0.95;
      else if(phase==='boss') volumeMul = 1.00;
      else if(phase==='final') volumeMul = 1.08;
      else volumeMul = 0.88;
    }
    function canPlay(key, minGapMs){
      if(!enabled) return false;
      const t = Date.now();
      const prev = last.get(key) || 0;
      if(t - prev < minGapMs) return false;
      last.set(key, t);
      return true;
    }
    function beep({f0=440, f1=440, dur=0.08, type='sine', vol=0.12, attack=0.004, release=0.06}){
      const c = ensure();
      if(!c || (!unlocked && c.state!=='running') || !enabled) return;
      const t0 = now();
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.linearRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol * volumeMul, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack + 0.001, dur + release));
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + dur + release + 0.02);
    }
    function noise({dur=0.14, vol=0.10, attack=0.002, release=0.12, hp=800}){
      const c = ensure();
      if(!c || (!unlocked && c.state!=='running') || !enabled) return;
      const t0 = now();
      const bufferSize = Math.max(1, Math.floor(c.sampleRate * dur));
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for(let i=0;i<bufferSize;i++) data[i] = (Math.random()*2 - 1) * (1 - i/bufferSize);
      const src = c.createBufferSource();
      src.buffer = buffer;
      const filter = c.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = hp;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol * volumeMul, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack + 0.001, dur + release));
      src.connect(filter); filter.connect(g); g.connect(c.destination);
      src.start(t0); src.stop(t0 + dur + release + 0.02);
    }
    function pop(){ if(canPlay('pop',30)) beep({ f0:720, f1:980, dur:0.06, type:'triangle', vol:0.10 }); }
    function shield(){ if(canPlay('shield',60)){ beep({ f0:520, f1:780, dur:0.08, type:'sine', vol:0.12 }); beep({ f0:880, f1:880, dur:0.04, type:'triangle', vol:0.08, attack:0.002, release:0.04 }); } }
    function bad(){ if(canPlay('bad',80)){ beep({ f0:220, f1:120, dur:0.12, type:'sawtooth', vol:0.10 }); noise({ dur:0.10, vol:0.06, hp:1200 }); } }
    function block(){ if(canPlay('block',70)) beep({ f0:360, f1:280, dur:0.08, type:'square', vol:0.08 }); }
    function thunder(){ if(canPlay('thunder',160)){ noise({ dur:0.18, vol:0.10, hp:400 }); beep({ f0:120, f1:70, dur:0.22, type:'sine', vol:0.10, attack:0.01, release:0.18 }); } }
    function phase(name){
      if(!canPlay('phase',260)) return;
      if(name==='storm'){
        beep({ f0:420, f1:560, dur:0.10, type:'triangle', vol:0.10 });
        noise({ dur:0.08, vol:0.05, hp:900 });
      }else if(name==='boss'){
        beep({ f0:300, f1:420, dur:0.12, type:'sawtooth', vol:0.09 });
        beep({ f0:520, f1:520, dur:0.08, type:'square', vol:0.06 });
      }else if(name==='final'){
        beep({ f0:360, f1:540, dur:0.14, type:'sawtooth', vol:0.10 });
        beep({ f0:720, f1:980, dur:0.10, type:'triangle', vol:0.08 });
        noise({ dur:0.10, vol:0.06, hp:700 });
      }
    }
    return { unlock, pop, shield, bad, block, thunder, phase, setEnabled, isEnabled, setPhaseVolume };
  })();

  const unlockOnce = (() => {
    let done=false;
    return async ()=>{
      if(done) return;
      done=true;
      await SFX.unlock();
      DOC.removeEventListener('pointerdown', unlockOnce, true);
      DOC.removeEventListener('touchstart', unlockOnce, true);
      DOC.removeEventListener('keydown', unlockOnce, true);
    };
  })();
  DOC.addEventListener('pointerdown', unlockOnce, true);
  DOC.addEventListener('touchstart', unlockOnce, true);
  DOC.addEventListener('keydown', unlockOnce, true);

  function refreshSfxBtn(){
    if(ui.btnSfx) ui.btnSfx.textContent = SFX.isEnabled() ? '🔊 SFX' : '🔇 SFX';
  }
  if(ui.btnSfx){
    refreshSfxBtn();
    ui.btnSfx.addEventListener('click', async (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      await SFX.unlock();
      SFX.setEnabled(!SFX.isEnabled());
      refreshSfxBtn();
    });
  }

  const TUNE = {
    spawnBase: diff==='easy' ? 0.66 : diff==='hard' ? 0.95 : 0.78,
    ttlGood: diff==='easy' ? 3.2 : diff==='hard' ? 2.5 : 2.9,
    ttlBad: diff==='easy' ? 3.2 : diff==='hard' ? 2.6 : 3.0,
    missLimit: diff==='easy' ? 8 : diff==='hard' ? 5 : 6,
    waterGain: diff==='easy' ? 8.5 : diff==='hard' ? 6.8 : 7.5,
    waterLoss: diff==='easy' ? 5.2 : diff==='hard' ? 7.0 : 6.0,
    shieldDrop: diff==='easy' ? 0.10 : diff==='hard' ? 0.18 : 0.14,

    stormSec: diff==='easy' ? 8 : diff==='hard' ? 12 : 10,
    stormSpawnMul: diff==='easy' ? 1.15 : diff==='hard' ? 1.40 : 1.25,
    stormBadP: diff==='easy' ? 0.34 : diff==='hard' ? 0.52 : 0.42,

    boss1NeedHits: diff==='easy' ? 8 : diff==='hard' ? 12 : 10,
    boss2NeedHits: diff==='easy' ? 10 : diff==='hard' ? 15 : 12,
    boss3NeedHits: diff==='easy' ? 12 : diff==='hard' ? 18 : 14,
    finalNeedHits: diff==='easy' ? 14 : diff==='hard' ? 20 : 16,

    boss1LightningRate: diff==='easy' ? 0.75 : diff==='hard' ? 1.10 : 0.90,
    boss2LightningRate: diff==='easy' ? 0.90 : diff==='hard' ? 1.30 : 1.05,
    boss3LightningRate: diff==='easy' ? 1.05 : diff==='hard' ? 1.55 : 1.20,
    finalLightningRate: diff==='easy' ? 1.20 : diff==='hard' ? 1.80 : 1.40,

    boss1SpawnMul: diff==='easy' ? 1.05 : diff==='hard' ? 1.20 : 1.10,
    boss2SpawnMul: diff==='easy' ? 1.12 : diff==='hard' ? 1.28 : 1.18,
    boss3SpawnMul: diff==='easy' ? 1.20 : diff==='hard' ? 1.36 : 1.26,
    finalSpawnMul: diff==='easy' ? 1.28 : diff==='hard' ? 1.48 : 1.34,

    boss1BadP: diff==='easy' ? 0.30 : diff==='hard' ? 0.42 : 0.36,
    boss2BadP: diff==='easy' ? 0.34 : diff==='hard' ? 0.48 : 0.40,
    boss3BadP: diff==='easy' ? 0.38 : diff==='hard' ? 0.54 : 0.45,
    finalBadP: diff==='easy' ? 0.42 : diff==='hard' ? 0.60 : 0.50,

    lightningDmgWater: diff==='easy' ? 5.5 : diff==='hard' ? 8.5 : 7.0,
    lightningDmgScore: diff==='easy' ? 4 : diff==='hard' ? 8 : 6,

    zoneChunkStorm: diff==='easy' ? 3.5 : diff==='hard' ? 2.7 : 3.1,
    zoneChunkBoss1: diff==='easy' ? 3.2 : diff==='hard' ? 2.5 : 2.9,
    zoneChunkBoss2: diff==='easy' ? 3.0 : diff==='hard' ? 2.3 : 2.7,
    zoneChunkBoss3: diff==='easy' ? 2.8 : diff==='hard' ? 2.0 : 2.4,
    zoneChunkFinal: diff==='easy' ? 2.6 : diff==='hard' ? 1.8 : 2.1
  };

  const phaseStats = {
    normal:{goodHit:0,badHit:0,goodExpire:0,block:0,lightningHit:0,lightningBlock:0},
    storm:{goodHit:0,badHit:0,goodExpire:0,block:0,lightningHit:0,lightningBlock:0},
    boss1:{goodHit:0,badHit:0,goodExpire:0,block:0,lightningHit:0,lightningBlock:0},
    boss2:{goodHit:0,badHit:0,goodExpire:0,block:0,lightningHit:0,lightningBlock:0},
    boss3:{goodHit:0,badHit:0,goodExpire:0,block:0,lightningHit:0,lightningBlock:0},
    final:{goodHit:0,badHit:0,goodExpire:0,block:0,lightningHit:0,lightningBlock:0},
  };
  const eventLog = [];
  const riskTimeline = [];
  function currentPhaseKey(){
    if(phase==='boss') return `boss${bossLevel}`;
    return phase;
  }
  function logEvent(type, data={}){
    const item = { ts: nowIso(), ms: nowMs(), type, phase: currentPhaseKey(), ...data };
    eventLog.push(item);
    try{ WIN.dispatchEvent(new CustomEvent('hha:event', { detail:item })); }catch(e){}
  }

  let playing=true, paused=false, helpOpen=true;
  let tLeft=plannedSec, lastTick=nowMs();
  let score=0, missBadHit=0, missGoodExpired=0, blockCount=0;
  let combo=0, bestCombo=0, shield=0, waterPct=30;
  let phase='normal', stormLeft=0, stormDone=false;
  let bossLevel=0, bossHits=0, bossGoal=0;
  let finalHits=0, finalGoal=0;
  let needZone='L', zoneT=0, aimX01=0.5;
  let lastTimelineAt = 0;

  function setStagePhase(p){
    stageEl?.classList?.toggle('is-storm', p==='storm');
    stageEl?.classList?.toggle('is-boss',  p==='boss');
    stageEl?.classList?.toggle('is-final', p==='final');
  }
  function isInNeededZone(){ return (needZone==='L') ? (aimX01 < 0.5) : (aimX01 >= 0.5); }
  function swapZone(){ needZone = (needZone==='L') ? 'R' : 'L'; }

  function updateAimFromEvent(ev){
    try{
      const r = layer.getBoundingClientRect();
      aimX01 = clamp((ev.clientX - r.left) / Math.max(1, r.width), 0, 1);
    }catch(e){}
  }
  layer.addEventListener('pointermove', (ev)=>{ updateAimFromEvent(ev); }, { passive:true });
  layer.addEventListener('pointerdown', (ev)=>{ updateAimFromEvent(ev); }, { passive:true });
  if(btnZoneL && btnZoneR){
    btnZoneL.onclick = ()=>{ aimX01 = 0.25; };
    btnZoneR.onclick = ()=>{ aimX01 = 0.75; };
  }

  function showHelp(){ helpOpen=true; paused=true; ui.helpOverlay?.setAttribute('aria-hidden','false'); }
  function hideHelp(){ helpOpen=false; ui.helpOverlay?.setAttribute('aria-hidden','true'); paused=false; lastTick=nowMs(); requestAnimationFrame(loop); }
  function showPause(){ paused=true; ui.pauseOverlay?.setAttribute('aria-hidden','false'); }
  function hidePause(){ ui.pauseOverlay?.setAttribute('aria-hidden','true'); paused=false; lastTick=nowMs(); requestAnimationFrame(loop); }

  if(ui.btnHelp) ui.btnHelp.onclick = showHelp;
  if(ui.btnHelpStart) ui.btnHelpStart.onclick = hideHelp;
  if(ui.btnPause) ui.btnPause.onclick = ()=> paused ? hidePause() : showPause();
  if(ui.btnResume) ui.btnResume.onclick = hidePause;

  function fxShake(){
    try{
      stageEl.classList.remove('fx-shake');
      void stageEl.offsetWidth;
      stageEl.classList.add('fx-shake');
      setTimeout(()=> stageEl.classList.remove('fx-shake'), 220);
    }catch(e){}
  }
  function fxRing(x,y){
    const el = DOC.createElement('div');
    el.className='fx-ring';
    el.style.left=`${x}px`;
    el.style.top=`${y}px`;
    layer.appendChild(el);
    setTimeout(()=>el.remove(), 520);
  }
  function fxScore(x,y,text){
    const el = DOC.createElement('div');
    el.className='fx-score';
    el.textContent=String(text||'');
    el.style.left=`${x}px`;
    el.style.top=`${y}px`;
    layer.appendChild(el);
    setTimeout(()=>el.remove(), 900);
  }
  function fxBubblePop(el, kind){
    el.classList.remove('fx-pop','fx-bad');
    void el.offsetWidth;
    el.classList.add(kind==='bad' ? 'fx-bad' : 'fx-pop');
  }
  function fxPhaseBanner(text){
    const r = layer.getBoundingClientRect();
    const cx = r.width/2;
    const cy = Math.max(120, Math.min(r.height*0.30, 260));
    fxRing(cx, cy);
    fxScore(cx, cy, text);
    fxShake();
  }

  function lightning(){
    SFX.thunder();
    const f = DOC.createElement('div');
    f.className='storm-flash';
    stageEl.appendChild(f);
    setTimeout(()=>f.remove(), 220);
    const b = DOC.createElement('div');
    b.className='bolt';
    b.style.left=`${10 + r01()*80}%`;
    b.style.transform=`translateX(-50%) rotate(${(r01()*18-9).toFixed(1)}deg)`;
    stageEl.appendChild(b);
    setTimeout(()=>b.remove(), 260);
  }

  let _hudBottom = 160;
  function measureHudBottom(){
    try{
      const rect = DOC.querySelector('.hud')?.getBoundingClientRect();
      if(rect && rect.height > 10) _hudBottom = Math.max(0, rect.bottom);
    }catch(e){}
  }
  measureHudBottom();
  WIN.addEventListener('resize', ()=>setTimeout(measureHudBottom, 120), { passive:true });
  WIN.addEventListener('orientationchange', ()=>setTimeout(measureHudBottom, 180), { passive:true });
  setInterval(measureHudBottom, 600);

  function safeSpawnXY(){
    const r=layer.getBoundingClientRect();
    const pad = (view==='mobile') ? 18 : 22;
    const gap = (view==='mobile') ? 14 : 12;
    const yMin = clamp((_hudBottom - r.top) + gap, pad + 10, r.height - 60);
    const bottomPad = (view==='mobile') ? 120 : 90;
    const x = pad + r01()*(Math.max(1, r.width - pad*2));
    const yMax = Math.max(yMin + 1, r.height - bottomPad);
    const y = yMin + r01()*(Math.max(1, yMax - yMin));
    return { x, y };
  }

  const bubbles = new Map();
  let idSeq=1;
  const GOOD = ['💧','💦','🫗'];
  const BAD  = ['🧋','🥤','🍟'];
  const SHLD = ['🛡️'];

  function makeBubble(kind, emoji, ttlSec){
    const id=String(idSeq++);
    const el=DOC.createElement('div');
    el.className='bubble';
    el.textContent=emoji;
    el.dataset.id=id;
    el.dataset.kind=kind;
    const p = safeSpawnXY();
    el.style.left=`${p.x}px`;
    el.style.top=`${p.y}px`;
    layer.appendChild(el);
    bubbles.set(id,{ id, el, kind, emoji, born:nowMs(), ttl:Math.max(0.9, ttlSec)*1000 });
    logEvent('spawn', { kind, x:p.x, y:p.y });
  }

  function removeBubble(id){
    const b=bubbles.get(String(id));
    if(!b) return;
    bubbles.delete(String(id));
    try{ b.el.remove(); }catch(e){}
  }

  function gradeText(){
    const played = Math.max(1, plannedSec - tLeft);
    const sps = score/played;
    const x = sps*10 - missBadHit*0.55 - missGoodExpired*0.08;
    if(x>=70) return 'S';
    if(x>=55) return 'A';
    if(x>=40) return 'B';
    if(x>=28) return 'C';
    return 'D';
  }

  function explainRisk(risk){
    const reasons = [];
    if(waterPct < 35) reasons.push('น้ำต่ำ');
    if(shield === 0 && (phase==='storm' || phase==='boss' || phase==='final')) reasons.push('ไม่มีโล่');
    if(missBadHit >= Math.max(2, Math.floor(TUNE.missLimit*0.4))) reasons.push('โดนของไม่ดีบ่อย');
    if(missGoodExpired >= 4) reasons.push('เก็บน้ำไม่ทัน');
    if((phase==='storm' || phase==='boss' || phase==='final') && !isInNeededZone()) reasons.push('อยู่ผิดฝั่ง');
    if(reasons.length===0){
      if(risk < 0.25) return 'ปลอดภัยดี เล่นต่อได้';
      if(risk < 0.5) return 'เสี่ยงปานกลาง ระวังจังหวะ';
      return 'เริ่มเสี่ยง คุมโล่และน้ำให้ดี';
    }
    return `เสี่ยง: ${reasons.slice(0,2).join(' + ')}`;
  }

  function setHUD(){
    if(ui.score) ui.score.textContent=String(score|0);
    if(ui.time) ui.time.textContent=String(Math.ceil(tLeft));
    if(ui.miss) ui.miss.textContent=String(missBadHit|0);
    if(ui.expire) ui.expire.textContent=String(missGoodExpired|0);
    if(ui.block) ui.block.textContent=String(blockCount|0);
    if(ui.water) ui.water.textContent=`${Math.round(clamp(waterPct,0,100))}%`;
    if(ui.combo) ui.combo.textContent=String(combo|0);
    if(ui.shield) ui.shield.textContent=String(shield|0);
    if(ui.grade) ui.grade.textContent=gradeText();

    if(ui.phase){
      if(phase==='storm'){
        ui.phase.textContent=`${emojiFor(diff,'storm')} STORM ${needZone==='L'?'LEFT':'RIGHT'}`;
      }else if(phase==='boss'){
        ui.phase.textContent=`${emojiFor(diff,'boss',bossLevel)} BOSS ${bossLevel} ${bossHits}/${bossGoal} ${needZone==='L'?'LEFT':'RIGHT'}`;
      }else if(phase==='final'){
        ui.phase.textContent=`${emojiFor(diff,'final')} FINAL ${finalHits}/${finalGoal} ${needZone==='L'?'LEFT':'RIGHT'}`;
      }else{
        ui.phase.textContent='💧 NORMAL';
      }
    }

    if(zoneSign){
      if(phase==='storm' || phase==='boss' || phase==='final'){
        const emo = phase==='boss' ? emojiFor(diff,'boss',bossLevel) : emojiFor(diff,phase);
        zoneSign.textContent = `${emo} SAFE: ${needZone==='L'?'⬅️LEFT':'➡️RIGHT'} + 🛡️`;
      }else{
        zoneSign.textContent = '';
      }
    }
  }

  function setAIHud(risk, hint){
    if(ui.aiRisk) ui.aiRisk.textContent = String((+risk).toFixed(2));
    if(ui.aiHint) ui.aiHint.textContent = String(hint || '—');
    if(ui.riskFill) ui.riskFill.style.width = `${Math.round(clamp(risk,0,1)*100)}%`;
    if(ui.coachExplain) ui.coachExplain.textContent = explainRisk(risk);
  }

  function applyLightningStrike(rate){
    if(r01() < rate){
      lightning();
      fxShake();
      const r = layer.getBoundingClientRect();
      fxRing(r.width/2, r.height/2);
      fxScore(r.width/2, r.height/2, '⚡');

      if(shield > 0 && isInNeededZone()){
        shield--;
        blockCount++;
        phaseStats[currentPhaseKey()].lightningBlock++;
        phaseStats[currentPhaseKey()].block++;
        SFX.block();
        fxScore(120, 230, 'BLOCK⚡');
        logEvent('lightning_block', { shield });
      }else{
        combo = 0;
        waterPct = clamp(waterPct - TUNE.lightningDmgWater, 0, 100);
        score = Math.max(0, score - TUNE.lightningDmgScore);
        phaseStats[currentPhaseKey()].lightningHit++;
        SFX.bad();
        fxScore(120, 230, `-${TUNE.lightningDmgScore}⚡`);
        logEvent('lightning_hit', { waterPct, score });
      }
    }
  }

  function hit(b){
    if(!playing || paused) return;
    const bb = b.el.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    const bx = (bb.left + bb.width/2) - lr.left;
    const by = (bb.top + bb.height/2) - lr.top;
    const pk = currentPhaseKey();

    if(b.kind==='good'){
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      const mult = combo>=14 ? 3 : combo>=7 ? 2 : 1;
      const add = Math.round((10 + Math.min(12, combo)) * mult);
      score += add;
      waterPct = clamp(waterPct + TUNE.waterGain, 0, 100);
      phaseStats[pk].goodHit++;
      SFX.pop();
      fxBubblePop(b.el, 'good');
      fxRing(bx, by);
      fxScore(bx, by, `+${add}${mult>1?` x${mult}`:''}`);
      logEvent('good_hit', { scoreAdd:add, combo, waterPct });

      if(phase==='boss'){
        bossHits++;
        fxScore(bx, by-12, `${bossHits}/${bossGoal}`);
        if(bossHits >= bossGoal){
          if(bossLevel < 3){
            bossLevel++;
            bossHits = 0;
            bossGoal = bossLevel===2 ? TUNE.boss2NeedHits : TUNE.boss3NeedHits;
            SFX.setPhaseVolume('boss');
            SFX.phase('boss');
            needZone = (r01()<0.5) ? 'L' : 'R';
            zoneT = 0;
            fxPhaseBanner(`${emojiFor(diff,'boss',bossLevel)} BOSS ${bossLevel}`);
            logEvent('phase_enter', { phase:`boss${bossLevel}` });
          }else{
            phase='final';
            bossHits=0;
            finalHits=0;
            finalGoal=TUNE.finalNeedHits;
            setStagePhase('final');
            SFX.setPhaseVolume('final');
            SFX.phase('final');
            zoneT=0;
            needZone = (r01()<0.5) ? 'L' : 'R';
            fxPhaseBanner(`${emojiFor(diff,'final')} FINAL BOSS`);
            logEvent('phase_enter', { phase:'final' });
          }
        }
      }else if(phase==='final'){
        finalHits++;
        fxScore(bx, by-12, `${finalHits}/${finalGoal}`);
        if(finalHits >= finalGoal){
          showEnd('final-clear');
          return;
        }
      }

      setTimeout(()=>removeBubble(b.id), 50);
      return;
    }

    if(b.kind==='shield'){
      shield = clamp(shield + 1, 0, 9);
      score += 6;
      SFX.shield();
      fxBubblePop(b.el, 'good');
      fxRing(bx, by);
      fxScore(bx, by, '🛡️+1');
      logEvent('shield_hit', { shield });
      setTimeout(()=>removeBubble(b.id), 50);
      return;
    }

    if(shield > 0){
      shield--;
      blockCount++;
      score += 2;
      phaseStats[pk].block++;
      SFX.block();
      fxBubblePop(b.el, 'bad');
      fxRing(bx, by);
      fxScore(bx, by, 'BLOCK');
      logEvent('bad_block', { shield });
      setTimeout(()=>removeBubble(b.id), 50);
      return;
    }

    missBadHit++;
    combo=0;
    score = Math.max(0, score - 8);
    waterPct = clamp(waterPct - TUNE.waterLoss, 0, 100);
    phaseStats[pk].badHit++;
    SFX.bad();
    fxShake();
    fxBubblePop(b.el, 'bad');
    fxRing(bx, by);
    fxScore(bx, by, '-8');
    logEvent('bad_hit', { waterPct, score });
    setTimeout(()=>removeBubble(b.id), 50);
  }

  layer.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    const el = ev.target?.closest?.('.bubble');
    if(!el) return;
    const b=bubbles.get(String(el.dataset.id));
    if(b) hit(b);
  }, { passive:true });

  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 56, 16, 160);
    let best=null, bestD=1e9;
    const r=layer.getBoundingClientRect();
    const cx=r.left + r.width/2;
    const cy=r.top  + r.height/2;
    for(const b of bubbles.values()){
      const bb=b.el.getBoundingClientRect();
      const bx=bb.left + bb.width/2;
      const by=bb.top  + bb.height/2;
      const d=Math.hypot(bx-cx, by-cy);
      if(d<bestD){ bestD=d; best=b; }
    }
    return (best && bestD<=lockPx) ? best : null;
  }

  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!playing || paused) return;
    const b = pickClosestToCenter(ev?.detail?.lockPx ?? 56);
    if(b) hit(b);
  });

  function updateBubbles(){
    const t=nowMs();
    const lr = layer.getBoundingClientRect();
    const pk = currentPhaseKey();

    for(const b of Array.from(bubbles.values())){
      if(t - b.born >= b.ttl){
        if(b.kind==='good'){
          missGoodExpired++;
          combo=0;
          score = Math.max(0, score - 4);
          waterPct = clamp(waterPct - 4.5, 0, 100);
          phaseStats[pk].goodExpire++;
          const bb = b.el.getBoundingClientRect();
          const bx = (bb.left + bb.width/2) - lr.left;
          const by = (bb.top + bb.height/2) - lr.top;
          fxBubblePop(b.el, 'bad');
          fxRing(bx, by);
          fxScore(bx, by, 'MISS💧');
          logEvent('good_expire', { waterPct, score });
        }else{
          fxBubblePop(b.el, 'good');
        }
        setTimeout(()=>removeBubble(b.id), 40);
      }
    }
  }

  function buildSummary(reason){
    const summary = {
      projectTag:'HydrationVR',
      gameVersion:'HydrationVR_SAFE_2026-03-06_AI_TIMELINE_EXPORT',
      device:view,
      runMode,
      diff,
      seed:seedStr,
      pid,
      reason:String(reason||''),
      durationPlannedSec: plannedSec,
      durationPlayedSec: Math.round(plannedSec - tLeft),
      scoreFinal: score|0,
      missBadHit: missBadHit|0,
      missGoodExpired: missGoodExpired|0,
      blockCount: blockCount|0,
      comboMax: bestCombo|0,
      shield: shield|0,
      waterPct: Math.round(clamp(waterPct,0,100)),
      phaseFinal: currentPhaseKey(),
      bossLevel,
      bossHits: bossHits|0,
      finalHits: finalHits|0,
      startTimeIso: nowIso(),
      endTimeIso: nowIso(),
      grade: gradeText(),
      phaseStats,
      eventCount: eventLog.length,
      timelineCount: riskTimeline.length
    };
    return summary;
  }

  function setEndButtons(summary){
    const done = cooldownDone('nutrition','hydration',pid);
    const needCooldown = cooldownRequired && !done;

    if(ui.btnNextCooldown){
      ui.btnNextCooldown.classList.toggle('is-hidden', !needCooldown);
      ui.btnNextCooldown.onclick = null;
      if(needCooldown){
        const nextAfterCooldown = hubUrl || '../hub.html';
        const url = buildCooldownUrl({ hub: hubUrl, nextAfterCooldown, cat:'nutrition', gameKey:'hydration', pid });
        ui.btnNextCooldown.onclick = ()=>{ location.href=url; };
      }
    }

    if(ui.btnBackHub) ui.btnBackHub.onclick = ()=>{ location.href = hubUrl; };
    if(ui.btnReplay){
      ui.btnReplay.onclick = ()=>{
        try{
          const u = new URL(location.href);
          if(runMode!=='research') u.searchParams.set('seed', String((Date.now() ^ (Math.random()*1e9))|0));
          location.href = u.toString();
        }catch(e){ location.reload(); }
      };
    }
    if(ui.btnCopy){
      ui.btnCopy.onclick = async ()=>{
        const txt = safeJson(summary);
        try{ await navigator.clipboard.writeText(txt); }
        catch(e){ try{ prompt('Copy Summary JSON:', txt); }catch(_){ } }
      };
    }
    if(ui.btnCopyEvents){
      ui.btnCopyEvents.onclick = async ()=>{
        const txt = safeJson(eventLog);
        try{ await navigator.clipboard.writeText(txt); }
        catch(e){ try{ prompt('Copy Events JSON:', txt); }catch(_){ } }
      };
    }
    if(ui.btnCopyTimeline){
      ui.btnCopyTimeline.onclick = async ()=>{
        const txt = safeJson(riskTimeline);
        try{ await navigator.clipboard.writeText(txt); }
        catch(e){ try{ prompt('Copy Timeline JSON:', txt); }catch(_){ } }
      };
    }
  }

  function showEnd(reason){
    playing=false;
    paused=false;
    ui.pauseOverlay?.setAttribute('aria-hidden','true');
    ui.helpOverlay?.setAttribute('aria-hidden','true');
    setStagePhase('normal');

    for(const b of bubbles.values()){ try{ b.el.remove(); }catch(e){} }
    bubbles.clear();

    const summary = buildSummary(reason);
    logEvent('game_end', { reason });

    if(ui.end){
      ui.end.setAttribute('aria-hidden','false');
      ui.endTitle.textContent = (reason==='final-clear') ? 'FINAL CLEAR!' : 'Game Over';
      ui.endSub.textContent = `reason=${summary.reason} | mode=${runMode} | view=${view} | seed=${seedStr}`;
      ui.endGrade.textContent = summary.grade || '—';
      ui.endScore.textContent = String(summary.scoreFinal|0);
      ui.endMiss.textContent = String(summary.missBadHit|0);
      ui.endWater.textContent = `${summary.waterPct}%`;
      setEndButtons(summary);
    }
  }

  function checkEnd(){
    if(tLeft<=0){ showEnd('time'); return true; }
    if(missBadHit >= TUNE.missLimit){ showEnd('miss-limit'); return true; }
    if(waterPct<=0){ showEnd('dehydrated'); return true; }
    return false;
  }

  let spawnAcc=0;
  function phaseSpawnMul(){
    if(phase==='storm') return TUNE.stormSpawnMul;
    if(phase==='boss'){
      if(bossLevel===1) return TUNE.boss1SpawnMul;
      if(bossLevel===2) return TUNE.boss2SpawnMul;
      return TUNE.boss3SpawnMul;
    }
    if(phase==='final') return TUNE.finalSpawnMul;
    return 1.0;
  }
  function phaseBadP(){
    if(phase==='storm') return TUNE.stormBadP;
    if(phase==='boss'){
      if(bossLevel===1) return TUNE.boss1BadP;
      if(bossLevel===2) return TUNE.boss2BadP;
      return TUNE.boss3BadP;
    }
    if(phase==='final') return TUNE.finalBadP;
    return 0.24;
  }
  function phaseLightningRate(){
    if(phase==='storm') return TUNE.stormSec > 0 ? (diff==='easy'?0.65:diff==='hard'?1.05:0.9) : 0;
    if(phase==='boss'){
      if(bossLevel===1) return TUNE.boss1LightningRate;
      if(bossLevel===2) return TUNE.boss2LightningRate;
      return TUNE.boss3LightningRate;
    }
    if(phase==='final') return TUNE.finalLightningRate;
    return 0;
  }
  function phaseZoneChunk(){
    if(phase==='storm') return TUNE.zoneChunkStorm;
    if(phase==='boss'){
      if(bossLevel===1) return TUNE.zoneChunkBoss1;
      if(bossLevel===2) return TUNE.zoneChunkBoss2;
      return TUNE.zoneChunkBoss3;
    }
    if(phase==='final') return TUNE.zoneChunkFinal;
    return 99;
  }

  function startBoss(level){
    phase='boss';
    bossLevel=level;
    bossHits=0;
    bossGoal = level===1 ? TUNE.boss1NeedHits : level===2 ? TUNE.boss2NeedHits : TUNE.boss3NeedHits;
    setStagePhase('boss');
    SFX.setPhaseVolume('boss');
    SFX.phase('boss');
    zoneT=0;
    needZone = (r01()<0.5) ? 'L' : 'R';
    lightning();
    fxPhaseBanner(`${emojiFor(diff,'boss',bossLevel)} BOSS ${bossLevel}`);
    logEvent('phase_enter', { phase:`boss${bossLevel}` });
  }

  function startFinal(){
    phase='final';
    finalHits=0;
    finalGoal=TUNE.finalNeedHits;
    setStagePhase('final');
    SFX.setPhaseVolume('final');
    SFX.phase('final');
    zoneT=0;
    needZone = (r01()<0.5) ? 'L' : 'R';
    lightning();
    fxPhaseBanner(`${emojiFor(diff,'final')} FINAL BOSS`);
    logEvent('phase_enter', { phase:'final' });
  }

  function spawnTick(dt){
    if(shield>0 && r01() < dt*TUNE.shieldDrop) shield = Math.max(0, shield-1);

    if(!stormDone && phase==='normal' && tLeft <= plannedSec*0.72){
      phase='storm';
      setStagePhase('storm');
      SFX.setPhaseVolume('storm');
      SFX.phase('storm');
      stormLeft=TUNE.stormSec;
      stormDone=true;
      zoneT=0;
      needZone = (r01()<0.5) ? 'L' : 'R';
      lightning();
      fxPhaseBanner(`${emojiFor(diff,'storm')} STORM`);
      logEvent('phase_enter', { phase:'storm' });
    }

    if(phase==='storm'){
      stormLeft = Math.max(0, stormLeft - dt);
      zoneT += dt;
      if(zoneT >= phaseZoneChunk()){ zoneT = 0; swapZone(); }
      applyLightningStrike(dt * phaseLightningRate());
      if(stormLeft <= 0) startBoss(1);
    }

    if(phase==='boss'){
      zoneT += dt;
      if(zoneT >= phaseZoneChunk()){ zoneT = 0; swapZone(); }
      applyLightningStrike(dt * phaseLightningRate());
    }

    if(phase==='final'){
      zoneT += dt;
      if(zoneT >= phaseZoneChunk()){ zoneT = 0; swapZone(); }
      applyLightningStrike(dt * phaseLightningRate());
    }

    spawnAcc += (TUNE.spawnBase * phaseSpawnMul()) * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      const p=r01();
      let kind='good';
      const badP = phaseBadP();
      if(phase==='normal'){
        if(p < 0.64) kind='good';
        else if(p < 0.88) kind='bad';
        else kind='shield';
      }else{
        if(p < (1.0 - badP - 0.08)) kind='good';
        else if(p < (1.0 - 0.08)) kind='bad';
        else kind='shield';
      }
      if(kind==='good') makeBubble('good', pick(GOOD), TUNE.ttlGood);
      else if(kind==='shield') makeBubble('shield', pick(SHLD), 2.6);
      else makeBubble('bad', pick(BAD), TUNE.ttlBad);
    }
  }

  function updateTimeline(risk){
    const playedSec = Math.round(plannedSec - tLeft);
    if(playedSec === lastTimelineAt) return;
    lastTimelineAt = playedSec;
    riskTimeline.push({
      t: playedSec,
      timeLeft: Math.ceil(tLeft),
      phase: currentPhaseKey(),
      bossLevel,
      risk: +risk.toFixed(4),
      waterPct: Math.round(waterPct),
      shield,
      missBadHit,
      missGoodExpired,
      combo
    });
  }

  function loop(){
    if(!playing) return;

    if(helpOpen){
      setHUD();
      requestAnimationFrame(loop);
      return;
    }

    if(paused){
      lastTick = nowMs();
      setHUD();
      requestAnimationFrame(loop);
      return;
    }

    const t=nowMs();
    const dt=Math.min(0.05, Math.max(0.001, (t-lastTick)/1000));
    lastTick=t;

    tLeft=Math.max(0, tLeft-dt);
    waterPct = clamp(waterPct - dt*(diff==='hard'?1.35: diff==='easy'?0.95:1.15), 0, 100);

    spawnTick(dt);
    updateBubbles();

    const missPressure = (missBadHit/Math.max(1, TUNE.missLimit));
    const expirePressure = clamp(missGoodExpired/25, 0, 1);
    const lowWater = (waterPct<35) ? (35-waterPct)/35 : 0;
    const noShieldStorm = ((phase==='storm' || phase==='boss' || phase==='final') && shield===0) ? 0.20 : 0;
    const wrongZonePenalty = ((phase==='storm' || phase==='boss' || phase==='final') && !isInNeededZone()) ? 0.12 : 0;
    const risk = clamp(missPressure*0.40 + lowWater*0.28 + expirePressure*0.10 + noShieldStorm + wrongZonePenalty, 0, 1);

    let hint='เก็บน้ำ 💧 + หาโล่ 🛡️';
    if(phase==='storm') hint=`${emojiFor(diff,'storm')} ฟ้าผ่า! อยู่ ${needZone==='L'?'ซ้าย':'ขวา'} + มีโล่`;
    else if(phase==='boss') hint=`${emojiFor(diff,'boss',bossLevel)} บอส ${bossLevel}! ${bossHits}/${bossGoal} | อยู่ ${needZone==='L'?'ซ้าย':'ขวา'} + โล่`;
    else if(phase==='final') hint=`${emojiFor(diff,'final')} FINAL! ${finalHits}/${finalGoal} | อยู่ ${needZone==='L'?'ซ้าย':'ขวา'} + โล่`;
    else if(waterPct<35) hint='น้ำต่ำ! รีบเก็บ 💧';
    else if(shield===0) hint='หาโล่ 🛡️ ไว้กันฟ้าผ่า';
    else if(combo>=6) hint='คอมโบมาแล้ว!';

    updateTimeline(risk);
    setAIHud(risk, hint);
    setHUD();

    if(checkEnd()) return;
    requestAnimationFrame(loop);
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(!playing) return;
    if(DOC.hidden){
      paused=true;
      ui.pauseOverlay?.setAttribute('aria-hidden','false');
      return;
    }
  });

  if(ui.btnCopyEvents){
    ui.btnCopyEvents.onclick = async ()=>{
      const txt = safeJson(eventLog);
      try{ await navigator.clipboard.writeText(txt); }
      catch(e){ try{ prompt('Copy Events JSON:', txt); }catch(_){ } }
    };
  }
  if(ui.btnCopyTimeline){
    ui.btnCopyTimeline.onclick = async ()=>{
      const txt = safeJson(riskTimeline);
      try{ await navigator.clipboard.writeText(txt); }
      catch(e){ try{ prompt('Copy Timeline JSON:', txt); }catch(_){ } }
    };
  }

  SFX.setPhaseVolume('normal');
  showHelp();
  setHUD();
  requestAnimationFrame(loop);
}