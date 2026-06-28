/* UX Quest • Mission Engine v1
   A reusable, low-pressure case game engine for Act I.
*/
(() => {
  'use strict';

  const esc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const shuffle = (items) => {
    const out = Array.from(items || []);
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  const starsText = (n) => '★'.repeat(Math.max(0, n)) + '☆'.repeat(Math.max(0, 3 - n));
  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.max(0, seconds % 60);
    return `${min}:${String(sec).padStart(2, '0')}`;
  };

  function ensureStyle(){
    if (document.getElementById('uxq-mission-engine-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-mission-engine-style';
    style.textContent = `
      :root{--uxq-bg:#071124;--uxq-surface:#111f3d;--uxq-surface2:#172b51;--uxq-ink:#edf6ff;--uxq-muted:#a8b8d8;--uxq-line:rgba(181,205,255,.19);--uxq-accent:#6ee7ff;--uxq-accent2:#9b8cff;--uxq-good:#77e9a4;--uxq-warn:#ffd166;--uxq-bad:#ff97a6;--uxq-shadow:0 18px 44px rgba(0,0,0,.28)}
      *{box-sizing:border-box} body{margin:0;background:radial-gradient(circle at 12% 5%,#183764 0,transparent 28rem),radial-gradient(circle at 90% 15%,#31275e 0,transparent 26rem),var(--uxq-bg);color:var(--uxq-ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh}
      button,a{font:inherit} button{cursor:pointer}.uxq-shell{max-width:1080px;margin:0 auto;padding:20px 18px 52px}.uxq-top{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:18px}.uxq-brand{display:flex;gap:10px;align-items:center;color:var(--uxq-ink);text-decoration:none;font-weight:850;letter-spacing:.01em}.uxq-brand__mark{display:grid;place-items:center;width:38px;height:38px;border:1px solid rgba(110,231,255,.6);border-radius:12px;background:linear-gradient(145deg,rgba(110,231,255,.2),rgba(155,140,255,.24));color:#fff}.uxq-mission-tag{font-size:.75rem;letter-spacing:.12em;font-weight:800;color:var(--uxq-accent);text-transform:uppercase}.uxq-top__right{display:flex;gap:10px;align-items:center}.uxq-mini-score{font-size:.82rem;color:var(--uxq-muted);border:1px solid var(--uxq-line);padding:8px 10px;border-radius:999px;background:rgba(7,17,36,.44)}
      .uxq-panel{background:linear-gradient(160deg,rgba(23,43,81,.94),rgba(10,23,49,.95));border:1px solid var(--uxq-line);border-radius:24px;box-shadow:var(--uxq-shadow);overflow:hidden}.uxq-hero{padding:clamp(25px,6vw,62px);min-height:600px;display:grid;align-content:center;gap:22px}.uxq-kicker{color:var(--uxq-accent);font-weight:850;letter-spacing:.12em;font-size:.78rem;text-transform:uppercase;margin:0}.uxq-title{font-size:clamp(2rem,5vw,4.25rem);line-height:.98;letter-spacing:-.045em;margin:0;max-width:760px}.uxq-lede{font-size:clamp(1rem,1.5vw,1.18rem);line-height:1.72;color:var(--uxq-muted);margin:0;max-width:730px}.uxq-brief-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:3px}.uxq-brief{padding:15px;border:1px solid var(--uxq-line);background:rgba(5,15,36,.36);border-radius:16px}.uxq-brief b{display:block;color:#fff;margin-bottom:5px;font-size:.92rem}.uxq-brief span{display:block;color:var(--uxq-muted);font-size:.86rem;line-height:1.48}.uxq-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:5px}.uxq-btn{border:0;border-radius:13px;padding:13px 17px;color:#071124;background:var(--uxq-accent);font-weight:900;box-shadow:0 10px 28px rgba(110,231,255,.18);text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px}.uxq-btn:hover{filter:brightness(1.06);transform:translateY(-1px)}.uxq-btn--ghost{background:transparent;color:var(--uxq-ink);border:1px solid var(--uxq-line);box-shadow:none}.uxq-btn--warn{background:var(--uxq-warn);color:#352700}.uxq-small-note{font-size:.85rem;color:var(--uxq-muted);line-height:1.5;margin:0}.uxq-lock{border-color:rgba(255,209,102,.45);background:linear-gradient(160deg,rgba(61,47,28,.55),rgba(15,24,45,.95))}
      .uxq-hud{display:grid;grid-template-columns:minmax(0,1.5fr) repeat(3,minmax(100px,.45fr));gap:10px;padding:14px;border-bottom:1px solid var(--uxq-line);background:rgba(4,14,31,.42)}.uxq-meter{border:1px solid var(--uxq-line);background:rgba(11,26,54,.65);border-radius:14px;padding:10px 12px;min-height:59px}.uxq-meter small{display:block;color:var(--uxq-muted);font-weight:750;font-size:.69rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}.uxq-meter b{font-size:.98rem}.uxq-progressline{height:7px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden;margin-top:8px}.uxq-progressline i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--uxq-accent),var(--uxq-accent2));border-radius:inherit;transition:width .28s ease}
      .uxq-game{padding:clamp(18px,4vw,36px)}.uxq-casebar{display:flex;justify-content:space-between;align-items:start;gap:12px;margin-bottom:16px}.uxq-casebar__label{color:var(--uxq-accent);font-weight:850;font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;margin:0 0 6px}.uxq-casebar h1{font-size:clamp(1.3rem,3vw,2.05rem);line-height:1.08;margin:0;letter-spacing:-.025em}.uxq-stage{flex:0 0 auto;border:1px solid rgba(110,231,255,.4);padding:7px 10px;border-radius:999px;color:var(--uxq-accent);font-size:.78rem;font-weight:850}.uxq-context{display:grid;grid-template-columns:1.1fr .9fr;gap:12px;margin-bottom:18px}.uxq-context__card{border-radius:17px;background:rgba(6,18,40,.48);border:1px solid var(--uxq-line);padding:14px}.uxq-context__card b{color:var(--uxq-accent);font-size:.78rem;letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:5px}.uxq-context__card p{margin:0;color:var(--uxq-muted);line-height:1.58;font-size:.92rem}.uxq-question{border-radius:20px;border:1px solid rgba(197,215,255,.2);background:linear-gradient(150deg,rgba(22,44,85,.78),rgba(9,22,49,.92));padding:clamp(18px,3vw,28px)}.uxq-question__prompt{margin:0;font-size:clamp(1.15rem,2.4vw,1.54rem);letter-spacing:-.02em;line-height:1.32}.uxq-question__instruction{margin:9px 0 0;color:var(--uxq-muted);font-size:.92rem;line-height:1.55}.uxq-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:20px}.uxq-option{min-height:116px;text-align:left;border:1px solid var(--uxq-line);border-radius:15px;padding:14px;background:rgba(5,15,35,.42);color:var(--uxq-ink);transition:transform .16s ease,border-color .16s ease,background .16s ease}.uxq-option:hover:not(:disabled){transform:translateY(-2px);border-color:rgba(110,231,255,.78);background:rgba(20,50,91,.76)}.uxq-option b{display:block;line-height:1.35;font-size:.98rem;margin-bottom:6px}.uxq-option span{display:block;color:var(--uxq-muted);line-height:1.45;font-size:.84rem}.uxq-option.is-selected{border-color:var(--uxq-warn);background:rgba(255,209,102,.10)}.uxq-option.is-correct{border-color:var(--uxq-good);background:rgba(119,233,164,.12)}.uxq-option.is-wrong{border-color:var(--uxq-bad);background:rgba(255,151,166,.10)}.uxq-option:disabled{cursor:default}.uxq-utility{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:16px}.uxq-hint{padding:10px 12px;border-radius:12px;border:1px dashed rgba(255,209,102,.62);background:rgba(255,209,102,.08);color:#ffdfa0;line-height:1.52;font-size:.9rem;flex:1}.uxq-hint button{border:0;border-radius:10px;background:rgba(255,209,102,.95);color:#3c2a00;font-weight:850;padding:9px 11px;white-space:nowrap}.uxq-feedback{margin-top:16px;padding:15px;border-radius:15px;border:1px solid var(--uxq-line);background:rgba(5,15,35,.55);animation:uxq-rise .24s ease}.uxq-feedback--good{border-color:rgba(119,233,164,.62);background:rgba(39,112,77,.15)}.uxq-feedback--bad{border-color:rgba(255,151,166,.62);background:rgba(144,50,70,.14)}.uxq-feedback h3{margin:0 0 6px;font-size:1.02rem}.uxq-feedback p{margin:0;color:#d4e0fa;line-height:1.6;font-size:.92rem}.uxq-feedback__next{margin-top:12px}.uxq-results{padding:clamp(24px,5vw,58px);text-align:center;min-height:630px;display:grid;align-content:center;justify-items:center;gap:18px}.uxq-results__stars{font-size:clamp(2.4rem,7vw,5rem);letter-spacing:.06em;color:var(--uxq-warn);text-shadow:0 7px 30px rgba(255,209,102,.16)}.uxq-results h1{margin:0;font-size:clamp(1.8rem,4vw,3rem);letter-spacing:-.04em}.uxq-results p{max-width:700px;margin:0;color:var(--uxq-muted);line-height:1.64}.uxq-result-grid{width:min(700px,100%);display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.uxq-result-grid div{padding:14px 9px;border-radius:15px;border:1px solid var(--uxq-line);background:rgba(5,15,35,.42)}.uxq-result-grid b{display:block;font-size:1.16rem;margin-bottom:4px}.uxq-result-grid span{font-size:.74rem;color:var(--uxq-muted);font-weight:760;text-transform:uppercase;letter-spacing:.06em}.uxq-takeaway{width:min(700px,100%);text-align:left;border-radius:16px;background:rgba(110,231,255,.07);border:1px solid rgba(110,231,255,.25);padding:14px 16px}.uxq-takeaway b{display:block;color:var(--uxq-accent);margin-bottom:8px}.uxq-takeaway ul{margin:0;padding-left:20px;color:#d4e0fa;line-height:1.68;font-size:.91rem}.uxq-footer-note{text-align:center;color:var(--uxq-muted);font-size:.78rem;margin:14px 0 0}.uxq-hidden{display:none}@keyframes uxq-rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
      @media(max-width:760px){.uxq-shell{padding:14px 12px 34px}.uxq-top{align-items:flex-start}.uxq-mini-score{display:none}.uxq-hero{min-height:calc(100vh - 68px);padding:30px 22px}.uxq-brief-grid,.uxq-context,.uxq-options{grid-template-columns:1fr}.uxq-hud{grid-template-columns:1fr 1fr}.uxq-hud .uxq-meter:first-child{grid-column:1/-1}.uxq-casebar{align-items:flex-start}.uxq-casebar h1{font-size:1.35rem}.uxq-stage{font-size:.7rem}.uxq-utility{align-items:stretch;flex-direction:column}.uxq-hint{display:flex;align-items:center;justify-content:space-between;gap:10px}.uxq-result-grid{grid-template-columns:repeat(2,1fr)}.uxq-top__right{margin-top:3px}.uxq-top__right .uxq-btn{padding:9px 10px;font-size:.82rem}}
    `;
    document.head.appendChild(style);
  }

  function init(config){
    if (!config || !config.id || !config.title) throw new Error('UXQ mission config is incomplete.');
    ensureStyle();
    const root = document.getElementById(config.rootId || 'uxqApp');
    if (!root) throw new Error('UXQ root element not found.');
    const progressApi = window.UXQProgress;
    if (!progressApi) throw new Error('Load uxq-progress-v1.js before uxq-mission-engine-v1.js.');

    const recentKey = `uxq.recent.${config.id}.v1`;
    const state = {
      run: null,
      resolved: null,
      hintShown: false,
      clock: null
    };

    function getMission(){ return progressApi.get().missions?.[config.id] || null; }
    function prerequisiteMet(){
      return !config.requires || progressApi.missionPassed(config.requires);
    }
    function getRecent(){
      try { return JSON.parse(localStorage.getItem(recentKey) || '[]'); }
      catch (error) { return []; }
    }
    function setRecent(ids){
      localStorage.setItem(recentKey, JSON.stringify(ids.slice(-5)));
    }
    function chooseCases(bank, count){
      const recent = new Set(getRecent());
      let candidates = bank.filter(item => !recent.has(item.id));
      if (candidates.length < count) candidates = bank.slice();
      const picked = shuffle(candidates).slice(0, count);
      setRecent([...getRecent(), ...picked.map(item => item.id)]);
      return picked;
    }
    function cloneQuestion(caseItem, stageKey, kind, caseNo){
      const stage = caseItem.stages?.[stageKey];
      if (!stage) throw new Error(`Missing stage ${stageKey} for ${caseItem.id}`);
      return {
        id: `${caseItem.id}-${stageKey}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        kind,
        caseNo,
        caseName: caseItem.title,
        caseTag: caseItem.tag || 'UX CASEFILE',
        service: caseItem.service,
        user: caseItem.user,
        symptom: caseItem.symptom,
        stageKey,
        stageLabel: config.stageMeta?.[stageKey]?.label || stageKey,
        stageInstruction: config.stageMeta?.[stageKey]?.instruction || '',
        prompt: stage.prompt,
        hint: stage.hint,
        options: shuffle(stage.options.map((option, index) => Object.assign({ id: `${caseItem.id}-${stageKey}-${index}` }, option)))
      };
    }
    function createRun(){
      const cases = chooseCases(config.bank, config.caseCount || 2);
      const questions = [];
      cases.forEach((item, index) => {
        (config.stages || []).forEach(stageKey => questions.push(cloneQuestion(item, stageKey, 'case', index + 1)));
      });
      if (Array.isArray(config.bossBank) && config.bossBank.length) {
        const boss = shuffle(config.bossBank).find(item => !getRecent().includes(item.id)) || shuffle(config.bossBank)[0];
        setRecent([...getRecent(), boss.id]);
        (config.bossStages || []).forEach(stageKey => questions.push(cloneQuestion(boss, stageKey, 'boss', cases.length + 1)));
      }
      return {
        questions,
        index: 0,
        score: 0,
        combo: 0,
        maxCombo: 0,
        correct: 0,
        hints: 0,
        answers: [],
        startedAt: Date.now(),
        completedAt: null
      };
    }
    function readSeconds(){
      if (!state.run) return 0;
      const end = state.run.completedAt ? new Date(state.run.completedAt).getTime() : Date.now();
      return Math.max(0, Math.round((end - state.run.startedAt) / 1000));
    }
    function stopClock(){
      if (state.clock) window.clearInterval(state.clock);
      state.clock = null;
    }
    function startClock(){
      stopClock();
      state.clock = window.setInterval(() => {
        const element = document.getElementById('uxqClock');
        if (element && state.run) element.textContent = formatTime(readSeconds());
      }, 1000);
    }
    function bestText(mission){
      if (!mission) return 'ยังไม่มีผลการเล่น';
      return `สถิติดีสุด ${mission.bestScore || 0} คะแนน • ${starsText(mission.bestStars || 0)}`;
    }
    function renderIntro(){
      stopClock();
      const mission = getMission();
      if (!prerequisiteMet()) {
        root.innerHTML = `
          <div class="uxq-shell"><div class="uxq-top"><a class="uxq-brand" href="${esc(config.hubHref || './index.html')}"><span class="uxq-brand__mark">UX</span><span>UX Quest</span></a></div>
          <section class="uxq-panel uxq-hero uxq-lock"><p class="uxq-kicker">Mission locked</p><h1 class="uxq-title">ยังต้องเก็บหลักฐานจากภารกิจก่อนหน้า</h1><p class="uxq-lede">ภารกิจนี้จะเปิดเมื่อผ่าน ${esc(config.requiresLabel || config.requires)} ที่อย่างน้อย 2★ Readiness เพื่อให้ฐานความคิดต่อเนื่อง ไม่กระโดดข้ามขั้น</p><div class="uxq-actions"><a class="uxq-btn uxq-btn--warn" href="${esc(config.hubHref || './index.html')}">กลับ Mission Control</a></div></section></div>`;
        return;
      }
      root.innerHTML = `
        <div class="uxq-shell">
          <div class="uxq-top">
            <a class="uxq-brand" href="${esc(config.hubHref || './index.html')}"><span class="uxq-brand__mark">UX</span><span>UX Quest</span></a>
            <div class="uxq-top__right"><span class="uxq-mini-score">${esc(bestText(mission))}</span><a class="uxq-btn uxq-btn--ghost" href="${esc(config.hubHref || './index.html')}">Mission Control</a></div>
          </div>
          <section class="uxq-panel uxq-hero">
            <p class="uxq-kicker">${esc(config.eyebrow || 'ACT I • HUMAN-CENTERED DESIGN')}</p>
            <h1 class="uxq-title">${esc(config.title)}</h1>
            <p class="uxq-lede">${esc(config.intro)}</p>
            <div class="uxq-brief-grid">
              <div class="uxq-brief"><b>รูปแบบ</b><span>${esc(config.format || 'คดีสุ่ม + feedback ที่อธิบายเหตุผล')}</span></div>
              <div class="uxq-brief"><b>เวลาประมาณ</b><span>${esc(config.duration || '8–10 นาที')}</span></div>
              <div class="uxq-brief"><b>ผ่านภารกิจ</b><span>${esc(config.passText || 'อย่างน้อย 2★ Readiness')}</span></div>
            </div>
            <div class="uxq-actions"><button id="uxqStart" class="uxq-btn" type="button">${esc(mission ? 'เล่นอีกครั้งด้วยคดีใหม่' : 'เริ่มภารกิจ')} <span aria-hidden="true">→</span></button><a class="uxq-btn uxq-btn--ghost" href="${esc(config.hubHref || './index.html')}">กลับ Mission Control</a></div>
            <p class="uxq-small-note">ทุกครั้งจะสลับคดี ลำดับคำถาม และตำแหน่งคำตอบ ใช้ Hint ได้โดยเสียคะแนนเล็กน้อย แต่ไม่มีการตัดสิทธิ์เมื่อพลาดคำตอบ</p>
          </section>
        </div>`;
      document.getElementById('uxqStart')?.addEventListener('click', startRun);
    }
    function renderMission(){
      const run = state.run;
      const question = run.questions[run.index];
      const resolved = state.resolved;
      const percent = ((run.index + (resolved ? 1 : 0)) / run.questions.length) * 100;
      const selected = resolved?.option;
      const stageLead = question.kind === 'boss' ? 'BOSS SIGNAL' : `CASE ${question.caseNo}`;
      root.innerHTML = `
        <div class="uxq-shell">
          <div class="uxq-top"><a class="uxq-brand" href="${esc(config.hubHref || './index.html')}"><span class="uxq-brand__mark">UX</span><span>UX Quest</span></a><div class="uxq-top__right"><span class="uxq-mission-tag">${esc(config.shortName || config.id)}</span><a class="uxq-btn uxq-btn--ghost" href="${esc(config.hubHref || './index.html')}">ออก</a></div></div>
          <section class="uxq-panel">
            <div class="uxq-hud">
              <div class="uxq-meter"><small>Mission progress</small><b>${run.index + 1}/${run.questions.length} decisions</b><div class="uxq-progressline"><i style="width:${Math.min(100, percent)}%"></i></div></div>
              <div class="uxq-meter"><small>Score</small><b>${run.score}</b></div>
              <div class="uxq-meter"><small>Focus combo</small><b>×${run.combo}</b></div>
              <div class="uxq-meter"><small>Clock</small><b id="uxqClock">${formatTime(readSeconds())}</b></div>
            </div>
            <div class="uxq-game">
              <div class="uxq-casebar"><div><p class="uxq-casebar__label">${esc(stageLead)} • ${esc(question.caseTag)}</p><h1>${esc(question.caseName)}</h1></div><span class="uxq-stage">${esc(question.stageLabel)}</span></div>
              <div class="uxq-context"><div class="uxq-context__card"><b>ผู้ใช้และบริบท</b><p>${esc(question.user)}</p></div><div class="uxq-context__card"><b>สิ่งที่เกิดขึ้น</b><p>${esc(question.symptom)}</p></div></div>
              <section class="uxq-question" aria-live="polite"><h2 class="uxq-question__prompt">${esc(question.prompt)}</h2><p class="uxq-question__instruction">${esc(question.stageInstruction)}</p>
                <div class="uxq-options">${question.options.map(option => {
                  let classes = 'uxq-option';
                  if (resolved && option.id === selected.id) classes += ' is-selected';
                  if (resolved && option.correct) classes += ' is-correct';
                  if (resolved && option.id === selected.id && !option.correct) classes += ' is-wrong';
                  return `<button class="${classes}" type="button" data-option="${esc(option.id)}" ${resolved ? 'disabled' : ''}><b>${esc(option.label)}</b><span>${esc(option.description || '')}</span></button>`;
                }).join('')}</div>
                ${!resolved ? `<div class="uxq-utility"><div class="uxq-hint">${state.hintShown ? `<span>💡 ${esc(question.hint || 'อ่านโจทย์โดยมองหาหลักฐานที่เชื่อมกับพฤติกรรมผู้ใช้')}</span>` : '<span>ติดตรงไหน? เปิด Hint ได้ 1 ครั้งต่อข้อ (−15 คะแนน)</span>'}</div>${state.hintShown ? '' : '<button id="uxqHint" class="uxq-btn uxq-btn--warn" type="button">ใช้ Hint</button>'}</div>` : ''}
                ${resolved ? `<div class="uxq-feedback ${selected.correct ? 'uxq-feedback--good' : 'uxq-feedback--bad'}"><h3>${selected.correct ? `✓ ${esc(config.correctLabel || 'ตัดสินใจได้ตรงประเด็น')}` : `↺ ${esc(config.retryLabel || 'ยังไม่ใช่หลักฐานหรือการตัดสินใจที่แข็งแรงที่สุด')}`}</h3><p>${esc(selected.rationale || '')}</p><div class="uxq-feedback__next"><button id="uxqNext" class="uxq-btn" type="button">${run.index === run.questions.length - 1 ? 'สรุปผลภารกิจ' : 'เก็บหลักฐานต่อ'} <span aria-hidden="true">→</span></button></div></div>` : ''}
              </section>
            </div>
          </section>
          <p class="uxq-footer-note">เลือกเพื่อเรียนรู้จากผลลัพธ์ ไม่ใช่เพื่อเดาคำตอบ — พลาดได้ แล้วใช้ feedback ปรับเหตุผลรอบถัดไป</p>
        </div>`;
      root.querySelectorAll('[data-option]').forEach(button => button.addEventListener('click', () => choose(button.dataset.option)));
      document.getElementById('uxqHint')?.addEventListener('click', useHint);
      document.getElementById('uxqNext')?.addEventListener('click', nextQuestion);
    }
    function startRun(){
      state.run = createRun();
      state.resolved = null;
      state.hintShown = false;
      startClock();
      renderMission();
    }
    function useHint(){
      if (!state.run || state.hintShown || state.resolved) return;
      state.hintShown = true;
      state.run.hints += 1;
      state.run.score = Math.max(0, state.run.score - 15);
      renderMission();
    }
    function choose(id){
      if (!state.run || state.resolved) return;
      const question = state.run.questions[state.run.index];
      const option = question.options.find(item => item.id === id);
      if (!option) return;
      const run = state.run;
      const elapsed = readSeconds();
      let earned = 0;
      if (option.correct) {
        run.correct += 1;
        run.combo += 1;
        run.maxCombo = Math.max(run.maxCombo, run.combo);
        earned = 80 + Math.min(45, (run.combo - 1) * 9) + (elapsed < 100 ? 10 : 0);
        run.score += earned;
      } else {
        run.combo = 0;
      }
      run.answers.push({ questionId: question.id, stageKey: question.stageKey, correct: Boolean(option.correct), selected: option.label, earned });
      state.resolved = { option, earned };
      renderMission();
    }
    function nextQuestion(){
      if (!state.run || !state.resolved) return;
      state.run.index += 1;
      state.resolved = null;
      state.hintShown = false;
      if (state.run.index >= state.run.questions.length) finishRun();
      else renderMission();
    }
    function resultBadge(run, accuracy, stars){
      if (stars === 3 && run.hints <= 1) return 'Evidence Architect';
      if (stars >= 2) return config.badge || 'Human-Centered Solver';
      if (accuracy >= 45) return 'Insight Scout';
      return 'Casefile Rookie';
    }
    function finishRun(){
      stopClock();
      const run = state.run;
      run.completedAt = new Date().toISOString();
      const total = run.questions.length;
      const accuracy = Math.round((run.correct / total) * 100);
      let stars = 0;
      if (accuracy >= (config.threeStarAccuracy || 82) && run.hints <= (config.threeStarHints || 2)) stars = 3;
      else if (accuracy >= (config.passAccuracy || 62)) stars = 2;
      else if (accuracy >= (config.oneStarAccuracy || 42)) stars = 1;
      const passed = stars >= 2;
      const badge = resultBadge(run, accuracy, stars);
      const result = { score: run.score, stars, accuracy, correct: run.correct, total, hints: run.hints, durationSec: readSeconds(), passed, badge, completedAt: run.completedAt };
      progressApi.recordMission(config.id, result);
      renderResults(result);
    }
    function renderResults(result){
      const unlock = result.passed ? (config.unlockText || 'ภารกิจถัดไปเปิดแล้วใน Mission Control') : (config.retryText || 'เล่นซ้ำด้วยคดีใหม่เพื่อเก็บหลักฐานให้ครบขึ้น');
      root.innerHTML = `
        <div class="uxq-shell"><div class="uxq-top"><a class="uxq-brand" href="${esc(config.hubHref || './index.html')}"><span class="uxq-brand__mark">UX</span><span>UX Quest</span></a><div class="uxq-top__right"><span class="uxq-mission-tag">RESULT SECURED</span></div></div>
        <section class="uxq-panel uxq-results"><p class="uxq-kicker">${result.passed ? 'MISSION CLEARED' : 'CASEFILE REVIEW'}</p><div class="uxq-results__stars">${starsText(result.stars)}</div><h1>${result.passed ? 'เก็บหลักฐานได้ถึงระดับ Readiness แล้ว!' : 'คุณเริ่มเห็น pattern แล้ว — ลองอีกคดีเพื่อยืนยันเหตุผล'}</h1><p>${esc(unlock)}</p>
        <div class="uxq-result-grid"><div><b>${result.score}</b><span>score</span></div><div><b>${result.accuracy}%</b><span>accuracy</span></div><div><b>${result.correct}/${result.total}</b><span>evidence calls</span></div><div><b>×${state.run.maxCombo}</b><span>best combo</span></div></div>
        <div class="uxq-takeaway"><b>Badge unlocked: ${esc(result.badge)}</b><ul>${(config.takeaways || []).map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>
        <div class="uxq-actions"><button id="uxqReplay" class="uxq-btn" type="button">เล่นอีกครั้งด้วยคดีใหม่</button>${result.passed && config.nextHref ? `<a class="uxq-btn uxq-btn--ghost" href="${esc(config.nextHref)}">${esc(config.nextLabel || 'ไปภารกิจถัดไป')} →</a>` : ''}<a class="uxq-btn uxq-btn--ghost" href="${esc(config.hubHref || './index.html')}">Mission Control</a></div></section></div>`;
      document.getElementById('uxqReplay')?.addEventListener('click', startRun);
    }

    renderIntro();
    return Object.freeze({ startRun, renderIntro });
  }

  window.UXQMissionEngine = Object.freeze({ init });
})();
