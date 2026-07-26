/* =========================================================
 * CSAI2601 UX Quest • W1 Complete / Replay Authority v1
 * Purpose:
 * - Present a completed Master Figma Project as connected, not uncreated.
 * - Make a passed W1 replay unmistakably a practice replay.
 * - Harmonize the Mission card with Studio/Reflection when Sheet confirms 3/3.
 * - Preserve Google Sheet as the sole authority; this file changes presentation only.
 * ========================================================= */
(() => {
  'use strict';

  const VERSION = '20260726-W1-COMPLETE-REPLAY-AUTHORITY-V1';
  const ROOT_SELECTOR = '#uxqCanonicalNode, body';

  function text(node) {
    return String(node && node.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function isW1() {
    const q = new URLSearchParams(location.search || '');
    return String(q.get('node') || '').trim().toLowerCase() === 'w1';
  }

  function allThreeConfirmed() {
    const bodyText = text(document.body);
    return /3\/3\s*ยืนยันจากระบบ/i.test(bodyText) ||
      /ครบทั้ง\s*3\s*ส่วนแล้ว/i.test(bodyText);
  }

  function bestResult() {
    const bodyText = text(document.body);
    const starsMatch = bodyText.match(/ผลดีที่สุด\s*(\d)\/3\s*ดาว/i) ||
      bodyText.match(/ดีที่สุด\s*(\d)\/3\s*ดาว/i);
    const scoreMatch = bodyText.match(/(?:ผลดีที่สุด[^•]*•\s*)?([\d,]+)\s*คะแนน/i);
    return {
      stars: starsMatch ? Number(starsMatch[1]) : 0,
      score: scoreMatch ? scoreMatch[1] : ''
    };
  }

  function style() {
    if (document.getElementById('uxqW1CompleteReplayStyleV1')) return;
    const el = document.createElement('style');
    el.id = 'uxqW1CompleteReplayStyleV1';
    el.textContent = `
      .uxq-w1-connected{border-color:rgba(68,224,164,.62)!important;box-shadow:0 0 0 1px rgba(68,224,164,.12) inset!important}
      .uxq-w1-connected [data-uxq-connected-title]{color:#bfffe2!important}
      .uxq-w1-connected .uxq-w1-create-hidden{display:none!important}
      .uxq-w1-connected-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:12px}
      .uxq-w1-connected-actions button,.uxq-w1-connected-actions a{min-height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;text-decoration:none;font-weight:800}
      .uxq-w1-connected-badge{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:999px;background:rgba(45,211,145,.14);border:1px solid rgba(45,211,145,.42);color:#bfffe2;font-weight:800;font-size:.83rem}
      .uxq-w1-replay-banner{margin:12px 0 16px;padding:12px 14px;border:1px solid rgba(96,220,255,.42);border-radius:14px;background:linear-gradient(90deg,rgba(34,137,196,.18),rgba(93,72,196,.16));color:#e9fbff;display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-weight:700}
      .uxq-w1-replay-banner strong{color:#7feaff}
      .uxq-w1-complete-card{border-color:rgba(45,211,145,.72)!important;background:rgba(20,91,76,.22)!important;box-shadow:0 0 0 1px rgba(45,211,145,.10) inset!important}
      .uxq-w1-complete-card::before{content:'✓ ';color:#67efbb;font-weight:900}
      .uxq-w1-next-wrap{display:flex;justify-content:center;margin:16px 0 6px}
      .uxq-w1-next-link{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border-radius:14px;background:linear-gradient(90deg,#65dcf4,#72e9a7);color:#061126!important;text-decoration:none;font-weight:900;box-shadow:0 10px 28px rgba(75,216,205,.18)}
      @media(max-width:760px){.uxq-w1-connected-actions{grid-template-columns:1fr}.uxq-w1-replay-banner{align-items:flex-start}.uxq-w1-next-link{width:100%}}
    `;
    document.head.appendChild(el);
  }

  function findFigmaPanel() {
    const candidates = [...document.querySelectorAll('section,article,div,form')];
    return candidates.find(el => {
      const t = text(el);
      return t.includes('Master Figma Project') &&
        (el.querySelector('input') || el.querySelector('textarea')) &&
        t.length < 1800;
    }) || null;
  }

  function inputValue(panel, hints) {
    const fields = [...panel.querySelectorAll('input,textarea')];
    const field = fields.find(el => {
      const key = `${el.id || ''} ${el.name || ''} ${el.placeholder || ''}`.toLowerCase();
      return hints.some(h => key.includes(h));
    });
    return String(field && field.value || '').trim();
  }

  function enhanceFigmaPanel() {
    const panel = findFigmaPanel();
    if (!panel) return;

    const projectId = inputValue(panel, ['project']);
    const figmaUrl = inputValue(panel, ['figma']);
    const readyText = text(panel);
    const connected = Boolean(projectId && /^https?:\/\//i.test(figmaUrl)) ||
      /พร้อมใช้งานและพร้อมส่ง/i.test(readyText);
    if (!connected) return;

    panel.classList.add('uxq-w1-connected');
    panel.dataset.uxqW1Connected = '1';

    const headings = [...panel.querySelectorAll('h1,h2,h3,h4,strong,b')];
    const heading = headings.find(el => /สร้าง Master Figma Project/i.test(text(el)));
    if (heading) {
      heading.textContent = 'Master Figma Project เชื่อมต่อแล้ว';
      heading.setAttribute('data-uxq-connected-title', '1');
    }

    const description = [...panel.querySelectorAll('p,small,div')].find(el =>
      el.children.length === 0 && /สร้าง Project หลักใน W1/i.test(text(el))
    );
    if (description) description.textContent = 'ใช้ Project เดิมต่อเนื่องตั้งแต่ W1 ถึง W15 • ระบบบันทึกลิงก์เรียบร้อยแล้ว';

    const createButton = [...panel.querySelectorAll('button,a')].find(el => /สร้าง Master Figma Project/i.test(text(el)));
    if (createButton) {
      createButton.textContent = '✓ เชื่อมต่อแล้ว';
      createButton.classList.add('uxq-w1-create-hidden');
      if ('disabled' in createButton) createButton.disabled = true;
    }

    let badge = panel.querySelector('.uxq-w1-connected-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'uxq-w1-connected-badge';
      badge.textContent = `✓ Connected${projectId ? ' • ' + projectId : ''}`;
      const title = heading || panel.firstElementChild;
      if (title && title.parentNode) title.parentNode.insertBefore(badge, title.nextSibling);
    }

    const statusLeaf = [...panel.querySelectorAll('div,p,small')].find(el =>
      el.children.length === 0 && /Project, Figma.*พร้อมใช้งาน/i.test(text(el))
    );
    if (statusLeaf) statusLeaf.textContent = '✓ Project และ Figma พร้อมใช้งาน • ส่งหลักฐานเพิ่มเติมได้เมื่อจำเป็น';
  }

  function trackerCards() {
    const candidates = [...document.querySelectorAll('div,section,article')];
    const tracker = candidates.find(el => {
      const t = text(el);
      return /ตรวจความครบ\s*3\s*ส่วน/i.test(t) &&
        t.includes('Mission / Game') && t.includes('Studio Practice') && t.includes('Weekly Reflection') &&
        t.length < 2400;
    });
    if (!tracker) return [];
    return [...tracker.querySelectorAll('div,article,section')].filter(el => {
      const t = text(el);
      return (/Mission \/ Game/i.test(t) || /Studio Practice/i.test(t) || /Weekly Reflection/i.test(t)) && t.length < 700;
    });
  }

  function harmonizeTracker() {
    if (!allThreeConfirmed()) return;
    const cards = trackerCards();
    cards.forEach(card => card.classList.add('uxq-w1-complete-card'));

    const mission = cards.find(card => /Mission \/ Game/i.test(text(card)));
    if (mission) {
      const leaves = [...mission.querySelectorAll('div,p,span,small')].filter(el => el.children.length === 0);
      const status = leaves.find(el => /ผ่านในเครื่อง|รอ Sheet|เล่นแล้ว/i.test(text(el)));
      if (status) status.textContent = 'ยืนยันแล้ว • Google Sheet รับรองผลดีที่สุด';
    }
  }

  function missionArea() {
    const nodes = [...document.querySelectorAll('section,article,div')];
    return nodes.find(el => {
      const t = text(el);
      return t.includes('UX Problem Scanner') && t.includes('PROGRESS') && t.includes('CORRECT') && t.length < 6000;
    }) || null;
  }

  function addReplayMode() {
    if (!allThreeConfirmed()) return;
    const area = missionArea();
    if (!area || area.querySelector('.uxq-w1-replay-banner')) return;
    const result = bestResult();
    const banner = document.createElement('div');
    banner.className = 'uxq-w1-replay-banner';
    banner.innerHTML = `<strong>REPLAY / PRACTICE MODE</strong><span>W1 ผ่านครบแล้ว • รอบนี้เป็นการฝึกซ้ำและไม่ลบผลดีที่สุด${result.stars ? ` • Best ${result.stars}/3 ดาว` : ''}${result.score ? ` • ${result.score} คะแนน` : ''}</span>`;
    area.insertBefore(banner, area.firstElementChild);

    const labels = [...area.querySelectorAll('*')].filter(el => el.children.length === 0);
    labels.forEach(el => {
      const t = text(el).toUpperCase();
      if (t === 'CORRECT') el.textContent = 'CORRECT • รอบนี้';
      else if (t === 'เหตุผล') el.textContent = 'เหตุผล • รอบนี้';
      else if (t === 'คำใบ้') el.textContent = 'คำใบ้ • รอบนี้';
    });
  }

  function addNextAction() {
    if (!allThreeConfirmed()) return;
    if (document.querySelector('.uxq-w1-next-wrap')) return;
    const tracker = [...document.querySelectorAll('div,section,article')].find(el =>
      /ตรวจความครบ\s*3\s*ส่วน/i.test(text(el)) && text(el).includes('3/3') && text(el).length < 2600
    );
    if (!tracker) return;

    const wrap = document.createElement('div');
    wrap.className = 'uxq-w1-next-wrap';
    const link = document.createElement('a');
    link.className = 'uxq-w1-next-link';
    const u = new URL('./csai2601-mission-control.html', location.href);
    const current = new URLSearchParams(location.search || '');
    ['studentId','studentName','section','classroom','courseId','sheet','api'].forEach(key => {
      const value = current.get(key);
      if (value) u.searchParams.set(key, value);
    });
    link.href = u.href;
    link.textContent = 'ไป Mission Control และเข้า W2 →';
    wrap.appendChild(link);
    tracker.insertAdjacentElement('afterend', wrap);
  }

  function apply() {
    if (!isW1()) return;
    style();
    enhanceFigmaPanel();
    harmonizeTracker();
    addReplayMode();
    addNextAction();
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('uxq-progress-updated', schedule);
  window.addEventListener('uxq-studio-artifact-dispatched', schedule);
  setInterval(apply, 1500);

  window.UXQW1CompleteReplayAuthorityV1 = Object.freeze({ version: VERSION, apply });
})();