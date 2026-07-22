/* CSAI2601 UX Quest • Figma Project Continuity v1
 * W1 creates one Master Figma Project.
 * W2-W15 extend the same project; B1-B4 use it for evidence/defense.
 * localStorage is draft convenience only and never controls official progress.
 */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search || '');
  const nodeId = String(params.get('node') || params.get('id') || 'W1').trim().toUpperCase();
  const isBoss = /^B[1-4]$/.test(nodeId);
  const isW1 = nodeId === 'W1';
  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const FIGMA_RE = /^https:\/\/(?:www\.)?figma\.com\/(?:design|file|proto|board|slides|make)\//i;
  const VERSION = '20260722-FIGMA-PROJECT-CONTINUITY-V1';

  function identityKey() {
    let profile = {};
    try { profile = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    const studentId = String(profile.studentId || params.get('studentId') || params.get('sid') || 'anonymous').trim();
    const section = String(profile.section || params.get('section') || 'default').trim();
    return `${studentId}::${section}`;
  }

  function cacheKey() { return `uxq.csai2601.masterFigma.v1.${identityKey()}`; }
  function readMaster() {
    try {
      const value = String(localStorage.getItem(cacheKey()) || '').trim();
      return FIGMA_RE.test(value) ? value : '';
    } catch (_) { return ''; }
  }
  function saveMaster(value) {
    const clean = String(value || '').trim();
    if (!FIGMA_RE.test(clean)) return;
    try { localStorage.setItem(cacheKey(), clean); } catch (_) {}
  }

  function spec() {
    return window.CSAI2601_UXQ_STUDIO_PRACTICE_V1?.byId?.(nodeId) || null;
  }

  function patchCanonicalSpec() {
    const item = spec();
    if (!item || !Array.isArray(item.fields)) return;
    const project = item.fields.find(field => field.key === 'projectId');
    const figma = item.fields.find(field => field.key === 'figmaUrl');
    if (project) {
      project.label = isW1 ? 'Master Project ID' : 'Master Project ID เดิม';
      project.placeholder = isW1
        ? 'ตั้งรหัสโครงการหลัก เช่น W1-UX-Audit-รหัสนักศึกษา'
        : 'ใช้ Project ID เดียวกับ W1 ห้ามสร้างโครงการใหม่';
    }
    if (figma) {
      figma.label = isW1 ? 'Master Figma Project URL' : 'Project / Evidence URL';
      figma.placeholder = isW1
        ? 'วางลิงก์ Master Figma Project ที่จะใช้ต่อเนื่องถึง W15'
        : isBoss
          ? 'วางลิงก์ Project เดิมหรือ Section หลักฐานสำหรับ Defense'
          : `วางลิงก์ Project เดิมหรือ Page/Section ของ ${nodeId}`;
    }
  }

  function validFigma(value) { return FIGMA_RE.test(String(value || '').trim()); }

  function protectTextFields(artifact) {
    artifact.querySelectorAll('[data-studio-key]').forEach(input => {
      const key = input.dataset.studioKey;
      if (key === 'figmaUrl') return;
      const value = String(input.value || '').trim();
      if (validFigma(value)) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles:true }));
        input.dispatchEvent(new Event('change', { bubbles:true }));
      }
      if (input.dataset.uxqFigmaGuard === '1') return;
      input.dataset.uxqFigmaGuard = '1';
      input.addEventListener('input', () => {
        const current = String(input.value || '').trim();
        if (!validFigma(current)) return;
        input.value = '';
        input.setCustomValidity('ลิงก์ Figma ต้องวางในช่อง Project / Evidence URL เท่านั้น');
        input.reportValidity?.();
        setTimeout(() => input.setCustomValidity(''), 1800);
        input.dispatchEvent(new Event('change', { bubbles:true }));
      });
    });
  }

  function setText(element, text) { if (element && text) element.textContent = text; }

  function patchGuidedCopy(artifact) {
    const guide = artifact.querySelector('.uxq-gs');
    if (!guide) return;

    const panels = Array.from(guide.querySelectorAll('.uxq-gs__panel'));
    const projectPanel = panels.find(panel => panel.querySelector('[data-studio-key="projectId"]'));
    const finalPanel = panels.find(panel => panel.querySelector('#uxqGsUrl'));

    if (projectPanel) {
      projectPanel.dataset.title = isW1 ? 'สร้าง Master Project ครั้งเดียว' : isBoss ? 'ใช้ Project เดิมสำหรับ Defense' : 'เปิด Project เดิมและเพิ่มงาน';
      projectPanel.dataset.subtitle = isW1 ? 'Project นี้ใช้ต่อเนื่อง W1–W15' : 'ห้ามสร้างไฟล์ใหม่ ให้ต่อยอดจาก W1';
      const figmaBox = projectPanel.querySelector('.uxq-gs__figma');
      const heading = figmaBox?.querySelector('h3');
      const open = figmaBox?.querySelector('.uxq-gs__open');
      setText(heading, isW1
        ? 'สร้าง Master Figma Project ครั้งเดียว'
        : isBoss
          ? `เปิด Project เดิมเพื่อทำ ${nodeId} Defense`
          : `เปิด Project เดิมและเพิ่ม Page / Section สำหรับ ${nodeId}`);
      if (open) {
        open.textContent = isW1 ? 'สร้าง Master Figma Project ↗' : 'เปิด Figma Project เดิม ↗';
        if (!isW1 && readMaster()) open.href = readMaster();
      }
      const list = figmaBox?.querySelector('ol');
      if (list) {
        const intro = isW1
          ? ['สร้างไฟล์หลักเพียงครั้งเดียว','ตั้งชื่อไฟล์ด้วย Project ID','สร้าง Page หรือ Section W1','ใช้ไฟล์นี้ต่อเนื่องถึง W15']
          : isBoss
            ? ['เปิด Master Project เดิม','รวบรวมหลักฐานจาก Weeks ก่อนหน้า','สร้าง Defense Section','ห้ามสร้าง Project ใหม่']
            : ['เปิด Master Project เดิม','เพิ่ม Page หรือ Section ของสัปดาห์นี้','ต่อยอดจาก Artifact ก่อนหน้า','ห้ามสร้าง Project ใหม่'];
        list.innerHTML = intro.map(text => `<li>${text}</li>`).join('');
      }
    }

    if (finalPanel) {
      setText(finalPanel.querySelector('.uxq-gs__figma h3'), isW1 ? 'บันทึก Master Figma Project URL' : 'ตรวจ Project / Evidence URL');
      const paragraph = finalPanel.querySelector('.uxq-gs__figma > p');
      setText(paragraph, isW1
        ? 'กด Share → ตั้งสิทธิ์ให้ผู้ตรวจเปิดได้ → Copy link ลิงก์นี้จะถูกใช้เป็น Project หลักใน W2–W15'
        : isBoss
          ? 'ใช้ลิงก์ Project เดิมหรือ Section ที่รวมหลักฐานสำหรับ Defense'
          : `ใช้ลิงก์ Project เดิม หรือ Deep link ไปยัง Page / Section ของ ${nodeId}`);
      setText(finalPanel.querySelector('.uxq-gs__url label'), isW1 ? 'Master Figma Project URL' : 'Project / Evidence URL');
      const topUrl = finalPanel.querySelector('#uxqGsUrl');
      if (topUrl) topUrl.placeholder = isW1 ? 'https://www.figma.com/design/...' : `Project เดิมหรือ Section ของ ${nodeId}`;
      const open = finalPanel.querySelector('.uxq-gs__open');
      if (open) {
        open.textContent = isW1 ? 'เปิด Figma ↗' : 'เปิด Project เดิม ↗';
        if (!isW1 && readMaster()) open.href = readMaster();
      }
    }

    const resultText = guide.querySelector('.uxq-gs__quality p');
    if (resultText) {
      resultText.textContent = `${spec()?.canonicalArtifact || 'Studio Artifact'} พร้อม Project ID, ${isW1 ? 'Master Figma Project URL' : 'Project / Evidence URL'}, คำอธิบายจากหลักฐาน, Reflection และ Self-check`;
    }
  }

  function syncMaster(artifact) {
    const figma = artifact.querySelector('[data-studio-key="figmaUrl"]');
    const topUrl = artifact.querySelector('#uxqGsUrl');
    if (!figma) return;

    const master = readMaster();
    if (!isW1 && !String(figma.value || '').trim() && master) {
      figma.value = master;
      figma.dispatchEvent(new Event('input', { bubbles:true }));
      figma.dispatchEvent(new Event('change', { bubbles:true }));
    }
    if (topUrl && !String(topUrl.value || '').trim() && String(figma.value || '').trim()) {
      topUrl.value = figma.value;
      topUrl.dispatchEvent(new Event('input', { bubbles:true }));
    }

    const save = source => {
      const value = String(source.value || '').trim();
      if (validFigma(value)) saveMaster(value);
    };
    if (figma.dataset.uxqMasterListener !== '1') {
      figma.dataset.uxqMasterListener = '1';
      figma.addEventListener('input', () => save(figma));
      figma.addEventListener('change', () => save(figma));
    }
    if (topUrl && topUrl.dataset.uxqMasterListener !== '1') {
      topUrl.dataset.uxqMasterListener = '1';
      topUrl.addEventListener('input', () => save(topUrl));
      topUrl.addEventListener('change', () => save(topUrl));
    }
    save(figma);
  }

  function apply() {
    patchCanonicalSpec();
    const artifact = ROOT.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact) return;
    artifact.dataset.figmaContinuity = isW1 ? 'master-create' : isBoss ? 'defense-reuse' : 'weekly-reuse';
    protectTextFields(artifact);
    patchGuidedCopy(artifact);
    syncMaster(artifact);
  }

  let timer = 0;
  function schedule() { clearTimeout(timer); timer = setTimeout(apply, 60); }
  patchCanonicalSpec();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true }); else schedule();
  new MutationObserver(schedule).observe(ROOT, { childList:true, subtree:true });
  window.addEventListener('uxq-mission-resume-studio', schedule);
  window.addEventListener('uxq-direct-studio-confirmed', schedule);
  window.addEventListener('uxq-profile-updated', schedule);

  window.UXQFigmaProjectContinuityV1 = Object.freeze({ apply, readMaster, saveMaster, version:VERSION });
})();