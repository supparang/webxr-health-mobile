/* === /herohealth/gate/games/groups/warmup.js ===
   HeroHealth Gate Mini-game
   GAME: groups
   MODE: warmup
   PATCH v20260308-GATE-GROUPS-WARMUP
*/

let __styleLoaded = false;

export function loadStyle(){
  if(__styleLoaded) return;
  __styleLoaded = true;

  const id = 'gate-style-groups';
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
    wType: 'groups',
    score,
    accuracy,
    speed,
    calm,
    rank: calcRank(accuracy),
    wPct: Math.min(25, Math.round(accuracy / 4)),
    wCrit: Math.min(20, Math.round(speed / 5)),
    wDmg: Math.min(16, Math.round((accuracy + speed) / 13)),
    wHeal: Math.min(18, Math.round(calm / 6)),
    groupMasteryPct: accuracy
  };
}

export async function mount(root, ctx, api){
  loadStyle();

  const rng = mulberry32(Number(ctx.seed || Date.now()) + 41);

  const GROUPS = [
    { key:'g1', label:'หมู่ 1 โปรตีน' },
    { key:'g2', label:'หมู่ 2 คาร์โบไฮเดรต' },
    { key:'g3', label:'หมู่ 3 ผัก' },
    { key:'g4', label:'หมู่ 4 ผลไม้' },
    { key:'g5', label:'หมู่ 5 ไขมัน' }
  ];

  const ITEMS = [
    { text:'🥚 ไข่', group:'g1' },
    { text:'🐟 ปลา', group:'g1' },
    { text:'🥛 นม', group:'g1' },
    { text:'🫘 ถั่วแดง', group:'g1' },

    { text:'🍚 ข้าว', group:'g2' },
    { text:'🍞 ขนมปัง', group:'g2' },
    { text:'🥔 มันฝรั่ง', group:'g2' },
    { text:'🌽 ข้าวโพด', group:'g2' },

    { text:'🥬 คะน้า', group:'g3' },
    { text:'🥕 แครอท', group:'g3' },
    { text:'🥒 แตงกวา', group:'g3' },
    { text:'🥦 บรอกโคลี', group:'g3' },

    { text:'🍌 กล้วย', group:'g4' },
    { text:'🍊 ส้ม', group:'g4' },
    { text:'🍉 แตงโม', group:'g4' },
    { text:'🍎 แอปเปิล', group:'g4' },

    { text:'🫒 น้ำมันพืช', group:'g5' },
    { text:'🧈 เนย', group:'g5' },
    { text:'🥥 กะทิ', group:'g5' },
    { text:'🥑 อะโวคาโด', group:'g5' }
  ];

  const rounds = shuffle(ITEMS, rng).slice(0, 8);

  let idx = 0;
  let score = 0;
  let miss = 0;
  let correct = 0;
  let ended = false;

  const plannedTime = Number(ctx.time || 20);
  let timeLeft = plannedTime;

  root.innerHTML = '';
  const wrap = el('div', 'grp-wrap');
  const hero = el('div', 'grp-hero');
  const stage = el('div', 'grp-stage');
  const panelTop = el('div', 'grp-panel');
  const panelBottom = el('div', 'grp-panel');

  hero.innerHTML = `
    <div class="grp-kicker">NUTRITION ZONE • GROUPS • WARMUP</div>
    <div class="grp-title">อาหารนี้อยู่หมู่ไหน</div>
    <div class="grp-sub">แยกอาหารให้ถูกตามอาหารหลัก 5 หมู่ของไทย เพื่อวอร์มความพร้อมก่อนเข้าเกมหลัก</div>
  `;

  const target = el('div', 'grp-target', 'เตรียมพร้อม…');
  const prompt = el('div', 'grp-prompt', 'เลือกหมวดให้ถูก');
  const choices = el('div', 'grp-choices');
  const note = el('div', 'grp-note', 'เกมนี้วัดความเข้าใจเรื่องหมวดอาหาร ยิ่งตอบแม่น ยิ่งได้บัฟดี');

  panelTop.appendChild(target);
  panelBottom.appendChild(prompt);
  panelBottom.appendChild(choices);
  panelBottom.appendChild(note);
  stage.appendChild(panelTop);
  stage.appendChild(panelBottom);
  wrap.appendChild(hero);
  wrap.appendChild(stage);
  root.appendChild(wrap);

  api.logger?.push?.('mini_start', {
    game: 'groups',
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

  function renderRound(){
    if(ended) return;
    if(idx >= rounds.length){
      finishNow();
      return;
    }

    const item = rounds[idx];
    target.textContent = item.text;
    choices.innerHTML = '';

    for(const g of GROUPS){
      const btn = el('button', 'grp-btn ghost', g.label);

      btn.addEventListener('click', ()=>{
        if(ended) return;

        idx++;

        if(g.key === item.group){
          score += 10;
          correct++;
        }else{
          score -= 4;
          miss++;
        }

        api.logger?.push?.('mini_answer', {
          game:'groups',
          mode:'warmup',
          round: idx,
          item: item.text,
          selected: g.key,
          correct: item.group,
          score,
          miss,
          correctCount: correct
        });

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

    const accuracy = rounds.length > 0 ? Math.round((correct / rounds.length) * 100) : 0;
    const speed = Math.max(0, Math.min(100, Math.round((idx / rounds.length) * 100)));
    const buffs = buildBuffs({ score, accuracy, speed });

    root.innerHTML = `
      <div class="grp-result">
        <div class="grp-badge">✨ Rank ${buffs.rank}</div>
        <div class="grp-big">พร้อมลุย Food Groups!</div>
        <div class="grp-list">
          <div class="grp-item">คะแนน: ${score}</div>
          <div class="grp-item">ความแม่นยำ: ${accuracy}%</div>
          <div class="grp-item">ความเข้าใจหมวดอาหาร: ${buffs.groupMasteryPct}%</div>
          <div class="grp-item">โบนัสก่อนเข้าเกม: +${buffs.wPct}%</div>
        </div>
        <div class="grp-actions">
          <button class="grp-btn good" id="grpFinishBtn">ไปเกมหลัก</button>
        </div>
      </div>
    `;

    root.querySelector('#grpFinishBtn')?.addEventListener('click', ()=>{
      api.finish({
        ok: true,
        title: 'พร้อมแล้ว!',
        subtitle: 'เข้าเกม Groups ได้เลย',
        lines: [
          `คะแนน: ${score}`,
          `ความแม่นยำ: ${accuracy}%`,
          `ความเข้าใจหมวดอาหาร: ${buffs.groupMasteryPct}%`,
          `Rank: ${buffs.rank}`
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
      renderRound();
    },
    destroy(){
      ended = true;
      clearInterval(timer);
    }
  };
}