// === /herohealth/germ-detective/germ-detective.result.js ===
// Germ Detective modular result layer — P5 aligned

function esc(s){
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function ensureResultModalDOM(){
  if(document.getElementById('gdResultModal')) return;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="gdResultModal" class="gd-modal" hidden aria-hidden="true" role="dialog" aria-labelledby="gdResultTitle">
      <div class="gd-modal__backdrop" data-close="1"></div>
      <section class="gd-modal__card">
        <header class="gd-modal__head">
          <div>
            <h3 id="gdResultTitle" style="margin:0">🕵️ สรุปผลภารกิจนักสืบเชื้อโรค</h3>
            <div class="mut" id="gdResultSubline">-</div>
          </div>
          <button class="btn" id="gdResultCloseBtn" type="button">ปิด</button>
        </header>

        <div class="gd-modal__body">
          <section class="gd-panel">
            <div class="head">
              <strong>📊 ผลลัพธ์ของเรา</strong>
              <small id="gdResultRank">-</small>
            </div>
            <div class="body">
              <div class="result-grid">
                <div class="result-item"><div class="mut">คะแนนรวม</div><div id="gdScoreTotal">-</div></div>
                <div class="result-item"><div class="mut">ดาวที่ได้</div><div id="gdScoreStars">-</div></div>
                <div class="result-item"><div class="mut">ความเสี่ยงที่เหลือ</div><div id="gdRiskRemain">-</div></div>
                <div class="result-item"><div class="mut">ลดความเสี่ยงได้</div><div id="gdRiskDown">-</div></div>
                <div class="result-item"><div class="mut">จุดเสี่ยงหลักที่พบ</div><div id="gdCritical">-</div></div>
                <div class="result-item"><div class="mut">หลักฐานที่พบ</div><div id="gdEvidence">-</div></div>
                <div class="result-item"><div class="mut">จุดที่ทำความสะอาด</div><div id="gdCleaned">-</div></div>
                <div class="result-item"><div class="mut">เวลาที่เหลือ</div><div id="gdTimeLeft">-</div></div>
              </div>
            </div>
          </section>

          <section class="gd-panel">
            <div class="head">
              <strong>🏅 ป้ายรางวัล</strong>
              <small id="gdResultBadgeMeta">-</small>
            </div>
            <div class="body">
              <div id="gdResultBadges" class="badge-row"></div>
            </div>
          </section>

          <section class="gd-reflect-wrap">
            <div class="gd-reflect-title">ทบทวนหลังเล่น</div>
            <div class="gd-reflect-sub">ตอบสั้น ๆ 3 ข้อ เพื่อดูว่าเราเข้าใจภารกิจนี้แค่ไหน</div>

            <div class="gd-reflect-list">
              <div class="gd-reflect-card">
                <div class="gd-reflect-q">1) เริ่มสืบคดีควรใช้อุปกรณ์อะไรเป็นอย่างแรก</div>
                <div class="gd-reflect-opts" id="gdRQ1"></div>
                <div class="gd-reflect-fb" id="gdRF1">ยังไม่ได้เลือก</div>
              </div>

              <div class="gd-reflect-card">
                <div class="gd-reflect-q" id="gdRQ2Title">2) จุดไหนควรระวังเป็นพิเศษ</div>
                <div class="gd-reflect-opts" id="gdRQ2"></div>
                <div class="gd-reflect-fb" id="gdRF2">ยังไม่ได้เลือก</div>
              </div>

              <div class="gd-reflect-card">
                <div class="gd-reflect-q">3) เมื่อไรจึงควรสรุปคดี</div>
                <div class="gd-reflect-opts" id="gdRQ3"></div>
                <div class="gd-reflect-fb" id="gdRF3">ยังไม่ได้เลือก</div>
              </div>
            </div>

            <div class="gd-reflect-footer" id="gdReflectFooter">ตอบครบแล้ว 0/3 ข้อ</div>
          </section>
        </div>

        <footer class="gd-modal__foot">
          <button class="btn" id="gdBtnPlayAgain" type="button">เล่นอีกครั้ง</button>
          <button class="btn" id="gdBtnCopySummary" type="button">คัดลอกสรุป</button>
          <button class="btn warn" id="gdBtnCooldown" type="button">พักหลังเล่น</button>
          <button class="btn good" id="gdBtnBackHub" type="button">กลับหน้าแรก</button>
        </footer>
      </section>
    </div>
  `;
  document.body.appendChild(wrap.firstElementChild);
}

export function openResult(){
  const m = document.getElementById('gdResultModal');
  if(!m) return;
  m.hidden = false;
  m.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

export function closeResult(){
  const m = document.getElementById('gdResultModal');
  if(!m) return;
  m.hidden = true;
  m.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function pill(label, tier){
  const d = document.createElement('div');
  d.className = `gd-badge-pill ${tier || ''}`.trim();
  d.textContent = label;
  return d;
}

function sceneLabel(scene){
  if(scene === 'home') return 'บ้าน';
  if(scene === 'canteen') return 'โรงอาหาร';
  return 'ห้องเรียน';
}

function difficultyLabel(diff){
  if(diff === 'easy') return 'ระดับง่าย';
  if(diff === 'hard') return 'ระดับยาก';
  return 'ระดับปกติ';
}

function computeBadges(summary = {}, P = {}){
  const badges = [];
  const total = Number(summary.scoreFinal ?? summary.score ?? 0);
  const stars = Number(summary.stars || 0);
  const risk = Number(summary.areaRisk || 100);
  const found = Number(summary.criticalFound || 0);
  const totalCritical = Number(summary.criticalTotal || 0);
  const evidence = Number(summary.evidenceCount || 0);
  const wrongTool = Number(summary.metrics?.wrongTool || 0);

  if(total >= 170) badges.push({ label:'🕵️ นักสืบยอดเยี่ยม', tier:'epic' });
  if(stars >= 4) badges.push({ label:'⭐ ดาวเด่นของภารกิจ', tier:'rare' });
  if(risk <= 25) badges.push({ label:'📉 ลดความเสี่ยงเก่งมาก', tier:'rare' });
  if(totalCritical > 0 && found >= totalCritical) badges.push({ label:'🎯 เจอจุดเสี่ยงหลักครบ', tier:'' });
  if(evidence >= 4) badges.push({ label:'📸 นักเก็บหลักฐาน', tier:'' });
  if(wrongTool <= 2) badges.push({ label:'🧠 ใช้อุปกรณ์เป็น', tier:'' });
  if(P.run === 'research') badges.push({ label:'🧪 รอบวิจัย', tier:'' });

  return badges;
}

function makeReflectBtn(text, onClick){
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'gd-reflect-opt';
  btn.textContent = text;
  btn.onclick = onClick;
  return btn;
}

function sceneRiskChoices(scene){
  if(scene === 'home'){
    return {
      title:'2) จุดไหนควรระวังเป็นพิเศษในบ้าน',
      options:['ลูกบิดห้องนอน','รีโมตทีวี','ก๊อกน้ำล้างมือ','โต๊ะกินข้าว'],
      answer:'ก๊อกน้ำล้างมือ'
    };
  }

  if(scene === 'canteen'){
    return {
      title:'2) จุดไหนควรระวังเป็นพิเศษในโรงอาหาร',
      options:['ถาดอาหาร','ช้อนกลาง','ราวคิวรับอาหาร','โต๊ะรวม'],
      answer:'ช้อนกลาง'
    };
  }

  return {
    title:'2) จุดไหนควรระวังเป็นพิเศษในห้องเรียน',
    options:['ลูกบิดประตู','โต๊ะนักเรียน','ก๊อกน้ำ','ราวบันได'],
    answer:'ลูกบิดประตู'
  };
}

function setReflectResult(groupEl, feedbackEl, selectedValue, correctValue, explainGood, explainWarn){
  const buttons = groupEl.querySelectorAll('.gd-reflect-opt');
  buttons.forEach(btn=>{
    const v = btn.textContent;
    btn.classList.remove('selected', 'correct', 'wrong');

    if(v === selectedValue){
      btn.classList.add('selected');
      if(v === correctValue) btn.classList.add('correct');
      else btn.classList.add('wrong');
    }
  });

  feedbackEl.classList.remove('good', 'warn');

  if(selectedValue == null){
    feedbackEl.textContent = 'ยังไม่ได้เลือก';
    return;
  }

  if(selectedValue === correctValue){
    feedbackEl.textContent = explainGood;
    feedbackEl.classList.add('good');
  } else {
    feedbackEl.textContent = `${explainWarn} คำตอบที่เหมาะที่สุดคือ “${correctValue}”`;
    feedbackEl.classList.add('warn');
  }
}

function renderReflection(P, onChange){
  const state = { q1:null, q2:null, q3:null };

  const rq1 = document.getElementById('gdRQ1');
  const rq2 = document.getElementById('gdRQ2');
  const rq3 = document.getElementById('gdRQ3');
  const rf1 = document.getElementById('gdRF1');
  const rf2 = document.getElementById('gdRF2');
  const rf3 = document.getElementById('gdRF3');
  const rq2Title = document.getElementById('gdRQ2Title');
  const footer = document.getElementById('gdReflectFooter');

  const q2Scene = sceneRiskChoices(P.scene);
  rq2Title.textContent = q2Scene.title;

  rq1.innerHTML = '';
  rq2.innerHTML = '';
  rq3.innerHTML = '';

  rf1.textContent = 'ยังไม่ได้เลือก';
  rf2.textContent = 'ยังไม่ได้เลือก';
  rf3.textContent = 'ยังไม่ได้เลือก';
  rf1.className = 'gd-reflect-fb';
  rf2.className = 'gd-reflect-fb';
  rf3.className = 'gd-reflect-fb';

  function syncFooter(){
    const done = [state.q1, state.q2, state.q3].filter(Boolean).length;
    footer.textContent = `ตอบครบแล้ว ${done}/3 ข้อ`;
    if(done === 3){
      footer.textContent = 'ตอบครบแล้ว 3/3 ข้อ • เยี่ยมมาก! คุณทบทวนภารกิจเสร็จแล้ว';
    }
    if(typeof onChange === 'function'){
      onChange(Object.assign({}, state));
    }
  }

  ['ไฟ UV','ไม้เก็บตัวอย่าง','ทำความสะอาด'].forEach(opt=>{
    rq1.appendChild(makeReflectBtn(opt, ()=>{
      state.q1 = opt;
      setReflectResult(
        rq1, rf1, opt, 'ไฟ UV',
        'ถูกต้อง! เราควรเริ่มจากการหาแหล่งเสี่ยงก่อน',
        'ลองนึกถึงขั้นแรกของเกมนะ'
      );
      syncFooter();
    }));
  });

  q2Scene.options.forEach(opt=>{
    rq2.appendChild(makeReflectBtn(opt, ()=>{
      state.q2 = opt;
      setReflectResult(
        rq2, rf2, opt, q2Scene.answer,
        'ดีมาก! จุดนี้เป็นจุดสัมผัสร่วมที่ควรระวังเป็นพิเศษ',
        'ลองคิดถึงจุดที่คนแตะหรือใช้ร่วมกันบ่อยที่สุดนะ'
      );
      syncFooter();
    }));
  });

  [
    'เมื่อเจอจุดเสี่ยงแล้วทันที',
    'เมื่อเก็บหลักฐานและลดความเสี่ยงแล้ว',
    'เมื่อเวลาใกล้หมด'
  ].forEach(opt=>{
    rq3.appendChild(makeReflectBtn(opt, ()=>{
      state.q3 = opt;
      setReflectResult(
        rq3, rf3, opt, 'เมื่อเก็บหลักฐานและลดความเสี่ยงแล้ว',
        'ถูกต้อง! ต้องหาให้ชัดและลดความเสี่ยงก่อนสรุปคดี',
        'ลองนึกถึงลำดับเล่นของเกมอีกครั้ง'
      );
      syncFooter();
    }));
  });

  syncFooter();
  return state;
}

export function renderResult(ctx){
  const {
    P = {},
    summary = {},
    hubURL = ()=> '../hub.html',
    cooldownURL = ()=> '../warmup-gate.html?phase=cooldown',
    onReflectionChange
  } = ctx || {};

  const set = (id, val)=>{
    const e = document.getElementById(id);
    if(e) e.textContent = (val == null ? '-' : String(val));
  };

  const score = Number(summary.scoreFinal ?? summary.score ?? 0);
  const stars = Number(summary.stars || 0);
  const risk = Number(summary.areaRisk || 0);
  const riskDown = Math.max(0, 100 - risk);

  set('gdResultSubline',
    `${sceneLabel(P.scene)} • ${difficultyLabel(P.diff)} • ${P.run === 'research' ? 'รอบวิจัย' : 'รอบเล่น'} • ผู้เล่น ${esc(P.pid || '1')}`
  );
  set('gdResultRank', `ระดับ ${summary.rank || '-'}`);
  set('gdScoreTotal', score);
  set('gdScoreStars', stars);
  set('gdRiskRemain', `${risk}%`);
  set('gdRiskDown', `${riskDown}%`);
  set('gdCritical', `${Number(summary.criticalFound || 0)}/${Number(summary.criticalTotal || 0)}`);
  set('gdEvidence', Number(summary.evidenceCount || 0));
  set('gdCleaned', Number(summary.cleanedCount || 0));
  set('gdTimeLeft', `${Number(summary.timeLeft || 0)} วิ`);

  const badges = computeBadges(summary, P);
  set('gdResultBadgeMeta', `${badges.length} ป้ายรางวัล`);

  const box = document.getElementById('gdResultBadges');
  if(box){
    box.innerHTML = '';
    badges.forEach(b => box.appendChild(pill(b.label, b.tier)));
  }

  const reflectionState = renderReflection(P, onReflectionChange);

  const closeBtn = document.getElementById('gdResultCloseBtn');
  const backBtn = document.getElementById('gdBtnBackHub');
  const cdBtn = document.getElementById('gdBtnCooldown');
  const replayBtn = document.getElementById('gdBtnPlayAgain');
  const copyBtn = document.getElementById('gdBtnCopySummary');

  if(closeBtn) closeBtn.onclick = closeResult;
  if(backBtn) backBtn.onclick = ()=> { location.href = hubURL(); };
  if(cdBtn) cdBtn.onclick = ()=> { location.href = cooldownURL(); };
  if(replayBtn){
    replayBtn.onclick = ()=>{
      const u = new URL(location.href);
      if(P.run !== 'research') u.searchParams.set('seed', String(Date.now()));
      location.href = u.pathname + u.search;
    };
  }

  if(copyBtn){
    copyBtn.onclick = async ()=>{
      const txt = [
        'Germ Detective Summary',
        `Scene: ${sceneLabel(P.scene)} | Diff: ${difficultyLabel(P.diff)} | Run: ${P.run || 'play'}`,
        `Score: ${score} | Rank: ${summary.rank || '-'}`,
        `Stars: ${stars} | Risk Left: ${risk}%`,
        `Critical: ${Number(summary.criticalFound || 0)}/${Number(summary.criticalTotal || 0)}`,
        `Evidence: ${Number(summary.evidenceCount || 0)} | Cleaned: ${Number(summary.cleanedCount || 0)}`,
        `Reflection: ${JSON.stringify(reflectionState)}`
      ].join('\n');

      try{ await navigator.clipboard.writeText(txt); }catch{}
    };
  }

  const modal = document.getElementById('gdResultModal');
  if(modal){
    modal.onclick = (ev)=>{
      if(ev.target?.dataset?.close === '1') closeResult();
    };
  }

  openResult();
}