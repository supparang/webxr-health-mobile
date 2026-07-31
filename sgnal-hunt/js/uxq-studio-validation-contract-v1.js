/* CSAI2601 UX Quest • Studio Validation Contract Authority v1
 * One visible wizard, one validation contract.
 * Canonical hidden fields remain submission data only and are normalized from
 * the active Studio specification before legacy validators can inspect them.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  if (params.get('contentPreview') === '1' || /^content-preview/i.test(params.get('v') || '')) return;

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const NODE_ID = String(params.get('node') || params.get('id') || '').trim().toUpperCase();
  const WIZARD_ID = 'uxqStudentStudioFinalV2';
  const STYLE_ID = 'uxq-studio-validation-contract-v1-style';
  const VERSION = '20260731-STUDIO-VALIDATION-CONTRACT-V1';

  function spec() {
    return window.CSAI2601_UXQ_STUDIO_PRACTICE_V1?.byId?.(NODE_ID) || null;
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${WIZARD_ID} .uxq-sv2__step-validation{
        display:none;padding:10px 12px;margin-top:10px;border:1px solid rgba(255,120,140,.58);
        border-radius:12px;background:rgba(255,90,115,.10);color:#ffd8df;line-height:1.5
      }
      #${WIZARD_ID} .uxq-sv2__step-validation[data-show='1']{display:block}
    `;
    document.head.appendChild(style);
  }

  function canonicalField(artifact, key) {
    return Array.from(artifact.querySelectorAll(`[data-studio-key="${CSS.escape(key)}"]`))
      .find(field => !field.closest('#' + WIZARD_ID)) || null;
  }

  function normalizedMeta(key, activeSpec) {
    const fromSpec = activeSpec?.fields?.find(item => item.key === key);
    if (fromSpec) return fromSpec;
    if (key === 'evidenceUrl') {
      return { key, label:'Evidence URL (ถ้ามี)', required:false, minLength:0, format:'url' };
    }
    if (key === 'selfCheckEvidence') {
      return { key, label:'Self-check evidence', required:false, minLength:0, format:'text' };
    }
    return { key, label:key, required:false, minLength:0, format:'text' };
  }

  function normalizeCanonicalFields() {
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    const activeSpec = spec();
    if (!artifact || !activeSpec) return false;

    artifact.querySelectorAll('[data-studio-key]').forEach(field => {
      if (field.closest('#' + WIZARD_ID)) return;
      const key = String(field.dataset.studioKey || '').trim();
      if (!key) return;
      const meta = normalizedMeta(key, activeSpec);

      field.dataset.studioLabel = meta.label || key;
      field.dataset.required = meta.required ? '1' : '0';
      field.dataset.minLength = String(Number(meta.minLength || 0));
      field.dataset.format = meta.format || 'text';
      field.hidden = true;
      field.setAttribute('aria-hidden', 'true');
      field.tabIndex = -1;
      field.removeAttribute('required');
      field.dataset.uxqCanonicalContract = VERSION;

      const wrapper = field.closest('label.studio-field');
      if (wrapper && !wrapper.closest('#' + WIZARD_ID)) {
        wrapper.hidden = true;
        wrapper.setAttribute('aria-hidden', 'true');
      }
    });

    artifact.dataset.uxqStudioValidationContract = '1';
    return true;
  }

  function isHttp(value) {
    try { return /^https?:$/i.test(new URL(String(value || '').trim()).protocol); }
    catch (_) { return false; }
  }

  function pushUnique(list, message) {
    if (message && !list.includes(message)) list.push(message);
  }

  function validateProxy(field, problems) {
    const value = String(field?.value || '').trim();
    const label = field?.dataset?.label || 'คำตอบ';
    const required = field?.dataset?.required === '1';
    const minLength = Number(field?.dataset?.minLength || 0);
    const format = field?.dataset?.format || 'text';
    if (required && !value) pushUnique(problems, `${label}: ยังไม่ได้กรอก`);
    else if (value && minLength && value.length < minLength) pushUnique(problems, `${label}: ควรมีอย่างน้อย ${minLength} ตัวอักษร`);
    else if (value && format === 'url' && !isHttp(value)) pushUnique(problems, `${label}: URL ไม่ถูกต้อง`);
  }

  function validateProject(wizard, problems) {
    const project = wizard.querySelector('[data-sv2-project]');
    const figma = wizard.querySelector('[data-sv2-figma]');
    const evidence = wizard.querySelector('[data-sv2-evidence]');
    if (project && !String(project.value || '').trim()) pushUnique(problems, 'Master Project ID: ยังไม่ได้กรอก');
    if (figma && !isHttp(figma.value)) pushUnique(problems, 'Master Figma Project URL: ต้องเป็น URL ที่เปิดได้');
    if (evidence && String(evidence.value || '').trim() && !isHttp(evidence.value)) {
      pushUnique(problems, 'Evidence URL: URL ไม่ถูกต้อง');
    }
  }

  function validatePanel(panel, wizard) {
    const problems = [];
    if (!panel) return problems;
    if (panel.querySelector('[data-sv2-project],[data-sv2-figma],[data-sv2-evidence]')) {
      validateProject(wizard, problems);
    }
    panel.querySelectorAll('[data-sv2-proxy]').forEach(field => validateProxy(field, problems));
    return problems;
  }

  function validateAll(wizard) {
    const problems = [];
    validateProject(wizard, problems);
    wizard.querySelectorAll('[data-sv2-proxy]').forEach(field => validateProxy(field, problems));
    const checks = Array.from(wizard.querySelectorAll('[data-studio-check]'));
    const unchecked = checks.filter(item => !item.checked);
    if (checks.length && unchecked.length) pushUnique(problems, `Self-check: ยังไม่ได้ยืนยัน ${unchecked.length} ข้อ`);
    return problems;
  }

  function syncVisibleToCanonical(wizard) {
    const artifact = wizard.closest('.artifact[data-studio-practice-v1]');
    if (!artifact) return;
    const pairs = [
      [wizard.querySelector('[data-sv2-project]'), 'projectId'],
      [wizard.querySelector('[data-sv2-figma]'), 'figmaUrl'],
      [wizard.querySelector('[data-sv2-evidence]'), 'evidenceUrl'],
      ...Array.from(wizard.querySelectorAll('[data-sv2-proxy]')).map(field => [field, field.dataset.sv2Proxy])
    ];
    pairs.forEach(([visible, key]) => {
      if (!visible || !key) return;
      const source = canonicalField(artifact, key);
      if (!source) return;
      source.value = visible.value;
      source.dispatchEvent(new Event('input', { bubbles:true }));
      source.dispatchEvent(new Event('change', { bubbles:true }));
    });
  }

  function showStepProblems(panel, problems) {
    if (!panel) return;
    let box = panel.querySelector('.uxq-sv2__step-validation');
    if (!box) {
      box = document.createElement('div');
      box.className = 'uxq-sv2__step-validation';
      box.setAttribute('role', 'alert');
      panel.appendChild(box);
    }
    box.dataset.show = problems.length ? '1' : '0';
    box.innerHTML = problems.length ? `<strong>ขั้นนี้ยังไม่ครบ</strong><br>${problems.join('<br>')}` : '';
    if (problems.length) box.scrollIntoView?.({ behavior:'smooth', block:'center' });
  }

  function showSubmitProblems(wizard, problems) {
    const box = wizard.querySelector('[data-sv2-validation]');
    if (box) {
      box.dataset.show = problems.length ? '1' : '0';
      box.innerHTML = problems.length ? `<strong>ยังส่งไม่ได้</strong><br>${problems.join('<br>')}` : '';
      if (problems.length) box.scrollIntoView?.({ behavior:'smooth', block:'center' });
    }
    const legacy = wizard.querySelector('[data-studio-validation]');
    if (legacy) {
      legacy.dataset.show = '0';
      legacy.textContent = '';
    }
  }

  function preflight(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const wizard = target.closest('#' + WIZARD_ID) || document.getElementById(WIZARD_ID);
    if (!wizard) return;

    const nextButton = target.closest('.uxq-sv2__next');
    if (nextButton) {
      normalizeCanonicalFields();
      const activePanel = wizard.querySelector('.uxq-sv2__panel.is-active');
      const problems = validatePanel(activePanel, wizard);
      if (problems.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showStepProblems(activePanel, problems);
      } else {
        showStepProblems(activePanel, []);
      }
      return;
    }

    const submitButton = target.closest('[data-studio-submit],[data-save-artifact]');
    if (!submitButton || !wizard.contains(submitButton)) return;

    normalizeCanonicalFields();
    syncVisibleToCanonical(wizard);
    const problems = validateAll(wizard);
    if (problems.length) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showSubmitProblems(wizard, problems);
      return;
    }
    showSubmitProblems(wizard, []);
  }

  function refresh() {
    installStyle();
    return normalizeCanonicalFields();
  }

  window.addEventListener('click', preflight, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once:true });
  else refresh();
  [120, 300, 700, 1400, 2600, 4800].forEach(ms => setTimeout(refresh, ms));
  ['uxq-studio-container-ready','uxq-studio-artifact-dispatched','uxq-direct-studio-confirmed','uxq-node-sheet-authority-ready']
    .forEach(name => window.addEventListener(name, refresh));

  window.UXQStudioValidationContractAuthorityV1 = Object.freeze({
    version:VERSION,
    refresh,
    validateAll
  });
})();
