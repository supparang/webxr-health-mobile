/* UX Quest • W3–B2 Stage Acceptance Suite v1
 * Teacher-only local acceptance harness for W3, B1, W4, W5, W6 and B2.
 * Activate: ?qa=1&preview=1
 *
 * Guarantees
 * - Preview bypasses prerequisite checks only in this tab.
 * - Preview disables classroom delivery; no attempt is sent to the receiver.
 * - QA panel reads configuration/result state but never changes scoring,
 *   stars, unlock rules, case selection, or student progress.
 */
(() => {
  'use strict';

  const path = String(location.pathname || '').toLowerCase();
  const missionId =
    path.includes('w3-cognitive-load-escape') ? 'w3' :
    path.includes('b1-cognitive-storm') ? 'b1' :
    path.includes('w4-user-insight-lab') ? 'w4' :
    path.includes('w5-concept-forge') ? 'w5' :
    path.includes('w6-flow-rescue') ? 'w6' :
    path.includes('b2-flow-fortress') ? 'b2' : '';
  if (!missionId) return;

  const query = new URLSearchParams(location.search || '');
  const qa = ['1', 'true', 'yes'].includes(String(query.get('qa') || '').toLowerCase());
  const preview = qa && ['1', 'true', 'yes'].includes(String(query.get('preview') || '').toLowerCase());
  if (!qa) return;

  const SPEC = {
    w3:{ name:'W3 • Cognitive Load Escape', next:'b1-cognitive-storm.html', nextLabel:'B1 handoff', artifact:'Cognitive Load Repair Note' },
    b1:{ name:'B1 • Cognitive Storm', next:'w4-user-insight-lab.html', nextLabel:'W4 handoff', artifact:'B1 Design Defense Note' },
    w4:{ name:'W4 • User Insight Lab', next:'w5-concept-forge.html', nextLabel:'W5 handoff', artifact:'Persona & Empathy Canvas' },
    w5:{ name:'W5 • Concept Forge', next:'w6-flow-rescue.html', nextLabel:'W6 handoff', artifact:'Concept & Storyboard Canvas' },
    w6:{ name:'W6 • Flow Rescue', next:'b2-flow-fortress.html', nextLabel:'B2 handoff', artifact:'Sitemap & Flow Canvas' },
    b2:{ name:'B2 • Flow Fortress', next:'index.html', nextLabel:'Mission Control handoff', artifact:'B2 Flow Defense Note' }
  }[missionId];

  const $ = (selector, root) => (root || document).querySelector(selector);
  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const HIDE_KEY = `uxq.qa.${missionId}.hidden.v1`;
  const originalConfig = window.UXQ_CLASSROOM_CONFIG || {};

  if (preview) {
    window.UXQ_CLASSROOM_CONFIG = Object.freeze(Object.assign({}, originalConfig, {
      receiverUrl: '',
      classroomMode: 'practice',
      allowGuestPractice: true,
      qaPreview: true
    }));
    window.UXQStageTeacherPreview = Object.freeze({
      active: true,
      missionId,
      sendsToClassroom: false,
      message: 'Teacher Preview is local only; prerequisite and receiver delivery are disabled in this tab.'
    });
  }

  function addStyle(){
    if (document.getElementById('uxq-stage-qa-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-stage-qa-style';
    style.textContent = `
      .uxq-stage-qa{position:fixed;z-index:5000;right:12px;bottom:12px;width:min(430px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;border:1px solid rgba(255,209,102,.68);border-radius:16px;background:#102548;color:#eef6ff;box-shadow:0 18px 52px rgba(0,0,0,.4);font-size:.84rem}.uxq-stage-qa summary{display:flex;justify-content:space-between;gap:8px;cursor:pointer;padding:12px 13px;background:rgba(255,209,102,.13);font-weight:900;color:#ffe4a3}.uxq-stage-qa__body{padding:12px 13px;display:grid;gap:9px}.uxq-stage-qa__note{margin:0;color:#dce8ff;line-height:1.5}.uxq-stage-qa__preview{margin:0;padding:9px;border-left:3px solid #6ee7ff;border-radius:0 10px 10px 0;background:rgba(110,231,255,.08);color:#dceeff;line-height:1.45;font-size:.79rem}.uxq-stage-qa__row{display:flex;gap:8px;align-items:flex-start;padding:8px 9px;border:1px solid rgba(181,205,255,.20);border-radius:11px;background:rgba(4,15,36,.34);line-height:1.42}.uxq-stage-qa__state{font-weight:950;min-width:50px}.uxq-stage-qa__state--pass{color:#9af4bc}.uxq-stage-qa__state--wait{color:#ffe4a3}.uxq-stage-qa__state--fail{color:#ffb5c0}.uxq-stage-qa__footer{border-top:1px solid rgba(181,205,255,.18);padding-top:9px;color:#c8dbff;font-size:.78rem;line-height:1.48}.uxq-stage-qa__button{justify-self:start;border:1px solid rgba(181,205,255,.30);border-radius:9px;background:transparent;color:#eef6ff;padding:7px 9px;font:inherit;font-weight:800;text-decoration:none}
    `;
    document.head.appendChild(style);
  }

  function previewHref(){
    const url = new URL(location.href);
    url.searchParams.set('qa', '1');
    url.searchParams.set('preview', '1');
    url.searchParams.set('v', `20260704-${missionId}-qa-v1`);
    ['classroom','uxqClassroom','section','uxqSection','fresh','newLearner'].forEach((key) => url.searchParams.delete(key));
    return url.href;
  }

  function hide(){ try { sessionStorage.setItem(HIDE_KEY, '1'); } catch (error) {} }
  function hidden(){ try { return sessionStorage.getItem(HIDE_KEY) === '1'; } catch (error) { return false; } }

  function auditConfig(config){
    const cases = Array.isArray(config?.bank) ? config.bank : [];
    const declaredStages = Array.isArray(config?.stages) ? config.stages : [];
    const stageEntries = [];
    cases.forEach((item) => {
      Object.entries(item?.stages || {}).forEach(([stageKey, stage]) => {
        const options = Array.isArray(stage?.options) ? stage.options : [];
        stageEntries.push({ stageKey, optionCount:options.length, correctCount:options.filter((option) => option && option.correct).length });
      });
    });
    const correct = stageEntries.length > 0 && stageEntries.every((item) => item.optionCount === 4 && item.correctCount === 1);
    window.UXQStageAcceptanceConfig = Object.freeze({
      missionId,
      configId:config?.id || '',
      caseCount:cases.length,
      declaredStages:declaredStages.length,
      stageEntries,
      normalizedOptions:correct
    });
  }

  function profile(){
    const report = window.UXQStageAcceptanceConfig || {};
    return {
      configReady:report.configId === missionId && report.caseCount >= 2 && report.declaredStages >= 3 && report.normalizedOptions,
      caseCount:report.caseCount || 0,
      stageCount:report.stageEntries?.length || 0,
      stageNames:report.declaredStages || 0
    };
  }

  function live(){
    const result = $('.uxq-results');
    const game = $('.uxq-game');
    const resultText = String(result?.textContent || '');
    const passed = /MISSION CLEARED/i.test(resultText);
    const blocked = /ยังไม่ผ่านเกณฑ์ปลดล็อก|ยังไม่ผ่าน/i.test(resultText);
    const integrity = Boolean($('.uxq-result-integrity-note', result));
    const studio = Boolean($('.uxq-transfer-board', result) || $('.uxq-artifact-builder', result) || $('.uxq-boss-console', result));
    const link = [...(result?.querySelectorAll('a[href]') || [])].find((anchor) => String(anchor.getAttribute('href') || '').includes(SPEC.next));
    return {
      hasResult:Boolean(result),
      game:Boolean(game),
      passed,
      blocked,
      integrity,
      studio,
      next:Boolean(link),
      complete:Boolean(result)
    };
  }

  function row(state, label, detail){
    const tone = state === 'PASS' ? 'pass' : state === 'FAIL' ? 'fail' : 'wait';
    return `<div class="uxq-stage-qa__row"><span class="uxq-stage-qa__state uxq-stage-qa__state--${tone}">${state}</span><span><b>${label}</b><br><small>${detail}</small></span></div>`;
  }

  function render(){
    if (hidden()) return;
    addStyle();
    const staticAudit = profile();
    const activity = live();
    const resultState = !activity.hasResult ? 'WAIT' : (activity.integrity && ((activity.passed && !activity.blocked) || (!activity.passed && activity.blocked)) ? 'PASS' : 'FAIL');
    const studioState = !activity.hasResult ? 'WAIT' : (activity.studio ? 'PASS' : 'FAIL');
    const missionState = activity.complete || activity.game ? 'PASS' : 'WAIT';
    const handoffState = !activity.hasResult ? 'WAIT' : (activity.passed ? (activity.next ? 'PASS' : 'FAIL') : 'WAIT');
    const key = JSON.stringify({preview, config:staticAudit, resultState, studioState, missionState, handoffState});
    let panel = $('.uxq-stage-qa');
    if (panel?.dataset.qaKey === key) return;
    if (!panel) {
      panel = document.createElement('details');
      panel.className = 'uxq-stage-qa';
      panel.open = true;
      document.body.appendChild(panel);
    }
    panel.dataset.qaKey = key;
    const previewNote = preview
      ? `<p class="uxq-stage-qa__preview"><b>Teacher Preview:</b> ข้าม prerequisite เฉพาะแท็บนี้ และปิดการส่งผลเข้า Classroom Receiver แล้ว</p>`
      : `<p class="uxq-stage-qa__preview">ด่านจริงยังคงล็อกตามเส้นทางผู้เรียน เปิด Preview เฉพาะเพื่อทดสอบ ${SPEC.name} โดยไม่กระทบข้อมูลชั้นเรียน</p><a class="uxq-stage-qa__button" href="${previewHref()}">เปิด Teacher Preview →</a>`;
    const configDetail = `${staticAudit.caseCount} casefiles • ${staticAudit.stageCount} stage records • 4 options/1 correct ทุก stage`;
    const missionDetail = activity.complete ? 'หน้าผลลัพธ์ปรากฏแล้ว ยืนยันว่าเริ่มกิจกรรมและจบ mission flow ได้' : (activity.game ? 'กำลังอยู่ในเกม: ทดสอบตัวลวงและ Reason Check ต่อได้' : 'รอเริ่ม mission');
    const handoffDetail = !activity.hasResult ? `รอจบเกมเพื่อตรวจ ${SPEC.nextLabel}` : (activity.passed ? (activity.next ? `พบปุ่มส่งต่อ ${SPEC.nextLabel}` : `ผ่านแล้วแต่ไม่พบปุ่มส่งต่อ ${SPEC.nextLabel}`) : 'รอบนี้ไม่ผ่านเกณฑ์ปลดล็อก จึงไม่ควรส่งต่อด่านถัดไป');
    panel.innerHTML = `<summary><span>${missionId.toUpperCase()} ACCEPTANCE LAB • TEST MODE</span><span>⌄</span></summary><div class="uxq-stage-qa__body"><p class="uxq-stage-qa__note">ตรวจ ${SPEC.name} เท่านั้น — ไม่เปลี่ยนคะแนน ดาว ความก้าวหน้า หรือส่งข้อมูลชั้นเรียน</p>${previewNote}${row(staticAudit.configReady ? 'PASS' : 'FAIL','Case integrity',configDetail)}${row(missionState,'Mission flow',missionDetail)}${row(resultState,'Result integrity',!activity.hasResult ? 'รอจบเกมเพื่อตรวจ Pass / Badge / Unlock ให้ตรงกัน' : (activity.integrity ? 'ข้อความผลลัพธ์สอดคล้องกับสถานะผ่าน/ไม่ผ่านจริง' : 'ไม่พบ Result Integrity marker'))}${row(studioState,'Studio / transfer',!activity.hasResult ? `รอจบเกมเพื่อตรวจ ${SPEC.artifact}` : (activity.studio ? `พบ ${SPEC.artifact} หรือ Studio layer` : `ไม่พบ ${SPEC.artifact} หรือ Studio layer`))}${row(handoffState,SPEC.nextLabel,handoffDetail)}<div class="uxq-stage-qa__footer"><b>ผ่าน acceptance เมื่อ:</b> เดาสุ่มไม่ผ่านเกณฑ์ • Golden Path ผ่าน 2★ และส่งต่อได้ • Result/Badge/Studio ตรงกัน • เล่นซ้ำต้องเปลี่ยน case หรือตำแหน่งคำตอบ</div><button class="uxq-stage-qa__button" type="button">ซ่อน QA Panel</button></div>`;
    $('.uxq-stage-qa__button[type="button"]', panel)?.addEventListener('click', () => { hide(); panel.remove(); });
  }

  const prior = Object.getOwnPropertyDescriptor(window, 'UXQMissionEngine');
  let current;
  Object.defineProperty(window, 'UXQMissionEngine', {
    configurable:true,
    get(){ return current || (prior?.get ? prior.get.call(window) : undefined); },
    set(engine){
      if (prior?.set) {
        prior.set.call(window, engine);
        engine = prior.get ? prior.get.call(window) : engine;
      }
      if (!engine || typeof engine.init !== 'function') { current = engine; return; }
      const init = engine.init.bind(engine);
      current = Object.freeze(Object.assign({}, engine, {
        init:(config) => {
          const next = preview && config?.id === missionId
            ? Object.assign({}, config, { requires:null, requiresLabel:'', intro:`${String(config.intro || '')} • โหมดทดสอบอาจารย์: ข้าม prerequisite เฉพาะแท็บนี้`, passText:'โหมดทดสอบอาจารย์ • ไม่ส่งผลเข้าระบบชั้นเรียน' })
            : config;
          auditConfig(next);
          return init(next);
        }
      }));
    }
  });

  function boot(){
    render();
    new MutationObserver(() => requestAnimationFrame(render)).observe(document.documentElement, { childList:true, subtree:true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
