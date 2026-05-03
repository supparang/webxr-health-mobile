// === /herohealth/gate/games/goodjunk/cooldown.js ===
// HeroHealth Gate Mini-game
// GAME: goodjunk
// MODE: cooldown
// FULL PATCH v20260503-GJ-GATE-COOLDOWN-NUTRITION-ZONE-FLOW-SAFE
// ✅ ใช้ร่วมกับ /herohealth/warmup-gate.html หรือ gate-core.js
// ✅ ไฟล์นี้ไม่ redirect เอง
// ✅ เมื่อ finish แล้ว gate-core เป็นคนพากลับ nutrition-zone ผ่าน cdnext/hub

let __styleLoaded = false;

export function loadStyle(){
  if(__styleLoaded) return;
  __styleLoaded = true;

  const id = 'gate-style-goodjunk-cooldown-inline';
  if(document.getElementById(id)) return;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    .gjcd-wrap{
      position:relative;
      min-height:420px;
      border:1px solid rgba(148,163,184,.16);
      border-radius:22px;
      background:
        radial-gradient(900px 400px at 50% -10%, rgba(34,211,238,.08), transparent 60%),
        linear-gradient(180deg, rgba(2,6,23,.55), rgba(2,6,23,.78));
      overflow:hidden;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.03);
    }

    .gjcd-top{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      flex-wrap:wrap;
      padding:14px 14px 8px;
    }

    .gjcd-title{
      font-size:20px;
      font-weight:1000;
      line-height:1.15;
      margin:0;
    }

    .gjcd-sub{
      margin-top:4px;
      color:#94a3b8;
      font-size:13px;
      font-weight:900;
      line-height:1.45;
    }

    .gjcd-chips{
      display:flex;
      align-items:center;
      gap:8px;
      flex-wrap:wrap;
    }

    .gjcd-chip{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:36px;
      padding:8px 12px;
      border-radius:999px;
      border:1px solid rgba(148,163,184,.16);
      background:rgba(15,23,42,.62);
      color:#e5e7eb;
      font-size:12px;
      font-weight:1000;
      box-shadow:0 10px 24px rgba(0,0,0,.18);
    }

    .gjcd-stage{
      position:relative;
      margin:10px 12px 12px;
      min-height:300px;
      border-radius:18px;
      border:1px dashed rgba(148,163,184,.12);
      background:
        radial-gradient(circle at 50% 120%, rgba(56,189,248,.08), transparent 40%),
        linear-gradient(180deg, rgba(15,23,42,.25), rgba(15,23,42,.10));
      overflow:hidden;
      touch-action:manipulation;
      user-select:none;
    }

    .gjcd-help{
      padding:0 14px 14px;
      color:#cbd5e1;
      font-size:12px;
      font-weight:900;
      line-height:1.5;
    }

    .gjcd-bubble{
      position:absolute;
      transform:translate(-50%,-50%);
      display:grid;
      place-items:center;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.12);
      background:radial-gradient(circle at 35% 30%, rgba(255,255,255,.28), rgba(125,211,252,.18) 45%, rgba(2,132,199,.10) 100%);
      box-shadow:
        0 14px 32px rgba(0,0,0,.22),
        inset 0 1px 0 rgba(255,255,255,.14);
      cursor:pointer;
      pointer-events:auto;
      color:#f8fafc;
      text-shadow:0 2px 10px rgba(0,0,0,.35);
      font-weight:1000;
      animation: gjcd-bob 1.4s ease-in-out infinite alternate;
    }

    .gjcd-bubble.bad{
      background:radial-gradient(circle at 35% 30%, rgba(255,255,255,.18), rgba(248,113,113,.16) 45%, rgba(185,28,28,.12) 100%);
    }

    .gjcd-bubble.good{
      background:radial-gradient(circle at 35% 30%, rgba(255,255,255,.28), rgba(134,239,172,.18) 45%, rgba(22,163,74,.10) 100%);
    }

    @keyframes gjcd-bob{
      from{ transform:translate(-50%,-50%) translateY(0px); }
      to{ transform:translate(-50%,-50%) translateY(-6px); }
    }

    .gjcd-fx{
      position:absolute;
      transform:translate(-50%,-50%);
      font-size:20px;
      font-weight:1000;
      pointer-events:none;
      text-shadow:0 10px 24px rgba(0,0,0,.32);
      animation: gjcd-float .55s ease-out forwards;
    }

    .gjcd-fx.good{ color:#86efac; }
    .gjcd-fx.bad{ color:#fca5a5; }

    @keyframes gjcd-float{
      from{ opacity:1; transform:translate(-50%,-50%) translateY(0px) scale(1); }
      to{ opacity:0; transform:translate(-50%,-50%) translateY(-26px) scale(1.08); }
    }

    .gjcd-center{
      position:absolute;
      inset:0;
      display:grid;
      place-items:center;
      pointer-events:none;
      text-align:center;
      padding:18px;
    }

    .gjcd-center-card{
      max-width:560px;
      border-radius:20px;
      border:1px solid rgba(148,163,184,.14);
      background:rgba(2,6,23,.44);
      box-shadow:0 18px 55px rgba(0,0,0,.24);
      padding:16px 18px;
      backdrop-filter:blur(8px);
    }

    .gjcd-center-big{
      font-size:30px;
      font-weight:1000;
      line-height:1.1;
      margin:0;
    }

    .gjcd-center-small{
      margin-top:8px;
      color:#cbd5e1;
      font-size:13px;
      font-weight:900;
      line-height:1.5;
    }

    @media (max-width: 640px){
      .gjcd-wrap{ min-height:460px; }
      .gjcd-stage{ min-height:320px; }
      .gjcd-center-big{ font-size:24px; }
      .gjcd-sub,.gjcd-help{ font-size:12px; }
    }
  `;
  document.head.appendChild(style);
}

export async function mount(root, ctx, api){
  loadStyle();

  const host = root;
  host.innerHTML = `
    <div class="gjcd-wrap">
      <div class="gjcd-top">
        <div>
          <h3 class="gjcd-title">GoodJunk Calm Review</h3>
          <div class="gjcd-sub">เก็บฟองดี 🫧 ปล่อยของไม่ดีผ่านไป เพื่อผ่อนจังหวะก่อนกลับ Nutrition Zone</div>
        </div>

        <div class="gjcd-chips">
          <div class="gjcd-chip">TIME <span id="gjcdTime" style="margin-left:6px;">12</span>s</div>
          <div class="gjcd-chip">SCORE <span id="gjcdScore" style="margin-left:6px;">0</span></div>
          <div class="gjcd-chip">MISS <span id="gjcdMiss" style="margin-left:6px;">0</span></div>
          <div class="gjcd-chip">PROGRESS <span id="gjcdProgress" style="margin-left:6px;">0%</span></div>
        </div>
      </div>

      <div class="gjcd-stage" id="gjcdStage">
        <div class="gjcd-center" id="gjcdCenter">
          <div class="gjcd-center-card">
            <div class="gjcd-center-big">คูลดาวน์สั้น ๆ</div>
            <div class="gjcd-center-small">
              แตะฟองสีเขียวหรือฟองสะอาดเพื่อเก็บแต้ม<br>
              อย่าแตะขนมหรือฟองแดง แล้วผ่อนจังหวะสบาย ๆ
            </div>
          </div>
        </div>
      </div>

      <div class="gjcd-help">
        เป้าหมาย: ทำ progress ให้ถึง 100% หรือเล่นจนครบเวลา แล้วระบบจะพากลับ Nutrition Zone
      </div>
    </div>
  `;

  const stage = host.querySelector('#gjcdStage');
  const center = host.querySelector('#gjcdCenter');
  const elTime = host.querySelector('#gjcdTime');
  const elScore = host.querySelector('#gjcdScore');
  const elMiss = host.querySelector('#gjcdMiss');
  const elProgress = host.querySelector('#gjcdProgress');

  const qs = (k, d='')=>{
    try{ return (new URL(location.href)).searchParams.get(k) ?? d; }
    catch(_){ return d; }
  };

  const diff = String(ctx?.diff || qs('diff', 'easy')).toLowerCase();
  const plannedSec = 12;
  const targetScore =
    diff === 'hard' ? 70 :
    diff === 'normal' ? 56 :
    diff === 'challenge' ? 80 :
    42;

  let running = false;
  let ended = false;
  let rafId = 0;
  let lastTs = 0;
  let timeLeft = plannedSec;
  let spawnAcc = 0;

  let score = 0;
  let miss = 0;
  let progress = 0;
  let seq = 0;

  const nodes = new Map();

  const GOOD_POOL = ['🫧','💧','🌿','🥬','🥦','🍎','🍉'];
  const BAD_POOL  = ['🍩','🍬','🍫','🧁','🍪'];

  function clamp(v, a, b){
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  function updateHud(){
    const accText = `${Math.round(progress)}%`;

    if(elTime) elTime.textContent = String(Math.max(0, Math.ceil(timeLeft)));
    if(elScore) elScore.textContent = String(score);
    if(elMiss) elMiss.textContent = String(miss);
    if(elProgress) elProgress.textContent = accText;

    api?.setStats?.({
      time: Math.max(0, Math.ceil(timeLeft)),
      score,
      miss,
      acc: accText
    });
  }

  function stageRect(){
    return stage.getBoundingClientRect();
  }

  function spawnPoint(){
    const r = stageRect();
    const padX = 26;
    const padY = 26;

    return {
      x: padX + Math.random() * Math.max(40, r.width - padX * 2),
      y: padY + Math.random() * Math.max(40, r.height - padY * 2)
    };
  }

  function fxAt(x, y, text, kind='good'){
    const n = document.createElement('div');
    n.className = `gjcd-fx ${kind}`;
    n.style.left = `${x}px`;
    n.style.top = `${y}px`;
    n.textContent = text;
    stage.appendChild(n);
    setTimeout(()=> n.remove(), 560);
  }

  function removeNode(id){
    const o = nodes.get(id);
    if(!o) return;
    nodes.delete(id);
    try{ o.el.remove(); }catch(_){}
  }

  function finishGame(){
    if(ended) return;

    ended = true;
    running = false;
    cancelAnimationFrame(rafId);

    for(const [id] of nodes) removeNode(id);

    const passed = progress >= 100 || score >= targetScore || timeLeft <= 0;
    const progressRounded = Math.round(progress);

    const lines = [
      `คะแนนคูลดาวน์ ${score}`,
      `พลาด ${miss}`,
      `ความคืบหน้า ${progressRounded}%`
    ];

    api?.finish?.({
      ok: passed,
      source: 'gate-goodjunk-cooldown',
      game: 'goodjunk',
      phase: 'cooldown',
      mode: ctx?.mode || 'solo-boss',
      title: 'คูลดาวน์เสร็จแล้ว 🌙',
      subtitle: 'พร้อมกลับ Nutrition Zone',
      lines,
      score,
      miss,
      progress: progressRounded,
      acc: `${progressRounded}%`,
      passed,
      metrics: {
        score,
        miss,
        progress: progressRounded,
        targetScore,
        plannedSec,
        diff
      },
      markDailyDone: true
    });
  }

  function hitBubble(id){
    const o = nodes.get(id);
    if(!o || ended) return;

    const x = o.x;
    const y = o.y;

    if(o.kind === 'good'){
      score += o.value;
      progress = clamp((score / targetScore) * 100, 0, 100);
      fxAt(x, y, `+${o.value}`, 'good');
    }else{
      miss += 1;
      score = Math.max(0, score - o.value);
      progress = clamp((score / targetScore) * 100, 0, 100);
      fxAt(x, y, `-${o.value}`, 'bad');
    }

    removeNode(id);
    updateHud();

    if(progress >= 100){
      finishGame();
    }
  }

  function spawnBubble(kind='good'){
    if(ended) return;

    const p = spawnPoint();
    const id = `gjcd_${Date.now()}_${++seq}`;
    const bubble = document.createElement('button');

    bubble.type = 'button';
    bubble.className = `gjcd-bubble ${kind}`;
    bubble.style.left = `${p.x}px`;
    bubble.style.top = `${p.y}px`;

    const size =
      kind === 'good'
        ? 54 + Math.floor(Math.random() * 16)
        : 50 + Math.floor(Math.random() * 14);

    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.fontSize = `${Math.max(24, Math.round(size * 0.42))}px`;

    bubble.textContent =
      kind === 'good'
        ? GOOD_POOL[Math.floor(Math.random() * GOOD_POOL.length)]
        : BAD_POOL[Math.floor(Math.random() * BAD_POOL.length)];

    const ttl =
      kind === 'good'
        ? (diff === 'hard' || diff === 'challenge' ? 1900 : diff === 'normal' ? 2200 : 2500)
        : (diff === 'hard' || diff === 'challenge' ? 2200 : diff === 'normal' ? 2500 : 2800);

    const value = kind === 'good' ? 7 : 5;

    bubble.addEventListener('pointerdown', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      hitBubble(id);
    }, { passive:false });

    stage.appendChild(bubble);

    nodes.set(id, {
      id,
      el: bubble,
      kind,
      x: p.x,
      y: p.y,
      born: performance.now(),
      ttl,
      value
    });
  }

  function expireOld(now){
    for(const [id, o] of nodes){
      if(now - o.born >= o.ttl){
        if(o.kind === 'good'){
          miss += 1;
          progress = clamp((score / targetScore) * 100, 0, 100);
          fxAt(o.x, o.y, 'ช้า!', 'bad');
          updateHud();
        }

        removeNode(id);
      }
    }
  }

  function tick(ts){
    if(ended) return;

    if(!lastTs) lastTs = ts;

    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    if(!running){
      rafId = requestAnimationFrame(tick);
      return;
    }

    timeLeft = Math.max(0, timeLeft - dt);

    const spawnRate =
      diff === 'challenge' ? 1.62 :
      diff === 'hard' ? 1.45 :
      diff === 'normal' ? 1.20 :
      1.00;

    spawnAcc += dt * spawnRate;

    while(spawnAcc >= 1){
      spawnAcc -= 1;

      const activeMax =
        diff === 'challenge' ? 7 :
        diff === 'hard' ? 6 :
        diff === 'normal' ? 5 :
        4;

      if(nodes.size < activeMax){
        const badChance =
          diff === 'challenge' ? 0.38 :
          diff === 'hard' ? 0.34 :
          diff === 'normal' ? 0.28 :
          0.22;

        spawnBubble(Math.random() < badChance ? 'bad' : 'good');
      }
    }

    expireOld(ts);
    updateHud();

    if(timeLeft <= 0){
      finishGame();
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  function start(){
    if(running || ended) return;

    running = true;

    if(center) center.style.display = 'none';

    api?.setSub?.('เก็บฟองดี แล้วผ่อนจังหวะก่อนกลับ Nutrition Zone');
    updateHud();
  }

  stage.addEventListener('pointerdown', ()=>{
    start();
  }, { passive:true });

  api?.logger?.push?.('mini_start', {
    source: 'gate-goodjunk-cooldown',
    game: 'goodjunk',
    phase: 'cooldown',
    mode: ctx?.mode || 'solo-boss',
    diff,
    targetScore,
    plannedSec
  });

  api?.setSub?.('แตะพื้นที่เล่นเพื่อเริ่ม cooldown');
  updateHud();
  rafId = requestAnimationFrame(tick);

  return {
    start,
    destroy(){
      ended = true;
      running = false;
      cancelAnimationFrame(rafId);
      for(const [id] of nodes) removeNode(id);
      host.innerHTML = '';
    }
  };
}

export default { mount, loadStyle };
