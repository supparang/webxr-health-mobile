/* CSAI2601 UX Quest • Passed Mission Landing Policy v1
 * A passed mission is practice/replay, never a fresh start.
 */
(() => {
  'use strict';

  const VERSION = '20260727-PASSED-MISSION-LANDING-POLICY-V1';
  const params = new URLSearchParams(location.search || '');
  const node = String(params.get('node') || '').trim().toUpperCase();
  if (!/^(W(?:[1-9]|1[0-5])|B[1-4])$/.test(node)) return;

  function isPassedLanding(root) {
    const text = String(root?.innerText || '').replace(/\s+/g, ' ');
    return /ผ่านแล้ว|สถิติดีที่สุดเดิม|เล่นซ้ำเพื่อ.*case/i.test(text) && /★{2,3}/.test(text);
  }

  function apply() {
    const root = document.getElementById('uxqCanonicalNode');
    if (!root || !isPassedLanding(root)) return;
    const button = root.querySelector('button[data-start]');
    if (!button) return;
    button.textContent = 'เล่นซ้ำเพื่อฝึก →';
    button.dataset.uxqReplay = '1';
    button.setAttribute('aria-label', `เล่น ${node} ซ้ำเพื่อฝึกด้วย Case ใหม่`);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('button[data-start][data-uxq-replay="1"]');
    if (!button) return;
    const url = new URL(location.href);
    url.searchParams.set('replay', '1');
    url.searchParams.delete('review');
    url.searchParams.delete('complete');
    history.replaceState(null, '', url.href);
  }, true);

  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true });
  else schedule();

  const root = document.getElementById('uxqCanonicalNode');
  if (root) new MutationObserver(schedule).observe(root, { childList:true, subtree:true, characterData:true });

  window.UXQPassedMissionLandingPolicyV1 = Object.freeze({ version:VERSION, apply });
})();