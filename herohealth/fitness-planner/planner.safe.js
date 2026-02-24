// === /herohealth/fitness-planner/planner.safe.js ===
// Fitness Planner — Create MVP (Bloom: Create) — SAFE (non-module)
// Local-only, no App Script
// FIX: Try Today stuck (URL mapping + no popup-block)
// CONFIRMED: rhythm -> ../fitness/rhythm-boxer.html

'use strict';

(function(){
  const $ = (s)=>document.querySelector(s);

  function qs(name, def=null){
    const u = new URL(location.href);
    return u.searchParams.get(name) ?? def;
  }
  function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
  function todayKey(){
    const d=new Date();
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const da=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  }
  function mondayOfThisWeek(){
    const d = new Date();
    const day = (d.getDay()+6)%7; // Mon=0
    d.setDate(d.getDate()-day);
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const da=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  }
  function todayIndexMon0(){
    const d = new Date();
    return (d.getDay()+6)%7; // Mon=0
  }
  function safeParseJSON(s){ try{ return JSON.parse(s); }catch(_){ return null; } }
  function saveLS(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){ } }
  function loadLS(k,def){ try{ return safeParseJSON(localStorage.getItem(k)||'') ?? def; }catch(_){ return def; } }
  function dlText(filename, text){
    const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
  }
  function dlJson(filename, obj){
    dlText(filename, JSON.stringify(obj, null, 2));
  }
  function copyToClipboard(text){
    try{
      navigator.clipboard.writeText(text);
      toast('คัดลอกแล้ว ✅');
    }catch(_){
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('คัดลอกแล้ว ✅');
    }
  }
  function toast(msg){
    const t = document.createElement('div');
    t.style.cssText = `
      position:fixed; left:50%; bottom:18px;
      transform:translateX(-50%);
      padding:10px 12px; border-radius:14px;
      background:rgba(15,23,42,.92);
      border:1px solid rgba(255,255,255,.16);
      color:rgba(255,255,255,.94);
      font-weight:900; z-index:99999;
    `;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(()=>t.remove(), 1400);
  }

  // --------- URL mapping ----------
  const GAME_URL = {
    shadow:   '../fitness/shadow-breaker.html',
    rhythm:   '../fitness/rhythm-boxer.html', // ✅ confirmed
    jumpduck: '../fitness/jump-duck.html',
    balance:  '../fitness/balance-hold.html',
  };

  function withParams(url, params){
    const u = new URL(url, location.href);
    for(const k in params){
      if(params[k]!==undefined && params[k]!==null) u.searchParams.set(k, String(params[k]));
    }
    return u.toString();
  }

  // --------- registry ----------
  const GAMES = [
    { id:'shadow',   name:'Shadow Breaker', ico:'🥊',  goal:{speed: 1.00, endurance:0.35, balance:0.10}, baseLoad:1.10, energyF:1.05 },
    { id:'rhythm',   name:'Rhythm Boxer',   ico:'🎵',  goal:{speed: 0.60, endurance:0.85, balance:0.10}, baseLoad:1.00, energyF:1.00 },
    { id:'jumpduck', name:'Jump-Duck',      ico:'🦘',  goal:{speed: 0.45, endurance:0.95, balance:0.20}, baseLoad:1.05, energyF:1.05 },
    { id:'balance',  name:'Balance Hold',   ico:'⚖️',  goal:{speed: 0.15, endurance:0.35, balance:1.00}, baseLoad:0.95, energyF:0.95 },
  ];
  const DIFF = [
    { id:'easy',   name:'easy',   f:0.82, e:0.80 },
    { id:'normal', name:'normal', f:1.00, e:1.00 },
    { id:'hard',   name:'hard',   f:1.25, e:1.35 },
  ];
  const GOALS = [
    { id:'endurance', label:'ความทน',   ico:'🫀' },
    { id:'speed',     label:'ความไว',   ico:'⚡' },
    { id:'balance',   label:'ทรงตัว',   ico:'🧘' },
  ];

  const ENERGY_BUDGET = 10;

  function getGame(id){ return GAMES.find(g=>g.id===id) || GAMES[0]; }
  function getDiff(id){ return DIFF.find(d=>d.id===id) || DIFF[1]; }
  function isWeekend(dayIndex){ return (dayIndex===5 || dayIndex===6); }

  function loadPerItem(item){
    const g = getGame(item.game);
    const d = getDiff(item.diff);
    const min = clamp(item.min, 2, 20);
    return min * g.baseLoad * d.f;
  }
  function energyPerItem(item){
    const g = getGame(item.game);
    const d = getDiff(item.diff);
    const min = clamp(item.min, 2, 20);
    return (min * g.energyF * d.e) / 6;
  }

  function dayMinutes(day){ return (day.items||[]).reduce((s,it)=>s + clamp(it.min,2,20), 0); }
  function dayLoad(day){ return (day.items||[]).reduce((s,it)=>s + loadPerItem(it), 0); }
  function dayEnergy(day){ return (day.items||[]).reduce((s,it)=>s + energyPerItem(it), 0); }
  function dayHasHard(day){ return (day.items||[]).some(it => it.diff === 'hard'); }
  function dayHasAny(day){ return (day.items||[]).length>0; }

  function dayGoalVector(day){
    const v = { endurance:0, speed:0, balance:0 };
    for(const it of (day.items||[])){
      const g = getGame(it.game);
      const min = clamp(it.min,2,20);
      v.endurance += min * g.goal.endurance;
      v.speed     += min * g.goal.speed;
      v.balance   += min * g.goal.balance;
    }
    return v;
  }

  // --------- plan ----------
  const KEY_LAST = 'HHA_FITNESS_PLAN_LAST_V1';

  const runRaw = String(qs('run','play') || '').toLowerCase().trim();
  const runSafe = (runRaw === 'research' || runRaw === 'play') ? runRaw : 'play';

  const diffRaw = String(qs('diff','normal') || '').toLowerCase().trim();
  const diffSafe = (diffRaw === 'easy' || diffRaw === 'normal' || diffRaw === 'hard') ? diffRaw : 'normal';

  const RUNTIME = {
    pid: String(qs('pid','anon')),
    run: runSafe,
    seed: String(qs('seed', String(Date.now()))),
    diff: diffSafe,
    time: clamp(qs('time','80'), 20, 600),
  };

  const DEFAULT_PLAN = ()=>{
    const weekStart = mondayOfThisWeek();
    return {
      v: 1,
      pid: RUNTIME.pid,
      run: RUNTIME.run,
      seed: RUNTIME.seed,
      weekStart,
      goals: ['endurance'],
      constraints: {
        limitWeekday: 10,
        limitWeekend: 12,
        minDays: 4,
        restDays: 1
      },
      days: Array.from({length:7}).map((_,i)=>({ dayIndex: i, items: [] })),
      ts: Date.now()
    };
  };

  let PLAN = loadLS(KEY_LAST, null) || DEFAULT_PLAN();
  PLAN.pid = RUNTIME.pid;
  PLAN.run = RUNTIME.run;
  PLAN.seed = RUNTIME.seed;

  // --------- UI refs ----------
  const elGoalPills = $('#goalPills');
  const elWeekGrid  = $('#weekGrid');

  const elChipPid = $('#chipPid');
  const elChipRun = $('#chipRun');
  const elChipWeek= $('#chipWeek');

  const elLimitWeekday = $('#limitWeekday');
  const elLimitWeekend = $('#limitWeekend');
  const elMinDays = $('#minDays');
  const elRestDays = $('#restDays');

  const elScoreTotal = $('#scoreTotal');
  const elScoreBar = $('#scoreBar');
  const elBreakdown = $('#breakdown');
  const elCoachList = $('#coachList');

  const elSumMinutes = $('#sumMinutes');
  const elSumDays = $('#sumDays');
  const elAvgLoad = $('#avgLoad');

  const elMdPreview = $('#mdPreview');

  const elBadgeGrid = $('#badgeGrid');
  const elTodayLabel = $('#todayLabel');
  const elTryList = $('#tryList');

  function dayName(i){
    return ['จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์','อาทิตย์'][i] || `Day ${i+1}`;
  }

  function makeSelect(options, value){
    const sel = document.createElement('select');
    for(const op of options){
      const o = document.createElement('option');
      o.value = op.value;
      o.textContent = op.label;
      if(String(op.value)===String(value)) o.selected = true;
      sel.appendChild(o);
    }
    return sel;
  }

  function labelWrap(txt, el){
    const w = document.createElement('div');
    w.style.display = 'flex';
    w.style.flexDirection = 'column';
    w.style.gap = '6px';
    const lab = document.createElement('small');
    lab.textContent = txt;
    lab.style.color = 'rgba(148,163,184,.92)';
    lab.style.fontWeight = '1000';
    w.appendChild(lab);
    w.appendChild(el);
    return w;
  }
  function small(t){
    const s = document.createElement('small');
    s.textContent = t;
    return s;
  }

  function saveNow(){ saveLS(KEY_LAST, PLAN); }

  function syncControlsFromPlan(){
    elChipPid.textContent = `pid: ${PLAN.pid||'anon'}`;
    elChipRun.textContent = `run: ${PLAN.run||'play'}`;
    elChipWeek.textContent = `week: ${PLAN.weekStart || '—'}`;

    elLimitWeekday.value = String(PLAN.constraints.limitWeekday);
    elLimitWeekend.value = String(PLAN.constraints.limitWeekend);
    elMinDays.value = String(PLAN.constraints.minDays);
    elRestDays.value = String(PLAN.constraints.restDays);
  }
  function readControlsToPlan(){
    PLAN.constraints.limitWeekday = clamp(elLimitWeekday.value, 6, 20);
    PLAN.constraints.limitWeekend = clamp(elLimitWeekend.value, 6, 25);
    PLAN.constraints.minDays = clamp(elMinDays.value, 1, 7);
    PLAN.constraints.restDays = clamp(elRestDays.value, 0, 3);
    PLAN.ts = Date.now();
  }

  // -------- scoring / badges / coach ----------
  function scorePlan(plan){
    const c = plan.constraints;

    const minutesWeek = plan.days.reduce((s,d)=>s + dayMinutes(d), 0);
    const daysPlayed = plan.days.filter(dayHasAny).length;
    const loads = plan.days.map(dayLoad);
    const loadsPlayed = plan.days.filter(dayHasAny).map(dayLoad);
    const avgLoad = loadsPlayed.length ? (loadsPlayed.reduce((a,b)=>a+b,0)/loadsPlayed.length) : 0;

    let realism = 25;
    let overCount = 0;
    let energyOverCount = 0;

    for(let i=0;i<7;i++){
      const mins = dayMinutes(plan.days[i]);
      const energy = dayEnergy(plan.days[i]);
      if(mins<=0) continue;
      const limit = isWeekend(i) ? c.limitWeekend : c.limitWeekday;

      if(mins > limit){
        overCount++;
        realism -= Math.min(8, (mins - limit) * 2.2);
      }
      if(energy > ENERGY_BUDGET){
        energyOverCount++;
        realism -= Math.min(6, (energy - ENERGY_BUDGET) * 1.6);
      }
      if(dayHasHard(plan.days[i]) && mins >= (limit-0)){
        realism -= 2.5;
      }
    }
    realism = clamp(realism, 0, 25);

    let consistency = 0;
    const meet = daysPlayed >= c.minDays ? 1 : (daysPlayed / Math.max(1,c.minDays));
    consistency += 16 * meet;

    let gapPenalty = 0;
    let curGap = 0;
    for(let i=0;i<7;i++){
      if(dayHasAny(plan.days[i])){ curGap = 0; }
      else { curGap++; if(curGap>=3) gapPenalty += 1.8; }
    }
    let clusterPenalty = 0;
    for(let i=1;i<7;i++){
      if(dayHasAny(plan.days[i]) && dayHasAny(plan.days[i-1])) clusterPenalty += 1.2;
    }
    consistency += (9 - gapPenalty - clusterPenalty);
    consistency = clamp(consistency, 0, 25);

    let balanced = 30;
    for(let i=1;i<7;i++){
      const a = loads[i-1], b = loads[i];
      const da = Math.abs(b-a);
      if(da > 8) balanced -= 2.2;
      if(da > 12) balanced -= 2.2;

      const heavyA = a >= 10;
      const heavyB = b >= 10;
      if(heavyA && heavyB) balanced -= 2.2;

      if(dayHasHard(plan.days[i]) && dayHasHard(plan.days[i-1])) balanced -= 2.8;
    }
    const rest = 7 - daysPlayed;
    const restTarget = c.restDays;
    balanced -= Math.abs(rest - restTarget) * 1.2;
    balanced = clamp(balanced, 0, 30);

    const want = { endurance:0, speed:0, balance:0 };
    const goals = plan.goals || ['endurance'];
    for(const g of goals) want[g] = 1;
    const wSum = want.endurance + want.speed + want.balance;
    want.endurance /= wSum; want.speed /= wSum; want.balance /= wSum;

    const agg = { endurance:0, speed:0, balance:0 };
    for(const d of plan.days){
      const v = dayGoalVector(d);
      agg.endurance += v.endurance;
      agg.speed     += v.speed;
      agg.balance   += v.balance;
    }
    const aSum = agg.endurance + agg.speed + agg.balance;
    const ratio = aSum ? {
      endurance: agg.endurance/aSum,
      speed: agg.speed/aSum,
      balance: agg.balance/aSum
    } : { endurance:0, speed:0, balance:0 };

    const dist = Math.abs(ratio.endurance - want.endurance)
               + Math.abs(ratio.speed     - want.speed)
               + Math.abs(ratio.balance   - want.balance);

    let goalFit = 20 - dist * 12;
    if(goals.includes('balance') && ratio.balance < 0.18 && daysPlayed>0) goalFit -= 2.0;
    if(goals.includes('speed')   && ratio.speed   < 0.22 && daysPlayed>0) goalFit -= 2.0;
    if(goals.includes('endurance') && ratio.endurance < 0.22 && daysPlayed>0) goalFit -= 2.0;
    goalFit = clamp(goalFit, 0, 20);

    const total = Math.round(balanced + consistency + realism + goalFit);

    return {
      total,
      parts: { balanced, consistency, realism, goalFit },
      meta: { minutesWeek, daysPlayed, avgLoad, overCount, energyOverCount, rest, ratio, want }
    };
  }

  function computeBadges(plan, sc){
    const c = plan.constraints;

    let hardStreak = 0, hardMax = 0;
    for(let i=0;i<7;i++){
      if(dayHasHard(plan.days[i])){ hardStreak++; hardMax = Math.max(hardMax, hardStreak); }
      else hardStreak = 0;
    }
    let energyBad = 0;
    for(let i=0;i<7;i++){
      const e = dayEnergy(plan.days[i]);
      if(e > ENERGY_BUDGET) energyBad++;
    }
    const balancedWeek = (hardMax <= 1) && (energyBad === 0) && (sc.meta.overCount===0);
    const consistencyHero = sc.meta.daysPlayed >= Math.max(c.minDays, 5);
    const realisticPlanner = (sc.meta.overCount===0) && (sc.meta.energyOverCount<=1) && (sc.meta.avgLoad <= 11.5 || sc.meta.daysPlayed===0);

    return [
      { id:'balanced', name:'Balanced Week', on: balancedWeek, desc:'ไม่มี hard ติดกัน + ไม่เกิน Energy/day + ไม่เกินเวลาต่อวัน' },
      { id:'consistency', name:'Consistency Hero', on: consistencyHero, desc:'เล่นสม่ำเสมอ ≥ 5 วัน/สัปดาห์ (หรือมากกว่าขั้นต่ำ)' },
      { id:'realistic', name:'Realistic Planner', on: realisticPlanner, desc:'แผนทำได้จริง ไม่หนักเกินไป เหมาะกับวันเรียน' },
    ];
  }

  function coachReasons(plan, sc){
    const out = [];
    const { minutesWeek, daysPlayed, avgLoad, overCount, energyOverCount, rest, ratio, want } = sc.meta;
    const c = plan.constraints;

    if(daysPlayed >= c.minDays) out.push({ cls:'good', t:`ดีมาก! วางแผนเล่น ${daysPlayed} วัน/สัปดาห์ ตามขั้นต่ำ ${c.minDays} วัน ✅`});
    else out.push({ cls:'warn', t:`ตอนนี้เล่น ${daysPlayed} วัน ยังไม่ถึงขั้นต่ำ ${c.minDays} วัน ลองเพิ่มอีก 1 วันแบบ easy`});

    if(overCount===0) out.push({ cls:'good', t:`เวลาต่อวันไม่เกินข้อจำกัด (สมจริงสำหรับวันเรียน) 👍`});
    else out.push({ cls:'bad', t:`มี ${overCount} วันที่เกินเวลาที่ตั้งไว้ → ลดนาที/ลดเป็น easy เพื่อไม่โอเวอร์โหลด`});

    if(energyOverCount===0) out.push({ cls:'good', t:`Energy/day อยู่ในงบ (≤ ${ENERGY_BUDGET}) ช่วยกันล้า ✅`});
    else out.push({ cls:'warn', t:`มี ${energyOverCount} วันที่เกิน Energy/day → ลด hard หรือแบ่งเป็นเกมเบา ๆ`});

    let hardStreak = 0, hardMax = 0;
    for(let i=0;i<7;i++){
      if(dayHasHard(plan.days[i])){ hardStreak++; hardMax = Math.max(hardMax, hardStreak); }
      else hardStreak = 0;
    }
    if(hardMax>=2) out.push({ cls:'bad', t:`มีวัน hard ติดกัน ${hardMax} วัน เสี่ยงล้า แนะนำสลับเป็น normal/easy`});
    else if(hardMax===1) out.push({ cls:'good', t:`ใช้ hard ไม่ติดกัน = ท้าทายแต่ปลอดภัย 🎯`});

    const restTarget = c.restDays;
    if(Math.abs(rest-restTarget)<=1) out.push({ cls:'good', t:`วันพัก ${rest} วัน ใกล้เคียงที่แนะนำ (${restTarget}) ช่วยฟื้นตัว`});
    else if(rest < restTarget) out.push({ cls:'warn', t:`วันพักน้อยไป (${rest} วัน) ลองเว้น 1 วันเป็นพัก`});
    else out.push({ cls:'warn', t:`วันพักเยอะไป (${rest} วัน) ถ้าไหว เพิ่มอีก 1 วันเล่นเบา ๆ`});

    out.push({ cls:'good', t:`เป้าหมาย: ${plan.goals.map(g=>{
      const m = GOALS.find(x=>x.id===g);
      return `${m?.ico||''}${m?.label||g}`;
    }).join(' + ')}`});

    const pct = (x)=>Math.round(x*100);
    out.push({ cls:'warn', t:`สัดส่วนกิจกรรม: ทน ${pct(ratio.endurance)}% · ไว ${pct(ratio.speed)}% · ทรงตัว ${pct(ratio.balance)}%`});

    const needMore = [];
    if(plan.goals.includes('endurance') && ratio.endurance < want.endurance - 0.10) needMore.push('ความทน');
    if(plan.goals.includes('speed')     && ratio.speed     < want.speed     - 0.10) needMore.push('ความไว');
    if(plan.goals.includes('balance')   && ratio.balance   < want.balance   - 0.10) needMore.push('ทรงตัว');

    if(needMore.length) out.push({ cls:'warn', t:`เพื่อให้ตรงเป้ามากขึ้น ลองเพิ่ม: ${needMore.join(' + ')} (easy/normal)`});
    else if(daysPlayed>0) out.push({ cls:'good', t:`สัดส่วนกิจกรรมใกล้เคียงเป้าหมายแล้ว เยี่ยม!`});

    if(avgLoad > 11 && overCount===0) out.push({ cls:'warn', t:`แผนนี้ท้าทายมาก (load เฉลี่ย ${avgLoad.toFixed(1)}) ถ้าวันไหนเหนื่อย ลดเป็น easy ได้`});
    if(minutesWeek === 0) out.push({ cls:'bad', t:`ยังไม่เลือกเกมเลย ลองใส่ 1 เกมในวันแรก แล้วคะแนนจะขยับทันที`});

    return out.slice(0, 10);
  }

  function renderBadges(sc){
    const bs = computeBadges(PLAN, sc);
    elBadgeGrid.innerHTML = '';
    for(const b of bs){
      const div = document.createElement('div');
      div.className = 'bCard';
      div.innerHTML = `
        <div class="bTop">
          <div class="bName">${b.on ? '🏅' : '🎯'} ${b.name}</div>
          <div class="bState ${b.on?'on':'off'}">${b.on?'ได้แล้ว':'กำลังทำ'}</div>
        </div>
        <div class="bDesc">${b.desc}</div>
      `;
      elBadgeGrid.appendChild(div);
    }
  }

  function bestGoalHint(game){
    const m = game.goal;
    const arr = [
      {k:'ความทน', v:m.endurance},
      {k:'ความไว', v:m.speed},
      {k:'ทรงตัว', v:m.balance},
    ].sort((a,b)=>b.v-a.v);
    return `${arr[0].k}เด่น`;
  }

  function planToMarkdown(plan, sc, coach){
    const lines = [];
    lines.push(`# HeroHealth Fitness — 7-day Plan (Create)`);
    lines.push(`- date: ${todayKey()}`);
    lines.push(`- pid: ${plan.pid||'anon'}`);
    lines.push(`- run: ${plan.run||'play'}`);
    lines.push(`- weekStart: ${plan.weekStart}`);
    lines.push(`- goals: ${plan.goals.join(' + ')}`);
    lines.push(`- constraints: weekday<=${plan.constraints.limitWeekday}m, weekend<=${plan.constraints.limitWeekend}m, minDays=${plan.constraints.minDays}, restDays=${plan.constraints.restDays}`);
    lines.push(`- energyBudgetPerDay: ${ENERGY_BUDGET}`);
    lines.push('');

    lines.push(`## Plan Table`);
    lines.push(`| Day | Session | Minutes | Difficulty | Load | Energy | Goal hint |`);
    lines.push(`|---|---|---:|---|---:|---:|---|`);

    for(let i=0;i<7;i++){
      const d = plan.days[i];
      if(!d.items.length){
        lines.push(`| ${dayName(i)} | พัก | 0 | — | 0.0 | 0.0 | ฟื้นตัว |`);
        continue;
      }
      for(const it of d.items){
        const g = getGame(it.game);
        const mins = clamp(it.min,2,20);
        const diff = getDiff(it.diff).name;
        const load = loadPerItem(it).toFixed(1);
        const e = energyPerItem(it).toFixed(1);
        lines.push(`| ${dayName(i)} | ${g.name} | ${mins} | ${diff} | ${load} | ${e} | ${bestGoalHint(g)} |`);
      }
    }
    lines.push('');

    lines.push(`## Plan Score (0–100)`);
    lines.push(`- total: **${sc.total}**`);
    lines.push(`- balanced_load: ${Math.round(sc.parts.balanced)}/30`);
    lines.push(`- consistency: ${Math.round(sc.parts.consistency)}/25`);
    lines.push(`- realism: ${Math.round(sc.parts.realism)}/25`);
    lines.push(`- goal_fit: ${Math.round(sc.parts.goalFit)}/20`);
    lines.push(`- minutes_week: ${sc.meta.minutesWeek}`);
    lines.push(`- days_played: ${sc.meta.daysPlayed}`);
    lines.push(`- energyOverDays: ${sc.meta.energyOverCount}`);
    lines.push('');

    lines.push(`## Badges`);
    for(const b of computeBadges(plan, sc)){
      lines.push(`- ${b.on ? '🏅' : '🎯'} ${b.name}: ${b.on ? 'ได้แล้ว' : 'กำลังทำ'} — ${b.desc}`);
    }
    lines.push('');

    lines.push(`## Explainable Coach (เหตุผล/คำแนะนำ)`);
    for(const x of coach) lines.push(`- ${x.t}`);
    lines.push('');

    lines.push(`## Notes (Chapter 4)`);
    lines.push(`- Planner เป็นกิจกรรม “Create” (Bloom) ให้ผู้เรียนออกแบบแผน 7 วันภายใต้ข้อจำกัดเวลา/ความหนัก/ความต่อเนื่อง`);
    lines.push(`- ระบบให้คะแนน 4 มิติ (balanced load, consistency, realism, goal fit) และมี Energy budget/day กันโอเวอร์โหลด`);
    lines.push(`- ระบบให้เหตุผลแบบอธิบายได้ (explainable coach) เพื่อความโปร่งใส`);
    lines.push('');

    return lines.join('\n');
  }

  function exportMD(){
    const sc = scorePlan(PLAN);
    const coach = coachReasons(PLAN, sc);
    const md = planToMarkdown(PLAN, sc, coach);
    const fn = `HHA_plan_${todayKey()}_${PLAN.pid||'anon'}.md`;
    dlText(fn, md);
    toast('ดาวน์โหลด MD แล้ว ✅');
  }
  function exportJSON(){
    const fn = `HHA_plan_${todayKey()}_${PLAN.pid||'anon'}.json`;
    dlJson(fn, PLAN);
    toast('ดาวน์โหลด JSON แล้ว ✅');
  }

  // --- Try Today (FIX) ---
  function tryTodayGo(){
    const idx = todayIndexMon0();
    const d = PLAN.days[idx];
    if(!d || !d.items || !d.items.length){
      toast('วันนี้ไม่มีเกมในแผน');
      return;
    }
    const first = d.items[0];
    const url = GAME_URL[first.game];
    if(!url){
      toast('ยังไม่ได้ตั้ง URL เกม (ไปตั้ง GAME_URL ใน JS)');
      return;
    }

    const min = clamp(first.min, 2, 20);
    const diff = (first.diff==='easy' || first.diff==='normal' || first.diff==='hard') ? first.diff : 'normal';

    const params = {
      pid: PLAN.pid,
      run: (PLAN.run==='research' ? 'research' : 'play'),
      diff,
      time: String(min * 60), // ✅ seconds
      seed: PLAN.seed,
      view: qs('view', null),
      hub: new URL('../hub.html', location.href).toString(),
    };

    location.href = withParams(url, params);
  }

  function renderTryToday(){
    const idx = todayIndexMon0();
    elTodayLabel.textContent = `วันนี้: ${dayName(idx)} (Day ${idx+1})`;

    const d = PLAN.days[idx];
    elTryList.innerHTML = '';

    if(!d || !d.items || !d.items.length){
      elTryList.innerHTML = `<div class="mut">วันนี้ในแผนเป็น “พัก” หรือยังไม่ได้ใส่เกม</div>`;
      return;
    }

    for(const it of d.items){
      const g = getGame(it.game);
      const url = GAME_URL[it.game];
      const title = `${g.ico} ${g.name}`;

      const min = clamp(it.min, 2, 20);
      const diff = (it.diff==='easy' || it.diff==='normal' || it.diff==='hard') ? it.diff : 'normal';

      const params = {
        pid: PLAN.pid,
        run: (PLAN.run==='research' ? 'research' : 'play'),
        diff,
        time: String(min * 60),
        min: min,
        seed: PLAN.seed,
        hub: new URL('../hub.html', location.href).toString(),
        view: qs('view', null)
      };

      const li = document.createElement('div');
      li.className = 'tryItem';

      const left = document.createElement('div');
      left.className = 'l';
      left.innerHTML = `<div class="t">${title}</div><div class="m">${diff} · ${min} นาที</div>`;

      const right = document.createElement('div');
      right.className = 'r';

      if(url){
        const a = document.createElement('a');
        a.href = withParams(url, params);
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'เปิดเกม';
        right.appendChild(a);

        const a2 = document.createElement('a');
        a2.href = '#';
        a2.textContent = 'คัดลอกลิงก์';
        a2.addEventListener('click', (e)=>{
          e.preventDefault();
          copyToClipboard(withParams(url, params));
        });
        right.appendChild(a2);
      } else {
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'disabled';
        a.textContent = 'ตั้ง URL ก่อน';
        a.addEventListener('click', (e)=>{
          e.preventDefault();
          toast('ไปตั้งค่า GAME_URL ใน planner.safe.js ก่อนนะ');
        });
        right.appendChild(a);
      }

      li.appendChild(left);
      li.appendChild(right);
      elTryList.appendChild(li);
    }
  }

  // --- render goals + week ---
  function renderGoalPills(){
    elGoalPills.innerHTML = '';
    for(const g of GOALS){
      const on = PLAN.goals.includes(g.id) ? 1 : 0;
      const b = document.createElement('div');
      b.className = 'goal';
      b.dataset.on = String(on);
      b.innerHTML = `<span class="ico">${g.ico}</span><span>${g.label}</span>`;
      b.addEventListener('click', ()=>{
        const has = PLAN.goals.includes(g.id);
        if(has){
          if(PLAN.goals.length<=1){ toast('ต้องมีอย่างน้อย 1 เป้าหมาย'); return; }
          PLAN.goals = PLAN.goals.filter(x=>x!==g.id);
        } else {
          if(PLAN.goals.length>=2){ toast('เลือกได้สูงสุด 2 เป้าหมาย'); return; }
          PLAN.goals = PLAN.goals.concat([g.id]);
        }
        renderAll(); saveNow();
      });
      elGoalPills.appendChild(b);
    }
  }

  function renderWeekGrid(){
    elWeekGrid.innerHTML = '';

    PLAN.days.forEach((d, idx)=>{
      const dayEl = document.createElement('div');
      dayEl.className = 'day';

      const mins = dayMinutes(d);
      const load = dayLoad(d);
      const energy = dayEnergy(d);
      const limit = isWeekend(idx) ? PLAN.constraints.limitWeekend : PLAN.constraints.limitWeekday;

      let badgeClass = 'badge';
      let badgeText = 'พัก';
      if(mins>0){
        const over = mins > limit;
        if(over){ badgeClass += ' bad'; badgeText = `หนักเกิน (${mins}/${limit}m)`; }
        else if(dayHasHard(d) && mins>=limit-1){ badgeClass += ' warn'; badgeText = `หนัก (${mins}/${limit}m)`; }
        else { badgeClass += ' good'; badgeText = `${mins}/${limit}m`; }
      }

      const ePct = Math.round(clamp((energy/ENERGY_BUDGET)*100, 0, 160));
      let eCls = 'energy';
      if(energy > ENERGY_BUDGET*1.15) eCls += ' bad';
      else if(energy > ENERGY_BUDGET) eCls += ' warn';

      dayEl.innerHTML = `
        <div class="dh">
          <div>
            <div class="dttl">${dayName(idx)}</div>
            <div class="dmeta">วัน ${idx+1}/7 · ${isWeekend(idx)?'Weekend':'Weekday'} · load ${load.toFixed(1)}</div>
            <div class="${eCls}">
              <div class="erow">
                <div>Energy</div>
                <div><b>${energy.toFixed(1)}</b> / ${ENERGY_BUDGET}</div>
              </div>
              <div class="emeter"><div class="ebar" style="width:${ePct}%"></div></div>
            </div>
          </div>
          <div class="${badgeClass}">${badgeText}</div>
        </div>
        <div class="items" id="items-${idx}"></div>
        <div class="actions">
          <button class="primary" data-add="${idx}">+ เพิ่มเกม</button>
          <button data-clear="${idx}">ล้างวัน</button>
        </div>
      `;

      const itemsWrap = dayEl.querySelector(`#items-${idx}`);

      (d.items||[]).forEach((it, j)=>{
        const itemEl = document.createElement('div');
        itemEl.className = 'item';

        const selGame = makeSelect(
          GAMES.map(g=>({value:g.id, label:`${g.ico} ${g.name}`})),
          it.game
        );
        selGame.addEventListener('change', ()=>{
          it.game = selGame.value;
          renderAll(); saveNow();
        });

        const selDiff = makeSelect(
          DIFF.map(x=>({value:x.id, label:x.name})),
          it.diff
        );
        selDiff.addEventListener('change', ()=>{
          it.diff = selDiff.value;
          renderAll(); saveNow();
        });

        const selMin = makeSelect(
          [2,3,4,5,6,7,8,9,10,12,15,18,20].map(n=>({value:n, label:`${n} นาที`})),
          it.min
        );
        selMin.addEventListener('change', ()=>{
          it.min = clamp(selMin.value, 2, 20);
          renderAll(); saveNow();
        });

        const g = getGame(it.game);
        const d0 = getDiff(it.diff);
        const loadIt = loadPerItem(it);
        const eIt = energyPerItem(it);

        const left = document.createElement('div');
        left.className = 'row';
        left.appendChild(labelWrap('เกม', selGame));
        left.appendChild(small(`เหมาะกับ: ทน ${g.goal.endurance.toFixed(2)} · ไว ${g.goal.speed.toFixed(2)} · ทรงตัว ${g.goal.balance.toFixed(2)}`));

        const right = document.createElement('div');
        right.className = 'row';
        right.appendChild(labelWrap('ความยาก', selDiff));
        right.appendChild(labelWrap('เวลา', selMin));

        const rm = document.createElement('div');
        rm.className = 'rm';
        const rmBtn = document.createElement('button');
        rmBtn.textContent = 'ลบรายการนี้';
        rmBtn.addEventListener('click', ()=>{
          d.items.splice(j,1);
          renderAll(); saveNow();
        });
        rm.appendChild(rmBtn);

        itemEl.appendChild(left);
        itemEl.appendChild(right);
        itemEl.appendChild(rm);

        const sm = document.createElement('small');
        sm.style.gridColumn = '1 / -1';
        sm.textContent = `สรุป: ${g.name} · ${d0.name} · ${it.min} นาที · load ${loadIt.toFixed(1)} · energy ${eIt.toFixed(1)}`;
        itemEl.appendChild(sm);

        itemsWrap.appendChild(itemEl);
      });

      dayEl.querySelector(`[data-add="${idx}"]`).addEventListener('click', ()=>{
        if((d.items||[]).length>=2){ toast('วันหนึ่งใส่ได้สูงสุด 2 เกม'); return; }
        d.items.push({ game:'rhythm', diff:'normal', min:6 });
        renderAll(); saveNow();
      });
      dayEl.querySelector(`[data-clear="${idx}"]`).addEventListener('click', ()=>{
        d.items = [];
        renderAll(); saveNow();
      });

      elWeekGrid.appendChild(dayEl);
    });
  }

  function renderScore(){
    const sc = scorePlan(PLAN);

    elScoreTotal.textContent = String(sc.total);
    elScoreBar.style.width = `${clamp(sc.total,0,100)}%`;
    if(sc.total >= 80) elScoreBar.style.background = 'rgba(16,185,129,.85)';
    else if(sc.total >= 55) elScoreBar.style.background = 'rgba(251,191,36,.85)';
    else elScoreBar.style.background = 'rgba(239,68,68,.80)';

    elBreakdown.innerHTML = '';
    const parts = [
      { k:'Balanced load', v: sc.parts.balanced, max:30, d:'กระจายความหนัก ไม่ hard ติดกัน ลดเสี่ยงล้า' },
      { k:'Consistency',  v: sc.parts.consistency, max:25, d:'เล่นสม่ำเสมอครบตามขั้นต่ำ และไม่เว้นนานเกิน' },
      { k:'Realism',      v: sc.parts.realism, max:25, d:'เวลา/วันทำได้จริง + ไม่เกิน Energy/day' },
      { k:'Goal fit',     v: sc.parts.goalFit, max:20, d:'แผนสอดคล้องกับเป้าหมาย (ความทน-ความไว-ทรงตัว)' },
    ];
    for(const p of parts){
      const div = document.createElement('div');
      div.className = 'kpi';
      div.innerHTML = `
        <div class="k">${p.k}</div>
        <div class="v">${Math.round(p.v)}/${p.max}</div>
        <div class="d">${p.d}</div>
      `;
      elBreakdown.appendChild(div);
    }

    elSumMinutes.textContent = `${sc.meta.minutesWeek} นาที`;
    elSumDays.textContent = `${sc.meta.daysPlayed} วัน`;
    elAvgLoad.textContent = sc.meta.daysPlayed ? sc.meta.avgLoad.toFixed(1) : '0';

    renderBadges(sc);

    const coach = coachReasons(PLAN, sc);
    elCoachList.innerHTML = '';
    for(const x of coach){
      const li = document.createElement('li');
      li.className = x.cls;
      li.textContent = x.t;
      elCoachList.appendChild(li);
    }

    elMdPreview.value = planToMarkdown(PLAN, sc, coach);
  }

  // ---------- autofill ----------
  function autoFillPlan(){
    for(const d of PLAN.days) d.items = [];

    const pickForGoal = (goal)=>{
      if(goal==='balance') return 'balance';
      if(goal==='speed') return 'shadow';
      return 'jumpduck';
    };
    const supportForGoal = ()=> 'rhythm';

    const main = pickForGoal(PLAN.goals[0] || 'endurance');
    const sup  = supportForGoal(PLAN.goals[0] || 'endurance');

    const playIdx = [0,2,4,5]; // Mon/Wed/Fri/Sat

    for(const i of playIdx){
      const limit = isWeekend(i) ? PLAN.constraints.limitWeekend : PLAN.constraints.limitWeekday;
      const items = [];
      items.push({ game: main, diff: 'normal', min: Math.min(6, limit) });
      if(limit >= 10) items.push({ game: sup, diff: 'easy', min: 4 });

      if(PLAN.goals.length===2 && i===4){
        const main2 = pickForGoal(PLAN.goals[1]);
        items[0] = { game: main2, diff: 'normal', min: Math.min(6, limit) };
      }
      PLAN.days[i].items = items.slice(0,2);
    }

    const need = PLAN.constraints.minDays;
    let have = PLAN.days.filter(dayHasAny).length;
    if(have < need){
      const i = 6;
      const limit = isWeekend(i) ? PLAN.constraints.limitWeekend : PLAN.constraints.limitWeekday;
      PLAN.days[i].items = [{ game: 'rhythm', diff:'easy', min: Math.min(6, limit) }];
    }
    PLAN.ts = Date.now();
  }

  // --------- render all ----------
  function renderAll(){
    renderGoalPills();
    renderWeekGrid();
    renderScore();
    renderTryToday();
    saveNow();
  }

  // --------- events ----------
  function bindEvents(){
    $('#btnLoad').addEventListener('click', ()=>{
      const last = loadLS(KEY_LAST, null);
      if(!last){ toast('ยังไม่มีแผนที่บันทึกไว้'); return; }
      PLAN = last;
      PLAN.pid = RUNTIME.pid; PLAN.run = RUNTIME.run; PLAN.seed = RUNTIME.seed;
      syncControlsFromPlan();
      renderAll();
      toast('โหลดแผนล่าสุดแล้ว ✅');
    });

    $('#btnReset').addEventListener('click', ()=>{
      PLAN = DEFAULT_PLAN();
      syncControlsFromPlan();
      renderAll();
      saveNow();
      toast('เริ่มแผนใหม่ ✅');
    });

    $('#btnClearWeek').addEventListener('click', ()=>{
      for(const d of PLAN.days){ d.items = []; }
      renderAll(); saveNow();
      toast('ล้างทั้งสัปดาห์ ✅');
    });

    $('#btnAutoFill').addEventListener('click', ()=>{
      autoFillPlan();
      renderAll(); saveNow();
      toast('เติมแผนแนะนำแล้ว ✅');
    });

    $('#btnExportMD').addEventListener('click', ()=> exportMD());
    $('#btnExportMD2').addEventListener('click', ()=> exportMD());
    $('#btnExportJSON').addEventListener('click', ()=> exportJSON());
    $('#btnExportJSON2').addEventListener('click', ()=> exportJSON());
    $('#btnCopyMD').addEventListener('click', ()=> copyToClipboard(elMdPreview.value));

    $('#btnTryToday').addEventListener('click', ()=> tryTodayGo());

    elLimitWeekday.addEventListener('change', ()=>{ readControlsToPlan(); renderAll(); saveNow(); });
    elLimitWeekend.addEventListener('change', ()=>{ readControlsToPlan(); renderAll(); saveNow(); });
    elMinDays.addEventListener('change', ()=>{ readControlsToPlan(); renderAll(); saveNow(); });
    elRestDays.addEventListener('change', ()=>{ readControlsToPlan(); renderAll(); saveNow(); });
  }

  function bootImpl(){
    if(!$('#weekGrid')) return; // not this page
    bindEvents();
    syncControlsFromPlan();
    renderAll();
    saveNow();
  }

  window.HHA_FITNESS_PLANNER = {
    boot: bootImpl
  };
})();