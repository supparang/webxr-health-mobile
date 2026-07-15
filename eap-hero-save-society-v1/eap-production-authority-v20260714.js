/* =========================================================
   EAP Hero Production Authority v20260715
   LIVE-SHEET-ONLY / Section 122
   - Official progress and unlocks come only from a fresh player_resume response.
   - localStorage may cache UI/profile data but cannot complete or unlock a route.
   - A learner without a live matching Sheet record starts at S1 only.
   - Boss Speaking passes the route from the verified Sheet score/pass result.
   - Teacher Review remains a separate evidence-quality workflow and never re-locks
     a Boss Gate that the learner has already cleared in the game.
========================================================= */
(function(){
  'use strict';
  if (window.__EAP_PRODUCTION_AUTHORITY_V2__) return;
  window.__EAP_PRODUCTION_AUTHORITY_V2__ = true;

  var VERSION = 'v20260715-EAP-PRODUCTION-AUTHORITY-LIVE-SHEET-ONLY-V2-NONBLOCKING-REVIEW';
  var ORDER = ['S1','S2','S3','B1','S4','S5','S6','B2','S7','S8','S9','B3','S10','S11','S12','B4','S13','S14','S15','B5'];
  var SKILLS = ['reading','listening','writing','speaking'];
  var PASS = 60;
  var live = { verified:false, records:[], generatedAt:'', identity:'', source:'' };
  var patchTimer = null;
  var renderTimer = null;

  function text(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function norm(v){
    var raw = text(v && v.routeId || v).toUpperCase();
    var m = raw.match(/^S(?:ESSION)?\s*0?(1[0-5]|[1-9])$/i);
    if (m) return 'S' + Number(m[1]);
    m = raw.match(/^B(?:OSS)?\s*0?([1-5])$/i);
    if (m) return 'B' + Number(m[1]);
    if (/^\d+$/.test(raw)) return 'S' + Number(raw);
    return raw;
  }
  function skill(v){ return text(v).toLowerCase(); }
  function number(v){ var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function bool(v){ return v === true || String(v).toLowerCase() === 'true' || String(v) === '1'; }
  function readState(){ try { return JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3') || '{}'); } catch(_) { return {}; } }
  function profile(){
    var s = readState();
    var p = Object.assign({}, s.profile || {}, s.player || {}, s.user || {});
    return {
      studentId:text(p.studentId || p.id || s.studentId || s.id || ''),
      studentName:text(p.studentName || p.name || s.studentName || s.name || ''),
      section:text(p.section || s.section || (window.EAP_SHEET_CONFIG || {}).section || '122') || '122'
    };
  }
  function identityKey(p){ p = p || profile(); return p.section + '__' + p.studentId; }
  function pack(){ var p = window.EAP_HERO_SESSION_CONTENT_PACK; return p && Array.isArray(p.routes) ? p : null; }
  function route(id){ var p = pack(), rid = norm(id); return p && p.routes.find(function(r){ return norm(r.routeId) === rid; }) || null; }
  function routeIndex(id){ return ORDER.indexOf(norm(id)); }
  function required(id){
    var r = route(id);
    if (!r) return [];
    if (r.routeType === 'boss_gate') return SKILLS.slice();
    var c = r.skillContract || {};
    return SKILLS.filter(function(s){ return ['core','support','integrated'].indexOf(text(c[s]).toLowerCase()) >= 0; });
  }
  function recentServerResponse(data){
    if (!data || data.ok !== true || !Array.isArray(data.records)) return false;
    var p = profile();
    if (!p.studentId || text(data.studentId) !== p.studentId || text(data.section || p.section) !== p.section) return false;
    var stamp = Date.parse(text(data.generatedAt));
    if (!Number.isFinite(stamp)) return false;
    return Math.abs(Date.now() - stamp) <= 180000;
  }
  function teacherReviewState(row, rid, sk){
    if (!/^B[1-5]$/.test(rid) || sk !== 'speaking') return 'not_required';
    var value = text(row.teacherReviewStatus || row.reviewStatus).toLowerCase();
    if (/reviewed|approved|accepted|pass|passed|complete|completed/.test(value)) return 'approved';
    if (/revise|revision|rework|needs[_ -]?work/.test(value)) return 'revise';
    return 'pending';
  }
  function recordPass(row){
    var rid = norm(row.routeId || row.sessionId || row.session);
    var sk = skill(row.skill || row.skillName);
    var score = Math.max(number(row.bestScore), number(row.latestScore), number(row.score));
    /*
      Unlock policy:
      A verified Sheet result with passed=true or score >= 60 clears the skill.
      Boss Speaking teacher review is asynchronous feedback. It remains visible in
      diagnostics/dashboard but does not send a learner back to a cleared Boss Gate.
    */
    return !!rid && !!sk && (bool(row.passed) || score >= PASS);
  }
  function bestMap(){
    var out = {};
    if (!live.verified) return out;
    live.records.forEach(function(row){
      var rid = norm(row.routeId || row.sessionId || row.session);
      var sk = skill(row.skill || row.skillName);
      if (!rid || !sk || ORDER.indexOf(rid) < 0 || SKILLS.indexOf(sk) < 0) return;
      var score = Math.max(number(row.bestScore), number(row.latestScore), number(row.score));
      var key = rid + '|' + sk;
      var item = {
        score:score,
        passed:recordPass(row),
        reviewState:teacherReviewState(row, rid, sk),
        row:row
      };
      if (!out[key] || item.score > out[key].score || (item.passed && !out[key].passed)) out[key] = item;
    });
    return out;
  }
  function status(id){
    var rid = norm(id), req = required(rid), best = bestMap(), passed = [], missing = [], scores = {}, pendingReview = [], reviseReview = [];
    req.forEach(function(sk){
      var item = best[rid + '|' + sk];
      scores[sk] = item ? item.score : 0;
      if (item && item.passed) passed.push(sk); else missing.push(sk);
      if (item && item.reviewState === 'pending') pendingReview.push(sk);
      if (item && item.reviewState === 'revise') reviseReview.push(sk);
    });
    return {
      routeId:rid,
      required:req,
      passed:passed,
      missing:missing,
      scores:scores,
      pendingTeacherReview:pendingReview,
      teacherRevisionRequested:reviseReview,
      complete:req.length > 0 && missing.length === 0,
      liveVerified:live.verified
    };
  }
  function firstIncomplete(){
    if (!live.verified) return 0;
    for (var i=0; i<ORDER.length; i++) if (!status(ORDER[i]).complete) return i;
    return ORDER.length - 1;
  }
  function currentId(){ return ORDER[firstIncomplete()] || 'S1'; }
  function canOpen(id){ var idx = routeIndex(id); return idx >= 0 && idx <= firstIncomplete(); }
  function reason(id){
    var idx = routeIndex(id);
    if (idx < 0) return 'ไม่พบด่านนี้ในเส้นทางรายวิชา';
    if (!live.verified) return 'กำลังตรวจความคืบหน้าจาก Google Sheet — เปิดได้เฉพาะ S1';
    for (var i=0; i<idx; i++) {
      var st = status(ORDER[i]);
      if (!st.complete) return 'ต้องผ่าน ' + st.routeId + ' ก่อน: ' + st.missing.join(' + ') + ' ≥ 60/100';
    }
    return '';
  }
  function setUiRoute(){
    var rid = currentId();
    try {
      localStorage.setItem('EAP_HERO_ACTIVE_ROUTE', rid);
      localStorage.setItem('EAP_HERO_CURRENT_ROUTE', rid);
      if (/^S/.test(rid)) localStorage.setItem('EAP_HERO_CURRENT_SESSION', String(Number(rid.slice(1))));
      else localStorage.removeItem('EAP_HERO_CURRENT_SESSION');
    } catch(_) {}
    return rid;
  }
  function toast(msg){
    var el = document.getElementById('eap-production-authority-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'eap-production-authority-toast';
      el.style.cssText = 'position:fixed;z-index:1000000;left:50%;bottom:22px;transform:translateX(-50%);max-width:min(92vw,680px);padding:13px 16px;border-radius:14px;background:#7f1d1d;color:#fff;font:800 13px/1.4 system-ui;box-shadow:0 14px 34px #0005;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    clearTimeout(el._timer);
    el._timer = setTimeout(function(){ if (el.parentNode) el.remove(); }, 4500);
  }
  function routeArg(name,args){
    if (name === 'openSkillMission') {
      if (/reading|listening|writing|speaking/i.test(String(args[0] || ''))) return norm(args[1]);
      return norm(args[0]);
    }
    return norm(args[0]);
  }
  function patchMethod(obj,name){
    if (!obj || typeof obj[name] !== 'function' || obj[name].__eapLiveSheetOnlyV2) return false;
    var original = obj[name].__original || obj[name];
    var guarded = function(){
      var rid = routeArg(name, arguments);
      if (rid && !canOpen(rid)) {
        toast('ด่าน ' + rid + ' ยังไม่เปิดจากข้อมูล Google Sheet — ' + reason(rid));
        window.dispatchEvent(new CustomEvent('eap:route-blocked',{detail:{requested:rid,current:currentId(),reason:reason(rid),version:VERSION}}));
        return false;
      }
      return original.apply(this, arguments);
    };
    guarded.__eapLiveSheetOnlyV2 = true;
    guarded.__eapLiveSheetOnly = true;
    guarded.__original = original;
    obj[name] = guarded;
    return true;
  }
  function patchApis(){
    var h = window.EAPHero, changed = false;
    changed = patchMethod(h,'skillHub') || changed;
    changed = patchMethod(h,'openSkillMission') || changed;
    changed = patchMethod(h,'startGateBoss') || changed;
    changed = patchMethod(h,'openBoss') || changed;
    return changed;
  }
  function decorate(){
    setUiRoute();
    var current = currentId();
    document.querySelectorAll('[data-eap-roadmap-route],[data-route-id]').forEach(function(el){
      var rid = norm(el.dataset.eapRoadmapRoute || el.dataset.routeId);
      if (!rid || ORDER.indexOf(rid) < 0) return;
      var open = canOpen(rid), done = status(rid).complete;
      el.classList.toggle('eap-locked', !open);
      el.classList.toggle('eap-current', rid === current);
      el.classList.toggle('eap-done', done);
      el.setAttribute('aria-disabled', open ? 'false' : 'true');
      if (!open) el.title = reason(rid);
      else el.removeAttribute('title');
    });
    var diag = diagnostics();
    document.documentElement.dataset.eapAuthority = VERSION;
    window.dispatchEvent(new CustomEvent('eap:production-authority-refresh',{detail:diag}));
  }
  function schedule(){ clearTimeout(renderTimer); renderTimer = setTimeout(function(){ patchApis(); decorate(); }, 80); }
  function acceptResume(event){
    var detail = event && event.detail || {};
    var data = detail.data || detail;
    if (!recentServerResponse(data)) {
      if (detail.source === 'cache' || detail.live === false) schedule();
      return false;
    }
    live = {
      verified:true,
      records:data.records.slice(),
      generatedAt:text(data.generatedAt),
      identity:identityKey(),
      source:'live_player_resume'
    };
    schedule();
    window.dispatchEvent(new CustomEvent('eap:live-sheet-authority-applied',{detail:diagnostics()}));
    return true;
  }
  function resetForProfile(){ live = {verified:false,records:[],generatedAt:'',identity:identityKey(),source:''}; schedule(); }
  function testEvaluate(records){
    var previous = live;
    live = {verified:true,records:Array.isArray(records)?records.slice():[],generatedAt:new Date().toISOString(),identity:'qa',source:'qa'};
    var result = { current:currentId(), statuses:{} };
    ORDER.forEach(function(id){ result.statuses[id] = status(id); });
    live = previous;
    return result;
  }
  function diagnostics(){
    return {
      version:VERSION,
      authorityMode:'live-sheet-only',
      bossTeacherReviewMode:'non_blocking_async_feedback',
      acceptsLocalEvidence:false,
      acceptsCompletedSessionsCache:false,
      liveVerified:live.verified,
      liveGeneratedAt:live.generatedAt,
      liveRecordCount:live.records.length,
      identity:live.identity || identityKey(),
      verifiedCurrent:currentId(),
      routeStatus:ORDER.reduce(function(out,id){ out[id] = status(id); return out; },{})
    };
  }

  document.addEventListener('click', function(event){
    var el = event.target && event.target.closest && event.target.closest('[data-eap-roadmap-route],[data-route-id]');
    if (!el) return;
    var rid = norm(el.dataset.eapRoadmapRoute || el.dataset.routeId);
    if (rid && !canOpen(rid)) {
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      toast('ด่าน ' + rid + ' ยังไม่เปิด — ' + reason(rid));
    }
  }, true);
  window.addEventListener('eap:resume-synced', acceptResume);
  window.addEventListener('eap:profile-changed', resetForProfile);
  window.addEventListener('storage', function(e){ if (!e || e.key === 'EAP_HERO_PLAYER_PROFILE_V1') resetForProfile(); });
  window.addEventListener('load', schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  patchTimer = setInterval(function(){ if (patchApis()) schedule(); }, 250);
  setTimeout(function(){ clearInterval(patchTimer); }, 20000);

  window.EAPRoadmapLockGuard = {
    version:VERSION,
    authorityMode:'live-sheet-only',
    bossTeacherReviewMode:'non_blocking_async_feedback',
    currentRoute:function(){ return route(currentId()); },
    currentRouteId:currentId,
    isUnlocked:canOpen,
    canOpen:canOpen,
    routeStatus:status,
    reason:reason,
    refresh:schedule,
    diagnostics:diagnostics,
    acceptResume:acceptResume,
    testEvaluate:testEvaluate
  };
  window.EAP15ReleaseRuntime = window.EAPRoadmapLockGuard;
  resetForProfile();
})();