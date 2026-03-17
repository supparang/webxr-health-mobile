/* === /herohealth/gate/games/goodjunk/warmup.js ===
   HeroHealth Gate Mini-game
   GAME: goodjunk
   MODE: warmup
   FULL PATCH v20260313d-GATE-GOODJUNK-WARMUP-CHILD-FUN-AI-SUMMARY
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

function clamp(v,a,b){
  v = Number(v);
  if(!Number.isFinite(v)) v = a;
  return Math.max(a, Math.min(b, v));
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
  if(acc >= 92) return 'S';
  if(acc >= 80) return 'A';
  if(acc >= 65) return 'B';
  if(acc >= 45) return 'C';
  return 'D';
}

function buildBuffs({ score, accuracy, speed, junkSafe }){
  const calm = clamp(Math.round(accuracy * 0.55 + junkSafe * 0.45), 0, 100);
  const focus = clamp(Math.round(accuracy * 0.70 + speed * 0.30), 0, 100);
  const rank = calcRank(accuracy);
  return {
    wType: 'goodjunk',
    score,
    accuracy,
    speed,
    calm,
    focus,
    junkSafe,
    rank,
    wPct: clamp(Math.round(accuracy / 4), 0, 25),
    wCrit: clamp(Math.round(focus / 6), 0, 20),
    wDmg: clamp(Math.round((accuracy + speed) / 12), 0, 18),
    wHeal: clamp(Math.round(calm / 6), 0, 18),
    foodJudgementPct: accuracy
  };
}

function resultTitle(acc){
  if(acc >= 90) return 'สุดยอดนักแยกอาหาร!';
  if(acc >= 75) return 'พร้อมลุย GoodJunk!';
  if(acc >= 55) return 'ทำได้ดีมาก';
  return 'วอร์มครบแล้ว';
}

function resultLine(acc, miss){
  if(acc >= 90 && miss <= 1) return 'แยกของดีและของขยะได้แม่นมาก';
  if(acc >= 75) return 'อ่านเป้าได้ดี พร้อมเข้าเกมหลัก';
  if(acc >= 55) return 'เริ่มแยกได้ดีขึ้นแล้ว';
  return 'รอบหน้าอย่ากดรีบเกินไป';
}

export async function mount(root, ctx, api){
  loadStyle();

  const rng = mulberry32(Number(ctx.seed || Date.now()) + 17);

  const ROUNDS = shuffle([
    { emoji:'🍎', label:'แอปเปิล', type:'good', tip:'ผลไม้มีประโยชน์' },
    { emoji:'🥦', label:'บรอกโคลี', type:'good', tip:'ผักดีต่อร่างกาย' },
    { emoji:'🥛', label:'นม', type:'good', tip:'นมมีประโยชน์' },
    { emoji:'🐟', label:'ปลา', type:'good', tip:'โปรตีนที่ดี' },
    { emoji:'🍉', label:'แตงโม', type:'good', tip:'ผลไม้สดดีต่อสุขภาพ' },
    { emoji:'🥕', label:'แครอท', type:'good', tip:'ผักช่วยให้แข็งแรง' },

    { emoji:'🍟', label:'เฟรนช์ฟรายส์', type:'junk', tip:'กินบ่อยไม่ดี' },
    { emoji:'🍭', label:'ลูกอม', type:'junk', tip:'หวานมากเกินไป' },
    { emoji:'🥤', label:'น้ำอัดลม', type:'junk', tip:'น้ำตาลสูง' },
    { emoji:'🍩', label:'โดนัท', type:'junk', tip:'หวานและมัน' },
    { emoji:'🍫', label:'ช็อกโกแลตหวาน', type:'junk', tip:'กินมากไม่ดี' },
    { emoji:'🍔', label:'เบอร์เกอร์', type:'junk', tip:'มันและเค็มมาก' }
  ], rng).slice(0, 8);

  const plannedTime = clamp(Number(ctx.time || 20), 12, 40);
  let timeLeft = plannedTime;

  let idx = 0;
  let score = 0;
  let correct = 0;
  let wrong = 0;
  let hitsGood = 0;
  let hitsJunk = 0;
  let wrongGood = 0;
  let wrongJunk = 0;
  let ended = false;
  let roundStartedAt = performance.now();
  const rtList = [];

  root.innerHTML = '';

  const wrap = el('div', 'gjg-wrap');
  wrap.style.maxWidth = '980px';
  wrap.style.margin = '0 auto';
  wrap.style.padding = '14px';
  wrap.style.color = '#e5e7eb';

  const hero = el('div', 'gjg-hero');
  hero.style.border = '1px solid rgba(148,163,184,.18)';
  hero.style.borderRadius = '24px';
  hero.style.padding = '16px';
  hero.style.background = 'linear-gradient(180deg,rgba(15,23,42,.92),rgba(2,6,23,.86))';
  hero.style.boxShadow = '0 18px 48px rgba(0,0,0,.28)';
  hero.innerHTML = `
    <div style="font-size:.82rem;letter-spacing:.08em;color:#94a3b8;font-weight:900">NUTRITION ZONE • GOODJUNK • WARMUP</div>
    <div style="margin-top:8px;font-size:clamp(1.4rem,4vw,2rem);font-weight:1000;line-height:1.08">ของนี้ดีต่อร่างกายไหม</div>
    <div style="margin-top:8px;color:#cbd5e1;line-height:1.6">
      แตะเลือกให้ถูกว่าเป็น <strong style="color:#86efac">ของดี</strong> หรือ <strong style="color:#fca5a5">ของขยะ</strong>
      เพื่อวอร์มสมองก่อนเข้าเกมหลัก
    </div>
  `;

  const stage = el('div', 'gjg-stage');
  stage.style.marginTop = '14px';
  stage.style.display = 'grid';
  stage.style.gridTemplateColumns = '1fr';
  stage.style.gap = '14px';

  const card = el('div', 'gjg-card');
  card.style.border = '1px solid rgba(148,163,184,.18)';
  card.style.borderRadius = '24px';
  card.style.padding = '18px';
  card.style.background = 'linear-gradient(180deg,rgba(15,23,42,.92),rgba(2,6,23,.84))';
  card.style.boxShadow = '0 18px 48px rgba(0,0,0,.28)';
  card.style.textAlign = 'center';

  const roundChip = el('div', 'gjg-round', 'รอบที่ 1 / 8');
  roundChip.style.display = 'inline-flex';
  roundChip.style.padding = '8px 12px';
  roundChip.style.borderRadius = '999px';
  roundChip.style.background = 'rgba(15,23,42,.95)';
  roundChip.style.border = '1px solid rgba(148,163,184,.18)';
  roundChip.style.fontWeight = '1000';
  roundChip.style.fontSize = '.95rem';

  const bigEmoji = el('div', 'gjg-emoji', '🍎');
  bigEmoji.style.fontSize = 'clamp(4rem,15vw,7rem)';
  bigEmoji.style.marginTop = '14px';
  bigEmoji.style.lineHeight = '1';
  bigEmoji.style.filter = 'drop-shadow(0 18px 40px rgba(0,0,0,.35))';

  const foodLabel = el('div', 'gjg-label', 'แอปเปิล');
  foodLabel.style.marginTop = '12px';
  foodLabel.style.fontSize = 'clamp(1.2rem,4vw,1.7rem)';
  foodLabel.style.fontWeight = '1000';

  const prompt = el('div', 'gjg-prompt', 'เลือกว่าของนี้ดีต่อร่างกายไหม');
  prompt.style.marginTop = '8px';
  prompt.style.color = '#cbd5e1';
  prompt.style.fontSize = '1rem';

  const btnWrap = el('div', 'gjg-actions');
  btnWrap.style.display = 'grid';
  btnWrap.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
  btnWrap.style.gap = '12px';
  btnWrap.style.marginTop = '18px';

  const btnGood = el('button', 'gjg-btn good', '✅ ของดี');
  const btnJunk = el('button', 'gjg-btn junk', '⚠️ ของขยะ');

  [btnGood, btnJunk].forEach(btn=>{
    btn.style.minHeight = '54px';
    btn.style.border = '0';
    btn.style.borderRadius = '18px';
    btn.style.font = 'inherit';
    btn.style.fontWeight = '1000';
    btn.style.fontSize = '1rem';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 14px 30px rgba(0,0,0,.24)';
  });
  btnGood.style.background = 'linear-gradient(180deg,#86efac,#22c55e)';
  btnGood.style.color = '#052e16';
  btnJunk.style.background = 'linear-gradient(180deg,#fdba74,#f97316)';
  btnJunk.style.color = '#431407';

  const feedback = el('div', 'gjg-feedback', 'แตะเริ่มได้เลย');
  feedback.style.marginTop = '14px';
  feedback.style.minHeight = '28px';
  feedback.style.fontWeight = '900';
  feedback.style.fontSize = '1rem';

  const info = el('div', 'gjg-info');
  info.style.marginTop = '8px';
  info.style.color = '#cbd5e1';
  info.style.fontSize = '.96rem';
  info.style.minHeight = '24px';

  card.appendChild(roundChip);
  card.appendChild(bigEmoji);
  card.appendChild(foodLabel);
  card.appendChild(prompt);
  btnWrap.appendChild(btnGood);
  btnWrap.appendChild(btnJunk);
  card.appendChild(btnWrap);
  card.appendChild(feedback);
  card.appendChild(info);

  const stats = el('div', 'gjg-stats');
  stats.style.display = 'grid';
  stats.style.gridTemplateColumns = 'repeat(auto-fit,minmax(150px,1fr))';
  stats.style.gap = '10px';

  function statCard(label, id, tone){
    const box = el('div', `gjg-stat ${tone}`);
    box.style.border = '1px solid rgba(148,163,184,.18)';
    box.style.borderRadius = '18px';
    box.style.padding = '14px';
    box.style.background =
      tone === 'green' ? 'linear-gradient(180deg,rgba(34,197,94,.14),rgba(15,23,42,.86))' :
      tone === 'amber' ? 'linear-gradient(180deg,rgba(245,158,11,.14),rgba(15,23,42,.86))' :
      tone === 'blue' ? 'linear-gradient(180deg,rgba(59,130,246,.14),rgba(15,23,42,.86))' :
      'linear-gradient(180deg,rgba(167,139,250,.14),rgba(15,23,42,.86))';
    box.innerHTML = `
      <div style="font-size:.85rem;color:#cbd5e1;font-weight:900">${label}</div>
      <div id="${id}" style="margin-top:6px;font-size:1.3rem;font-weight:1000">0</div>
    `;
    return box;
  }

  stats.appendChild(statCard('คะแนน', 'gjg-score', 'blue'));
  stats.appendChild(statCard('ตอบถูก', 'gjg-correct', 'green'));
  stats.appendChild(statCard('ตอบผิด', 'gjg-wrong', 'amber'));
  stats.appendChild(statCard('ความแม่นยำ', 'gjg-acc', 'violet'));

  stage.appendChild(card);
  stage.appendChild(stats);

  wrap.appendChild(hero);
  wrap.appendChild(stage);
  root.appendChild(wrap);

  const scoreEl = root.querySelector('#gjg-score');
  const correctEl = root.querySelector('#gjg-correct');
  const wrongEl = root.querySelector('#gjg-wrong');
  const accEl = root.querySelector('#gjg-acc');

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
    const acc = idx > 0 ? Math.round((correct / idx) * 100) : 0;
    if(scoreEl) scoreEl.textContent = String(score);
    if(correctEl) correctEl.textContent = String(correct);
    if(wrongEl) wrongEl.textContent = String(wrong);
    if(accEl) accEl.textContent = `${acc}%`;

    api.setStats({
      time: timeLeft,
      score,
      miss: wrong,
      acc: `${acc}%`
    });
  }

  function lockButtons(on){
    btnGood.disabled = !!on;
    btnJunk.disabled = !!on;
    btnGood.style.opacity = on ? '.72' : '1';
    btnJunk.style.opacity = on ? '.72' : '1';
  }

  function currentRound(){
    return ROUNDS[idx] || null;
  }

  function renderRound(){
    if(ended) return;
    const item = currentRound();
    if(!item){
      finishNow();
      return;
    }

    roundStartedAt = performance.now();
    roundChip.textContent = `รอบที่ ${idx + 1} / ${ROUNDS.length}`;
    bigEmoji.textContent = item.emoji;
    foodLabel.textContent = item.label;
    prompt.textContent = 'เลือกว่าของนี้ดีต่อร่างกายไหม';
    feedback.textContent = 'แตะคำตอบได้เลย';
    feedback.style.color = '#e5e7eb';
    info.textContent = '';
    lockButtons(false);
  }

  function answer(choice){
    if(ended) return;
    const item = currentRound();
    if(!item) return;

    lockButtons(true);

    const rt = Math.max(80, Math.round(performance.now() - roundStartedAt));
    rtList.push(rt);

    const isCorrect = choice === item.type;
    idx++;

    if(isCorrect){
      correct++;
      score += 10;
      if(item.type === 'good') hitsGood++;
      else hitsJunk++;

      feedback.textContent = item.type === 'good' ? 'ถูกต้อง! ของดี ✅' : 'ถูกต้อง! ของขยะ ⚠️';
      feedback.style.color = item.type === 'good' ? '#86efac' : '#fdba74';
      info.textContent = item.tip;
    }else{
      wrong++;
      score = Math.max(0, score - 4);
      if(item.type === 'good') wrongGood++;
      else wrongJunk++;

      feedback.textContent = item.type === 'good' ? 'ยังไม่ใช่ อันนี้เป็นของดีนะ' : 'ยังไม่ใช่ อันนี้เป็นของขยะนะ';
      feedback.style.color = '#fca5a5';
      info.textContent = item.tip;
    }

    api.logger?.push?.('mini_answer', {
      game: 'goodjunk',
      mode: 'warmup',
      round: idx,
      emoji: item.emoji,
      label: item.label,
      truth: item.type,
      choice,
      isCorrect,
      rt,
      score,
      correct,
      wrong
    });

    updateHud();

    setTimeout(()=>{
      if(ended) return;
      renderRound();
    }, 420);
  }

  btnGood.addEventListener('click', ()=> answer('good'));
  btnJunk.addEventListener('click', ()=> answer('junk'));

  function finishNow(){
    if(ended) return;
    ended = true;
    clearInterval(timer);
    lockButtons(true);

    const accuracy = ROUNDS.length ? Math.round((correct / ROUNDS.length) * 100) : 0;
    const avgRt = rtList.length ? Math.round(rtList.reduce((a,b)=>a+b,0) / rtList.length) : 0;
    const speed = clamp(Math.round(100 - ((avgRt - 500) / 9)), 30, 100);
    const junkSafe = clamp(Math.round((hitsJunk / Math.max(1, hitsJunk + wrongGood)) * 100), 0, 100);
    const buffs = buildBuffs({ score, accuracy, speed, junkSafe });
    const rank = buffs.rank;

    root.innerHTML = `
      <div style="max-width:960px;margin:0 auto;padding:14px;color:#e5e7eb">
        <section style="
          border:1px solid rgba(148,163,184,.18);
          border-radius:28px;
          padding:18px;
          background:
            radial-gradient(800px 420px at 50% -10%, rgba(34,197,94,.12), transparent 60%),
            linear-gradient(180deg,rgba(15,23,42,.94),rgba(2,6,23,.88));
          box-shadow:0 18px 48px rgba(0,0,0,.28);
        ">
          <div style="font-size:.82rem;letter-spacing:.08em;color:#94a3b8;font-weight:900">GOODJUNK WARMUP COMPLETE</div>
          <h1 style="margin:8px 0 0;font-size:clamp(1.5rem,5vw,2.1rem);font-weight:1000;line-height:1.08">${resultTitle(accuracy)}</h1>
          <p style="margin:10px 0 0;color:#dbeafe;line-height:1.6">${resultLine(accuracy, wrong)}</p>

          <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px">
            <div style="padding:10px 14px;border-radius:999px;background:rgba(15,23,42,.94);border:1px solid rgba(250,204,21,.22);font-weight:1000">✨ Rank ${rank}</div>
            <div style="padding:10px 14px;border-radius:999px;background:rgba(15,23,42,.94);border:1px solid rgba(59,130,246,.22);font-weight:1000">🏅 คะแนน ${score}</div>
            <div style="padding:10px 14px;border-radius:999px;background:rgba(15,23,42,.94);border:1px solid rgba(34,197,94,.22);font-weight:1000">🎯 แม่น ${accuracy}%</div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:16px">
            <div style="border-radius:18px;padding:14px;background:linear-gradient(180deg,rgba(59,130,246,.14),rgba(15,23,42,.86));border:1px solid rgba(59,130,246,.22)">
              <div style="font-size:.84rem;color:#cbd5e1;font-weight:900">⚡ ความเร็ว</div>
              <div style="margin-top:6px;font-size:1.18rem;font-weight:1000">${speed}%</div>
            </div>
            <div style="border-radius:18px;padding:14px;background:linear-gradient(180deg,rgba(34,197,94,.14),rgba(15,23,42,.86));border:1px solid rgba(34,197,94,.22)">
              <div style="font-size:.84rem;color:#cbd5e1;font-weight:900">🌿 ความนิ่ง</div>
              <div style="margin-top:6px;font-size:1.18rem;font-weight:1000">${buffs.calm}%</div>
            </div>
            <div style="border-radius:18px;padding:14px;background:linear-gradient(180deg,rgba(167,139,250,.14),rgba(15,23,42,.86));border:1px solid rgba(167,139,250,.22)">
              <div style="font-size:.84rem;color:#cbd5e1;font-weight:900">🧠 แยกอาหาร</div>
              <div style="margin-top:6px;font-size:1.18rem;font-weight:1000">${buffs.foodJudgementPct}%</div>
            </div>
            <div style="border-radius:18px;padding:14px;background:linear-gradient(180deg,rgba(250,204,21,.14),rgba(15,23,42,.86));border:1px solid rgba(250,204,21,.22)">
              <div style="font-size:.84rem;color:#cbd5e1;font-weight:900">🪄 โบนัสก่อนเข้าเกม</div>
              <div style="margin-top:6px;font-size:1.18rem;font-weight:1000">+${buffs.wPct}%</div>
            </div>
          </div>

          <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
            <button id="gjg-finish" style="
              appearance:none;border:0;border-radius:16px;padding:14px 18px;min-height:50px;
              font-weight:1000;font-size:1rem;cursor:pointer;
              background:linear-gradient(180deg,#86efac,#22c55e);color:#052e16
            ">ไปเกมหลัก</button>
          </div>
        </section>
      </div>
    `;

    root.querySelector('#gjg-finish')?.addEventListener('click', ()=>{
      api.finish({
        ok: true,
        title: 'พร้อมลุย GoodJunk!',
        subtitle: resultLine(accuracy, wrong),
        lines: [
          `คะแนน: ${score}`,
          `ความแม่นยำ: ${accuracy}%`,
          `ความเร็ว: ${speed}%`,
          `Rank: ${rank}`
        ],
        metrics: {
          total: ROUNDS.length,
          correct,
          wrong,
          avgReactionMs: avgRt,
          score,
          accuracy,
          speed,
          calm: buffs.calm,
          junkSafe,
          rank,
          foodJudgementPct: buffs.foodJudgementPct
        },
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

  renderRound();

  return {
    start(){},
    destroy(){
      ended = true;
      clearInterval(timer);
    }
  };
}

export default { mount, loadStyle };