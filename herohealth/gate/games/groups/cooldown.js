/* === /herohealth/gate/games/groups/cooldown.js ===
   HeroHealth Gate Mini-game
   GAME: groups
   MODE: cooldown
   PATCH v20260308-GATE-GROUPS-COOLDOWN
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

function buildBuffs({ score, accuracy }){
  const speed = 78;
  const calm = Math.max(0, Math.min(100, Math.round(accuracy * 0.8)));
  return {
    wType: 'groups',
    score,
    accuracy,
    speed,
    calm,
    rank: calcRank(accuracy),
    wPct: Math.min(20, Math.round(accuracy / 5)),
    wCrit: Math.min(16, Math.round(speed / 6)),
    wDmg: Math.min(14, Math.round((accuracy + speed) / 14)),
    wHeal: Math.min(16, Math.round(calm / 7)),
    groupMasteryPct: accuracy
  };
}

export async function mount(root, ctx, api){
  loadStyle();

  const rng = mulberry32(Number(ctx.seed || Date.now()) + 42);

  const GROUPS = [
    { key:'g1', label:'หมู่ 1 โปรตีน', items:['🥚 ไข่','🐟 ปลา','🥛 นม'] },
    { key:'g2', label:'หมู่ 2 คาร์โบไฮเดรต', items:['🍚 ข้าว','🍞 ขนมปัง','🥔 มันฝรั่ง'] },
    { key:'g3', label:'หมู่ 3 ผัก', items:['🥬 คะน้า','🥕 แครอท','🥦 บรอกโคลี'] },
    { key:'g4', label:'หมู่ 4 ผลไม้', items:['🍌 กล้วย','🍊 ส้ม','🍎 แอปเปิล'] },
    { key:'g5', label:'หมู่ 5 ไขมัน', items:['🫒 น้ำมันพืช','🧈 เนย','🥥 กะทิ'] }
  ];

  const rounds = shuffle(GROUPS, rng).slice(0, 5);

  let idx = 0;
  let score = 0;
  let miss = 0;
  let correct = 0;

  root.innerHTML = '';
  const wrap = el('div', 'grp-wrap');
  const hero = el('div', 'grp-hero');
  const stage = el('div', 'grp-stage');
  const panelTop = el('div', 'grp-panel');
  const panelBottom = el('div', 'grp-panel');

  hero.innerHTML = `
    <div class="grp-kicker">NUTRITION ZONE • GROUPS • COOLDOWN</div>
    <div class="grp-title">หมู่นี้ควรเลือกอะไร</div>
    <div class="grp-sub">ทบทวนความเข้าใจเรื่องอาหาร 5 หมู่ ด้วยการเลือกตัวอย่างอาหารที่ตรงกับหมวด</div>
  `;

  const target = el('div', 'grp-target', 'เตรียมทบทวน…');
  const prompt = el('div', 'grp-prompt', 'เลือกตัวอย่างอาหารที่ตรงหมวด');
  const choices = el('div', 'grp-choices');
  const note = el('div', 'grp-note', 'Cooldown ใช้เพื่อทบทวนและเชื่อมความเข้าใจก่อนกลับ HUB');

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
    mode: 'cooldown',
    seed: ctx.seed
  });

  api.setStats({
    time: ctx.time || 0,
    score: 0,
    miss: 0,
    acc: '0%'
  });

  function updateHud(){
    const acc = idx > 0 ? Math.round((correct / idx) * 100) : 0;
    api.setStats({
      time: 0,
      score,
      miss,
      acc: `${acc}%`
    });
  }

  function renderRound(){
    if(idx >= rounds.length){
      return finishNow();
    }

    const q = rounds[idx];
    target.textContent = q.label;
    choices.innerHTML = '';

    const wrongPool = GROUPS
      .filter(g => g.key !== q.key)
      .map(g => g.items[0]);

    const options = shuffle([
      q.items[0],
      wrongPool[0],
      wrongPool[1]
    ], rng);

    for(const opt of options){
      const isGood = q.items.includes(opt);

      const btn = el('button', `grp-btn ${isGood ? 'good' : 'bad'}`, opt);

      btn.addEventListener('click', ()=>{
        idx++;

        if(isGood){
          score += 10;
          correct++;
        }else{
          score -= 4;
          miss++;
        }

        api.logger?.push?.('mini_answer', {
          game: 'groups',
          mode: 'cooldown',
          round: idx,
          group: q.key,
          selected: opt,
          validItems: q.items,
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
    const accuracy = rounds.length > 0 ? Math.round((correct / rounds.length) * 100) : 0;
    const buffs = buildBuffs({ score, accuracy });

    root.innerHTML = `
      <div class="grp-result">
        <div class="grp-badge">✨ Rank ${buffs.rank}</div>
        <div class="grp-big">คูลดาวน์เสร็จแล้ว</div>
        <div class="grp-list">
          <div class="grp-item">คะแนน: ${score}</div>
          <div class="grp-item">ความแม่นยำ: ${accuracy}%</div>
          <div class="grp-item">สรุป: อาหารแต่ละชนิดอยู่คนละหมวด และมีบทบาทต่างกัน</div>
        </div>
        <div class="grp-actions">
          <button class="grp-btn good" id="grpCooldownFinishBtn">กลับ HUB / ไปต่อ</button>
        </div>
      </div>
    `;

    root.querySelector('#grpCooldownFinishBtn')?.addEventListener('click', ()=>{
      api.finish({
        ok: true,
        title: 'คูลดาวน์เสร็จแล้ว',
        subtitle: 'สรุปความเข้าใจอาหาร 5 หมู่เรียบร้อย',
        lines: [
          `คะแนน: ${score}`,
          `ความแม่นยำ: ${accuracy}%`,
          'หมู่ 1 โปรตีน',
          'หมู่ 2 คาร์โบไฮเดรต',
          'หมู่ 3 ผัก',
          'หมู่ 4 ผลไม้',
          'หมู่ 5 ไขมัน'
        ],
        buffs,
        markDailyDone: true
      });
    });
  }

  return {
    start(){
      renderRound();
    }
  };
}