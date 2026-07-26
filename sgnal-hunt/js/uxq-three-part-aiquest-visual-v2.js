/* =========================================================
 * CSAI2601 UX Quest • Three-Part AI Quest Visual v2.1
 * Reads the authoritative tracker and renders an isolated visual copy.
 * Render-safe: observes only the source tracker and updates only when data changes.
 * Google Sheet remains the sole source of truth.
 * ========================================================= */
(() => {
  'use strict';

  const SOURCE_ID = 'uxqThreePartCompletion';
  const VISUAL_ID = 'uxqThreePartAIQuestVisualV2';
  const STYLE_ID = 'uxqThreePartAIQuestVisualV2Style';

  let sourceObserver = null;
  let observedSource = null;
  let lastSignature = '';
  let scheduled = false;

  const norm = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  const esc = v => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${SOURCE_ID}.uxq-3part-source-hidden{
        position:absolute!important;width:1px!important;height:1px!important;
        margin:-1px!important;padding:0!important;overflow:hidden!important;
        clip:rect(0 0 0 0)!important;white-space:nowrap!important;border:0!important;
        pointer-events:none!important;
      }
      #${VISUAL_ID}{
        width:min(100%,1120px);margin:24px auto;padding:20px;box-sizing:border-box;
        border-radius:20px;border:1px solid rgba(68,224,181,.5);
        background:linear-gradient(180deg,rgba(7,41,58,.98),rgba(5,27,44,.98));
        box-shadow:0 18px 48px rgba(0,0,0,.22);
      }
      #${VISUAL_ID} .uxq-aiqv2-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
      #${VISUAL_ID} .uxq-aiqv2-title{margin:0;font-size:clamp(19px,2vw,24px);line-height:1.3;color:#f4fbff;font-weight:900}
      #${VISUAL_ID} .uxq-aiqv2-sub{margin:5px 0 0;color:#abc0d0;font-size:14px;line-height:1.45}
      #${VISUAL_ID} .uxq-aiqv2-count{flex:0 0 auto;white-space:nowrap;padding:7px 12px;border-radius:999px;background:rgba(75,205,184,.16);color:#ddfff7;font-weight:900}
      #${VISUAL_ID} .uxq-aiqv2-grid{display:grid;grid-template-columns:minmax(0,1fr) 34px minmax(0,1fr) 34px minmax(0,1fr);align-items:stretch;gap:0}
      #${VISUAL_ID} .uxq-aiqv2-step{min-width:0;min-height:168px;padding:18px;box-sizing:border-box;border-radius:17px;border:1px solid rgba(147,176,203,.32);background:rgba(6,24,42,.76)}
      #${VISUAL_ID} .uxq-aiqv2-step[data-state="done"]{border-color:rgba(54,219,166,.72);background:linear-gradient(180deg,rgba(13,75,68,.84),rgba(7,48,54,.92))}
      #${VISUAL_ID} .uxq-aiqv2-step[data-state="retry"],#${VISUAL_ID} .uxq-aiqv2-step[data-state="ready"]{border-color:rgba(255,195,67,.66);background:linear-gradient(180deg,rgba(70,53,22,.74),rgba(38,31,23,.88))}
      #${VISUAL_ID} .uxq-aiqv2-no{display:grid;place-items:center;width:40px;height:40px;margin-bottom:13px;border-radius:50%;background:#183f62;color:#fff;font-weight:950;font-size:19px}
      #${VISUAL_ID} .uxq-aiqv2-step[data-state="done"] .uxq-aiqv2-no{background:#2bc894;color:#03281d}
      #${VISUAL_ID} .uxq-aiqv2-name{margin:0 0 8px;color:#f5fbff;font-size:17px;line-height:1.35;font-weight:900}
      #${VISUAL_ID} .uxq-aiqv2-status{margin:0 0 6px;color:#e3eef5;font-weight:800;line-height:1.4}
      #${VISUAL_ID} .uxq-aiqv2-detail{margin:0;color:#aabfce;font-size:13px;line-height:1.55;overflow-wrap:anywhere}
      #${VISUAL_ID} .uxq-aiqv2-arrow{display:grid;place-items:center;color:#59dcb4;font-size:27px;font-weight:950}
      #${VISUAL_ID} .uxq-aiqv2-foot{margin-top:16px;padding:12px 14px;text-align:center;border-radius:13px;background:rgba(255,255,255,.05);color:#d8e7f2;font-weight:800;font-size:13px;line-height:1.45}
      #${VISUAL_ID} .uxq-aiqv2-foot.is-done{background:rgba(30,184,132,.14);border:1px solid rgba(54,219,166,.38);color:#e6fff7}
      @media(max-width:820px){
        #${VISUAL_ID}{padding:16px;margin:18px auto}
        #${VISUAL_ID} .uxq-aiqv2-head{display:block}
        #${VISUAL_ID} .uxq-aiqv2-count{display:inline-block;margin-top:10px}
        #${VISUAL_ID} .uxq-aiqv2-grid{grid-template-columns:1fr}
        #${VISUAL_ID} .uxq-aiqv2-step{min-height:0}
        #${VISUAL_ID} .uxq-aiqv2-arrow{height:38px;transform:rotate(90deg)}
      }
    `;
    document.head.appendChild(style);
  }

  function getItem(source, index) {
    const item = source.querySelectorAll('.uxq-3part__item')[index];
    if (!item) return { state:'missing', status:'ยังไม่ครบ', detail:'รอข้อมูลจากระบบ' };
    return {
      state:item.getAttribute('data-state') || 'missing',
      status:norm(item.querySelector('span')?.textContent || ''),
      detail:norm(item.querySelector('small')?.textContent || '')
    };
  }

  function read(source) {
    const countText = norm(source.querySelector('.uxq-3part__count')?.textContent || '0/3 ยืนยันจากระบบ');
    const countMatch = countText.match(/([0-3])\s*\/\s*3/);
    const head = norm(source.querySelector('.uxq-3part__head h3')?.textContent || 'ตรวจความครบ 3 ส่วน');
    const nodeMatch = head.match(/(?:•|\s)(W(?:[1-9]|1[0-5])|B[1-4])\b/i);
    return {
      node:nodeMatch ? nodeMatch[1].toUpperCase() : String(new URLSearchParams(location.search).get('node') || 'W1').toUpperCase(),
      count:countMatch ? Number(countMatch[1]) : 0,
      countText,
      steps:[getItem(source,0),getItem(source,1),getItem(source,2)]
    };
  }

  function signature(data) {
    return JSON.stringify(data);
  }

  function render(source) {
    installStyle();
    const data = read(source);
    const sig = signature(data);
    if (sig === lastSignature && document.getElementById(VISUAL_ID)) return;
    lastSignature = sig;

    let visual = document.getElementById(VISUAL_ID);
    if (!visual) {
      visual = document.createElement('section');
      visual.id = VISUAL_ID;
      source.parentNode.insertBefore(visual, source);
    }

    const labels = ['Mission / Game','Studio Practice','Weekly Reflection'];
    const cards = data.steps.map((s,i) => `
      <article class="uxq-aiqv2-step" data-state="${esc(s.state)}">
        <div class="uxq-aiqv2-no">${s.state === 'done' ? '✓' : i+1}</div>
        <h3 class="uxq-aiqv2-name">${i+1}. ${labels[i]}</h3>
        <p class="uxq-aiqv2-status">${esc(s.status || (s.state === 'done' ? 'ยืนยันแล้ว' : 'ยังไม่ครบ'))}</p>
        <p class="uxq-aiqv2-detail">${esc(s.detail || 'รอการยืนยันจาก Google Sheet')}</p>
      </article>`);

    visual.innerHTML = `
      <div class="uxq-aiqv2-head">
        <div><h2 class="uxq-aiqv2-title">เส้นทางภารกิจ ${esc(data.node)} แบบ 1–2–3</h2><p class="uxq-aiqv2-sub">Mission → Studio Practice → Weekly Reflection โดยใช้ Google Sheet เป็นหลักฐานทางการ</p></div>
        <div class="uxq-aiqv2-count">${esc(data.countText)}</div>
      </div>
      <div class="uxq-aiqv2-grid">${cards[0]}<div class="uxq-aiqv2-arrow" aria-hidden="true">→</div>${cards[1]}<div class="uxq-aiqv2-arrow" aria-hidden="true">→</div>${cards[2]}</div>
      <div class="uxq-aiqv2-foot ${data.count === 3 ? 'is-done' : ''}">${data.count === 3 ? `✅ ${esc(data.node)} Complete — Google Sheet ยืนยันครบทั้ง 3 ขั้นตอน` : `ทำตามลำดับ 1 → 2 → 3 ให้ครบ เพื่อจบ ${esc(data.node)}`}</div>`;

    source.classList.add('uxq-3part-source-hidden');
  }

  function observeSource(source) {
    if (observedSource === source) return;
    sourceObserver?.disconnect();
    observedSource = source;
    sourceObserver = new MutationObserver(schedule);
    sourceObserver.observe(source, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['data-state'] });
  }

  function apply() {
    scheduled = false;
    const source = document.getElementById(SOURCE_ID);
    if (!source) return;
    observeSource(source);
    render(source);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, {once:true});
  else schedule();

  // Short bootstrap only. No document-wide permanent observer and no recurring interval.
  const bootstrap = setInterval(() => {
    schedule();
    if (document.getElementById(SOURCE_ID)) clearInterval(bootstrap);
  }, 300);
  setTimeout(() => clearInterval(bootstrap), 5000);
})();