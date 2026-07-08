/* CSAI2601 UX Quest • Canonical Node Player v1.1
 * Curriculum-locked playable layer for W1-W15 + B1-B4.
 * Fix v1.1: stage-specific question models so consecutive rounds do not repeat the same option pattern.
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
    screen: 'intro', caseFile: null, stages: [], current: 0, selected: null, verify: null,
    answered: false, correct: 0, verified: 0, wrong: 0, hints: 0, startedAt: Date.now(), history: []
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
  function missionControlUrl() { return './csai2601-mission-control.html?v=canonical-node-v11'; }

  function recentKey() { return `csai2601.uxq.canonical.recent.${key}.v2`; }
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

  function caseText(caseFile) {
    return {
      context: caseFile.context || caseFile.title || node.casePrompt || node.bossScenario || node.focus || 'สถานการณ์ UX/UI',
      friction: caseFile.friction || caseFile.issue || caseFile.risk || caseFile.data || 'ผู้ใช้ติดขัดระหว่างทำ task',
      user: caseFile.user || 'ผู้ใช้หลักของระบบ',
      misconception: caseFile.misconception || caseFile.risk || caseFile.issue || 'ตัดสินจากความรู้สึกมากกว่าหลักฐาน',
      artifact: node.artifact || 'studio artifact'
    };
  }

  function option(id, correct, label, rationale, misconception) {
    return { id, correct, label, rationale, misconception: misconception || '' };
  }

  function w1Model(roundIndex, caseFile) {
    const c = caseText(caseFile);
    const models = [
      {
        label: 'Friction Hunt',
        prompt: 'ข้อ 1: จุดติดขัดหลักของผู้ใช้คืออะไร',
        instruction: `Case: ${c.context} • สัญญาณปัญหา: ${c.friction}`,
        reason: 'หลักฐานใดทำให้คิดว่านี่คือปัญหา UX ไม่ใช่แค่ UI',
        options: [
          option('c0', true, `ระบุ friction ว่า “${c.friction}” ทำให้ผู้ใช้ทำ task ไม่จบ`, 'ถูกต้อง เพราะเริ่มจากพฤติกรรม/อุปสรรคของผู้ใช้ก่อนเลือกวิธีแก้', ''),
          option('d0a', false, 'สรุปว่า UI ไม่สวย จึงควรเปลี่ยนสีและไอคอนทั้งหมดก่อน', 'ผิด เพราะตัดสินจากความสวย แต่ยังไม่ชี้ว่าผู้ใช้ติดที่ task ใด', 'UI-only'),
          option('d0b', false, 'บอกว่าผู้ใช้ไม่อ่านเอง จึงเพิ่มคำเตือนยาวไว้บนทุกหน้า', 'ผิด เพราะโทษผู้ใช้และอาจเพิ่ม cognitive load โดยไม่แก้ friction', 'blame-user'),
          option('d0c', false, 'เลือกแก้หน้าที่ทีมทำได้เร็วที่สุดก่อน แม้ไม่ใช่จุดที่ผู้ใช้ติด', 'ผิด เพราะความง่ายของทีมไม่ใช่หลักฐานของ UX impact', 'team-convenience')
        ]
      },
      {
        label: 'User Goal Match',
        prompt: 'ข้อ 2: เป้าหมายจริงของผู้ใช้ในคดีนี้คืออะไร',
        instruction: `Case: ${c.context} • ให้จับ user goal ก่อนคิด layout หรือปุ่ม`,
        reason: 'ผู้ใช้จะล้มเหลวที่ขั้นตอนไหน หากเราเข้าใจ goal ผิด',
        options: [
          option('c1', true, `ผู้ใช้ต้องทำงานหลักให้สำเร็จใน ${c.context} โดยรู้ next step ชัดเจน`, 'ถูกต้อง เพราะ user goal ต้องผูกกับ task สำคัญและผลลัพธ์ที่ผู้ใช้ต้องการ', ''),
          option('d1a', false, 'ผู้ใช้ต้องการเห็นหน้าจอที่มีลูกเล่นเยอะและดูทันสมัยเป็นหลัก', 'ผิด เพราะความทันสมัยไม่ใช่ task outcome', 'aesthetic-goal'),
          option('d1b', false, 'ผู้ใช้ควรอ่านข้อมูลทั้งหมดก่อน แล้วค่อยตัดสินใจเองว่าจะกดอะไร', 'ผิด เพราะผลักภาระการจัดลำดับกลับไปให้ผู้ใช้', 'reader-burden'),
          option('d1c', false, 'ผู้ใช้ต้องการให้เมนูทุกอย่างอยู่หน้าแรกเท่า ๆ กันเพื่อเลือกเองได้ครบ', 'ผิด เพราะทุกอย่างเด่นเท่ากันจะทำให้ priority หาย', 'no-priority')
        ]
      },
      {
        label: 'Impact Lens',
        prompt: 'ข้อ 3: ปัญหานี้ควรจัดเข้ากรอบ UI, UX หรือ front-end feedback อย่างไร',
        instruction: `Case: ${c.context} • แยก visual problem ออกจาก task failure และ system feedback`,
        reason: 'ถ้าแก้สีหรือปุ่มอย่างเดียว ปัญหาจะหายจริงหรือไม่ เพราะอะไร',
        options: [
          option('c2', true, 'UI อาจเกี่ยวกับตำแหน่ง/น้ำหนักภาพ แต่ UX คือ task ไม่สำเร็จ และ front-end feedback คือ state/response ไม่ชัด', 'ถูกต้อง เพราะแยกชั้นปัญหาได้ ไม่ลด UX ให้เหลือแค่ความสวย', ''),
          option('d2a', false, 'เป็น UI ทั้งหมด เพราะผู้ใช้มองหน้าจอแล้วไม่เข้าใจ', 'ผิด เพราะการไม่เข้าใจอาจเกิดจาก flow, wording, feedback หรือ information architecture ด้วย', 'UI-overgeneralization'),
          option('d2b', false, 'เป็น front-end ทั้งหมด เพราะถ้าเขียนโค้ดให้เร็วขึ้นผู้ใช้จะพอใจ', 'ผิด เพราะ speed ไม่ได้แก้ goal, hierarchy หรือความเข้าใจเสมอไป', 'performance-only'),
          option('d2c', false, 'เป็น UX ทั้งหมด จึงไม่ต้องตรวจ visual hierarchy หรือ feedback state', 'ผิด เพราะ UX ต้องสังเคราะห์หลายชั้น รวม UI และ system response ด้วย', 'UX-vague')
        ]
      },
      {
        label: 'Fix Decision',
        prompt: 'ข้อ 4: ควรเลือกแนวทางแก้เบื้องต้นแบบใด',
        instruction: `Case: ${c.context} • เลือก fix ที่ลด ${c.friction} โดยไม่เพิ่มภาระใหม่`,
        reason: 'วิธีแก้ใดสัมพันธ์กับ friction และพิสูจน์ผลได้จริง',
        options: [
          option('c3', true, 'ปรับลำดับข้อมูล/CTA/feedback ให้ผู้ใช้เห็นงานถัดไปและสถานะของระบบชัดขึ้น', 'ถูกต้อง เพราะแก้จาก task friction และเปิดทางให้ทดสอบผลได้', ''),
          option('d3a', false, 'เพิ่ม animation ให้ปุ่มเด่นขึ้นก่อน โดยยังไม่เปลี่ยน flow หรือ feedback', 'ผิด เพราะอาจดึงสายตา แต่ไม่แก้สาเหตุที่ผู้ใช้ทำงานไม่สำเร็จ', 'visual-no-flow'),
          option('d3b', false, 'ซ่อนข้อมูลรองทั้งหมดทันทีเพื่อให้หน้าโล่งที่สุด', 'ผิด เพราะหน้าโล่งอาจตัดข้อมูลที่จำเป็นต่อการตัดสินใจ', 'over-simplify'),
          option('d3c', false, 'เพิ่ม FAQ ขนาดใหญ่ไว้ด้านบนทุกหน้าเพื่ออธิบายวิธีใช้', 'ผิด เพราะใช้ข้อความอธิบายแทนการแก้ interaction/structure', 'manual-instead-design')
        ]
      },
      {
        label: 'Proof Plan',
        prompt: 'ข้อ 5: จะทดสอบอย่างไรว่า UX ดีขึ้นจริง',
        instruction: `Case: ${c.context} • ต้องพิสูจน์ด้วยพฤติกรรม ไม่ใช่ถามว่าชอบไหมอย่างเดียว`,
        reason: 'จะทดสอบได้อย่างไรว่าแก้ดีขึ้นจริง',
        options: [
          option('c4', true, 'ให้ผู้ใช้ทำ task เดิม วัด task success, เวลา, error และคำอธิบาย next step หลังใช้', 'ถูกต้อง เพราะวัด outcome ที่สัมพันธ์กับ friction โดยตรง', ''),
          option('d4a', false, 'ถามทีมออกแบบว่าหน้าใหม่ดูดีกว่าเดิมหรือไม่', 'ผิด เพราะความเห็นทีมไม่แทนพฤติกรรมผู้ใช้จริง', 'team-opinion'),
          option('d4b', false, 'วัดเฉพาะจำนวนคนกดเข้าหน้าแรกหลังเปลี่ยนดีไซน์', 'ผิด เพราะ traffic ไม่บอกว่าผู้ใช้ทำ task สำเร็จหรือไม่', 'traffic-only'),
          option('d4c', false, 'ให้ผู้ใช้ดูภาพ mockup แล้วเลือกว่าชอบภาพไหนมากกว่า', 'ผิด เพราะ preference ไม่เท่ากับ usability หรือ task success', 'preference-test')
        ]
      }
    ];
    return models[roundIndex % models.length];
  }

  function genericModel(round, roundIndex, caseFile) {
    const c = caseText(caseFile);
    const concept = node.concepts?.[roundIndex % Math.max(1, node.concepts.length)] || node.focus || 'UX evidence';
    const lower = String(round || '').toLowerCase();
    const model = {
      label: round,
      prompt: `${node.type === 'boss' ? 'Boss' : 'Mission'} Round ${roundIndex + 1}: ${round}`,
      instruction: `Case: ${c.context} • โฟกัส: ${concept}`,
      reason: node.reasonChecks?.[roundIndex % Math.max(1, node.reasonChecks.length)] || 'เหตุผลใดเชื่อมกับหลักฐานผู้ใช้มากที่สุด',
      correct: `ใช้หลักฐานของ ${c.user} ใน ${c.context} เพื่อเลือก decision ที่แก้ ${c.friction} และพิสูจน์ได้ใน ${c.artifact}`,
      rationale: `ถูกต้อง เพราะเชื่อม user evidence → ${concept} → design decision → proof`,
      distractors: [
        ['ตัดสินจากหน้าจอที่ดูสวยหรือคุ้นที่สุดก่อน แล้วค่อยหาเหตุผลประกอบ', 'ผิด เพราะเป็น aesthetic-first ไม่ใช่ evidence-led decision', 'aesthetic-first'],
        ['เพิ่มคำอธิบายให้มากขึ้นโดยไม่เปลี่ยน structure, state หรือ feedback', 'ผิด เพราะอาจเพิ่มภาระและไม่แก้ต้นเหตุของ friction', 'more-text-fix'],
        ['เลือกทางที่ทีมทำเร็วที่สุด แม้ยังไม่รู้ว่าช่วยผู้ใช้ทำ task สำเร็จขึ้นหรือไม่', 'ผิด เพราะความเร็วของทีมไม่ใช่หลักฐานของ user outcome', 'team-convenience']
      ]
    };
    if (/evidence|signal|fact|read|scan/.test(lower)) {
      model.correct = `เลือกหลักฐานที่สังเกตได้จาก ${c.context} แล้วระบุว่ามันกระทบ task ของผู้ใช้อย่างไร`;
      model.distractors = [
        ['เลือกคำชมจากผู้ใช้เป็นหลัก เพราะฟังแล้วเป็นบวกที่สุด', 'ผิด เพราะคำชมไม่บอก friction หรือ task failure', 'positive-bias'],
        ['เลือกข้อมูลที่ทีมมีอยู่แล้ว แม้ไม่เกี่ยวกับงานที่ผู้ใช้ต้องทำ', 'ผิด เพราะ data ที่มีไม่จำเป็นต้องเป็น evidence ที่ตอบโจทย์', 'available-data-bias'],
        ['สรุปจากความรู้สึกของผู้สอนหรือทีมว่า screen ไหนน่าจะมีปัญหา', 'ผิด เพราะเป็น assumption ไม่ใช่ observed evidence', 'assumption']
      ];
    } else if (/problem|hmw|define|frame/.test(lower)) {
      model.correct = `เขียนปัญหาให้มี user + goal + barrier จาก ${c.context} โดยยังไม่ล็อก solution เร็วเกินไป`;
      model.distractors = [
        ['เริ่มจาก solution ที่อยากทำ แล้วเขียนปัญหาให้เข้ากับ solution นั้น', 'ผิด เพราะ solution-led framing ทำให้หลุดจากหลักฐานผู้ใช้', 'solution-first'],
        ['เขียนปัญหากว้าง ๆ ว่า “ระบบใช้งานยาก” เพื่อครอบคลุมทุกอย่าง', 'ผิด เพราะกว้างเกินไปจนตัดสินใจออกแบบต่อไม่ได้', 'too-broad'],
        ['เขียนโจทย์เป็นรายการ feature ที่ต้องเพิ่มทันที', 'ผิด เพราะ feature list ไม่ใช่ problem statement', 'feature-list']
      ];
    } else if (/flow|path|journey|structure|sitemap|ia|navigation/.test(lower)) {
      model.correct = `จัดเส้นทางจาก entry → decision → confirmation → error path ให้ผู้ใช้ไปต่อได้ใน ${c.context}`;
      model.distractors = [
        ['ทำเฉพาะ happy path เพราะต้องการให้ flow ดูสั้นและสวย', 'ผิด เพราะ UX ต้องรองรับความผิดพลาดและทางเลือกจริง', 'happy-path-only'],
        ['รวมทุกเมนูไว้หน้าเดียวเพื่อให้ผู้ใช้เห็นครบ', 'ผิด เพราะอาจทำให้ navigation overload', 'menu-dump'],
        ['ซ่อนขั้นตอนสำคัญไว้หลังเมนูรองเพื่อให้หน้าแรกโล่ง', 'ผิด เพราะลด discoverability ของ task หลัก', 'hidden-task']
      ];
    } else if (/wireframe|layout|hierarchy|priority|grid|visual/.test(lower)) {
      model.correct = `วาง hierarchy ให้ข้อมูลที่ผู้ใช้ต้องใช้ตัดสินใจมาก่อน CTA และข้อมูลรองใน ${c.context}`;
      model.distractors = [
        ['ทำให้ทุก block มีขนาดเท่ากันเพื่อความเป็นระเบียบ', 'ผิด เพราะความเท่ากันอาจทำให้ priority หาย', 'flat-hierarchy'],
        ['เริ่มจากสีและภาพประกอบก่อน เพราะจะทำให้ wireframe ดูสมจริง', 'ผิด เพราะ wireframe ต้องพิสูจน์ structure และ task ก่อน visual polish', 'visual-too-early'],
        ['วาง CTA หลายปุ่มให้เด่นเท่ากันเพื่อเปิดทางเลือก', 'ผิด เพราะผู้ใช้จะไม่รู้ primary action', 'cta-conflict']
      ];
    } else if (/state|feedback|interaction|prototype|test|validate|severity|iteration/.test(lower)) {
      model.correct = `ออกแบบ feedback/prototype/test ให้เห็น state, error และหลักฐานก่อน-หลังการแก้ ${c.friction}`;
      model.distractors = [
        ['วัดเฉพาะว่าผู้ใช้ชอบ prototype หรือไม่', 'ผิด เพราะ preference ไม่แทน task success', 'preference-only'],
        ['แก้ทุกอย่างที่เห็นพร้อมกัน เพื่อให้หน้าจอเปลี่ยนเยอะที่สุด', 'ผิด เพราะจะพิสูจน์ไม่ได้ว่าอะไรทำให้ดีขึ้น', 'change-too-much'],
        ['ให้ระบบเงียบหลังผู้ใช้กด เพื่อไม่รบกวนสายตา', 'ผิด เพราะ lack of feedback ทำให้ผู้ใช้ไม่รู้ state', 'no-feedback']
      ];
    }
    return model;
  }

  function buildStage(round, caseFile, roundIndex) {
    const model = key === 'w1' ? w1Model(roundIndex, caseFile) : genericModel(round, roundIndex, caseFile);
    const right = option(`c${roundIndex}`, true, model.correct || model.options?.find((item) => item.correct)?.label, model.rationale || model.options?.find((item) => item.correct)?.rationale || 'ถูกต้อง เพราะตัดสินใจจากหลักฐานและพิสูจน์ผลได้', '');
    const wrongs = model.options
      ? model.options.filter((item) => !item.correct).map((item, idx) => option(`d${roundIndex}-${idx}`, false, item.label, item.rationale, item.misconception))
      : model.distractors.map(([label, rationale, misconception], idx) => option(`d${roundIndex}-${idx}`, false, label, rationale, misconception));
    return {
      id: `${key}-stage-${roundIndex + 1}`,
      round: model.label || round,
      prompt: model.prompt,
      instruction: model.instruction,
      reason: model.reason,
      options: shuffle([right, ...wrongs])
    };
  }

  function makeRun() {
    const caseFile = pickCase();
    const rounds = Array.isArray(node.missionRounds) && node.missionRounds.length ? node.missionRounds : ['Identify evidence', 'Choose decision', 'Reason check', 'Plan proof'];
    const selectedRounds = node.type === 'boss' ? rounds.slice(0, 6) : rounds.slice(0, 5);
    state.caseFile = caseFile;
    state.stages = selectedRounds.map((round, idx) => buildStage(round, caseFile, idx));
    state.current = 0; state.selected = null; state.verify = null; state.answered = false;
    state.correct = 0; state.verified = 0; state.wrong = 0; state.hints = 0; state.startedAt = Date.now(); state.history = [];
  }

  function buildReasonChoices(stage) {
    const right = option('reason-ok', true, stage.reason, 'เหตุผลนี้เชื่อมหลักฐาน แนวคิด และผลต่อผู้ใช้เข้าด้วยกัน', '');
    return shuffle([
      right,
      option('reason-style', false, 'เพราะหน้าจอดูทันสมัยและน่าจะถูกใจผู้เรียนส่วนใหญ่', 'ผิด เพราะความชอบหรือความสวยไม่ใช่หลักฐานว่า task สำเร็จขึ้น', 'style-only'),
      option('reason-speed', false, 'เพราะทีมทำวิธีนี้ได้เร็วที่สุดและไม่ต้องเปลี่ยนโครงสร้างมาก', 'ผิด เพราะความสะดวกของทีมไม่ใช่ user outcome', 'team-speed'),
      option('reason-copy', false, 'เพราะระบบยอดนิยมหลายระบบใช้รูปแบบคล้ายกัน', 'ผิด เพราะ pattern ที่นิยมต้องปรับตาม user, task และ context', 'copy-pattern')
    ]);
  }

  function ensureStyle() {
    if (document.getElementById('csai2601-canonical-node-style')) return;
    const style = document.createElement('style');
    style.id = 'csai2601-canonical-node-style';
    style.textContent = `
      :root{--bg:#071124;--panel:#101f3d;--ink:#eef6ff;--muted:#a9b9d9;--line:rgba(181,205,255,.2);--cyan:#6ee7ff;--violet:#9b8cff;--good:#79eda5;--warn:#ffd166;--bad:#ff96a8;--shadow:0 22px 54px rgba(0,0,0,.32)}
      *{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 10% 8%,#1b3d70 0,transparent 28rem),radial-gradient(circle at 92% 10%,#382b72 0,transparent 26rem),var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a,button,textarea{font:inherit}.shell{width:min(1100px,100%);margin:0 auto;padding:18px 14px 48px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px}.brand{color:#fff;text-decoration:none;font-weight:950;display:flex;align-items:center;gap:10px}.mark{display:grid;place-items:center;width:38px;height:38px;border-radius:13px;border:1px solid rgba(110,231,255,.55);background:linear-gradient(145deg,rgba(110,231,255,.2),rgba(155,140,255,.22))}.pill{border:1px solid var(--line);border-radius:999px;padding:8px 10px;color:var(--muted);background:rgba(7,17,36,.45);font-size:.86rem}.panel{border:1px solid var(--line);background:linear-gradient(160deg,rgba(23,43,81,.95),rgba(8,20,45,.96));border-radius:24px;box-shadow:var(--shadow);overflow:hidden}.hero{padding:clamp(24px,5vw,56px);display:grid;gap:18px}.kicker{margin:0;color:var(--cyan);font-size:.78rem;letter-spacing:.13em;text-transform:uppercase;font-weight:950}.title{margin:0;font-size:clamp(2rem,6vw,4rem);line-height:.98;letter-spacing:-.045em}.lede{margin:0;color:var(--muted);line-height:1.7;font-size:clamp(1rem,1.6vw,1.18rem);max-width:800px}.briefs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.brief{border:1px solid var(--line);border-radius:16px;background:rgba(5,15,35,.38);padding:14px}.brief b{display:block;color:#fff;margin-bottom:4px}.brief span{display:block;color:var(--muted);line-height:1.48;font-size:.9rem}.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.btn{border:0;border-radius:13px;padding:12px 15px;background:var(--cyan);color:#071124;text-decoration:none;font-weight:950;cursor:pointer}.btn.secondary{background:transparent;color:#fff;border:1px solid var(--line)}.btn.warn{background:var(--warn);color:#352700}.lock{border-color:rgba(255,209,102,.45);background:linear-gradient(160deg,rgba(61,47,28,.55),rgba(15,24,45,.95))}.game{padding:clamp(16px,4vw,34px)}.hud{display:grid;grid-template-columns:1fr repeat(3,minmax(94px,.25fr));gap:10px;border-bottom:1px solid var(--line);padding:13px;background:rgba(4,14,31,.42)}.meter{border:1px solid var(--line);border-radius:14px;padding:10px;background:rgba(5,15,35,.46)}.meter small{display:block;color:var(--muted);font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;font-weight:850}.meter b{display:block;margin-top:3px}.bar{height:7px;background:rgba(255,255,255,.1);border-radius:999px;overflow:hidden;margin-top:7px}.bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--cyan),var(--violet));border-radius:inherit;transition:width .25s}.case{display:grid;gap:8px;margin-bottom:18px}.case h1{margin:0;font-size:clamp(1.35rem,3vw,2rem);letter-spacing:-.03em}.case p{margin:0;color:var(--muted);line-height:1.6}.question{border:1px solid rgba(197,215,255,.2);border-radius:20px;background:linear-gradient(150deg,rgba(22,44,85,.78),rgba(9,22,49,.94));padding:clamp(16px,3vw,28px)}.prompt{margin:0;font-size:clamp(1.12rem,2.5vw,1.5rem);line-height:1.35}.instruction{margin:9px 0 0;color:#cfdcf4;line-height:1.55}.options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:18px}.option{text-align:left;border:1px solid var(--line);border-radius:15px;min-height:116px;padding:14px;background:rgba(5,15,35,.44);color:#fff;cursor:pointer}.option:hover:not(:disabled){border-color:rgba(110,231,255,.75);transform:translateY(-1px)}.option b{display:block;line-height:1.35}.option span{display:block;color:var(--muted);line-height:1.48;margin-top:6px;font-size:.88rem}.option.pick{border-color:rgba(255,209,102,.75);background:rgba(255,209,102,.1)}.feedback{margin-top:15px;border:1px solid var(--line);border-radius:15px;padding:14px;background:rgba(5,15,35,.55);line-height:1.6}.feedback.good{border-color:rgba(121,237,165,.6);background:rgba(121,237,165,.1)}.feedback.bad{border-color:rgba(255,150,168,.65);background:rgba(255,150,168,.1)}.verify{margin-top:15px;border:1px solid rgba(110,231,255,.35);border-radius:18px;background:rgba(110,231,255,.07);padding:15px}.verify h3{margin:0 0 6px}.utility{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:14px}.hint{flex:1;color:#ffdfa0;border:1px dashed rgba(255,209,102,.62);background:rgba(255,209,102,.08);border-radius:13px;padding:10px;line-height:1.5}.results{padding:clamp(24px,5vw,54px);display:grid;gap:16px;text-align:center;justify-items:center}.stars{font-size:clamp(2.6rem,8vw,5rem);color:var(--warn);letter-spacing:.06em}.result-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;width:min(780px,100%)}.result-grid div{border:1px solid var(--line);border-radius:15px;background:rgba(5,15,35,.45);padding:13px}.result-grid b{display:block;font-size:1.16rem}.result-grid span{display:block;color:var(--muted);font-size:.74rem;text-transform:uppercase;font-weight:850}.artifact{width:min(820px,100%);text-align:left;border:1px solid rgba(155,140,255,.55);border-radius:18px;background:linear-gradient(145deg,rgba(54,42,112,.36),rgba(8,24,52,.70));padding:16px;display:grid;gap:10px}.artifact h2{margin:0}.artifact p{margin:0;color:#dce9ff;line-height:1.55}.artifact textarea{width:100%;min-height:76px;resize:vertical;border:1px solid rgba(181,205,255,.3);border-radius:12px;padding:10px;background:rgba(3,13,31,.5);color:#eff7ff;line-height:1.5}.takeaway{width:min(820px,100%);text-align:left;border:1px solid rgba(110,231,255,.25);border-radius:16px;background:rgba(110,231,255,.07);padding:14px}.takeaway ul{margin:8px 0 0;padding-left:20px;color:#d4e0fa;line-height:1.65}.disabled{opacity:.5;pointer-events:none}@media(max-width:760px){.shell{padding:12px 10px 32px}.top{align-items:flex-start}.briefs,.options,.hud{grid-template-columns:1fr}.result-grid{grid-template-columns:repeat(2,1fr)}.utility{flex-direction:column;align-items:stretch}.title{font-size:2.15rem}.hero{padding:26px 18px}.pill{font-size:.75rem}}
    `;
    document.head.appendChild(style);
  }

  function intro() {
    const record = missionRecord(key);
    const sample = node.seedCases?.[0] || {};
    return `<div class="shell"><div class="top"><a class="brand" href="${missionControlUrl()}"><span class="mark">UX</span><span>CSAI2601 UX Quest</span></a><span class="pill">v1.1 • ${esc(node.id)}</span></div><section class="panel ${canPlay() ? '' : 'lock'}"><div class="hero"><p class="kicker">${node.type === 'boss' ? 'BOSS GATE' : 'WEEKLY MISSION'} • ${esc(node.id)}</p><h1 class="title">${esc(node.missionTitle || node.title)}</h1><p class="lede">${esc(node.focus || '')}</p><div class="briefs"><div class="brief"><b>Concept</b><span>${esc((node.concepts || []).slice(0, 5).join(' • ') || node.title)}</span></div><div class="brief"><b>Case</b><span>${esc(node.casePrompt || node.bossScenario || sample.context || 'วิเคราะห์สถานการณ์ UX/UI จากหลักฐาน')}</span></div><div class="brief"><b>Artifact</b><span>${esc(node.artifact || 'Studio artifact')}</span></div></div>${record.bestStars ? `<p class="lede">สถิติดีที่สุดเดิม: ${starsText(record.bestStars)} • score ${Number(record.bestScore || 0)} • เล่นซ้ำเพื่อเจอ case variant ใหม่ได้</p>` : ''}${canPlay() ? `<div class="actions"><button class="btn" data-start>เริ่ม ${esc(node.id)} →</button><a class="btn secondary" href="${missionControlUrl()}">กลับ Mission Control</a></div>` : `<p class="lede">ด่านนี้ยังล็อกอยู่ ต้องผ่าน ${esc(previous?.id || 'ด่านก่อนหน้า')} ที่ 2★ ก่อน</p><div class="actions"><a class="btn warn" href="${urlForNode(previous?.id || 'W1')}">ไปด่านก่อนหน้า</a><a class="btn secondary" href="${missionControlUrl()}">กลับ Mission Control</a></div>`}</div></section></div>`;
  }

  function game() {
    const stage = state.stages[state.current];
    const progressPct = pct(state.current, state.stages.length);
    return `<div class="shell"><div class="top"><a class="brand" href="${missionControlUrl()}"><span class="mark">UX</span><span>${esc(node.id)} • ${esc(node.missionTitle || node.title)}</span></a><span class="pill">Case ${esc(state.caseFile?.id || '')}</span></div><section class="panel"><div class="hud"><div class="meter"><small>Progress</small><b>${state.current + 1}/${state.stages.length} • ${esc(stage.round)}</b><div class="bar"><i style="width:${progressPct}%"></i></div></div><div class="meter"><small>Correct</small><b>${state.correct}</b></div><div class="meter"><small>Reason</small><b>${state.verified}</b></div><div class="meter"><small>Hints</small><b>${state.hints}</b></div></div><div class="game"><div class="case"><p class="kicker">${esc(stage.round)}</p><h1>${esc(stage.prompt)}</h1><p>${esc(stage.instruction)}</p></div><div class="question"><p class="prompt">เลือกคำตอบที่ตรงกับหน้าที่ของข้อนี้ที่สุด</p><p class="instruction">ข้อในแต่ละ round วัดคนละทักษะ: friction, goal, impact, fix หรือ proof อย่าใช้คำตอบแบบเดียวกันทุกข้อ</p><div class="options">${stage.options.map((item) => `<button class="option ${state.selected === item.id ? 'pick' : ''}" data-choice="${esc(item.id)}" ${state.answered || state.verify ? 'disabled' : ''}><b>${esc(item.label)}</b><span>${esc(item.misconception ? `กับดัก: ${item.misconception}` : 'เชื่อมกับหลักฐานและ artifact')}</span></button>`).join('')}</div>${state.verify ? verifyBox(stage) : ''}${state.answered ? feedbackBox() : ''}<div class="utility"><div class="hint">Hint: ${esc(stage.reason)} ${state.hints ? '• เปิด hint แล้ว คะแนน reasoning ยังผ่านได้ แต่ 3★ ต้องแม่นจริง' : ''}</div><button class="btn secondary" data-hint ${state.answered ? 'disabled' : ''}>ขอ Hint</button></div></div></div></section></div>`;
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
    try { window.UXQProgress?.recordMission?.(key, { score, stars, accuracy, correct: state.correct, total, hints: state.hints, durationSec, passed: passedNode, badge: `${node.id} ${node.missionTitle || node.title}` }); }
    catch (error) { console.warn('[CSAI2601 Canonical Node] progress record failed', error); }
    return `<div class="shell"><section class="panel"><div class="results"><div class="stars">${starsText(stars)}</div><h1>${passedNode ? `${esc(node.id)} ผ่านแล้ว` : `${esc(node.id)} ยังควร Retry`}</h1><p>${passedNode ? 'ปลดล็อกด่านถัดไปได้แล้ว เล่นซ้ำเพื่อเจอ case variant ใหม่และเพิ่มความแม่นยำด้าน Reason Check ได้' : 'ควรเล่นซ้ำโดยใช้หลักฐานจาก case, concept และ artifact เป็นแกน'}</p><div class="result-grid"><div><b>${score}</b><span>Score</span></div><div><b>${accuracy}%</b><span>Accuracy</span></div><div><b>${reasonPct}%</b><span>Reason</span></div><div><b>${state.hints}</b><span>Hints</span></div><div><b>${fmt(durationSec)}</b><span>Time</span></div></div><section class="artifact"><p class="kicker">Studio Artifact</p><h2>${esc(node.artifact || 'Artifact')}</h2><p>นำผลการเล่นไปเติมใบงาน/portfolio ตามหัวข้อต่อไปนี้</p>${artifactFields.slice(0, 5).map((field, idx) => `<label><b>${esc(field)}</b><textarea data-artifact-field="${idx}" placeholder="เขียนสิ่งที่ตัดสินใจจากหลักฐาน ไม่ใช่แค่คำตอบที่เลือก"></textarea></label>`).join('')}<div class="actions"><button class="btn secondary" data-save-artifact>บันทึก note ในเครื่อง</button><small data-save-status></small></div></section><section class="takeaway"><b>สิ่งที่ Dashboard/ครูควรเห็นจากด่านนี้</b><ul>${(node.dashboardEvidence || []).slice(0, 8).map((item) => `<li>${esc(item)}</li>`).join('')}</ul></section><div class="actions"><button class="btn" data-retry>เล่นซ้ำด้วย case ใหม่</button>${next ? `<a class="btn ${passedNode ? '' : 'disabled'}" href="${urlForNode(next.id)}">ไปต่อ ${esc(next.id)} →</a>` : ''}<a class="btn secondary" href="${missionControlUrl()}">กลับ Mission Control</a></div></div></section></div>`;
  }

  function errorScreen(message) { return `<div class="shell"><section class="panel lock"><div class="hero"><p class="kicker">CSAI2601 UX Quest</p><h1 class="title">ยังเปิดด่านนี้ไม่ได้</h1><p class="lede">${esc(message)}</p><div class="actions"><a class="btn" href="${missionControlUrl()}">กลับ Mission Control</a></div></div></section></div>`; }
  function saveArtifact() {
    const values = {};
    root.querySelectorAll('textarea[data-artifact-field]').forEach((field) => { values[field.dataset.artifactField] = field.value.trim(); });
    try {
      localStorage.setItem(`csai2601.uxq.artifact.${key}.v1`, JSON.stringify({ nodeId: node.id, savedAt: new Date().toISOString(), values }));
      const status = root.querySelector('[data-save-status]'); if (status) status.textContent = 'บันทึก note ในเครื่องแล้ว';
    } catch (error) { const status = root.querySelector('[data-save-status]'); if (status) status.textContent = 'บันทึกไม่ได้ โปรดคัดลอกข้อความเก็บไว้'; }
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
    const choice = stage.options.find((item) => item.id === id);
    if (!choice) return;
    state.selected = id;
    if (choice.correct) { state.verify = { option: choice, reasons: buildReasonChoices(stage) }; render(); }
    else { state.wrong += 1; state.answered = true; state.history.push({ correct:false, verified:false, rationale: choice.rationale }); render(); }
  }
  function chooseReason(id) {
    if (!state.verify || state.answered) return;
    const reason = state.verify.reasons.find((item) => item.id === id);
    if (!reason) return;
    state.correct += 1;
    if (reason.correct) state.verified += 1; else state.wrong += 1;
    state.history.push({ correct: reason.correct, verified: reason.correct, rationale: reason.correct ? state.verify.option.rationale : reason.rationale });
    state.verify = null; state.answered = true; render();
  }
  function nextStage() {
    if (state.current >= state.stages.length - 1) state.screen = 'results';
    else { state.current += 1; state.selected = null; state.verify = null; state.answered = false; }
    render();
  }
  render();
})();
