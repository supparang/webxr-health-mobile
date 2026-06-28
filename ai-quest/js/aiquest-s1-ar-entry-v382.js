/* AI Quest S1 AR camera-ready retry bridge v4.0.2 */
(() => {
  'use strict';
  let wasOpen = false;
  let pending = false;

  function panel(){ return document.getElementById('s1ar368'); }
  function video(){ return document.getElementById('s1video368'); }
  function open(){ return Boolean(panel()?.classList.contains('open')); }
  function ready(){
    const node = video();
    return Boolean(node?.srcObject && node.readyState >= 2 && node.videoWidth > 0);
  }

  function tick(){
    const active = open();
    if (active && !wasOpen) pending = true;
    if (!active && wasOpen) pending = false;
    wasOpen = active;

    if (!active || !pending || !ready()) return;
    const hand = window.AIQUEST_S1_HAND_HOTFIX;
    if (!hand?.start) return;
    pending = false;
    hand.start(true);
  }

  window.addEventListener('aiquest:s1-ar-start', () => { pending = true; });
  window.addEventListener('aiquest:ar-stop', () => { pending = false; wasOpen = false; });
  setInterval(tick, 140);
  console.log('[AIQuest] S1 AR camera-ready retry bridge loaded');
})();
