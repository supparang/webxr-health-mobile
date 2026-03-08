/* === /herohealth/gate/games/goodjunk/warmup.js ===
   HeroHealth Gate Mini-game
   GAME: goodjunk
   MODE: warmup
   PATCH v20260308-GATE-GOODJUNK-WARMUP
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

function buildBuffs({ score, accuracy, speed, junkAvoidPct }){
  return {
    wType: 'goodjunk',
    score,
    accuracy,
    speed,
    calm: Math.max(0, Math.min(100, Math.round(accuracy * 0.7 + speed * 0.3))),
    rank: calcRank(accuracy),
    wPct: Math.min(25, Math.round(accuracy / 4)),
    wCrit: Math.min(20, Math.round(speed / 5)),
    wDmg: Math.min(18, Math.round((accuracy + speed) / 12)),
    wHeal: Math.min(20, Math.round((accuracy * 0.7 + speed * 0.3) / 5)),
    goodChoicePct: accuracy,
    junkAvoidPct
  };
}

export async function mount(root, ctx, api){
  loadStyle();

  const rng = mulberry32(Number(ctx.seed || Date.now()) + 11);

  const goodFoods = [
    '🍎 แอปเปิล','🥕 แครอท','🥛 นม','🍌 กล้วย',
    '🥬 ผักใบเขียว','🐟 ปลา','🥚 ไข่','🍉 แตงโม'
  ];
  const junkFoods = [
    '🍟 เฟรนช์ฟรายส์','🍩 โดนัท','🥤 น้ำอัดลม','🍔 เบอร์เกอร์',
    '🍭 ลูกอม','🧁 คัพเค้ก','🍫 ช็อกโกแลต','🧋 ชานมหวาน'
  ];

  let score = 0;
  let miss = 0;
  let correct = 0;
  let shown = 0;
  let junkAvoid = 0;
  let ended = false;

  const totalRounds = 14;
  const plannedTime = Number(ctx.time || 18);
  let timeLeft = plannedTime;

  root.innerHTML = '';
  const wrap = el('div', 'gj-wrap');
  const hero = el('div', 'gj-hero');
  const stage = el('div', 'gj-stage');
  const panelTop = el('div', 'gj-panel');
  const panelBottom = el('div', 'gj-panel');

  hero.innerHTML = `
    <div class="gj-kicker">NUTRITION ZONE • GOODJUNK • WARMUP</div>
    <div class="gj-title">แตะของดี หลบของหวาน</div>
    <div class="gj-sub">แตะอาหารที่มีประโยชน์ และหลีกเลี่ยง junk food เพื่อเตรียมความพร้อมก่อนเข้าเกมหลัก</div>
  `;

  const target = el('div', 'gj-target', 'เตรียมพร้อม…');
  const prompt = el('div', 'gj-prompt', 'Good = แตะ / Junk = ปล่อยผ่าน');
  const choices = el('div', 'gj-choices');
  const note = el('div', 'gj-note', 'ยิ่งเลือกถูกและนิ่ง บัฟก่อนเข้าเกมจริงยิ่งดี');

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
    const acc = shown > 0 ? Math.round((correct / shown) * 100) : 0;
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

  function nextRound(){
    if(ended) return;
    if(shown >= totalRounds){
      finishNow();
      return;
    }

    shown++;
    choices.innerHTML = '';

    const isGoodRound = rng() < 0.6;
    let correctChoice = '';
    let wrongChoice = '';

    if(isGoodRound){
      correctChoice = pick(goodFoods);
      wrongChoice = pick(junkFoods);
      target.textContent = 'แตะอาหารที่มีประโยชน์';
    }else{
      correctChoice = 'ปล่อยผ่าน';
      wrongChoice = pick(junkFoods);
      target.textContent = 'อย่าแตะอาหารขยะ';
    }

    const opts = isGoodRound
      ? shuffle([correctChoice, wrongChoice], rng)
      : shuffle([wrongChoice, 'ปล่อยผ่าน'], rng);

    for(const label of opts){
      const btn = el('button', `gj-btn ${label === 'ปล่อยผ่าน' ? 'ghost' : 'good'}`, label);

      if(!isGoodRound && label !== 'ปล่อยผ่าน'){
        btn.className = 'gj-btn bad';
      }

      btn.addEventListener('click', ()=>{
        if(ended) return;

        if(isGoodRound){
          if(label === correctChoice){
            score += 10;
            correct++;
          }else{
            score -= 4;
            miss++;
          }
        }else{
          if(label === 'ปล่อยผ่าน'){
            score += 8;
            correct++;
            junkAvoid++;
          }else{
            score -= 5;
            miss++;
          }
        }

        api.logger?.push?.('mini_answer', {
          game:'goodjunk',
          mode:'warmup',
          shown,
          selected: label,
          expected: correctChoice,
          score,
          miss,
          correct
        });

        updateHud();
        nextRound();
      });

      choices.appendChild(btn);
    }
  }

  function finishNow(){
    if(ended) return;
    ended = true;
    clearInterval(timer);

    const accuracy = shown > 0 ? Math.round((correct / shown) * 100) : 0;
    const speed = Math.max(0, Math.min(100, Math.round((shown / totalRounds) * 100)));
    const junkAvoidPct = Math.max(0, Math.min(100, Math.round((junkAvoid / Math.max(1, Math.floor(totalRounds * 0.4))) * 100)));
    const buffs = buildBuffs({
      score,
      accuracy,
      speed,
      junkAvoidPct
    });

    root.innerHTML = `
      <div class="gj-result">
        <div class="gj-badge">✨ Rank ${buffs.rank}</div>
        <div class="gj-big">พร้อมลุย GoodJunk!</div>
        <div class="gj-list">
          <div class="gj-item">คะแนน: ${score}</div>
          <div class="gj-item">ความแม่นยำ: ${accuracy}%</div>
          <div class="gj-item">หลบ junk ได้ดี: ${junkAvoidPct}%</div>
          <div class="gj-item">โบนัสก่อนเข้าเกม: +${buffs.wPct}%</div>
        </div>
        <div class="gj-actions">
          <button class="gj-btn good" id="gjFinishBtn">ไปเกมหลัก</button>
        </div>
      </div>
    `;

    root.querySelector('#gjFinishBtn')?.addEventListener('click', ()=>{
      api.finish({
        ok: true,
        title: 'พร้อมแล้ว!',
        subtitle: 'เข้าเกม GoodJunk ได้เลย',
        lines: [
          `คะแนน: ${score}`,
          `ความแม่นยำ: ${accuracy}%`,
          `หลบ junk: ${junkAvoidPct}%`,
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
      nextRound();
    },
    destroy(){
      ended = true;
      clearInterval(timer);
    }
  };
}