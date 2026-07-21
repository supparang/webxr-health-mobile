/* CSAI2601 UX Quest • Studio Practice UI v1
 * Phase 1 enhancement for W1-W3 + B1.
 * Replaces the generic post-game note with a curriculum-aligned structured studio form.
 */
(() => {
  'use strict';

  const PACK = window.CSAI2601_UXQ_STUDIO_PRACTICE_V1;
  const params = new URLSearchParams(location.search || '');
  const nodeId = String(params.get('node') || params.get('id') || '').trim().toUpperCase();
  const spec = PACK?.byId?.(nodeId);
  if (!spec) return;

  const DRAFT_KEY = `csai2601.uxq.studio.draft.${nodeId.toLowerCase()}.v1`;
  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function installStyle() {
    if (document.getElementById('uxq-studio-practice-style-v1')) return;
    const style = document.createElement('style');
    style.id = 'uxq-studio-practice-style-v1';
    style.textContent = `
      .artifact[data-studio-practice-v1]{gap:15px!important;padding:18px!important}
      .studio-head{display:grid;gap:6px}.studio-head h2{font-size:clamp(1.25rem,3vw,1.75rem)}
      .studio-policy{border:1px solid rgba(255,209,102,.42);border-radius:13px;padding:10px 12px;background:rgba(255,209,102,.08);color:#ffe8aa;line-height:1.5;font-size:.84rem}
      .studio-flow{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
      .studio-step{border:1px solid rgba(181,205,255,.22);border-radius:12px;padding:9px;background:rgba(3,13,31,.36);font-size:.8rem;line-height:1.4;color:#d8e6ff}
      .studio-field{display:grid;gap:7px}.studio-field b{color:#fff}.studio-required{color:#ffdfa0;font-size:.76rem;margin-left:5px}
      .studio-field textarea{min-height:92px!important}.studio-field textarea[data-format="url"]{min-height:58px!important}
      .studio-checks{display:grid;gap:8px;border:1px solid rgba(110,231,255,.25);border-radius:14px;padding:12px;background:rgba(110,231,255,.055)}
      .studio-checks h3{margin:0;font-size:1rem}.studio-check{display:flex;align-items:flex-start;gap:9px;color:#dce9ff;line-height:1.45}
      .studio-check input{margin-top:3px;width:18px;height:18px;accent-color:#6ee7ff}
      .studio-validation{display:none;border:1px solid rgba(255,150,168,.6);border-radius:12px;padding:10px 12px;background:rgba(255,150,168,.1);color:#ffd5dc;line-height:1.5}
      .studio-validation[data-show="1"]{display:block}
      .studio-meta{display:flex;gap:8px;flex-wrap:wrap;color:#a9b9d9;font-size:.8rem}
      .studio-meta span{border:1px solid rgba(181,205,255,.18);border-radius:999px;padding:5px 8px;background:rgba(3,13,31,.34)}
      @media(max-width:800px){.studio-flow{grid-template-columns:1fr}.artifact[data-studio-practice-v1]{padding:14px!important}}
    `;
    document.head.appendChild(style);
  }

  function readDraft() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function saveDraft() {
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact) return;
    const fields = {};
    artifact.querySelectorAll('[data-studio-key]').forEach(el => {
      fields[el.dataset.studioKey] = String(el.value || '');
    });
    const checks = Array.from(artifact.querySelectorAll('[data-studio-check]')).map(input => Boolean(input.checked));
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        nodeId,
        version:PACK.version,
        savedAt:new Date().toISOString(),
        fields,
        checks
      }));
    } catch (_) {}
  }

  function fieldHtml(field, index, draft) {
    const value = draft?.fields?.[field.key] || '';
    return `<label class="studio-field">
      <b>${esc(field.label)}${field.required ? '<span class="studio-required">จำเป็น</span>' : ''}</b>
      <textarea
        data-artifact-field="${index}"
        data-studio-key="${esc(field.key)}"
        data-studio-label="${esc(field.label)}"
        data-required="${field.required ? '1' : '0'}"
        data-min-length="${Number(field.minLength || 0)}"
        data-format="${esc(field.format || 'text')}"
        rows="${Number(field.rows || 4)}"
        placeholder="${esc(field.placeholder || '')}"
      >${esc(value)}</textarea>
    </label>`;
  }

  function mount() {
    installStyle();
    const artifact = ROOT.querySelector('.artifact');
    if (!artifact || artifact.dataset.studioPracticeV1 === '1') return;
    const draft = readDraft();
    artifact.dataset.studioPracticeV1 = '1';
    artifact.innerHTML = `
      <div class="studio-head">
        <p class="kicker">Studio Practice • ${esc(nodeId)}</p>
        <h2>${esc(spec.studioTitle)}</h2>
        <p>${esc(spec.objective)}</p>
        <div class="studio-meta">
          <span>Canonical: ${esc(spec.canonicalArtifact)}</span>
          <span>เวลาปฏิบัติประมาณ ${Number(spec.suggestedMinutes || 0)} นาที</span>
          <span>Project เดียวต่อเนื่องถึง W15</span>
        </div>
      </div>
      <div class="studio-policy">แบบฟอร์มนี้ส่งหลักฐานการปฏิบัติเข้า Google Sheet แต่ยังไม่เปลี่ยนกฎปลดล็อกทางการในระยะนำร่อง ระบบ Mission Control ยังคงใช้ mission_completed จาก Sheet ตามลำดับต่อเนื่อง</div>
      <div class="studio-flow">${spec.practiceFlow.map((step, index) => `<div class="studio-step"><b>${index + 1}</b> ${esc(step)}</div>`).join('')}</div>
      ${spec.fields.map((field, index) => fieldHtml(field, index, draft)).join('')}
      <textarea hidden data-artifact-field="${spec.fields.length}" data-studio-key="selfCheckEvidence" data-studio-label="Self-check evidence"></textarea>
      <section class="studio-checks">
        <h3>Self-check ก่อนส่ง</h3>
        ${spec.selfChecks.map((item, index) => `<label class="studio-check"><input type="checkbox" data-studio-check="${index}" ${draft?.checks?.[index] ? 'checked' : ''}><span>${esc(item)}</span></label>`).join('')}
      </section>
      <div class="studio-validation" data-studio-validation role="alert"></div>
      <div class="actions">
        <button class="btn" type="button" data-save-artifact data-studio-submit>ส่ง Studio Artifact เข้า Google Sheet</button>
        <small data-save-status>ระบบเก็บ draft ชั่วคราวในเครื่อง แต่ข้อมูลทางการเกิดเมื่อส่งเข้า Sheet</small>
      </div>
    `;

    let timer = 0;
    artifact.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(saveDraft, 250);
    });
    artifact.addEventListener('change', saveDraft);
  }

  function isValidUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return /^https?:$/i.test(url.protocol);
    } catch (_) {
      return false;
    }
  }

  function validate(artifact) {
    const problems = [];
    artifact.querySelectorAll('[data-studio-key]').forEach(field => {
      if (field.hidden) return;
      const value = String(field.value || '').trim();
      const label = field.dataset.studioLabel || field.dataset.studioKey;
      const required = field.dataset.required === '1';
      const minLength = Number(field.dataset.minLength || 0);
      const format = field.dataset.format || 'text';
      if (required && !value) problems.push(`${label}: ยังไม่ได้กรอก`);
      else if (value && minLength && value.length < minLength) problems.push(`${label}: ควรมีอย่างน้อย ${minLength} ตัวอักษร`);
      else if (value && format === 'url' && !isValidUrl(value)) problems.push(`${label}: URL ไม่ถูกต้อง`);
    });

    const checks = Array.from(artifact.querySelectorAll('[data-studio-check]'));
    const unchecked = checks.filter(item => !item.checked);
    if (unchecked.length) problems.push(`Self-check: ยังไม่ได้ยืนยัน ${unchecked.length} ข้อ`);

    const summary = artifact.querySelector('[data-studio-key="selfCheckEvidence"]');
    if (summary) {
      summary.value = checks.map((item, index) => `${item.checked ? 'PASS' : 'NOT_YET'}: ${spec.selfChecks[index]}`).join('\n');
    }
    return problems;
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-studio-submit]');
    if (!button) return;
    const artifact = button.closest('.artifact[data-studio-practice-v1]');
    if (!artifact) return;
    const problems = validate(artifact);
    const box = artifact.querySelector('[data-studio-validation]');
    if (problems.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (box) {
        box.dataset.show = '1';
        box.innerHTML = `<b>ยังส่งไม่ได้</b><br>${problems.map(esc).join('<br>')}`;
      }
      box?.scrollIntoView?.({ behavior:'smooth', block:'center' });
      return;
    }
    if (box) {
      box.dataset.show = '0';
      box.textContent = '';
    }
    saveDraft();
  }, true);

  let scheduled = 0;
  function schedule() {
    clearTimeout(scheduled);
    scheduled = setTimeout(mount, 35);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true });
  else schedule();
  new MutationObserver(schedule).observe(ROOT, { childList:true, subtree:true });

  window.UXQStudioPracticeUIV1 = Object.freeze({ version:PACK.version, nodeId, mount, validate });
})();
