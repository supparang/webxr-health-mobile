/* =========================================================
   EAP Hero Roadmap Lock Guard v20260708
   - Locks 15-week roadmap cards/buttons until prior route passes.
   - No top overlay. No compact map. No weekly default route.
   - S1 opens first. Next route opens only after required skills pass 60/100.
   - Normal sessions use content-pack Core + Support. Boss Gates require integrated evidence.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260708-EAP-ROADMAP-LOCK-GUARD-V1';
  const PACK_NAME = 'EAP_HERO_SESSION_CONTENT_PACK';
  const STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  const PASS_MARK = 60;
  const SKILLS = ['reading','listening','writing','speaking'];
  const STYLE_ID = 'eap-roadmap-lock-guard-style';
  const TOAST_ID = 'eap-roadmap-lock-guard-toast';

  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
  function lower(value){ return clean(value).toLowerCase(); }
  function num(value){ const n = Number(value); return Number.isFinite(n) ? n : 0; }
  function cap(value){ const s = clean(value); return s.charAt(0).toUpperCase() + s.slice(1); }
  function normalizeRoute(value){
    const raw = clean(value).toUpperCase();
    if (!raw) return '';
    return /^\d+$/.test(raw) ? 'S' + Number(raw) : raw;
  }

  function pack(){
    const data = window[PACK_NAME];
    return data && Array.isArray(data.routes) ? data : null;
  }

  function routes(){
    const data = pack();
    if (!data) return [];
    const order = Array.isArray(data.routeOrder) && data.routeOrder.length
      ? data.routeOrder
      : data.routes.map(route => route.routeId);
    return order
      .map(id => data.routes.find(route => normalizeRoute(route.routeId) === normalizeRoute(id)))
      .filter(Boolean);
  }

  function routeById(routeId){
    const key = normalizeRoute(routeId);
    return routes().find(route => normalizeRoute(route.routeId) === key) || null;
  }

  function readState(){
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
    catch(error){ return {}; }
  }

  function progressEntries(){
    const state = readState();
    const out = [];
    ['portfolio','attempts','evidence','summary','records'].forEach(key => {
      if (Array.isArray(state[key])) out.push.apply(out, state[key]);
    });
    if (state.sessions && typeof state.sessions === 'object') {
      Object.keys(state.sessions).forEach(sessionKey => {
        const value = state.sessions[sessionKey];
        if (Array.isArray(value)) {
          value.forEach(item => out.push(Object.assign({ sessionId: sessionKey }, item || {})));
        } else if (value && typeof value === 'object') {
          Object.keys(value).forEach(skillKey => {
            const item = value[skillKey];
            if (item && typeof item === 'object') out.push(Object.assign({ sessionId: sessionKey, skill: skillKey }, item));
          });
        }
      });
    }
    return out;
  }

  function entryRoute(entry){
    const raw = entry && (entry.routeId || entry.sessionId || entry.session || entry.stage || '');
    return typeof raw === 'number' ? 'S' + raw : normalizeRoute(raw);
  }

  function entrySkill(entry){ return lower(entry && entry.skill); }

  function entryScore(entry){
    return Math.max(
      num(entry && entry.bestScore),
      num(entry && entry.latestScore),
      num(entry && entry.score),
      num(entry && entry.stars) >= 3 ? 100 : 0
    );
  }

  function entryPassed(entry){
    const raw = entry && (entry.passed !== undefined ? entry.passed : entry.pass);
    return raw === true || String(raw).toLowerCase() === 'true' || String(raw) === '1' || entryScore(entry) >= PASS_MARK;
  }

  function bestByRouteSkill(){
    const best = {};
    progressEntries().forEach(entry => {
      const routeId = entryRoute(entry);
      const skill = entrySkill(entry);
      if (!routeId || !skill) return;
      const key = routeId + '|' + skill;
      const score = entryScore(entry);
      const passed = entryPassed(entry);
      if (!best[key] || score > best[key].score || passed) best[key] = { routeId, skill, score, passed };
    });
    return best;
  }

  function requiredSkills(route){
    if (!route) return [];
    if (route.routeType === 'boss_gate') return SKILLS.slice();
    const contract = route.skillContract || {};
    const required = SKILLS.filter(skill => ['Core','Support','Integrated'].indexOf(clean(contract[skill])) >= 0);
    return required.length ? required : ['reading','writing'];
  }

  function routeStatus(routeId){
    const route = routeById(routeId);
    if (!route) return { routeId: normalizeRoute(routeId), complete:false, required:[], passed:[], missing:[], scores:{} };
    const rid = normalizeRoute(route.routeId);
    const best = bestByRouteSkill();
    const required = requiredSkills(route);
    const passed = [];
    const missing = [];
    const scores = {};
    required.forEach(skill => {
      const item = best[rid + '|' + skill];
      scores[skill] = item ? item.score : 0;
      if (item && (item.passed || item.score >= PASS_MARK)) passed.push(skill);
      else missing.push(skill);
    });
    return {
      routeId: rid,
      routeType: route.routeType,
      title: route.title || '',
      complete: missing.length === 0,
      required,
      passed,
      missing,
      scores
    };
  }

  function firstIncompleteIndex(){
    const list = routes();
    for (let i = 0; i < list.length; i++) {
      if (!routeStatus(list[i].routeId).complete) return i;
    }
    return list.length;
  }

  function firstOpenRoute(){
    const list = routes();
    return list[Math.min(firstIncompleteIndex(), Math.max(0, list.length - 1))] || null;
  }

  function isUnlocked(routeId){
    const list = routes();
    const idx = list.findIndex(route => normalizeRoute(route.routeId) === normalizeRoute(routeId));
    if (idx < 0) return false;
    if (idx === 0) return true;
    return idx <= firstIncompleteIndex();
  }

  function lockedReason(routeId){
    const list = routes();
    const idx = list.findIndex(route => normalizeRoute(route.routeId) === normalizeRoute(routeId));
    if (idx < 0) return 'ไม่พบด่านนี้ในแผนการเรียน';
    for (let i = 0; i < idx; i++) {
      const status = routeStatus(list[i].routeId);
      if (!status.complete) return 'ต้องผ่าน ' + status.routeId + ' ก่อน: ' + status.missing.map(cap).join(' + ') + ' ให้ได้อย่างน้อย 60/100';
    }
    return '';
  }

  function setActive(route){
    if (!route) return;
    try {
      const rid = normalizeRoute(route.routeId);
      localStorage.setItem('EAP_HERO_ACTIVE_ROUTE', rid);
      localStorage.setItem('EAP_HERO_CURRENT_ROUTE', rid);
      const m = rid.match(/^S(\d+)$/i);
      if (m) localStorage.setItem('EAP_HERO_CURRENT_SESSION', String(Number(m[1])));
    } catch(error) {}
  }

  function currentStoredRoute(){
    const keys = ['EAP_HERO_ACTIVE_ROUTE','EAP_HERO_CURRENT_ROUTE','EAP_HERO_CURRENT_SESSION','EAP_ACTIVE_SESSION'];
    for (const key of keys) {
      try {
        const raw = clean(localStorage.getItem(key));
        if (raw) return normalizeRoute(raw);
      } catch(error) {}
    }
    return '';
  }

  function normalizeCurrentIfLocked(){
    const rid = currentStoredRoute();
    if (!rid || isUnlocked(rid)) return false;
    const open = firstOpenRoute();
    setActive(open);
    return true;
  }

  function addCss(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #eap-student-15week-roadmap .rm-card.locked{opacity:.55;filter:grayscale(.18);background:#f8fafc;border-style:dashed}
      #eap-student-15week-roadmap .rm-card.locked .rm-contract{color:#9a6700}
      #eap-student-15week-roadmap .rm-card.locked button{background:#edf2f7!important;color:#64748b!important;cursor:not-allowed!important}
      #eap-student-15week-roadmap .rm-card.done{border-color:#99f6e4;box-shadow:0 0 0 2px rgba(20,184,166,.10)}
      #eap-student-15week-roadmap .rm-lock-note{font-size:11px;font-weight:950;color:#9a6700;line-height:1.3}
      #eap-student-15week-roadmap .rm-done-note{font-size:11px;font-weight:950;color:#087f5b;line-height:1.3}
      #${TOAST_ID}{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:999999;max-width:min(620px,calc(100vw - 28px));padding:13px 16px;border-radius:14px;background:#7c2d12;color:#fff;box-shadow:0 14px 35px rgba(0,0,0,.25);font:800 13px Arial,'Noto Sans Thai',sans-serif;text-align:center}
    `;
    document.head.appendChild(style);
  }

  function toast(message){
    let node = document.getElementById(TOAST_ID);
    if (!node) {
      node = document.createElement('div');
      node.id = TOAST_ID;
      document.body.appendChild(node);
    }
    node.textContent = message;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { if (node && node.parentNode) node.remove(); }, 4200);
  }

  function note(card, cls, text){
    let node = card.querySelector('.rm-lock-note,.rm-done-note');
    if (!text) { if (node) node.remove(); return; }
    if (!node) {
      node = document.createElement('div');
      card.querySelector('.rm-actions')?.insertAdjacentElement('beforebegin', node);
    }
    node.className = cls;
    node.textContent = text;
  }

  function decorate(){
    addCss();
    const changed = normalizeCurrentIfLocked();
    if (changed && window.EAPStudentHomeRoadmap && typeof window.EAPStudentHomeRoadmap.refresh === 'function') {
      setTimeout(() => window.EAPStudentHomeRoadmap.refresh(), 50);
    }
    document.querySelectorAll('[data-eap-roadmap-card]').forEach(card => {
      const routeId = normalizeRoute(card.getAttribute('data-eap-roadmap-card'));
      const status = routeStatus(routeId);
      const unlocked = isUnlocked(routeId);
      const done = status.complete;
      card.classList.toggle('locked', !unlocked);
      card.classList.toggle('done', unlocked && done);
      card.dataset.eapUnlocked = unlocked ? '1' : '0';
      card.dataset.eapComplete = done ? '1' : '0';
      card.querySelectorAll('[data-eap-roadmap-route],[data-eap-roadmap-brief]').forEach(button => {
        button.disabled = !unlocked;
        button.setAttribute('aria-disabled', !unlocked ? 'true' : 'false');
        button.dataset.eapLocked = !unlocked ? '1' : '0';
      });
      if (!unlocked) note(card, 'rm-lock-note', '🔒 ล็อกไว้ก่อน · ' + lockedReason(routeId));
      else if (done) note(card, 'rm-done-note', '✓ ผ่านเกณฑ์แล้ว · ย้อนทบทวน/เล่นซ้ำได้');
      else note(card, 'rm-lock-note', '🎯 ด่านปัจจุบัน · ต้องผ่าน ' + status.missing.map(cap).join(' + ') + ' ≥ 60/100');
    });
  }

  function clickGuard(event){
    const button = event.target && event.target.closest && event.target.closest('[data-eap-roadmap-route],[data-eap-roadmap-brief]');
    if (!button) return;
    const routeId = normalizeRoute(button.getAttribute('data-eap-roadmap-route') || button.getAttribute('data-eap-roadmap-brief'));
    if (!routeId || isUnlocked(routeId)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    toast('ยังเข้า ' + routeId + ' ไม่ได้: ' + lockedReason(routeId));
  }

  let timer;
  function schedule(){ clearTimeout(timer); timer = setTimeout(decorate, 120); }
  function start(){
    addCss();
    document.addEventListener('click', clickGuard, true);
    window.addEventListener('load', schedule);
    window.addEventListener('storage', schedule);
    new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true, characterData:true });
    schedule();
  }

  window.EAPRoadmapLockGuard = { version:VERSION, routeStatus, isUnlocked, lockedReason, refresh:decorate };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();