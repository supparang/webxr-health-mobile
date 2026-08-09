/* CSAI2601 UX Quest • Mission Control Sheet Render Recovery v1
 * Google Sheet response may render Mission Control even if local cache sync fails.
 */
(() => {
  'use strict';
  let done = false;
  let running = false;

  const profile = () => {
    try { return window.UXQIdentity?.get?.() || {}; }
    catch (_) { return {}; }
  };

  function publish(result) {
    if (!result || !result.ok) return false;
    done = true;
    window.UXQMissionSheetSnapshot = result;
    try { window.UXQMissionControlSheetAuthority?.drawFromSheet?.(result); } catch (_) {}
    window.dispatchEvent(new CustomEvent('uxq-sheet-progress-restored', { detail: result }));
    return true;
  }

  async function recover() {
    if (done || running) return;
    const p = profile();
    if (!p.studentId || !p.section || !window.UXQCloudProgress?.request) return;
    running = true;
    try {
      const result = await window.UXQCloudProgress.request(p);
      publish(result);
    } catch (error) {
      console.error('[UXQ Mission Control Sheet Render Recovery]', error);
    } finally {
      running = false;
    }
  }

  window.addEventListener('uxq-sheet-progress-restored', event => {
    if (event.detail?.ok) done = true;
  });

  [1500, 3500, 7000, 12000].forEach(ms => setTimeout(recover, ms));
  window.addEventListener('online', recover);

  window.UXQMissionControlSheetRenderRecoveryV1 = Object.freeze({ recover, version:'20260809-MC-SHEET-RENDER-RECOVERY-V1' });
})();