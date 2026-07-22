/* CSAI2601 UX Quest • Three-Part Completion Tracker v1.2
 * Distinguishes attempted, passed, and Sheet-confirmed states.
 * Google Sheet remains the official source of truth.
 */
(() => {
  'use strict';

  const VERSION = '20260722-THREE-PART-COMPLETION-V1.2';
  const params = new URLSearchParams(location.search || '');
  const nodeId = String(params.get('node') || params.get('id') || '').trim().toUpperCase();
  const nodeKey = nodeId.toLowerCase();
  if (!/^(W(?:[1-9]|1[0-5])|B[1-4])$/.test(nodeId)) return;

  const clean = (v, max = 500) => String(v == null ? '' : v).trim().slice(0, max);
  const number = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const config = () => window.UXQ_CLASSROOM_CONFIG || {};
  let server = {
    loaded:false, mission:false, missionAttempted:false, missionStars:0,
    missionScore:0, studio:false, reflection:false, reviewStatus:'', error:''
  };
  let dispatchPending = false;
  let requestStarted = false;

  function profile() {
    let stored = {};
    try { stored = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return {
      studentId:clean(stored.studentId || params.get('studentId') || params.get('sid') || '', 80),
      studentName:clean(stored.studentName || params.get('studentName') || params.get('name') || '', 120),
      section:clean(stored.section || params.get('section') || config().defaultSection || '', 80)
    };
  }

  function localMissionRecord() {
    try { return window.UXQProgress?.get?.()?.missions?.[nodeKey] || {}; }
    catch (_) { return {}; }
  }

  function missionState() {
    const mission = localMissionRecord();
    const last = mission.lastResult || {};
    const localStars = Math.max(number(mission.bestStars), number(last.stars));
    const localScore = Math.max(number(mission.bestScore), number(last.score));
    const localAttempted = Boolean(number(mission.attempts) > 0 || localScore > 0 || localStars > 0 || last.completedAt);
    const localPassed = Boolean(mission.completed || last.passed || localStars >= 2);

    const stars = Math.max(server.missionStars, localStars);
    const score = Math.max(server.missionScore, localScore);
    const attempted = Boolean(server.missionAttempted || localAttempted);
    const done = Boolean(server.mission || localPassed);

    if (server.mission) {
      return { done:true, attempted:true, status:'ผ่านแล้ว', source:'Google Sheet ยืนยัน mission_completed', state:'done', stars, score };
    }
    if (localPassed) {
      return { done:true, attempted:true, status:'ผ่านในเครื่อง • รอ Sheet', source:`ผลดีที่สุด ${stars}/3 ดาว${score ? ` • ${score} คะแนน` : ''} กำลังตรวจการยืนยันจาก Google Sheet`, state:'pending', stars, score };
    }
    if (attempted) {
      return {
        done:false, attempted:true, status:'เล่นแล้ว • ยังไม่ผ่าน',
        source:`มีคะแนนสะสม แต่เกณฑ์ผ่านต้องอย่างน้อย 2/3 ดาว • ดีที่สุด ${stars}/3 ดาว${score ? ` • ${score} คะแนน` : ''}`,
        state:'retry', stars, score
      };
    }
    return { done:false, attempted:false, status:'ยังไม่ได้เล่น', source:'เริ่ม Mission และทำให้ได้อย่างน้อย 2/3 ดาว', state:'missing', stars:0, score:0 };
  }

  function formState() {
    const artifact = document.querySelector('.artifact[data-studio-practice-v1]');
    if (!artifact) return { studioReady:false, reflectionReady:false, formVisible:false };
    const fields = Array.from(artifact.querySelectorAll('[data-studio-key]')).filter(el => !el.hidden);
    const reflection = fields.find(el => el.dataset.studioKey === 'reflection');
    const nonReflection = fields.filter(el => el.dataset.studioKey !== 'reflection');
    const fieldOkay = el => {
      const value = String(el.value || '').trim();
      const min = Number(el.dataset.minLength || 0);
      if (el.dataset.required === '1' && !value) return false;
      if (value && min && value.length < min) return false;
      if (el.dataset.format === 'url') {
        try { const u = new URL(value); if (!/^https?:$/.test(u.protocol)) return false; }
        catch (_) { return false; }
      }
      return true;
    };
    const checks = Array.from(artifact.querySelectorAll('[data-studio-check]'));
    return {
      formVisible:true,
      studioReady:nonReflection.length > 0 && nonReflection.every(fieldOkay) && checks.length > 0 && checks.every(c => c.checked),
      reflectionReady:Boolean(reflection && fieldOkay(reflection))
    };
  }

  function installStyle() {
    if (document.getElementById('uxq-three-part-style-v1')) return;
    const style = document.createElement('style');
    style.id = 'uxq-three-part-style-v1';
    style.textContent = `
      .uxq-3part{margin:18px 0;border:1px solid rgba(110,231,255,.34);border-radius:18px;padding:15px;background:rgba(7,23,54,.88);box-shadow:0 14px 38px rgba(0,0,0,.18)}
      .uxq-3part__head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}
      .uxq-3part__head h3{margin:0;font-size:1.06rem}.uxq-3part__head p{margin:4px 0 0;color:#b8cae8;font-size:.84rem;line-height:1.45}
      .uxq-3part__count{white-space:nowrap;border-radius:999px;padding:6px 10px;background:rgba(110,231,255,.12);color:#c9f8ff;font-weight:800}
      .uxq-3part__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
      .uxq-3part__item{border:1px solid rgba(181,205,255,.2);border-radius:14px;padding:11px;background:rgba(3,13,31,.42);min-height:92px}
      .uxq-3part__item b{display:block;margin-bottom:5px}.uxq-3part__item small{display:block;color:#aebedb;line-height:1.42;margin-top:4px}
      .uxq-3part__item[data-state='done']{border-color:rgba(74,222,128,.52);background:rgba(34,197,94,.09)}
      .uxq-3part__item[data-state='ready']{border-color:rgba(250,204,21,.52);background:rgba(250,204,21,.08)}
      .uxq-3part__item[data-state='pending']{border-color:rgba(96,165,250,.52);background:rgba(59,130,246,.09)}
      .uxq-3part__item[data-state='retry']{border-color:rgba(251,191,36,.56);background:rgba(245,158,11,.09)}
      .uxq-3part__item[data-state='missing']{border-color:rgba(248,113,113,.42);background:rgba(239,68,68,.07)}
      .uxq-3part__item[data-state='locked']{opacity:.76}
      .uxq-3part__foot{margin-top:10px;padding:9px 11px;border-radius:12px;background:rgba(255,255,255,.045);color:#d7e3f8;font-size:.82rem;line-height:1.48}
      @media(max-width:760px){.uxq-3part__grid{grid-template-columns:1fr}.uxq-3part__head{display:block}.uxq-3part__count{display:inline-block;margin-top:8px}}
    `;
    document.head.appendChild(style);
  }

  function card(label, status, detail, state) {
    return `<div class="uxq-3part__item" data-state="${state}"><b>${label}</b><span>${status}</span><small>${detail}</small></div>`;
  }

  function findAnchor() {
    const artifact = document.querySelector('.artifact[data-studio-practice-v1]');
    if (artifact) return { parent:artifact.parentNode, before:artifact };
    const root = document.getElementById('uxqCanonicalNode') || document.body;
    const startCard = root.querySelector('.hero-card, .mission-card, .intro-card, article, section');
    if (startCard && startCard.parentNode) return { parent:startCard.parentNode, before:startCard.nextSibling };
    return { parent:root, before:root.firstChild };
  }

  function mount() {
    installStyle();
    let box = document.getElementById('uxqThreePartCompletion');
    const anchor = findAnchor();
    if (!box) {
      box = document.createElement('section');
      box.id = 'uxqThreePartCompletion';
      box.className = 'uxq-3part';
      anchor.parent.insertBefore(box, anchor.before || null);
    } else {
      const artifact = document.querySelector('.artifact[data-studio-practice-v1]');
      if (artifact && box.nextElementSibling !== artifact) artifact.parentNode.insertBefore(box, artifact);
    }
    render();
  }

  function render() {
    const box = document.getElementById('uxqThreePartCompletion');
    if (!box) return;
    const mission = missionState();
    const form = formState();
    const studioDone = Boolean(server.studio);
    const reflectionDone = Boolean(server.reflection);
    const completeCount = [mission.done, studioDone, reflectionDone].filter(Boolean).length;

    const studioStatus = studioDone ? ['ยืนยันแล้ว','Google Sheet พบ Studio Artifact','done']
      : dispatchPending ? ['รอยืนยัน Sheet','ส่งคำขอแล้ว แต่ยังไม่ถือว่าครบ','pending']
      : form.studioReady ? ['พร้อมส่ง','กรอก Studio และ Self-check ครบแล้ว','ready']
      : form.formVisible ? ['ยังไม่ครบ','กรอกช่อง Studio และ Self-check ให้ครบ','missing']
      : mission.attempted && !mission.done ? ['ยังล็อก','ต้องผ่าน Mission อย่างน้อย 2/3 ดาวก่อน','locked']
      : ['ยังไม่เปิด','เล่นและผ่าน Mission เพื่อเปิด Studio Practice','locked'];

    const reflectionStatus = reflectionDone ? ['ยืนยันแล้ว','Google Sheet พบ Weekly Reflection','done']
      : dispatchPending && form.reflectionReady ? ['รอยืนยัน Sheet','Reflection รวมอยู่ในคำขอที่ส่งแล้ว','pending']
      : form.reflectionReady ? ['พร้อมส่ง','Reflection ผ่านเกณฑ์ขั้นต่ำแล้ว','ready']
      : form.formVisible ? ['ยังไม่ครบ','กรอก Reflection ของสัปดาห์นี้','missing']
      : mission.attempted && !mission.done ? ['ยังล็อก','ต้องผ่าน Mission อย่างน้อย 2/3 ดาวก่อน','locked']
      : ['ยังไม่เปิด','เล่นและผ่าน Mission เพื่อเปิด Reflection','locked'];

    const foot = completeCount === 3
      ? '✅ ครบทั้ง 3 ส่วนแล้ว และ Google Sheet ยืนยันข้อมูลครบ'
      : mission.attempted && !mission.done
        ? 'คะแนนแสดงว่ามีการเล่นแล้ว แต่ยังไม่ถึงเกณฑ์ผ่าน ให้เล่นซ้ำจนได้อย่างน้อย 2/3 ดาว แล้ว Studio Practice จะเปิด'
        : 'ต้องเห็น 3/3 จึงถือว่าส่งครบ การเปิด W ถัดไปยืนยันเฉพาะ Mission ไม่ได้ยืนยัน Studio และ Reflection';

    box.innerHTML = `
      <div class="uxq-3part__head"><div><h3>ตรวจความครบ 3 ส่วน • ${nodeId}</h3><p>Mission → Studio Practice → Weekly Reflection โดยใช้ Google Sheet เป็นหลักฐานทางการ</p></div><span class="uxq-3part__count">${completeCount}/3 ยืนยันจากระบบ</span></div>
      <div class="uxq-3part__grid">
        ${card('1. Mission / Game', mission.status, mission.source, mission.state)}
        ${card('2. Studio Practice', ...studioStatus)}
        ${card('3. Weekly Reflection', ...reflectionStatus)}
      </div>
      <div class="uxq-3part__foot">${foot}${server.error ? `<br>⚠ ${server.error}` : ''}</div>`;
  }

  function applyServerData(data) {
    if (!data || data.ok === false) {
      server.error = clean(data?.error || 'อ่าน Studio progress ไม่สำเร็จ');
      return;
    }
    const row = data.nodes?.[nodeKey] || data.nodes?.[nodeId] || data.items?.find?.(x => String(x.nodeId || x.missionId).toLowerCase() === nodeKey) || {};
    const missionRow = data.missions?.[nodeKey] || data.missions?.[nodeId] || {};
    const stars = Math.max(number(missionRow.bestStars), number(missionRow.stars), number(row.bestStars), number(row.missionStars));
    const score = Math.max(number(missionRow.bestScore), number(missionRow.score), number(row.bestScore), number(row.missionScore));
    server.mission = Boolean(missionRow.completed || missionRow.passed || row.missionCompleted || stars >= 2);
    server.missionAttempted = Boolean(server.mission || number(missionRow.attempts) > 0 || stars > 0 || score > 0 || missionRow.completedAt);
    server.missionStars = stars;
    server.missionScore = score;
    server.studio = Boolean(row.submitted || row.artifactSubmitted || row.studioSubmitted || row.reviewStatus || row.status);
    server.reflection = Boolean(row.reflectionSubmitted || row.hasReflection || clean(row.reflection || '').length > 0);
    server.reviewStatus = clean(row.reviewStatus || row.status || '');
    server.error = '';
  }

  function loadServerStatus(force = false) {
    if (requestStarted && !force) return;
    const p = profile();
    const endpoint = clean(config().receiverUrl || '', 800);
    if (!endpoint || !p.studentId || !p.section) {
      server.error = 'ยังตรวจ Studio/Reflection จาก Sheet ไม่ได้จนกว่าโปรไฟล์และ Receiver route จะพร้อม';
      render();
      return;
    }
    requestStarted = true;
    const callback = `UXQ3Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timer = setTimeout(() => {
      delete window[callback]; script.remove(); requestStarted = false;
      server.error = 'หมดเวลารอการยืนยันจาก Sheet'; render();
    }, 12000);
    window[callback] = data => {
      clearTimeout(timer); delete window[callback]; script.remove(); requestStarted = false;
      server.loaded = true; applyServerData(data); render();
    };
    const q = new URLSearchParams({
      action:'uxq_student_studio_progress', studentId:p.studentId, section:p.section,
      courseId:clean(config().courseId || 'UXQ-ACT1-2026', 120), callback
    });
    script.src = `${endpoint}${endpoint.includes('?') ? '&' : '?'}${q.toString()}`;
    script.onerror = () => {
      clearTimeout(timer); delete window[callback]; script.remove(); requestStarted = false;
      server.error = 'เชื่อม Receiver เพื่อตรวจสถานะไม่สำเร็จ'; render();
    };
    document.head.appendChild(script);
  }

  document.addEventListener('input', event => {
    if (event.target.closest?.('.artifact[data-studio-practice-v1]')) render();
  });
  document.addEventListener('change', event => {
    if (event.target.closest?.('.artifact[data-studio-practice-v1]')) render();
  });
  window.addEventListener('uxq-progress-updated', () => { mount(); render(); });
  window.addEventListener('uxq-studio-artifact-dispatched', () => {
    dispatchPending = true; render(); setTimeout(() => loadServerStatus(true), 2500);
  });
  window.addEventListener('uxq-mission-completed', () => { mount(); render(); setTimeout(() => loadServerStatus(true), 1800); });

  let timer = 0;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { mount(); if (!server.loaded) loadServerStatus(); }, 80);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true });
  else schedule();
  new MutationObserver(schedule).observe(document.body, { childList:true, subtree:true });

  window.UXQThreePartCompletionV1 = Object.freeze({ version:VERSION, render, loadServerStatus, mount });
})();