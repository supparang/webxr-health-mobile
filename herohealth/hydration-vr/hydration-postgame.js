// === /herohealth/hydration-vr/hydration-postgame.js ===
// Hydration Post-game Bloom Module
// ✅ Evaluate: 3 plans + explainable feedback + reason + score
// ✅ Create: daily water plan 6 slots + feedback + score
// ✅ Analyze: combines gameplay + evaluate + create
// ✅ Stores into HHA_LAST_SUMMARY / hha_last_summary
// ✅ Sends optional logs via ?log= or ?logger=
// ✅ Does NOT modify hydration.safe.js

'use strict';

const PATCH = 'v20260424-HYDRATION-POSTGAME-EVAL-CREATE-ANALYZE';

let installed = false;

export function installHydrationPostgame(){
  if (installed || window.__HHA_HYDRATION_POSTGAME_INSTALLED__) return;
  installed = true;
  window.__HHA_HYDRATION_POSTGAME_INSTALLED__ = true;

  injectStyles();
  injectOverlays();

  wireEvaluate();
  wireCreate();
  wireAnalyze();

  wireEndAutoOpen();

  console.log('[hydration-postgame] installed', PATCH);
}

/* ------------------------------------------------------------
 * Shared helpers
 * ------------------------------------------------------------ */

function $(id){
  return document.getElementById(id);
}

function qsa(sel, root=document){
  return Array.from(root.querySelectorAll(sel));
}

function clamp(v,a,b){
  v = Number(v);
  if (!Number.isFinite(v)) v = 0;
  return Math.max(a, Math.min(b, v));
}

function readLastSummary(){
  try{
    const raw =
      localStorage.getItem('HHA_LAST_SUMMARY') ||
      localStorage.getItem('hha_last_summary') ||
      '{}';
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  }catch(_){
    return {};
  }
}

function writeLastSummary(summary){
  try{
    const s = summary && typeof summary === 'object' ? summary : {};
    localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(s));
    localStorage.setItem('hha_last_summary', JSON.stringify(s));
  }catch(_){}
}

