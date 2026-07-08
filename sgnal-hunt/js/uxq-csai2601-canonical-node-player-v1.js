/* CSAI2601 UX Quest • Canonical Node Player v1
 * One safe, curriculum-locked playable layer for W1-W15 + B1-B4.
 * Reads only uxq-csai2601-canonical-content-v1.js and records progress via uxq-progress-v4.js.
 */
(() => {
  'use strict';

  const CONTENT = window.CSAI2601_UXQ_CANONICAL_CONTENT_V1;
  const root = document.getElementById('uxqCanonicalNode') || document.body;
  const params = new URLSearchParams(location.search);
  const requested = String(params.get('node') || params.get('id') || 'W1').toUpperCase();
  const node = CONTENT?.byId?.(requested) || (CONTENT?.nodes || []).find((item) => String(item.id).toUpperCase() === requested);
  const key = node ? String(node.id).toLowerCase() : '';
  const allNodes = CONTENT?.nodes || [];
  const index = node ? allNodes.findIndex((item) => String(item.id).toLowerCase() === key) : -1;
  const previous = index > 0 ? allNodes[index - 1] : null;

  const state = {
    screen: 'intro',
    caseFile: null,
    stages: [],
    current: 0,
    selected: null,
    verify: null,
    answered: false,
    correct: 0,
    verified: 0,
    wrong: 0,
    hints: 0,
    startedAt: Date.now(),
    history: []
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function shuffle(list) {
    const out = Array.from(list || []);
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value || 0))); }
  function pct(a, b) { return b ? Math.round((Number(a || 0) / Number(b || 0)) * 100) : 0; }
  function starsText(value) { const n = clamp(value, 0, 3); return `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`; }
  function fmt(seconds) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
  function progress() { return window.UXQProgress?.get?.() || { missions: {} }; }
  function missionRecord(id) { return progress().missions?.[String(id || '').toLowerCase()] || {}; }
  function passed(id) { return Number(missionRecord(id).bestStars || 0) >= 2; }
  function canPlay() { return !previous || passed(previous.id); }

  function urlForNode(id) { return `./csai2601-canonical-node.html?node=${encodeURIComponent(String(id || '').toUpperCase())}`; }
  function missionControlUrl() { return './csai2601-mission-control.html?v=canonical-node-v1'; }

  function recentKey() { return `csai2601.uxq.canonical.recent.${key}.v1`; }
  function readRecent() { try { return JSON.parse(localStorage.getItem(recentKey()) || '[]'); } catch (error) { return []; } }
  function writeRecent(id) {
    try {
      const recent = readRecent().filter((item) => item !== id);
      recent.unshift(id);
      localStorage.setItem(recentKey(), JSON.stringify(recent.slice(0, 6)));
    } catch (error) {}
  }

  function pickCase() {
    const bank = Array.isArray(node.seedCases) && node.seedCases.length ? node.seedCases : [{ id: `${node.id}-C01`, context: node.focus || node.title }];
    const recent = new Set(readRecent());
    const fresh = bank.filter((item) => !recent.has(item.id));
    const pool = fresh.length ? fresh : bank;
    const chosen = pool[Math.floor(Math.random() * pool.length)] || pool[0];
    writeRecent(chosen.id);
    return chosen;
  }

  function correctText(round, caseFile, roundIndex) {
    const concept = node.concepts?.[roundIndex % Math.max(1, node.concepts.length)] || node.focus || 'UX evidence';
    const artifact = node.artifact || 'studio artifact';
    const context = caseFile.context || caseFile.title || node.focus || 'case';
    if (node.type === 'boss') {
      return `ใช้หลักฐานจาก ${context} เชื่อม ${concept} กับการตัดสินใจ แล้วป้องกันคำตอบด้วย ${artifact}`;
    }
    return `เริ่มจาก ${context} ระบุ ${concept} ที่กระทบ user goal แล้วเลือก fix ที่พิสูจน์ได้ใน ${artifact}`;
  }

  function distractors(round, caseFile, roundIndex) {
    const context = caseFile.context || caseFile.title || 'case';
    const misconception = caseFile.misconception || caseFile.risk || caseFile.issue || 'ตัดสินจากความรู้สึกมากกว่าหลักฐาน';
    return [
      {
        label: `เลือกหน้าจอที่ดูสวยที่สุดก่อน แล้วค่อยหาหลักฐานจาก ${context} ภายหลัง`,
        rationale: 'ลำดับนี้กลับหัว เพราะการออกแบบ UX ต้องเริ่มจาก user evidence และ task outcome ไม่ใช่ภาพสุดท้าย',
        misconception: 'aesthetic-first'
      },
      {
        label: `เพิ่มคำอธิบายให้ยาวขึ้นทุกจุดเพื่อให้ผู้ใช้เข้าใจ ${context}`, 
        rationale: 'ข้อความยาวอาจเพิ่ม cognitive load ถ้าไม่ได้แก้ hierarchy, feedback หรือ flow ที่เป็นต้นเหตุ',
        misconception: 'more-text-fix'
      },
      {
        label: `ให้ทีมเลือกทางที่ทำเร็วที่สุด แม้ยังไม่รู้ว่าแก้ ${misconception} หรือไม่`,
        rationale: 'ความเร็วของทีมไม่ใช่หลักฐานว่า user ทำงานสำเร็จขึ้น ต้องมีเกณฑ์ test หรือ validation',
        misconception: 'team-convenience'
      }
    ].map((item, idx) => ({ id: `d${roundIndex}-${idx}`, correct: false, ...item }));
  }

  function buildStage(round, caseFile, roundIndex) {
    const reason = node.reasonChecks?.[roundIndex % Math.max(1, node.reasonChecks.length)] || 'เหตุผลใดเชื่อมกับหลักฐานผู้ใช้มากที่สุด';
    const right = {
      id: `c${roundIndex}`,
      correct: true,
      label: correctText(round, caseFile, roundIndex),
      rationale: `ถูกต้อง เพราะคำตอบนี้เชื่อม user evidence → concept → decision → proof และส่งต่อเป็น ${node.artifact || 'artifact'} ได้`,
      misconception: ''
    };
    return {
      id: `${key}-stage-${roundIndex + 1}`,
      round,
      prompt: node.type === 'boss'
        ? `Boss Round ${roundIndex + 1}: ${round} — ในคดีนี้ควรตัดสินใจอย่างไรให้ป้องกันด้วยหลักฐานได้`
        : `Mission Round ${roundIndex + 1}: ${round} — เลือกทางที่ตรงกับผู้ใช้และตรวจสอบผลได้จริง`,
      instruction: `Case: ${caseFile.context || caseFile.title || node.casePrompt || node.bossScenario || node.focus}`,
      reason,
      options: shuffle([right, ...distractors(round, caseFile, roundIndex)])
    };
  }

  function makeRun() {
    const caseFile = pickCase();
    const rounds = Array.isArray(node.missionRounds) && node.missionRounds.length
      ? node.missionRounds
      : ['Identify evidence', 'Choose decision', 'Reason check', 'Plan proof'];
    const selectedRounds = node.type === 'boss' ? rounds.slice(0, 6) : rounds.slice(0, 5);
    state.caseFile = caseFile;
    state.stages = selectedRounds.map((round, idx) => buildStage(round, caseFile, idx));
    state.current = 0;
    state.selected = null;
    state.verify = null;
    state.answered = false;
    state.correct = 0;
    state.verified = 0;
    state.wrong = 0;
    state.hints = 0;
    state.startedAt = Date.now();
    state.history = [];
  }

  function buildReasonChoices(stage) {
    const right = {
      id: 'reason-ok', correct: true,
      label: stage.reason,
      rationale: 'เหตุผลนี้บังคับให้เชื่อมหลักฐาน แนวคิด และผลต่อผู้ใช้เข้าด้วยกัน'
    };
    const wrong = [
      { id: 'reason-style', correct: false, label: 'เพราะหน้าจอดูทันสมัยและน่าจะถูกใจผู้เรียนส่วนใหญ่', rationale: 'ความชอบหรือความสวยไม่ใช่หลักฐานว่า task สำเร็จขึ้น' },
      { id: 'reason-speed', correct: false, label: 'เพราะทีมทำวิธีนี้ได้เร็วที่สุดและไม่ต้องเปลี่ยนโครงสร้างมาก', rationale: 'ความสะดวกของทีมไม่ใช่ user outcome' },
      { id: 'reason-copy', correct: false, label: 'เพราะระบบยอดนิยมหลายระบบใช้รูปแบบคล้ายกัน', rationale: 'pattern ที่นิยมต้องถูกปรับให้เข้ากับ user, task และ context ของคดีนี้' }
    ];
    return shuffle([right, ...wrong]);
  }

  function ensureStyle() {
    if (document.getElementById('csai2601-canonical-node-style')) return;
    const style = document.createElement('style');
    style.id = 'csai2601-canonical-node-style';
    style.textContent = `
      :root{--bg:#071124;--panel:#101f3d;--panel2:#172b51;--ink:#eef6ff;--muted:#a9b9d9;--line:rgba(181,205,255,.2);--cyan:#6ee7ff;--violet:#9b8cff;--good:#79eda5;--warn:#ffd166;--bad:#ff96a8;--shadow:0 22px 54px rgba(0,0,0,.32)}
      *{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 10% 8%,#1b3d70 0,transparent 28rem),radial-gradient(circle at 92% 10%,#382b72 0,transparent 26rem),var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a,button,textarea{font:inherit}.shell{width:min(1100px,100%);margin:0 auto;padding:18px 14px 48px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px}.brand{color:#fff;text-decoration:none;font-weight:950;display:flex;align-items:center;gap:10px}.mark{display:grid;place-items:center;width:38px;height:38px;border-radius:13px;border:1px solid rgba(110,231,255,.55);background:linear-gradient(145deg,rgba(110,231,255,.2),rgba(155,140,255,.22))}.pill{border:1px solid var(--line);border-radius:999px;padding:8px 10px;color:var(--muted);background:rgba(7,17,36,.45);font-size:.86rem}.panel{border:1px solid var(--line);background:linear-gradient(160deg,rgba(23,43,81,.95),rgba(8,20,45,.96));border-radius:24px;box-shadow:var(--shadow);overflow:hidden}.hero{padding:clamp(24px,5vw,56px);display:grid;gap:18px}.kicker{margin:0;color:var(--cyan);font-size:.78rem;letter-spacing:.13em;text-transform:uppercase;font-weight:950}.title{margin:0;font-size:clamp(2rem,6vw,4rem);line-height:.98;letter-spacing:-.045em}.lede{margin:0;color:var(--muted);line-height:1.7;font-size:clamp(1rem,1.6vw,1.18rem);max-width:800px}.briefs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.brief{border:1px solid var(--line);border-radius:16px;background:rgba(5,15,35,.38);padding:14px}.brief b{display:block;color:#fff;margin-bottom:4px}.brief span{display:block;color:var(--muted);line-height:1.48;font-size:.9rem}.actions{display:flex;gap:10px;flex-wrap:wrap}.btn{border:0;border-radius:13px;padding:12px 15px;background:var(--cyan);color:#071124;text-decoration:none;font-weight:950;cursor:pointer}.btn.secondary{background:transparent;color:#fff;border:1px solid var(--line)}.btn.warn{background:var(--warn);color:#352700}.lock{border-color:rgba(255,209,102,.45);background:linear-gradient(160deg,rgba(61,47,28,.55),rgba(15,24,45,.95))}.game{padding:clamp(16px,4vw,34px)}.hud{display:grid;grid-template-columns:1fr repeat(3,minmax(94px,.25fr));gap:10px;border-bottom:1px solid var(--line);padding:13px;background:rgba(4,14,31,.42)}.meter{border:1px solid var(--line);border-radius:14px;padding:10px;background:rgba(5,15,35,.46)}.meter small{display:block;color:var(--muted);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;font-weight:850}.meter b{display:block;margin-top:3px}.bar{height:7px;background:rgba(255,255,255,.1);border-radius:999px;overflow:hidden;margin-top:7px}.bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--cyan),var(--violet));border-radius:inherit;transition:width .25s}.case{display:grid;gap:8px;margin-bottom:18px}.case h1{margin:0;font-size:clamp(1.35rem,3vw,2rem);letter-spacing:-.03em}.case p{margin:0;color:var(--muted);line-height:1.6}.question{border:1px solid rgba(197,215,255,.2);border-radius:20px;background:linear-gradient(150deg,rgba(22,44,85,.78),rgba(9,22,49,.94));padding:clamp(16px,3vw,28px)}.prompt{margin:0;font-size:clamp(1.12rem,2.5vw,1.5rem);line-height:1.35}.instruction{margin:9px 0 0;color:#cfdcf4;line-height:1.55}.options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:18px}.option{text-align:left;border:1px solid var(--line);border-radius:15px;min-height:116px;padding:14px;background:rgba(5,15,35,.44);color:#fff;cursor:pointer}.option:hover:not(:disabled){border-color:rgba(110,231,255,.75);transform:translateY(-1px)}.option b{display:block;line-height:1.35}.option span{display:block;color:var(--muted);line-height:1.48;margin-top:6px;font-size:.88rem}.option.good{border-color:rgba(121,237,165,.7);background:rgba(121,237,165,.12)}.option.bad{border-color:rgba(255,150,168,.72);background:rgba(255,150,168,.1)}.option.pick{border-color:rgba(255,209,102,.75);background:rgba(255,209,102,.1)}.feedback{margin-top:15px;border:1px solid var(--line);border-radius:15px;padding:14px;background:rgba(5,15,35,.55);line-height:1.6}.feedback.good{border-color:rgba(121,237,165,.6);background:rgba(121,237,165,.1)}.feedback.bad{border-color:rgba(255,150,168,.65);background:rgba(255,150,168,.1)}.verify{margin-top:15px;border:1px solid rgba(110,231,255,.35);border-radius:18px;background:rgba(110,231,255,.07);padding:15px}.verify h3{margin:0 0 6px}.utility{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:14px}.hint{flex:1;color:#ffdfa0;border:1px dashed rgba(255,209,102,.62);background:rgba(255,209,102,.08);border-radius:13px;padding:10px;line-height:1.5}.results{padding:clamp(24px,5vw,54px);display:grid;gap:16px;text-align:center;justify-items:center}.stars{font-size:clamp(2.6rem,8vw,5rem);color:var(--warn);letter-spacing:.06em}.result-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;width:min(780px,100%)}.result-grid div{border:1px solid var(--line);border-radius:15px;background:rgba(5,15,35,.45);padding:13px}.result-grid b{display:block;font-size:1.16rem}.result-grid span{display:block;color:var(--muted);font-size:.74rem;text-transform:uppercase;font-weight:850}.artifact{width:min(820px,100%);text-align:left;border:1px solid rgba(155,140,255,.55);border-radius:18px;background:linear-gradient(145deg,rgba(54,42,112,.36),rgba(8,24,52,.70));padding:16px;display:grid;gap:10px}.artifact h2{margin:0}.artifact p{margin:0;color:#dce9ff;line-height:1.55}.artifact textarea{width:100%;min-height:76px;resize:vertical;border:1px solid rgba(181,205,255,.3);border-radius:12px;padding:10px;background:rgba(3,13,31,.5);color:#eff7ff;line-height:1.5}.takeaway{width:min(820px,100%);text-align:left;border:1px solid rgba(110,231,255,.25);border-radius:16px;background:rgba(110,231,255,.07);padding:14px}.takeaway ul{margin:8px 0 0;padding-left:20px;color:#d4e0fa;line-height:1.65}.disabled{opacity:.5;pointer-events:none}@media(max-width:760px){.shell{padding:12px 10px 32px}.top{align-items:flex-start}.briefs,.options,.hud{grid-template-columns:1fr}.result-grid{grid-template-columns:repeat(2,1fr)}.utility{flex-direction:column;align-items:stretch}.title{font-size:2.15rem}.hero{padding:26px 18px}.pill{font-size:.75rem}}
    `;
    document.head.appendChild(style);
  }

  function intro() {
    const record = missionRecord(key);
    const sample = node.seedCases?.[0] || {};
    return `<div class="shell">
      <div class="top"><a class="brand" href="${missionControlUrl()}"><span class="mark">UX</span><span>CSAI2601 UX Quest</span></a><span class="pill">${esc(CONTENT?.version || 'canonical')} • ${esc(node.id)}</span></div>
      <section class="panel ${canPlay() ? '' : 'lock'}"><div class="hero">
        <p class="kicker">${node.type === 'boss' ? 'BOSS GATE' : 'WEEKLY MISSION'} • ${esc(node.id)}</p>
        <h1 class="title">${esc(node.missionTitle || node.title)}</h1>
        <p class="lede">${esc(node.focus || '')}</p>
        <div class="briefs">
          <div class="brief"><b>Concept</b><span>${esc((node.concepts || []).slice(0, 5).join(' • ') || node.title)}</span></div>
          <div class="brief"><b>Case</b><span>${esc(node.casePrompt || node.bossScenario || sample.context || 'วิเคราะห์สถานการณ์ UX/UI จากหลักฐาน')}</span></div>
          <div class="brief"><b>Artifact</b><span>${esc(node.artifact || 'Studio artifact')}</span></div>
        </div>
        ${record.bestStars ? `<p class="lede">สถิติดีที่สุดเดิม: ${starsText(record.bestStars)} • score ${Number(record.bestScore || 0)} • เล่นซ้ำเพื่อเจอ case variant ใหม่ได้</p>` : ''}
        ${canPlay() ? `<div class="actions"><button class="btn" data-start>เริ่ม ${esc(node.id)} →</button><a class="btn secondary" href="${missionControlUrl()}">กลับ Mission Control</a></div>` : `<p class="lede">ด่านนี้ยังล็อกอยู่ ต้องผ่าน ${esc(previous?.id || 'ด่านก่อนหน้า')} ที่ 2★ ก่อน เพื่อรักษาลำดับการเรียนรู้ตามรายวิชา</p><div class="actions"><a class="btn warn" href="${urlForNode(previous?.id || 'W1')}">ไปด่านก่อนหน้า</a><a class="btn secondary" href="${missionControlUrl()}">กลับ Mission Control</a></div>`}
      </div></section>
    </div>`;
  }

  function game() {
    const stage = state.stages[state.current];
    const progressPct = pct(state.current, state.stages.length);
    return `<div class="shell">
      <div class="top"><a class="brand" href="${missionControlUrl()}"><span class="mark">UX</span><span>${esc(node.id)} • ${esc(node.missionTitle || node.title)}</span></a><span class="pill">Case ${esc(state.caseFile?.id || '')}</span></div>
      <section class="panel">
        <div class="hud"><div class="meter"><small>Progress</small><b>${state.current + 1}/${state.stages.length} • ${esc(stage.round)}</b><div class="bar"><i style="width:${progressPct}%"></i></div></div><div class="meter"><small>Correct</small><b>${state.correct}</b></div><div class="meter"><small>Reason</small><b>${state.verified}</b></div><div class="meter"><small>Hints</small><b>${state.hints}</b></div></div>
        <div class="game">
          <div class="case"><p class="kicker">${esc(node.type === 'boss' ? 'Evidence defense' : 'Decision mission')}</p><h1>${esc(stage.prompt)}</h1><p>${esc(stage.instruction)}</p></div>
          <div class="question"><p class="prompt">เลือกคำตอบที่เชื่อม user goal → friction → decision → proof ได้ดีที่สุด</p><p class="instruction">ระวังตัวลวง: ทุกข้ออาจฟังดูดีบางส่วน แต่ข้อที่ถูกต้องต้องมีหลักฐานและตรวจสอบผลได้</p>
            <div class="options">${stage.options.map((option) => `<button class="option ${state.selected === option.id ? 'pick' : ''}" data-choice="${esc(option.id)}" ${state.answered || state.verify ? 'disabled' : ''}><b>${esc(option.label)}</b><span>${esc(option.misconception ? `กับดัก: ${option.misconception}` : 'เชื่อมกับหลักฐานและ artifact')}</span></button>`).join('')}</div>
            ${state.verify ? verifyBox(stage) : ''}
            ${state.answered ? feedbackBox() : ''}
            <div class="utility"><div class="hint">Hint: ${esc(stage.reason)} ${state.hints ? '• เปิด hint แล้ว คะแนน reasoning ยังผ่านได้ แต่ 3★ ต้องแม่นจริง' : ''}</div><button class="btn secondary" data-hint ${state.answered ? 'disabled' : ''}>ขอ Hint</button></div>
          </div>
        </div>
      </section>
    </div>`;
  }

  function verifyBox(stage) {
    return `<section class="verify"><h3>Reason Check</h3><p>${esc(stage.reason)}</p><div class="options">${state.verify.reasons.map((reason) => `<button class="option" data-reason="${esc(reason.id)}"><b>${esc(reason.label)}</b><span>${esc(reason.rationale)}</span></button>`).join('')}</div></section>`;
  }

  function feedbackBox() {
    const last = state.history[state.history.length - 1] || {};
    return `<section class="feedback ${last.correct ? 'good' : 'bad'}"><h3>${last.correct ? 'ผ่านการตัดสินใจ' : 'ยังไม่ผ่านเหตุผล'}</h3><p>${esc(last.rationale || '')}</p><div class="actions" style="margin-top:10px"><button class="btn" data-next>${state.current >= state.stages.length - 1 ? 'สรุปผล' : 'รอบถัดไป →'}</button></div></section>`;
  }

  function results() {
    const total = state.stages.length;
    const accuracy = pct(state.correct, total);
    const reasonPct = pct(state.verified, total);
    const durationSec = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
    const stars = accuracy >= 84 && reasonPct >= 75 && state.hints <= 1 ? 3 : accuracy >= 70 && reasonPct >= 60 ? 2 : accuracy >= 45 ? 1 : 0;
    const score = Math.max(0, Math.round((accuracy * 7) + (reasonPct * 5) + (stars * 80) - (state.hints * 12) - (state.wrong * 8)));
    const passedNode = stars >= 2;
    const next = CONTENT?.nextAfter?.(node.id);
    const artifactFields = node.artifactChecklist || ['Evidence','Decision','Proof'];

    try {
      window.UXQProgress?.recordMission?.(key, {
        score, stars, accuracy, correct: state.correct, total, hints: state.hints,
        durationSec, passed: passedNode, badge: `${node.id} ${node.missionTitle || node.title}`
      });
    } catch (error) {
      console.warn('[CSAI2601 Canonical Node] progress record failed', error);
    }

    return `<div class="shell"><section class="panel"><div class="results">
      <div class="stars">${starsText(stars)}</div>
      <h1>${passedNode ? `${esc(node.id)} ผ่านแล้ว` : `${esc(node.id)} ยังควร Retry`}</h1>
      <p>${passedNode ? 'ปลดล็อกด่านถัดไปได้แล้ว แต่สามารถเล่นซ้ำเพื่อเจอ case variant ใหม่และเพิ่มความแม่นยำด้าน Reason Check' : 'ควรเล่นซ้ำโดยใช้หลักฐานจาก case, concept และ artifact เป็นแกน ไม่ตอบจากความรู้สึกหรือความสวยงาม'}</p>
      <div class="result-grid"><div><b>${score}</b><span>Score</span></div><div><b>${accuracy}%</b><span>Accuracy</span></div><div><b>${reasonPct}%</b><span>Reason</span></div><div><b>${state.hints}</b><span>Hints</span></div><div><b>${fmt(durationSec)}</b><span>Time</span></div></div>
      <section class="artifact"><p class="kicker">Studio Artifact</p><h2>${esc(node.artifact || 'Artifact')}</h2><p>นำผลการเล่นไปเติมใบงาน/portfolio ตามหัวข้อต่อไปนี้</p>${artifactFields.slice(0, 5).map((field, idx) => `<label><b>${esc(field)}</b><textarea data-artifact-field="${idx}" placeholder="เขียนสิ่งที่ตัดสินใจจากหลักฐาน ไม่ใช่แค่คำตอบที่เลือก"></textarea></label>`).join('')}<div class="actions"><button class="btn secondary" data-save-artifact>บันทึก note ในเครื่อง</button><small data-save-status></small></div></section>
      <section class="takeaway"><b>สิ่งที่ Dashboard/ครูควรเห็นจากด่านนี้</b><ul>${(node.dashboardEvidence || []).slice(0, 8).map((item) => `<li>${esc(item)}</li>`).join('')}</ul></section>
      <div class="actions"><button class="btn" data-retry>เล่นซ้ำด้วย case ใหม่</button>${next ? `<a class="btn ${passedNode ? '' : 'disabled'}" href="${urlForNode(next.id)}">ไปต่อ ${esc(next.id)} →</a>` : ''}<a class="btn secondary" href="${missionControlUrl()}">กลับ Mission Control</a></div>
    </div></section></div>`;
  }

  function errorScreen(message) {
    return `<div class="shell"><section class="panel lock"><div class="hero"><p class="kicker">CSAI2601 UX Quest</p><h1 class="title">ยังเปิดด่านนี้ไม่ได้</h1><p class="lede">${esc(message)}</p><div class="actions"><a class="btn" href="${missionControlUrl()}">กลับ Mission Control</a></div></div></section></div>`;
  }

  function saveArtifact() {
    const values = {};
    root.querySelectorAll('textarea[data-artifact-field]').forEach((field) => { values[field.dataset.artifactField] = field.value.trim(); });
    try {
      localStorage.setItem(`csai2601.uxq.artifact.${key}.v1`, JSON.stringify({ nodeId: node.id, savedAt: new Date().toISOString(), values }));
      const status = root.querySelector('[data-save-status]');
      if (status) status.textContent = 'บันทึก note ในเครื่องแล้ว';
    } catch (error) {
      const status = root.querySelector('[data-save-status]');
      if (status) status.textContent = 'บันทึกไม่ได้ โปรดคัดลอกข้อความเก็บไว้';
    }
  }

  function render() {
    ensureStyle();
    if (!CONTENT || !node) { root.innerHTML = errorScreen('ไม่พบ canonical content pack หรือ node ที่ร้องขอ'); return; }
    if (state.screen === 'intro') root.innerHTML = intro();
    if (state.screen === 'game') root.innerHTML = game();
    if (state.screen === 'results') root.innerHTML = results();
    wire();
  }

  function wire() {
    root.querySelector('[data-start]')?.addEventListener('click', () => { makeRun(); state.screen = 'game'; render(); });
    root.querySelector('[data-hint]')?.addEventListener('click', () => { state.hints += 1; render(); });
    root.querySelector('[data-retry]')?.addEventListener('click', () => { makeRun(); state.screen = 'game'; render(); });
    root.querySelector('[data-save-artifact]')?.addEventListener('click', saveArtifact);
    root.querySelectorAll('[data-choice]').forEach((button) => button.addEventListener('click', () => choose(button.dataset.choice)));
    root.querySelectorAll('[data-reason]').forEach((button) => button.addEventListener('click', () => chooseReason(button.dataset.reason)));
    root.querySelector('[data-next]')?.addEventListener('click', nextStage);
  }

  function choose(id) {
    if (state.answered || state.verify) return;
    const stage = state.stages[state.current];
    const option = stage.options.find((item) => item.id === id);
    if (!option) return;
    state.selected = id;
    if (option.correct) {
      state.verify = { option, reasons: buildReasonChoices(stage) };
      render();
    } else {
      state.wrong += 1;
      state.answered = true;
      state.history.push({ correct: false, verified: false, rationale: option.rationale });
      render();
    }
  }

  function chooseReason(id) {
    if (!state.verify || state.answered) return;
    const reason = state.verify.reasons.find((item) => item.id === id);
    if (!reason) return;
    state.correct += 1;
    if (reason.correct) state.verified += 1;
    else state.wrong += 1;
    state.history.push({ correct: reason.correct, verified: reason.correct, rationale: reason.correct ? state.verify.option.rationale : reason.rationale });
    state.verify = null;
    state.answered = true;
    render();
  }

  function nextStage() {
    if (state.current >= state.stages.length - 1) {
      state.screen = 'results';
    } else {
      state.current += 1;
      state.selected = null;
      state.verify = null;
      state.answered = false;
    }
    render();
  }

  render();
})();
