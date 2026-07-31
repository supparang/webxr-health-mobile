/* CSAI2601 UX Quest • Studio Sheet Confirmation Poller v2
 * Uses the Unified Receiver directly. Google Sheet is the only authority.
 * Never leaves the learner trapped in an indefinite waiting state.
 */
(() => {
  'use strict';

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const PARAMS = new URLSearchParams(location.search || '');
  const NODE = String(PARAMS.get('node') || PARAMS.get('id') || 'W1').trim().toUpperCase();
  const KEY = NODE.toLowerCase();
  const MAX_CHECKS = 6;
  const INTERVAL_MS = 2500;
  let runToken = 0;
  let timer = 0;
  let checking = false;

  const clean = (value, max = 200) => String(value == null ? '' : value).trim().slice(0, max);

  function config() {
    return window.UXQ_CLASSROOM_CONFIG || {};
  }

  function identity() {
    let profile = {};
    try { profile = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return {
      studentId: clean(profile.studentId || PARAMS.get('studentId') || PARAMS.get('sid'), 80),
      section: clean(profile.section || PARAMS.get('section') || config().defaultSection, 80)
    };
  }

  function statusEl() {
    return ROOT.querySelector('.artifact[data-studio-practice-v1] [data-save-status]');
  }

  function setStatus(text, tone = '') {
    const el = statusEl();
    if (!el) return;
    el.textContent = text;
    el.dataset.tone = tone;
  }

  function setControlsBusy(busy) {
    ROOT.querySelectorAll('#uxqStudentStudioFinalV2 button,#uxqStudentStudioFinalV2 input,#uxqStudentStudioFinalV2 textarea,#uxqStudentStudioFinalV2 a').forEach(control => {
      if (control.matches('[data-studio-submit],[data-save-artifact]')) {
        control.disabled = busy;
        control.setAttribute('aria-busy', busy ? 'true' : 'false');
      } else {
        control.style.pointerEvents = 'auto';
      }
    });
  }

  function studioRow(data) {
    const nodes = data?.nodes || {};
    return nodes[KEY] || nodes[NODE] || (data?.items || []).find(item =>
      String(item.nodeId || item.missionId || item.id || '').trim().toLowerCase() === KEY
    ) || {};
  }

  function studioSubmitted(row) {
    return Boolean(
      row.submitted || row.artifactSubmitted || row.studioSubmitted ||
      ['submitted','approved','need_revision','reviewing'].includes(String(row.reviewStatus || row.status || '').toLowerCase())
    );
  }

  function reflectionSubmitted(row) {
    return Boolean(row.reflectionSubmitted || row.hasReflection || clean(row.reflection, 5000).length > 0);
  }

  function jsonp() {
    return new Promise((resolve, reject) => {
      const cfg = config();
      const endpoint = clean(cfg.receiverUrl || cfg.progressUrl, 800);
      const learner = identity();
      if (!endpoint) return reject(new Error('missing_receiver_url'));
      if (!learner.studentId || !learner.section) return reject(new Error('missing_identity'));

      const callback = `uxqStudioConfirm_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      let finished = false;
      const finish = (error, data) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        try { delete window[callback]; } catch (_) { window[callback] = undefined; }
        script.remove();
        error ? reject(error) : resolve(data);
      };
      const timeout = setTimeout(() => finish(new Error('studio_confirmation_timeout')), 12000);
      window[callback] = data => finish(null, data);
      script.onerror = () => finish(new Error('studio_confirmation_network'));
      const query = new URLSearchParams({
        action: 'uxq_student_studio_progress',
        studentId: learner.studentId,
        section: learner.section,
        courseId: cfg.courseId || 'UXQ-ACT1-2026',
        callback,
        _: String(Date.now())
      });
      script.src = `${endpoint}${endpoint.includes('?') ? '&' : '?'}${query}`;
      document.head.appendChild(script);
    });
  }

  function missionControlUrl() {
    const url = new URL('./csai2601-mission-control.html', location.href);
    const learner = identity();
    if (learner.section) url.searchParams.set('section', learner.section);
    if (PARAMS.get('classroom')) url.searchParams.set('classroom', PARAMS.get('classroom'));
    url.searchParams.set('v', 'student-runtime-v10-20260731');
    return url.pathname + url.search;
  }

  function ensureRetryButton() {
    const actions = ROOT.querySelector('.artifact[data-studio-practice-v1] .actions');
    if (!actions || actions.querySelector('[data-check-sheet-status]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn secondary';
    button.dataset.checkSheetStatus = '1';
    button.textContent = 'ตรวจสถานะจาก Google Sheet อีกครั้ง';
    actions.appendChild(button);
  }

  function finishConfirmed(data) {
    clearTimeout(timer);
    checking = false;
    setControlsBusy(false);
    setStatus('บันทึกสำเร็จแล้ว • Google Sheet ยืนยัน Studio Practice และ Weekly Reflection ครบถ้วน', 'ok');
    document.body.dataset.uxqSheetStudio = '1';
    document.body.dataset.uxqSheetReflection = '1';
    window.UXQStudioProgress = data;
    window.dispatchEvent(new CustomEvent('uxq-three-part-sheet-confirmed', {
      detail: { confirmed: true, nodeId: NODE, count: 3, snapshot: data }
    }));
    setTimeout(() => location.assign(missionControlUrl()), 1200);
  }

  async function check(token, attempt) {
    if (token !== runToken) return;
    try {
      const data = await jsonp();
      if (token !== runToken) return;
      if (!data?.ok) throw new Error(data?.error || 'studio_progress_failed');
      const row = studioRow(data);
      if (studioSubmitted(row) && reflectionSubmitted(row)) {
        finishConfirmed(data);
        return;
      }
      if (attempt >= MAX_CHECKS) {
        checking = false;
        setControlsBusy(false);
        setStatus('ส่งข้อมูลแล้ว แต่ Google Sheet ยังไม่ยืนยัน • กดตรวจสถานะอีกครั้งได้ โดยไม่ต้องกรอกใหม่', 'error');
        ensureRetryButton();
        return;
      }
      setStatus(`ส่งข้อมูลแล้ว • กำลังรอ Google Sheet ยืนยัน (${attempt}/${MAX_CHECKS})`);
      timer = setTimeout(() => check(token, attempt + 1), INTERVAL_MS);
    } catch (error) {
      if (token !== runToken) return;
      if (attempt >= MAX_CHECKS) {
        checking = false;
        setControlsBusy(false);
        setStatus('เชื่อมต่อ Google Sheet ชั่วคราวไม่สำเร็จ • ข้อมูลที่กรอกยังอยู่ กดตรวจสถานะอีกครั้งได้', 'error');
        ensureRetryButton();
        return;
      }
      setStatus(`กำลังเชื่อมต่อ Google Sheet ใหม่ (${attempt}/${MAX_CHECKS})`);
      timer = setTimeout(() => check(token, attempt + 1), INTERVAL_MS);
    }
  }

  function start() {
    clearTimeout(timer);
    const token = ++runToken;
    checking = true;
    setControlsBusy(true);
    setStatus('ส่งข้อมูลแล้ว • กำลังตรวจการยืนยันจาก Google Sheet…');
    check(token, 1);
  }

  document.addEventListener('click', event => {
    const retry = event.target.closest?.('[data-check-sheet-status]');
    if (!retry) return;
    retry.remove();
    start();
  });

  window.addEventListener('uxq-studio-artifact-dispatched', start);
  window.addEventListener('online', () => { if (checking) start(); });

  window.UXQStudioSheetConfirmationPollerV1 = Object.freeze({
    version: '20260731-STUDIO-SHEET-CONFIRMATION-POLLER-V2',
    start,
    checkNow: () => start(),
    isChecking: () => checking
  });
})();