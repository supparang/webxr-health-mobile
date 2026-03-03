// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — PRODUCTION (Solo + AI prediction + Explainable Coach + 3-Phase Mission + PRO switch)
// ✅ Mini-mission 3 phases: Warm → Trick → Boss
// ✅ AI Coach explain top2 reasons when risk high (from AI.pred.explainTop2)
// ✅ PRO switch: ?pro=1 (only diff=hard + run=play) -> slightly harder but fair
// FULL v20260303-SAFE-GRADE5-3PHASE-AIEXPLAIN-PRO
'use strict';

export function boot(cfg){
  cfg = cfg || {};
  const WIN=window, DOC=document;
  const AI = cfg.ai || null;

  const qs=(k,d='')=>{try{return (new URL(location.href)).searchParams.get(k)??d}catch(e){return d}};
  const clamp=(v,a,b)=>{v=Number(v);if(!Number.isFinite(v))v=a;return Math.max(a,Math.min(b,v))};
  const nowMs=()=> (performance&&performance.now)?performance.now():Date.now();
  const nowIso=()=> new Date().toISOString();
  const $=(id)=>DOC.getElementById(id);

  // DOM
  const layer=$('gj-layer'); if(!layer){ console.warn('[GoodJunk] Missing #gj-layer'); return; }
  const hud={score:$('hud-score'),time:$('hud-time'),miss:$('hud-miss'),grade:$('hud-grade'),
    goal:$('hud-goal'),goalCur:$('hud-goal-cur'),goalTarget:$('hud-goal-target'),goalDesc:$('goalDesc'),
    mini:$('hud-mini'),miniTimer:$('miniTimer'),aiRisk:$('aiRisk'),aiHint:$('aiHint')};
  const feverFill=$('feverFill'), feverText=$('feverText'), shieldPills=$('shieldPills');
  const bossBar=$('bossBar'), bossFill=$('bossFill'), bossHint=$('bossHint');
  const lowTimeOverlay=$('lowTimeOverlay'), lowTimeNum=$('gj-lowtime-num');
  const progressFill=$('gjProgressFill');
  const endOverlay=$('endOverlay'), endTitle=$('endTitle'), endSub=$('endSub'), endGrade=$('endGrade'), endScore=$('endScore'), endMiss=$('endMiss'), endTime=$('endTime');

  // params
  const view=String(cfg.view||qs('view','mobile')).toLowerCase();
  const runMode=String(cfg.run||qs('run','play')).toLowerCase();
  const diff=String(cfg.diff||qs('diff','normal')).toLowerCase();
  const proOn = (qs('pro','0') === '1') && (diff === 'hard') && (runMode === 'play'); // ✅ PRO switch

  function defaultTimeByDiff(d){ d=String(d||'normal').toLowerCase(); return d==='easy'?90:(d==='hard'?70:80); }
  const plannedSec = clamp((cfg.time!=null?Number(cfg.time):(qs('time','')===''?defaultTimeByDiff(diff):Number(qs('time','')))), 20, 300);

  const pid=String(cfg.pid||qs('pid','anon')).trim()||'anon';
  const seedStr=String(cfg.seed||qs('seed',String(Date.now())));

  // RNG
  function xmur3(str){str=String(str||'');let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=(h<<13)|(h>>>19)}return function(){h=Math.imul(h^(h>>>16),2246822507);h=Math.imul(h^(h>>>13),3266489909);return (h^=(h>>>16))>>>0}}
  function sfc32(a,b,c,d){return function(){a>>>=0;b>>>=0;c>>>=0;d>>>=0;let t=(a+b)|0;a=b^(b>>>9);b=(c+(c<<3))|0;c=(c<<21)|(c>>>11);d=(d+1)|0;t=(t+d)|0;c=(c+t)|0;return (t>>>0)/4294967296}}
  function makeRng(seed){const s=xmur3(seed);return sfc32(s(),s(),s(),s())}
  let rng=makeRng(seedStr); const r01=()=>rng(); const rPick=(a)=>a[(r01()*a.length)|0];

  // base tuning
  const BASE=(()=>{let spawnBase=.78,life=10,ttlG=2.6,ttlJ=2.9,ttlB=2.4,storm=1.0,boss=18;
    if(diff==='easy'){spawnBase=.66;life=14;ttlG=3.1;ttlJ=3.2;storm=.95;boss=16}
    else if(diff==='hard'){spawnBase=.92;life=8;ttlG=2.25;ttlJ=2.35;storm=1.12;boss=22}
    if(view==='cvr'||view==='vr'){ttlG+=.15;ttlJ+=.15}
    // ✅ PRO: โหดขึ้นนิดแบบแฟร์ (ไม่ลด life)
    if(proOn){
      spawnBase *= 1.06;   // เพิ่มความถี่เล็กน้อย
      ttlG *= 0.96;       // ของดีหายไวขึ้นนิด
      ttlJ *= 0.93;       // ของเสียกดดันขึ้น
      boss += 2;          // บอสอึดขึ้นนิด
    }
    return {spawnBase,life,ttlG,ttlJ,ttlB,storm,boss};
  })();

  // assets
  const GOOD=['🍎','🍌','🥦','🥬','🥚','🐟','🥛','🍚','🍞','🥑','🍉','🍊','🥕','🥒'];
  const JUNK=['🍟','🍔','🍕','🍩','🍬','🧋','🥤','🍭','🍫'];
  const BONUS=['⭐','💎','⚡'];
  const SHIELDS=['🛡️','🛡️','🛡️'];
  const BOSS_SHIELD='🛡️';
  const WEAK='🎯';

  // FX layer
  const fx=DOC.createElement('div'); fx.style.position='fixed';fx.style.inset='0';fx.style.pointerEvents='none';fx.style.zIndex='260';DOC.body.appendChild(fx);
  function fxFloatText(x,y,t,bad){
    const el=DOC.createElement('div'); el.textContent=t; el.style.position='absolute'; el.style.left=`${x}px`; el.style.top=`${y}px`;
    el.style.transform='translate(-50%,-50%)'; el.style.font='1000 18px/1.1 system-ui'; el.style.letterSpacing='.2px';
    el.style.color=bad?'rgba(255,110,110,.96)':'rgba(229,231,235,.98)';
    el.style.textShadow='0 10px 30px rgba(0,0,0,.55)'; el.style.filter='drop-shadow(0 10px 26px rgba(0,0,0,.45))';
    fx.appendChild(el);
    const t0=nowMs(),dur=520,rise=34+(r01()*14);
    (function tick(){const p=Math.min(1,(nowMs()-t0)/dur); el.style.top=`${y-rise*p}px`; el.style.opacity=String(1-p);
      el.style.transform=`translate(-50%,-50%) scale(${1+0.08*Math.sin(p*3.14)})`; if(p<1)requestAnimationFrame(tick); else el.remove();})();
  }
  function fxBurst(x,y){
    const n=10+((r01()*6)|0);
    for(let i=0;i<n;i++){
      const d=DOC.createElement('div'); d.style.position='absolute'; d.style.left=`${x}px`; d.style.top=`${y}px`;
      d.style.width='6px'; d.style.height='6px'; d.style.borderRadius='999px'; d.style.background='rgba(229,231,235,.92)';
      d.style.transform='translate(-50%,-50%)'; d.style.willChange='transform,opacity'; fx.appendChild(d);
      const ang=r01()*Math.PI*2, sp=40+r01()*80, vx=Math.cos(ang)*sp, vy=Math.sin(ang)*sp, t0=nowMs(), dur=420+r01()*220;
      (function tick(){const p=Math.min(1,(nowMs()-t0)/dur); d.style.left=`${x+vx*p}px`; d.style.top=`${y+vy*p-30*p*p}px`;
        d.style.opacity=String(1-p); d.style.transform=`translate(-50%,-50%) scale(${1-0.4*p})`; if(p<1)requestAnimationFrame(tick); else d.remove();})();
    }
  }

  // Coach toast
  const coach=DOC.createElement('div');
  coach.style.position='fixed'; coach.style.left='10px'; coach.style.right='10px';
  coach.style.bottom=`calc(env(safe-area-inset-bottom, 0px) + 10px)`; coach.style.zIndex='210';
  coach.style.pointerEvents='none'; coach.style.display='flex'; coach.style.justifyContent='center';
  coach.style.opacity='0'; coach.style.transform='translateY(6px)'; coach.style.transition='opacity .18s ease, transform .18s ease';
  coach.innerHTML=`<div style="max-width:760px;width:100%;border:1px solid rgba(148,163,184,.16);background:rgba(2,6,23,.62);
    color:rgba(229,231,235,.96);border-radius:16px;padding:10px 12px;box-shadow:0 18px 55px rgba(0,0,0,.40);
    backdrop-filter:blur(10px);font:1000 13px/1.35 system-ui"><span style="opacity:.9">🧑‍⚕️ Coach:</span> <span id="coachText">—</span></div>`;
  DOC.body.appendChild(coach);
  const coachText=coach.querySelector('#coachText'); let coachLatch=0;
  function sayCoach(msg){
    const t=nowMs(); if(t-coachLatch<2600) return; // เร็วขึ้นนิดให้เร้าใจ
    coachLatch=t; if(coachText) coachText.textContent=String(msg||'');
    coach.style.opacity='1'; coach.style.transform='translateY(0)';
    setTimeout(()=>{coach.style.opacity='0'; coach.style.transform='translateY(6px)'}, 2200);
  }

  // AI HUD + explain
  function setAIHud(pred){
    try{
      if(!pred) return;
      if(hud.aiRisk && typeof pred.hazardRisk==='number') hud.aiRisk.textContent = String((+pred.hazardRisk).toFixed(2));
      if(hud.aiHint) hud.aiHint.textContent = String((pred.next5 && pred.next5[0]) || '—');
    }catch(e){}
  }
  function explainTextTop2(pred){
    try{
      const a = pred?.explainTop2 || [];
      if(!Array.isArray(a) || a.length===0) return '';
      const t1 = a[0]?.label || a[0]?.feature || '';
      const t2 = a[1]?.label || a[1]?.feature || '';
      if(!t1) return '';
      return t2 ? `เพราะ: ${t1}, ${t2}` : `เพราะ: ${t1}`;
    }catch(e){ return ''; }
  }

  // state
  const startTimeIso=nowIso();
  let playing=true, tLeft=plannedSec, lastTick=nowMs();
  let paused=false; WIN.__GJ_SET_PAUSED__=(on)=>{paused=!!on; lastTick=nowMs();};

  let score=0, missTotal=0, missGoodExpired=0, missJunkHit=0;
  let combo=0, bestCombo=0;
  let fever=0, rageOn=false, rageLeft=0;
  let shield=0;
  let goodHitCount=0, rtSum=0, rtList=[];
  let shots=0, hits=0;

  // ✅ 3-Phase Mission state
  // Warm: first 12s, Trick: middle, Boss: last 35% (boss can appear only in Boss)
  const phase = { name:'Warm', t:0 }; // t used as phase timer helper
  const WARM_SEC = 12;
  const BOSS_START_LEFT = plannedSec * 0.35; // last 35% time
  let stormOn=false;

  const goal={ name:'3-Phase', desc:'Warm → Trick → Boss', cur:0, target:999999 }; // goal UI reused
  const mini={ name:'—', t:0 };

  let bossActive=false, bossHpMax=BASE.boss, bossHp=bossHpMax, bossPhase=0, bossShieldHp=6;
  const targets=new Map(); let idSeq=1;

  function layerRect(){ return layer.getBoundingClientRect(); }
  function getSpawnSafeLocal(){
    const r=layerRect();
    const pad=18;
    const yMin=Math.min(r.height-180,190);
    const yMax=Math.max(yMin+180,r.height-130);
    return {
      xMin: pad, xMax: Math.max(pad+160, r.width-pad),
      yMin: clamp(yMin,pad,Math.max(pad,r.height-220)),
      yMax: clamp(yMax,Math.max(pad+180,yMin+180),Math.max(pad+240,r.height-pad)),
      w:r.width,h:r.height
    };
  }
  function median(a){ if(!a||!a.length) return 0; const b=a.slice().sort((x,y)=>x-y); const m=(b.length/2)|0; return (b.length%2)?b[m]:(b[m-1]+b[m])/2; }
  function accPct(){ return shots>0 ? Math.round((hits/shots)*1000)/10 : 0; }
  function gradeFromScore(s){
    const played=Math.max(1, plannedSec-tLeft);
    const sps=s/played;
    const pen=missTotal*6;
    const x=sps*10 - pen*0.4;
    if(x>=70) return 'S';
    if(x>=55) return 'A';
    if(x>=40) return 'B';
    if(x>=28) return 'C';
    return 'D';
  }

  // score tick emit
  let lastEmit=0;
  function emitScore(force=false){
    const t=nowMs(); if(!force && t-lastEmit<250) return; lastEmit=t;
    try{
      const payload = {
        score: score|0,
        miss: missTotal|0,
        accPct: accPct(),
        shots: shots|0,
        hits: hits|0,
        combo: combo|0,
        comboMax: bestCombo|0,
        feverPct: +clamp(fever,0,100),
        shield: shield|0,
        missGoodExpired: missGoodExpired|0,
        missJunkHit: missJunkHit|0,
        medianRtGoodMs: Math.round(median(rtList))|0,
        stormOn: stormOn ? 1 : 0,
        bossActive: bossActive ? 1 : 0,
        tLeft: +tLeft,
        plannedSec: +plannedSec,
        phase: phase.name,
        pro: proOn ? 1 : 0
      };
      WIN.dispatchEvent(new CustomEvent('hha:score',{detail:payload}));
    }catch(e){}
  }

  function setHUD(){
    hud.score&&(hud.score.textContent=String(score|0));
    hud.time&&(hud.time.textContent=String(Math.ceil(tLeft)));
    hud.miss&&(hud.miss.textContent=String(missTotal|0));
    hud.grade&&(hud.grade.textContent=gradeFromScore(score));

    // show 3-phase in GOAL / MINI areas
    hud.goal&&(hud.goal.textContent = phase.name);
    hud.goalCur&&(hud.goalCur.textContent = String(combo|0)); // ใช้เป็น “combo live” ให้เด็กเห็นชัด
    hud.goalTarget&&(hud.goalTarget.textContent = proOn ? 'PRO' : diff.toUpperCase());
    hud.goalDesc&&(hud.goalDesc.textContent = `Mission: Warm → Trick → Boss`);

    hud.mini&&(hud.mini.textContent=mini.name);
    hud.miniTimer&&(hud.miniTimer.textContent=mini.t>0?`${Math.ceil(mini.t)}s`:'—');

    feverFill&&(feverFill.style.width=`${clamp(fever,0,100)}%`);
    feverText&&(feverText.textContent=`${Math.round(clamp(fever,0,100))}%`);

    if(shieldPills) shieldPills.textContent = shield<=0?'—':'🛡️'.repeat(Math.min(6,shield));

    if(bossBar){
      if(!bossActive){ bossBar.setAttribute('aria-hidden','true'); }
      else{
        bossBar.setAttribute('aria-hidden','false');
        bossFill&&(bossFill.style.width=`${clamp((bossHp/bossHpMax)*100,0,100)}%`);
        bossHint&&(bossHint.textContent=(bossPhase===0?'Break 🛡️ first':'Hit 🎯 for big damage'));
      }
    }

    if(progressFill){
      const p=(plannedSec>0)?(1-(tLeft/plannedSec)):0;
      progressFill.style.width=`${clamp(p*100,0,100)}%`;
    }

    if(lowTimeOverlay){
      if(tLeft<=5 && tLeft>0){
        lowTimeOverlay.setAttribute('aria-hidden','false');
        lowTimeNum&&(lowTimeNum.textContent=String(Math.ceil(tLeft)));
      }else lowTimeOverlay.setAttribute('aria-hidden','true');
    }

    emitScore(false);
  }

  const ENDKEY='__HHA_GJ_END_SENT__';
  function endOnce(sum){ try{ if(WIN[ENDKEY]) return; WIN[ENDKEY]=1; WIN.dispatchEvent(new CustomEvent('hha:game-ended',{detail:sum||null})); }catch(e){} }

  function showEnd(reason){
    playing=false; paused=false;
    for(const t of targets.values()){ try{ t.el.remove(); }catch(e){} }
    targets.clear();

    const avgRt = goodHitCount>0 ? Math.round(rtSum/goodHitCount) : 0;
    const medRt = Math.round(median(rtList));
    const sum = {
      projectTag:'GoodJunkVR',
      gameKey:'goodjunk',
      pid,
      zone:'nutrition',
      gameVersion:'GoodJunkVR_SAFE_2026-03-03_GRADE5_3PHASE',
      device:view, runMode, diff, pro: proOn ? 1:0,
      seed:seedStr,
      reason:String(reason||''),
      durationPlannedSec: plannedSec,
      durationPlayedSec: Math.round(plannedSec - tLeft),
      scoreFinal: score|0,
      missTotal: missTotal|0,
      accPct: accPct(),
      shots: shots|0, hits: hits|0,
      comboMax: bestCombo|0,
      missGoodExpired: missGoodExpired|0,
      missJunkHit: missJunkHit|0,
      avgRtGoodMs: avgRt|0,
      medianRtGoodMs: medRt|0,
      bossDefeated: !!(!bossActive && bossHp<=0),
      stormOn: !!stormOn,
      rageOn: !!rageOn,
      shieldEnd: shield|0,
      phaseEnd: phase.name,
      startTimeIso,
      endTimeIso: nowIso(),
      grade: gradeFromScore(score),
      aiPredictionLast: (()=>{ try{ return AI?.getPrediction?.()||null; }catch(e){ return null; } })()
    };

    try{ const aiEnd = AI?.onEnd?.(sum); if(aiEnd) sum.aiEnd = aiEnd; }catch(e){}

    WIN.__HHA_LAST_SUMMARY = sum;
    endOnce(sum);

    if(endOverlay){
      endOverlay.setAttribute('aria-hidden','false');
      endTitle&&(endTitle.textContent='Game Over');
      endSub&&(endSub.textContent=`${phase.name} | acc=${sum.accPct}% | medRT=${sum.medianRtGoodMs}ms | pro=${sum.pro}`);
      endGrade&&(endGrade.textContent=sum.grade||'—');
      endScore&&(endScore.textContent=String(sum.scoreFinal|0));
      endMiss&&(endMiss.textContent=String(sum.missTotal|0));
      endTime&&(endTime.textContent=String(sum.durationPlayedSec|0));
    }

    emitScore(true);
    sayCoach(sum.missTotal>=BASE.life ? 'เดือด! รอบหน้าเริ่มช้า ๆ แล้วค่อยเร่งช่วง Trick/ Boss' : 'สุดยอด! ผ่านโหมดนี้ได้แล้ว ✨');
    setHUD();
  }

  // mechanics
  function addFever(v){
    fever=clamp(fever+v,0,100);
    if(fever>=100 && !rageOn){
      rageOn=true; rageLeft=7.0; fever=100;
      sayCoach('FEVER! คะแนนคูณ 🔥');
    }
  }
  function addShield(){
    shield=clamp(shield+1,0,9);
    sayCoach('ได้โล่! 🛡️');
  }

  function makeTarget(kind, emoji, ttlSec){
    const id=String(idSeq++);
    const el=DOC.createElement('div');
    el.className='gj-target';
    el.textContent=emoji;
    el.dataset.id=id;
    el.dataset.kind=kind;

    const safe=getSpawnSafeLocal();
    const rPad=(view==='mobile')?34:42;
    const xMin=safe.xMin+rPad, xMax=safe.xMax-rPad, yMin=safe.yMin+rPad, yMax=safe.yMax-rPad;
    const x=xMin+r01()*(Math.max(1,xMax-xMin));
    const y=yMin+r01()*(Math.max(1,yMax-yMin));

    el.style.left=`${x}px`;
    el.style.top=`${y}px`;
    el.style.opacity='1';
    if(view==='mobile') el.style.fontSize='58px';

    const drift=(r01()*2-1)*((view==='mobile')?16:22);
    const born=nowMs();
    const ttl=Math.max(0.85, ttlSec)*1000;

    layer.appendChild(el);
    const obj={id,el,kind,born,ttl,x,y,drift,promptMs:nowMs()};
    targets.set(id,obj);
    try{ AI?.onSpawn?.(kind,{id,emoji,ttlSec}); }catch(e){}
    return obj;
  }

  function removeTarget(id){
    const t=targets.get(String(id));
    if(!t) return;
    targets.delete(String(id));
    try{ t.el.remove(); }catch(e){}
  }

  function hitTarget(t,x,y){
    shots++;

    if(t.kind==='good'){
      const rt=Math.max(0,Math.round(nowMs()-(t.promptMs||nowMs())));
      goodHitCount++; rtSum+=rt; rtList.push(rt);

      hits++; combo++; bestCombo=Math.max(bestCombo,combo);
      let add=10+Math.min(12,combo);
      if(rageOn) add=Math.round(add*1.6);
      score+=add;
      addFever(6.5);
      fxBurst(x,y); fxFloatText(x,y-10,`+${add}`,false);
      if(combo===5) sayCoach('คอมโบเริ่มมาแล้ว!');
      removeTarget(t.id);
      return;
    }

    if(t.kind==='junk'){
      hits++;
      if(shield>0){
        shield--;
        fxBurst(x,y); fxFloatText(x,y-10,'BLOCK 🛡️',false);
        removeTarget(t.id);
        return;
      }
      missTotal++; missJunkHit++; combo=0;
      score=Math.max(0,score-8);
      fxFloatText(x,y-10,'-8',true);
      removeTarget(t.id);
      return;
    }

    if(t.kind==='bonus'){
      hits++; combo++; bestCombo=Math.max(bestCombo,combo);
      let add=rPick([25,30,35]);
      if(rageOn) add=Math.round(add*1.5);
      score+=add;
      fxBurst(x,y); fxFloatText(x,y-10,`BONUS +${add}`,false);
      removeTarget(t.id);
      return;
    }

    if(t.kind==='shield'){
      hits++; addShield();
      fxBurst(x,y); fxFloatText(x,y-10,'+SHIELD',false);
      removeTarget(t.id);
      return;
    }

    if(t.kind==='boss'){
      hits++;
      if(!bossActive){ removeTarget(t.id); return; }

      if(bossPhase===0){
        bossShieldHp--;
        fxBurst(x,y); fxFloatText(x,y-10,'SHIELD -1',false);
        if(bossShieldHp<=0){
          bossPhase=1;
          sayCoach('โล่แตกแล้ว! ยิง 🎯 แรงขึ้น!');
        }
        removeTarget(t.id);
        return;
      }

      const dmg=rageOn?4:3;
      bossHp=Math.max(0,bossHp-dmg);
      let add=22+dmg*6;
      if(rageOn) add=Math.round(add*1.4);
      score+=add; addFever(9);
      fxBurst(x,y); fxFloatText(x,y-10,`BOSS +${add}`,false);
      removeTarget(t.id);

      if(bossHp<=0){
        bossActive=false;
        score+=140;
        addFever(40);
        sayCoach('บอสแพ้แล้ว! +140 🎉');
      }
      return;
    }
  }

  // input
  function onPointerDown(ev){
    if(!playing||paused) return;
    const el=ev.target&&ev.target.closest?ev.target.closest('.gj-target'):null;
    if(!el) return;
    const t=targets.get(String(el.dataset.id));
    if(!t) return;
    hitTarget(t, ev.clientX, ev.clientY);
  }
  if(view!=='cvr') layer.addEventListener('pointerdown', onPointerDown, {passive:true});

  function pickTargetAt(x,y,lockPx){
    lockPx=clamp(lockPx ?? 46, 16, 140);
    let best=null, bestD=1e9;
    for(const t of targets.values()){
      const r=t.el.getBoundingClientRect();
      const cx=r.left+r.width/2, cy=r.top+r.height/2;
      const d=Math.hypot(cx-x,cy-y);
      if(d<bestD){bestD=d; best=t;}
    }
    return (best && bestD<=lockPx) ? best : null;
  }
  WIN.addEventListener('hha:shoot',(ev)=>{
    if(!playing||paused) return;
    const r=layerRect(); const x=r.left+r.width/2, y=r.top+r.height/2;
    const t=pickTargetAt(x,y,ev?.detail?.lockPx ?? 64);
    if(t) hitTarget(t,x,y);
    else shots++;
  });

  // director (AI adapt optional)
  function director(){
    try{
      const d = AI?.getDirector?.();
      if(d && typeof d.spawnMult==='number' && typeof d.ttlMult==='number'){
        return { spawnMult: clamp(d.spawnMult,.85,1.15), ttlMult: clamp(d.ttlMult,.9,1.15) };
      }
    }catch(e){}
    return { spawnMult:1, ttlMult:1 };
  }

  // spawn & phases
  let spawnAcc=0;

  function currentPhase(){
    const played = plannedSec - tLeft;
    if(played < WARM_SEC) return 'Warm';
    if(tLeft <= BOSS_START_LEFT) return 'Boss';
    return 'Trick';
  }

  function phaseEnter(newName){
    if(phase.name === newName) return;
    phase.name = newName;
    phase.t = 0;

    if(newName === 'Warm'){
      sayCoach('WARM: อุ่นเครื่อง—ของดีเด่นก่อน!');
      // แจกโล่ 1 อันใน PRO เพื่อแฟร์
      if(proOn && shield===0) shield = 1;
    }else if(newName === 'Trick'){
      sayCoach('TRICK: ระวังของเสีย—อย่าโดนหลอก!');
    }else{
      sayCoach('BOSS: เอาจริงแล้ว! แตกโล่บอสก่อน 🛡️');
    }
  }

  function spawnTick(dt){
    // update phase
    phaseEnter(currentPhase());
    phase.t += dt;

    // storm = ช่วงกดดันตอนท้าย (แต่ไม่ท้อ)
    stormOn = (tLeft <= Math.min(40, plannedSec*0.45));

    const dir = director();

    // base spawn by phase
    // Warm: ลดเล็กน้อยให้เข้าจังหวะ
    // Trick: เพิ่มนิด + ของเสียเร็วขึ้น
    // Boss: เพิ่มแรง + บอสจริงจัง
    let phaseSpawnMult = 1.0;
    let ttlMultPhase = 1.0;

    if(phase.name === 'Warm'){
      phaseSpawnMult = 0.92;
      ttlMultPhase = 1.08;
    }else if(phase.name === 'Trick'){
      phaseSpawnMult = 1.02;
      ttlMultPhase = 0.98;
    }else{ // Boss
      phaseSpawnMult = 1.06;
      ttlMultPhase = 0.96;
    }

    const base = BASE.spawnBase
      * (stormOn ? BASE.storm : 1.0)
      * dir.spawnMult
      * phaseSpawnMult
      * (rageOn ? 1.18 : 1.0);

    spawnAcc += base * dt;

    while(spawnAcc >= 1){
      spawnAcc -= 1;

      // Boss appears only in Boss phase
      if(phase.name === 'Boss' && !bossActive && tLeft > 6){
        bossActive=true;
        bossHpMax=BASE.boss; bossHp=bossHpMax;
        bossPhase=0; bossShieldHp = proOn ? 7 : 6;
      }

      let kind='good';

      if(phase.name === 'Warm'){
        // ของดีเด่น + มีโบนัสบ้าง
        const p=r01();
        if(p < 0.78) kind='good';
        else if(p < 0.90) kind='bonus';
        else kind='shield';
      }else if(phase.name === 'Trick'){
        // หลอก: ของเสียเพิ่ม + โบนัสล่อ
        const p=r01();
        if(p < 0.56) kind='good';
        else if(p < 0.84) kind='junk';
        else if(p < 0.94) kind='bonus';
        else kind='shield';
      }else{
        // Boss: มี boss target สลับ + ของเสียกดดัน
        if(bossActive && r01() < 0.28) kind='boss';
        else{
          const p=r01();
          if(p < 0.52) kind='good';
          else if(p < 0.86) kind='junk';
          else if(p < 0.92) kind='bonus';
          else kind='shield';
        }
      }

      const ttlMult = dir.ttlMult * ttlMultPhase;

      if(kind==='good') makeTarget('good', rPick(GOOD), BASE.ttlG*ttlMult);
      else if(kind==='junk') makeTarget('junk', rPick(JUNK), BASE.ttlJ*ttlMult*0.98);
      else if(kind==='bonus') makeTarget('bonus', rPick(BONUS), BASE.ttlB*ttlMult);
      else if(kind==='shield') makeTarget('shield', rPick(SHIELDS), 2.6*ttlMult);
      else if(kind==='boss') makeTarget('boss', (bossPhase===0)?BOSS_SHIELD:WEAK, 2.2*ttlMult);
    }
  }

  function updateTargets(dt){
    const tNow=nowMs();
    const safe=getSpawnSafeLocal();
    const rPad=(view==='mobile')?34:42;

    for(const t of Array.from(targets.values())){
      const age=tNow-t.born;
      const p=age/t.ttl;

      t.x += t.drift*dt;
      const xMin=safe.xMin+rPad, xMax=safe.xMax-rPad;
      t.x = clamp(t.x,xMin,xMax);
      t.el.style.left=`${t.x}px`;

      if(p>0.75){
        t.el.style.opacity=String(clamp(1-(p-0.75)/0.25,0.15,1));
        t.el.style.transform=`translate(-50%,-50%) scale(${1-0.08*(p-0.75)/0.25})`;
      }

      if(age>=t.ttl){
        try{ AI?.onExpire?.(t.kind,{id:t.id}); }catch(e){}
        if(t.kind==='good'){
          missTotal++; missGoodExpired++; combo=0;
          score=Math.max(0,score-4);
          const r=t.el.getBoundingClientRect();
          fxFloatText(r.left+r.width/2,r.top+r.height/2,'MISS',true);
          if(missTotal===1) sayCoach('ของดีจะหายไว—รีบตี!');
        }
        removeTarget(t.id);
      }
    }
  }

  function updateRage(dt){
    if(!rageOn) return;
    rageLeft -= dt;
    if(rageLeft<=0){
      rageOn=false; rageLeft=0;
      fever=clamp(fever-18,0,100);
      sayCoach('FEVER หมดแล้ว แต่ยังไหว!');
    }
  }

  // mini objectives (more “phase-aware”)
  function updateMini(dt){
    if(mini.t>0){
      mini.t=Math.max(0,mini.t-dt);
      if(mini.t<=0) mini.name='—';
      return;
    }
    // spawn a mission with a bit higher rate in Trick/Boss
    const rate = (phase.name==='Warm') ? 0.035 : (phase.name==='Trick') ? 0.06 : 0.07;
    if(r01() < dt*rate){
      const type =
        (phase.name==='Warm') ? rPick(['combo-4','grab-shield']) :
        (phase.name==='Trick') ? rPick(['avoid-junk','combo-5','grab-bonus']) :
        rPick(['avoid-junk','boss-focus','combo-6']);

      if(type==='combo-4'){
        mini.name='Combo x4'; mini.t=7;
        sayCoach('Mini: ทำคอมโบ 4!');
      }else if(type==='grab-shield'){
        mini.name='Grab 🛡️'; mini.t=7;
        sayCoach('Mini: หาโล่ 🛡️');
      }else if(type==='avoid-junk'){
        mini.name='No JUNK 6s'; mini.t=6;
        sayCoach('Mini: 6 วิ ห้ามโดนของเสีย!');
      }else if(type==='grab-bonus'){
        mini.name='Grab ⭐'; mini.t=7;
        sayCoach('Mini: เก็บโบนัส ⭐');
      }else if(type==='boss-focus'){
        mini.name='Boss Focus'; mini.t=8;
        sayCoach('Mini: โฟกัสบอส! แตกโล่ก่อน');
      }else{
        mini.name='Combo x6'; mini.t=8;
        sayCoach('Mini: คอมโบให้ถึง 6!');
      }
    }
  }

  function checkEnd(){
    if(tLeft<=0){ showEnd('time'); return true; }
    if(missTotal>=BASE.life){ showEnd('miss-limit'); return true; }
    return false;
  }

  // AI tick + explain to coach when risk high
  function aiTick(dt){
    try{
      const pred = AI?.onTick?.(dt, {
        missGoodExpired, missJunkHit, shield, fever, combo, shots, hits,
        medianRtGoodMs: Math.round(median(rtList))|0,
        stormOn: stormOn ? 1 : 0,
        bossActive: bossActive ? 1 : 0,
        tLeftNorm: (plannedSec>0) ? (tLeft/plannedSec) : 0.5
      }) || null;

      setAIHud(pred);

      // ✅ explainable coach: risk สูง -> บอกเหตุผล 2 ข้อ (rate-limit ด้วย sayCoach)
      if(pred && (pred.hazardRisk||0) >= 0.72){
        const because = explainTextTop2(pred);
        const hint = (pred.next5 && pred.next5[0]) ? pred.next5[0] : '';
        if(because && hint) sayCoach(`AI: ${hint} • ${because}`);
        else if(hint) sayCoach(`AI: ${hint}`);
      }
    }catch(e){}
  }

  function tick(){
    if(!playing) return;
    if(paused){ lastTick=nowMs(); setHUD(); requestAnimationFrame(tick); return; }

    const t=nowMs();
    const dt=Math.min(0.05, Math.max(0.001, (t-lastTick)/1000));
    lastTick=t;
    tLeft=Math.max(0, tLeft-dt);

    // run AI before spawn so director influences this frame
    aiTick(dt);

    spawnTick(dt);
    updateTargets(dt);
    updateRage(dt);
    updateMini(dt);

    setHUD();
    if(checkEnd()) return;
    requestAnimationFrame(tick);
  }

  DOC.addEventListener('visibilitychange', ()=>{ if(DOC.hidden && playing) showEnd('background'); });

  // start
  phaseEnter('Warm');
  sayCoach(proOn ? 'PRO HARD! เดือดขึ้นนิดแบบแฟร์ 🔥' : 'พร้อม! Warm → Trick → Boss');
  setHUD();
  requestAnimationFrame(tick);
}