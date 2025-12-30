// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — PRODUCTION (HHA Standard) — DOM dual-eye
// ✅ Dual-eye targets: #gj-layer-l / #gj-layer-r (VR/cVR)
// ✅ Emits: hha:score, hha:time, quest:update, hha:coach, hha:end
// ✅ Miss rule: miss = good expired + junk hit (shield-blocked junk NOT count miss)
// ✅ VR hint overlay (non-blocking): btnVrOk hides
// ✅ End summary + back HUB + localStorage last summary
// ✅ Safe spawner: clamp safe-zone (avoid top HUD & bottom fever/controls)
// ✅ Works with ./vr/hha-hud.js + ./vr/ui-fever.js + ./vr/particles.js

'use strict';

export function boot(){
  const DOC = document;
  if(!DOC) return;

  // ---------- helpers ----------
  const $ = (id)=>DOC.getElementById(id);
  const clamp = (v,min,max)=>Math.max(min, Math.min(max, v));
  const now = ()=>performance.now();
  const rndSeeded = (seed0)=>{
    let s = (Number(seed0)||0) >>> 0;
    return function(){
      // xorshift32
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17; s >>>= 0;
      s ^= s << 5;  s >>>= 0;
      return (s >>> 0) / 4294967296;
    };
  };
  const emit = (name, detail)=>{
    try{
      DOC.dispatchEvent(new CustomEvent(name, { detail }));
    }catch(_){}
  };

  // ---------- DOM refs ----------
  const stage = $('gj-stage');
  const layerL = $('gj-layer-l');
  const layerR = $('gj-layer-r');
  const crossL = $('gj-crosshair-l');
  const ringL  = $('atk-ring-l');
  const laserL = $('atk-laser-l');
  const crossR = $('gj-crosshair-r');
  const ringR  = $('atk-ring-r');
  const laserR = $('atk-laser-r');

  const startOverlay = $('startOverlay');
  const btnStart = $('btnStart');
  const startMeta = $('startMeta');

  const btnShoot = $('btnShoot');

  const vrHint = $('vrHint');
  const btnVrOk = $('btnVrOk');

  const btnViewPC = $('btnViewPC');
  const btnViewMobile = $('btnViewMobile');
  const btnViewVR = $('btnViewVR');
  const btnViewCVR = $('btnViewCVR');
  const btnEnterFS = $('btnEnterFS');
  const btnEnterVR = $('btnEnterVR');

  DOC.body.classList.add('has-hud');

  // ---------- URL params ----------
  const usp = new URLSearchParams(location.search);
  const hub = usp.get('hub') ? decodeURIComponent(usp.get('hub')) : '';
  const run = String(usp.get('run') || usp.get('runMode') || 'play').toLowerCase(); // play/research
  const diff = String(usp.get('diff') || 'normal').toLowerCase();
  const durationPlannedSec = Math.max(10, Number(usp.get('time') || usp.get('duration') || 70) || 70);
  const projectTag = String(usp.get('projectTag') || 'HeroHealth');
  const seed = Number(usp.get('seed') || usp.get('v') || Date.now());
  const logUrl = usp.get('log') ? decodeURIComponent(usp.get('log')) : '';

  // view selection
  const autoView = ()=>{
    const v = String(usp.get('view') || '').toLowerCase();
    if(v === 'pc' || v === 'mobile' || v === 'vr' || v === 'cvr') return v;
    return (Math.min(screen.width, screen.height) <= 600) ? 'mobile' : 'pc';
  };

  const RNG = rndSeeded(seed);

  // ---------- assets / fx / fever ----------
  const Particles = (window.GAME_MODULES && window.GAME_MODULES.Particles) || window.Particles || null;
  const FeverUI = (window.GAME_MODULES && window.GAME_MODULES.FeverUI) || window.FeverUI || null;

  function fxPop(x,y,text,cls){
    if(Particles && typeof Particles.popText === 'function'){
      Particles.popText(x,y,text,cls);
    }
  }
  function fxBurst(x,y,kind){
    if(Particles && typeof Particles.burstAt === 'function'){
      Particles.burstAt(x,y,kind);
    }
  }

  // ---------- state ----------
  const S = {
    started:false,
    ended:false,
    view:autoView(), // pc/mobile/vr/cvr
    t0:0,
    lastTick:0,
    timeLeft:durationPlannedSec,

    score:0,
    combo:0,
    miss:0,

    // spawn
    targets:new Map(), // id -> {id,type,emoji, born, lifeMs, x,y, size, elL, elR, hit:false}
    nextId:1,
    spawnEveryMs: (diff==='easy'? 850 : diff==='hard'? 640 : 740),
    lifeGoodMs:   (diff==='easy'? 2100: diff==='hard'? 1350: 1650),
    lifeJunkMs:   (diff==='easy'? 2300: diff==='hard'? 1500: 1750),

    // fever/shield
    fever:0,           // 0..100
    shieldMax:10,
    shield:0,          // charges 0..shieldMax

    // counts
    goodHit:0,
    junkHit:0,
    junkGuard:0,
    goodExpired:0,

    // quest
    goalsTotal:2,
    goalsCleared:0,
    miniTotal:7,
    miniCleared:0,
    activeGoal:0,
    activeMini:0,
    goalCur:0,
    goalTarget:0,
    miniCur:0,
    miniTarget:0,
    miniEndsAt:0,
    miniNoJunk:true,
    miniFailed:false,

    // goal/miss limit
    missLimit: (diff==='easy'? 14 : diff==='hard'? 9 : 11),

    // grade
    grade:'—'
  };

  // ---------- view / VR ----------
  function setActivePills(){
    const set = (btn, on)=> btn && btn.classList.toggle('active', !!on);
    set(btnViewPC, S.view==='pc');
    set(btnViewMobile, S.view==='mobile');
    set(btnViewVR, S.view==='vr');
    set(btnViewCVR, S.view==='cvr');
  }

  function setView(v){
    v = String(v||'').toLowerCase();
    if(!['pc','mobile','vr','cvr'].includes(v)) v = 'mobile';
    S.view = v;

    DOC.body.classList.toggle('view-pc', v==='pc');
    DOC.body.classList.toggle('view-mobile', v==='mobile');
    DOC.body.classList.toggle('view-vr', v==='vr');
    DOC.body.classList.toggle('view-cvr', v==='cvr');

    // right eye aria
    const eyeR = $('eyeR');
    if(eyeR) eyeR.setAttribute('aria-hidden', (v==='vr' || v==='cvr') ? 'false' : 'true');

    setActivePills();
    updateMeta();

    // show VR hint one-time when entering vr/cvr (non-blocking start)
    if((v==='vr' || v==='cvr') && !sessionStorage.getItem('GJ_VR_HINT_OK')){
      if(vrHint) vrHint.hidden = false;
    }else{
      if(vrHint) vrHint.hidden = true;
    }
  }

  async function enterFullscreen(){
    try{
      const el = DOC.documentElement;
      if(el.requestFullscreen) await el.requestFullscreen();
    }catch(_){}
  }

  async function lockLandscape(){
    try{
      if(screen.orientation && screen.orientation.lock){
        await screen.orientation.lock('landscape');
      }
    }catch(_){}
  }

  // ---------- HUD/quest events ----------
  function computeGrade(){
    const totalActions = Math.max(1, S.goodHit + S.junkHit + S.goodExpired);
    const acc = (S.goodHit / totalActions) * 100;
    // SSS, SS, S, A, B, C
    if(acc >= 92 && S.miss <= 4) return 'SSS';
    if(acc >= 86 && S.miss <= 7) return 'SS';
    if(acc >= 78) return 'S';
    if(acc >= 68) return 'A';
    if(acc >= 56) return 'B';
    return 'C';
  }

  function pushScoreEvent(){
    S.grade = computeGrade();
    emit('hha:score', {
      projectTag,
      game:'GoodJunkVR',
      runMode:run,
      diff,
      score:S.score,
      combo:S.combo,
      miss:S.miss,
      grade:S.grade,
      goodHit:S.goodHit,
      junkHit:S.junkHit,
      junkGuard:S.junkGuard,
      goodExpired:S.goodExpired,
      timeLeftSec: Math.max(0, Math.ceil(S.timeLeft))
    });
  }

  function pushTimeEvent(){
    emit('hha:time', {
      timeLeftSec: Math.max(0, Math.ceil(S.timeLeft)),
      durationPlannedSec
    });
  }

  function pushCoach(line, sub, mood){
    emit('hha:coach', { line, sub, mood: mood || 'neutral' });
  }

  function pushQuest(){
    const goalTitle = goalTitleFor(S.activeGoal);
    const miniTitle = miniTitleFor(S.activeMini);
    emit('quest:update', {
      goalTitle: 'Goal: ' + goalTitle,
      goalCur: S.goalCur,
      goalTarget: S.goalTarget,
      miniTitle: 'Mini: ' + miniTitle,
      miniCur: S.miniCur,
      miniTarget: S.miniTarget,
      miniTimeLeftSec: S.miniEndsAt ? Math.max(0, Math.ceil((S.miniEndsAt - now())/1000)) : null,
      goalsCleared: S.goalsCleared,
      goalsTotal: S.goalsTotal,
      miniCleared: S.miniCleared,
      miniTotal: S.miniTotal
    });
  }

  function setFever(v){
    S.fever = clamp(v, 0, 100);
    if(FeverUI && typeof FeverUI.setFever === 'function'){
      FeverUI.setFever(S.fever);
    } else {
      // fallback: update dom ids in html
      const fb = $('feverBar');
      const ft = $('feverText');
      if(fb) fb.style.width = S.fever + '%';
      if(ft) ft.textContent = S.fever + '%';
    }
  }

  function setShield(n){
    S.shield = clamp(n, 0, S.shieldMax);
    if(FeverUI && typeof FeverUI.setShield === 'function'){
      FeverUI.setShield(S.shield, S.shieldMax);
    } else {
      const sp = $('shieldPills');
      if(sp){
        sp.innerHTML = '';
        for(let i=0;i<S.shieldMax;i++){
          const d = DOC.createElement('div');
          d.className = 'pill-dot' + (i < S.shield ? ' on' : '');
          sp.appendChild(d);
        }
      }
    }
  }

  // ---------- meta text ----------
  function updateMeta(){
    const meta = $('hudMeta');
    const view = `view=${S.view}`;
    const end = `end=time`;
    const rush = `rush`;
    const txt = `diff=${diff} • run=${run} • ${end} • ${rush} • ${view}`;
    if(meta) meta.textContent = txt;

    if(startMeta){
      const extra = (logUrl ? ' • log=on' : '');
      startMeta.textContent = `${projectTag} • seed=${seed}${extra} • ${txt} • time=${durationPlannedSec}s`;
    }
  }

  // ---------- safe play rect ----------
  function getPlayRect(){
    // base on left eye viewport
    const eye = $('eyeL');
    const r = eye ? eye.getBoundingClientRect() : (stage ? stage.getBoundingClientRect() : DOC.body.getBoundingClientRect());

    // margins (avoid edges + avoid crosshair center extremes)
    const pad = 18;
    const topPad = 14;   // extra top safe
    const bottomPad = 18;

    // in VR/cVR we want center-ish: reduce bottom drift
    const biasTop = (S.view==='vr' || S.view==='cvr') ? 0.18 : 0.10;
    const biasBot = (S.view==='vr' || S.view==='cvr') ? 0.22 : 0.20;

    const x = r.left + pad;
    const w = Math.max(10, r.width - pad*2);

    // y range as a band, not full height (prevents “เป้าต่ำไป/สูงไป”)
    const yMin = r.top + topPad + r.height * biasTop;
    const yMax = r.top + r.height * (1 - biasBot) - bottomPad;
    const h = Math.max(10, yMax - yMin);

    return { x, y:yMin, w, h, base:r };
  }

  function toEyePos(px, py, size){
    // convert global px to (left, top) inside each eye container
    const eye = $('eyeL');
    const r = eye ? eye.getBoundingClientRect() : { left:0, top:0 };
    const left = px - r.left - size/2;
    const top  = py - r.top  - size/2;
    return { left, top };
  }

  // ---------- target spawn/remove ----------
  const GOOD = ['🥦','🍎','🍉','🥕','🍌','🥬','🍇','🍓','🥑','🍍','🥛','🍚'];
  const JUNK = ['🍟','🍔','🍕','🧁','🍩','🍭','🥤','🧋','🍫','🍗'];
  const SHIELD = ['🛡️'];

  function pick(arr){ return arr[Math.floor(RNG()*arr.length)] || arr[0]; }

  function makeTargetEl(layer, t){
    const el = DOC.createElement('div');
    el.className = `gj-target ${t.type} pop`;
    el.textContent = t.emoji;
    el.dataset.tid = String(t.id);
    el.style.left = t.left + 'px';
    el.style.top  = t.top + 'px';
    el.style.width = t.size + 'px';
    el.style.height= t.size + 'px';
    el.style.fontSize = Math.round(t.size * 0.55) + 'px';

    el.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if(S.ended) return;
      hitTarget(t.id, 'tap');
    }, { passive:false });

    return el;
  }

  function spawnOne(){
    if(!S.started || S.ended) return;

    const rect = getPlayRect();
    const size = (diff==='easy' ? 78 : diff==='hard' ? 68 : 72);
    const px = rect.x + RNG() * rect.w;
    const py = rect.y + RNG() * rect.h;

    // type weights
    const r = RNG();
    let type = 'good';
    if(r < (diff==='easy'? 0.20 : diff==='hard'? 0.35 : 0.28)) type = 'junk';
    if(r > 0.985) type = 'shield';

    const emoji = (type==='good') ? pick(GOOD) : (type==='junk') ? pick(JUNK) : pick(SHIELD);
    const lifeMs = (type==='good') ? S.lifeGoodMs : (type==='junk') ? S.lifeJunkMs : 1600;

    const pos = toEyePos(px, py, size);
    const id = S.nextId++;

    const t = {
      id, type, emoji,
      born: now(),
      lifeMs,
      x:px, y:py, size,
      left: pos.left,
      top: pos.top,
      hit:false,
      elL:null,
      elR:null
    };

    // create both eyes when vr/cvr, else only left layer
    if(layerL){
      t.elL = makeTargetEl(layerL, t);
      layerL.appendChild(t.elL);
    }
    if((S.view==='vr' || S.view==='cvr') && layerR){
      t.elR = makeTargetEl(layerR, t);
      layerR.appendChild(t.elR);
    }

    S.targets.set(id, t);
  }

  function removeTarget(t){
    if(!t) return;
    try{ t.elL && t.elL.remove(); }catch(_){}
    try{ t.elR && t.elR.remove(); }catch(_){}
    S.targets.delete(t.id);
  }

  // ---------- combat ----------
  function pulseAtk(){
    if(ringL) ringL.classList.add('on');
    if(laserL) laserL.classList.add('on');
    if((S.view==='vr' || S.view==='cvr')){
      if(ringR) ringR.classList.add('on');
      if(laserR) laserR.classList.add('on');
    }
    setTimeout(()=>{
      if(ringL) ringL.classList.remove('on');
      if(laserL) laserL.classList.remove('on');
      if(ringR) ringR.classList.remove('on');
      if(laserR) laserR.classList.remove('on');
    }, 160);
  }

  function crosshairCenter(){
    // use left eye crosshair
    const el = crossL || $('eyeL');
    const r = el ? el.getBoundingClientRect() : DOC.body.getBoundingClientRect();
    if(crossL){
      const cr = crossL.getBoundingClientRect();
      return { cx: cr.left + cr.width/2, cy: cr.top + cr.height/2 };
    }
    return { cx: r.left + r.width/2, cy: r.top + r.height/2 };
  }

  function shoot(){
    if(!S.started || S.ended) return;
    pulseAtk();

    // find nearest target to crosshair (use left eye elements for hit test)
    const { cx, cy } = crosshairCenter();
    let best = null;
    let bestD = 1e9;

    for(const t of S.targets.values()){
      if(!t.elL) continue;
      const tr = t.elL.getBoundingClientRect();
      const tx = tr.left + tr.width/2;
      const ty = tr.top + tr.height/2;
      const dx = tx - cx;
      const dy = ty - cy;
      const d = Math.hypot(dx,dy);
      if(d < bestD){
        bestD = d;
        best = t;
      }
    }

    // threshold
    if(best && bestD <= Math.max(52, best.size * 0.62)){
      hitTarget(best.id, 'shoot');
    } else {
      // miss (shot air)
      addMiss('air');
      fxPop(cx, cy, 'MISS', 'miss');
      pushScoreEvent();
      pushQuest();
    }
  }

  function addMiss(reason){
    S.miss++;
    S.combo = 0;
    // fever penalty
    setFever(S.fever - 8);
    // mini fail if forbids junk/miss
    onMiniEvent('miss', reason);
    // fail if exceed miss limit (goal style)
    if(S.miss >= S.missLimit){
      endGame('miss-limit');
    }
  }

  function addScoreGood(px,py){
    S.goodHit++;
    S.combo++;
    const base = 40;
    const bonus = Math.min(80, S.combo * 2);
    S.score += base + bonus;

    setFever(S.fever + (diff==='easy'? 10 : diff==='hard'? 8 : 9));

    // shield earn: every time fever hits 100 -> +1 shield, fever -60 (keep momentum)
    if(S.fever >= 100){
      if(S.shield < S.shieldMax) setShield(S.shield + 1);
      setFever(40);
      fxPop(px, py, '+SHIELD', 'shield');
    }

    fxPop(px, py, '+' + (base+bonus), 'good');
    fxBurst(px, py, 'good');
    pushCoach('ดีมาก! เก็บของดีต่อเนื่อง 🥦✨', 'คอมโบยิ่งสูง คะแนนยิ่งแรง', 'happy');

    onGoalProgress('good');
    onMiniEvent('good');
    pushScoreEvent();
    pushQuest();
  }

  function addHitJunk(px,py){
    // shield block?
    if(S.shield > 0){
      setShield(S.shield - 1);
      S.junkGuard++;
      fxPop(px, py, 'BLOCK', 'guard');
      fxBurst(px, py, 'guard');
      pushCoach('กันได้! ใช้ SHIELD แล้ว 🛡️', 'เหลือโล่: ' + S.shield, 'neutral');

      // IMPORTANT: shield-blocked junk does NOT count as miss
      onMiniEvent('junk-block');
      pushScoreEvent();
      pushQuest();
      return;
    }

    S.junkHit++;
    S.combo = 0;

    // miss rule: junk hit counts as miss
    S.miss++;
    setFever(S.fever - 14);

    fxPop(px, py, 'JUNK!', 'junk');
    fxBurst(px, py, 'bad');
    pushCoach('โอ๊ะ! โดนขยะ 🍟💥', 'พยายามเลี่ยงขยะให้ได้', 'sad');

    onMiniEvent('junk');
    if(S.miss >= S.missLimit){
      endGame('miss-limit');
    }
    pushScoreEvent();
    pushQuest();
  }

  function hitTarget(id, via){
    const t = S.targets.get(id);
    if(!t || t.hit) return;
    t.hit = true;

    // center for fx
    const rect = t.elL ? t.elL.getBoundingClientRect() : null;
    const px = rect ? rect.left + rect.width/2 : t.x;
    const py = rect ? rect.top + rect.height/2 : t.y;

    removeTarget(t);

    if(t.type === 'good') return addScoreGood(px,py);
    if(t.type === 'junk') return addHitJunk(px,py);

    // shield pickup
    if(t.type === 'shield'){
      setShield(Math.min(S.shieldMax, S.shield + 2));
      fxPop(px, py, '+2 SHIELD', 'shield');
      fxBurst(px, py, 'shield');
      pushCoach('เก็บโล่! 🛡️', 'โดนขยะครั้งต่อไปจะกันให้', 'happy');
      pushScoreEvent();
      pushQuest();
    }
  }

  // ---------- quest (2 goals + 7 minis) ----------
  function goalTitleFor(idx){
    if(idx===0) return `เก็บของดีให้ครบ`;
    if(idx===1) return `เอาตัวรอด (Miss ≤ ${S.missLimit})`;
    return '—';
  }
  function miniTitleFor(idx){
    const titles = [
      'No-Junk Zone 10s',
      'Streak: คอมโบ 6',
      'Rush: ของดี 5 ใน 8s',
      'No-Miss 12s',
      'Shield Save: กันขยะ 1',
      'Accurate: ยิงโดน 8 ครั้ง',
      'Final Sprint 8s'
    ];
    return titles[idx] || '—';
  }

  function setupGoal(idx){
    S.activeGoal = idx;
    if(idx===0){
      S.goalTarget = (diff==='easy'? 18 : diff==='hard'? 24 : 21);
      S.goalCur = 0;
      pushCoach('เริ่ม Goal 1!', `เก็บของดีให้ครบ ${S.goalTarget} ชิ้น`, 'neutral');
    }else if(idx===1){
      S.goalTarget = S.missLimit; // show as limit
      S.goalCur = S.miss; // current miss
      pushCoach('เริ่ม Goal 2!', `เอาตัวรอดจนหมดเวลา (Miss ≤ ${S.missLimit})`, 'neutral');
    }
    pushQuest();
  }

  function clearGoal(){
    S.goalsCleared++;
    fxPop(window.innerWidth/2, window.innerHeight*0.25, 'GOAL CLEAR!', 'goal');
    pushCoach('ผ่าน Goal แล้ว! ✅', `เหลืออีก ${S.goalsTotal - S.goalsCleared} Goal`, 'happy');

    if(S.goalsCleared >= S.goalsTotal){
      endGame('all-goals');
      return;
    }
    setupGoal(S.goalsCleared);
  }

  function setupMini(idx){
    S.activeMini = idx;
    S.miniFailed = false;

    // defaults
    S.miniCur = 0;
    S.miniTarget = 0;
    S.miniEndsAt = 0;
    S.miniNoJunk = false;

    const t = now();

    if(idx===0){
      S.miniNoJunk = true;
      S.miniEndsAt = t + 10000;
      pushCoach('Mini: No-Junk Zone!', '10 วิ ห้ามโดนขยะ', 'neutral');
    } else if(idx===1){
      S.miniTarget = 6;
      pushCoach('Mini: Streak!', 'ทำคอมโบให้ถึง 6', 'neutral');
    } else if(idx===2){
      S.miniNoJunk = true;
      S.miniTarget = 5;
      S.miniEndsAt = t + 8000;
      pushCoach('Mini: Rush!', 'เก็บของดี 5 ใน 8 วิ (ห้ามโดนขยะ)', 'neutral');
    } else if(idx===3){
      S.miniEndsAt = t + 12000;
      pushCoach('Mini: No-Miss!', '12 วิ ห้ามพลาด (MISS)', 'neutral');
    } else if(idx===4){
      S.miniTarget = 1;
      pushCoach('Mini: Shield Save!', 'กันขยะให้ได้ 1 ครั้ง', 'neutral');
    } else if(idx===5){
      S.miniTarget = 8;
      pushCoach('Mini: Accurate!', 'ยิงโดนให้ครบ 8 ครั้ง', 'neutral');
    } else if(idx===6){
      S.miniEndsAt = t + 8000;
      pushCoach('Mini: Final Sprint!', '8 วิสุดท้าย เก็บให้ได้มากที่สุด!', 'neutral');
    }

    pushQuest();
  }

  function clearMini(){
    S.miniCleared++;
    fxPop(window.innerWidth/2, window.innerHeight*0.30, 'MINI CLEAR!', 'mini');
    pushCoach('Mini ผ่าน! ⭐', `Mini ${S.miniCleared}/${S.miniTotal}`, 'happy');

    if(S.miniCleared < S.miniTotal){
      setupMini(S.miniCleared);
    }
    pushQuest();
  }

  function failMini(reason){
    if(S.miniFailed) return;
    S.miniFailed = true;
    pushCoach('Mini ไม่ผ่าน 😵', String(reason||'') , 'sad');

    // move on after a short delay
    setTimeout(()=>{
      if(S.ended) return;
      if(S.miniCleared < S.miniTotal){
        setupMini(S.miniCleared); // retry current index (optional)
        // ถ้าอยาก “ข้ามไปอันถัดไป” ให้เปลี่ยนเป็น:
        // S.miniCleared++; setupMini(S.miniCleared);
      }
    }, 550);
  }

  function onGoalProgress(kind){
    if(S.activeGoal === 0){
      if(kind === 'good'){
        S.goalCur++;
        if(S.goalCur >= S.goalTarget){
          clearGoal();
        }
      }
    } else if(S.activeGoal === 1){
      // survival goal: keep miss under limit until time end
      S.goalCur = S.miss;
      if(S.miss > S.missLimit){
        endGame('miss-limit');
      }
      // clear when time ends handled in endGame
    }
  }

  function onMiniEvent(kind, reason){
    const idx = S.activeMini;

    if(idx===0){
      if(kind==='junk') failMini('โดนขยะ');
      // time-based pass in tick()
    }
    else if(idx===1){
      // streak
      S.miniCur = Math.max(S.miniCur, S.combo);
      S.miniTarget = 6;
      if(S.miniCur >= S.miniTarget) clearMini();
      if(kind==='junk') failMini('คอมโบขาด');
    }
    else if(idx===2){
      // rush: good 5 in 8s, no junk
      if(kind==='good') S.miniCur++;
      if(kind==='junk') failMini('โดนขยะ');
      if(S.miniCur >= S.miniTarget) clearMini();
    }
    else if(idx===3){
      // no-miss 12s
      if(kind==='miss') failMini('พลาด');
      if(kind==='junk') failMini('โดนขยะ');
      // pass in tick()
    }
    else if(idx===4){
      // shield save
      if(kind==='junk-block'){
        S.miniCur++;
        S.miniTarget = 1;
        if(S.miniCur >= 1) clearMini();
      }
    }
    else if(idx===5){
      // accurate: total hits 8
      if(kind==='good') S.miniCur++;
      if(S.miniCur >= S.miniTarget) clearMini();
    }
    else if(idx===6){
      // final sprint: just time-based; never fails
      // score boost already via combo
    }

    pushQuest();
  }

  // ---------- update / loop ----------
  let spawnTimer = 0;

  function tick(){
    if(!S.started || S.ended) return;

    const t = now();
    const dt = (S.lastTick ? (t - S.lastTick) : 16);
    S.lastTick = t;

    // time
    const dtSec = dt / 1000;
    S.timeLeft = Math.max(0, S.timeLeft - dtSec);
    pushTimeEvent();

    // spawn
    spawnTimer += dt;
    while(spawnTimer >= S.spawnEveryMs){
      spawnTimer -= S.spawnEveryMs;
      spawnOne();
    }

    // expire targets
    for(const tar of Array.from(S.targets.values())){
      if(t - tar.born >= tar.lifeMs){
        // expired
        removeTarget(tar);

        if(tar.type === 'good'){
          S.goodExpired++;
          // miss rule: good expired counts as miss
          addMiss('expire-good');
          pushScoreEvent();
        }
      }
    }

    // mini timers pass
    if(S.miniEndsAt){
      const left = S.miniEndsAt - t;
      if(left <= 0){
        // if not failed, clear
        if(!S.miniFailed){
          clearMini();
        }
        S.miniEndsAt = 0;
      }
    }

    // goal 2 clears at time end
    if(S.timeLeft <= 0){
      if(S.activeGoal === 1 && S.miss <= S.missLimit){
        clearGoal(); // triggers end by all goals, or just credit
      }
      endGame('time');
      return;
    }

    requestAnimationFrame(tick);
  }

  // ---------- end summary + hub + last summary ----------
  function safeSetLS(key, val){
    try{ localStorage.setItem(key, val); }catch(_){}
  }

  function buildEndSummary(reason){
    const wrap = $('end-summary');
    if(!wrap) return;

    wrap.innerHTML = '';
    const ov = DOC.createElement('div');
    ov.className = 'end-overlay';
    const card = DOC.createElement('div');
    card.className = 'end-card';

    const title = DOC.createElement('div');
    title.className = 'end-title';
    title.textContent = 'สรุปผล GoodJunkVR';

    const grid = DOC.createElement('div');
    grid.className = 'end-grid';

    const mk = (k,v)=>{
      const d = DOC.createElement('div');
      d.className = 'end-item';
      d.innerHTML = `<div class="k">${k}</div><div class="v">${v}</div>`;
      return d;
    };

    card.appendChild(title);
    grid.appendChild(mk('Score', S.score));
    grid.appendChild(mk('Grade', S.grade));
    grid.appendChild(mk('Miss', S.miss));
    grid.appendChild(mk('Combo Max', Math.max(S.combo, 0)));
    grid.appendChild(mk('Good Hit', S.goodHit));
    grid.appendChild(mk('Junk Hit', S.junkHit));
    grid.appendChild(mk('Guard', S.junkGuard));
    grid.appendChild(mk('Reason', String(reason||'end')));
    grid.appendChild(mk('Time', `${durationPlannedSec - Math.ceil(S.timeLeft)}/${durationPlannedSec}s`));
    card.appendChild(grid);

    const actions = DOC.createElement('div');
    actions.className = 'end-actions';

    const btnReplay = DOC.createElement('button');
    btnReplay.className = 'btn';
    btnReplay.textContent = 'เล่นอีกครั้ง';
    btnReplay.onclick = ()=> location.reload();

    const btnBack = DOC.createElement('button');
    btnBack.className = 'btn primary';
    btnBack.textContent = 'กลับ HUB';
    btnBack.onclick = ()=>{
      if(hub) location.href = hub;
      else location.href = '../hub.html';
    };

    actions.appendChild(btnReplay);
    actions.appendChild(btnBack);
    card.appendChild(actions);

    ov.appendChild(card);
    wrap.appendChild(ov);
  }

  function endGame(reason){
    if(S.ended) return;
    S.ended = true;

    // stop overlay stuff
    try{
      for(const t of S.targets.values()) removeTarget(t);
    }catch(_){}

    // freeze UI
    pushScoreEvent();
    pushTimeEvent();

    // last summary
    const last = {
      timestampIso: new Date().toISOString(),
      projectTag,
      game:'GoodJunkVR',
      runMode: run,
      diff,
      durationPlannedSec,
      scoreFinal: S.score,
      grade: S.grade,
      misses: S.miss,
      goalsCleared: S.goalsCleared,
      goalsTotal: S.goalsTotal,
      miniCleared: S.miniCleared,
      miniTotal: S.miniTotal,
      goodHit: S.goodHit,
      junkHit: S.junkHit,
      junkGuard: S.junkGuard,
      goodExpired: S.goodExpired,
      reason: String(reason||'end'),
      hub: hub || ''
    };
    safeSetLS('HHA_LAST_SUMMARY', JSON.stringify(last));

    // emit end (HUD binder may show something)
    emit('hha:end', last);

    // show overlay
    buildEndSummary(reason);
  }

  // ---------- controls wiring ----------
  function wire(){
    // view buttons
    btnViewPC && btnViewPC.addEventListener('click', ()=>setView('pc'));
    btnViewMobile && btnViewMobile.addEventListener('click', ()=>setView('mobile'));
    btnViewVR && btnViewVR.addEventListener('click', ()=>setView('vr'));
    btnViewCVR && btnViewCVR.addEventListener('click', ()=>setView('cvr'));

    btnEnterFS && btnEnterFS.addEventListener('click', async ()=>{
      await enterFullscreen();
    });

    btnEnterVR && btnEnterVR.addEventListener('click', async ()=>{
      // "Enter VR" here means: switch to VR view + fullscreen + try lock landscape
      setView('vr');
      await enterFullscreen();
      await lockLandscape();
      if(vrHint) vrHint.hidden = false;
    });

    btnVrOk && btnVrOk.addEventListener('click', ()=>{
      sessionStorage.setItem('GJ_VR_HINT_OK', '1');
      if(vrHint) vrHint.hidden = true;
    });

    // shoot button
    btnShoot && btnShoot.addEventListener('click', ()=>shoot());

    // start
    btnStart && btnStart.addEventListener('click', ()=>{
      if(S.started) return;
      startGame();
    });

    // if user taps outside in stage, shoot (optional)
    stage && stage.addEventListener('pointerdown', (e)=>{
      // ignore taps on viewbar buttons / overlays
      if(e.target && (e.target.closest('.viewbar') || e.target.closest('#startOverlay') || e.target.closest('#vrHint'))) return;
      // allow tap to shoot
      shoot();
    }, { passive:true });

    // resize/orientation: keep dual-eye clones count right
    window.addEventListener('resize', ()=>{
      // nothing heavy; playRect auto computed per spawn
    });

    // prevent “ค้างหน้าการ์ด VR”: overlay ไม่บล็อก start จริง
    // (ถ้าอยากให้ VR hint ปิดแล้วเริ่มอัตโนมัติ ค่อยสั่งเพิ่ม)
  }

  function startGame(){
    S.started = true;
    if(startOverlay) startOverlay.hidden = true;

    // init fever ui
    setFever(0);
    setShield(0);

    // init quest
    setupGoal(0);
    setupMini(0);

    pushScoreEvent();
    pushTimeEvent();
    pushQuest();
    pushCoach('พร้อมลุย! เก็บของดี หลีกขยะ 🥦🚫', 'เล็งกลางแล้วกดยิง / คลิกเป้าก็ได้', 'neutral');

    // loop
    S.t0 = now();
    S.lastTick = 0;
    spawnTimer = 0;
    requestAnimationFrame(tick);
  }

  // ---------- init ----------
  function init(){
    updateMeta();
    setView(S.view);
    setActivePills();

    // ensure right eye hidden in pc/mobile at load
    if(!(S.view==='vr' || S.view==='cvr')){
      if(layerR) layerR.innerHTML = '';
    }

    // show start overlay
    if(startOverlay) startOverlay.hidden = false;

    // always safe-wire
    wire();

    // start meta
    updateMeta();

    // if ui-fever has ensure method
    try{
      if(FeverUI && typeof FeverUI.ensure === 'function') FeverUI.ensure();
    }catch(_){}
  }

  init();
}