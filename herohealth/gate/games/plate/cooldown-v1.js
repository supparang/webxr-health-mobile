/* === /herohealth/gate/games/plate/cooldown-v1.js ===
   HeroHealth Gate Mini-game
   GAME: platev1
   MODE: cooldown
   FINAL PATCH v20260320-PLATEV1-COOLDOWN
*/

let __styleLoaded = false;

export function loadStyle(){
  if(__styleLoaded) return;
  __styleLoaded = true;

  const id = 'gate-style-plate-cooldown-v1';
  if(document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = new URL('./style.css', import.meta.url).toString();
  document.head.appendChild(link);
}

function el(tag, cls = '', text = ''){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(text) n.textContent = text;
  return n;
}

function shuffle(arr, rng = Math.random){
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mulberry32(seed){
  let t = (seed >>> 0) || 1;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export async function mount(root, ctx, api){
  loadStyle();

  const rng = mulberry32(Number(ctx.seed || Date.now()) + 97);
  const plannedTime = Number(ctx.time || 15);
  let timeLeft = plannedTime;
  let ended = false;
  let started = false;
  let score = 0;
  let miss = 0;
  let step = 0;

  const reminders = shuffle([
    'ผักครึ่งจานช่วยเพิ่มใยอาหาร 🥬',
    'ข้าว/แป้งหนึ่งในสี่จานพอดีอิ่ม 🍚',
    'โปรตีนหนึ่งในสี่จานช่วยซ่อมแซมร่างกาย 🐟',
    'หลีกเลี่ยงหวาน มัน เค็ม มากเกินไป 🍟',
    'ดื่มน้ำเปล่าคู่มื้ออาหารจะดีกว่า 🥤❌'
  ], rng).slice(0, 3);

  root.innerHTML = '';
  const wrap = el('div', 'plt-wrap');
  const hero = el('div', 'plt-hero');
  const stage = el('div', 'plt-stage');
  const panel = el('div', 'plt-panel');
  const prompt = el('div', 'plt-prompt', 'ทบทวนให้ครบก่อนกลับหน้าหลัก');
  const choices = el('div', 'plt-choices');

  hero.innerHTML = `
    <div class="plt-kicker">NUTRITION ZONE • PLATE V1 • COOLDOWN</div>
    <div class="plt-title">ทบทวนจานสุขภาพ</div>
    <div class="plt-sub">เลือกข้อความที่ถูกต้อง เพื่อย้ำความเข้าใจก่อนกลับหน้าหลัก</div>
  `;

  stage.appendChild(panel);
  stage.appendChild(prompt);
  stage.appendChild(choices);
  wrap.appendChild(hero);
  wrap.appendChild(stage);
  root.appendChild(wrap);

  api?.logger?.push?.('mini_start', {
    game: 'platev1',
    mode: 'cooldown',
    seed: ctx.seed
  });

  api?.setStats?.({
    time: timeLeft,
    score,
    miss,
    acc: '0%'
  });

  function updateHud(){
    const acc = step > 0 ? Math.round(((step - miss) / step) * 100) : 0;
    api?.setStats?.({
      time: timeLeft,
      score,
      miss,
      acc: `${Math.max(0, acc)}%`
    });
  }

  function renderRound(){
    if(ended) return;
    if(step >= reminders.length){
      finishNow();
      return;
    }

    panel.innerHTML = `
      <div class="plt-target">ข้อไหนถูกเกี่ยวกับจานสุขภาพ?</div>
      <div class="plt-note">เลือกคำตอบที่ถูกที่สุด</div>
    `;

    const correct = reminders[step];
    const wrongPool = [
      'ควรกินของทอดครึ่งจานทุกมื้อ',
      'น้ำหวานแทนน้ำเปล่าได้เสมอ',
      'โปรตีนต้องเต็มจานจึงดีที่สุด',
      'ผักไม่จำเป็นถ้ามีผลไม้แล้ว',
      'ขนมหวานหลังอาหารยิ่งเยอะยิ่งดี'
    ];

    const opts = shuffle([
      correct,
      wrongPool[step % wrongPool.length],
      wrongPool[(step + 1) % wrongPool.length]
    ], rng);

    choices.innerHTML = '';

    opts.forEach(opt=>{
      const good = (opt === correct);
      const btn = el('button', `plt-btn ${good ? 'good' : 'ghost'}`, opt);
      btn.type = 'button';

      btn.addEventListener('click', ()=>{
        if(ended) return;

        step++;
        if(good){
          score += 10;
        }else{
          miss++;
          score = Math.max(0, score - 3);
        }

        api?.logger?.push?.('mini_answer', {
          game:'platev1',
          mode:'cooldown',
          step,
          selected: opt,
          correct,
          good: good ? 1 : 0,
          score,
          miss
        });

        updateHud();
        renderRound();
      });

      choices.appendChild(btn);
    });
  }

  function finishNow(){
    if(ended) return;
    ended = true;
    clearInterval(timer);

    const acc = step > 0 ? Math.round(((step - miss) / step) * 100) : 100;

    root.innerHTML = `
      <div class="plt-result">
        <div class="plt-badge">😌 Cooldown Complete</div>
        <div class="plt-big">เยี่ยมมาก! วันนี้ทบทวนเสร็จแล้ว</div>
        <div class="plt-list">
          <div class="plt-item">คะแนน: ${score}</div>
          <div class="plt-item">ความถูกต้อง: ${Math.max(0, acc)}%</div>
          <div class="plt-item">จำไว้: ผัก 1/2 + ข้าว/แป้ง 1/4 + โปรตีน 1/4</div>
        </div>
        <div class="plt-actions">
          <button class="plt-btn good" id="pltDoneBtn" type="button">กลับหน้าหลัก</button>
        </div>
      </div>
    `;

    root.querySelector('#pltDoneBtn')?.addEventListener('click', ()=>{
      api?.finish?.({
        ok: true,
        title: 'เสร็จแล้ว!',
        subtitle: 'กลับหน้าหลักได้เลย',
        lines: [
          `คะแนน: ${score}`,
          `ความถูกต้อง: ${Math.max(0, acc)}%`,
          'ผัก 1/2 + ข้าว/แป้ง 1/4 + โปรตีน 1/4'
        ],
        buffs: {},
        markDailyDone: true
      });
    });
  }

  const timer = setInterval(()=>{
    if(ended) return;
    timeLeft--;
    if(timeLeft < 0) timeLeft = 0;
    updateHud();
    if(timeLeft <= 0) finishNow();
  }, 1000);

  function startGame(){
    if(started || ended) return;
    started = true;
    renderRound();
  }

  startGame();

  return {
    start(){ startGame(); },
    destroy(){
      ended = true;
      clearInterval(timer);
    }
  };
}