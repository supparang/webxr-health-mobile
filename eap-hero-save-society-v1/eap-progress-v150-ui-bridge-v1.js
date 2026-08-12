/* =========================================================
   EAP Hero • EAP_Progress v150 UI Bridge v1
   VERSION: 20260812-EAP-PROGRESS-V150-UI-BRIDGE-V1

   PURPOSE
   - Convert serverResume.routeProgress[*].skills from EAP_Progress v150
     into the legacy state.portfolio shape used by Session cards,
     Recent Portfolio and score badges.
   - Preserve EAP_Progress as the single source of truth.
   - Never invent scores: only mirror server-provided score/passed values.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_PROGRESS_V150_UI_BRIDGE_V1__) return;
  window.__EAP_PROGRESS_V150_UI_BRIDGE_V1__ = true;

  var VERSION = '20260812-EAP-PROGRESS-V150-UI-BRIDGE-V1';
  var STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  var SKILLS = ['Reading','Writing','Listening','Speaking'];

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function num(v){ var n = Number(v); return isFinite(n) ? n : 0; }
  function read(){
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {}; }
    catch(_) { return {}; }
  }
  function write(s){
    try { localStorage.setItem(STATE_KEY, JSON.stringify(s || {})); return true; }
    catch(_) { return false; }
  }
  function routeNum(routeId){
    var m = clean(routeId).toUpperCase().match(/^S(1[0-5]|[1-9])$/);
    return m ? Number(m[1]) : 0;
  }
  function keyOf(e){
    return [clean(e.routeId || e.sessionId || e.session), clean(e.skill)].join('|').toUpperCase();
  }

  function recordsFromRouteProgress(resume){
    resume = resume || {};
    var rp = resume.routeProgress || {};
    var out = [];
    Object.keys(rp).forEach(function(routeId){
      var route = rp[routeId] || {};
      var sid = routeNum(routeId);
      if(!sid) return;
      var skills = route.skills || {};
      SKILLS.forEach(function(skill){
        var rec = skills[skill];
        if(!rec) return;
        var score = Math.max(num(rec.score), num(rec.bestScore), num(rec.latestScore));
        var passed = rec.passed === true || String(rec.passed).toLowerCase() === 'true' || score >= 60;
        if(!score && !passed && !clean(rec.evidenceId)) return;
        out.push({
          source:'EAP_Progress_v150',
          routeId:clean(rec.routeId || routeId).toUpperCase(),
          sessionId:'S' + sid,
          session:'S' + sid,
          sessionCode:'S' + sid,
          skill:skill,
          skillName:skill,
          score:score,
          latestScore:score,
          bestScore:score,
          passed:passed,
          authoritativePassed:passed,
          evidenceId:clean(rec.evidenceId),
          updatedAt:clean(rec.updatedAt),
          output: passed ? 'Passed' : (score ? 'Score ' + score : '')
        });
      });
    });
    return out;
  }

  function hydrate(detail){
    var s = read();
    var resume = detail && detail.routeProgress ? detail : (s.serverResume || {});
    if(!resume || !resume.routeProgress) return false;

    var serverRecords = recordsFromRouteProgress(resume);
    if(!serverRecords.length) return false;

    var existing = Array.isArray(s.portfolio) ? s.portfolio.slice() : [];
    var merged = {};
    existing.forEach(function(e){ if(e) merged[keyOf(e)] = e; });
    serverRecords.forEach(function(e){
      var k = keyOf(e);
      var old = merged[k] || {};
      var oldScore = Math.max(num(old.score),num(old.bestScore),num(old.latestScore));
      if(!merged[k] || num(e.score) >= oldScore || e.passed){ merged[k] = Object.assign({}, old, e); }
    });

    s.portfolio = Object.keys(merged).map(function(k){ return merged[k]; });
    s.portfolioSource = 'EAP_Progress_v150';
    s.portfolioHydratedAt = new Date().toISOString();
    write(s);

    try { window.dispatchEvent(new CustomEvent('eap:portfolio-hydrated-v150',{detail:{count:s.portfolio.length}})); } catch(_){}
    try { if(window.EAPStrictSkillScoreTruth && typeof window.EAPStrictSkillScoreTruth.refresh === 'function') window.EAPStrictSkillScoreTruth.refresh(); } catch(_){}
    return true;
  }

  function schedule(detail){ setTimeout(function(){ hydrate(detail); }, 0); }

  window.addEventListener('eap:resume-synced', function(e){ schedule(e && e.detail); });
  window.addEventListener('eap:single-authority-applied', function(e){ schedule(e && e.detail); });
  window.addEventListener('eap:cloud-resume-applied', function(e){ schedule(e && e.detail); });
  window.addEventListener('storage', function(e){ if(!e || e.key === STATE_KEY) schedule(); });

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ schedule(); });
  else schedule();

  window.EAPProgressV150UIBridgeV1 = {version:VERSION, hydrate:hydrate, recordsFromRouteProgress:recordsFromRouteProgress};
})();
