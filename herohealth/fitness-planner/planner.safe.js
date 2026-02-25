// === /herohealth/fitness-planner/planner.safe.js ===
// Fitness Planner — Create MVP (Bloom: Create) — SAFE (non-module)
// A1: URL mapping persistent + TryToday works
// A2: Auto Storyboard Generator (Create)
// A3: Sequential Play (1–2 games/day) via hub back-link to planner with next pointer

'use strict';

(function(){
  const $ = (s)=>document.querySelector(s);

  function qs(name, def=null){
    const u = new URL(location.href);
    return u.searchParams.get(name) ?? def;
  }
  function setQS(url, key, val){
    const u = new URL(url, location.href);
    if(val===null || val===undefined || val==='') u.searchParams.delete(key);
    else u.searchParams.set(key, String(val));
    return u.toString();
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
  function dlJson(filename, obj){ dlText(filename, JSON.stringify(obj, null, 2)); }

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

  function copyToClipboard(text){
    try{
      navigator.clipboard.writeText(text);
      toast('คัดลอกแล้ว ✅');
    }catch(_){
      const ta=document.createElement('textarea');
      ta.value=text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
      toast('คัดลอกแล้ว ✅');
    }
  }

  function withParams(url, params){
    const u = new URL(url, location.href);
    for(const k in params){
      if(params[k]!==undefined && params[k]!==null && params[k]!=='' ) u.searchParams.set(k, String(params[k]));
    }
    return u.toString();
  }

  // =====================
  // URL mapping (persistent)
  // =====================
  const KEY_URLS = 'HHA_FITNESS_GAME_URLS_V1';
  const DEFAULT_URLS = {
    shadow:   '../fitness/shadow-breaker.html',
    rhythm:   '../fitness/rhythm-boxer.html',
    jumpduck: '../fitness/jump-duck.html',
    balance:  '../fitness/balance-hold.html',
  };

  function loadUrls(){
    const x = loadLS(KEY_URLS, null);
    if(!x || typeof x !== 'object') return {...DEFAULT_URLS};
    return {
      shadow:   String(x.shadow   || DEFAULT_URLS.shadow),
      rhythm:   String(x.rhythm   || DEFAULT_URLS.rhythm),
      jumpduck: String(x.jumpduck || DEFAULT_URLS.jumpduck),
      balance:  String(x.balance  || DEFAULT_URLS.balance),
    };
  }
  function saveUrls(u){
    saveLS(KEY_URLS, {
      shadow: String(u.shadow||''),
      rhythm: String(u.rhythm||''),
      jumpduck: String(u.jumpduck||''),
      balance: String(u.balance||''),
      ts: Date.now()
    });
  }

  let GAME_URL = loadUrls();
  function gameUrl(id){
    const u = GAME_URL[id];
    if(!u) return '';
    return String(u).trim();
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
  const KEY_STORY = 'HHA_FITNESS_STORY_LAST_V1';

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
    view: qs('view', null),
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
      constraints: { limitWeekday: 10, limitWeekend: 12, minDays: 4, restDays: 1 },
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

  const elStoryPreview = $('#storyPreview');

  // Next panel A3
  const elNextPanel = $('#nextPanel');
  const elNextTitle = $('#nextTitle');
  const elNextHint = $('#nextHint');

  // Modal refs
  const elUrlModal = $('#urlModal');
  const elUrlShadow = $('#urlShadow');
  const elUrlRhythm = $('#urlRhythm');
  const elUrlJump = $('#urlJump');
  const elUrlBalance = $('#urlBalance');

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
      if(dayHasHard(plan.days[i]) && mins >= (limit-0)) realism -= 2.5;
    }
    realism = clamp(realism, 0, 25);

    let consistency = 0;
    const meet = daysPlayed >= c.minDays ? 1 : (daysPlayed / Math.max(1,c.minDays));
    consistency += 16 * meet;

    let gapPenalty = 0;
    let curGap = 0;
    for(let i=0;i<7;i++){
      if(dayHasAny(plan.days[i])) curGap = 0;
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
      if(dayEnergy(plan.days[i]) > ENERGY_BUDGET) energyBad++;
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
    const { daysPlayed, avgLoad, overCount, energyOverCount, rest, ratio, want } = sc.meta;
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

    const pct = (x)=>Math.round(x*100);
    out.push({ cls:'warn', t:`สัดส่วนกิจกรรม: ทน ${pct(ratio.endurance)}% · ไว ${pct(ratio.speed)}% · ทรงตัว ${pct(ratio.balance)}%`});

    const needMore = [];
    if(plan.goals.includes('endurance') && ratio.endurance < want.endurance - 0.10) needMore.push('ความทน');
    if(plan.goals.includes('speed')     && ratio.speed     < want.speed     - 0.10) needMore.push('ความไว');
    if(plan.goals.includes('balance')   && ratio.balance   < want.balance   - 0.10) needMore.push('ทรงตัว');
    if(needMore.length) out.push({ cls:'warn', t:`เพื่อให้ตรงเป้ามากขึ้น ลองเพิ่ม: ${needMore.join(' + ')} (easy/normal)`});
    else if(daysPlayed>0) out.push({ cls:'good', t:`สัดส่วนกิจกรรมใกล้เคียงเป้าหมายแล้ว เยี่ยม!`});

    if(avgLoad > 11 && overCount===0) out.push({ cls:'warn', t:`แผนนี้ท้าทายมาก (load เฉลี่ย ${avgLoad.toFixed(1)}) ถ้าวันไหนเหนื่อย ลดเป็น easy ได้`});
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

  // =====================
  // A2: Storyboard Generator
  // =====================
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(s){
    s = String(s||'');
    let h = 2166136261 >>> 0;
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function pick(rng, arr){
    if(!arr.length) return null;
    return arr[Math.floor(rng()*arr.length)];
  }

  const STORY_THEMES = [
    'ฮีโร่พลังปอด', 'สปีดสายฟ้า', 'สมดุลนักสู้', 'ภารกิจโรงเรียนแอคทีฟ',
    'ท้าคอมโบ', 'วันแข่งกับตัวเอง', 'แผนแบบมือโปร', 'โหมดช่วยเพื่อน'
  ];
  const STORY_LOC = ['หน้าห้องเรียน', 'สนามเด็กเล่น', 'ลานกีฬา', 'โถงฮีโร่อะคาเดมี'];
  const STORY_RULES = [
    'โฟกัส “แม่นก่อนเร็ว”', 'หายใจยาว ๆ แล้วค่อยเร่งสปีด', 'ถ้าเริ่มล้า ลดเป็น easy ได้',
    'ทำให้ได้ “สม่ำเสมอ” ดีกว่า “หนักวันเดียว”', 'ตั้งเป้าเล็ก ๆ แล้วทำให้สำเร็จ'
  ];
  const STORY_REFLECT = [
    'วันนี้ฉันเก่งขึ้นตรงไหน 1 อย่าง?',
    'ฉันจะปรับแผนพรุ่งนี้ให้ “สมจริงกว่าเดิม” ยังไง?',
    'ถ้าเพื่อนเหนื่อย ฉันจะแนะนำเขายังไงให้เล่นต่อได้?',
    'วันนี้ฉันคุมลมหายใจ/จังหวะได้ดีแค่ไหน (1–5)? เพราะอะไร?'
  ];

  function storyForDay(dayIdx, plan, sc, rng){
    const d = plan.days[dayIdx];
    const isRest = !d.items || !d.items.length;
    const theme = pick(rng, STORY_THEMES);
    const loc = pick(rng, STORY_LOC);
    const rule = pick(rng, STORY_RULES);
    const refQ = pick(rng, STORY_REFLECT);

    if(isRest){
      return [
        `### ${dayName(dayIdx)} — วันพัก (Recovery Day)`,
        `**ฉาก:** ${loc}`,
        `**เรื่องเล่า:** วันนี้ฮีโร่เลือก “พักอย่างฉลาด” เพื่อเก็บพลังไว้ทำภารกิจวันถัดไป`,
        `**ภารกิจเล็ก:** เดินเบา ๆ 3 นาที + ดื่มน้ำ 1 แก้ว`,
        `**โค้ชอธิบาย:** วันพักช่วยให้ร่างกายฟื้นตัว ทำให้สัปดาห์นี้ “สม่ำเสมอ” มากขึ้น`,
        `**คำถามสะท้อนคิด:** ${refQ}`,
        ``
      ].join('\n');
    }

    const items = d.items.map((it)=>{
      const g = getGame(it.game);
      return `${g.ico} ${g.name} (${it.diff}, ${clamp(it.min,2,20)} นาที)`;
    }).join(' + ');

    const mins = dayMinutes(d);
    const load = dayLoad(d).toFixed(1);
    const energy = dayEnergy(d).toFixed(1);

    // Make it feel "Create": player designs + mission constraints
    const mission = [
      `ทำให้ได้ **“ภารกิจวันนี้”**:`,
      `- เล่นตามแผน: ${items}`,
      `- เป้ารวมเวลา: ${mins} นาที`,
      `- เป้าโฟกัส: ${plan.goals.map(g=>GOALS.find(x=>x.id===g)?.label||g).join(' + ')}`,
      `- กติกาท้าทาย: ${rule}`,
    ].join('\n');

    // Explainable coach per day
    const limit = isWeekend(dayIdx) ? plan.constraints.limitWeekend : plan.constraints.limitWeekday;
    const over = mins > limit;
    const eOver = Number(energy) > ENERGY_BUDGET;

    const coach = [
      `**โค้ชอธิบาย (Why):**`,
      `- วันนี้โหลดประมาณ **${load}** และ Energy **${energy}/${ENERGY_BUDGET}**`,
      over ? `- ⚠️ วันนี้เวลาเกินโควต้า (${mins}/${limit} นาที) → ลด 1–2 นาที หรือเปลี่ยนเป็น easy` : `- ✅ วันนี้เวลาอยู่ในโควต้า (${mins}/${limit} นาที)`,
      eOver ? `- ⚠️ Energy/day เกินงบ → ถ้าเหนื่อย ให้ลดความยากก่อน` : `- ✅ Energy/day อยู่ในงบ ช่วยให้เล่นต่อเนื่องได้`,
    ].join('\n');

    return [
      `### ${dayName(dayIdx)} — ${theme}`,
      `**ฉาก:** ${loc}`,
      `**เรื่องเล่า:** วันนี้ฮีโร่ต้องทำภารกิจให้สำเร็จ “แบบไม่โอเวอร์โหลด” เพื่อชนะตัวเอง`,
      ``,
      mission,
      ``,
      coach,
      ``,
      `**คำถามสะท้อนคิด (ป.5):** ${refQ}`,
      ``
    ].join('\n');
  }

  function generateStoryboard(){
    const sc = scorePlan(PLAN);
    const seedBase = hashStr(`${PLAN.pid}|${PLAN.weekStart}|${PLAN.seed}|story`);
    const rng = mulberry32(seedBase ^ (Date.now() & 0xffff)); // allow “สุ่มใหม่”
    const lines = [];
    lines.push(`# HeroHealth Fitness — Storyboard (Create)`);
    lines.push(`- date: ${todayKey()}`);
    lines.push(`- pid: ${PLAN.pid}`);
    lines.push(`- weekStart: ${PLAN.weekStart}`);
    lines.push(`- goals: ${PLAN.goals.join(' + ')}`);
    lines.push(`- planScore: ${sc.total}/100`);
    lines.push(``);
    lines.push(`## กติกาเรื่องเล่า (สำหรับเด็ก ป.5)`);
    lines.push(`- อ่าน “ภารกิจวันนี้” 20 วินาทีก่อนเล่น`);
    lines.push(`- เล่นให้สำเร็จแบบ “สม่ำเสมอ” (ไม่ต้องหนักทุกวัน)`);
    lines.push(`- หลังเล่น ตอบคำถามสะท้อนคิด 1 ข้อ`);
    lines.push(``);

    for(let i=0;i<7;i++){
      lines.push(storyForDay(i, PLAN, sc, rng));
    }

    const text = lines.join('\n');
    saveLS(KEY_STORY, { v:1, weekStart: PLAN.weekStart, pid: PLAN.pid, ts: Date.now(), text });
    if(elStoryPreview) elStoryPreview.value = text;
    toast('สร้าง Storyboard แล้ว ✅');
    return text;
  }

  function loadStoryboardIntoUI(){
    if(!elStoryPreview) return;
    const st = loadLS(KEY_STORY, null);
    if(st && st.text && String(st.weekStart)===String(PLAN.weekStart) && String(st.pid)===String(PLAN.pid)){
      elStoryPreview.value = String(st.text);
    } else {
      elStoryPreview.value = '';
    }
  }

  function exportStoryboardMD(){
    const txt = (elStoryPreview && elStoryPreview.value) ? elStoryPreview.value : '';
    if(!txt.trim()){ toast('ยังไม่มี storyboard (กด “สร้าง Storyboard”)'); return; }
    dlText(`HHA_story_${todayKey()}_${PLAN.pid||'anon'}.md`, txt);
    toast('ดาวน์โหลด Storyboard.md ✅');
  }

  // --------- Plan markdown ----------
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
    lines.push(`| Day | Session | Minutes | Difficulty | Load | Energy |`);
    lines.push(`|---|---|---:|---|---:|---:|`);

    for(let i=0;i<7;i++){
      const d = plan.days[i];
      if(!d.items.length){
        lines.push(`| ${dayName(i)} | พัก | 0 | — | 0.0 | 0.0 |`);
        continue;
      }
      for(const it of d.items){
        const g = getGame(it.game);
        const mins = clamp(it.min,2,20);
        const diff = getDiff(it.diff).name;
        const load = loadPerItem(it).toFixed(1);
        const e = energyPerItem(it).toFixed(1);
        lines.push(`| ${dayName(i)} | ${g.name} | ${mins} | ${diff} | ${load} | ${e} |`);
      }
    }
    lines.push('');
    lines.push(`## Plan Score (0–100)`);
    lines.push(`- total: **${sc.total}**`);
    lines.push(`- balanced_load: ${Math.round(sc.parts.balanced)}/30`);
    lines.push(`- consistency: ${Math.round(sc.parts.consistency)}/25`);
    lines.push(`- realism: ${Math.round(sc.parts.realism)}/25`);
    lines.push(`- goal_fit: ${Math.round(sc.parts.goalFit)}/20`);
    lines.push('');
    lines.push(`## Badges`);
    for(const b of computeBadges(plan, sc)){
      lines.push(`- ${b.on ? '🏅' : '🎯'} ${b.name}: ${b.on ? 'ได้แล้ว' : 'กำลังทำ'} — ${b.desc}`);
    }
    lines.push('');
    lines.push(`## Explainable Coach`);
    for(const x of coach) lines.push(`- ${x.t}`);
    lines.push('');
    return lines.join('\n');
  }

  function exportMD(){
    const sc = scorePlan(PLAN);
    const coach = coachReasons(PLAN, sc);
    const md = planToMarkdown(PLAN, sc, coach);
    dlText(`HHA_plan_${todayKey()}_${PLAN.pid||'anon'}.md`, md);
    toast('ดาวน์โหลด Plan.md ✅');
  }
  function exportJSON(){
    dlJson(`HHA_plan_${todayKey()}_${PLAN.pid||'anon'}.json`, PLAN);
    toast('ดาวน์โหลด Plan.json ✅');
  }

  // =====================
  // A3: Sequential play helpers
  // =====================
  function plannerSelfUrl(extra){
    // Keep current url but clean sequence params; then apply extras
    let u = new URL(location.href);
    // clean seq params
    ['seq','day','done'].forEach(k=>u.searchParams.delete(k));
    // always keep run/diff/time/seed/pid/view if present
    // (already in url) so no action
    if(extra){
      for(const k in extra){
        if(extra[k]===null || extra[k]===undefined || extra[k]==='') u.searchParams.delete(k);
        else u.searchParams.set(k, String(extra[k]));
      }
    }
    return u.toString();
  }

  function launchGameItem(it, dayIdx, itemIdx, seqMode){
    const url = gameUrl(it.game);
    if(!url){
      toast('ยังไม่ตั้ง URL เกม (กด “ตั้งค่า URL เกม”)');
      openUrlModal();
      return;
    }

    const min = clamp(it.min, 2, 20);
    const diff = (it.diff==='easy' || it.diff==='normal' || it.diff==='hard') ? it.diff : 'normal';

    // HUB back: if seqMode, return to planner with pointer
    const back = seqMode
      ? plannerSelfUrl({ seq: 1, day: dayIdx, done: itemIdx })
      : plannerSelfUrl(null);

    const params = {
      pid: PLAN.pid,
      run: (PLAN.run==='research' ? 'research' : 'play'),
      diff,
      time: String(min * 60),
      seed: PLAN.seed,
      view: RUNTIME.view,
      hub: back
    };

    location.href = withParams(url, params);
  }

  function tryTodayGo(seqMode){
    const idx = todayIndexMon0();
    const d = PLAN.days[idx];
    if(!d || !d.items || !d.items.length){
      toast('วันนี้ไม่มีเกมในแผน');
      return;
    }
    launchGameItem(d.items[0], idx, 0, !!seqMode);
  }

  function computeNextFromSeqParams(){
    const seq = String(qs('seq','')||'');
    if(seq !== '1') return null;

    const day = clamp(qs('day','-1'), -1, 6);
    const done = clamp(qs('done','-1'), -1, 1);

    if(day < 0 || day > 6) return null;
    const d = PLAN.days[day];
    if(!d || !d.items || !d.items.length) return null;

    const nextIdx = done + 1;
    if(nextIdx >= d.items.length) return { doneAll: true, day, nextIdx: null, item: null };

    return { doneAll: false, day, nextIdx, item: d.items[nextIdx] };
  }

  function showNextPanelIfAny(){
    if(!elNextPanel) return;
    const nx = computeNextFromSeqParams();
    if(!nx) { elNextPanel.style.display='none'; return; }

    elNextPanel.style.display = 'block';

    if(nx.doneAll){
      elNextTitle.textContent = `วันนี้เล่นครบตามแผนแล้ว ✅`;
      elNextHint.textContent = `สุดยอด! ถ้าอยากเล่นเพิ่ม แนะนำเล่น easy อีก 3–5 นาที หรือพักให้พอดี`;
      $('#btnPlayNext').textContent = '🎉 จบภารกิจวันนี้';
      $('#btnPlayNext').disabled = true;
    } else {
      const g = getGame(nx.item.game);
      elNextTitle.textContent = `NEXT: ${g.ico} ${g.name} (${nx.item.diff}, ${clamp(nx.item.min,2,20)} นาที)`;
      elNextHint.textContent = `กดเล่นเกมถัดไป แล้วในเกมกด “กลับ HUB” เพื่อกลับมาที่นี่อีกครั้ง`;
      $('#btnPlayNext').textContent = '▶️ เล่นเกมถัดไป';
      $('#btnPlayNext').disabled = false;

      $('#btnPlayNext').onclick = ()=>{
        launchGameItem(nx.item, nx.day, nx.nextIdx, true);
      };
    }

    $('#btnBackToToday').onclick = ()=>{
      document.getElementById('todayLabel')?.scrollIntoView({behavior:'smooth', block:'center'});
    };
    $('#btnDismissNext').onclick = ()=>{
      elNextPanel.style.display='none';
    };

    // Also clean URL after showing (avoid infinite)
    // Keep it simple: we keep params, but hide panel possible.
  }

  // --- Try Today list render ---
  function renderTryToday(){
    const idx = todayIndexMon0();
    $('#todayLabel').textContent = `วันนี้: ${dayName(idx)} (Day ${idx+1})`;

    const d = PLAN.days[idx];
    elTryList.innerHTML = '';

    if(!d || !d.items || !d.items.length){
      elTryList.innerHTML = `<div class="mut">วันนี้ในแผนเป็น “พัก” หรือยังไม่ได้ใส่เกม</div>`;
      return;
    }

    for(let j=0;j<d.items.length;j++){
      const it = d.items[j];
      const g = getGame(it.game);
      const url = gameUrl(it.game);
      const title = `${g.ico} ${g.name}`;
      const min = clamp(it.min, 2, 20);
      const diff = (it.diff==='easy' || it.diff==='normal' || it.diff==='hard') ? it.diff : 'normal';

      const back = plannerSelfUrl({ seq: 1, day: idx, done: j }); // for copy open too
      const params = {
        pid: PLAN.pid,
        run: (PLAN.run==='research' ? 'research' : 'play'),
        diff,
        time: String(min * 60),
        seed: PLAN.seed,
        view: RUNTIME.view,
        hub: back
      };

      const li = document.createElement('div');
      li.className = 'tryItem';

      const left = document.createElement('div');
      left.className = 'l';
      left.innerHTML = `<div class="t">${title}</div><div class="m">${diff} · ${min} นาที</div>`;

      const right = document.createElement('div');
      right.className = 'r';

      if(url){
        const open = document.createElement('a');
        open.href = withParams(url, params);
        open.target = '_blank';
        open.rel = 'noopener';
        open.textContent = 'เปิดเกม';
        right.appendChild(open);

        const copy = document.createElement('a');
        copy.href = '#';
        copy.textContent = 'คัดลอกลิงก์';
        copy.addEventListener('click', (e)=>{
          e.preventDefault();
          copyToClipboard(withParams(url, params));
        });
        right.appendChild(copy);
      } else {
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'disabled';
        a.textContent = 'ตั้ง URL ก่อน';
        a.addEventListener('click', (e)=>{
          e.preventDefault();
          openUrlModal();
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
    const main = (PLAN.goals[0]==='balance') ? 'balance'
              : (PLAN.goals[0]==='speed')   ? 'shadow'
              : 'jumpduck';
    const sup  = 'rhythm';
    const playIdx = [0,2,4,5]; // Mon/Wed/Fri/Sat

    for(const i of playIdx){
      const limit = isWeekend(i) ? PLAN.constraints.limitWeekend : PLAN.constraints.limitWeekday;
      const items = [];
      items.push({ game: main, diff: 'normal', min: Math.min(6, limit) });
      if(limit >= 10) items.push({ game: sup, diff: 'easy', min: 4 });
      PLAN.days[i].items = items.slice(0,2);
    }
    const need = PLAN.constraints.minDays;
    const have = PLAN.days.filter(dayHasAny).length;
    if(have < need){
      const i = 6;
      const limit = isWeekend(i) ? PLAN.constraints.limitWeekend : PLAN.constraints.limitWeekday;
      PLAN.days[i].items = [{ game: 'rhythm', diff:'easy', min: Math.min(6, limit) }];
    }
    PLAN.ts = Date.now();
  }

  // =====================
  // URL modal helpers
  // =====================
  function openUrlModal(){
    if(!elUrlModal) return;
    GAME_URL = loadUrls();
    elUrlShadow.value = GAME_URL.shadow || '';
    elUrlRhythm.value = GAME_URL.rhythm || '';
    elUrlJump.value = GAME_URL.jumpduck || '';
    elUrlBalance.value = GAME_URL.balance || '';
    elUrlModal.dataset.open = '1';
  }
  function closeUrlModal(){
    if(!elUrlModal) return;
    elUrlModal.dataset.open = '0';
  }
  function bindUrlModal(){
    if(!elUrlModal) return;

    $('#btnSetUrls')?.addEventListener('click', openUrlModal);
    $('#btnCloseModal')?.addEventListener('click', closeUrlModal);

    elUrlModal.addEventListener('click', (e)=>{
      if(e.target === elUrlModal) closeUrlModal();
    });

    $('#btnRestoreDefault')?.addEventListener('click', ()=>{
      elUrlShadow.value = DEFAULT_URLS.shadow;
      elUrlRhythm.value = DEFAULT_URLS.rhythm;
      elUrlJump.value = DEFAULT_URLS.jumpduck;
      elUrlBalance.value = DEFAULT_URLS.balance;
      toast('คืนค่าเริ่มต้นแล้ว');
    });

    $('#btnSaveUrls')?.addEventListener('click', ()=>{
      const u = {
        shadow: String(elUrlShadow.value||'').trim(),
        rhythm: String(elUrlRhythm.value||'').trim(),
        jumpduck: String(elUrlJump.value||'').trim(),
        balance: String(elUrlBalance.value||'').trim(),
      };
      saveUrls(u);
      GAME_URL = loadUrls();
      closeUrlModal();
      renderTryToday();
      toast('บันทึก URL แล้ว ✅');
    });
  }

  // --------- render all ----------
  function renderAll(){
    renderGoalPills();
    renderWeekGrid();
    renderScore();
    renderTryToday();
    syncControlsFromPlan();
    saveNow();
  }

  // --------- events ----------
  function bindEvents(){
    $('#btnLoad')?.addEventListener('click', ()=>{
      const last = loadLS(KEY_LAST, null);
      if(!last){ toast('ยังไม่มีแผนที่บันทึกไว้'); return; }
      PLAN = last;
      PLAN.pid = RUNTIME.pid; PLAN.run = RUNTIME.run; PLAN.seed = RUNTIME.seed;
      syncControlsFromPlan();
      renderAll();
      loadStoryboardIntoUI();
      toast('โหลดแผนล่าสุดแล้ว ✅');
    });

    $('#btnReset')?.addEventListener('click', ()=>{
      PLAN = DEFAULT_PLAN();
      syncControlsFromPlan();
      renderAll();
      saveNow();
      loadStoryboardIntoUI();
      toast('เริ่มแผนใหม่ ✅');
    });

    $('#btnClearWeek')?.addEventListener('click', ()=>{
      for(const d of PLAN.days){ d.items = []; }
      renderAll(); saveNow();
      toast('ล้างทั้งสัปดาห์ ✅');
    });

    $('#btnAutoFill')?.addEventListener('click', ()=>{
      autoFillPlan();
      renderAll(); saveNow();
      toast('เติมแผนแนะนำแล้ว ✅');
    });

    $('#btnExportMD')?.addEventListener('click', ()=> exportMD());
    $('#btnExportMD2')?.addEventListener('click', ()=> exportMD());
    $('#btnExportJSON')?.addEventListener('click', ()=> exportJSON());
    $('#btnExportJSON2')?.addEventListener('click', ()=> exportJSON());
    $('#btnCopyMD')?.addEventListener('click', ()=> copyToClipboard(elMdPreview.value));

    // A2 Storyboard
    $('#btnMakeStory')?.addEventListener('click', ()=> generateStoryboard());
    $('#btnRegenStory')?.addEventListener('click', ()=> generateStoryboard());
    $('#btnExportStoryMD')?.addEventListener('click', ()=> exportStoryboardMD());
    $('#btnCopyStory')?.addEventListener('click', ()=>{
      const t = (elStoryPreview && elStoryPreview.value) ? elStoryPreview.value : '';
      if(!t.trim()){ toast('ยังไม่มี storyboard'); return; }
      copyToClipboard(t);
    });

    // A3 try today
    $('#btnTryToday')?.addEventListener('click', ()=> tryTodayGo(false));
    $('#btnTryTodaySeq')?.addEventListener('click', ()=> tryTodayGo(true));

    elLimitWeekday?.addEventListener('change', ()=>{ readControlsToPlan(); renderAll(); saveNow(); });
    elLimitWeekend?.addEventListener('change', ()=>{ readControlsToPlan(); renderAll(); saveNow(); });
    elMinDays?.addEventListener('change', ()=>{ readControlsToPlan(); renderAll(); saveNow(); });
    elRestDays?.addEventListener('change', ()=>{ readControlsToPlan(); renderAll(); saveNow(); });

    bindUrlModal();
  }

  function bootImpl(){
    if(!$('#weekGrid')) return;
    bindEvents();
    syncControlsFromPlan();
    renderAll();
    loadStoryboardIntoUI();

    // A3: if we returned from a game via hub=...&seq=1...
    showNextPanelIfAny();
    saveNow();
  }

  window.HHA_FITNESS_PLANNER = { boot: bootImpl };
})();