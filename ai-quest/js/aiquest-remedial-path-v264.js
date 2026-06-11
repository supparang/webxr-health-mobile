/*
  CSAI2102 AI Quest
  PATCH v2.6.4 Remedial Anti-repeat + Optional Review
  ------------------------------------------------------------
  Fixes v2.6.3 problem:
  - micro drill could draw several variants from the same family
  - students saw repeated misconception prompts (e.g., robot_only) in one drill
  - Pre-S3 review should be optional/compact when the learner is already ready
*/
(function(){
  'use strict';

  const VERSION = 'v2.6.4-remedial-antirepeat';
  const STATE_KEY = 'CSAI2102_AIQUEST_PRES3_REMEDIAL_V264';
  const RECENT_KEY = 'CSAI2102_AIQUEST_PRES3_RECENT_FAMILIES_V264';

  function qs(){ return new URLSearchParams(location.search); }

  function isTeacherMode(){
    const p = qs();
    return p.get('teacher') === '1' || p.get('admin') === '1' || p.get('mode') === 'teacher' || p.get('view') === 'teacher';
  }

  function $(selector){ return document.querySelector(selector); }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function shuffle(array){
    const a = array.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  function readJson(key, fallback){
    try{ return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(error){ return fallback; }
  }

  function saveJson(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(error){}
  }

  function getProfile(){
    try{
      return window.AIQuestStorage && AIQuestStorage.getProfile ? AIQuestStorage.getProfile() : {};
    }catch(error){
      return {};
    }
  }

  function profileKey(){
    const p = getProfile();
    return String((p.studentId || 'anon') + '_' + (p.section || '101')).replace(/[^\w-]/g,'_');
  }

  function readRecentFamilies(track){
    const all = readJson(RECENT_KEY, {});
    const key = profileKey();
    return (all[key] && Array.isArray(all[key][track])) ? all[key][track] : [];
  }

  function writeRecentFamilies(track, families){
    const all = readJson(RECENT_KEY, {});
    const key = profileKey();
    if(!all[key]) all[key] = {};
    const prev = Array.isArray(all[key][track]) ? all[key][track] : [];
    all[key][track] = families.concat(prev).filter(Boolean).slice(0, 24);
    saveJson(RECENT_KEY, all);
  }

  function familyOf(item){
    return String(item.familyId || item.key || item.id || '').trim();
  }

  function uniqueByFamily(items, limit, track){
    const recent = new Set(readRecentFamilies(track).slice(0, 16));
    const used = new Set();
    const result = [];

    const pool = shuffle(items || []);

    function pass(filterFn){
      pool.forEach(item => {
        if(result.length >= limit) return;
        const fam = familyOf(item);
        if(!fam || used.has(fam)) return;
        if(filterFn && !filterFn(item, fam)) return;
        used.add(fam);
        result.push(item);
      });
    }

    // 1) strong: new family, not recent
    pass((item, fam) => !recent.has(fam));

    // 2) fallback: allow recent but still one per family
    pass(() => true);

    // 3) last fallback: if families are too few, allow item-level variety
    if(result.length < limit){
      pool.forEach(item => {
        if(result.length >= limit) return;
        if(result.some(x => x.id === item.id)) return;
        result.push(item);
      });
    }

    writeRecentFamilies(track, result.map(familyOf));
    return result.slice(0, limit);
  }

  function getWeakKeys(){
    const keys = [];
    [
      'CSAI2102_AIQUEST_S2_WEAK_MIS_V256',
      'CSAI2102_AIQUEST_S2_WEAK_MIS_V258',
      'CSAI2102_AIQUEST_S2_WEAK_MIS_V259'
    ].forEach(key => {
      try{
        const obj = JSON.parse(localStorage.getItem(key) || '{}');
        Object.entries(obj.mis || {})
          .sort((a,b)=>Number(b[1])-Number(a[1]))
          .forEach(pair => {
            if(pair[0] && !keys.includes(pair[0])) keys.push(pair[0]);
          });
      }catch(error){}
    });

    return keys.slice(0, 6);
  }

  function injectStyle(){
    if($('#aiquestRemedialPathStyle')) return;

    const style = document.createElement('style');
    style.id = 'aiquestRemedialPathStyle';
    style.textContent = `
      .remedialPanel{
        border:1px solid rgba(56,189,248,.24);
        background:linear-gradient(135deg,rgba(15,23,42,.92),rgba(30,41,59,.90));
        border-radius:28px;
        padding:18px;
        margin:16px 0;
        box-shadow:0 20px 70px rgba(0,0,0,.22);
      }

      .remedialPanel.compact .remedialGrid,
      .remedialPanel.compact #remedialMiniHost,
      .remedialPanel.compact .remedialRow.optionalActions,
      .remedialPanel.compact .remedialSub.weakLine{
        display:none;
      }

      .remedialHeader{
        display:flex;
        justify-content:space-between;
        gap:14px;
        align-items:flex-start;
        flex-wrap:wrap;
      }

      .remedialTitle{
        font-size:clamp(20px,2.2vw,28px);
        font-weight:1000;
        margin:0;
      }

      .remedialSub{
        color:var(--muted,#94a3b8);
        margin-top:4px;
        line-height:1.55;
      }

      .remedialBadge{
        border-radius:999px;
        padding:9px 12px;
        font-weight:1000;
        border:1px solid rgba(52,211,153,.35);
        background:rgba(52,211,153,.10);
        color:#bbf7d0;
      }

      .remedialToggle{
        border:1px solid rgba(255,255,255,.16);
        background:rgba(255,255,255,.08);
        color:var(--text,#e2e8f0);
        border-radius:999px;
        padding:9px 12px;
        font-weight:900;
        cursor:pointer;
      }

      .remedialGrid{
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:12px;
        margin-top:14px;
      }

      .remedialCard{
        border:1px solid rgba(255,255,255,.12);
        border-radius:20px;
        background:rgba(255,255,255,.055);
        padding:14px;
        min-height:150px;
      }

      .remedialCard h3{
        margin:0 0 7px;
        font-size:18px;
      }

      .remedialCard p{
        margin:0 0 12px;
        color:var(--muted,#94a3b8);
        line-height:1.5;
      }

      .remedialMini{
        margin-top:14px;
        border:1px solid rgba(255,255,255,.12);
        border-radius:22px;
        padding:14px;
        background:rgba(15,23,42,.58);
      }

      .remedialChoice{
        width:100%;
        display:block;
        margin-top:8px;
        text-align:left;
        border-radius:16px;
        border:1px solid rgba(255,255,255,.15);
        background:rgba(255,255,255,.07);
        color:var(--text,#e2e8f0);
        padding:12px;
        font-weight:800;
        cursor:pointer;
      }

      .remedialChoice:hover{filter:brightness(1.08)}
      .remedialChoice.correct{border-color:rgba(52,211,153,.7);background:rgba(52,211,153,.14)}
      .remedialChoice.wrong{border-color:rgba(251,113,133,.7);background:rgba(251,113,133,.13)}

      .remedialFeedback{
        margin-top:12px;
        border-radius:16px;
        padding:12px;
        line-height:1.6;
        background:rgba(255,255,255,.07);
        border:1px solid rgba(255,255,255,.12);
      }

      .remedialRow{
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:12px;
      }

      @media(max-width:980px){.remedialGrid{grid-template-columns:1fr 1fr}}
      @media(max-width:640px){.remedialGrid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function getCompletion(){
    const all = readJson(STATE_KEY, {});
    const key = profileKey();
    if(!all[key]) all[key] = {};
    return {all, key, data:all[key]};
  }

  function markDone(track, score, total){
    const st = getCompletion();
    st.data[track] = {
      done:true,
      score:Number(score || 0),
      total:Number(total || 0),
      ts:new Date().toISOString()
    };
    st.all[st.key] = st.data;
    saveJson(STATE_KEY, st.all);
  }

  function doneCount(){
    const st = getCompletion().data || {};
    return ['automation','peas','environment','boss'].filter(k => st[k] && st[k].done).length;
  }

  function btnClass(){ return 'btn secondary'; }

  function openS2(){
    const top = document.getElementById('btnSession2Top');
    if(top){ top.click(); return; }
    const card = document.querySelector('[data-roadmap-id="s2"], [data-mission-id="m2"]');
    if(card){ card.click(); return; }
    if(window.showToast) showToast('ไปที่ Roadmap แล้วกด S2 Agent Builder');
  }

  function openBoss(){
    const card = document.querySelector('[data-roadmap-id="b1"], [data-mission-id="b1"]');
    if(card){ card.click(); return; }
    if(window.showToast) showToast('ไปที่ Roadmap แล้วกด B1 Rookie AI Boss');
  }

  function bossClaimsFor(keys, limit, track){
    const bank = window.AIQUEST_BOSS1_BANK && AIQUEST_BOSS1_BANK.BOSS1_CLAIMS ? AIQUEST_BOSS1_BANK.BOSS1_CLAIMS : [];
    let pool = [];

    if(keys && keys.length){
      pool = bank.filter(item => keys.includes(item.key));
    }

    if(pool.length < limit){
      pool = pool.concat(bank.filter(item => !pool.some(p => p.id === item.id)));
    }

    return uniqueByFamily(pool, limit, track || 'boss');
  }

  function peasItems(limit){
    const bank = window.AIQUEST_SESSION2_BANK && AIQUEST_SESSION2_BANK.PEAS_ITEMS ? AIQUEST_SESSION2_BANK.PEAS_ITEMS : [];
    return uniqueByFamily(bank, limit, 'peas');
  }

  function envItems(limit){
    const bank = window.AIQUEST_SESSION2_BANK && AIQUEST_SESSION2_BANK.ENV_ITEMS ? AIQUEST_SESSION2_BANK.ENV_ITEMS : [];
    return uniqueByFamily(bank, limit, 'environment');
  }

  function claimToQuestion(item, track){
    return {
      track,
      familyId:item.familyId || item.key,
      prompt:item.claim,
      correct:item.answer,
      why:item.why || item.hint || item.answer,
      choices:shuffle([{text:item.answer, ok:true}].concat((item.distractors || []).slice(0,3).map(d => ({text:d, ok:false}))))
    };
  }

  function makeAutomationQuestions(){
    // Intentionally exclude robot_only overload by using one-per-family picker.
    const keys = ['automation_rule','rulebased_many_rules','timer_automation','threshold_system','database_lookup','random_not_ai','sensor_agent','robot_only'];
    let questions = bossClaimsFor(keys, 6, 'automation').map(item => claimToQuestion(item, 'automation'));

    // Fallback for older bank keys
    if(questions.length < 6){
      const oldKeys = ['automation','rulebased','sensor','robot_only','calculator','threshold','database'];
      questions = bossClaimsFor(oldKeys, 6, 'automation').map(item => claimToQuestion(item, 'automation'));
    }

    return questions;
  }

  function makeBossQuestions(){
    const weak = getWeakKeys();
    return bossClaimsFor(weak.length ? weak : ['rationality','peas_swap','observable_confusion','bigdata_rational'], 6, 'boss')
      .map(item => claimToQuestion(item, 'boss'));
  }

  function makePeasQuestions(){
    return peasItems(6).map(item => {
      const choices = shuffle((item.choices || []).map(c => ({
        text:c.text,
        ok:!!c.correct,
        why:c.correct ? 'PEAS นี้แยก Performance, Environment, Actuators, Sensors ได้ถูกต้อง' : 'ยังมีการสลับ P/E/A/S หรือมองเป็น component ของระบบ'
      })));
      return {
        track:'peas',
        familyId:item.familyId,
        prompt:'เลือก PEAS ที่ถูกต้องสำหรับ: ' + (item.scenario || 'สถานการณ์นี้'),
        correct:(choices.find(c => c.ok) || {}).text || '',
        why:'PEAS ต้องแยก P=เกณฑ์สำเร็จ, E=โลก/บริบท, A=สิ่งที่ agent ทำ, S=สิ่งที่ agent รับรู้',
        choices
      };
    });
  }

  function makeEnvironmentQuestions(){
    return envItems(6).map(item => {
      const choices = shuffle((item.choices || []).map(c => ({
        text:c.text,
        ok:!!c.correct,
        why:c.correct ? 'คำอธิบาย environment สอดคล้องกับ observable/dynamic/stochastic/sequential' : 'คำตอบนี้สับสนเรื่อง observable, dynamic, stochastic หรือจำนวน agent'
      })));
      return {
        track:'environment',
        familyId:item.familyId,
        prompt:item.stem || 'เลือก environment classification ที่เหมาะสมที่สุด',
        correct:(choices.find(c => c.ok) || {}).text || '',
        why:'ให้ดูว่า agent เห็นข้อมูลครบไหม โลกเปลี่ยนไหม ผลลัพธ์แน่นอนไหม และ action ก่อนหน้าส่งผลต่ออนาคตไหม',
        choices
      };
    });
  }

  function buildQuiz(track){
    if(track === 'automation') return makeAutomationQuestions();
    if(track === 'peas') return makePeasQuestions();
    if(track === 'environment') return makeEnvironmentQuestions();
    if(track === 'boss') return makeBossQuestions();
    return [];
  }

  function trackTitle(track){
    return {
      automation:'AI vs Automation Review',
      peas:'PEAS Drill',
      environment:'Environment Drill',
      boss:'Boss Weakness Training'
    }[track] || 'Review';
  }

  function startDrill(track){
    const host = $('#remedialMiniHost');
    if(!host) return;

    const questions = buildQuiz(track);

    if(!questions.length){
      host.innerHTML = `
        <div class="remedialMini">
          <b>${escapeHtml(trackTitle(track))}</b><br>
          ยังโหลดคลังคำถามไม่ครบ กรุณาตรวจไฟล์ mission2-agent-bank หรือ boss1-rookie-bank
        </div>
      `;
      return;
    }

    let i = 0;
    let score = 0;
    let answered = false;

    function render(){
      const q = questions[i];

      if(!q){
        const pct = questions.length ? Math.round(score / questions.length * 100) : 0;
        markDone(track, score, questions.length);
        host.innerHTML = `
          <div class="remedialMini">
            <h3>${escapeHtml(trackTitle(track))} Complete</h3>
            <p>ผลลัพธ์: ${score}/${questions.length} · ${pct}%</p>
            <div class="remedialFeedback">
              ${pct >= 80 ? 'พร้อมแล้วสำหรับ S3/Boss ถัดไป' : 'ควรทำซ้ำอีก 1 รอบเพื่อปิด misconception'}
            </div>
            <div class="remedialRow">
              <button class="${btnClass()}" id="redoDrill">ทำซ้ำแบบไม่ซ้ำ family เดิม</button>
              <button class="${btnClass()}" id="goBoss">ไป B1 Boss</button>
            </div>
          </div>
        `;
        const redo = $('#redoDrill');
        if(redo) redo.onclick = () => startDrill(track);
        const goBoss = $('#goBoss');
        if(goBoss) goBoss.onclick = openBoss;
        renderPanel(false);
        return;
      }

      answered = false;

      host.innerHTML = `
        <div class="remedialMini">
          <div class="remedialSub">${escapeHtml(trackTitle(track))} · ข้อ ${i+1}/${questions.length} · family: ${escapeHtml(q.familyId || '-')}</div>
          <h3>${escapeHtml(q.prompt)}</h3>
          <div>
            ${q.choices.map((c,idx) => `<button class="remedialChoice" data-choice="${idx}">${escapeHtml(c.text)}</button>`).join('')}
          </div>
          <div id="remedialFeedback"></div>
        </div>
      `;

      host.querySelectorAll('[data-choice]').forEach(btn => {
        btn.onclick = () => {
          if(answered) return;
          answered = true;

          const c = q.choices[Number(btn.dataset.choice)];
          if(c.ok) score += 1;

          host.querySelectorAll('[data-choice]').forEach(b => {
            const cc = q.choices[Number(b.dataset.choice)];
            b.disabled = true;
            if(cc.ok) b.classList.add('correct');
          });

          if(!c.ok) btn.classList.add('wrong');

          const fb = $('#remedialFeedback');
          fb.innerHTML = `
            <div class="remedialFeedback">
              <b>${c.ok ? 'ถูกต้อง' : 'ยังไม่ใช่'}</b><br>
              <b>คำตอบที่ควรได้:</b> ${escapeHtml(q.correct)}<br>
              <b>เหตุผล:</b> ${escapeHtml(q.why || c.why || '')}
              <div class="remedialRow">
                <button class="${btnClass()}" id="nextRemedial">${i+1 >= questions.length ? 'สรุปผล' : 'ข้อถัดไป'}</button>
              </div>
            </div>
          `;

          const next = $('#nextRemedial');
          if(next) next.onclick = () => { i += 1; render(); };
        };
      });
    }

    render();
  }

  function shouldStartCompact(){
    // Compact by default to avoid wasting time when class/student is already ready.
    const p = qs();
    if(p.get('review') === '1' || p.get('remedial') === '1') return false;
    return true;
  }

  function renderPanel(keepOpen){
    if(isTeacherMode()) return;

    injectStyle();

    let panel = $('#preS3RemedialPanel');

    if(!panel){
      panel = document.createElement('section');
      panel.id = 'preS3RemedialPanel';
      panel.className = 'remedialPanel';

      const anchor = $('#sessionRoadmapPanel') || document.querySelector('#menuScreen .hero') || $('#menuScreen');
      if(anchor && anchor.parentNode){
        anchor.insertAdjacentElement(anchor.id === 'sessionRoadmapPanel' ? 'afterend' : 'afterend', panel);
      }else{
        return;
      }
    }

    const wasOpen = keepOpen || !panel.classList.contains('compact');
    const compact = keepOpen ? false : shouldStartCompact() && !wasOpen;
    panel.classList.toggle('compact', compact);

    const weak = getWeakKeys();
    const completed = doneCount();

    panel.innerHTML = `
      <div class="remedialHeader">
        <div>
          <h2 class="remedialTitle">Optional Pre-S3 Review</h2>
          <div class="remedialSub">
            ใช้ทบทวนเมื่อยังสับสน · ไม่ใช่คะแนน graded · ระบบกันซ้ำด้วย family lock
          </div>
        </div>
        <div class="remedialRow" style="margin-top:0">
          <span class="remedialBadge">Review Done ${completed}/4</span>
          <button class="remedialToggle" id="toggleRemedial">${compact ? 'เปิด Review' : 'ย่อ Review'}</button>
        </div>
      </div>

      <div class="remedialSub weakLine" style="margin-top:8px">
        Weak focus: ${weak.length ? weak.map(escapeHtml).join(', ') : 'ไม่มี weakness เฉพาะตัว — review นี้เป็น optional'}
      </div>

      <div class="remedialGrid">
        <div class="remedialCard">
          <h3>AI vs Automation</h3>
          <p>สุ่มแบบไม่ซ้ำ family ในรอบเดียว ไม่วน robot_only ซ้ำ</p>
          <button class="${btnClass()}" data-drill="automation">เริ่ม Review</button>
        </div>
        <div class="remedialCard">
          <h3>PEAS Drill</h3>
          <p>ฝึกแยก Performance / Environment / Actuator / Sensor ให้แม่น</p>
          <button class="${btnClass()}" data-drill="peas">เริ่ม PEAS</button>
        </div>
        <div class="remedialCard">
          <h3>Environment Drill</h3>
          <p>ฝึกดู observable, dynamic, stochastic, sequential, multi-agent</p>
          <button class="${btnClass()}" data-drill="environment">เริ่ม Environment</button>
        </div>
        <div class="remedialCard">
          <h3>Boss Weakness</h3>
          <p>สุ่มจาก misconception เด่น แต่ล็อก family ไม่ให้ซ้ำถี่</p>
          <button class="${btnClass()}" data-drill="boss">เริ่ม Boss Training</button>
        </div>
      </div>

      <div class="remedialRow optionalActions">
        <button class="${btnClass()}" id="goS2Review">เล่น S2 ซ้ำเพื่อ Mastery</button>
        <button class="${btnClass()}" id="goB1Review">เข้า B1 Boss</button>
      </div>

      <div id="remedialMiniHost"></div>
    `;

    const toggle = $('#toggleRemedial');
    if(toggle){
      toggle.onclick = () => {
        panel.classList.toggle('compact');
        toggle.textContent = panel.classList.contains('compact') ? 'เปิด Review' : 'ย่อ Review';
      };
    }

    panel.querySelectorAll('[data-drill]').forEach(btn => {
      btn.onclick = () => {
        panel.classList.remove('compact');
        startDrill(btn.dataset.drill);
      };
    });

    const s2 = $('#goS2Review');
    if(s2) s2.onclick = openS2;

    const b1 = $('#goB1Review');
    if(b1) b1.onclick = openBoss;
  }

  function boot(){
    if(isTeacherMode()) return;
    setTimeout(() => renderPanel(false), 250);
    setTimeout(() => renderPanel(false), 900);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.AIQuestRemedialPath = {
    VERSION,
    renderPanel,
    startDrill,
    getWeakKeys,
    reset(){
      try{
        localStorage.removeItem(STATE_KEY);
        localStorage.removeItem(RECENT_KEY);
      }catch(error){}
      renderPanel(true);
    }
  };

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
