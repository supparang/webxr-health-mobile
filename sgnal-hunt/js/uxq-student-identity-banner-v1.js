/* CSAI2601 UX Quest • Student Identity Banner v2
 * Student-mode only. Uses normal document flow so the learner profile never
 * overlaps the course brand or Studio content.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  const preview = params.get('contentPreview') === '1' || /^content-preview/i.test(params.get('v') || '');
  if (preview) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE_ID = String(params.get('node') || params.get('id') || 'W1').trim().toUpperCase();
  const BANNER_ID = 'uxqActiveLearnerBanner';
  const STYLE_ID = 'uxq-student-identity-banner-v2-style';
  let gateOpen = false;
  let queued = false;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function identity() {
    let stored = {};
    try { stored = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return {
      studentId:String(stored.studentId || params.get('studentId') || params.get('sid') || '').trim(),
      studentName:String(stored.studentName || params.get('studentName') || params.get('name') || '').trim(),
      section:String(stored.section || params.get('section') || '').trim()
    };
  }

  function complete(profile) {
    try { return Boolean(window.UXQIdentity?.isComplete?.(profile)); }
    catch (_) { return Boolean(profile.studentId && profile.studentName && profile.section); }
  }

  function projectId() {
    const direct = ROOT.querySelector('[data-studio-key="projectId"]')?.value;
    if (String(direct || '').trim()) return String(direct).trim();
    const visible = ROOT.querySelector('[data-ssf2-project-id],[data-ssf-project-id]')?.value;
    return String(visible || '').trim();
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    document.getElementById('uxq-student-identity-banner-v1-style')?.remove();
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BANNER_ID}{position:relative!important;inset:auto!important;z-index:20;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;box-sizing:border-box;width:min(1280px,calc(100% - 48px));margin:16px auto 22px;padding:12px 14px;border:1px solid rgba(110,231,255,.42);border-radius:17px;background:rgba(5,18,42,.97);box-shadow:0 10px 30px rgba(0,0,0,.24)}
      #${BANNER_ID} + #uxqCanonicalNode{position:relative!important;clear:both!important;padding-top:10px!important}
      #${BANNER_ID} .uxq-id__avatar{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#6ee7ff,#7f7cff);color:#071124;font-weight:1000;font-size:.9rem}
      #${BANNER_ID} .uxq-id__body{display:grid;gap:3px;min-width:0}
      #${BANNER_ID} .uxq-id__label{color:#8deeff;font-size:.72rem;font-weight:950;letter-spacing:.12em;text-transform:uppercase}
      #${BANNER_ID} .uxq-id__name{color:#fff;font-size:1rem;font-weight:950;line-height:1.3;overflow-wrap:anywhere}
      #${BANNER_ID} .uxq-id__meta{display:flex;gap:7px;flex-wrap:wrap;color:#bed0eb;font-size:.8rem;line-height:1.4}
      #${BANNER_ID} .uxq-id__meta span{padding:3px 7px;border:1px solid rgba(181,205,255,.2);border-radius:999px;background:rgba(255,255,255,.035)}
      #${BANNER_ID} .uxq-id__note{color:#ffd98e;font-size:.72rem;line-height:1.35}
      #${BANNER_ID} .uxq-id__actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      #${BANNER_ID} button,#${BANNER_ID} a{display:grid;place-items:center;min-height:40px;padding:8px 12px;border-radius:10px;border:1px solid rgba(110,231,255,.34);background:rgba(255,255,255,.045);color:#edf5ff;text-decoration:none;font:inherit;font-size:.8rem;font-weight:900;cursor:pointer}
      #${BANNER_ID} button:hover,#${BANNER_ID} a:hover{background:rgba(110,231,255,.12)}
      body[data-uxq-identity-locked='1'] #uxqCanonicalNode{pointer-events:none;user-select:none;filter:saturate(.55)}
      body[data-uxq-identity-locked='1'] .uxq-profile-layer{pointer-events:auto;filter:none}
      @media(max-width:900px){
        #${BANNER_ID}{grid-template-columns:auto minmax(0,1fr);width:calc(100% - 24px);margin:12px auto 18px;padding:11px}
        #${BANNER_ID} .uxq-id__actions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;width:100%}
        #${BANNER_ID} button,#${BANNER_ID} a{width:100%;box-sizing:border-box}
        #${BANNER_ID} + #uxqCanonicalNode{padding-top:6px!important}
      }
      @media(max-width:520px){
        #${BANNER_ID}{grid-template-columns:1fr;width:calc(100% - 16px)}
        #${BANNER_ID} .uxq-id__avatar{width:40px;height:40px}
        #${BANNER_ID} .uxq-id__actions{grid-column:auto;grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function initials(profile) {
    const text = String(profile.studentName || profile.studentId || 'UX').trim();
    const parts = text.split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : text.slice(0,2)).toUpperCase();
  }

  function mount() {
    installStyle();
    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
      banner = document.createElement('section');
      banner.id = BANNER_ID;
      banner.setAttribute('aria-live','polite');
      const main = document.querySelector('#uxqCanonicalNode');
      if (main?.parentNode) main.parentNode.insertBefore(banner,main);
      else document.body.prepend(banner);
    }

    const profile = identity();
    const ready = complete(profile);
    const pid = projectId();
    const missionHref = `./csai2601-mission-control.html${params.get('section') ? `?section=${encodeURIComponent(params.get('section'))}` : ''}`;
    banner.dataset.complete = ready ? '1' : '0';
    banner.innerHTML = `
      <div class="uxq-id__avatar">${esc(initials(profile))}</div>
      <div class="uxq-id__body">
        <span class="uxq-id__label">ผู้เล่นปัจจุบัน • ${esc(NODE_ID)}</span>
        <strong class="uxq-id__name">${ready ? esc(profile.studentName) : 'ยังไม่ได้ระบุผู้เรียน'}</strong>
        <div class="uxq-id__meta">
          <span>รหัส: ${ready ? esc(profile.studentId) : '—'}</span>
          <span>Section: ${ready ? esc(profile.section) : '—'}</span>
          ${pid ? `<span>Project: ${esc(pid)}</span>` : ''}
        </div>
        <small class="uxq-id__note">โปรไฟล์นี้ระบุผู้ใช้บนอุปกรณ์ปัจจุบัน • สถานะทางการต้องยืนยันกับ Google Sheet ภายหลัง</small>
      </div>
      <div class="uxq-id__actions">
        <button type="button" data-uxq-change-learner>${ready ? 'เปลี่ยนผู้เรียน' : 'ระบุผู้เรียน'}</button>
        <a href="${esc(missionHref)}">Mission Control</a>
      </div>`;

    banner.querySelector('[data-uxq-change-learner]')?.addEventListener('click',() => openGate(true));
    if (!ready) openGate(false);
  }

  async function openGate(force) {
    if (gateOpen || !window.UXQIdentity?.open) return;
    const existing = identity();
    if (!force && complete(existing)) return;
    gateOpen = true;
    document.body.dataset.uxqIdentityLocked = '1';
    try {
      const result = await window.UXQIdentity.open({allowGuest:false,title:force ? 'เปลี่ยนผู้เรียนที่กำลังทำภารกิจ' : 'ระบุผู้เรียนก่อนเริ่มภารกิจ'});
      if (!complete(result || identity())) window.setTimeout(() => openGate(false),100);
    } finally {
      gateOpen = false;
      const ready = complete(identity());
      document.body.dataset.uxqIdentityLocked = ready ? '0' : '1';
      mount();
    }
  }

  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; mount(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',queue,{once:true});
  else queue();
  window.addEventListener('uxq-profile-updated',queue);
  window.addEventListener('uxq-sheet-progress-restored',queue);
  new MutationObserver(queue).observe(ROOT,{childList:true,subtree:true});
  [150,500,1200,2500].forEach(ms => setTimeout(queue,ms));

  window.UXQStudentIdentityBannerV1 = Object.freeze({version:'20260731-STUDENT-IDENTITY-BANNER-V2',mount,openGate,identity});
})();