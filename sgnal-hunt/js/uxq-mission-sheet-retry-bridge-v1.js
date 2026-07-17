/* CSAI2601 UX Quest • Mission Sheet Retry Bridge v1
 * Production safety net for every canonical node.
 * - Re-dispatches mission_completed with the same stable eventId while Sheet gate is waiting.
 * - Runs a limited number of times; the receiver may safely deduplicate by eventId.
 * - Never unlocks locally. Google Sheet remains the sole navigation authority.
 */
(() => {
  'use strict';

  const VERSION = 'uxq-mission-sheet-retry-bridge-v1-20260717';
  const MAX_FORCE_DISPATCH = 3;
  const RETRY_DELAY_MS = 5500;
  let forced = 0;
  let timer = 0;
  let running = false;

  const gateLink = () => document.querySelector('[data-sheet-next-gate="locked"],[data-sheet-next-gate="error"]');
  const hasResult = () => Boolean(document.querySelector('.results'));

  async function forceDispatch(reason) {
    if (running || forced >= MAX_FORCE_DISPATCH || !hasResult()) return;
    const link = gateLink();
    if (!link) return;
    const api = window.CSAI2601UXQAutoSheet;
    if (!api || typeof api.autoMission !== 'function') return;

    running = true;
    forced += 1;
    try {
      const outcome = await api.autoMission({ force:true, reason });
      window.dispatchEvent(new CustomEvent('uxq-mission-sheet-retry', {
        detail:{ version:VERSION, forced, reason, outcome }
      }));
    } catch (error) {
      window.dispatchEvent(new CustomEvent('uxq-mission-sheet-retry-error', {
        detail:{ version:VERSION, forced, reason, error:String(error?.message || error) }
      }));
    } finally {
      running = false;
    }
  }

  function schedule(reason) {
    clearTimeout(timer);
    if (forced >= MAX_FORCE_DISPATCH) return;
    timer = setTimeout(async () => {
      if (!gateLink()) return;
      await forceDispatch(reason || 'gate_waiting');
      if (gateLink() && forced < MAX_FORCE_DISPATCH) schedule('gate_still_waiting');
    }, RETRY_DELAY_MS);
  }

  document.addEventListener('click', event => {
    const link = event.target.closest?.('[data-sheet-next-gate="error"]');
    if (!link) return;
    forceDispatch('manual_sheet_recheck');
    schedule('after_manual_recheck');
  }, true);

  window.addEventListener('uxq-sheet-next-confirmed', () => {
    clearTimeout(timer);
  });

  function scan() {
    if (!hasResult()) return;
    if (gateLink()) schedule('initial_gate_wait');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, { once:true });
  else scan();
  new MutationObserver(scan).observe(document.getElementById('uxqCanonicalNode') || document.body, {
    childList:true,
    subtree:true,
    attributes:true,
    attributeFilter:['data-sheet-next-gate']
  });

  window.UXQMissionSheetRetryBridge = Object.freeze({ version:VERSION, forceDispatch, schedule });
})();