/* === /herohealth/gate/games/plate/warmup.js ===
   HeroHealth Gate Mini-game
   GAME: plate
   MODE: warmup
   PATCH v20260308-GATE-PLATE-WARMUP
*/

let __styleLoaded = false;

export function loadStyle(){
  if(__styleLoaded) return;
  __styleLoaded = true;

  const id = 'gate-style-plate';
  if(document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = new URL('./style.css', import.meta.url).toString();
  document.head.appendChild(link);
}

function el(tag, cls='', text=''){
  const n = document.createElement(tag);
  if(cls) n.className = cls;
  if(text) n.textContent = text;
  return n;
}

function shuffle(arr, rng=Math.random){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(rng()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
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

function calcRank(acc){
  if(acc >= 90) return 'S';
  if(acc >= 75) return 'A';
  if(acc >= 60) return 'B';
  if(acc >= 40) return 'C';
  return 'D';
}

function buildBuffs({ score, accuracy, speed }){
  const calm = Math.max(0, Math.min(100, Math.round(accuracy * 0.75 + speed * 0.25)));
  return {
    wType: 'plate',
    score,
    accuracy,
    speed,
    calm,
    rank: calcRank(accuracy),
    wPct: Math.min(25, Math.round(accuracy / 4)),
    wCrit: Math.min(16, Math.round(speed / 6)),
    wDmg: Math.min(18, Math.round((accuracy + speed) / 12)),
    wHeal: Math.min(18, Math.round(calm / 6)),
    plateBalancePct: accuracy
  };
}

export async function mount(root, ctx, api){
  loadStyle();

  const rng = mulberry32(Number(ctx.seed || Date.now()) + 61);

  const SLOTS = [
    {
      key:'veg',
      label:'ผัก 1/2 จาน',
      good:['🥬 ผักใบเขียว','🥕 แครอท','🥦 บรอกโคลี','🥒 แตงกวา']
    },
    {
      key:'carb',
      label:'ข้าว/แป้ง 1/4 จาน',
      good:['🍚 ข้าว','🍞 ขนมปัง','🥔 มันฝรั่ง','🍠 มันหวาน']
    },
    {
      key:'protein',
      label:'โปรตีน 1/4 จาน',
      good:['🐟 ปลา','🥚 ไข่','🍗 ไก่','🫘 ถั่ว']
    }
  ];

  const wrongPool = [
    '🍩 โดนัท','🥤 น้ำอัดลม','🍟 ของทอด','🧁 คัพเค้ก',
    '🍭 ลูกอม','🍔 เบอร์เกอร์','🍫 ช็อกโกแลต'
  ];

  let idx = 0;
  let score = 0;
  let miss = 0;
  let correct = 0;
  let ended = false;
  const chosen = { veg:'', carb:'', protein:'' };

  const plannedTime = Number(ctx.time || 20);
  let timeLeft = plannedTime;

  root.innerHTML = '';
  const wrap = el('div', 'plt-wrap');
  const hero = el('div', 'plt-hero');
  const stage = el('div', 'plt-stage');
  const panelTop = el('div', 'plt-panel');
  const panelBottom = el('div', 'plt-panel');

  hero.innerHTML = `
    <div class="plt-kicker">NUTRITION ZONE • PLATE • WARMUP</div>
    <div class="plt-title">จัดจานให้สมดุล</div>
    <div class="plt-sub">เลือกอาหารให้ครบสัดส่วนจานสุขภาพ เพื่อเตรียมความพร้อมก่อนเข้าเกมหลัก</div>
  `;

  const board = el('div', 'plt-board');
  const slotVeg = el('div', 'plt-slot');
  const slotCarb = el('div', 'plt-slot');
  const slotProtein = el('div', 'plt-slot');

  slotVeg.innerHTML = `<div class="plt-slot-k">ผัก 1/2 จาน</div><div class="plt-slot-v" id="pltSlotVeg">ยังไม่ได้เลือก</div>`;
  slotCarb.innerHTML = `<div class="plt-slot-k">ข้าว/แป้ง 1/4 จาน</div><div class="plt-slot-v" id="pltSlotCarb">ยังไม่ได้เลือก</div>`;
  slotProtein.innerHTML = `<div class="plt-slot-k">โปรตีน 1/4 จาน</div><div class="plt-slot-v" id="pltSlotProtein">ยังไม่ได้เลือก</div>`;

  board.append(slotVeg, slotCarb, slotProtein);

  const target = el('div', 'plt-target', 'เตรียมจัดจาน…');
  const prompt = el('div', 'plt-prompt', 'เลือกให้ตรงกับส่วนของจาน');
  const choices = el('div', 'plt-choices');
  const note = el('div', 'plt-note', 'ยิ่งจัดจานได้สมดุล บัฟก่อนเข้าเกมจริงยิ่งดี');

  panelTop.appendChild(board);
  panelTop.appendChild(target);
  panelBottom.appendChild(prompt);
  panelBottom.appendChild(choices);
  panelBottom.appendChild(note);
  stage.appendChild(panelTop);
  stage.appendChild(panelBottom);
  wrap.appendChild(hero);
  wrap.appendChild(stage);
  root.appendChild(wrap);

  const slotVegV = panelTop.querySelector('#pltSlotVeg');
  const slotCarbV = panelTop.querySelector('#pltSlotCarb');
  const slotProteinV = panelTop.querySelector('#pltSlotProtein');

  api.logger?.push?.('mini_start', {
    game: 'plate',
    mode: 'warmup',
    seed: ctx.seed
  });

  api.setStats({
    time: timeLeft,
    score: 0,
    miss: 0,
    acc: '0%'
  });

  function updateHud(){
    const acc = idx > 0 ? Math.round((correct / idx) * 100) : 0;
    api.setStats({
      time: timeLeft,
      score,
      miss,
      acc: `${acc}%`
    });
  }

  function pick(arr){
    return arr[Math.floor(rng() * arr.length)];
  }

  function updateBoard(){
    slotVegV.textContent = chosen.veg || 'ยังไม่ได้เลือก';
    slotCarbV.textContent = chosen.carb || 'ยังไม่ได้เลือก';
    slotProteinV.textContent = chosen.protein || 'ยังไม่ได้เลือก';
  }

  function renderRound(){
    if(ended) return;
    if(idx >= SLOTS.length){
      finishNow();
      return;
    }

    const slot = SLOTS[idx];
    target.textContent = `เลือกให้ถูกสำหรับ: ${slot.label}`;
    choices.innerHTML = '';

    const good = pick(slot.good);
    const bad1 = pick(wrongPool);
    const bad2 = pick(wrongPool);
    const opts = shuffle([good, bad1, bad2], rng).slice(0, 3);

    for(const opt of opts){
      const isCorrect = opt === good;
      const btn = el('button', `plt-btn ${isCorrect ? 'good' : 'ghost'}`, opt);

      btn.addEventListener('click', ()=>{
        if(ended) return;

        idx++;

        chosen[slot.key] = opt;

        if(isCorrect){
          score += 12;
          correct++;
        }else{
          score -= 4;
          miss++;
        }

        api.logger?.push?.('mini_answer', {
          game:'plate',
          mode:'warmup',
          round: idx,
          slot: slot.key,
          selected: opt,
          correct: good,
          score,
          miss,
          correctCount: correct
        });

        updateBoard();
        updateHud();
        renderRound();
      });

      choices.appendChild(btn);
    }
  }

  function finishNow(){
    if(ended) return;
    ended = true;
    clearInterval(timer);

    const accuracy = SLOTS.length > 0 ? Math.round((correct / SLOTS.length) * 100) : 0;
    const speed = Math.max(0, Math.min(100, Math.round((idx / SLOTS.length) * 100)));
    const buffs = buildBuffs({ score, accuracy, speed });

    root.innerHTML = `
      <div class="plt-result">
        <div class="plt-badge">✨ Rank ${buffs.rank}</div>
        <div class="plt-big">พร้อมลุย Balanced Plate!</div>
        <div class="plt-list">
          <div class="plt-item">คะแนน: ${score}</div>
          <div class="plt-item">ความแม่นยำ: ${accuracy}%</div>
          <div class="plt-item">สมดุลจานอาหาร: ${buffs.plateBalancePct}%</div>
          <div class="plt-item">จำไว้: ผัก 1/2 + ข้าว/แป้ง 1/4 + โปรตีน 1/4</div>
        </div>
        <div class="plt-actions">
          <button class="plt-btn good" id="pltFinishBtn">ไปเกมหลัก</button>
        </div>
      </div>
    `;

    root.querySelector('#pltFinishBtn')?.addEventListener('click', ()=>{
      api.finish({
        ok: true,
        title: 'พร้อมแล้ว!',
        subtitle: 'เข้าเกม Plate ได้เลย',
        lines: [
          `คะแนน: ${score}`,
          `ความแม่นยำ: ${accuracy}%`,
          `สมดุลจานอาหาร: ${buffs.plateBalancePct}%`,
          'ผัก 1/2 + ข้าว/แป้ง 1/4 + โปรตีน 1/4'
        ],
        buffs,
        markDailyDone: true
      });
    });
  }

  const timer = setInterval(()=>{
    if(ended) return;
    timeLeft--;
    if(timeLeft < 0) timeLeft = 0;
    updateHud();

    if(timeLeft <= 0){
      finishNow();
    }
  }, 1000);

  return {
    start(){
      updateBoard();
      renderRound();
    },
    destroy(){
      ended = true;
      clearInterval(timer);
    }
  };
}