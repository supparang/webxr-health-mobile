// === /herohealth/vr-plate/plate.safe.js ===
// Plate VR SAFE — CLASSROOM DEFAULT (P5-friendly)
// ✅ Deterministic RNG + AI hooks (prediction only)
// ✅ Fair MISS policy (warm start + soft miss) + Shield blocks wrong
// ✅ Kid-friendly End Summary (no JSON dump) + debug copy only when debug=1
// FULL v20260301-PLATE-CLASSROOM
'use strict';

export function boot(cfg = {}){
  const WIN = window, DOC = document;

  const qs = (k, d='')=>{ try{ return (new URL(location.href)).searchParams.get(k) ?? d; }catch(e){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); };
  const nowMs = ()=> (performance && performance.now) ? performance.now() : Date.now();
  const nowIso = ()=> new Date().toISOString();

  // ---------- mode ----------
  const mode = String(cfg.mode || qs('mode','classroom')).toLowerCase()==='challenge' ? 'challenge' : 'classroom';
  const view = String(cfg.view || qs('view','mobile')).toLowerCase();
  const runMode = String(cfg.run || qs('run','play')).toLowerCase();
  const diff = String(cfg.diff || qs('diff','normal')).toLowerCase();
  const plannedSec = clamp(cfg.time ?? qs('time','90'), 20, 9999);
  const seedStr = String(cfg.seed || qs('seed', String(Date.now())));
  const DEBUG = !!cfg.debug || (qs('debug','0')==='1');

  const pid = String(cfg.pid || qs('pid','anon')).trim()||'anon';
  const hubUrl = String(cfg.hub || qs('hub','../hub.html'));

  // ---------- deterministic rng ----------
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
  const g = xmur3(seedStr);
  const rng = sfc32(g(),g(),g(),g());
  const r01 = ()=> rng();
  const pick = (arr)=> arr[(r01()*arr.length)|0];

  // ---------- mount ----------
  const layer = cfg.mount || DOC.getElementById('plate-layer');
  if(!layer){ console.warn('[Plate] Missing mount/#plate-layer'); return; }

  // ---------- UI refs ----------
  const ui = {
    score: DOC.getElementById('uiScore'),
    combo: DOC.getElementById('uiCombo'),
    comboMax: DOC.getElementById('uiComboMax'),
    miss: DOC.getElementById('uiMiss'),
    time: DOC.getElementById('uiTime'),
    acc: DOC.getElementById('uiAcc'),
    grade: DOC.getElementById('uiGrade'),

    plateHave: DOC.getElementById('uiPlateHave'),
    goalCount: DOC.getElementById('uiGoalCount'),
    goalFill: DOC.getElementById('uiGoalFill'),
    goalTitle: DOC.getElementById('uiGoalTitle'),

    fever: DOC.getElementById('uiFever'),
    feverFill: DOC.getElementById('uiFeverFill'),
    shield: DOC.getElementById('uiShield'),

    g1: DOC.getElementById('uiG1'),
    g2: DOC.getElementById('uiG2'),
    g3: DOC.getElementById('uiG3'),
    g4: DOC.getElementById('uiG4'),
    g5: DOC.getElementById('uiG5'),

    coachMsg: DOC.getElementById('coachMsg'),
    endWrap: DOC.getElementById('endOverlay'),
    endTitle: DOC.getElementById('endTitle'),
    endSub: DOC.getElementById('endSub'),
    endGrade: DOC.getElementById('endGrade'),
    endScore: DOC.getElementById('endScore'),
    endOk: DOC.getElementById('endOk'),
    endWrong: DOC.getElementById('endWrong'),
    endMiss: DOC.getElementById('endMiss'),

    kidLearn: DOC.getElementById('kidLearn'),
    kidGood: DOC.getElementById('kidGood'),
    kidFix: DOC.getElementById('kidFix'),

    btnCopy: DOC.getElementById('btnCopy'),
    btnReplay: DOC.getElementById('btnReplay'),
    btnNextCooldown: DOC.getElementById('btnNextCooldown'),
    btnBackHub2: DOC.getElementById('btnBackHub2'),
  };

  function coach(msg, mood='neutral'){
    if(ui.coachMsg && msg) ui.coachMsg.textContent = String(msg);
    try{ WIN.dispatchEvent(new CustomEvent('hha:coach', { detail:{ msg:String(msg||''), mood:String(mood||'neutral') } })); }catch(e){}
  }

  // ---------- Thai 5 food groups mapping (ตามที่ล็อกไว้) ----------
  const GROUPS = [
    { id:1, name:'หมู่ 1 โปรตีน', items:['🍗','🥚','🐟','🥛','🥜'] },
    { id:2, name:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚','🍞','🥔','🍜','🥖'] },
    { id:3, name:'หมู่ 3 ผัก', items:['🥦','🥬','🥕','🥒','🌽'] },
    { id:4, name:'หมู่ 4 ผลไม้', items:['🍌','🍎','🍊','🍉','🍇'] },
    { id:5, name:'หมู่ 5 ไขมัน', items:['🥑','🫒','🧈','🥥','🧀'] },
  ];

  // ---------- tuning ----------
  // base diff
  let spawnBase = 0.80;
  let ttl = 2.8;
  let missLimit = 12;

  if(diff==='easy'){ spawnBase=0.68; ttl=3.1; missLimit=16; }
  if(diff==='hard'){ spawnBase=0.95; ttl=2.35; missLimit=9; }
  if(view==='cvr'||view==='vr') ttl += 0.15;

  // classroom modifiers (P5-friendly)
  const warmStartSec = (mode==='classroom') ? 10 : 0;
  const softMissWindowSec = (mode==='classroom') ? 12 : 0;   // ช่วงต้น “หมดเวลา” ไม่ลงโทษแรง
  const shieldStart = (mode==='classroom') ? 1 : 0;          // กันพลาด “เลือกผิด” 1 ครั้ง
  const shieldMax = (mode==='classroom') ? 3 : 2;

  if(mode==='classroom'){
    // ลดความหนาแน่น & เพิ่มเวลาอยู่ของเป้า
    spawnBase *= 0.86;
    ttl += 0.35;
    missLimit += 4;
  }

  // ---------- game state ----------
  const startTimeIso = nowIso();
  let playing=true;
  let paused=false;
  let tLeft=plannedSec;
  let elapsed=0;
  let lastTick=nowMs();

  // pause hooks
  WIN.__PLATE_SET_PAUSED__ = (on)=>{ paused=!!on; lastTick=nowMs(); };

  WIN.addEventListener('hha:pause', ()=>{ paused=true; WIN.__PLATE_SET_PAUSED__(true); }, { passive:true });
  WIN.addEventListener('hha:resume', ()=>{ paused=false; WIN.__PLATE_SET_PAUSED__(false); }, { passive:true });

  // scoring
  let score=0;
  let combo=0, bestCombo=0;

  // correctness counts
  let ok=0, wrong=0, miss=0;
  let totalShots=0;

  // fever/shield (classroom feedback)
  let fever=0;           // 0..100
  let shield=clamp(shieldStart, 0, shieldMax);

  // target plate groups progress (collected at least 1 from each)
  const haveGroup = {1:0,2:0,3:0,4:0,5:0};

  // mission: current target group (rotate)
  let targetGroup = pick(GROUPS);

  // spawn objects
  const foods = new Map();
  let idSeq=1;

  function layerRect(){ return layer.getBoundingClientRect(); }

  function gradeFromScore(){
    const played = Math.max(1, plannedSec - tLeft);
    const sps = score/played;
    const x = sps*10 - miss*0.45;
    if(x>=70) return 'S';
    if(x>=55) return 'A';
    if(x>=40) return 'B';
    if(x>=28) return 'C';
    return 'D';
  }

  function accPct(){
    const tot = Math.max(1, ok+wrong);
    return Math.round((ok/tot)*100);
  }

  function addFever(v){
    fever = clamp(fever + v, 0, 100);
  }
  function addShield(v){
    shield = clamp(shield + v, 0, shieldMax);
  }

  function setHUD(){
    if(ui.score) ui.score.textContent = String(score|0);
    if(ui.combo) ui.combo.textContent = String(combo|0);
    if(ui.comboMax) ui.comboMax.textContent = String(bestCombo|0);
    if(ui.miss) ui.miss.textContent = String(miss|0);
    if(ui.time) ui.time.textContent = String(Math.ceil(tLeft));
    if(ui.acc) ui.acc.textContent = `${accPct()}%`;
    if(ui.grade) ui.grade.textContent = gradeFromScore();

    // plate progress: count unique groups achieved
    const plateHave = (haveGroup[1]>0) + (haveGroup[2]>0) + (haveGroup[3]>0) + (haveGroup[4]>0) + (haveGroup[5]>0);
    if(ui.plateHave) ui.plateHave.textContent = String(plateHave);
    if(ui.goalCount) ui.goalCount.textContent = `${plateHave}/5`;
    if(ui.goalFill) ui.goalFill.style.width = `${clamp((plateHave/5)*100,0,100)}%`;
    if(ui.goalTitle) ui.goalTitle.textContent = (plateHave>=5) ? 'ครบแล้ว! ลองทำคอมโบต่อ ✨' : 'เติมจานให้ครบ 5 หมู่';

    if(ui.fever) ui.fever.textContent = `${Math.round(fever)}%`;
    if(ui.feverFill) ui.feverFill.style.width = `${clamp(fever,0,100)}%`;
    if(ui.shield) ui.shield.textContent = String(shield|0);

    if(ui.g1) ui.g1.textContent = String(haveGroup[1]|0);
    if(ui.g2) ui.g2.textContent = String(haveGroup[2]|0);
    if(ui.g3) ui.g3.textContent = String(haveGroup[3]|0);
    if(ui.g4) ui.g4.textContent = String(haveGroup[4]|0);
    if(ui.g5) ui.g5.textContent = String(haveGroup[5]|0);

    // optional event for external hud bridges
    try{
      WIN.dispatchEvent(new CustomEvent('hha:score', {
        detail:{ feverPct: fever, shield, score, combo, miss, ok, wrong }
      }));
    }catch(e){}
  }

  // ---------- helpers ----------
  function guessGroupIdFromEmoji(emoji){
    for(const g of GROUPS){
      if(g.items.includes(emoji)) return g.id;
    }
    return 0;
  }
  function isCorrectEmojiForTarget(emoji){
    return (targetGroup?.items || []).includes(emoji);
  }

  // ---------- spawn safe area (avoid top HUD/bottom controls) ----------
  function getSpawnSafe(){
    const r = layerRect();
    const pad = 18;
    // reserve top ~220px (HUD) and bottom ~200px (controls) on mobile
    const topBan = (view==='mobile') ? 230 : 170;
    const botBan = (view==='mobile') ? 210 : 170;

    const xMin = pad;
    const xMax = Math.max(pad+120, r.width - pad);
    const yMin = clamp(pad + topBan, pad, Math.max(pad, r.height - botBan - 160));
    const yMax = clamp(r.height - (pad + botBan), yMin + 160, r.height - pad);

    return { xMin, xMax, yMin, yMax, w:r.width, h:r.height };
  }

  function makeFood(emoji, ttlSec, kind){
    const id=String(idSeq++);
    const el=DOC.createElement('div');
    el.className='plateTarget';
    el.textContent=emoji;
    el.dataset.id=id;
    el.dataset.kind=kind;

    const safe=getSpawnSafe();
    const rPad = (view==='mobile') ? 30 : 34;

    const x = (safe.xMin+rPad) + r01()*Math.max(1, (safe.xMax-safe.xMin) - rPad*2);
    const y = (safe.yMin+rPad) + r01()*Math.max(1, (safe.yMax-safe.yMin) - rPad*2);

    el.style.left=`${x}px`;
    el.style.top =`${y}px`;

    layer.appendChild(el);

    const born=nowMs();
    const ttl=Math.max(1.2, ttlSec)*1000;
    const obj={ id, el, emoji, born, ttl, kind, promptMs: nowMs() };
    foods.set(id,obj);

    // AI spawn
    try{ cfg.ai?.onSpawn?.(kind, { id, emoji, ttlSec }); }catch(e){}
    return obj;
  }

  function removeFood(id){
    const f=foods.get(String(id));
    if(!f) return;
    foods.delete(String(id));
    try{ f.el.remove(); }catch(e){}
  }

  // ---------- input ----------
  function onHitFood(f){
    const correct = isCorrectEmojiForTarget(f.emoji);
    totalShots++;

    if(correct){
      ok++;
      combo++; bestCombo=Math.max(bestCombo, combo);
      let add = 10 + Math.min(10, combo);
      if(fever>=80) add = Math.round(add * 1.15);
      score += add;

      addFever(7.5);
      if(combo===3) coach('ดีมาก! คอมโบเริ่มมาแล้ว 🔥','happy');
      if(combo===6) coach('เก่งมาก! ยิง/แตะได้ต่อเนื่องเลย ✨','happy');

      // plate progress
      const gid = guessGroupIdFromEmoji(f.emoji);
      if(gid) haveGroup[gid] = (haveGroup[gid]||0) + 1;

      // rotate mission every 5 correct
      if(ok % 5 === 0){
        targetGroup = pick(GROUPS);
        coach(`เปลี่ยนหมู่เป้าหมาย ➜ ${targetGroup.name}`,'neutral');
      }

      try{ cfg.ai?.onHit?.('ok', { id:f.id, emoji:f.emoji, combo }); }catch(e){}
    } else {
      // ✅ Classroom: shield can block wrong
      if(mode==='classroom' && shield>0){
        shield--;
        coach('บล็อกได้! ลองดู “หมู่เป้าหมาย” แล้วแตะใหม่ 🛡️','neutral');
        try{ cfg.ai?.onHit?.('wrong_blocked', { id:f.id, emoji:f.emoji }); }catch(e){}
      }else{
        wrong++;
        miss++;
        combo=0;
        score = Math.max(0, score - 6);
        addFever(-10);
        coach('ไม่เป็นไร ลองดูหมู่เป้าหมายด้านบนแล้วเลือกใหม่ 😊','sad');
        try{ cfg.ai?.onHit?.('wrong', { id:f.id, emoji:f.emoji }); }catch(e){}
      }
    }

    removeFood(f.id);
  }

  // pointerdown (pc/mobile)
  layer.addEventListener('pointerdown', (ev)=>{
    if(!playing || paused) return;
    const el = ev.target?.closest?.('.plateTarget');
    if(!el) return;
    const f = foods.get(String(el.dataset.id));
    if(f) onHitFood(f);
  }, { passive:true });

  // crosshair shoot (VR/cVR)
  function pickClosestToCenter(lockPx){
    lockPx = clamp(lockPx ?? 56, 16, 160);
    const r=layerRect();
    const cx=r.left + r.width/2;
    const cy=r.top  + r.height/2;

    let best=null, bestD=1e9;
    for(const f of foods.values()){
      const b=f.el.getBoundingClientRect();
      const fx=b.left + b.width/2;
      const fy=b.top  + b.height/2;
      const d=Math.hypot(fx-cx, fy-cy);
      if(d<bestD){ bestD=d; best=f; }
    }
    if(best && bestD<=lockPx) return best;
    return null;
  }
  WIN.addEventListener('hha:shoot', (ev)=>{
    if(!playing || paused) return;
    const lockPx = ev?.detail?.lockPx ?? 56;
    const f = pickClosestToCenter(lockPx);
    if(f) onHitFood(f);
    // ✅ Classroom: ยิงว่าง “ไม่ต้องนับ miss”
  });

  // ---------- end summary ----------
  const END_SENT_KEY='__HHA_PLATE_END_SENT__';
  function dispatchEndOnce(summary){
    try{
      if(WIN[END_SENT_KEY]) return;
      WIN[END_SENT_KEY]=1;
      WIN.dispatchEvent(new CustomEvent('hha:game-ended', { detail: summary || null }));
    }catch(e){}
  }

  function kidLines(summary){
    const plateHave = (haveGroup[1]>0) + (haveGroup[2]>0) + (haveGroup[3]>0) + (haveGroup[4]>0) + (haveGroup[5]>0);
    const learn = plateHave>=5
      ? 'ทำจานอาหารครบ 5 หมู่ได้แล้ว! รู้จักสมดุลอาหารมากขึ้น'
      : 'ฝึกเลือกอาหารให้ตรง “หมู่เป้าหมาย” และทำให้จานครบ 5 หมู่';

    const good = (bestCombo>=5)
      ? `ทำคอมโบได้สูงสุด ${bestCombo} ครั้ง เก่งมาก!`
      : `เลือกถูก ${ok} ครั้ง ความแม่นยำ ${accPct()}%`;

    const fix = (miss>=missLimit-2)
      ? 'ลองช้าลงนิดหนึ่ง ดูหมู่เป้าหมายก่อนแตะ จะพลาดน้อยลง'
      : (wrong>ok ? 'ดู “หมู่เป้าหมาย” ก่อนแตะ จะถูกมากขึ้น' : 'รักษาจังหวะต่อเนื่อง จะได้คอมโบสูงขึ้น');

    return { learn, good, fix };
  }

  function buildSummary(reason){
    const plateHave = (haveGroup[1]>0) + (haveGroup[2]>0) + (haveGroup[3]>0) + (haveGroup[4]>0) + (haveGroup[5]>0);

    return {
      projectTag: 'PlateVR',
      gameVersion: 'PlateVR_SAFE_CLASSROOM_2026-03-01',
      mode,
      device: view,
      runMode,
      diff,
      seed: seedStr,
      reason: String(reason||''),
      durationPlannedSec: plannedSec,
      durationPlayedSec: Math.round(plannedSec - tLeft),
      scoreFinal: score|0,
      ok: ok|0,
      wrong: wrong|0,
      missTotal: miss|0,
      comboMax: bestCombo|0,
      accuracyPct: accPct(),
      plateHave,
      shieldLeft: shield|0,
      feverPct: Math.round(fever),
      targetGroup: targetGroup?.name || '—',
      startTimeIso,
      endTimeIso: nowIso(),
      grade: gradeFromScore(),
      aiPredictionLast: (function(){ try{ return cfg.ai?.getPrediction?.() || null; }catch(e){ return null; } })()
    };
  }

  function wireEndButtons(summary){
    // replay
    ui.btnReplay && (ui.btnReplay.onclick = ()=>{
      try{
        const u = new URL(location.href);
        if(runMode!=='research'){
          u.searchParams.set('seed', String((Date.now() ^ (Math.random()*1e9))|0));
        }
        location.href = u.toString();
      }catch(e){ location.reload(); }
    });

    // back hub
    ui.btnBackHub2 && (ui.btnBackHub2.onclick = ()=> location.href = hubUrl);

    // debug copy
    if(ui.btnCopy){
      if(DEBUG){
        ui.btnCopy.classList.remove('is-hidden');
        ui.btnCopy.onclick = async ()=>{
          try{
            const text = JSON.stringify(summary, null, 2);
            await navigator.clipboard.writeText(text);
          }catch(e){
            try{ prompt('Copy Summary JSON:', JSON.stringify(summary,null,2)); }catch(_){}
          }
        };
      }else{
        ui.btnCopy.classList.add('is-hidden');
      }
    }

    // cooldown button (ถ้าคุณจะใช้เหมือนเกมอื่น: เปิดผ่าน ?cooldown=1)
    if(ui.btnNextCooldown){
      const cooldownRequired = (qs('cooldown','0')==='1') || (qs('cd','0')==='1');
      ui.btnNextCooldown.classList.toggle('is-hidden', !cooldownRequired);
      if(cooldownRequired){
        ui.btnNextCooldown.onclick = ()=>{
          const gate = new URL('../warmup-gate.html', location.href);
          gate.searchParams.set('gatePhase','cooldown');
          gate.searchParams.set('cat','nutrition');
          gate.searchParams.set('theme','plate');
          gate.searchParams.set('pid', pid);
          gate.searchParams.set('hub', hubUrl);
          gate.searchParams.set('next', hubUrl);

          // passthrough common
          const sp = new URL(location.href).searchParams;
          ['run','diff','time','seed','studyId','phase','conditionGroup','view','log','mode','cdnext']
            .forEach(k=>{ const v=sp.get(k); if(v!=null && v!=='') gate.searchParams.set(k,v); });

          location.href = gate.toString();
        };
      }
    }
  }

  function showEnd(reason){
    playing=false;
    paused=false;

    for(const f of foods.values()){ try{ f.el.remove(); }catch(e){} }
    foods.clear();

    const summary = buildSummary(reason);

    // AI onEnd
    try{
      const aiEnd = cfg.ai?.onEnd?.(summary);
      if(aiEnd) summary.aiEnd = aiEnd;
    }catch(e){}

    WIN.__HHA_LAST_SUMMARY = summary;
    dispatchEndOnce(summary);

    // UI end
    if(ui.endWrap){
      ui.endWrap.classList.add('show');
      ui.endWrap.setAttribute('aria-hidden','false');

      ui.endTitle && (ui.endTitle.textContent = 'จบเกม 🎉');
      ui.endSub && (ui.endSub.textContent = `โหมด=${mode} | grade=${summary.grade} | time=${summary.durationPlayedSec}s`);
      ui.endGrade && (ui.endGrade.textContent = summary.grade || '—');
      ui.endScore && (ui.endScore.textContent = String(summary.scoreFinal|0));
      ui.endOk && (ui.endOk.textContent = String(summary.ok|0));
      ui.endWrong && (ui.endWrong.textContent = String(summary.wrong|0));
      ui.endMiss && (ui.endMiss.textContent = String(summary.missTotal|0));

      const kid = kidLines(summary);
      ui.kidLearn && (ui.kidLearn.textContent = kid.learn);
      ui.kidGood && (ui.kidGood.textContent = kid.good);
      ui.kidFix && (ui.kidFix.textContent = kid.fix);

      wireEndButtons(summary);
    }
  }

  // ---------- spawn loop ----------
  let spawnAcc=0;

  function currentSpawnBase(){
    if(mode!=='classroom') return spawnBase;
    if(elapsed < warmStartSec) return spawnBase * 0.70;    // ช่วงแรกเบาลง
    return spawnBase;
  }
  function currentTTL(){
    if(mode!=='classroom') return ttl;
    if(elapsed < warmStartSec) return ttl + 0.40;          // ช่วงแรกอยู่นานขึ้น
    return ttl;
  }

  function spawnTick(dt){
    spawnAcc += currentSpawnBase() * dt;

    while(spawnAcc >= 1){
      spawnAcc -= 1;

      // correct vs distractor
      const wantCorrect = (r01() < 0.68);

      let emoji='🍚';
      if(wantCorrect){
        emoji = pick(targetGroup.items);
      }else{
        const others = GROUPS.filter(g=>g.id!==targetGroup.id);
        emoji = pick(pick(others).items);
      }

      // mark kind for AI (ok-target vs distractor)
      const kind = wantCorrect ? 'target' : 'distractor';
      makeFood(emoji, currentTTL(), kind);
    }
  }

  function updateFoods(){
    const t=nowMs();
    for(const f of Array.from(foods.values())){
      const age=t - f.born;
      if(age >= f.ttl){
        try{ cfg.ai?.onExpire?.(f.kind, { id:f.id, emoji:f.emoji }); }catch(e){}

        // ✅ Classroom: soft-miss for timeouts in early window
        if(mode==='classroom' && elapsed < softMissWindowSec){
          // ไม่เพิ่ม miss หนัก ๆ — แค่ลดคะแนนนิดเดียว + coach ช่วย
          score = Math.max(0, score - 2);
          combo = 0;
          if(elapsed < 6) coach('ลองแตะให้ทันนะ ไม่เป็นไร 💪','neutral');
        }else{
          miss++;
          wrong++;
          score = Math.max(0, score - 4);
          combo=0;
        }

        removeFood(f.id);
      }
    }
  }

  function checkEnd(){
    if(tLeft<=0){ showEnd('time'); return true; }
    if(miss>=missLimit){ showEnd('miss-limit'); return true; }
    return false;
  }

  // ---------- main tick ----------
  function tick(){
    if(!playing) return;

    if(paused){
      lastTick=nowMs();
      setHUD();
      requestAnimationFrame(tick);
      return;
    }

    const t=nowMs();
    const dt=Math.min(0.05, Math.max(0.001, (t-lastTick)/1000));
    lastTick=t;

    tLeft=Math.max(0, tLeft - dt);
    elapsed += dt;

    // fever decay (gentle)
    fever = clamp(fever - dt*3.2, 0, 100);

    spawnTick(dt);
    updateFoods();

    // AI tick (prediction only)
    try{
      const pred = cfg.ai?.onTick?.(dt, { miss, ok, wrong, combo, shield, fever }) || null;
      // (ถ้าจะโชว์ HUD risk เพิ่มภายหลังได้)
      void pred;
    }catch(e){}

    setHUD();
    if(checkEnd()) return;
    requestAnimationFrame(tick);
  }

  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.hidden && playing){ showEnd('background'); }
  });

  try{ WIN[END_SENT_KEY]=0; }catch(e){}
  coach(mode==='classroom' ? 'โหมด Classroom: ค่อย ๆ เลือกให้ตรงหมู่เป้าหมาย 😊' : 'โหมด Challenge: พร้อมลุย!','neutral');
  setHUD();
  requestAnimationFrame(tick);
}