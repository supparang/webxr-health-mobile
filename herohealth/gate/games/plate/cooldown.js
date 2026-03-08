/* === /herohealth/gate/games/plate/cooldown.js ===
   HeroHealth Gate Mini-game
   GAME: plate
   MODE: cooldown
   PATCH v20260308-GATE-PLATE-COOLDOWN
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

function buildBuffs({ score, accuracy }){
  const speed = 75;
  const calm = Math.max(0, Math.min(100, Math.round(accuracy * 0.8)));
  return {
    wType: 'plate',
    score,
    accuracy,
    speed,
    calm,
    rank: calcRank(accuracy),
    wPct: Math.min(20, Math.round(accuracy / 5)),
    wCrit: Math.min(14, Math.round(speed / 7)),
    wDmg: Math.min(16, Math.round((accuracy + speed) / 13)),
    wHeal: Math.min(16, Math.round(calm / 7)),
    plateBalancePct: accuracy
  };
}

export async function mount(root, ctx, api){
  loadStyle();

  const rng = mulberry32(Number(ctx.seed || Date.now()) + 62);

  const rounds = shuffle([
    { q:'จานนี้มีแต่ของทอดและของหวาน ควรเพิ่มอะไร?', good:'🥬 ผัก', bad:'🍟 ของทอดเพิ่ม' },
    { q:'จานนี้มีข้าวเยอะมาก แต่โปรตีนน้อย ควรเพิ่มอะไร?', good:'🐟 โปรตีน', bad:'🍚 ข้าวเพิ่ม' },
    { q:'จานนี้ไม่มีผักเลย ควรทำอย่างไร?', good:'🥗 เพิ่มผัก', bad:'🧁 เพิ่มขนม' },
    { q:'จานนี้หวานจัดและไม่มีน้ำเปล่า ควรเลือกอะไร?', good:'💧 น้ำเปล่า', bad:'🥤 น้ำหวานเพิ่ม' },
    { q:'จานนี้มีแต่แป้ง ควรเสริมอะไรเพื่อให้สมดุล?', good:'🍗 โปรตีนและผัก', bad:'🍞 แป้งเพิ่มอีก' },
    { q:'จานนี้มีโปรตีนอย่างเดียว ไม่มีผัก ควรทำอย่างไร?', good:'🥬 เพิ่มผัก', bad:'🍖 เพิ่มเนื้ออย่างเดียว' }
  ], rng).slice(0, 4);

  let idx = 0;
  let score = 0;
  let miss = 0;
  let correct = 0;

  root.innerHTML = '';
  const wrap = el('div', 'plt-wrap');
  const hero = el('div', 'plt-hero');
  const stage = el('div', 'plt-stage');
  const panelTop = el('div', 'plt-panel');
  const panelBottom = el('div', 'plt-panel');

  hero.innerHTML = `
    <div class="plt-kicker">NUTRITION ZONE • PLATE • COOLDOWN</div>
    <div class="plt-title">แก้จานให้ดีขึ้น</div>
    <div class="plt-sub">ดูจานที่ไม่สมดุล แล้วเลือกว่าควรเพิ่มหรือลดอะไรเพื่อให้เหมาะสมขึ้น</div>
  `;

  const target = el('div', 'plt-target', 'เตรียมทบทวน…');
  const prompt = el('div', 'plt-prompt', 'เลือกตัวเลือกที่ช่วยให้จานสมดุลขึ้น');
  const choices = el('div', 'plt-choices');
  const note = el('div', 'plt-note', 'Cooldown ใช้สรุปความเข้าใจเรื่องจานสุขภาพ');

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
    game: 'plate',
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

    const r = rounds[idx];
    target.textContent = r.q;
    choices.innerHTML = '';

    const options = shuffle([r.good, r.bad], rng);

    for(const opt of options){
      const isGood = opt === r.good;
      const btn = el('button', `plt-btn ${isGood ? 'good' : 'bad'}`, opt);

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
          game:'plate',
          mode:'cooldown',
          round: idx,
          prompt: r.q,
          selected: opt,
          correct: r.good,
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
      <div class="plt-result">
        <div class="plt-badge">✨ Rank ${buffs.rank}</div>
        <div class="plt-big">คูลดาวน์เสร็จแล้ว</div>
        <div class="plt-list">
          <div class="plt-item">คะแนน: ${score}</div>
          <div class="plt-item">ความแม่นยำ: ${accuracy}%</div>
          <div class="plt-item">สรุป: จานที่ดีควรสมดุล ไม่หนักไปด้านเดียว</div>
        </div>
        <div class="plt-actions">
          <button class="plt-btn good" id="pltCooldownFinishBtn">กลับ HUB / ไปต่อ</button>
        </div>
      </div>
    `;

    root.querySelector('#pltCooldownFinishBtn')?.addEventListener('click', ()=>{
      api.finish({
        ok: true,
        title: 'คูลดาวน์เสร็จแล้ว',
        subtitle: 'สรุปการจัดจานอาหารเรียบร้อย',
        lines: [
          `คะแนน: ${score}`,
          `ความแม่นยำ: ${accuracy}%`,
          'ผัก 1/2 จาน',
          'ข้าว/แป้ง 1/4 จาน',
          'โปรตีน 1/4 จาน'
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