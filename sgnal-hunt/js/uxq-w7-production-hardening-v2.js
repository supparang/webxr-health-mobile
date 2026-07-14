/* CSAI2601 UX Quest • W7 Production Hardening v2
 * - Removes longest-option answer cues from W7 without changing scoring wiring.
 * - Replaces repeated Reason Check wording with stage-specific evidence reasoning.
 * - Sends mission_completed and structured Wireframe Priority Sheet to Google Sheet.
 * - localStorage is used only for an unsent queue/cache, never as official completion.
 */
(() => {
  'use strict';

  const query = new URLSearchParams(location.search || '');
  if (String(query.get('node') || '').toUpperCase() !== 'W7') return;

  const VERSION = 'w7-production-v2-20260714';
  const QUEUE_KEY = 'csai2601.uxq.sheet.pending.v3';
  const SENT_KEY = 'csai2601.uxq.sheet.sent.v3';
  const config = () => window.UXQ_CLASSROOM_CONFIG || {};
  const endpoint = () => String(config().receiverUrl || '').trim();
  const clean = (v, n = 1200) => String(v == null ? '' : v).trim().slice(0, n);

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || ''); } catch (_) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  }
  function uid(prefix) {
    const rand = window.crypto?.getRandomValues
      ? (() => { const a = new Uint32Array(2); crypto.getRandomValues(a); return a[0].toString(36) + a[1].toString(36); })()
      : Math.random().toString(36).slice(2);
    return `${prefix}-${Date.now().toString(36)}-${rand}`;
  }
  function stable(parts) {
    return parts.map(v => clean(v, 100).toLowerCase().replace(/[^a-z0-9ก-๙_-]+/gi, '-')).filter(Boolean).join('-').slice(0, 158);
  }
  function profile() {
    let p = {};
    try { p = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    if (!p.studentId) p = read('uxq.classroom.profile.v1', {}) || {};
    return {
      studentId: clean(p.studentId || query.get('studentId') || query.get('sid'), 80),
      studentName: clean(p.studentName || query.get('studentName') || query.get('name'), 120),
      section: clean(p.section || query.get('section') || config().defaultSection, 80)
    };
  }
  function profileComplete(p) { return Boolean(p.studentId && p.studentName && p.section); }

  function status(message, tone = '') {
    let el = document.querySelector('[data-save-status]');
    const artifact = document.querySelector('.artifact');
    if (!el && artifact) {
      el = document.createElement('div');
      el.setAttribute('data-save-status', '');
      el.style.cssText = 'margin-top:8px;padding:10px 12px;border:1px solid rgba(110,231,255,.38);border-radius:12px;background:rgba(7,17,36,.55);font-weight:800;line-height:1.45';
      (artifact.querySelector('.actions') || artifact).appendChild(el);
    }
    if (el) {
      el.textContent = message;
      el.dataset.tone = tone;
    }
  }

  function queue(item) {
    const list = read(QUEUE_KEY, []);
    const next = (Array.isArray(list) ? list : []).concat(item).slice(-40);
    write(QUEUE_KEY, next);
    return next.length;
  }
  function send(item) {
    const url = endpoint();
    if (!url) return Promise.resolve({ ok:false, state:'no_endpoint' });
    return fetch(url, {
      method:'POST', mode:'no-cors', cache:'no-store', keepalive:true,
      headers:{ 'Content-Type':'text/plain;charset=UTF-8' },
      body:JSON.stringify(item)
    }).then(() => ({ ok:true, state:'dispatched' }))
      .catch(error => ({ ok:false, state:'queued', count:queue(item), error:String(error?.message || error) }));
  }
  async function flushQueue() {
    const list = read(QUEUE_KEY, []);
    if (!Array.isArray(list) || !list.length || !endpoint()) return;
    write(QUEUE_KEY, []);
    for (const item of list) {
      const out = await send(item);
      if (!out.ok) queue(item);
    }
  }

  const MAIN = [
    {
      title:'Set visual priority',
      correct:'จัดลำดับจากงานหลักของผู้ใช้ แล้วทำสถานะและสิ่งที่ต้องทำถัดไปให้มองเห็นก่อน',
      wrong:[
        'จัดลำดับจากปริมาณเนื้อหา โดยให้ส่วนที่มีข้อความมากที่สุดอยู่ก่อน',
        'จัดลำดับจากความต้องการของทีม โดยวางส่วนที่แก้ไขง่ายที่สุดไว้ก่อน',
        'จัดลำดับจากภาพลักษณ์ โดยให้ส่วนที่ดูโดดเด่นที่สุดเป็นจุดเริ่มต้น'
      ]
    },
    {
      title:'Choose wireframe layout',
      correct:'เลือกโครงที่ทำให้ผู้ใช้เห็นข้อมูลตัดสินใจและขั้นตอนหลักในลำดับเดียวกัน',
      wrong:[
        'เลือกโครงที่แยกข้อมูลทุกประเภทเป็นคนละหน้าเพื่อลดความหนาแน่น',
        'เลือกโครงที่แสดงรายละเอียดครบทุกส่วนพร้อมกันเพื่อลดจำนวนการคลิก',
        'เลือกโครงที่ใช้รูปแบบคุ้นเคยของทีมแม้ลำดับงานผู้ใช้ยังเหมือนเดิม'
      ]
    },
    {
      title:'Pick primary CTA',
      correct:'ใช้ CTA หลักหนึ่งจุดที่ตรงกับ next step และแสดงเมื่อข้อมูลจำเป็นพร้อมแล้ว',
      wrong:[
        'ใช้ CTA หลายจุดน้ำหนักเท่ากันเพื่อให้ผู้ใช้เลือกเส้นทางได้อิสระ',
        'ใช้ CTA ตั้งแต่ต้นหน้าเพื่อเร่งให้ผู้ใช้เริ่มก่อนตรวจข้อมูลประกอบ',
        'ใช้ CTA หลังรายละเอียดทั้งหมดเพื่อให้ผู้ใช้อ่านครบก่อนตัดสินใจเสมอ'
      ]
    },
    {
      title:'Adapt mobile layout',
      correct:'คงลำดับงานเดิมบนมือถือ ย่อข้อมูลรอง และรักษา CTA กับสถานะไว้ใกล้จุดตัดสินใจ',
      wrong:[
        'ย้ายทุกส่วนเป็นการ์ดเท่ากันบนมือถือเพื่อให้รูปแบบสม่ำเสมอ',
        'ซ่อนรายละเอียดทั้งหมดบนมือถือแล้วให้ผู้ใช้เปิดหน้าเดสก์ท็อปแทน',
        'ลดขนาดทุกองค์ประกอบตามสัดส่วนเดิมเพื่อให้เนื้อหาครบในจอเดียว'
      ]
    },
    {
      title:'Avoid hierarchy trap',
      correct:'ตรวจว่าลำดับภาพช่วยให้ผู้ใช้รู้สถานะ สิ่งสำคัญ และการกระทำถัดไปโดยไม่ต้องเดา',
      wrong:[
        'ตรวจว่าหน้าจอมีองค์ประกอบครบตามรายการที่ทีมกำหนดไว้หรือไม่',
        'ตรวจว่าทุกส่วนมีน้ำหนักใกล้กันเพื่อไม่ให้ข้อมูลใดถูกมองข้าม',
        'ตรวจว่ารูปแบบภาพทันสมัยและสอดคล้องกับหน้าจอยอดนิยมในตลาด'
      ]
    }
  ];

  const REASONS = [
    {
      correct:'ลำดับนี้อ้างอิง task และผลกระทบ จึงอธิบายได้ว่าผู้ใช้ควรเห็นอะไรเป็นอันดับแรก',
      wrong:[
        'ลำดับนี้ช่วยให้หน้าจอดูเป็นระเบียบ แม้ยังไม่ทราบว่างานใดสำคัญกว่า',
        'ลำดับนี้ลดเวลาพัฒนา เพราะใช้โครงสร้างเดิมของทีมได้เกือบทั้งหมด',
        'ลำดับนี้ทำให้ข้อมูลครบในหน้าเดียว จึงไม่จำเป็นต้องทดสอบกับผู้ใช้'
      ]
    },
    {
      correct:'โครงนี้เชื่อม goal กับ content hierarchy และทำให้เส้นทางตัดสินใจตรวจสอบได้',
      wrong:[
        'โครงนี้ใช้พื้นที่ได้เต็มจอ จึงน่าจะเหมาะกับเนื้อหาทุกประเภท',
        'โครงนี้มีส่วนประกอบจำนวนมาก จึงรองรับความต้องการในอนาคตได้ดีกว่า',
        'โครงนี้คล้ายเว็บไซต์ที่คุ้นเคย จึงถือว่าเหมาะโดยไม่ต้องดู task'
      ]
    },
    {
      correct:'CTA นี้สัมพันธ์กับ next step และมีเงื่อนไขพร้อม จึงลดการกดผิดและการย้อนกลับ',
      wrong:[
        'CTA นี้เด่นที่สุดในหน้า จึงเพียงพอที่จะทำให้ผู้ใช้เข้าใจขั้นตอนทั้งหมด',
        'CTA นี้อยู่ตำแหน่งเดิมทุกจอ จึงเหมาะโดยไม่ต้องพิจารณาบริบทของงาน',
        'CTA นี้ใช้ข้อความสั้น จึงดีกว่า CTA ที่อธิบายผลลัพธ์ของการกด'
      ]
    },
    {
      correct:'การปรับนี้รักษา task order และ decision point แม้พื้นที่จอเปลี่ยน จึงยังทำงานต่อได้',
      wrong:[
        'การปรับนี้ทำให้ทุกการ์ดขนาดเท่ากัน จึงถือว่าลำดับข้อมูลชัดเจนแล้ว',
        'การปรับนี้ลดจำนวนข้อความมากที่สุด จึงเหมาะกับผู้ใช้มือถือทุกกรณี',
        'การปรับนี้ใช้รูปแบบเดียวกับเดสก์ท็อป จึงลดภาระการเรียนรู้โดยอัตโนมัติ'
      ]
    },
    {
      correct:'เกณฑ์นี้ตรวจจากสิ่งที่ผู้ใช้มองเห็นและทำต่อได้ จึงทดสอบ hierarchy เป็นพฤติกรรมได้',
      wrong:[
        'เกณฑ์นี้ตรวจจากความครบขององค์ประกอบ จึงไม่จำเป็นต้องวัด task success',
        'เกณฑ์นี้ตรวจจากความสวยงามโดยรวม ซึ่งเป็นตัวแทน usability ได้เพียงพอ',
        'เกณฑ์นี้ตรวจจากความเห็นของทีม เพราะทีมรู้ข้อจำกัดของระบบดีที่สุด'
      ]
    }
  ];

  function stageIndex() {
    const text = clean(document.querySelector('.hud .meter b, .case h1')?.textContent || '', 200);
    const m = text.match(/([1-5])\s*\/\s*5|รอบภารกิจ\s*([1-5])/i);
    return Math.max(0, Math.min(4, Number(m?.[1] || m?.[2] || 1) - 1));
  }
  function findCorrect(buttons, reasonMode) {
    const patterns = reasonMode
      ? [/เหตุผลนี้/, /task outcome/, /friction.*decision/, /แยก.*ปัญหา/, /ตรวจสอบผล/]
      : [/เชื่อมกับหลักฐานและ artifact/, /เลือกแนวทางที่แก้/, /แยกผลกระทบของ/, /พิสูจน์ด้วย/, /จับ goal ว่า/];
    return buttons.find(btn => patterns.some(re => re.test(clean(btn.textContent, 1200)))) || buttons[0];
  }
  function rewriteGroup(container, model, reasonMode) {
    if (!container || container.dataset.w7Production === VERSION) return;
    const buttons = Array.from(container.querySelectorAll(':scope > .option, :scope > button.option'));
    if (buttons.length !== 4) return;
    const correctButton = findCorrect(buttons, reasonMode);
    const wrongButtons = buttons.filter(btn => btn !== correctButton);
    const labels = [model.correct, ...model.wrong];
    const assignment = new Map([[correctButton, labels[0]]]);
    wrongButtons.forEach((btn, i) => assignment.set(btn, labels[i + 1]));
    buttons.forEach(btn => {
      const b = btn.querySelector('b') || btn;
      const span = btn.querySelector('span');
      b.textContent = assignment.get(btn) || clean(btn.textContent, 500);
      if (span) span.textContent = reasonMode ? 'พิจารณาความเชื่อมโยงกับหลักฐานและผลต่อผู้ใช้' : 'พิจารณาความเหมาะสมกับสถานการณ์นี้';
    });
    container.dataset.w7Production = VERSION;
  }
  function hardenQuestions() {
    const idx = stageIndex();
    const question = document.querySelector('.question');
    if (!question) return;
    const main = question.querySelector('.options');
    rewriteGroup(main, MAIN[idx], false);
    const verify = question.querySelector('.verify .options');
    rewriteGroup(verify, REASONS[idx], true);
    const hint = question.querySelector('.hint');
    if (hint && !hint.dataset.w7Hint) {
      hint.textContent = `คำใบ้: ใช้ Issue → Goal → Priority ของ case นี้ตัดสิน ${MAIN[idx].title} อย่าตัดสินจากความยาวของตัวเลือก`;
      hint.dataset.w7Hint = '1';
    }
  }

  function fields() {
    const areas = Array.from(document.querySelectorAll('.artifact textarea'));
    const names = ['fiveScreens','gridSpacing','visualHierarchy','ctaPlacement','mobileConsideration'];
    const out = {};
    areas.slice(0, 5).forEach((area, i) => { out[names[i]] = clean(area.value, 1800); });
    return out;
  }
  function validateArtifact(data) {
    const entries = Object.entries(data);
    const missing = entries.filter(([, v]) => v.length < 20).map(([k]) => k);
    return { ok:missing.length === 0, missing };
  }
  function result() {
    try { return window.UXQProgress?.get?.()?.missions?.w7?.lastResult || {}; } catch (_) { return {}; }
  }
  function base(eventType, schema) {
    const p = profile();
    const now = new Date().toISOString();
    return {
      app:'ux-quest', schema, eventType,
      eventId:uid(eventType === 'artifact_submitted' ? 'w7-artifact' : 'w7-mission'),
      attemptId:uid('w7-attempt'),
      occurredAt:now, completedAt:now,
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Bangkok',
      pageUrl:clean(location.href, 500),
      courseId:clean(config().courseId || 'UXQ-ACT1-2026', 120),
      courseLabel:clean(config().courseLabel || 'CSAI2601 • UX Quest', 160),
      studentId:p.studentId, studentName:p.studentName, section:p.section,
      nodeId:'W7', missionId:'w7', missionTitle:'W7 • Wireframe Forge',
      source:VERSION
    };
  }
  function missionPayload() {
    const r = result();
    if (!Number(r.total || 0)) return null;
    const item = Object.assign(base('mission_completed', 'uxq.mission.v3'), {
      score:Number(r.score || 0), stars:Number(r.stars || 0), accuracy:Number(r.accuracy || 0),
      correct:Number(r.correct || 0), total:Number(r.total || 0), hints:Number(r.hints || 0),
      durationSec:Number(r.durationSec || 0), passed:Boolean(r.passed),
      verifiedCorrect:Number(r.correct || 0), verifiedTotal:Number(r.total || 0), verifiedAccuracy:Number(r.accuracy || 0),
      badge:clean(r.badge || 'W7 Wireframe Forge', 120), caseIds:[]
    });
    item.eventId = stable(['mission', item.courseId, item.section, item.studentId, 'w7', r.completedAt || item.completedAt, item.score, item.stars]);
    item.attemptId = item.eventId;
    return item;
  }
  function artifactPayload(data) {
    const r = result();
    const item = Object.assign(base('artifact_submitted', 'uxq.artifact.w7.v3'), {
      artifactSubmitted:true,
      artifactType:'wireframe_priority_sheet',
      problemSeen:data.fiveScreens,
      uxReason:data.visualHierarchy,
      fixAndTest:[data.gridSpacing, data.ctaPlacement, data.mobileConsideration].join(' | '),
      reflection:Object.values(data).join(' | '),
      learnedPoint:data.visualHierarchy,
      artifactFields:Object.entries(data).map(([key, value]) => ({ key, value })),
      score:Number(r.score || 0), stars:Number(r.stars || 0), accuracy:Number(r.accuracy || 0),
      correct:Number(r.correct || 0), total:Number(r.total || 0), hints:Number(r.hints || 0),
      durationSec:Number(r.durationSec || 0), passed:Boolean(r.passed)
    });
    return item;
  }
  function autoMission() {
    if (!document.querySelector('.results')) return;
    const p = profile();
    if (!profileComplete(p)) { status('ยังไม่ส่ง Sheet: กรุณากลับ Mission Control และกรอกชื่อ รหัส และ Section ให้ครบ', 'error'); return; }
    const item = missionPayload();
    if (!item) return;
    const sent = read(SENT_KEY, {});
    if (sent[item.eventId]) return;
    sent[item.eventId] = new Date().toISOString();
    write(SENT_KEY, sent);
    status('กำลังส่งผล W7 เข้า Google Sheet...');
    send(item).then(out => status(out.ok ? 'ส่งผล W7 เข้า Google Sheet แล้ว' : `ยังส่งไม่ได้ • เก็บคิวชั่วคราว ${out.count || 1} รายการ`, out.ok ? 'ok' : 'error'));
  }
  function hardenArtifact() {
    const artifact = document.querySelector('.artifact');
    if (!artifact) return;
    const button = artifact.querySelector('[data-save-artifact]');
    if (button) {
      button.textContent = 'ส่ง Wireframe Priority Sheet เข้า Google Sheet';
      button.classList.remove('secondary');
    }
    artifact.querySelectorAll('p').forEach(p => {
      p.textContent = p.textContent.replace(/บันทึก note ในเครื่อง/g, 'ส่งเป็นหลักฐานเข้า Google Sheet').replace(/กรอกสั้น ๆ/g, 'กรอกให้เห็นการตัดสินใจจากหลักฐาน');
    });
  }
  function interceptArtifact(event) {
    const button = event.target.closest?.('[data-save-artifact]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const p = profile();
    if (!profileComplete(p)) { status('ส่งไม่ได้: โปรไฟล์ผู้เรียนไม่ครบ กรุณากลับ Mission Control แล้วกรอกข้อมูลก่อน', 'error'); return; }
    const data = fields();
    const check = validateArtifact(data);
    if (!check.ok) { status(`กรอกแต่ละช่องอย่างน้อย 20 ตัวอักษร • ยังขาด ${check.missing.length} ช่อง`, 'error'); return; }
    button.disabled = true;
    status('กำลังส่ง Wireframe Priority Sheet เข้า Google Sheet...');
    send(artifactPayload(data)).then(out => {
      button.disabled = false;
      status(out.ok ? 'ส่ง Wireframe Priority Sheet เข้า Google Sheet แล้ว' : `เครือข่ายขัดข้อง • เก็บคิวชั่วคราว ${out.count || 1} รายการ`, out.ok ? 'ok' : 'error');
    });
  }

  let timer = 0;
  function run() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      hardenQuestions();
      hardenArtifact();
      autoMission();
    }, 40);
  }

  document.addEventListener('click', interceptArtifact, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once:true }); else run();
  window.addEventListener('online', flushQueue);
  window.addEventListener('pageshow', flushQueue);
  new MutationObserver(run).observe(document.documentElement, { childList:true, subtree:true });
  window.UXQW7ProductionV2 = Object.freeze({ version:VERSION, missionPayload, artifactPayload, flushQueue });
})();