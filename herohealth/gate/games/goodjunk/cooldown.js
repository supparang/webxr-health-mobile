/* === /herohealth/gate/games/goodjunk/cooldown.js ===
   HeroHealth Gate Mini-game
   GAME: goodjunk
   MODE: cooldown
   FULL PATCH v20260313e-GATE-GOODJUNK-COOLDOWN-OK-FIX
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

function mulberry32(seed){
  let t = (seed >>> 0) || 1;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function dayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function lsGet(k){
  try{ return localStorage.getItem(k); }catch(_){ return null; }
}
function lsSet(k,v){
  try{ localStorage.setItem(k,v); }catch(_){}
}

function readLastSummary(pid){
  const keys = [
    `HHA_LAST_SUMMARY:goodjunk:${pid}`,
    'HHA_LAST_SUMMARY'
  ];
  for(const k of keys){
    const raw = lsGet(k);
    if(!raw) continue;
    try{
      const obj = JSON.parse(raw);
      if(obj?.detail?.gameKey === 'goodjunk' || obj?.detail?.game === 'goodjunk' || obj?.gameKey === 'goodjunk'){
        return obj;
      }
    }catch(_){}
  }
  return null;
}

function markCooldownDone(cat, gameKey, pid){
  const day = dayKey();
  const p = String(pid || 'anon').trim() || 'anon';
  const c = String(cat || 'nutrition').toLowerCase();
  const g = String(gameKey || 'goodjunk').toLowerCase();
  lsSet(`HHA_COOLDOWN_DONE:${c}:${g}:${p}:${day}`, '1');
  lsSet(`HHA_COOLDOWN_DONE:${c}:${p}:${day}`, '1');
}

function moodLabel(v){
  if(v === 'happy') return 'สดชื่น';
  if(v === 'calm') return 'สงบ';
  if(v === 'tired') return 'เหนื่อย';
  return 'โอเค';
}

function energyLabel(v){
  if(v === 'high') return 'มาก';
  if(v === 'medium') return 'ปานกลาง';
  if(v === 'low') return 'น้อย';
  return 'ปานกลาง';
}

export async function mount(root, ctx, api){
  loadStyle();

  const rng = mulberry32(Number(ctx.seed || Date.now()) + 71);
  const pid = String(ctx.pid || 'anon');
  const saved = readLastSummary(pid);
  const detail = saved?.detail || {};
  const summary = saved?.summary || detail?.summary || {};

  const plannedTime = clamp(Number(ctx.time || 18), 10, 30);
  let timeLeft = plannedTime;
  let ended = false;

  let calmTicks = 0;
  let answers = 0;
  let mood = 'calm';
  let energy = 'medium';

  root.innerHTML = '';

  const wrap = el('div', 'gjc-wrap');
  wrap.style.maxWidth = '980px';
  wrap.style.margin = '0 auto';
  wrap.style.padding = '14px';
  wrap.style.color = '#e5e7eb';

  const hero = el('div', 'gjc-hero');
  hero.style.border = '1px solid rgba(148,163,184,.18)';
  hero.style.borderRadius = '24px';
  hero.style.padding = '16px';
  hero.style.background = 'linear-gradient(180deg,rgba(15,23,42,.92),rgba(2,6,23,.86))';
  hero.style.boxShadow = '0 18px 48px rgba(0,0,0,.28)';
  hero.innerHTML = `
    <div style="font-size:.82rem;letter-spacing:.08em;color:#94a3b8;font-weight:900">NUTRITION ZONE • GOODJUNK • COOLDOWN</div>
    <div style="margin-top:8px;font-size:clamp(1.4rem,4vw,2rem);font-weight:1000;line-height:1.08">พักใจหลังเล่นเกม</div>
    <div style="margin-top:8px;color:#cbd5e1;line-height:1.6">
      หายใจช้า ๆ แล้วทบทวนว่า <strong style="color:#86efac">ของดี</strong> กับ <strong style="color:#fca5a5">ของขยะ</strong>
      ต่างกันอย่างไร
    </div>
  `;

  const summaryBox = el('div', 'gjc-summary');
  summaryBox.style.marginTop = '14px';
  summaryBox.style.border = '1px solid rgba(148,163,184,.18)';
  summaryBox.style.borderRadius = '24px';
  summaryBox.style.padding = '16px';
  summaryBox.style.background = 'linear-gradient(180deg,rgba(15,23,42,.92),rgba(2,6,23,.86))';
  summaryBox.style.boxShadow = '0 18px 48px rgba(0,0,0,.28)';

  const finalScore = Number(summary.scoreFinal ?? detail.scoreFinal ?? detail.score ?? 0);
  const grade = String(summary.grade ?? detail.grade ?? '-');
  const bestMoment = String(summary.bestMoment || 'คุณได้ฝึกแยกของดีและของขยะ');
  const weakness = String(summary.weakness || 'รอบหน้าลองอ่านเป้าให้ชัดก่อนกดยิง');
  const nextTip = String(summary.nextTip || 'เลือกชัวร์มากกว่ากดเร็ว');

  summaryBox.innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <div style="padding:10px 14px;border-radius:999px;background:rgba(15,23,42,.95);border:1px solid rgba(59,130,246,.22);font-weight:1000">🏅 คะแนน ${finalScore}</div>
      <div style="padding:10px 14px;border-radius:999px;background:rgba(15,23,42,.95);border:1px solid rgba(250,204,21,.22);font-weight:1000">✨ Grade ${grade}</div>
      <div style="padding:10px 14px;border-radius:999px;background:rgba(15,23,42,.95);border:1px solid rgba(34,197,94,.22);font-weight:1000">🧘 Cooldown</div>
    </div>

    <div style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
      <div style="border-radius:18px;padding:14px;background:linear-gradient(180deg,rgba(34,197,94,.14),rgba(15,23,42,.86));border:1px solid rgba(34,197,94,.22)">
        <div style="font-size:.84rem;color:#cbd5e1;font-weight:900">⭐ ช่วงที่ทำได้ดี</div>
        <div style="margin-top:6px;font-size:1rem;font-weight:1000;line-height:1.5">${bestMoment}</div>
      </div>
      <div style="border-radius:18px;padding:14px;background:linear-gradient(180deg,rgba(245,158,11,.14),rgba(15,23,42,.86));border:1px solid rgba(245,158,11,.22)">
        <div style="font-size:.84rem;color:#cbd5e1;font-weight:900">🔎 สิ่งที่ควรระวัง</div>
        <div style="margin-top:6px;font-size:1rem;font-weight:1000;line-height:1.5">${weakness}</div>
      </div>
      <div style="border-radius:18px;padding:14px;background:linear-gradient(180deg,rgba(167,139,250,.14),rgba(15,23,42,.86));border:1px solid rgba(167,139,250,.22)">
        <div style="font-size:.84rem;color:#cbd5e1;font-weight:900">🪄 คำแนะนำรอบหน้า</div>
        <div style="margin-top:6px;font-size:1rem;font-weight:1000;line-height:1.5">${nextTip}</div>
      </div>
    </div>
  `;

  const calmBox = el('div', 'gjc-calm');
  calmBox.style.marginTop = '14px';
  calmBox.style.border = '1px solid rgba(148,163,184,.18)';
  calmBox.style.borderRadius = '24px';
  calmBox.style.padding = '18px';
  calmBox.style.background = 'linear-gradient(180deg,rgba(15,23,42,.92),rgba(2,6,23,.84))';
  calmBox.style.boxShadow = '0 18px 48px rgba(0,0,0,.28)';
  calmBox.style.textAlign = 'center';

  const orb = el('div', 'gjc-orb', '🌿');
  orb.style.width = '120px';
  orb.style.height = '120px';
  orb.style.margin = '0 auto';
  orb.style.borderRadius = '999px';
  orb.style.display = 'grid';
  orb.style.placeItems = 'center';
  orb.style.fontSize = '3rem';
  orb.style.background = 'radial-gradient(circle at 35% 35%, rgba(134,239,172,.55), rgba(34,197,94,.20) 55%, rgba(2,6,23,.35) 100%)';
  orb.style.boxShadow = '0 0 0 0 rgba(34,197,94,.22)';
  orb.style.transition = 'transform .9s ease, box-shadow .9s ease';

  const breatheTitle = el('div', 'gjc-breathe-title', 'หายใจเข้า... หายใจออก...');
  breatheTitle.style.marginTop = '14px';
  breatheTitle.style.fontSize = 'clamp(1.1rem,4vw,1.5rem)';
  breatheTitle.style.fontWeight = '1000';

  const breatheHint = el('div', 'gjc-breathe-hint', 'แตะปุ่มด้านล่างเมื่อรู้สึกสงบขึ้น');
  breatheHint.style.marginTop = '8px';
  breatheHint.style.color = '#cbd5e1';
  breatheHint.style.lineHeight = '1.6';

  const calmBtn = el('button', 'gjc-calm-btn', '🌿 ฉันสงบขึ้นแล้ว');
  calmBtn.style.marginTop = '16px';
  calmBtn.style.minHeight = '52px';
  calmBtn.style.border = '0';
  calmBtn.style.borderRadius = '18px';
  calmBtn.style.padding = '12px 18px';
  calmBtn.style.font = 'inherit';
  calmBtn.style.fontWeight = '1000';
  calmBtn.style.fontSize = '1rem';
  calmBtn.style.cursor = 'pointer';
  calmBtn.style.background = 'linear-gradient(180deg,#86efac,#22c55e)';
  calmBtn.style.color = '#052e16';
  calmBtn.style.boxShadow = '0 14px 30px rgba(0,0,0,.24)';

  const calmProgress = el('div', 'gjc-progress', 'ช่วงผ่อนคลาย 0 / 3');
  calmProgress.style.marginTop = '10px';
  calmProgress.style.color = '#dbeafe';
  calmProgress.style.fontWeight = '900';

  calmBox.appendChild(orb);
  calmBox.appendChild(breatheTitle);
  calmBox.appendChild(breatheHint);
  calmBox.appendChild(calmBtn);
  calmBox.appendChild(calmProgress);

  const reflectBox = el('div', 'gjc-reflect');
  reflectBox.style.marginTop = '14px';
  reflectBox.style.border = '1px solid rgba(148,163,184,.18)';
  reflectBox.style.borderRadius = '24px';
  reflectBox.style.padding = '16px';
  reflectBox.style.background = 'linear-gradient(180deg,rgba(15,23,42,.92),rgba(2,6,23,.84))';
  reflectBox.style.boxShadow = '0 18px 48px rgba(0,0,0,.28)';

  reflectBox.innerHTML = `
    <div style="font-size:1.1rem;font-weight:1000">สะท้อนความรู้สึกหลังเล่น</div>
    <div style="margin-top:8px;color:#cbd5e1;line-height:1.6">เลือกความรู้สึกและพลังงานของคุณตอนนี้</div>
  `;

  const moodWrap = el('div', 'gjc-mood-wrap');
  moodWrap.style.display = 'grid';
  moodWrap.style.gridTemplateColumns = 'repeat(3,minmax(0,1fr))';
  moodWrap.style.gap = '10px';
  moodWrap.style.marginTop = '14px';

  const energyWrap = el('div', 'gjc-energy-wrap');
  energyWrap.style.display = 'grid';
  energyWrap.style.gridTemplateColumns = 'repeat(3,minmax(0,1fr))';
  energyWrap.style.gap = '10px';
  energyWrap.style.marginTop = '12px';

  function choiceBtn(text, active=false){
    const b = el('button', 'gjc-choice', text);
    b.type = 'button';
    b.style.minHeight = '50px';
    b.style.borderRadius = '16px';
    b.style.border = active ? '1px solid rgba(34,197,94,.40)' : '1px solid rgba(148,163,184,.18)';
    b.style.background = active ? 'linear-gradient(180deg,rgba(34,197,94,.18),rgba(15,23,42,.92))' : 'rgba(15,23,42,.92)';
    b.style.color = '#e5e7eb';
    b.style.font = 'inherit';
    b.style.fontWeight = '1000';
    b.style.cursor = 'pointer';
    return b;
  }

  const moodHappy = choiceBtn('😊 สดชื่น');
  const moodCalm = choiceBtn('😌 สงบ', true);
  const moodTired = choiceBtn('😴 เหนื่อย');

  const energyLow = choiceBtn('🔋 น้อย');
  const energyMedium = choiceBtn('⚡ ปานกลาง', true);
  const energyHigh = choiceBtn('🚀 มาก');

  moodWrap.appendChild(moodHappy);
  moodWrap.appendChild(moodCalm);
  moodWrap.appendChild(moodTired);

  energyWrap.appendChild(energyLow);
  energyWrap.appendChild(energyMedium);
  energyWrap.appendChild(energyHigh);

  reflectBox.appendChild(moodWrap);
  reflectBox.appendChild(energyWrap);

  wrap.appendChild(hero);
  wrap.appendChild(summaryBox);
  wrap.appendChild(calmBox);
  wrap.appendChild(reflectBox);
  root.appendChild(wrap);

  function setMood(v){
    mood = v;
    moodHappy.style.border = v === 'happy' ? '1px solid rgba(34,197,94,.40)' : '1px solid rgba(148,163,184,.18)';
    moodCalm.style.border = v === 'calm' ? '1px solid rgba(34,197,94,.40)' : '1px solid rgba(148,163,184,.18)';
    moodTired.style.border = v === 'tired' ? '1px solid rgba(34,197,94,.40)' : '1px solid rgba(148,163,184,.18)';
    moodHappy.style.background = v === 'happy' ? 'linear-gradient(180deg,rgba(34,197,94,.18),rgba(15,23,42,.92))' : 'rgba(15,23,42,.92)';
    moodCalm.style.background = v === 'calm' ? 'linear-gradient(180deg,rgba(34,197,94,.18),rgba(15,23,42,.92))' : 'rgba(15,23,42,.92)';
    moodTired.style.background = v === 'tired' ? 'linear-gradient(180deg,rgba(34,197,94,.18),rgba(15,23,42,.92))' : 'rgba(15,23,42,.92)';
    answers++;
  }

  function setEnergy(v){
    energy = v;
    energyLow.style.border = v === 'low' ? '1px solid rgba(34,197,94,.40)' : '1px solid rgba(148,163,184,.18)';
    energyMedium.style.border = v === 'medium' ? '1px solid rgba(34,197,94,.40)' : '1px solid rgba(148,163,184,.18)';
    energyHigh.style.border = v === 'high' ? '1px solid rgba(34,197,94,.40)' : '1px solid rgba(148,163,184,.18)';
    energyLow.style.background = v === 'low' ? 'linear-gradient(180deg,rgba(34,197,94,.18),rgba(15,23,42,.92))' : 'rgba(15,23,42,.92)';
    energyMedium.style.background = v === 'medium' ? 'linear-gradient(180deg,rgba(34,197,94,.18),rgba(15,23,42,.92))' : 'rgba(15,23,42,.92)';
    energyHigh.style.background = v === 'high' ? 'linear-gradient(180deg,rgba(34,197,94,.18),rgba(15,23,42,.92))' : 'rgba(15,23,42,.92)';
    answers++;
  }

  moodHappy.addEventListener('click', ()=> setMood('happy'));
  moodCalm.addEventListener('click', ()=> setMood('calm'));
  moodTired.addEventListener('click', ()=> setMood('tired'));

  energyLow.addEventListener('click', ()=> setEnergy('low'));
  energyMedium.addEventListener('click', ()=> setEnergy('medium'));
  energyHigh.addEventListener('click', ()=> setEnergy('high'));

  api.logger?.push?.('mini_start', {
    game: 'goodjunk',
    mode: 'cooldown',
    seed: ctx.seed
  });

  api.setStats({
    time: timeLeft,
    score: finalScore,
    miss: 0,
    acc: `${detail.accPct || 0}%`
  });

  function updateHud(){
    api.setStats({
      time: timeLeft,
      score: finalScore,
      miss: 0,
      acc: `${detail.accPct || 0}%`
    });
    calmProgress.textContent = `ช่วงผ่อนคลาย ${calmTicks} / 3`;
  }

  function finishNow(ok=true){
    if(ended) return;
    ended = true;
    clearInterval(timer);

    markCooldownDone('nutrition', 'goodjunk', pid);

    const coachLine =
      mood === 'tired'
        ? 'พักสายตาและหายใจช้า ๆ แล้วค่อยกลับไปเล่นรอบหน้า'
        : mood === 'happy'
          ? 'ยอดเยี่ยมมาก วันนี้แยกของดีและของขยะได้ดีขึ้น'
          : 'ดีมาก ร่างกายและใจเริ่มสงบลงแล้ว';

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
          <div style="font-size:.82rem;letter-spacing:.08em;color:#94a3b8;font-weight:900">GOODJUNK COOLDOWN COMPLETE</div>
          <h1 style="margin:8px 0 0;font-size:clamp(1.5rem,5vw,2.1rem);font-weight:1000;line-height:1.08">${ok ? 'พักเสร็จแล้ว กลับ HUB ได้เลย' : 'หมดเวลาพักแล้ว'}</h1>
          <p style="margin:10px 0 0;color:#dbeafe;line-height:1.6">${coachLine}</p>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-top:16px">
            <div style="border-radius:18px;padding:14px;background:linear-gradient(180deg,rgba(34,197,94,.14),rgba(15,23,42,.86));border:1px solid rgba(34,197,94,.22)">
              <div style="font-size:.84rem;color:#cbd5e1;font-weight:900">🌿 ช่วงผ่อนคลาย</div>
              <div style="margin-top:6px;font-size:1.18rem;font-weight:1000">${calmTicks}</div>
            </div>
            <div style="border-radius:18px;padding:14px;background:linear-gradient(180deg,rgba(167,139,250,.14),rgba(15,23,42,.86));border:1px solid rgba(167,139,250,.22)">
              <div style="font-size:.84rem;color:#cbd5e1;font-weight:900">😊 ความรู้สึก</div>
              <div style="margin-top:6px;font-size:1.18rem;font-weight:1000">${moodLabel(mood)}</div>
            </div>
            <div style="border-radius:18px;padding:14px;background:linear-gradient(180deg,rgba(59,130,246,.14),rgba(15,23,42,.86));border:1px solid rgba(59,130,246,.22)">
              <div style="font-size:.84rem;color:#cbd5e1;font-weight:900">⚡ พลังงาน</div>
              <div style="margin-top:6px;font-size:1.18rem;font-weight:1000">${energyLabel(energy)}</div>
            </div>
            <div style="border-radius:18px;padding:14px;background:linear-gradient(180deg,rgba(250,204,21,.14),rgba(15,23,42,.86));border:1px solid rgba(250,204,21,.22)">
              <div style="font-size:.84rem;color:#cbd5e1;font-weight:900">💬 คำตอบสะท้อนตน</div>
              <div style="margin-top:6px;font-size:1.18rem;font-weight:1000">${answers}</div>
            </div>
          </div>

          <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
            <button id="gjc-finish" style="
              appearance:none;border:0;border-radius:16px;padding:14px 18px;min-height:50px;
              font-weight:1000;font-size:1rem;cursor:pointer;
              background:linear-gradient(180deg,#86efac,#22c55e);color:#052e16
            ">กลับ HUB</button>
          </div>
        </section>
      </div>
    `;

    root.querySelector('#gjc-finish')?.addEventListener('click', ()=>{
      api.finish({
        ok,
        title: ok ? 'พักเสร็จแล้ว' : 'หมดเวลาพักแล้ว',
        subtitle: coachLine,
        lines: [
          `ช่วงผ่อนคลาย: ${calmTicks}/3`,
          `ความรู้สึก: ${moodLabel(mood)}`,
          `พลังงาน: ${energyLabel(energy)}`,
          `คำตอบสะท้อนตน: ${answers}`
        ],
        metrics: {
          calmTicks,
          answers,
          mood,
          energy
        },
        buffs: {
          cType: 'goodjunk_calm_reflect',
          cDone: ok ? 1 : 0,
          cScore: calmTicks
        }
      });
    });
  }

  const breatheTexts = [
    'หายใจเข้า... หายใจออก...',
    'ช้า ๆ สบาย ๆ',
    'ให้ใจค่อย ๆ นิ่งลง',
    'นึกถึงอาหารดีต่อร่างกาย'
  ];
  let breatheIdx = 0;

  const timer = setInterval(()=>{
    if(ended) return;
    timeLeft--;
    if(timeLeft < 0) timeLeft = 0;

    breatheIdx = (breatheIdx + 1) % breatheTexts.length;
    breatheTitle.textContent = breatheTexts[breatheIdx];
    orb.style.transform = `scale(${1 + ((breatheIdx % 2) ? 0.06 : 0)})`;
    orb.style.boxShadow = `0 0 0 ${12 + (breatheIdx % 2 ? 16 : 6)}px rgba(34,197,94,.08)`;

    updateHud();

    if(timeLeft <= 0){
      finishNow(false);
    }
  }, 1000);

  calmBtn.addEventListener('click', ()=>{
    if(ended) return;
    calmTicks = Math.min(3, calmTicks + 1);

    const scale = 1 + (calmTicks * 0.06);
    orb.style.transform = `scale(${scale})`;
    orb.style.boxShadow = `0 0 0 ${12 + calmTicks * 10}px rgba(34,197,94,.08)`;

    breatheTitle.textContent =
      calmTicks >= 3 ? 'เยี่ยมมาก ร่างกายเริ่มผ่อนคลายแล้ว' :
      calmTicks === 2 ? 'ดีมาก... หายใจสบาย ๆ อีกครั้ง' :
      'ค่อย ๆ ผ่อนคลายต่อ';

    api.logger?.push?.('mini_calm_tick', {
      game: 'goodjunk',
      mode: 'cooldown',
      calmTicks
    });

    updateHud();

    if(calmTicks >= 3){
      setTimeout(()=> finishNow(true), 500 + ((rng() * 250) | 0));
    }
  });

  updateHud();

  return {
    start(){},
    destroy(){
      ended = true;
      clearInterval(timer);
    }
  };
}