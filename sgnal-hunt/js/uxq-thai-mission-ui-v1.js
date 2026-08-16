/* CSAI2601 UX Quest • Thai Mission UI v1
 * Presentation-only Thai localization for learner-facing Mission UI.
 * Does not change IDs, scoring, correctness, progress, unlock, Sheet writes,
 * canonical data objects, or answer truth.
 * Uses text-node replacement only; observer watches structural changes only
 * to avoid feedback loops/shaking.
 */
(() => {
  'use strict';

  const REPLACEMENTS = [
    [/\bPROGRESS\b/g, 'ความคืบหน้า'],
    [/\bCORRECT\b/g, 'ตอบถูก'],
    [/\bChoose research method\b/g, 'เลือกวิธีวิจัย'],
    [/\bRepair leading question\b/g, 'แก้คำถามชี้นำ'],
    [/\bClassify evidence\b/g, 'จำแนกหลักฐาน'],
    [/\bSynthesize insight\b/g, 'สังเคราะห์อินไซต์'],
    [/\bBuild persona\b/g, 'สร้างเพอร์โซนา'],
    [/\bCHOOSE RESEARCH METHOD\b/g, 'เลือกวิธีวิจัย'],
    [/\bFIX\b/g, 'แก้โจทย์'],
    [/\bCanonical round:\s*/g, 'รอบมาตรฐาน: '],
    [/\bevidence → assumption trap → research target → small test\b/g, 'หลักฐาน → กับดักจากข้อสมมติ → เป้าหมายการวิจัย → การทดสอบขนาดเล็ก'],
    [/\bHCD Evidence Lab\b/g, 'ห้องทดลองหลักฐานผู้ใช้'],
    [/\bEvidence Before Design\b/g, 'หลักฐานก่อนการออกแบบ'],
    [/\bHuman-Centered Design & User Research\b/g, 'การออกแบบที่ยึดมนุษย์เป็นศูนย์กลางและการวิจัยผู้ใช้'],
    [/\bInterview\/Observation\/Survey\b/g, 'สัมภาษณ์ / สังเกต / แบบสำรวจ'],
    [/\bethics\/privacy\b/g, 'จริยธรรมและความเป็นส่วนตัว'],
    [/\buser task\b/gi, 'ภารกิจหลักของผู้ใช้'],
    [/\bevidence, constraint\b/gi, 'หลักฐานและข้อจำกัด'],
    [/\bevidence\b/gi, 'หลักฐาน'],
    [/\bconstraint\b/gi, 'ข้อจำกัด'],
    [/\bsolution\b/gi, 'แนวทางแก้'],
    [/\bfeature\b/gi, 'ฟังก์ชัน'],
    [/\bHCD\b/g, 'การออกแบบที่ยึดมนุษย์เป็นศูนย์กลาง']
  ];

  function translateText(value) {
    let out = String(value || '');
    for (const [pattern, replacement] of REPLACEMENTS) out = out.replace(pattern, replacement);
    return out;
  }

  function localize(root=document) {
    const scope = root && root.nodeType === 1 ? root : document.body;
    if (!scope) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p || p.closest('script,style,noscript,textarea,input,select,option')) return NodeFilter.FILTER_REJECT;
        const raw = node.nodeValue || '';
        if (!/[A-Za-z]/.test(raw)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes=[];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const next = translateText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });
    document.documentElement.dataset.uxqThaiMissionUi = 'v1';
  }

  let timer=0;
  function schedule(root){
    clearTimeout(timer);
    timer=setTimeout(()=>localize(root || document),35);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',()=>schedule(document),{once:true});
  } else schedule(document);

  // Structural changes only. Text-node edits above do not retrigger this observer.
  new MutationObserver(records => {
    const added=[];
    records.forEach(record => {
      if (record.type !== 'childList') return;
      record.addedNodes.forEach(node => { if (node.nodeType === 1) added.push(node); });
    });
    if (!added.length) return;
    // Localize the latest inserted subtree; canonical/mission writers retain data ownership.
    schedule(added[added.length - 1]);
  }).observe(document.documentElement,{childList:true,subtree:true});
})();