function firstNumber(obj, keys, fallback=0){
  for (const k of keys){
    const v = obj?.[k];
    if (v != null && v !== ''){
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return Number(fallback || 0);
}

function firstString(obj, keys, fallback=''){
  for (const k of keys){
    const v = obj?.[k];
    if (v != null && String(v).trim()) return String(v);
  }
  return String(fallback || '');
}

function nowIso(){
  try{ return new Date().toISOString(); }catch(_){ return ''; }
}

async function sendPostLog(kind, payload){
  try{
    const q = new URLSearchParams(location.search);
    const logUrl = q.get('log') || q.get('logger') || '';
    if (!logUrl) return;

    const summary = readLastSummary();

    await fetch(logUrl, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      keepalive:true,
      body: JSON.stringify({
        kind,
        version: 1,
        timestampIso: nowIso(),
        summary,
        payload
      })
    });
  }catch(_){}
}

function openOverlay(el){
  if (!el) return;
  el.setAttribute('aria-hidden', 'false');
}

function closeOverlay(el){
  if (!el) return;
  el.setAttribute('aria-hidden', 'true');
}

function setBox(box, level, text){
  if (!box) return;
  box.className = 'hha-post-box ' + (level || 'warn');
  box.textContent = text || '—';
}

/* ------------------------------------------------------------
 * CSS + DOM
 * ------------------------------------------------------------ */

function injectStyles(){
  if ($('hhaHydrationPostgameStyle')) return;

  const css = `
/* === Hydration Post-game Bloom Module === */
.hha-post-overlay{
  position:fixed;
  inset:0;
  z-index:2500;
  display:grid;
  place-items:center;
  padding:18px;
  background:rgba(2,6,23,.64);
  backdrop-filter:blur(12px);
  transition:opacity .16s ease, visibility .16s ease;
}
.hha-post-overlay[aria-hidden="true"]{
  opacity:0;
  visibility:hidden;
  pointer-events:none;
}
.hha-post-card{
  width:min(92vw,760px);
  max-height:88svh;
  overflow:auto;
  padding:18px;
  border-radius:28px;
  background:linear-gradient(180deg,rgba(13,24,47,.96),rgba(9,17,36,.98));
  border:1px solid rgba(255,255,255,.14);
  box-shadow:0 24px 64px rgba(0,0,0,.34);
  color:#eff7ff;
  font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,"Noto Sans Thai",sans-serif;
}
.hha-post-title{
  font-size:24px;
  font-weight:1100;
  line-height:1.1;
}
.hha-post-sub{
  margin-top:6px;
  font-size:13px;
  color:#bfdbfe;
  line-height:1.4;
}
.hha-post-grid{
  display:grid;
  gap:10px;
  margin-top:14px;
}
.hha-post-actions{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  margin-top:16px;
}
.hha-post-btn{
  min-height:46px;
  padding:11px 16px;
  border-radius:16px;
  font-weight:1000;
  color:#fff;
  background:rgba(255,255,255,.10);
  border:1px solid rgba(255,255,255,.14);
  box-shadow:0 12px 24px rgba(0,0,0,.14);
  cursor:pointer;
  font:inherit;
}
.hha-post-btn.primary{
  background:linear-gradient(180deg,#22d3ee,#2563eb);
  border:0;
}
.hha-post-btn.good{
  background:linear-gradient(180deg,#34d399,#059669);
  border:0;
}
.hha-post-btn.warn{
  background:linear-gradient(180deg,#fbbf24,#f59e0b);
  border:0;
  color:#1f2937;
}
.hha-post-btn.ghost{
  background:rgba(255,255,255,.06);
}
.hha-post-plan{
  text-align:left;
  min-height:78px;
  line-height:1.35;
  justify-content:flex-start;
  display:block;
}
.hha-post-plan strong{
  font-size:14px;
}
.hha-post-plan span{
  display:inline-block;
  margin-top:5px;
  color:#bfdbfe;
  font-size:12px;
}
.hha-post-plan.is-selected{
  background:rgba(34,211,238,.16);
  border-color:rgba(103,232,249,.46);
  outline:2px solid rgba(103,232,249,.22);
}
.hha-post-box{
  margin-top:12px;
  white-space:pre-line;
  padding:12px;
  border-radius:18px;
  background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.10);
  font-size:13px;
  line-height:1.35;
}
.hha-post-box.hidden{
  display:none !important;
}
.hha-post-box.good{
  background:rgba(52,211,153,.14);
  border-color:rgba(52,211,153,.34);
}
.hha-post-box.warn{
  background:rgba(251,191,36,.13);
  border-color:rgba(251,191,36,.32);
}
.hha-post-box.bad{
  background:rgba(251,113,133,.13);
  border-color:rgba(251,113,133,.32);
}
.hha-post-field{
  margin-top:12px;
  display:grid;
  gap:6px;
}
.hha-post-field label{
  font-size:12px;
  color:#bfdbfe;
  font-weight:1000;
}
.hha-post-textarea{
  width:100%;
  min-height:84px;
  resize:vertical;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.06);
  color:#fff;
  padding:10px 12px;
  font:800 13px/1.35 system-ui,-apple-system,Segoe UI,Roboto,"Noto Sans Thai",sans-serif;
  outline:none;
}
.hha-post-textarea:focus{
  border-color:rgba(103,232,249,.42);
  box-shadow:0 0 0 3px rgba(103,232,249,.12);
}
.hha-create-row{
  display:grid;
  grid-template-columns:minmax(120px,1fr) minmax(0,1.6fr);
  gap:10px;
  align-items:center;
  padding:10px;
  border-radius:18px;
  background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.10);
}
.hha-create-label{
  font-size:13px;
  font-weight:1000;
  color:#fff;
}
.hha-create-sub{
  display:block;
  margin-top:3px;
  font-size:11px;
  color:#bfdbfe;
  font-weight:800;
}
.hha-create-options{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:6px;
}
.hha-create-opt{
  min-height:38px;
  padding:8px 8px;
  border-radius:14px;
  font-size:12px;
  font-weight:1000;
  color:#fff;
  background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.12);
  cursor:pointer;
}
.hha-create-opt.is-selected{
  background:rgba(34,211,238,.18);
  border-color:rgba(103,232,249,.46);
  outline:2px solid rgba(103,232,249,.18);
}
.hha-analyze-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:10px;
  margin-top:12px;
}
.hha-analyze-card{
  padding:12px;
  border-radius:18px;
  background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.10);
}
.hha-analyze-card .k{
  font-size:11px;
  color:#bfdbfe;
  font-weight:1000;
  letter-spacing:.04em;
}
.hha-analyze-card .v{
  margin-top:4px;
  font-size:18px;
  font-weight:1100;
}
@media (max-width:640px){
  .hha-create-row{ grid-template-columns:1fr; }
  .hha-create-options{ grid-template-columns:repeat(2,minmax(0,1fr)); }
  .hha-analyze-grid{ grid-template-columns:1fr; }
}
`;

  const st = document.createElement('style');
  st.id = 'hhaHydrationPostgameStyle';
  st.textContent = css;
  document.head.appendChild(st);
}

function injectOverlays(){
  if ($('hhaEvalOverlay')) return;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
<div id="hhaEvalOverlay" class="hha-post-overlay" aria-hidden="true">
  <div class="hha-post-card">
    <div class="hha-post-title">🧠 Post-game Evaluate</div>
    <div class="hha-post-sub">
      เลือกแผนชดเชยน้ำที่เหมาะที่สุดหลังจบเกม ระบบจะให้ feedback แบบอธิบายได้ และบันทึกข้อมูลวิจัย: choice + reason + score
    </div>

    <div class="hha-post-grid">
      <button class="hha-post-btn ghost hha-post-plan" type="button" data-plan="A">
        <strong>Plan A: ดื่มทีเดียวเยอะ ๆ</strong><br>
        <span>หลังจบกิจกรรม ดื่มรวดเดียวประมาณ 600–800 ml</span>
      </button>

      <button class="hha-post-btn ghost hha-post-plan" type="button" data-plan="B">
        <strong>Plan B: แบ่งดื่มเป็นช่วง</strong><br>
        <span>ดื่ม 150–250 ml ทุก 15–20 นาที รวม 3–4 ครั้ง</span>
      </button>

      <button class="hha-post-btn ghost hha-post-plan" type="button" data-plan="C">
        <strong>Plan C: รอให้หายเหนื่อยก่อน</strong><br>
        <span>ยังไม่ดื่มทันที รอ 30–60 นาทีแล้วค่อยเริ่มดื่ม</span>
      </button>
    </div>

    <div id="hhaEvalFeedbackBox" class="hha-post-box hidden"></div>

    <div class="hha-post-field">
      <label for="hhaEvalReason">เหตุผลที่เลือกแผนนี้ *</label>
      <textarea id="hhaEvalReason" class="hha-post-textarea" placeholder="เช่น เพราะเพิ่งเหนื่อยมาก / กลัวจุก / อยากค่อย ๆ ดื่ม / ไม่มีเวลาระหว่างเรียน"></textarea>
    </div>

    <div class="hha-post-actions">
      <button id="hhaBtnEvalSave" class="hha-post-btn good" type="button">บันทึกคำตอบ</button>
      <button id="hhaBtnEvalSkip" class="hha-post-btn ghost" type="button">ข้าม</button>
    </div>
  </div>
</div>

<div id="hhaCreateOverlay" class="hha-post-overlay" aria-hidden="true">
  <div class="hha-post-card">
    <div class="hha-post-title">📅 Post-game Create</div>
    <div class="hha-post-sub">
      สร้าง “แผนดื่มน้ำ 1 วัน” 6 จุดเวลา แล้วระบบจะประเมินว่าแผนสมดุลหรือควรปรับตรงไหน
    </div>

    <div class="hha-post-grid" id="hhaCreatePlanGrid">
      ${createSlotHtml('wake','1) หลังตื่นนอน','เริ่มวันให้สดชื่น')}
      ${createSlotHtml('morning','2) ก่อนเข้าเรียน/คาบเช้า','กันลืมดื่มช่วงเรียน')}
      ${createSlotHtml('break','3) พักเช้า/พักระหว่างคาบ','เติมเล็กน้อยให้ต่อเนื่อง')}
      ${createSlotHtml('lunch','4) กลางวัน','ช่วงหลักของวัน')}
      ${createSlotHtml('activity','5) ก่อน/หลังพละหรือกิจกรรม','จุดสำคัญเวลามีเหงื่อ')}
      ${createSlotHtml('evening','6) ช่วงเย็น','ปิดวันแบบพอดี')}
    </div>

    <div id="hhaCreateFeedbackBox" class="hha-post-box hidden"></div>

    <div class="hha-post-actions">
      <button id="hhaBtnCreateCheck" class="hha-post-btn good" type="button">ประเมินแผน</button>
      <button id="hhaBtnCreateAuto" class="hha-post-btn primary" type="button">แนะนำแผนอัตโนมัติ</button>
      <button id="hhaBtnCreateReset" class="hha-post-btn ghost" type="button">ล้างค่า</button>
      <button id="hhaBtnCreateClose" class="hha-post-btn ghost" type="button">ปิด</button>
    </div>
  </div>
</div>

<div id="hhaAnalyzeOverlay" class="hha-post-overlay" aria-hidden="true">
  <div class="hha-post-card">
    <div class="hha-post-title">🔎 Post-game Analyze</div>
    <div class="hha-post-sub">
      ระบบวิเคราะห์แพทเทิร์นการดื่มน้ำจากผลการเล่น + แผนที่เลือก + ตารางน้ำที่สร้าง
    </div>

    <div class="hha-analyze-grid">
      <div class="hha-analyze-card">
        <div class="k">TOP ISSUE</div>
        <div class="v" id="hhaAnalyzeTopIssue">—</div>
      </div>
      <div class="hha-analyze-card">
        <div class="k">PATTERN</div>
        <div class="v" id="hhaAnalyzePattern">—</div>
      </div>
      <div class="hha-analyze-card">
        <div class="k">EVALUATE</div>
        <div class="v" id="hhaAnalyzeEvaluate">—</div>
      </div>
      <div class="hha-analyze-card">
        <div class="k">CREATE</div>
        <div class="v" id="hhaAnalyzeCreate">—</div>
      </div>
    </div>

    <div id="hhaAnalyzeFeedbackBox" class="hha-post-box hidden"></div>

    <div class="hha-post-actions">
      <button id="hhaBtnAnalyzeRefresh" class="hha-post-btn primary" type="button">วิเคราะห์อีกครั้ง</button>
      <button id="hhaBtnAnalyzeClose" class="hha-post-btn ghost" type="button">ปิด</button>
    </div>
  </div>
</div>
`;

  document.body.appendChild(wrap);
}

function createSlotHtml(slot,title,sub){
  return `
<div class="hha-create-row" data-slot="${slot}">
  <div class="hha-create-label">${title}<span class="hha-create-sub">${sub}</span></div>
  <div class="hha-create-options"></div>
</div>`;
}

/* ------------------------------------------------------------
 * End-game auto open
 * ------------------------------------------------------------ */

function wireEndAutoOpen(){
  const end = $('end');
  let opened = false;

  function tryOpenEvaluate(){
    if (opened) return;
    opened = true;
    setTimeout(()=> openOverlay($('hhaEvalOverlay')), 450);
  }

  if (end){
    const obs = new MutationObserver(()=>{
      const shown = end.getAttribute('aria-hidden') === 'false';
      if (shown) tryOpenEvaluate();
      else opened = false;
    });
    obs.observe(end, { attributes:true, attributeFilter:['aria-hidden'] });
  }

  window.addEventListener('hha:end', tryOpenEvaluate);
}

/* ------------------------------------------------------------
 * Evaluate
 * ------------------------------------------------------------ */

let selectedEvalPlan = '';
let latestEvalFeedback = null;

function wireEvaluate(){
  const overlay = $('hhaEvalOverlay');
  const plans = qsa('.hha-post-plan', overlay);
  const box = $('hhaEvalFeedbackBox');
  const reason = $('hhaEvalReason');

  plans.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      selectedEvalPlan = btn.dataset.plan || '';
      plans.forEach(x=>x.classList.remove('is-selected'));
      btn.classList.add('is-selected');

      latestEvalFeedback = computePostEval(selectedEvalPlan);
      setBox(box, latestEvalFeedback.level, latestEvalFeedback.explain);
    });
  });

  $('hhaBtnEvalSave')?.addEventListener('click', ()=>{
    if (!selectedEvalPlan || !latestEvalFeedback) return;

    const r = String(reason?.value || '').trim();
    if (!r){
      try{ reason.focus(); }catch(_){}
      return;
    }

    const payload = {
      ...latestEvalFeedback,
      reason: r,
      savedAt: Date.now()
    };

    savePostEvaluate(payload);
    closeOverlay(overlay);

    setTimeout(()=> openOverlay($('hhaCreateOverlay')), 350);
  });

  $('hhaBtnEvalSkip')?.addEventListener('click', ()=>{
    const payload = {
      presented:true,
      skipped:true,
      plan:'',
      score:0,
      level:'',
      badge:'',
      reasons:[],
      explain:'',
      reason:'',
      savedAt:Date.now()
    };

    savePostEvaluate(payload);
    closeOverlay(overlay);

    setTimeout(()=> openOverlay($('hhaAnalyzeOverlay')), 500);
    setTimeout(()=> runAnalyze(), 520);
  });
}

function computePostEval(plan){
  const summary = readLastSummary();

  const acc = firstNumber(summary, ['accuracyGoodPct','acc','hh_acc'], 0);
  const miss = firstNumber(summary, ['misses','miss','hh_miss'], 0);
  const water = firstNumber(summary, ['waterFinalPct','waterPct','hh_water'], 0);
  const stormCycles = firstNumber(summary, ['stormCycles','hh_stormCycles'], 0);
  const stormSuccess = firstNumber(summary, ['stormSuccess','hh_stormSuccess'], 0);

  plan = String(plan || '').toUpperCase();

  let score = 0;
  const reasons = [];

  if (plan === 'B') {
    score = 88;
    reasons.push('แบ่งดื่มเป็นช่วงช่วยให้ร่างกายปรับสมดุลได้ดีกว่าดื่มรวดเดียว');
    reasons.push('ลดโอกาสจุกหรือดื่มมากเกินไปในเวลาสั้น');
    reasons.push('เหมาะกับการชดเชยหลังออกแรงและยังควบคุมระดับน้ำได้ต่อเนื่อง');
  } else if (plan === 'A') {
    score = 56;
    reasons.push('ดื่มทีเดียวเร็ว แต่เสี่ยงจุกหรือมากเกินความต้องการ');
    reasons.push('ควรแบ่งบางส่วนออกเป็น 2–3 ช่วงจะเหมาะกว่า');
  } else if (plan === 'C') {
    score = 34;
    reasons.push('รอนานเกินไปอาจทำให้ฟื้นตัวช้า');
    reasons.push('หลังออกแรงควรเริ่มจิบน้ำเล็กน้อยก่อน ไม่ควรรอจนกระหายมาก');
  } else {
    score = 40;
    reasons.push('ยังไม่ได้เลือกแผนที่ชัดเจน');
  }

  if (acc >= 80) {
    score += 4;
    reasons.push('Accuracy สูง แสดงว่าคุมจังหวะได้ดี จึงเหมาะกับแผนที่แบ่งเป็นช่วง');
  } else if (acc > 0 && acc < 60) {
    score -= 4;
    reasons.push('Accuracy ยังต่ำ อาจสะท้อนความรีบหรือล้า จึงควรใช้แผนที่ค่อย ๆ เติมน้ำ');
  }

  if (miss >= 15) {
    score -= 5;
    reasons.push('MISS ค่อนข้างสูง จึงไม่ควรเลือกวิธีดื่มรวดเดียวหรือเลื่อนดื่มนานเกินไป');
  }

  if (stormCycles > 0 && stormSuccess < stormCycles && plan === 'B') {
    score += 4;
    reasons.push('ผลช่วง Storm ยังไม่สมบูรณ์ แผนแบ่งดื่มจะช่วยคุมสมดุลก่อน/หลังสถานการณ์หนักได้ดีกว่า');
  }

  if (water > 0 && water < 45 && plan === 'C') {
    score -= 6;
    reasons.push('ระดับน้ำท้ายเกมค่อนข้างต่ำ จึงไม่ควรรอให้นานก่อนดื่ม');
  }

  score = clamp(Math.round(score), 0, 100);

  let level = 'warn';
  let badge = '⚠️ พอใช้';
  if (score >= 80) {
    level = 'good';
    badge = '✅ เหมาะสม';
  } else if (score < 50) {
    level = 'bad';
    badge = '❌ ควรปรับ';
  }

  return {
    presented:true,
    skipped:false,
    plan,
    score,
    level,
    badge,
    reasons,
    explain:
`${badge}
แผนที่เลือก: ${plan}
คะแนนความเหมาะสม: ${score}/100

เหตุผล:
• ${reasons.join('\n• ')}`
  };
}

function savePostEvaluate(postEvaluate){
  const summary = readLastSummary();

  summary.postEvaluate = postEvaluate;

  summary.pe_presented = true;
  summary.pe_skipped = !!postEvaluate.skipped;
  summary.pe_choiceId = postEvaluate.plan || '';
  summary.pe_score = Number(postEvaluate.score || 0);
  summary.pe_level = postEvaluate.level || '';
  summary.pe_reason = postEvaluate.reason || '';
  summary.pe_rationale_text = Array.isArray(postEvaluate.reasons)
    ? postEvaluate.reasons.join(' | ')
    : '';

  writeLastSummary(summary);

  window.dispatchEvent(new CustomEvent('hha:post_evaluate_saved', { detail: postEvaluate }));
  sendPostLog('herohealth.hydration.post_evaluate', postEvaluate);
}

/* ------------------------------------------------------------
 * Create
 * ------------------------------------------------------------ */

const createPlan = {};

function wireCreate(){
  renderCreateOptions();

  $('hhaBtnCreateCheck')?.addEventListener('click', ()=>{
    const result = computeCreatePlan(createPlan);
    savePostCreate(result);
    setBox($('hhaCreateFeedbackBox'), result.level, result.explain);
  });

  $('hhaBtnCreateAuto')?.addEventListener('click', ()=>{
    setCreateSlot('wake', 2);
    setCreateSlot('morning', 1);
    setCreateSlot('break', 1);
    setCreateSlot('lunch', 2);
    setCreateSlot('activity', 2);
    setCreateSlot('evening', 1);
    setBox($('hhaCreateFeedbackBox'), 'warn', '✨ ระบบใส่แผนเริ่มต้นให้แล้ว: กระจายดื่มทั้งวัน และให้ความสำคัญกับช่วงกิจกรรม');
  });

  $('hhaBtnCreateReset')?.addEventListener('click', ()=>{
    qsa('.hha-create-row').forEach(row=> setCreateSlot(row.dataset.slot, 1));
    $('hhaCreateFeedbackBox')?.classList.add('hidden');
  });

  $('hhaBtnCreateClose')?.addEventListener('click', ()=>{
    closeOverlay($('hhaCreateOverlay'));
  });
}

function renderCreateOptions(){
  const choices = [
    { value:0, label:'ไม่ดื่ม' },
    { value:1, label:'น้อย' },
    { value:2, label:'กลาง' },
    { value:3, label:'มาก' }
  ];

  qsa('.hha-create-row').forEach(row=>{
    const slot = row.dataset.slot || '';
    const host = row.querySelector('.hha-create-options');
    if (!slot || !host) return;

    host.innerHTML = '';

    choices.forEach(ch=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hha-create-opt';
      btn.dataset.value = String(ch.value);
      btn.textContent = ch.label;
      btn.addEventListener('click', ()=> setCreateSlot(slot, ch.value));
      host.appendChild(btn);
    });

    setCreateSlot(slot, 1);
  });
}

function setCreateSlot(slot, value){
  createPlan[slot] = Number(value);

  const row = qsa('.hha-create-row').find(r=>r.dataset.slot === slot);
  if (!row) return;

  row.querySelectorAll('.hha-create-opt').forEach(btn=>{
    btn.classList.toggle('is-selected', Number(btn.dataset.value) === Number(value));
  });
}

function planToArray(plan){
  const p = plan || {};
  return [
    { slot:'wake', label:'หลังตื่นนอน', value:Number(p.wake ?? 0) },
    { slot:'morning', label:'ก่อนเข้าเรียน/คาบเช้า', value:Number(p.morning ?? 0) },
    { slot:'break', label:'พักเช้า/พักระหว่างคาบ', value:Number(p.break ?? 0) },
    { slot:'lunch', label:'กลางวัน', value:Number(p.lunch ?? 0) },
    { slot:'activity', label:'ก่อน/หลังพละหรือกิจกรรม', value:Number(p.activity ?? 0) },
    { slot:'evening', label:'ช่วงเย็น', value:Number(p.evening ?? 0) }
  ];
}

function valueText(v){
  v = Number(v || 0);
  if (v <= 0) return 'ไม่ดื่ม';
  if (v === 1) return 'น้อย';
  if (v === 2) return 'กลาง';
  return 'มาก';
}

function computeCreatePlan(plan){
  const slots = planToArray(plan);
  const total = slots.reduce((s,x)=>s + Number(x.value || 0), 0);
  const filled = slots.filter(x => Number(x.value || 0) > 0).length;
  const zeros = slots.filter(x => Number(x.value || 0) === 0).length;
  const larges = slots.filter(x => Number(x.value || 0) >= 3).length;

  const activity = slots.find(x => x.slot === 'activity')?.value || 0;
  const wake = slots.find(x => x.slot === 'wake')?.value || 0;
  const lunch = slots.find(x => x.slot === 'lunch')?.value || 0;

  let score = 70;
  const reasons = [];

  if (filled === 6) {
    score += 8;
    reasons.push('จัดครบทั้ง 6 ช่วงเวลา ทำให้แผนมีความต่อเนื่อง');
  } else {
    score -= (6 - filled) * 6;
    reasons.push(`ยังมีช่วงที่ไม่ดื่ม ${6 - filled} จุด ควรกระจายให้ครบมากขึ้น`);
  }

  if (total >= 7 && total <= 11) {
    score += 10;
    reasons.push('ปริมาณรวมอยู่ในช่วงสมดุล ไม่มากหรือน้อยเกินไป');
  } else if (total < 7) {
    score -= 12;
    reasons.push('ปริมาณรวมค่อนข้างน้อย อาจเสี่ยงดื่มไม่พอในวันเรียน/วันกิจกรรม');
  } else {
    score -= 8;
    reasons.push('ปริมาณรวมค่อนข้างมาก ควรลดบางช่วงจาก “มาก” เป็น “กลาง”');
  }

  if (zeros >= 2) {
    score -= 10;
    reasons.push('มีหลายช่วงที่ไม่ดื่มเลย อาจทำให้ระดับน้ำแกว่งระหว่างวัน');
  }

  if (larges >= 3) {
    score -= 8;
    reasons.push('มีหลายช่วงที่ดื่ม “มาก” อาจทำให้กระจุกตัวเกินไป');
  }

  if (wake >= 1) {
    score += 4;
    reasons.push('มีน้ำหลังตื่นนอน ช่วยเริ่มวันได้ดี');
  } else {
    score -= 6;
    reasons.push('ควรเพิ่มน้ำเล็กน้อยหลังตื่นนอน');
  }

  if (lunch >= 1) {
    score += 3;
    reasons.push('มีน้ำช่วงกลางวัน ซึ่งเป็นจุดสำคัญของวันเรียน');
  }

  if (activity >= 2) {
    score += 8;
    reasons.push('ช่วงพละ/กิจกรรมมีระดับกลางขึ้นไป เหมาะกับการชดเชยเหงื่อ');
  } else if (activity === 1) {
    score += 2;
    reasons.push('ช่วงพละ/กิจกรรมมีน้ำแล้ว แต่อาจเพิ่มเป็น “กลาง” ถ้ามีเหงื่อมาก');
  } else {
    score -= 12;
    reasons.push('ควรมีน้ำก่อน/หลังพละหรือกิจกรรม เพราะเป็นช่วงเสี่ยงขาดน้ำ');
  }

  score = clamp(Math.round(score), 0, 100);

  let level = 'warn';
  let badge = '⚠️ แผนพอใช้';
  if (score >= 82) {
    level = 'good';
    badge = '✅ แผนสมดุลดี';
  } else if (score < 55) {
    level = 'bad';
    badge = '❌ ควรปรับแผน';
  }

  const compactPlan = slots.map(x => `${x.label}: ${valueText(x.value)}`).join('\n• ');

  return {
    presented:true,
    score,
    level,
    badge,
    totalUnits:total,
    slotsFilled:filled,
    totalSlots:6,
    slots,
    explain:
`${badge}
คะแนนแผน: ${score}/100
ปริมาณรวมเชิงสัญลักษณ์: ${total} หน่วย
จัดครบ: ${filled}/6 ช่วงเวลา

แผนที่สร้าง:
• ${compactPlan}

เหตุผล:
• ${reasons.join('\n• ')}`
  };
}

function savePostCreate(result){
  const summary = readLastSummary();

  const postCreate = {
    ...result,
    savedAt: Date.now()
  };

  summary.postCreate = postCreate;

  summary.pc_presented = true;
  summary.pc_score = result.score;
  summary.pc_level = result.level;
  summary.pc_slotsFilled = result.slotsFilled;
  summary.pc_totalSlots = result.totalSlots;
  summary.pc_totalUnits = result.totalUnits;
  summary.pc_slots_json = JSON.stringify(result.slots || []);
  summary.pc_explain = result.explain;

  writeLastSummary(summary);

  window.dispatchEvent(new CustomEvent('hha:create_saved', { detail: result }));
  sendPostLog('herohealth.hydration.post_create', result);

  setTimeout(()=> {
    closeOverlay($('hhaCreateOverlay'));
    openOverlay($('hhaAnalyzeOverlay'));
    runAnalyze();
  }, 1200);
}

/* ------------------------------------------------------------
 * Analyze
 * ------------------------------------------------------------ */

function wireAnalyze(){
  $('hhaBtnAnalyzeRefresh')?.addEventListener('click', runAnalyze);
  $('hhaBtnAnalyzeClose')?.addEventListener('click', ()=>{
    closeOverlay($('hhaAnalyzeOverlay'));
  });
}

function runAnalyze(){
  const summary = readLastSummary();
  const result = buildPostAnalyze(summary);

  summary.postAnalyze = result;

  summary.pa_presented = true;
  summary.pa_topIssue = result.topIssue;
  summary.pa_topIssueLabel = result.topIssueLabel;
  summary.pa_patternLabel = result.patternLabel;
  summary.pa_level = result.level;
  summary.pa_recommendation = result.recommendation;
  summary.pa_strengths_text = Array.isArray(result.strengths) ? result.strengths.join(' | ') : '';
  summary.pa_issues_text = Array.isArray(result.issues) ? result.issues.join(' | ') : '';
  summary.pa_explain = result.explain;

  writeLastSummary(summary);

  const topIssueEl = $('hhaAnalyzeTopIssue');
  const patternEl = $('hhaAnalyzePattern');
  const evaluateEl = $('hhaAnalyzeEvaluate');
  const createEl = $('hhaAnalyzeCreate');

  if (topIssueEl) topIssueEl.textContent = result.topIssueLabel || '—';
  if (patternEl) patternEl.textContent = result.patternLabel || '—';
  if (evaluateEl) evaluateEl.textContent = result.evaluateLabel || '—';
  if (createEl) createEl.textContent = result.createLabel || '—';

  setBox($('hhaAnalyzeFeedbackBox'), result.level, result.explain);

  window.dispatchEvent(new CustomEvent('hha:analyze_saved', { detail: result }));
  sendPostLog('herohealth.hydration.post_analyze', result);
}

function buildPostAnalyze(summary){
  const s = summary || {};

  const acc = firstNumber(s, ['accuracyGoodPct','acc','hh_acc'], 0);
  const miss = firstNumber(s, ['misses','miss','hh_miss'], 0);
  const water = firstNumber(s, ['waterFinalPct','waterPct','hh_water'], 0);
  const score = firstNumber(s, ['scoreFinal','score','hh_score'], 0);
  const grade = firstString(s, ['grade','hh_grade'], 'D');

  const stormCycles = firstNumber(s, ['stormCycles','hh_stormCycles'], 0);
  const stormSuccess = firstNumber(s, ['stormSuccess','hh_stormSuccess'], 0);
  const block = firstNumber(s, ['blockCount','blocks','hh_bossClearCount','bossClearCount'], 0);

  const pe = s.postEvaluate || {};
  const pc = s.postCreate || {};

  const pePlan = String(pe.plan || s.pe_choiceId || '');
  const peScore = Number(pe.score ?? s.pe_score ?? 0);
  const peSkipped = !!(pe.skipped || s.pe_skipped);

  const pcScore = Number(pc.score ?? s.pc_score ?? 0);
  const pcFilled = Number(pc.slotsFilled ?? s.pc_slotsFilled ?? 0);
  const pcUnits = Number(pc.totalUnits ?? s.pc_totalUnits ?? 0);

  const issues = [];
  const strengths = [];

  if (acc >= 80) strengths.push('เล็ง/แตะได้แม่นยำดี');
  else if (acc > 0 && acc < 60) issues.push('ความแม่นยำยังต่ำ อาจรีบแตะหรือสับสนช่วงเป้าเยอะ');

  if (miss <= 6) strengths.push('MISS ต่ำ คุมจังหวะดี');
  else if (miss >= 15) issues.push('MISS สูง ควรลดการแตะพลาดและเลือกเป้าที่มั่นใจ');

  if (water >= 70) strengths.push('ระดับน้ำท้ายเกมดี');
  else if (water > 0 && water < 45) issues.push('ระดับน้ำท้ายเกมต่ำ เสี่ยงชดเชยน้ำไม่ทัน');

  if (stormCycles > 0) {
    if (stormSuccess >= stormCycles) strengths.push('ผ่านช่วง Storm ได้ดี');
    else issues.push('ช่วง Storm ยังเป็นจุดเสี่ยง ควรเตรียม Shield/จังหวะบล็อกให้ดีขึ้น');
  }

  if (block > 0) strengths.push('มีการบล็อกสายฟ้าได้');
  else if (stormCycles > 0) issues.push('ยังบล็อกสายฟ้าได้น้อย');

  if (peSkipped) {
    issues.push('ข้ามขั้น Evaluate ทำให้ยังไม่มีเหตุผลประกอบการเลือกแผน');
  } else if (pePlan) {
    if (pePlan === 'B') strengths.push('เลือกแผนแบ่งดื่ม ซึ่งเหมาะกับการชดเชยแบบสมดุล');
    if (pePlan === 'A') issues.push('เลือกแผนดื่มรวดเดียว ซึ่งอาจเสี่ยงจุกหรือมากเกินไป');
    if (pePlan === 'C') issues.push('เลือกแผนรอดื่มทีหลัง ซึ่งอาจฟื้นตัวช้า');
  }

  if (pcScore >= 82) strengths.push('ตารางน้ำที่สร้างมีความสมดุลดี');
  else if (pcScore > 0 && pcScore < 55) issues.push('ตารางน้ำที่สร้างยังควรปรับให้กระจายมากขึ้น');

  if (pcFilled > 0 && pcFilled < 6) issues.push('ตารางน้ำยังจัดไม่ครบ 6 ช่วงเวลา');
  if (pcUnits > 11) issues.push('ปริมาณรวมในตารางค่อนข้างมาก');
  if (pcUnits > 0 && pcUnits < 7) issues.push('ปริมาณรวมในตารางค่อนข้างน้อย');

  let topIssue = 'balanced';
  let topIssueLabel = 'สมดุลดี';

  if (issues.length) {
    const text = issues.join(' | ');
    if (/Storm|สายฟ้า|บล็อก/.test(text)) {
      topIssue = 'storm_block';
      topIssueLabel = 'ช่วง Storm / Block';
    } else if (/แม่นยำ|MISS|พลาด/.test(text)) {
      topIssue = 'accuracy_miss';
      topIssueLabel = 'ความแม่นยำ / MISS';
    } else if (/ท้ายเกมต่ำ|ชดเชยน้ำ/.test(text)) {
      topIssue = 'low_water';
      topIssueLabel = 'ระดับน้ำต่ำ';
    } else if (/ตารางน้ำ|6 ช่วง|ปริมาณรวม/.test(text)) {
      topIssue = 'daily_plan';
      topIssueLabel = 'ตารางน้ำรายวัน';
    } else if (/Evaluate|แผน/.test(text)) {
      topIssue = 'decision';
      topIssueLabel = 'การตัดสินใจเลือกแผน';
    }
  }

  let patternLabel = 'ค่อนข้างสมดุล';
  if (topIssue === 'storm_block') patternLabel = 'พลาดช่วงกดดัน';
  if (topIssue === 'accuracy_miss') patternLabel = 'รีบแตะ/พลาดง่าย';
  if (topIssue === 'low_water') patternLabel = 'น้ำท้ายเกมต่ำ';
  if (topIssue === 'daily_plan') patternLabel = 'ตารางยังไม่สมดุล';
  if (topIssue === 'decision') patternLabel = 'เหตุผลการเลือกแผนยังไม่ชัด';

  let level = 'good';
  if (issues.length >= 4) level = 'bad';
  else if (issues.length >= 2) level = 'warn';

  let recommendation = 'รักษาแผนแบ่งดื่ม และลองเล่นซ้ำเพื่อดูแนวโน้ม';
  if (topIssue === 'storm_block') recommendation = 'โฟกัสเก็บ Shield ก่อน Storm และรอจังหวะบล็อกสายฟ้า';
  if (topIssue === 'accuracy_miss') recommendation = 'ลดการแตะรัว เลือกเป้าที่มั่นใจก่อน แล้วค่อยเพิ่มความเร็ว';
  if (topIssue === 'low_water') recommendation = 'ใช้แผนแบ่งดื่มหลังเกม และเพิ่มช่วงดื่มก่อน/หลังกิจกรรม';
  if (topIssue === 'daily_plan') recommendation = 'ปรับตารางให้ครบ 6 ช่วง และให้ช่วงกิจกรรมเป็นระดับกลางขึ้นไป';
  if (topIssue === 'decision') recommendation = 'เลือกแผนพร้อมเขียนเหตุผล เพื่อฝึกการตัดสินใจเชิงสุขภาพ';

  const explain =
`🔎 วิเคราะห์แพทเทิร์นหลังเกม
คะแนน: ${score} | เกรด: ${grade} | Accuracy: ${acc}% | MISS: ${miss} | Water: ${water}%

จุดแข็ง:
• ${(strengths.length ? strengths : ['ยังไม่มีจุดแข็งเด่นชัด']).join('\n• ')}

จุดที่ควรปรับ:
• ${(issues.length ? issues : ['ยังไม่พบจุดเสี่ยงเด่นชัด']).join('\n• ')}

คำแนะนำ:
• ${recommendation}`;

  return {
    presented:true,
    topIssue,
    topIssueLabel,
    patternLabel,
    evaluateLabel: peSkipped ? 'ข้าม Evaluate' : (pePlan ? `Plan ${pePlan} • ${peScore}/100` : 'ยังไม่มีข้อมูล'),
    createLabel: pcScore ? `Create • ${pcScore}/100 • ${pcFilled}/6` : 'ยังไม่มีข้อมูล',
    level,
    strengths,
    issues,
    recommendation,
    explain,
    savedAt: Date.now()
  };
}