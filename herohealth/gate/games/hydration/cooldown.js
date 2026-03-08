/* === /herohealth/gate/games/hydration/cooldown.js ===
   HeroHealth Gate Mini-game
   GAME: hydration
   MODE: cooldown
   PATCH v20260308-GATE-HYDRATION-COOLDOWN
*/

let __styleLoaded = false;

export function loadStyle(){
  if(__styleLoaded) return;
  __styleLoaded = true;

  const id = 'gate-style-hydration';
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
  const speed = 76;
  const calm = Math.max(0, Math.min(100, Math.round(accuracy * 0.8)));
  return {
    wType: 'hydration',
    score,
    accuracy,
    speed,
    calm,
    rank: calcRank(accuracy),
    wPct: Math.min(20, Math.round(accuracy / 5)),
    wCrit: Math.min(14, Math.round(speed / 7)),
    wDmg: Math.min(12, Math.round((accuracy + speed) / 15)),
    wHeal: Math.min(18, Math.round(calm / 6)),
    hydrationSensePct: accuracy
  };
}

export async function mount(root, ctx, api){
  loadStyle();

  const rng = mulberry32(Number(ctx.seed || Date.now()) + 52);

  const rounds = shuffle([
    { text:'หลังตื่นนอน', answer:true },
    { text:'หลังเล่นกีฬา', answer:true },
    { text:'ตอนกระหายน้ำ', answer:true },
    { text:'ระหว่างอากาศร้อน', answer:true },
    { text:'แทนน้ำทุกมื้อด้วยน้ำอัดลม', answer:false },
    { text:'ดื่มแต่น้ำหวานแทนน้ำเปล่า', answer:false },
    { text:'ก่อนนอนแบบพอดี', answer:true }
  ], rng).slice(0, 5);

  let idx = 0;
  let score = 0;
  let miss = 0;
  let correct = 0;

  root.innerHTML = '';
  const wrap = el('div', 'hyd-wrap');
  const hero = el('div', 'hyd-hero');
  const stage = el('div', 'hyd-stage');
  const panelTop = el('div', 'hyd-panel');
  const panelBottom = el('div', 'hyd-panel');

  hero.innerHTML = `
    <div class="hyd-kicker">NUTRITION ZONE • HYDRATION • COOLDOWN</div>
    <div class="hyd-title">เมื่อไรควรดื่มน้ำ</div>
    <div class="hyd-sub">ทบทวนพฤติกรรมการดื่มน้ำเปล่า และหลีกเลี่ยงการใช้น้ำหวานแทนน้ำจริง</div>
  `;

  const target = el('div', 'hyd-target', 'เตรียมทบทวน…');
  const prompt = el('div', 'hyd-prompt', 'สถานการณ์นี้ควรดื่มน้ำเปล่าไหม');
  const choices = el('div', 'hyd-choices');
  const note = el('div', 'hyd-note', 'Cooldown ใช้สรุปความเข้าใจ ไม่เน้นความเร็วอย่างเดียว');

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
    game: 'hydration',
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
    target.textContent = q.text;
    choices.innerHTML = '';

    const options = shuffle([
      { label:'ควร', value:true, cls:'good' },
      { label:'ไม่ควร', value:false, cls:'bad' }
    ], rng);

    for(const opt of options){
      const btn = el('button', `hyd-btn ${opt.cls}`, opt.label);

      btn.addEventListener('click', ()=>{
        idx++;

        if(opt.value === q.answer){
          score += 10;
          correct++;
        }else{
          score -= 4;
          miss++;
        }

        api.logger?.push?.('mini_answer', {
          game: 'hydration',
          mode: 'cooldown',
          round: idx,
          prompt: q.text,
          selected: opt.label,
          correctAnswer: q.answer,
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
      <div class="hyd-result">
        <div class="hyd-badge">✨ Rank ${buffs.rank}</div>
        <div class="hyd-big">คูลดาวน์เสร็จแล้ว</div>
        <div class="hyd-list">
          <div class="hyd-item">คะแนน: ${score}</div>
          <div class="hyd-item">ความแม่นยำ: ${accuracy}%</div>
          <div class="hyd-item">สรุป: เลือกน้ำเปล่าให้บ่อยขึ้น และอย่าใช้น้ำหวานแทนน้ำจริง</div>
        </div>
        <div class="hyd-actions">
          <button class="hyd-btn good" id="hydCooldownFinishBtn">กลับ HUB / ไปต่อ</button>
        </div>
      </div>
    `;

    root.querySelector('#hydCooldownFinishBtn')?.addEventListener('click', ()=>{
      api.finish({
        ok: true,
        title: 'คูลดาวน์เสร็จแล้ว',
        subtitle: 'สรุปนิสัยดื่มน้ำเรียบร้อย',
        lines: [
          `คะแนน: ${score}`,
          `ความแม่นยำ: ${accuracy}%`,
          'เลือกน้ำเปล่าให้บ่อยขึ้น',
          'ลดเครื่องดื่มหวาน'
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