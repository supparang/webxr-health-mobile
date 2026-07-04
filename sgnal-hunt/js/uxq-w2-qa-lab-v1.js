/* UX Quest • W2 QA Lab v1.3
 * Teacher-only acceptance checklist, activated with ?qa=1.
 * It does not change scoring, progress, analytics or student gameplay.
 */
(() => {
  'use strict';
  if (!/w2-design-thinking-sprint\.html/i.test(location.pathname)) return;
  const query = new URLSearchParams(location.search || '');
  if (!['1', 'true', 'yes'].includes(String(query.get('qa') || '').toLowerCase())) return;

  const HIDE_KEY = 'uxq.w2.qa.hidden.v1';
  const preview = ['1', 'true', 'yes'].includes(String(query.get('preview') || '').toLowerCase());
  const $ = (selector, root) => (root || document).querySelector(selector);

  function addStyle(){
    if (document.getElementById('uxq-w2-qa-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-w2-qa-style';
    style.textContent = `
      .uxq-w2-qa{position:fixed;z-index:4000;right:12px;bottom:12px;width:min(420px,calc(100vw - 24px));border:1px solid rgba(255,209,102,.68);border-radius:16px;background:#102548;color:#eef6ff;box-shadow:0 18px 52px rgba(0,0,0,.38);overflow:hidden;font-size:.84rem}.uxq-w2-qa summary{display:flex;justify-content:space-between;gap:8px;cursor:pointer;padding:12px 13px;background:rgba(255,209,102,.13);font-weight:900;color:#ffe4a3}.uxq-w2-qa__body{padding:12px 13px;display:grid;gap:9px}.uxq-w2-qa__note{margin:0;color:#dce8ff;line-height:1.48}.uxq-w2-qa__row{display:flex;gap:8px;align-items:flex-start;padding:8px 9px;border:1px solid rgba(181,205,255,.20);border-radius:11px;background:rgba(4,15,36,.34);line-height:1.4}.uxq-w2-qa__state{font-weight:950;min-width:50px}.uxq-w2-qa__state--pass{color:#9af4bc}.uxq-w2-qa__state--wait{color:#ffe4a3}.uxq-w2-qa__state--fail{color:#ffb5c0}.uxq-w2-qa__footer{border-top:1px solid rgba(181,205,255,.18);padding-top:9px;color:#c8dbff;font-size:.78rem;line-height:1.45}.uxq-w2-qa__clear,.uxq-w2-qa__preview{justify-self:start;border:1px solid rgba(181,205,255,.30);border-radius:9px;background:transparent;color:#eef6ff;padding:7px 9px;font:inherit;font-weight:800;text-decoration:none}.uxq-w2-qa__preview{border-color:rgba(110,231,255,.62);background:rgba(110,231,255,.12);color:#c9f8ff}.uxq-w2-qa__preview-note{margin:0;padding:8px 9px;border-left:3px solid #6ee7ff;border-radius:0 9px 9px 0;background:rgba(110,231,255,.08);color:#dceeff;line-height:1.45;font-size:.79rem}
    `;
    document.head.appendChild(style);
  }

  function hidden(){
    try { return sessionStorage.getItem(HIDE_KEY) === '1'; }
    catch (error) { return false; }
  }
  function hide(){
    try { sessionStorage.setItem(HIDE_KEY, '1'); } catch (error) {}
  }
  function previewHref(){
    const url = new URL(location.href);
    url.searchParams.set('qa', '1');
    url.searchParams.set('preview', '1');
    url.searchParams.set('v', '20260706-w2-preview-v2');
    url.searchParams.delete('classroom');
    url.searchParams.delete('uxqClassroom');
    url.searchParams.delete('section');
    url.searchParams.delete('uxqSection');
    url.searchParams.delete('fresh');
    url.searchParams.delete('newLearner');
    return url.href;
  }

  function dataChecks(){
    const config = window.UXQW2AcceptanceConfig;
    const rows = config?.cases || [];
    const totalStages = rows.reduce((sum, item) => sum + Object.keys(item.stages || {}).length, 0);
    const allFour = rows.length === 3 && rows.every((item) => Object.values(item.stages || {}).every((stage) => stage.optionCount === 4));
    const oneCorrect = rows.length === 3 && rows.every((item) => Object.values(item.stages || {}).every((stage) => stage.correctCount === 1));
    return { nativeHardening:Boolean(window.UXQW2NativeHardeningActive), caseCount:rows.length, totalStages, allFour, oneCorrect };
  }

  function gameplayChecks(){
    const result = $('.uxq-results');
    const warmup = $('.uxq-mastery-modal');
    const started = Boolean($('.uxq-game'));
    const transfer = Boolean($('.uxq-transfer-board', result));
    const integrity = Boolean($('.uxq-result-integrity-note', result));
    const resultText = String(result?.textContent || '');
    const passed = /MISSION CLEARED/i.test(resultText);
    const blocked = /ยังไม่ผ่านเกณฑ์ปลดล็อก|ยังไม่ผ่าน/i.test(resultText);
    const w3Link = [...(result?.querySelectorAll('a[href]') || [])].find((anchor) => /w3-cognitive-load-escape\.html/i.test(String(anchor.getAttribute('href') || '')));
    return {
      warmup:Boolean(warmup),
      started,
      transfer,
      integrity,
      passed,
      blocked,
      hasResult:Boolean(result),
      completed:Boolean(result),
      w3Ready:Boolean(w3Link)
    };
  }

  function row(state, text, detail){
    const stateClass = state === 'PASS' ? 'pass' : state === 'FAIL' ? 'fail' : 'wait';
    return `<div class="uxq-w2-qa__row"><span class="uxq-w2-qa__state uxq-w2-qa__state--${stateClass}">${state}</span><span><b>${text}</b><br><small>${detail}</small></span></div>`;
  }

  function render(){
    if (hidden()) return;
    addStyle();
    const staticData = dataChecks();
    const live = gameplayChecks();
    const staticReady = staticData.nativeHardening && staticData.caseCount === 3 && staticData.totalStages === 15 && staticData.allFour && staticData.oneCorrect;
    const resultState = !live.hasResult ? 'WAIT' : (live.integrity && ((live.passed && !live.blocked) || (!live.passed && live.blocked)) ? 'PASS' : 'FAIL');
    const transferState = !live.hasResult ? 'WAIT' : (live.transfer ? 'PASS' : 'FAIL');
    // A result screen is reachable only after the warm-up and core mission have completed.
    const warmupState = (live.started || live.completed) ? 'PASS' : (live.warmup ? 'PASS' : 'WAIT');
    const flowState = (live.started || live.completed) ? 'PASS' : 'WAIT';
    const w3State = !live.hasResult ? 'WAIT' : (live.passed ? (live.w3Ready ? 'PASS' : 'FAIL') : 'WAIT');
    const key = JSON.stringify({ preview, staticReady, caseCount:staticData.caseCount, totalStages:staticData.totalStages, warmupState, flowState, resultState, transferState, w3State });
    let panel = $('.uxq-w2-qa');
    if (panel?.dataset.qaKey === key) return;
    if (!panel) {
      panel = document.createElement('details');
      panel.className = 'uxq-w2-qa';
      panel.open = true;
      document.body.appendChild(panel);
    }
    panel.dataset.qaKey = key;
    const previewBlock = preview
      ? '<p class="uxq-w2-qa__preview-note"><b>Teacher Preview กำลังทำงาน:</b> ข้าม W1 เฉพาะแท็บนี้เพื่อทดสอบ W2 และไม่ได้เปิด W2 ให้ผู้เรียนตามปกติ</p>'
      : `<p class="uxq-w2-qa__preview-note">W2 ยังล็อกเพราะเส้นทางผู้เรียนต้องผ่าน W1 ก่อน ใช้ Preview เฉพาะเพื่อตรวจเกม W2 โดยไม่ส่งผลเข้าระบบชั้นเรียน</p><a class="uxq-w2-qa__preview" href="${previewHref()}">เปิด W2 Teacher Preview →</a>`;
    const warmupDetail = live.completed ? 'ผลลัพธ์ปรากฏแล้ว จึงยืนยันว่า Sprint warm-up ผ่านก่อนเข้าสู่คดีหลัก' : (live.started ? 'ผ่าน warm-up และเข้าสู่ภารกิจหลักแล้ว' : (live.warmup ? 'warm-up เปิดอยู่: ตรวจว่าเรียงลำดับแล้วเริ่มเกมได้' : 'กดเริ่มภารกิจเพื่อทดสอบ warm-up'));
    const flowDetail = live.completed ? 'จบ W2 และแสดงหน้าผลลัพธ์แล้ว' : (live.started ? 'W2 game state ถูกสร้างแล้ว: ทดสอบตอบผิด/ถูกและ Reason Check' : 'รอเริ่มคดีหลัก');
    const w3Detail = !live.hasResult ? 'รอจบเกมเพื่อตรวจปุ่มส่งต่อ W3' : (live.passed ? (live.w3Ready ? 'พบปุ่ม ไปต่อ W3 • Psychology จากผลผ่าน 2★' : 'ผ่าน 2★ แล้ว แต่ไม่พบปุ่มส่งต่อ W3') : 'รอบนี้ไม่ผ่าน 2★ จึงยังไม่ต้องส่งต่อ W3');
    panel.innerHTML = `<summary><span>W2 ACCEPTANCE LAB • TEST MODE</span><span>⌄</span></summary><div class="uxq-w2-qa__body"><p class="uxq-w2-qa__note">ตรวจโครงสร้างและผลการเล่นของ W2 เท่านั้น — ไม่เปลี่ยนคะแนนหรือความก้าวหน้าของผู้เรียน</p>${previewBlock}${row(staticReady ? 'PASS' : 'FAIL','Case integrity',`${staticData.caseCount}/3 casefiles • ${staticData.totalStages}/15 stages • 4 options/1 correct ต่อ stage`)}${row(warmupState,'Sprint warm-up gate',warmupDetail)}${row(flowState,'Mission flow',flowDetail)}${row(resultState,'Result integrity',!live.hasResult ? 'รอจบเกมเพื่อตรวจ pass / unlock / badge ให้ตรงกัน' : (live.integrity ? 'มีสถานะผลลัพธ์และข้อความสอดคล้องกับผลจริง' : 'หน้าผลลัพธ์ยังไม่มี integrity marker'))}${row(transferState,'Studio transfer',!live.hasResult ? 'รอจบเกมเพื่อตรวจ HCD Sprint Transfer Board' : (live.transfer ? 'พบ Studio Transfer Board พร้อมบันทึก' : 'ไม่พบ Studio Transfer Board'))}${row(w3State,'W3 handoff',w3Detail)}<div class="uxq-w2-qa__footer"><b>ผ่าน acceptance เมื่อ:</b> เดาสุ่มไม่ถึง 2★ • Golden Path ได้ 2★ และพบปุ่มส่งต่อ W3 • Result/Badge/Transfer ตรงกัน • เล่นซ้ำเปลี่ยน case/ตำแหน่งคำตอบ</div><button type="button" class="uxq-w2-qa__clear">ซ่อน QA Panel</button></div>`;
    $('.uxq-w2-qa__clear', panel)?.addEventListener('click', () => { hide(); panel.remove(); });
  }

  function boot(){
    render();
    new MutationObserver(() => requestAnimationFrame(render)).observe(document.documentElement, { childList:true, subtree:true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
