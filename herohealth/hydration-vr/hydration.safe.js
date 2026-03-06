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

  function emojiFor(diffKey, phase){
    diffKey = String(diffKey||'normal').toLowerCase();
    const p = String(phase||'normal').toLowerCase();
    if(diffKey === 'easy'){
      if(p==='storm') return '🌦️⚡';
      if(p==='boss') return '⛈️⚡';
      if(p==='final') return '🌩️👑⚡';
      return '💧';
    }
    if(diffKey === 'hard'){
      if(p==='storm') return '🌪️⚡⚡⚡';
      if(p==='boss') return '🌀🌩️⚡⚡⚡';
      if(p==='final') return '🌪️👑⚡⚡⚡🔥';
      return '💧';
    }
    if(p==='storm') return '🌩️⚡⚡';
    if(p==='boss') return '⛈️🌀⚡';
    if(p==='final') return '🌪️👑⚡⚡';
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

    end: DOC.getElementById('end'),
    endTitle: DOC.getElementById('endTitle'),
    endSub: DOC.getElementById('endSub'),
    endGrade: DOC.getElementById('endGrade'),
    endScore: DOC.getElementById('endScore'),
    endMiss: DOC.getElementById('endMiss'),
    endWater: DOC.getElementById('endWater'),

    btnCopy: DOC.getElementById('btnCopy'),
    btnReplay: DOC.getElementById('btnReplay'),
    btnNextCooldown: DOC.getElementById('btnNextCooldown'),
    btnBackHub: DOC.getElementById('btnBackHub'),
  };

  const stageEl = DOC.getElementById('stage') || layer.parentElement;
  const zoneSign = DOC.getElementById('zoneSign');
  const btnZoneL = DOC.getElementById('btnZoneL');
  const btnZoneR = DOC.getElementById('btnZoneR');

  const SFX = (() => {
    let ctx = null;
    let unlocked = false;
    let last = new Map();
    let enabled = true;
    let volumeMul = 1.0;
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
      o.start(t0);
      o.stop(t0 + dur + release + 0.02);
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
      src.start(t0);
      src.stop(t0 + dur + release + 0.02);
    }
    function pop(){ if(canPlay('pop',30)) beep({ f0:720, f1:980, dur:0.06, type:'triangle', vol:0.10 }); }
    function shield(){
      if(!canPlay('shield',60)) return;
      beep({ f0:520, f1:780, dur:0.08, type:'sine', vol:0.12 });
      beep({ f0:880, f1:880, dur:0.04, type:'triangle', vol:0.08, attack:0.002, release:0.04 });
    }
    function bad(){
      if(!canPlay('bad',80)) return;
      beep({ f0:220, f1:120, dur:0.12, type:'sawtooth', vol:0.10 });
      noise({ dur:0.10, vol:0.06, hp:1200 });
    }
    function block(){ if(canPlay('block',70)) beep({ f0:360, f1:280, dur:0.08, type:'square', vol:0.08 }); }
    function thunder(){
      if(!canPlay('thunder',160)) return;
      noise({ dur:0.18, vol:0.10, hp:400 });
      beep({ f0:120, f1:70, dur:0.22, type:'sine', vol:0.10, attack:0.01, release:0.18 });
    }
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
    return { ensure, unlock, pop, shield, bad, block, thunder, phase, setEnabled, isEnabled, setPhaseVolume };
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
    if(!ui.btnSfx) return;
    ui.btnSfx.textContent = SFX.isEnabled() ? '🔊 SFX' : '🔇 SFX';
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
    stormSec: diff==='easy' ? 10 : diff==='hard' ? 14 : 12,
    stormSpawnMul: diff==='easy' ? 1.20 : diff==='hard' ? 1.45 : 1.30,
    stormBadP: diff==='easy' ? 0.38 : diff==='hard' ? 0.55 : 0.45,
    bossNeedHits: diff==='easy' ? 14 : diff==='hard' ? 22 : 18,
    bossSpawnMul: diff==='easy' ? 1.08 : diff==='hard' ? 1.22 : 1.15,
    bossBadP: diff==='easy' ? 0.34 : diff==='hard' ? 0.50 : 0.40,
    lightningRate: diff==='easy' ? 0.65 : diff==='hard' ? 1.05 : 0.9,
    bossLightningRate: diff==='easy' ? 0.90 : diff==='hard' ? 1.55 : 1.2,
    lightningDmgWater: diff==='easy' ? 5.5 : diff==='hard' ? 8.5 : 7.0,
    lightningDmgScore: diff==='easy' ? 4 : diff==='hard' ? 8 : 6,
    finalNeedHits: diff==='easy' ? 7 : diff==='hard' ? 12 : 10,
    finalSec: diff==='easy' ? 9 : 10,
    finalSpawnMul: diff==='easy' ? 1.20 : diff==='hard' ? 1.55 : 1.35,
    finalBadP: diff==='easy' ? 0.45 : diff==='hard' ? 0.62 : 0.55,
    finalLightningRate: diff==='easy' ? 1.05 : diff==='hard' ? 1.75 : 1.35,
    zoneChunkSec: diff==='easy' ? 3.5 : diff==='hard' ? 2.6 : 3.0
  };

  let playing=true, paused=false;
  let tLeft=plannedSec, lastTick=nowMs();
  let score=0, missBadHit=0, missGoodExpired=0, blockCount=0;
  let combo=0, bestCombo=0, shield=0, waterPct=30;
  let phase='normal', stormLeft=0, stormDone=false;
  let bossHits=0, bossGoal=0;
  let finalHits=0, finalGoal=0, finalLeft=0;
  let needZone='L', zoneT=0;
  let aimX01=0.5;

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

  const HydPause = (() => {
    let overlay = null;
    function show(){
      if(overlay) return;
      overlay = DOC.createElement('div');
      overlay.style.position='fixed';
      overlay.style.inset='0';
      overlay.style.zIndex='95';
      overlay.style.display='grid';
      overlay.style.placeItems='center';
      overlay.style.background='rgba(2,6,23,.72)';
      overlay.style.backdropFilter='blur(8px)';
      overlay.innerHTML = `
        <div style="width:min(520px, calc(100vw - 24px));border:1px solid rgba(255,255,255,.10);border-radius:22px;padding:16px;background: rgba(2,6,23,.85);box-shadow: 0 18px 40px rgba(0,0,0,.45);text-align:center;">
          <div style="font-weight:1000;font-size:22px;">Paused</div>
          <div style="opacity:.8;margin-top:6px;font-size:12px;">แตะเพื่อเล่นต่อ</div>
          <button id="btnResume" style="margin-top:14px;border:1px solid rgba(255,255,255,.10);background: rgba(56,189,248,.18);color:#e5e7eb;border-radius:14px;padding:10px 14px;font-weight:1000;">Resume</button>
        </div>
      `;
      DOC.body.appendChild(overlay);
      const resume = ()=>{
        hide();
        paused=false;
        lastTick=nowMs();
        requestAnimationFrame(loop);
      };
      overlay.addEventListener('pointerdown', resume, { passive:true });
      const btn = DOC.getElementById('btnResume');
      if(btn) btn.onclick = resume;
    }
    function hide(){ if(overlay){ overlay.remove(); overlay=null; } }
    return { show, hide };
  })();

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
      if(!hudEl) return;
      const rect = hudEl.getBoundingClientRect();
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
  }

  function removeBubble(id){
    const b=bubbles.get(String(id));
    if(!b) return;
    bubbles.delete(String(id));
    try{ b.el.remove(); }catch(e){}
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

    const grade = (() => {
      const played = Math.max(1, plannedSec - tLeft);
      const sps = score/played;
      const x = sps*10 - missBadHit*0.55 - missGoodExpired*0.08;
      if(x>=70) return 'S';
      if(x>=55) return 'A';
      if(x>=40) return 'B';
      if(x>=28) return 'C';
      return 'D';
    })();
    if(ui.grade) ui.grade.textContent=grade;

    if(ui.phase){
      const emo = emojiFor(diff, phase);
      if(phase==='storm') ui.phase.textContent=`${emo} STORM ${needZone==='L'?'LEFT':'RIGHT'}`;
      else if(phase==='boss') ui.phase.textContent=`${emo} BOSS ${bossHits}/${bossGoal} ${needZone==='L'?'LEFT':'RIGHT'}`;
      else if(phase==='final') ui.phase.textContent=`${emo} FINAL ${finalHits}/${finalGoal} ${needZone==='L'?'LEFT':'RIGHT'}`;
      else ui.phase.textContent='💧 NORMAL';
    }

    if(zoneSign){
      if(phase==='storm' || phase==='boss' || phase==='final'){
        zoneSign.textContent = `${emojiFor(diff, phase)} SAFE: ${needZone==='L'?'⬅️LEFT':'➡️RIGHT'} + 🛡️`;
      }else{
        zoneSign.textContent = '';
      }
    }
  }

  function setAIHud(risk, hint){
    if(ui.aiRisk) ui.aiRisk.textContent = String((+risk).toFixed(2));
    if(ui.aiHint) ui.aiHint.textContent = String(hint || '—');
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
        SFX.block();
        fxScore(120, 230, 'BLOCK⚡');
      }else{
        combo = 0;
        waterPct = clamp(waterPct - TUNE.lightningDmgWater, 0, 100);
        score = Math.max(0, score - TUNE.lightningDmgScore);
        SFX.bad();
        fxScore(120, 230, `-${TUNE.lightningDmgScore}⚡`);
      }
    }
  }

  function hit(b){
    if(!playing || paused) return;
    const bb = b.el.getBoundingClientRect();
    const lr = layer.getBoundingClientRect();
    const bx = (bb.left + bb.width/2) - lr.left;
    const by = (bb.top + bb.height/2) - lr.top;

    if(b.kind==='good'){
      combo++;
      bestCombo = Math.max(bestCombo, combo);
      const mult = combo>=14 ? 3 : combo>=7 ? 2 : 1;
      const add = Math.round((10 + Math.min(12, combo)) * mult);
      score += add;
      waterPct = clamp(waterPct + TUNE.waterGain, 0, 100);
      SFX.pop();
      fxBubblePop(b.el, 'good');
      fxRing(bx, by);
      fxScore(bx, by, `+${add}${mult>1?` x${mult}`:''}`);

      if(phase==='boss'){
        bossHits++;
        fxScore(bx, by-12, `${bossHits}/${bossGoal}`);
        if(bossHits >= bossGoal){
          phase='final';
          setStagePhase('final');
          SFX.setPhaseVolume('final');
          SFX.phase('final');
          finalHits=0;
          finalGoal=TUNE.finalNeedHits;
          finalLeft=TUNE.finalSec;
          zoneT=0;
          needZone = (r01()<0.5) ? 'L' : 'R';
          fxPhaseBanner(`${emojiFor(diff,'final')} FINAL BOSS`);
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
      setTimeout(()=>removeBubble(b.id), 50);
      return;
    }

    if(shield > 0){
      shield--;
      blockCount++;
      score += 2;
      SFX.block();
      fxBubblePop(b.el, 'bad');
      fxRing(bx, by);
      fxScore(bx, by, 'BLOCK');
      setTimeout(()=>removeBubble(b.id), 50);
      return;
    }

    missBadHit++;
    combo=0;
    score = Math.max(0, score - 8);
    waterPct = clamp(waterPct - TUNE.waterLoss, 0, 100);
    SFX.bad();
    fxShake();
    fxBubblePop(b.el, 'bad');
    fxRing(bx, by);
    fxScore(bx, by, '-8');
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
    for(const b of Array.from(bubbles.values())){
      if(t - b.born >= b.ttl){
        if(b.kind==='good'){
          missGoodExpired++;
          combo=0;
          score = Math.max(0, score - 4);
          waterPct = clamp(waterPct - 4.5, 0, 100);
          const bb = b.el.getBoundingClientRect();
          const bx = (bb.left + bb.width/2) - lr.left;
          const by = (bb.top + bb.height/2) - lr.top;
          fxBubblePop(b.el, 'bad');
          fxRing(bx, by);
          fxScore(bx, by, 'MISS💧');
        }else{
          fxBubblePop(b.el, 'good');
        }
        setTimeout(()=>removeBubble(b.id), 40);
      }
    }
  }

  function buildSummary(reason){
    const played = Math.round(plannedSec - tLeft);
    const grade = ui.grade ? ui.grade.textContent : '—';
    return {
      projectTag:'HydrationVR',
      gameVersion:'HydrationVR_SAFE_2026-03-05d_FXPlusSFX',
      device:view, runMode, diff, seed:seedStr,
      reason:String(reason||''),
      durationPlannedSec: plannedSec,
      durationPlayedSec: played,
      scoreFinal: score|0,
      missBadHit: missBadHit|0,
      missGoodExpired: missGoodExpired|0,
      blockCount: blockCount|0,
      comboMax: bestCombo|0,
      shield: shield|0,
      waterPct: Math.round(clamp(waterPct,0,100)),
      phaseFinal: phase,
      bossHits: bossHits|0,
      bossGoal: bossGoal|0,
      finalHits: finalHits|0,
      finalGoal: finalGoal|0,
      startTimeIso: nowIso(),
      endTimeIso: nowIso(),
      grade
    };
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
  }

  function showEnd(reason){
    playing=false;
    paused=false;
    HydPause.hide();
    setStagePhase('normal');

    for(const b of bubbles.values()){ try{ b.el.remove(); }catch(e){} }
    bubbles.clear();

    const summary = buildSummary(reason);

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
  function spawnTick(dt){
    if(shield>0 && r01() < dt*TUNE.shieldDrop) shield = Math.max(0, shield-1);

    if(!stormDone && phase==='normal' && tLeft <= plannedSec*0.62){
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
    }

    if(phase==='storm'){
      stormLeft = Math.max(0, stormLeft - dt);
      zoneT += dt;
      if(zoneT >= TUNE.zoneChunkSec){ zoneT = 0; swapZone(); }
      applyLightningStrike(dt * TUNE.lightningRate);
      if(stormLeft <= 0){
        phase='normal';
        setStagePhase('normal');
        SFX.setPhaseVolume('normal');
      }
    }

    if(phase==='normal' && stormDone){
      if(tLeft <= plannedSec*0.38 && waterPct >= 55){
        phase='boss';
        setStagePhase('boss');
        SFX.setPhaseVolume('boss');
        SFX.phase('boss');
        bossHits=0;
        bossGoal=TUNE.bossNeedHits;
        zoneT=0;
        needZone = (r01()<0.5) ? 'L' : 'R';
        lightning();
        fxPhaseBanner(`${emojiFor(diff,'boss')} BOSS`);
      }
    }

    if(phase==='boss'){
      zoneT += dt;
      if(zoneT >= TUNE.zoneChunkSec){ zoneT = 0; swapZone(); }
      applyLightningStrike(dt * TUNE.bossLightningRate);
    }

    if(phase==='final'){
      finalLeft = Math.max(0, finalLeft - dt);
      zoneT += dt;
      if(zoneT >= TUNE.zoneChunkSec){ zoneT = 0; swapZone(); }
      applyLightningStrike(dt * TUNE.finalLightningRate);
      if(finalLeft <= 0){
        showEnd('final-timeout');
        return;
      }
    }

    const inStorm = (phase==='storm');
    const inBoss  = (phase==='boss');
    const inFinal = (phase==='final');

    const spawnRate = TUNE.spawnBase * (inStorm ? TUNE.stormSpawnMul : inBoss ? TUNE.bossSpawnMul : inFinal ? TUNE.finalSpawnMul : 1.0);
    const ttlGood = TUNE.ttlGood;
    const ttlBad  = TUNE.ttlBad;

    spawnAcc += spawnRate * dt;
    while(spawnAcc >= 1){
      spawnAcc -= 1;
      const p=r01();
      let kind='good';

      if(inFinal){
        if(p < (1.0 - TUNE.finalBadP - 0.06)) kind='good';
        else if(p < (1.0 - 0.06)) kind='bad';
        else kind='shield';
      }else if(inStorm){
        if(p < (1.0 - TUNE.stormBadP - 0.07)) kind='good';
        else if(p < (1.0 - 0.07)) kind='bad';
        else kind='shield';
      }else if(inBoss){
        if(p < (1.0 - TUNE.bossBadP - 0.08)) kind='good';
        else if(p < (1.0 - 0.08)) kind='bad';
        else kind='shield';
      }else{
        if(p < 0.64) kind='good';
        else if(p < 0.88) kind='bad';
        else kind='shield';
      }

      if(kind==='good') makeBubble('good', pick(['💧','💦','🫗']), ttlGood);
      else if(kind==='shield') makeBubble('shield', '🛡️', 2.6);
      else makeBubble('bad', pick(['🧋','🥤','🍟']), ttlBad);
    }
  }

  function loop(){
    if(!playing) return;

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
    const risk = clamp(missPressure*0.55 + lowWater*0.35 + expirePressure*0.10, 0, 1);

    let hint='เก็บน้ำ 💧 + หาโล่ 🛡️';
    if(phase==='storm') hint=`${emojiFor(diff,'storm')} ฟ้าผ่า! อยู่ ${needZone==='L'?'ซ้าย':'ขวา'} + มีโล่`;
    else if(phase==='boss') hint=`${emojiFor(diff,'boss')} บอส! ${bossHits}/${bossGoal} | อยู่ ${needZone==='L'?'ซ้าย':'ขวา'} + โล่`;
    else if(phase==='final') hint=`${emojiFor(diff,'final')} FINAL! ${finalHits}/${finalGoal} | อยู่ ${needZone==='L'?'ซ้าย':'ขวา'} + โล่`;
    else if(waterPct<35) hint='น้ำต่ำ! รีบเก็บ 💧';
    else if(shield===0) hint='หาโล่ 🛡️ ไว้กันฟ้าผ่า';
    else if(combo>=6) hint='คอมโบมาแล้ว!';
    setAIHud(risk, hint);

    setHUD();
    if(checkEnd()) return;
    requestAnimationFrame(loop);
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(!playing) return;
    if(DOC.hidden){
      paused=true;
      HydPause.show();
      return;
    }
    if(paused) HydPause.show();
  });

  SFX.setPhaseVolume('normal');
  setHUD();
  requestAnimationFrame(loop);
}