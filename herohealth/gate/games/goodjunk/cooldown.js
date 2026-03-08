/* === /herohealth/gate/games/goodjunk/cooldown.js ===
   HeroHealth Gate Mini-game
   GAME: goodjunk
   MODE: cooldown
   PATCH v20260308-GATE-GOODJUNK-COOLDOWN
*/

let __styleLoaded = false;

export function loadStyle(){
  if(__styleLoaded) return;
  __styleLoaded = true;

  const id = 'gate-style-goodjunk';
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
  return {
    wType: 'goodjunk',
    score,
    accuracy,
    speed: 80,
    calm: Math.max(0, Math.min(100, Math.round(accuracy * 0.8))),
    rank: calcRank(accuracy),
    wPct: Math.min(20, Math.round(accuracy / 5)),
    wCrit: Math.min(16, Math.round(accuracy / 6)),
    wDmg: Math.min(14, Math.round(accuracy / 7)),
    wHeal: Math.min(18, Math.round(accuracy / 6)),
    goodChoicePct: accuracy
  };
}

export async function mount(root, ctx, api){
  loadStyle();

  const rng = mulberry32(Number(ctx.seed || Date.now()) + 12);

  const rounds = shuffle([
    { bad:'🥤 น้ำอัดลม', good:['💧 น้ำเปล่า','🥛 นมจืด'] },
    { bad:'🍟 เฟรนช์ฟรายส์', good:['🥔 มันอบ','🥗 สลัด'] },
    { bad:'🍩 โดนัท', good:['🍌 กล้วย','🍎 แอปเปิล'] },
    { bad:'🍭 ลูกอม', good:['🍉 แตงโม','🍊 ส้ม'] },
    { bad:'🧋 ชานมหวาน', good:['🚰 น้ำเปล่า','🫗 น้ำไม่หวาน'] }
  ], rng);

  let idx = 0;
  let score = 0;
  let miss = 0;
  let correct = 0;

  root.innerHTML = '';
  const wrap = el('div', 'gj-wrap');
  const hero = el('div', 'gj-hero');
  const stage = el('div', 'gj-stage');
  const panelTop = el('div', 'gj-panel');
  const panelBottom = el('div', 'gj-panel');

  hero.innerHTML = `
    <div class="gj-kicker">NUTRITION ZONE • GOODJUNK • COOLDOWN</div>
    <div class="gj-title">เปลี่ยนให้ดีกว่า</div>
    <div class="gj-sub">ทบทวนการเลือกกิน โดยเปลี่ยนของหวาน มัน เค็ม ให้เป็นทางเลือกที่เหมาะกว่า</div>
  `;

  const target = el('div', 'gj-target', 'เตรียมทบทวน…');
  const prompt = el('div', 'gj-prompt', 'เลือกตัวแทนที่ดีกว่า');
  const choices = el('div', 'gj-choices');
  const note = el('div', 'gj-note', 'Cooldown ใช้เพื่อทบทวน ไม่ใช่แข่งเร็วอย่างเดียว');

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
    game: 'goodjunk',
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
    target.textContent = `ถ้าอยากแทน ${q.bad} ควรเลือกอะไร?`;
    choices.innerHTML = '';

    const options = shuffle([q.good[0], q.good[1], q.bad], rng);

    for(const opt of options){
      const isGood = q.good.includes(opt);
      const btn = el('button', `gj-btn ${isGood ? 'good' : 'bad'}`, opt);

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
          game: 'goodjunk',
          mode: 'cooldown',
          round: idx,
          selected: opt,
          goodSet: q.good,
          score,
          miss,
          correct
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
      <div class="gj-result">
        <div class="gj-badge">✨ Rank ${buffs.rank}</div>
        <div class="gj-big">คูลดาวน์เสร็จแล้ว</div>
        <div class="gj-list">
          <div class="gj-item">คะแนน: ${score}</div>
          <div class="gj-item">ความแม่นยำ: ${accuracy}%</div>
          <div class="gj-item">แนวคิดหลัก: ลดหวาน มัน เค็ม เพิ่มอาหารจริงและน้ำเปล่า</div>
        </div>
        <div class="gj-actions">
          <button class="gj-btn good" id="gjCooldownFinishBtn">กลับ HUB / ไปต่อ</button>
        </div>
      </div>
    `;

    root.querySelector('#gjCooldownFinishBtn')?.addEventListener('click', ()=>{
      api.finish({
        ok: true,
        title: 'คูลดาวน์เสร็จแล้ว',
        subtitle: 'สรุปการเลือกกินเรียบร้อย',
        lines: [
          `คะแนน: ${score}`,
          `ความแม่นยำ: ${accuracy}%`,
          'ลดหวาน มัน เค็ม',
          'เพิ่มอาหารจริงและน้ำเปล่า'
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