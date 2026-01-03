// === /herohealth/vr-groups/research-ctx.js ===
// Research Context — PRODUCTION
// ✅ GroupsVR.getResearchCtx(): ดึง context สำหรับวิจัยจาก query params
// ✅ รองรับ ctx= (JSON encoded) + fields เดี่ยวๆ (studyId/phase/conditionGroup/...)
// ✅ เก็บซ้ำ localStorage (optional) เพื่อความเสถียรข้ามหน้า

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const LS_KEY = 'HHA_RESEARCH_CTX';

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function safeJsonParse(s){
    try{ return JSON.parse(s); }catch{ return null; }
  }

  function loadSaved(){
    try{ return safeJsonParse(localStorage.getItem(LS_KEY)||'') || {}; }catch{ return {}; }
  }
  function saveCtx(ctx){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(ctx||{})); }catch(_){}
  }

  // whitelist ที่ “ปลอดภัยและใช้จริง” ในงานวิจัย
  const FIELDS = [
    'studyId','phase','conditionGroup','sessionOrder','blockLabel',
    'siteCode','schoolYear','semester','sessionId',
    'studentKey','schoolCode','schoolName','classRoom','studentNo','nickName',
    'gender','age','gradeLevel','heightCm','weightKg','bmi','bmiGroup',
    'vrExperience','gameFrequency','handedness','visionIssue','healthDetail','consentParent',
    'teacher','deviceTag'
  ];

  function pickFromParams(){
    const out = {};
    for (const k of FIELDS){
      const v = qs(k, null);
      if (v !== null && String(v).trim() !== '') out[k] = v;
    }
    return out;
  }

  function parseCtxParam(){
    const raw = qs('ctx','');
    if (!raw) return null;

    // ctx อาจจะเป็น encodeURIComponent(JSON)
    let s = raw;
    try{ s = decodeURIComponent(raw); }catch(_){}
    const obj = safeJsonParse(s);
    if (obj && typeof obj === 'object') return obj;

    return null;
  }

  function normalize(ctx){
    ctx = ctx || {};
    // แปลงตัวเลขบางตัวถ้าเป็นไปได้
    const numKeys = ['sessionOrder','age','heightCm','weightKg','bmi','schoolYear','semester'];
    for (const k of numKeys){
      if (ctx[k] == null) continue;
      const n = Number(ctx[k]);
      if (!Number.isNaN(n)) ctx[k] = n;
    }
    return ctx;
  }

  function getResearchCtx(){
    // 1) ctx=JSON มาก่อน
    const fromCtx = parseCtxParam() || {};
    // 2) fields เดี่ยวๆ
    const fromFields = pickFromParams();
    // 3) saved fallback
    const saved = loadSaved();

    // รวมลำดับ: saved < fields < ctxParam (ctxParam ชนะสุด)
    const merged = Object.assign({}, saved, fromFields, fromCtx);

    // ถ้า run=play ก็ยังส่งได้ (บางงานเก็บ metadata เหมือนกัน)
    const run = String(qs('run','play')||'play').toLowerCase();
    merged.runMode = merged.runMode || run;

    // เก็บไว้
    const norm = normalize(merged);
    saveCtx(norm);

    return norm;
  }

  NS.getResearchCtx = getResearchCtx;
})(window);