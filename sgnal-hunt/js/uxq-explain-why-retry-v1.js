/* UX Quest • Explain Why Retry v1
   Optional post-mission reasoning reflection.
   This panel never changes score, stars, progression, or mission unlocks.
*/
(() => {
  'use strict';

  const KEY = 'uxq.reason-retry.v1.';
  const STYLE_ID = 'uxq-explain-why-retry-style';
  const MIN = 24;
  const MAX = 420;
  const guide = {
    evidence: 'อ้างถึงพฤติกรรมหรือข้อมูลที่ผู้ใช้พบจริง',
    hypothesis: 'เชื่อมหลักฐานกับความเข้าใจผิดหรือ friction',
    fix: 'อธิบายว่าการปรับใดแก้ต้นเหตุ',
    test: 'บอกว่าจะพิสูจน์ task success อย่างไร',
    empathize: 'เริ่มจากบริบทและความต้องการของผู้ใช้',
    define: 'เชื่อม user need กับ barrier โดยไม่ล็อก solution',
    ideate: 'เลือกแนวคิดที่ตอบ need หลัก',
    prototype: 'ทำต้นแบบพอทดสอบ flow เสี่ยงได้',
    diagnose: 'แยก task หลักออกจากสิ่งรบกวน',
    prioritize: 'ให้ action และข้อมูลสำคัญมาก่อน',
    reduce: 'ลดภาระด้วย chunking หรือ progressive disclosure',
    validate: 'ยืนยันจากสิ่งที่ผู้ใช้ทำและเข้าใจจริง'
  };
  const esc = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const get = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; } };
  const put = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };

  function receipt(){
    try { return window.UXQSubmissionReceipt?.getLast?.() || null; }
    catch (_) { return null; }
  }
  function state(){
    const item = receipt();
    const map = item?.learningMap;
    if (!item?.attemptId || !map?.available) return null;
    const focus = Array.isArray(map.focus) ? map.focus.slice(0,3) : [];
    const verified = Number(map.verifiedAccuracy || 0);
    return (!focus.length && verified >= 70) ? null : { item, map, focus, verified };
  }
  function addStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = '.uxq-explain-retry{width:min(760px,100%);text-align:left;display:grid;gap:10px;border:1px solid rgba(255,209,102,.48);border-radius:17px;background:rgba(91,67,18,.18);padding:15px 16px}.uxq-explain-retry__k{font-size:.74rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase;color:#ffe39a}.uxq-explain-retry__t{font-weight:950;color:#fff;font-size:1.04rem}.uxq-explain-retry p{margin:0;color:#e5edf9;line-height:1.58;font-size:.92rem}.uxq-explain-retry__focus{display:flex;gap:7px;flex-wrap:wrap}.uxq-explain-retry__focus span{border:1px solid rgba(255,225,141,.32);background:rgba(255,209,102,.10);border-radius:999px;padding:4px 8px;color:#ffe7af;font-size:.77rem;font-weight:850}.uxq-explain-retry textarea{width:100%;min-height:112px;resize:vertical;border-radius:13px;border:1px solid rgba(196,215,255,.26);background:rgba(4,15,35,.56);color:#f7fbff;padding:12px;font:inherit;line-height:1.58}.uxq-explain-retry__row{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.uxq-explain-retry__status{font-size:.82rem;color:#ffe4a0}.uxq-explain-retry__status.good{color:#c7ffdc}.uxq-explain-retry[data-state="saved"]{border-color:rgba(119,233,164,.48);background:rgba(39,112,77,.14)}';
    document.head.appendChild(style);
  }
  function card(data){
    const stored = get(KEY + data.item.attemptId);
    const node = document.createElement('section');
    node.className = 'uxq-explain-retry';
    node.dataset.uxqExplainRetry = `${data.item.attemptId}|${data.verified}|${data.focus.map(x => x.stageKey).join(',')}`;
    if (stored?.response) node.dataset.state = 'saved';
    const focus = data.focus.map(x => `<span title="${esc(guide[x.stageKey] || 'เชื่อมเหตุผลกับผู้ใช้และหลักฐาน')}">${esc(x.stageKey)}</span>`).join('');
    node.innerHTML = stored?.response ? `<div class="uxq-explain-retry__k">EXPLAIN WHY RETRY</div><div class="uxq-explain-retry__t">✓ บันทึกเหตุผลเพิ่มเติมแล้ว</div><p>${esc(stored.response)}</p><div class="uxq-explain-retry__status good">ข้อความนี้เป็นหลักฐานเสริมสำหรับอาจารย์ และไม่เปลี่ยนคะแนนหรือด่านที่ปลดล็อกแล้ว</div>` : `<div class="uxq-explain-retry__k">EXPLAIN WHY RETRY</div><div class="uxq-explain-retry__t">ลองอธิบายเหตุผลใหม่ 1–2 ประโยค</div><p>Reason Check รอบนี้ ${data.verified}% — เชื่อม <b>พฤติกรรมผู้ใช้ → จุดติดขัด → สิ่งที่ควรปรับหรือทดสอบ</b> ด้วยคำของคุณเอง</p><div class="uxq-explain-retry__focus">${focus}</div><textarea id="uxqExplainRetryText" maxlength="${MAX}" placeholder="ตัวอย่าง: ผู้ใช้… จึงสับสน เพราะ… ดังนั้นทีมควร… แล้วทดสอบว่า…"></textarea><div class="uxq-explain-retry__row"><span id="uxqExplainRetryStatus" class="uxq-explain-retry__status">อย่างน้อย ${MIN} ตัวอักษร • ไม่ต้องเล่นเกมหลักใหม่</span><button id="uxqExplainRetrySubmit" class="uxq-btn uxq-btn--warn" type="button">ส่งเหตุผลให้ตรวจ</button></div>`;
    if (!stored?.response) bind(node, data);
    return node;
  }
  function bind(node, data){
    const input = node.querySelector('#uxqExplainRetryText');
    const status = node.querySelector('#uxqExplainRetryStatus');
    const button = node.querySelector('#uxqExplainRetrySubmit');
    button.onclick = () => {
      const response = String(input.value || '').trim();
      if (response.replace(/\s+/g,'').length < MIN) { status.textContent = `เพิ่มรายละเอียดอีกเล็กน้อย: อย่างน้อย ${MIN} ตัวอักษร`; input.focus(); return; }
      button.disabled = true; status.textContent = 'กำลังบันทึก…';
      const record = { response, linkedAttemptId:data.item.attemptId, missionId:data.item.missionId, missionTitle:data.item.missionTitle, verifiedAccuracy:data.verified, focus:data.focus, occurredAt:new Date().toISOString() };
      put(KEY + data.item.attemptId, record);
      const transport = window.UXQReasonRetryTransport?.submit;
      Promise.resolve(transport ? transport(record) : { state:'local_only' }).then(outcome => {
        record.deliveryState = outcome?.state || 'local_only'; put(KEY + data.item.attemptId, record);
        node.dataset.state = 'saved';
        node.innerHTML = `<div class="uxq-explain-retry__k">EXPLAIN WHY RETRY</div><div class="uxq-explain-retry__t">✓ บันทึกเหตุผลเพิ่มเติมแล้ว</div><p>${esc(record.response)}</p><div class="uxq-explain-retry__status good">ข้อความนี้เป็นหลักฐานเสริมสำหรับอาจารย์ และไม่เปลี่ยนคะแนนหรือด่านที่ปลดล็อกแล้ว</div>`;
      });
    };
  }
  function decorate(){
    const root = document.querySelector('.uxq-results');
    const data = state();
    if (!root || !data) return;
    const next = card(data), old = root.querySelector('.uxq-explain-retry');
    if (old?.dataset.uxqExplainRetry === next.dataset.uxqExplainRetry) return;
    if (old) old.replaceWith(next); else (root.querySelector('.uxq-learning-map') || root.querySelector('.uxq-replay-coach') || root.querySelector('.uxq-takeaway'))?.insertAdjacentElement('afterend', next);
  }
  function boot(){ addStyle(); decorate(); window.addEventListener('uxq:submission-receipt', decorate); new MutationObserver(decorate).observe(document.documentElement,{childList:true,subtree:true}); }
  window.UXQExplainWhyRetry = Object.freeze({ version:'v1.0.0', decorate });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
