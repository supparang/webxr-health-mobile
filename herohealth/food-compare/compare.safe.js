// === /herohealth/food-compare/compare.safe.js ===
// HeroHealth — Food Compare (Evaluate) — SAFE/Standalone — v20260218a
// ✅ Deterministic generator: seed + round -> fixed A/B plates + truth
// ✅ 2-step answer: pick (A/B/E) then reason
// ✅ Coach tips -> hha:coach (rate-limit, deterministic, optional ai=1)
// ✅ Scoring + combo + miss + grade
// ✅ End summary + save last summary/history + back hub
// ✅ Local-only (ยังไม่เอา app script)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  function getQS(){
    try{ return new URL(location.href).searchParams; }
    catch{ return new URLSearchParams(); }
  }
  const QS = getQS();
  const q = (k, def='') => (QS.get(k) ?? def);

  function clampNum(v,a,b,def){
    const n = Number(v);
    if(!Number.isFinite(n)) return def;
    return Math.max(a, Math.min(b, n));
  }

  const RUN  = String(q('run','play')||'play').toLowerCase();     // play|research
  const DIFF = String(q('diff','normal')||'normal').toLowerCase();// easy|normal|hard
  const TIME = clampNum(q('time','90'), 30, 240, 90);
  const SEED = String(q('seed','') || Date.now());
  const HUB  = String(q('hub','') || '../hub.html');
  const AI_PARAM = String(q('ai','0')||'0').toLowerCase();
  const AI_ON = (AI_PARAM === '1' || AI_PARAM === 'true') && (RUN !== 'research'); // lock research

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  }
  function nowMs(){ try{ return performance.now(); }catch{ return Date.now(); } }

  // ----- deterministic RNG -----
  function strSeedToU32(s){
    s = String(s ?? '');
    if (!s) s = String(Date.now());
    let h = 2166136261 >>> 0;
    for (let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function makeRng(seedU32){
    let t = seedU32 >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rng, arr){ return arr[(rng()*arr.length)|0]; }

  // ----- Thai 5 food groups (locked mapping) -----
  const FOODS = [
    { id:'g1-egg', g:1, em:'🥚', nm:'ไข่' }, { id:'g1-milk', g:1, em:'🥛', nm:'นม' },
    { id:'g1-fish', g:1, em:'🐟', nm:'ปลา' }, { id:'g1-chicken', g:1, em:'🍗', nm:'ไก่' },
    { id:'g1-beans', g:1, em:'🫘', nm:'ถั่ว' },

    { id:'g2-rice', g:2, em:'🍚', nm:'ข้าว' }, { id:'g2-bread', g:2, em:'🍞', nm:'ขนมปัง' },
    { id:'g2-noodle', g:2, em:'🍜', nm:'ก๋วยเตี๋ยว' }, { id:'g2-potato', g:2, em:'🥔', nm:'มัน' },
    { id:'g2-onigiri', g:2, em:'🍙', nm:'ข้าวปั้น' },

    { id:'g3-broccoli', g:3, em:'🥦', nm:'บร็อกโคลี' }, { id:'g3-leafy', g:3, em:'🥬', nm:'ผักใบ' },
    { id:'g3-cucumber', g:3, em:'🥒', nm:'แตงกวา' }, { id:'g3-carrot', g:3, em:'🥕', nm:'แครอท' },
    { id:'g3-tomato', g:3, em:'🍅', nm:'มะเขือเทศ' },

    { id:'g4-banana', g:4, em:'🍌', nm:'กล้วย' }, { id:'g4-apple', g:4, em:'🍎', nm:'แอปเปิล' },
    { id:'g4-watermelon', g:4, em:'🍉', nm:'แตงโม' }, { id:'g4-grape', g:4, em:'🍇', nm:'องุ่น' },
    { id:'g4-mango', g:4, em:'🥭', nm:'มะม่วง' },

    { id:'g5-avocado', g:5, em:'🥑', nm:'อะโวคาโด' }, { id:'g5-nuts', g:5, em:'🥜', nm:'ถั่วเปลือกแข็ง' },
    { id:'g5-butter', g:5, em:'🧈', nm:'เนย' }, { id:'g5-olive', g:5, em:'🫒', nm:'มะกอก' },
    { id:'g5-coconut', g:5, em:'🥥', nm:'มะพร้าว' },
  ];

  const REASONS = [
    { k:'balance', title:'ครบหมู่กว่า', sub:'มีหมู่ที่จำเป็นครบมากกว่า' },
    { k:'veg',     title:'ผัก/ผลไม้ดีกว่า', sub:'มีหมู่ 3–4 ชัดกว่า (ช่วยสมดุล)' },
    { k:'lowfat',  title:'ไขมัน/มันน้อยกว่า', sub:'หมู่ 5 ไม่ล้นเกิน' },
    { k:'protein', title:'โปรตีนพอดี', sub:'หมู่ 1 ไม่ขาด (เหมาะกับร่างกาย)' },
    { k:'carb',    title:'คาร์บไม่ล้น', sub:'หมู่ 2 ไม่เยอะเกินไป' },
  ];

  function $(s){ return DOC.querySelector(s); }

  // ----- UI refs -----
  const modePill = $('#modePill'), diffPill = $('#diffPill'), roundPill = $('#roundPill');
  const hudTime = $('#hudTime'), hudScore = $('#hudScore'), hudCombo = $('#hudCombo'), hudMiss = $('#hudMiss'), hudGrade = $('#hudGrade');
  const hudSeed = $('#hudSeed'), hudAI = $('#hudAI'), hudPick = $('#hudPick'), hudReason = $('#hudReason');

  const promptTitle = $('#promptTitle'), promptSub = $('#promptSub'), promptBar = $('#promptBar');
  const stepTag = $('#stepTag'), roundTimer = $('#roundTimer');

  const foodsA = $('#foodsA'), foodsB = $('#foodsB'), miniA = $('#miniA'), miniB = $('#miniB');
  const bars = { A:[$('#barA1'),$('#barA2'),$('#barA3'),$('#barA4'),$('#barA5')],
                 B:[$('#barB1'),$('#barB2'),$('#barB3'),$('#barB4'),$('#barB5')] };

  const btnRestart = $('#btnRestart'), btnBack = $('#btnBack');
  const pickA = $('#pickA'), pickB = $('#pickB'), pickE = $('#pickE');

  const coachFace = $('#coachFace'), coachTxt = $('#coachTxt'), coachSub = $('#coachSub');

  const reasonOverlay = $('#reasonOverlay'), reasonsEl = $('#reasons');
  const reasonTimer = $('#reasonTimer'), reasonAuto = $('#reasonAuto'), btnCancelReason = $('#btnCancelReason');

  const endOverlay = $('#endOverlay'), endSummary = $('#endSummary'), endDetails = $('#endDetails');
  const savedTag = $('#savedTag'), btnEndAgain = $('#btnEndAgain'), btnEndGoHub = $('#btnEndGoHub'), btnEndClose = $('#btnEndClose');

  // ----- storage -----
  const LS_LAST = 'HHA_LAST_SUMMARY';
  const LS_HIST = 'HHA_SUMMARY_HISTORY';
  function readJSON(key, fallback){ try{ const s=localStorage.getItem(key); return s?JSON.parse(s):fallback; }catch(_){ return fallback; } }
  function writeJSON(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); return true; }catch(_){ return false; } }
  function saveLastSummary(payload){
    try{
      const ok1 = writeJSON(LS_LAST, payload);
      const hist = readJSON(LS_HIST, []);
      hist.unshift(payload);
      const ok2 = writeJSON(LS_HIST, hist.slice(0, 40));
      return !!(ok1 && ok2);
    }catch(_){ return false; }
  }

  // ----- state -----
  const S = {
    running:false,
    startMs:0, lastTickMs:0,
    timePlannedSec: TIME, timeLeftSec: TIME,

    roundsTotal: 10,
    roundIdx: 0,
    step: 'pick',
    stepLeftSec: 12,

    cur: null,
    picked: null,
    reason: null,

    score:0, combo:0, miss:0,
    pickCorrect:0, reasonCorrect:0, totalAnswered:0,
    wrongReasons:{},

    lastCoachAt:0,
    coachCooldownMs: 5200
  };

  function calcRoundsTotal(timeSec, diff){
    diff = String(diff||'normal');
    const base = (diff === 'easy') ? 9 : (diff === 'hard') ? 12 : 10;
    const byTime = Math.round(clampNum(timeSec,30,240,90) / 9);
    return clampNum(Math.round((base + byTime)/2), 8, 14, 10);
  }
  S.roundsTotal = calcRoundsTotal(TIME, DIFF);

  function stepPickSec(diff){ return diff==='easy'?13 : diff==='hard'?10 : 12; }
  function stepReasonSec(diff){ return diff==='easy'?7 : diff==='hard'?5 : 6; }

  // ----- coach / AI tips (deterministic + rate-limit) -----
  function setCoach(text, mood){
    coachTxt.textContent = text || '';
    coachSub.textContent = mood ? String(mood) : 'coach';
    const face =
      mood === 'happy' ? '😄' :
      mood === 'fever' ? '🔥' :
      mood === 'sad'   ? '😵' :
      mood === 'neutral' ? '🙂' : '🙂';
    coachFace.textContent = face;
    emit('hha:coach', { text, mood: mood||'neutral' });
  }
  function canCoach(){
    const t = nowMs();
    return (t - (S.lastCoachAt||0)) >= S.coachCooldownMs;
  }
  function aiTip(tag){
    if(!AI_ON) return null;
    if(!canCoach()) return null;

    // ✅ deterministic: depends only on seed+round+step+tag
    const rr = makeRng(strSeedToU32(SEED + '::tip::' + S.roundIdx + '::' + S.step + '::' + (tag||'')));
    const pool = [
      {t:'เช็ค “ครบหมู่” ก่อน แล้วค่อยดูสัดส่วน ✅', mood:'neutral'},
      {t:'อย่าหลงของล่อใจ—เลือกให้สมดุล 🎯', mood:'neutral'},
      {t:'เหตุผลสำคัญกว่าเดาถูก! เลือกให้ตรงที่สุด 🧠', mood:'neutral'},
    ];
    if(tag==='miss') pool.push({t:'ยังทัน! รอบหน้าเลือกก่อน แล้วค่อยเลือกเหตุผล ⚡', mood:'fever'});
    if(tag==='wrong') pool.push({t:'ลองดูว่า “ขาดหมู่ไหน” หรือ “หมู่ไหนล้น” แล้วค่อยตัดสิน ✅', mood:'neutral'});
    if(S.combo>=3) pool.push({t:'คอมโบมาแล้ว! รักษาจังหวะไว้ 🔥', mood:'happy'});

    const tip = pool[(rr()*pool.length)|0];
    S.lastCoachAt = nowMs(); // rate-limit latch
    return tip || null;
  }

  // ----- generator -----
  function foodPoolByGroup(g){ return FOODS.filter(x=>x.g===g); }

  function buildPlate(rng, profile){
    const items = [];
    const used = new Set();

    function addFromGroup(g){
      const pool = foodPoolByGroup(g);
      if(!pool.length) return;
      let f = pick(rng, pool);
      for(let k=0;k<4;k++){
        if(!used.has(f.id)) break;
        f = pick(rng, pool);
      }
      used.add(f.id);
      items.push(f);
    }

    const targetCount = (DIFF==='easy') ? 4 : (DIFF==='hard') ? 6 : 5;

    const need = (profile && profile.need) ? profile.need.slice(0) : [];
    for(const g of need) addFromGroup(g);

    while(items.length < targetCount){
      const r = rng();
      let g = 2;
      if(r < 0.22) g = 1;
      else if(r < 0.44) g = 2;
      else if(r < 0.68) g = 3;
      else if(r < 0.86) g = 4;
      else g = 5;

      if(profile && profile.biasVeg && rng() < 0.35) g = 3;
      if(profile && profile.biasLowFat && rng() < 0.25) g = (rng()<0.6?3:4);
      if(profile && profile.biasCarb && rng() < 0.25) g = 2;
      if(profile && profile.biasProtein && rng() < 0.25) g = 1;

      addFromGroup(g);
    }
    return items;
  }

  function countGroups(items){
    const c = [0,0,0,0,0];
    for(const f of (items||[])){
      const gi = (f.g|0) - 1;
      if(gi>=0 && gi<5) c[gi]++;
    }
    return c;
  }
  function groupsCovered(counts){
    let n=0; for(const x of counts){ if((x|0)>0) n++; }
    return n;
  }
  function balanceScore(counts){
    const cover = groupsCovered(counts);
    const g1=counts[0]||0, g2=counts[1]||0, g3=counts[2]||0, g4=counts[3]||0, g5=counts[4]||0;
    let s = 0;
    s += cover * 20;
    if(g3>0) s += 10;
    if(g4>0) s += 8;
    if(g1>0) s += 8;
    if(g5>=2) s -= 10 + (g5-2)*6;
    if(g2>=3) s -= 8 + (g2-3)*5;
    const maxOne = Math.max(g1,g2,g3,g4,g5);
    if(maxOne>=4) s -= 10;
    return s;
  }
  function deriveBestReason(aCounts, bCounts, better){
    const A=aCounts, B=bCounts;
    const W = (better==='A') ? A : B;
    const L = (better==='A') ? B : A;

    if(groupsCovered(W) > groupsCovered(L)) return 'balance';

    const vegW = (W[2]||0) + (W[3]||0);
    const vegL = (L[2]||0) + (L[3]||0);
    if(vegW >= vegL + 1) return 'veg';

    const fatW = (W[4]||0), fatL = (L[4]||0);
    if(fatW + 1 <= fatL) return 'lowfat';

    const pW = (W[0]||0), pL = (L[0]||0);
    if(pW >= pL + 1) return 'protein';

    const cW = (W[1]||0), cL = (L[1]||0);
    if(cW + 1 <= cL) return 'carb';

    return 'balance';
  }

  function genRound(roundIdx){
    const rng = makeRng(strSeedToU32(SEED + '::compare::round::' + roundIdx));

    const profiles = [
      { name:'balanced', need:[1,2,3,4], biasLowFat:true },
      { name:'veg', need:[2,3,4], biasVeg:true },
      { name:'protein', need:[1,2,3], biasProtein:true },
      { name:'lowfat', need:[1,2,3,4], biasLowFat:true },
      { name:'carb', need:[2,2,3], biasCarb:true }
    ];

    let pA = pick(rng, profiles);
    let pB = pick(rng, profiles);
    for(let k=0;k<5;k++){
      if(pB.name !== pA.name) break;
      pB = pick(rng, profiles);
    }

    const A = buildPlate(rng, pA);
    const B = buildPlate(rng, pB);

    const cA = countGroups(A);
    const cB = countGroups(B);

    const sA = balanceScore(cA);
    const sB = balanceScore(cB);

    let better = 'E';
    const gap = Math.abs(sA - sB);

    // deterministic tie chance
    if(gap <= 6 && rng() < 0.18){
      better = 'E';
    }else{
      better = (sA > sB) ? 'A' : (sB > sA) ? 'B' : 'E';
      if(better === 'E'){
        better = (groupsCovered(cA) >= groupsCovered(cB)) ? 'A' : 'B';
      }
    }

    const reasonKey = (better === 'E') ? 'balance' : deriveBestReason(cA, cB, better);

    return {
      roundIdx,
      A, B,
      cA, cB,
      truth: { better, reasonKey },
      mini: { A:`${groupsCovered(cA)}/5 หมู่`, B:`${groupsCovered(cB)}/5 หมู่` }
    };
  }

  // ----- render -----
  function $(s){ return DOC.querySelector(s); }
  function foodChip(f){
    const d = DOC.createElement('div');
    d.className = 'food';
    d.innerHTML = `<span class="em">${f.em}</span><span class="nm">${f.nm}</span><span class="gp">หมู่ ${f.g}</span>`;
    return d;
  }
  function setBars(side, counts){
    const arr = (side==='A') ? [$('#barA1'),$('#barA2'),$('#barA3'),$('#barA4'),$('#barA5')]
                             : [$('#barB1'),$('#barB2'),$('#barB3'),$('#barB4'),$('#barB5')];
    for(let i=0;i<5;i++){
      const v = (counts[i]||0);
      const w = Math.max(0, Math.min(100, Math.round((v/3)*100)));
      arr[i].style.setProperty('--w', w + '%');
    }
  }

  function gradeFromPerf(){
    const ans = Math.max(1, S.totalAnswered|0);
    const pickAcc = Math.round((S.pickCorrect/ans)*100);
    const reaAcc  = Math.round((S.reasonCorrect/ans)*100);
    const weighted = Math.round(pickAcc*0.4 + reaAcc*0.6);

    let grade = 'D';
    if(weighted >= 92) grade = 'S';
    else if(weighted >= 84) grade = 'A';
    else if(weighted >= 72) grade = 'B';
    else if(weighted >= 60) grade = 'C';

    return { pickAcc, reaAcc, weighted, grade };
  }

  function renderHUD(){
    $('#modePill').textContent = RUN.toUpperCase();
    $('#diffPill').textContent = DIFF;
    $('#roundPill').textContent = (S.roundIdx+1) + '/' + S.roundsTotal;

    $('#hudSeed').textContent = String(SEED).slice(0,16);
    $('#hudAI').textContent = AI_ON ? 'ON' : 'OFF';

    $('#hudTime').textContent = S.timeLeftSec + 's';
    $('#hudScore').textContent = String(S.score|0);
    $('#hudCombo').textContent = 'x' + String(S.combo|0);
    $('#hudMiss').textContent = String(S.miss|0);
    $('#hudGrade').textContent = gradeFromPerf().grade;

    $('#hudPick').textContent = S.picked || '—';
    $('#hudReason').textContent = S.reason || '—';
  }

  function renderPrompt(){
    $('#promptTitle').textContent = `รอบที่ ${S.roundIdx+1}`;
    $('#promptSub').textContent = (S.step === 'pick') ? 'เลือกมื้อที่ “สมดุลกว่า”' : 'เลือก “เหตุผล” ที่ตรงที่สุด';

    const total = (S.step === 'pick') ? stepPickSec(DIFF) : stepReasonSec(DIFF);
    const left = Math.max(0, S.stepLeftSec|0);
    const pct = Math.round(((total - left) / Math.max(1,total)) * 100);
    $('#promptBar').style.width = pct + '%';

    $('#stepTag').textContent = (S.step === 'pick') ? 'STEP: เลือก A / B / พอ ๆ กัน' : 'STEP: เลือกเหตุผล 1 ข้อ';
    $('#roundTimer').textContent = `⏳ ${left}s`;
  }

  function renderRound(){
    if(!S.cur) return;

    const foodsA = $('#foodsA'), foodsB = $('#foodsB');
    foodsA.innerHTML = ''; foodsB.innerHTML = '';
    for(const f of S.cur.A) foodsA.appendChild(foodChip(f));
    for(const f of S.cur.B) foodsB.appendChild(foodChip(f));

    $('#miniA').textContent = S.cur.mini.A;
    $('#miniB').textContent = S.cur.mini.B;

    setBars('A', S.cur.cA);
    setBars('B', S.cur.cB);

    S.picked = null;
    S.reason = null;
    renderHUD();
    renderPrompt();
  }

  function labelReason(k){
    const r = REASONS.find(x=>x.k===k);
    return r ? r.title : k;
  }

  // ----- reasons overlay -----
  function showReasonOverlay(){
    $('#reasonAuto').textContent = 'ON';
    const reasonsEl = $('#reasons');
    reasonsEl.innerHTML = '';
    for(const r of REASONS){
      const b = DOC.createElement('button');
      b.className = 'reasonBtn ghost';
      b.setAttribute('data-reason', r.k);
      b.innerHTML = `<b>${r.title}</b><span>${r.sub}</span>`;
      b.addEventListener('click', ()=>chooseReason(r.k), { passive:true });
      reasonsEl.appendChild(b);
    }
    $('#reasonTimer').textContent = S.stepLeftSec + 's';
    $('#reasonOverlay').style.display = 'flex';
  }
  function hideReasonOverlay(){ $('#reasonOverlay').style.display = 'none'; }

  // ----- scoring -----
  function addScorePick(isCorrect){
    if(isCorrect){
      S.combo = Math.min(99, (S.combo|0) + 1);
      S.score += 10 + Math.min(18, (S.combo>=3 ? S.combo : 0));
    }else{
      S.combo = 0;
      S.miss++;
      S.score = Math.max(0, (S.score|0) - 6);
    }
    emit('hha:score', { score:S.score|0, combo:S.combo|0, misses:S.miss|0 });
  }
  function addScoreReason(isCorrect){
    if(isCorrect) S.score += 12;
    else S.score = Math.max(0, (S.score|0) - 4);
    emit('hha:score', { score:S.score|0, combo:S.combo|0, misses:S.miss|0 });
  }

  // ----- flow -----
  function choosePick(p){
    if(!S.running) return;
    if(S.step !== 'pick') return;

    S.picked = p;
    S.step = 'reason';
    S.stepLeftSec = stepReasonSec(DIFF);

    const tip = aiTip('after_pick');
    if(tip) setCoach(tip.t, tip.mood);

    showReasonOverlay();
    renderPrompt();
    renderHUD();
  }

  function chooseReason(reasonKey){
    if(!S.running) return;
    if(S.step !== 'reason') return;
    S.reason = reasonKey;
    evaluateCurrent();
  }

  function buildFeedback(pickOk, reasonOk, truthPick, truthReason){
    if(pickOk && reasonOk) return { mood:'happy', text:'ถูกทั้ง “เลือก” และ “เหตุผล” ✅ สมดุลจริง!' };
    if(pickOk && !reasonOk) return { mood:'neutral', text:`เลือกถูก ✅ แต่เหตุผลยังไม่ตรง—คำใบ้: “${labelReason(truthReason)}”` };
    if(!pickOk && reasonOk) return { mood:'neutral', text:'เหตุผลดีนะ 🧠 แต่เลือกผิด—ลองจับคู่เหตุผลกับจานที่เข้ากว่า' };
    return { mood:'neutral', text:'ยังไม่ตรง ❗ ลองดู “ขาดหมู่ไหน/หมู่ไหนล้น” แล้วค่อยตัดสิน' };
  }

  function evaluateCurrent(){
    hideReasonOverlay();

    const truthPick = S.cur.truth.better;
    const truthReason = S.cur.truth.reasonKey;

    const pickOk = (S.picked === truthPick);
    addScorePick(pickOk);
    if(pickOk) S.pickCorrect++;

    const reasonOk = (S.reason === truthReason);
    addScoreReason(reasonOk);
    if(reasonOk) S.reasonCorrect++;
    if(!reasonOk) S.wrongReasons[S.reason] = (S.wrongReasons[S.reason]||0) + 1;

    S.totalAnswered++;

    if(canCoach()){
      S.lastCoachAt = nowMs();
      const msg = buildFeedback(pickOk, reasonOk, truthPick, truthReason);
      setCoach(msg.text, msg.mood);
    }else{
      const tip = aiTip(pickOk && reasonOk ? 'happy' : 'wrong');
      if(tip) setCoach(tip.t, tip.mood);
    }

    emit('food:compare', {
      round: S.roundIdx+1,
      pick: S.picked,
      reason: S.reason,
      correctPick: truthPick,
      correctReason: truthReason,
      pickOk, reasonOk,
      score: S.score|0,
      combo: S.combo|0
    });

    nextRound();
  }

  function missStep(){
    S.combo = 0;
    S.miss++;
    S.score = Math.max(0, (S.score|0) - 8);
    emit('hha:score', { score:S.score|0, combo:S.combo|0, misses:S.miss|0 });

    const tip = aiTip('miss');
    if(tip) setCoach(tip.t, tip.mood);

    S.totalAnswered++;
    emit('food:compare', {
      round: S.roundIdx+1,
      pick: S.picked || '',
      reason: S.reason || '',
      correctPick: S.cur.truth.better,
      correctReason: S.cur.truth.reasonKey,
      timeout: true
    });

    nextRound();
  }

  function loadRound(){
    S.cur = genRound(S.roundIdx);
    S.step = 'pick';
    S.stepLeftSec = stepPickSec(DIFF);
    renderRound();
  }

  function nextRound(){
    setTimeout(()=>{
      if(!S.running) return;
      S.roundIdx++;
      if(S.roundIdx >= S.roundsTotal){
        endRun('rounds');
        return;
      }
      loadRound();
    }, 350);
  }

  // ----- end + save -----
  function topWrongReason(){
    const entries = Object.entries(S.wrongReasons||{});
    if(!entries.length) return null;
    entries.sort((a,b)=> (b[1]-a[1]));
    const [k,v] = entries[0];
    return { key:k, count:v, label: labelReason(k) };
  }

  function showEnd(summary, details, saved){
    $('#savedTag').textContent = saved ? 'yes' : 'no';
    $('#endSummary').textContent = JSON.stringify(summary || {}, null, 2);
    $('#endDetails').textContent = JSON.stringify(details || {}, null, 2);
    $('#endOverlay').style.display = 'flex';
  }
  function hideEnd(){ $('#endOverlay').style.display = 'none'; }

  function endRun(reason){
    if(!S.running) return;
    S.running = false;
    hideReasonOverlay();

    const g = gradeFromPerf();
    const commonWrong = topWrongReason();

    const summary = {
      game: 'food-compare',
      reason: reason || 'end',
      runMode: RUN,
      diff: DIFF,
      seed: SEED,
      timePlannedSec: S.timePlannedSec|0,
      scoreFinal: S.score|0,
      miss: S.miss|0,
      roundsTotal: S.roundsTotal|0,
      roundsPlayed: Math.min(S.roundsTotal, (S.roundIdx+1))|0,
      pickAccPct: g.pickAcc|0,
      reasonAccPct: g.reaAcc|0,
      weightedPct: g.weighted|0,
      grade: g.grade,
      aiEnabled: !!AI_ON
    };

    const details = {
      pickCorrect: S.pickCorrect|0,
      reasonCorrect: S.reasonCorrect|0,
      totalAnswered: S.totalAnswered|0,
      wrongReasonMost: commonWrong
    };

    const payload = {
      atISO: new Date().toISOString(),
      game: 'food-compare',
      meta: { hub:HUB, run:RUN, diff:DIFF, time:S.timePlannedSec|0, seed:SEED, ai:AI_ON?1:0 },
      summary,
      details
    };

    const saved = saveLastSummary(payload);

    emit('hha:end', summary);
    showEnd(summary, details, saved);
  }

  // ----- loop -----
  function tickLoop(){
    if(!S.running) return;
    const t = nowMs();
    const dt = Math.min(250, Math.max(16, (t - S.lastTickMs)));
    S.lastTickMs = t;

    const elapsedSec = Math.floor((t - S.startMs)/1000);
    const left = Math.max(0, (S.timePlannedSec|0) - elapsedSec);
    if(left !== S.timeLeftSec){
      S.timeLeftSec = left;
      renderHUD();
      if(S.timeLeftSec <= 0){ endRun('time'); return; }
    }

    if(!tickLoop._acc) tickLoop._acc = 0;
    tickLoop._acc += dt;
    while(tickLoop._acc >= 1000){
      tickLoop._acc -= 1000;
      if(S.stepLeftSec > 0) S.stepLeftSec--;
      if(S.step === 'reason') $('#reasonTimer').textContent = S.stepLeftSec + 's';
      renderPrompt();
      if(S.stepLeftSec <= 0){
        missStep();
        break;
      }
    }

    WIN.requestAnimationFrame(tickLoop);
  }

  // ----- controls -----
  function goHub(){
    try{ location.href = HUB || '../hub.html'; }
    catch(_){ location.href = '../hub.html'; }
  }
  $('#btnBack').addEventListener('click', ()=>goHub());
  $('#btnRestart').addEventListener('click', ()=>start());

  $('#pickA').addEventListener('click', ()=>choosePick('A'));
  $('#pickB').addEventListener('click', ()=>choosePick('B'));
  $('#pickE').addEventListener('click', ()=>choosePick('E'));

  $('#btnCancelReason').addEventListener('click', ()=>{
    hideReasonOverlay();
    S.step = 'pick';
    S.score = Math.max(0, (S.score|0) - 2);
    emit('hha:score', { score:S.score|0, combo:S.combo|0, misses:S.miss|0 });

    const tip = aiTip('cancel');
    if(tip) setCoach('กลับไปเลือกใหม่ได้ แต่พยายามตัดสินใจให้ไวขึ้นนะ ⚡', 'neutral');

    S.picked = null;
    renderHUD();
    renderPrompt();
  });

  $('#btnEndAgain').addEventListener('click', ()=>{ hideEnd(); start(); });
  $('#btnEndGoHub').addEventListener('click', ()=>goHub());
  $('#btnEndClose').addEventListener('click', ()=>hideEnd());

  function start(){
    hideEnd(); hideReasonOverlay();
    S.running = true;

    S.startMs = nowMs();
    S.lastTickMs = S.startMs;

    S.timePlannedSec = TIME;
    S.timeLeftSec = TIME;

    S.score=0; S.combo=0; S.miss=0;
    S.pickCorrect=0; S.reasonCorrect=0; S.totalAnswered=0;
    S.wrongReasons = {};
    S.lastCoachAt = 0;

    S.roundIdx = 0;
    S.step = 'pick';
    S.stepLeftSec = stepPickSec(DIFF);

    setCoach('เริ่มเลย! เลือกมื้อที่สมดุลกว่า แล้วบอกเหตุผล 🧠', 'neutral');

    loadRound();
    tickLoop();
  }

  // init
  renderHUD();
  renderPrompt();
  start();

})();