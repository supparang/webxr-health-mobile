/* === /herohealth/gate/games/hydration/warmup.js ===
   HeroHealth Gate Mini-game
   GAME: hydration
   MODE: warmup
   PATCH v20260308-GATE-HYDRATION-WARMUP
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

function buildBuffs({ score, accuracy, speed, sugarAvoidPct }){
  const calm = Math.max(0, Math.min(100, Math.round(accuracy * 0.75 + speed * 0.25)));
  return {
    wType: 'hydration',
    score,
    accuracy,
    speed,
    calm,
    rank: calcRank(accuracy),
    wPct: Math.min(25, Math.round(accuracy / 4)),
    wCrit: Math.min(18, Math.round(speed / 6)),
    wDmg: Math.min(14, Math.round((accuracy + speed) / 14)),
    wHeal: Math.min(20, Math.round(calm / 5)),
    hydrationSensePct: accuracy,
    sugarAvoidPct
  };
}

export async function mount(root, ctx, api){
  loadStyle();

  const rng = mulberry32(Number(ctx.seed || Date.now()) + 51);

  const goodDrinks = [
    '💧 น้ำเปล่า',
    '🚰 น้ำสะอาด',
    '🫗 น้ำเปล่าเย็น',
    '💦 ดื่มน้ำ'
  ];

  const badDrinks = [
    '🥤 น้ำอัดลม',
    '🧋 ชานมหวาน',
    '🧃 น้ำหวาน',
    '🍹 เครื่องดื่มหวาน'
  ];

  let idx = 0;
  let score = 0;
  let miss = 0;
  let correct = 0;
  let sugarAvoid = 0;
  let ended = false;

  const totalRounds = 14;
  const plannedTime = Number(ctx.time || 18);
  let timeLeft = plannedTime;

  root.innerHTML = '';
  const wrap = el('div', 'hyd-wrap');
  const hero = el('div', 'hyd-hero');
  const stage = el('div', 'hyd-stage');
  const panelTop = el('div', 'hyd-panel');
  const panelBottom = el('div', 'hyd-panel');

  hero.innerHTML = `
    <div class="hyd-kicker">NUTRITION ZONE • HYDRATION • WARMUP</div>
    <div class="hyd-title">เก็บน้ำ หลีกน้ำหวาน</div>
    <div class="hyd-sub">เลือกเครื่องดื่มที่ช่วยเติมน้ำให้ร่างกาย และหลีกเลี่ยงเครื่องดื่มหวานก่อนเข้าเกมหลัก</div>
  `;

  const target = el('div', 'hyd-target', 'เตรียมพร้อม…');
  const prompt = el('div', 'hyd-prompt', 'น้ำดี = เลือก / น้ำหวาน = ปล่อยผ่าน');
  const choices = el('div', 'hyd-choices');
  const note = el('div', 'hyd-note', 'เลือกแม่นและนิ่ง จะได้บัฟด้านการฟื้นฟูและความสมดุล');

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

  function renderRound(){
    if(ended) return;
    if(idx >= totalRounds){
      finishNow();
      return;
    }

    idx++;
    choices.innerHTML = '';

    const wantGood = rng() < 0.65;
    const good = pick(goodDrinks);
    const bad = pick(badDrinks);

    target.textContent = wantGood
      ? 'เลือกเครื่องดื่มที่ช่วยเติมน้ำให้ร่างกาย'
      : 'อย่าเลือกเครื่องดื่มหวาน';

    const options = wantGood
      ? shuffle([good, bad], rng)
      : shuffle([bad, 'ปล่อยผ่าน'], rng);

    for(const opt of options){
      const isCorrect = wantGood ? (opt === good) : (opt === 'ปล่อยผ่าน');
      const btn = el(
        'button',
        `hyd-btn ${opt === 'ปล่อยผ่าน' ? 'ghost' : (isCorrect ? 'good' : 'bad')}`,
        opt
      );

      btn.addEventListener('click', ()=>{
        if(ended) return;

        if(isCorrect){
          score += 10;
          correct++;
          if(!wantGood) sugarAvoid++;
        }else{
          score -= 4;
          miss++;
        }

        api.logger?.push?.('mini_answer', {
          game: 'hydration',
          mode: 'warmup',
          round: idx,
          selected: opt,
          expected: wantGood ? good : 'ปล่อยผ่าน',
          score,
          miss,
          correctCount: correct,
          sugarAvoid
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

    const accuracy = totalRounds > 0 ? Math.round((correct / totalRounds) * 100) : 0;
    const speed = Math.max(0, Math.min(100, Math.round((idx / totalRounds) * 100)));
    const sugarAvoidPct = Math.max(0, Math.min(100, Math.round((sugarAvoid / Math.max(1, Math.floor(totalRounds * 0.35))) * 100)));
    const buffs = buildBuffs({ score, accuracy, speed, sugarAvoidPct });

    root.innerHTML = `
      <div class="hyd-result">
        <div class="hyd-badge">✨ Rank ${buffs.rank}</div>
        <div class="hyd-big">พร้อมลุย Hydration!</div>
        <div class="hyd-list">
          <div class="hyd-item">คะแนน: ${score}</div>
          <div class="hyd-item">ความแม่นยำ: ${accuracy}%</div>
          <div class="hyd-item">เลี่ยงน้ำหวานได้: ${sugarAvoidPct}%</div>
          <div class="hyd-item">โบนัสฟื้นฟู: +${buffs.wHeal}%</div>
        </div>
        <div class="hyd-actions">
          <button class="hyd-btn good" id="hydFinishBtn">ไปเกมหลัก</button>
        </div>
      </div>
    `;

    root.querySelector('#hydFinishBtn')?.addEventListener('click', ()=>{
      api.finish({
        ok: true,
        title: 'พร้อมแล้ว!',
        subtitle: 'เข้าเกม Hydration ได้เลย',
        lines: [
          `คะแนน: ${score}`,
          `ความแม่นยำ: ${accuracy}%`,
          `เลี่ยงน้ำหวาน: ${sugarAvoidPct}%`,
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