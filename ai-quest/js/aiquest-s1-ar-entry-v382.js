/* AI Quest S1 AR unified launcher bridge v4.0.6
   - one launcher only
   - compact touch-first mobile AR
   - desktop keeps deliberate hand control
*/
(() => {
  'use strict';

  let wasOpen = false;
  let pending = false;

  const mobile = () => window.matchMedia?.('(max-width:600px)').matches;
  const panel = () => document.getElementById('s1ar368');
  const video = () => document.getElementById('s1video368');
  const open = () => Boolean(panel()?.classList.contains('open'));
  const ready = () => {
    const node = video();
    return Boolean(node?.srcObject && node.readyState >= 2 && node.videoWidth > 0);
  };

  function result(){
    const direct = window.AIQUEST_S1_AR_RESULT || window.AIQUEST_S1_AR_PRACTICE?.getResult?.();
    if (direct?.arCompleted) return direct;
    try {
      const stored = JSON.parse(localStorage.getItem('AIQUEST_S1_AR_RESULT_V368') || 'null');
      return stored?.arCompleted ? stored : null;
    } catch (_) {
      return null;
    }
  }

  function isS1Game(){
    const heading = String(document.getElementById('gameHeading')?.textContent || '').toLowerCase();
    return heading.includes('ai awakening') || /^\s*1\s*:/.test(heading);
  }

  function removeLegacyLauncher(){
    if (!document.getElementById('aiquestArLauncherV401')) return;
    [
      's1entry368','s1arentry368','s1arentry366',
      'aiquestS1ArEntryV374','aiquestS1ArEntryV375',
      'aiquestS1ArEntryV382','aiquestArFinalCardV395'
    ].forEach((id) => document.getElementById(id)?.remove());
  }

  function syncRuntimeLauncher(){
    if (!isS1Game()) return;
    const launcher = document.getElementById('aiquestArLauncherV401');
    if (!launcher || launcher.dataset.mode !== 's1') return;

    removeLegacyLauncher();
    const ar = result();
    const signature = ar ? [ar.finishedAt || '',ar.correct || 0,ar.total || 0,ar.arScore || ar.accuracy || 0].join('|') : '';
    if (launcher.dataset.s1ArSignature === signature) return;
    launcher.dataset.s1ArSignature = signature;

    const copy = launcher.firstElementChild;
    const button = launcher.querySelector('button');
    if (!copy || !button) return;
    copy.querySelector('#aiquestS1ArUnifiedStatusV406')?.remove();

    if (!ar) {
      button.disabled = false;
      button.textContent = 'เริ่ม S1 AR Practice';
      return;
    }

    const score = Math.round(Number(ar.arScore ?? ar.accuracy ?? 0));
    const status = document.createElement('div');
    status.id = 'aiquestS1ArUnifiedStatusV406';
    status.style.cssText = 'margin-top:8px;padding:9px 11px;border-radius:13px;background:rgba(16,185,129,.14);border:1px solid rgba(16,185,129,.32);color:#bbf7d0;font-size:12px;font-weight:900;line-height:1.45';
    status.textContent = `✓ ส่ง S1 AR Practice แล้ว: ${Number(ar.correct || 0)}/${Number(ar.total || 0)} • ${score}% • Teacher Dashboard แสดงเป็นกิจกรรมเสริมแล้ว`;
    copy.appendChild(status);
    button.disabled = false;
    delete button.dataset.busy;
    button.textContent = 'ฝึก S1 AR อีกครั้ง';
  }

  function tuneControls(){
    const config = window.AIQUEST_S1_HAND_HOTFIX?.config;
    if (config) {
      config.dwell = Math.max(Number(config.dwell || 0),1850);
      config.cooldown = Math.max(Number(config.cooldown || 0),1400);
      config.pinch = Math.min(Number(config.pinch || .12),.075);
      config.pad = Math.min(Number(config.pad || 0),34);
      config.magnet = Math.min(Number(config.magnet || 0),92);
    }

    const titleHint = document.querySelector('#s1ar368 .top div div');
    if (titleHint) {
      titleHint.textContent = mobile()
        ? 'Mobile Assist • แตะเลือกได้ทันที • มือเป็นทางเลือก'
        : 'Deliberate Hand Mode • เล็งในปุ่มจริง 1.8 วินาที • pinch ให้ชิดนิ้ว';
    }
    const instruction = document.querySelector('#s1card368 .how');
    if (instruction) {
      instruction.textContent = mobile()
        ? 'มือถือ: แตะปุ่มคำตอบได้ทันที ไม่จำเป็นต้องใช้มือ หากใช้มือให้เล็งในปุ่มจริงแล้วค้างประมาณ 1.8 วินาที'
        : 'เลือกคำตอบที่เหมาะที่สุด: เล็งปลายนิ้วให้อยู่ “ในปุ่มคำตอบจริง” แล้วค้าง 1.8 วินาที หรือหนีบนิ้วโป้งกับนิ้วชี้ให้ชิดเพื่อเลือก';
    }
  }

  function tick(){
    tuneControls();
    syncRuntimeLauncher();

    const active = open();
    if (active && !wasOpen) pending = true;
    if (!active && wasOpen) pending = false;
    wasOpen = active;

    // On phones, Compact AR Assist deliberately stays touch-first.
    if (mobile()) return;
    if (!active || !pending || !ready()) return;
    const hand = window.AIQUEST_S1_HAND_HOTFIX;
    if (!hand?.start) return;
    pending = false;
    hand.start(true);
  }

  window.addEventListener('aiquest:s1-ar-start',() => { pending = true; });
  window.addEventListener('aiquest:s1-ar-event-queued',syncRuntimeLauncher);
  window.addEventListener('aiquest:ar-stop',() => { pending = false; wasOpen = false; });
  setInterval(tick,180);
  console.log('[AIQuest] S1 compact mobile launcher bridge loaded');
})();
