/* CSAI2601 UX Quest • Canonical Node Player v1.2
 * Curriculum-locked playable layer for W1-W15 + B1-B4.
 * Fix v1.2: Reason Check choices are stage-specific, not a repeated global pattern.
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

  const state = { screen:'intro', caseFile:null, stages:[], current:0, selected:null, verify:null, answered:false, correct:0, verified:0, wrong:0, hints:0, startedAt:Date.now(), history:[] };

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const shuffle = (list) => {
    const out = Array.from(list || []);
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value || 0)));
  const pct = (a, b) => b ? Math.round((Number(a || 0) / Number(b || 0)) * 100) : 0;
  const starsText = (value) => `${'★'.repeat(clamp(value, 0, 3))}${'☆'.repeat(3 - clamp(value, 0, 3))}`;
  const fmt = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const progress = () => window.UXQProgress?.get?.() || { missions:{} };
  const missionRecord = (id) => progress().missions?.[String(id || '').toLowerCase()] || {};
  const passed = (id) => Number(missionRecord(id).bestStars || 0) >= 2;
  const canPlay = () => !previous || passed(previous.id);
  const urlForNode = (id) => `./csai2601-canonical-node.html?node=${encodeURIComponent(String(id || '').toUpperCase())}&v=canonical-node-v12`;
  const missionControlUrl = () => './csai2601-mission-control.html?v=canonical-node-v12';

  function opt(id, correct, label, rationale, misconception) {
    return { id, correct, label, rationale, misconception: misconception || '' };
  }
  function caseText(caseFile) {
    return {
      context: caseFile.context || caseFile.title || node?.casePrompt || node?.bossScenario || node?.focus || 'สถานการณ์ UX/UI',
      friction: caseFile.friction || caseFile.issue || caseFile.risk || caseFile.data || 'ผู้ใช้ติดขัดระหว่างทำงานหลัก',
      user: caseFile.user || 'ผู้ใช้หลักของระบบ',
      artifact: node?.artifact || 'ใบงานหลังเล่น'
    };
  }
  function recentKey() { return `csai2601.uxq.canonical.recent.${key}.v3`; }
  function readRecent() { try { return JSON.parse(localStorage.getItem(recentKey()) || '[]'); } catch (error) { return []; } }
  function writeRecent(id) {
    try {
      const recent = readRecent().filter((item) => item !== id);
      recent.unshift(id);
      localStorage.setItem(recentKey(), JSON.stringify(recent.slice(0, 6)));
    } catch (error) {}
  }
  function pickCase() {
    const bank = Array.isArray(node?.seedCases) && node.seedCases.length ? node.seedCases : [{ id:`${node?.id || 'W'}-C01`, context:node?.focus || node?.title || 'UX case' }];
    const recent = new Set(readRecent());
    const pool = bank.filter((item) => !recent.has(item.id));
    const chosen = (pool.length ? pool : bank)[Math.floor(Math.random() * (pool.length || bank.length))] || bank[0];
    writeRecent(chosen.id);
    return chosen;
  }

  function w1Model(roundIndex, caseFile) {
    const c = caseText(caseFile);
    const models = [
      {
        kind:'friction', label:'Friction Hunt', prompt:'ข้อ 1: จุดติดขัดหลักของผู้ใช้คืออะไร',
        instruction:`สถานการณ์: ${c.context} • สัญญาณปัญหา: ${c.friction}`,
        reason:'ทำไมจึงถือว่านี่คือจุดติดขัดหลักของผู้ใช้',
        correct:`ผู้ใช้ติดที่ “${c.friction}” จนทำงานหลักใน ${c.context} ไม่ราบรื่น`,
        rationale:'ถูก เพราะระบุอุปสรรคที่กระทบงานของผู้ใช้ ไม่ใช่ตัดสินจากหน้าตาอย่างเดียว',
        distractors:[
          ['หน้าจอไม่สวย จึงควรเปลี่ยนสีและไอคอนทั้งหมดก่อน', 'ผิด เพราะความสวยไม่บอกว่าผู้ใช้ติดที่งานใด', 'UI-only'],
          ['ผู้ใช้ไม่อ่านเอง จึงควรเพิ่มคำเตือนยาว ๆ ไว้ทุกหน้า', 'ผิด เพราะโทษผู้ใช้และเพิ่มภาระการอ่าน', 'blame-user'],
          ['ทีมแก้หน้าจอนี้ได้เร็ว จึงควรเลือกเป็นปัญหาหลัก', 'ผิด เพราะความง่ายของทีมไม่ใช่หลักฐานผู้ใช้', 'team-convenience']
        ]
      },
      {
        kind:'goal', label:'User Goal Match', prompt:'ข้อ 2: เป้าหมายจริงของผู้ใช้ในคดีนี้คืออะไร',
        instruction:`สถานการณ์: ${c.context} • ให้จับเป้าหมายก่อนคิด layout หรือปุ่ม`,
        reason:'ทำไม goal นี้จึงเป็น goal หลักของผู้ใช้',
        correct:`ผู้ใช้ต้องทำงานหลักใน ${c.context} ให้สำเร็จ และรู้ว่าต้องทำอะไรต่อ`,
        rationale:'ถูก เพราะเป้าหมายผู้ใช้ต้องผูกกับงานที่ต้องสำเร็จและผลลัพธ์ที่ตรวจได้',
        distractors:[
          ['ผู้ใช้ต้องการหน้าจอที่มีลูกเล่นเยอะและดูทันสมัย', 'ผิด เพราะความทันสมัยไม่ใช่เป้าหมายหลักของ task', 'aesthetic-goal'],
          ['ผู้ใช้ควรอ่านข้อมูลทั้งหมดก่อน แล้วเลือกเองว่าจะทำอะไร', 'ผิด เพราะผลักภาระการจัดลำดับกลับไปให้ผู้ใช้', 'reader-burden'],
          ['ผู้ใช้ต้องการเห็นทุกเมนูเด่นเท่ากันเพื่อเลือกได้ครบ', 'ผิด เพราะทุกอย่างเด่นเท่ากันทำให้ priority หาย', 'no-priority']
        ]
      },
      {
        kind:'impact', label:'Impact Lens', prompt:'ข้อ 3: ปัญหานี้ควรจัดเข้ากรอบ UI, UX หรือ front-end feedback อย่างไร',
        instruction:`สถานการณ์: ${c.context} • แยก visual problem ออกจาก task failure และ system feedback`,
        reason:'ทำไมการแยก UI, UX และ feedback จึงสำคัญต่อการแก้ปัญหา',
        correct:'UI คือการมองเห็น/ลำดับภาพ, UX คือ task สำเร็จหรือไม่, front-end feedback คือระบบตอบกลับชัดหรือไม่',
        rationale:'ถูก เพราะแยกชั้นปัญหาได้ จึงเลือกวิธีแก้ไม่ผิดชั้น',
        distractors:[
          ['ทุกปัญหาบนหน้าจอถือเป็น UI ทั้งหมด', 'ผิด เพราะบางปัญหาเป็น flow, feedback หรือความเข้าใจของผู้ใช้', 'UI-overgeneralization'],
          ['ถ้าโค้ดเร็วขึ้น ผู้ใช้จะเข้าใจเอง', 'ผิด เพราะ performance ไม่แก้ goal หรือ hierarchy เสมอไป', 'performance-only'],
          ['UX เป็นเรื่องกว้าง จึงไม่ต้องแยกประเภทปัญหา', 'ผิด เพราะยิ่งเป็น UX ยิ่งต้องแยกชั้นเหตุผลให้ชัด', 'UX-vague']
        ]
      },
      {
        kind:'fix', label:'Fix Decision', prompt:'ข้อ 4: ควรเลือกแนวทางแก้เบื้องต้นแบบใด',
        instruction:`สถานการณ์: ${c.context} • เลือก fix ที่ลด ${c.friction} โดยไม่เพิ่มภาระใหม่`,
        reason:'ทำไมแนวทางแก้นี้จึงสัมพันธ์กับ friction หลัก',
        correct:'ปรับลำดับข้อมูล ปุ่มหลัก และ feedback ให้ผู้ใช้เห็นงานถัดไปกับสถานะของระบบชัดขึ้น',
        rationale:'ถูก เพราะแก้จาก friction และเปิดทางให้ทดสอบผลได้',
        distractors:[
          ['เพิ่ม animation ให้ปุ่มเด่นขึ้นก่อน โดยยังไม่เปลี่ยน flow หรือ feedback', 'ผิด เพราะดึงสายตาแต่ไม่แก้สาเหตุของ task failure', 'visual-no-flow'],
          ['ซ่อนข้อมูลรองทั้งหมดทันทีเพื่อให้หน้าโล่งที่สุด', 'ผิด เพราะหน้าโล่งอาจตัดข้อมูลที่จำเป็นต่อการตัดสินใจ', 'over-simplify'],
          ['เพิ่ม FAQ ใหญ่ ๆ ไว้ด้านบนเพื่ออธิบายวิธีใช้', 'ผิด เพราะใช้คู่มือแทนการแก้ interaction/structure', 'manual-instead-design']
        ]
      },
      {
        kind:'proof', label:'Proof Plan', prompt:'ข้อ 5: จะทดสอบอย่างไรว่า UX ดีขึ้นจริง',
        instruction:`สถานการณ์: ${c.context} • ต้องพิสูจน์ด้วยพฤติกรรม ไม่ใช่ถามว่าชอบไหมอย่างเดียว`,
        reason:'ทำไมวิธีทดสอบนี้จึงพิสูจน์ผลได้จริง',
        correct:'ให้ผู้ใช้ทำ task เดิม แล้ววัด task success, เวลา, error และการอธิบาย next step หลังใช้',
        rationale:'ถูก เพราะวัด outcome ที่สัมพันธ์กับ friction โดยตรง',
        distractors:[
          ['ถามทีมออกแบบว่าหน้าใหม่ดูดีกว่าเดิมหรือไม่', 'ผิด เพราะความเห็นทีมไม่แทนพฤติกรรมผู้ใช้จริง', 'team-opinion'],
          ['วัดเฉพาะจำนวนคนกดเข้าหน้าแรกหลังเปลี่ยนดีไซน์', 'ผิด เพราะ traffic ไม่บอกว่า task สำเร็จหรือไม่', 'traffic-only'],
          ['ให้ผู้ใช้ดู mockup แล้วเลือกว่าชอบภาพไหนมากกว่า', 'ผิด เพราะ preference ไม่เท่ากับ usability', 'preference-test']
        ]
      }
    ];
    return models[roundIndex % models.length];
  }

  function kindFromRound(round) {
    const lower = String(round || '').toLowerCase();
    if (/friction|pain|issue|problem|failure/.test(lower)) return 'friction';
    if (/goal|need|user/.test(lower)) return 'goal';
    if (/impact|ui|ux|feedback|access|responsive|system/.test(lower)) return 'impact';
    if (/fix|repair|choose|decision|countermeasure|iteration|prototype/.test(lower)) return 'fix';
    if (/proof|test|validate|evidence|severity|rank|retest|evaluation/.test(lower)) return 'proof';
    if (/flow|path|journey|sitemap|ia|navigation|wireframe|layout|hierarchy|priority/.test(lower)) return 'impact';
    return 'fix';
  }

  function genericModel(round, roundIndex, caseFile) {
    const c = caseText(caseFile);
    const concept = node?.concepts?.[roundIndex % Math.max(1, node.concepts.length)] || node?.focus || 'UX evidence';
    const kind = kindFromRound(round);
    const templates = {
      friction: {
        correct:`เลือกหลักฐานที่บอกว่า ${c.user} ติดตรง ${c.friction} และกระทบงานหลัก`,
        rationale:'ถูก เพราะเริ่มจากอุปสรรคของผู้ใช้และผลต่อ task',
        distractors:[['เลือกจุดที่หน้าตาดูเก่าที่สุดก่อน', 'ผิด เพราะความเก่าไม่เท่ากับ friction หลัก', 'old-looking'], ['เลือกจุดที่ทีมพูดถึงบ่อยที่สุด', 'ผิด เพราะเสียงทีมไม่แทนหลักฐานผู้ใช้', 'team-voice'], ['เลือกจุดที่แก้ได้เร็วที่สุด', 'ผิด เพราะความเร็วไม่บอกผลต่อผู้ใช้', 'easy-fix']]
      },
      goal: {
        correct:`จับ goal ว่า ${c.user} ต้องทำงานใดให้สำเร็จใน ${c.context} และต้องรู้ next step อะไร`,
        rationale:'ถูก เพราะ goal ต้องสัมพันธ์กับงานและผลลัพธ์ของผู้ใช้',
        distractors:[['เลือกสิ่งที่ผู้ใช้ดูเหมือนน่าจะชอบที่สุด', 'ผิด เพราะความชอบไม่ใช่ goal หลัก', 'preference-goal'], ['เลือกข้อมูลที่มีเยอะที่สุดบนหน้า', 'ผิด เพราะข้อมูลเยอะไม่เท่ากับเป้าหมายสำคัญ', 'data-volume'], ['รวมทุกเป้าหมายไว้เท่ากันหมด', 'ผิด เพราะไม่มี priority ให้ผู้ใช้ตัดสินใจ', 'no-priority']]
      },
      impact: {
        correct:`แยกผลกระทบของ ${concept} ว่าทำให้ผู้ใช้สับสน ทำผิด หรือทำ task ไม่สำเร็จอย่างไร`,
        rationale:'ถูก เพราะ impact ต้องอธิบายผลต่อพฤติกรรมผู้ใช้ ไม่ใช่แค่ลักษณะหน้าจอ',
        distractors:[['ถือว่าทุกอย่างเป็นปัญหาความสวยงาม', 'ผิด เพราะ UX มีทั้ง flow, feedback, wording และ structure', 'beauty-only'], ['มองว่าเป็นปัญหาโค้ดทั้งหมด', 'ผิด เพราะ front-end performance ไม่ครอบคลุมความเข้าใจผู้ใช้', 'code-only'], ['ไม่ต้องแยกชั้นปัญหา เพราะสุดท้ายก็แก้หน้าจอเหมือนกัน', 'ผิด เพราะแก้ผิดชั้นทำให้ friction ไม่หาย', 'no-diagnosis']]
      },
      fix: {
        correct:`เลือกแนวทางที่แก้ ${c.friction} โดยเชื่อมจากหลักฐาน → decision → สิ่งที่จะปรับใน ${c.artifact}`,
        rationale:'ถูก เพราะ fix ที่ดีต้องสัมพันธ์กับ friction และนำไปทำ artifact ได้',
        distractors:[['เลือกวิธีที่ทำให้หน้าจอดูทันสมัยที่สุดก่อน', 'ผิด เพราะความสวยไม่พอถ้าไม่แก้ task', 'style-first'], ['เลือกวิธีที่ไม่กระทบงานทีมเลย แม้ผู้ใช้ยังติดเหมือนเดิม', 'ผิด เพราะทีมสะดวกไม่ใช่ user outcome', 'team-convenience'], ['เพิ่มคำอธิบายยาวขึ้นทุกจุด', 'ผิด เพราะอาจเพิ่มภาระการอ่านโดยไม่แก้ต้นเหตุ', 'text-heavy']]
      },
      proof: {
        correct:`พิสูจน์ด้วย task success, เวลา, error, ความเข้าใจ next step หรือผลก่อน-หลังการแก้`,
        rationale:'ถูก เพราะ proof ต้องวัดพฤติกรรมและ outcome ที่ตรวจได้',
        distractors:[['ถามว่าผู้ใช้ชอบดีไซน์ใหม่ไหมอย่างเดียว', 'ผิด เพราะ preference ไม่เท่ากับ usability', 'preference-only'], ['ดูยอดเข้าหน้าเว็บอย่างเดียว', 'ผิด เพราะ traffic ไม่บอกว่า task สำเร็จหรือไม่', 'traffic-only'], ['ให้ทีมโหวตว่าหน้าใหม่ดูดีขึ้นไหม', 'ผิด เพราะ team opinion ไม่ใช่ validation', 'team-vote']]
      }
    };
    const t = templates[kind];
    return {
      kind, label:round,
      prompt:`${node?.type === 'boss' ? 'รอบบอส' : 'รอบภารกิจ'} ${roundIndex + 1}: ${round}`,
      instruction:`สถานการณ์: ${c.context} • โฟกัส: ${concept}`,
      reason: node?.reasonChecks?.[roundIndex % Math.max(1, node.reasonChecks.length)] || 'เหตุผลใดเชื่อมกับหลักฐานผู้ใช้มากที่สุด',
      correct:t.correct, rationale:t.rationale, distractors:t.distractors
    };
  }

  function buildStage(round, caseFile, roundIndex) {
    const model = key === 'w1' ? w1Model(roundIndex, caseFile) : genericModel(round, roundIndex, caseFile);
    const right = opt(`c${roundIndex}`, true, model.correct, model.rationale, '');
    const wrongs = model.distractors.map(([label, rationale, misconception], idx) => opt(`d${roundIndex}-${idx}`, false, label, rationale, misconception));
    return { id:`${key}-stage-${roundIndex + 1}`, kind:model.kind, round:model.label, prompt:model.prompt, instruction:model.instruction, reason:model.reason, options:shuffle([right, ...wrongs]) };
  }

  function makeRun() {
    const caseFile = pickCase();
    const rounds = Array.isArray(node?.missionRounds) && node.missionRounds.length ? node.missionRounds : ['Identify evidence', 'Choose decision', 'Reason check', 'Plan proof'];
    const selectedRounds = node?.type === 'boss' ? rounds.slice(0, 6) : rounds.slice(0, 5);
    state.caseFile = caseFile;
    state.stages = selectedRounds.map((round, idx) => buildStage(round, caseFile, idx));
    Object.assign(state, { current:0, selected:null, verify:null, answered:false, correct:0, verified:0, wrong:0, hints:0, startedAt:Date.now(), history:[] });
  }

  function reasonBank(kind, stage) {
    const banks = {
      friction: [
        ['เหตุผลนี้ชี้ว่าผู้ใช้ติดในขั้นตอนสำคัญ และทำให้งานหลักเดินต่อไม่ได้', 'ถูก เพราะ friction ต้องวัดจาก task failure หรือภาระผู้ใช้', true, ''],
        ['เพราะหน้าจอดูไม่ทันสมัย จึงน่าจะเป็นปัญหาหลัก', 'ผิด เพราะความทันสมัยไม่พิสูจน์ friction', false, 'beauty-bias'],
        ['เพราะทีมคิดว่าจุดนี้น่าจะมีปัญหาที่สุด', 'ผิด เพราะเป็น assumption ของทีม ไม่ใช่หลักฐานผู้ใช้', false, 'team-assumption'],
        ['เพราะระบบอื่นไม่ได้ออกแบบแบบนี้', 'ผิด เพราะการเทียบระบบอื่นไม่พิสูจน์ว่าผู้ใช้ติดจริง', false, 'copy-comparison']
      ],
      goal: [
        ['เหตุผลนี้สอดคล้องกับงานที่ผู้ใช้ต้องทำให้สำเร็จในสถานการณ์นี้', 'ถูก เพราะ user goal ต้องผูกกับ task outcome', true, ''],
        ['เพราะเป็นสิ่งที่ผู้ใช้น่าจะชอบมากที่สุด', 'ผิด เพราะความชอบไม่เท่ากับ goal หลัก', false, 'preference-goal'],
        ['เพราะมีข้อมูลอยู่บนหน้าจอเยอะที่สุด', 'ผิด เพราะข้อมูลเยอะไม่แปลว่าสำคัญที่สุด', false, 'information-volume'],
        ['เพราะการรวมทุกอย่างไว้หน้าแรกจะครอบคลุมกว่า', 'ผิด เพราะครอบคลุมเกินไปทำให้ priority หาย', false, 'everything-first']
      ],
      impact: [
        ['เหตุผลนี้แยกได้ว่าปัญหาอยู่ที่ภาพ/ลำดับข้อมูล, flow หรือ feedback ของระบบ', 'ถูก เพราะ impact ต้องวิเคราะห์ชั้นปัญหาให้ตรงก่อนแก้', true, ''],
        ['เพราะทุกปัญหาบนหน้าจอถือเป็น UI ทั้งหมด', 'ผิด เพราะ UI ไม่ครอบคลุมทุกมิติของ UX', false, 'ui-only'],
        ['เพราะถ้าโค้ดเร็วขึ้น ผู้ใช้จะเข้าใจเอง', 'ผิด เพราะ performance ไม่แก้ความเข้าใจเสมอไป', false, 'performance-only'],
        ['เพราะ UX เป็นเรื่องกว้าง จึงไม่ต้องแยกประเภทปัญหา', 'ผิด เพราะถ้าไม่แยกชั้น จะเลือกวิธีแก้ผิดได้ง่าย', false, 'vague-ux']
      ],
      fix: [
        ['เหตุผลนี้แก้จุดติดขัดหลักและตรวจสอบผลหลังปรับได้', 'ถูก เพราะ fix ต้องโยง friction → decision → expected improvement', true, ''],
        ['เพราะดูสวยและน่าจะทำให้ผู้ใช้รู้สึกดีขึ้น', 'ผิด เพราะความสวยอย่างเดียวไม่พอถ้า task ยังไม่สำเร็จ', false, 'style-first'],
        ['เพราะทีมทำได้เร็วและไม่กระทบโครงสร้างเดิมมาก', 'ผิด เพราะ team convenience ไม่ใช่ user outcome', false, 'team-speed'],
        ['เพราะใส่คำอธิบายเยอะขึ้นน่าจะพอแล้ว', 'ผิด เพราะข้อความยาวอาจเพิ่ม cognitive load', false, 'more-text']
      ],
      proof: [
        ['เหตุผลนี้วัดได้ว่าผู้ใช้ทำงานสำเร็จเร็วขึ้น ผิดน้อยลง หรือเข้าใจขั้นตอนดีขึ้นจริง', 'ถูก เพราะ proof ต้องวัด user outcome', true, ''],
        ['เพราะทีมออกแบบเห็นว่าหน้าใหม่ดูดีขึ้น', 'ผิด เพราะความเห็นทีมไม่ใช่หลักฐานการใช้งาน', false, 'team-opinion'],
        ['เพราะมีคนเข้าเว็บมากขึ้นหลังปรับหน้า', 'ผิด เพราะ traffic ไม่เท่ากับ task success', false, 'traffic-only'],
        ['เพราะผู้ใช้เลือกว่าชอบดีไซน์ใหม่มากกว่า', 'ผิด เพราะ preference ไม่เท่ากับ usability', false, 'preference-test']
      ]
    };
    return (banks[kind] || banks.fix).map(([label, rationale, correct, misconception], idx) => opt(`reason-${stage.id}-${idx}`, correct, label, rationale, misconception));
  }

  function buildReasonChoices(stage) { return shuffle(reasonBank(stage.kind, stage)); }

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
    const sample = node?.seedCases?.[0] || {};
    return `<div class="shell"><div class="top"><a class="brand" href="${missionControlUrl()}"><span class="mark">UX</span><span>CSAI2601 UX Quest</span></a><span class="pill">v1.2 • ${esc(node?.id || '')}</span></div><section class="panel ${canPlay() ? '' : 'lock'}"><div class="hero"><p class="kicker">${node?.type === 'boss' ? 'BOSS GATE' : 'WEEKLY MISSION'} • ${esc(node?.id || '')}</p><h1 class="title">${esc(node?.missionTitle || node?.title || 'CSAI2601')}</h1><p class="lede">${esc(node?.focus || '')}</p><div class="briefs"><div class="brief"><b>Concept</b><span>${esc((node?.concepts || []).slice(0, 5).join(' • ') || node?.title || '')}</span></div><div class="brief"><b>Case</b><span>${esc(node?.casePrompt || node?.bossScenario || sample.context || 'วิเคราะห์สถานการณ์ UX/UI จากหลักฐาน')}</span></div><div class="brief"><b>Artifact</b><span>${esc(node?.artifact || 'Studio artifact')}</span></div></div>${record.bestStars ? `<p class="lede">สถิติดีที่สุดเดิม: ${starsText(record.bestStars)} • score ${Number(record.bestScore || 0)} • เล่นซ้ำเพื่อเจอ case variant ใหม่ได้</p>` : ''}${canPlay() ? `<div class="actions"><button class="btn" data-start>เริ่ม ${esc(node?.id || '')} →</button><a class="btn secondary" href="${missionControlUrl()}">กลับ Mission Control</a></div>` : `<p class="lede">ด่านนี้ยังล็อกอยู่ ต้องผ่าน ${esc(previous?.id || 'ด่านก่อนหน้า')} ที่ 2★ ก่อน</p><div class="actions"><a class="btn warn" href="${urlForNode(previous?.id || 'W1')}">ไปด่านก่อนหน้า</a><a class="btn secondary" href="${missionControlUrl()}">กลับ Mission Control</a></div>`}</div></section></div>`;
  }

  function game() {
    const stage = state.stages[state.current];
    const progressPct = pct(state.current, state.stages.length);
    return `<div class="shell"><div class="top"><a class="brand" href="${missionControlUrl()}"><span class="mark">UX</span><span>${esc(node?.id || '')} • ${esc(node?.missionTitle || node?.title || '')}</span></a><span class="pill">Case ${esc(state.caseFile?.id || '')}</span></div><section class="panel"><div class="hud"><div class="meter"><small>Progress</small><b>${state.current + 1}/${state.stages.length} • ${esc(stage.round)}</b><div class="bar"><i style="width:${progressPct}%"></i></div></div><div class="meter"><small>Correct</small><b>${state.correct}</b></div><div class="meter"><small>Reason</small><b>${state.verified}</b></div><div class="meter"><small>Hints</small><b>${state.hints}</b></div></div><div class="game"><div class="case"><p class="kicker">${esc(stage.round)} • ${esc(stage.kind)}</p><h1>${esc(stage.prompt)}</h1><p>${esc(stage.instruction)}</p></div><div class="question"><p class="prompt">เลือกคำตอบที่ตรงกับหน้าที่ของข้อนี้ที่สุด</p><p class="instruction">แต่ละข้อวัดคนละทักษะ และ Reason Check จะเปลี่ยนตามชนิดข้อ ไม่ใช้เหตุผลชุดเดิมวนซ้ำ</p><div class="options">${stage.options.map((item) => `<button class="option ${state.selected === item.id ? 'pick' : ''}" data-choice="${esc(item.id)}" ${state.answered || state.verify ? 'disabled' : ''}><b>${esc(item.label)}</b><span>${esc(item.misconception ? `กับดัก: ${item.misconception}` : 'เชื่อมกับหลักฐานและ artifact')}</span></button>`).join('')}</div>${state.verify ? verifyBox(stage) : ''}${state.answered ? feedbackBox() : ''}<div class="utility"><div class="hint">คำใบ้: ${esc(stage.reason)} ${state.hints ? '• เปิด hint แล้ว คะแนน reasoning ยังผ่านได้ แต่ 3★ ต้องแม่นจริง' : ''}</div><button class="btn secondary" data-hint ${state.answered ? 'disabled' : ''}>ขอคำใบ้</button></div></div></div></section></div>`;
  }

  function verifyBox(stage) {
    return `<section class="verify"><h3>ตรวจเหตุผล</h3><p>${esc(stage.reason)}</p><div class="options">${state.verify.reasons.map((reason) => `<button class="option" data-reason="${esc(reason.id)}"><b>${esc(reason.label)}</b><span>${esc(reason.rationale)}${reason.misconception ? ` • กับดัก: ${esc(reason.misconception)}` : ''}</span></button>`).join('')}</div></section>`;
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
    const artifactFields = node?.artifactChecklist || ['หลักฐานจากผู้ใช้', 'สิ่งที่เลือกออกแบบ/แก้ไข', 'วิธีพิสูจน์ผล'];
    try { window.UXQProgress?.recordMission?.(key, { score, stars, accuracy, correct:state.correct, total, hints:state.hints, durationSec, passed:passedNode, badge:`${node.id} ${node.missionTitle || node.title}` }); }
    catch (error) { console.warn('[CSAI2601 Canonical Node] progress record failed', error); }
    return `<div class="shell"><section class="panel"><div class="results"><div class="stars">${starsText(stars)}</div><h1>${passedNode ? `${esc(node.id)} ผ่านแล้ว` : `${esc(node.id)} ยังควร Retry`}</h1><p>${passedNode ? 'ปลดล็อกด่านถัดไปได้แล้ว เล่นซ้ำเพื่อเจอ case variant ใหม่และเพิ่มความแม่นยำด้าน Reason Check ได้' : 'ควรเล่นซ้ำโดยใช้หลักฐานจาก case, concept และ artifact เป็นแกน'}</p><div class="result-grid"><div><b>${score}</b><span>Score</span></div><div><b>${accuracy}%</b><span>Accuracy</span></div><div><b>${reasonPct}%</b><span>Reason</span></div><div><b>${state.hints}</b><span>Hints</span></div><div><b>${fmt(durationSec)}</b><span>Time</span></div></div><section class="artifact"><p class="kicker">Studio Artifact</p><h2>${esc(node.artifact || 'Artifact')}</h2><p>นำผลการเล่นไปเติมใบงาน/portfolio ตามหัวข้อต่อไปนี้</p>${artifactFields.slice(0, 5).map((field, idx) => `<label><b>${esc(field)}</b><textarea data-artifact-field="${idx}" placeholder="เขียนสิ่งที่ตัดสินใจจากหลักฐาน ไม่ใช่แค่คำตอบที่เลือก"></textarea></label>`).join('')}<div class="actions"><button class="btn secondary" data-save-artifact>บันทึก note ในเครื่อง</button><small data-save-status></small></div></section><section class="takeaway"><b>สิ่งที่ Dashboard/ครูควรเห็นจากด่านนี้</b><ul>${(node.dashboardEvidence || []).slice(0, 8).map((item) => `<li>${esc(item)}</li>`).join('')}</ul></section><div class="actions"><button class="btn" data-retry>เล่นซ้ำด้วย case ใหม่</button>${next ? `<a class="btn ${passedNode ? '' : 'disabled'}" href="${urlForNode(next.id)}">ไปต่อ ${esc(next.id)} →</a>` : ''}<a class="btn secondary" href="${missionControlUrl()}">กลับ Mission Control</a></div></div></section></div>`;
  }

  function errorScreen(message) { return `<div class="shell"><section class="panel lock"><div class="hero"><p class="kicker">CSAI2601 UX Quest</p><h1 class="title">ยังเปิดด่านนี้ไม่ได้</h1><p class="lede">${esc(message)}</p><div class="actions"><a class="btn" href="${missionControlUrl()}">กลับ Mission Control</a></div></div></section></div>`; }
  function saveArtifact() {
    const values = {};
    root.querySelectorAll('textarea[data-artifact-field]').forEach((field) => { values[field.dataset.artifactField] = field.value.trim(); });
    try {
      localStorage.setItem(`csai2601.uxq.artifact.${key}.v2`, JSON.stringify({ nodeId:node.id, savedAt:new Date().toISOString(), values }));
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
    if (choice.correct) { state.verify = { option:choice, reasons:buildReasonChoices(stage) }; render(); }
    else { state.wrong += 1; state.answered = true; state.history.push({ correct:false, verified:false, rationale:choice.rationale }); render(); }
  }
  function chooseReason(id) {
    if (!state.verify || state.answered) return;
    const reason = state.verify.reasons.find((item) => item.id === id);
    if (!reason) return;
    state.correct += 1;
    if (reason.correct) state.verified += 1; else state.wrong += 1;
    state.history.push({ correct:reason.correct, verified:reason.correct, rationale:reason.rationale });
    state.verify = null; state.answered = true; render();
  }
  function nextStage() {
    if (state.current >= state.stages.length - 1) state.screen = 'results';
    else Object.assign(state, { current:state.current + 1, selected:null, verify:null, answered:false });
    render();
  }
  render();
})();
