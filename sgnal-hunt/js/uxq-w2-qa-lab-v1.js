/* UX Quest • W2 QA Lab v1.1
 * Teacher-only acceptance checklist, activated with ?qa=1.
 * It does not change scoring, progress, analytics or student gameplay.
 */
(() => {
  'use strict';
  if (!/w2-design-thinking-sprint\.html/i.test(location.pathname)) return;
  const query = new URLSearchParams(location.search || '');
  if (!['1', 'true', 'yes'].includes(String(query.get('qa') || '').toLowerCase())) return;

  const HIDE_KEY = 'uxq.w2.qa.hidden.v1';
  const $ = (selector, root) => (root || document).querySelector(selector);

  function addStyle(){
    if (document.getElementById('uxq-w2-qa-style')) return;
    const style = document.createElement('style');
    style.id = 'uxq-w2-qa-style';
    style.textContent = `
      .uxq-w2-qa{position:fixed;z-index:4000;right:12px;bottom:12px;width:min(420px,calc(100vw - 24px));border:1px solid rgba(255,209,102,.68);border-radius:16px;background:#102548;color:#eef6ff;box-shadow:0 18px 52px rgba(0,0,0,.38);overflow:hidden;font-size:.84rem}.uxq-w2-qa summary{display:flex;justify-content:space-between;gap:8px;cursor:pointer;padding:12px 13px;background:rgba(255,209,102,.13);font-weight:900;color:#ffe4a3}.uxq-w2-qa__body{padding:12px 13px;display:grid;gap:9px}.uxq-w2-qa__note{margin:0;color:#dce8ff;line-height:1.48}.uxq-w2-qa__row{display:flex;gap:8px;align-items:flex-start;padding:8px 9px;border:1px solid rgba(181,205,255,.20);border-radius:11px;background:rgba(4,15,36,.34);line-height:1.4}.uxq-w2-qa__state{font-weight:950;min-width:50px}.uxq-w2-qa__state--pass{color:#9af4bc}.uxq-w2-qa__state--wait{color:#ffe4a3}.uxq-w2-qa__state--fail{color:#ffb5c0}.uxq-w2-qa__footer{border-top:1px solid rgba(181,205,255,.18);padding-top:9px;color:#c8dbff;font-size:.78rem;line-height:1.45}.uxq-w2-qa__clear{justify-self:start;border:1px solid rgba(181,205,255,.30);border-radius:9px;background:transparent;color:#eef6ff;padding:7px 9px;font:inherit;font-weight:800}
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
    return { warmup:Boolean(warmup), started, transfer, integrity, passed, blocked, hasResult:Boolean(result) };
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
    const warmupState = live.started ? 'PASS' : (live.warmup ? 'PASS' : 'WAIT');
    const key = JSON.stringify({ staticReady, caseCount:staticData.caseCount, totalStages:staticData.totalStages, warmupState, started:live.started, resultState, transferState });
    let panel = $('.uxq-w2-qa');
    if (panel?.dataset.qaKey === key) return;
    if (!panel) {
      panel = document.createElement('details');
      panel.className = 'uxq-w2-qa';
      panel.open = true;
      document.body.appendChild(panel);
    }
    panel.dataset.qaKey = key;
    panel.innerHTML = `<summary><span>W2 ACCEPTANCE LAB • TEST MODE</span><span>⌄</span></summary><div class="uxq-w2-qa__body"><p class="uxq-w2-qa__note">ตรวจโครงสร้างและผลการเล่นของ W2 เท่านั้น — ไม่เปลี่ยนคะแนนหรือความก้าวหน้าของผู้เรียน</p>${row(staticReady ? 'PASS' : 'FAIL','Case integrity',`${staticData.caseCount}/3 casefiles • ${staticData.totalStages}/15 stages • 4 options/1 correct ต่อ stage`)}${row(warmupState,'Sprint warm-up gate',live.started ? 'ผ่าน warm-up และเข้าสู่ภารกิจหลักแล้ว' : (live.warmup ? 'warm-up เปิดอยู่: ตรวจว่าเรียงลำดับแล้วเริ่มเกมได้' : 'กดเริ่มภารกิจเพื่อทดสอบ warm-up'))}${row(live.started ? 'PASS' : 'WAIT','Mission flow',live.started ? 'W2 game state ถูกสร้างแล้ว: ทดสอบตอบผิด/ถูกและ Reason Check' : 'รอเริ่มคดีหลัก')}${row(resultState,'Result integrity',!live.hasResult ? 'รอจบเกมเพื่อตรวจ pass / unlock / badge ให้ตรงกัน' : (live.integrity ? 'มีสถานะผลลัพธ์และข้อความสอดคล้องกับผลจริง' : 'หน้าผลลัพธ์ยังไม่มี integrity marker'))}${row(transferState,'Studio transfer',!live.hasResult ? 'รอจบเกมเพื่อตรวจ HCD Sprint Transfer Board' : (live.transfer ? 'พบ Studio Transfer Board พร้อมบันทึก' : 'ไม่พบ Studio Transfer Board'))}<div class="uxq-w2-qa__footer"><b>ผ่าน acceptance เมื่อ:</b> เดาสุ่มไม่ถึง 2★ • Golden Path ได้ 2★ และ W3 เปิด • Result/Badge/Transfer ตรงกัน • เล่นซ้ำเปลี่ยน case/ตำแหน่งคำตอบ</div><button type="button" class="uxq-w2-qa__clear">ซ่อน QA Panel</button></div>`;
    $('.uxq-w2-qa__clear', panel)?.addEventListener('click', () => { hide(); panel.remove(); });
  }

  function boot(){
    render();
    new MutationObserver(() => requestAnimationFrame(render)).observe(document.documentElement, { childList:true, subtree:true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
