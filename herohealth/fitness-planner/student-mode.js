// === /herohealth/fitness-planner/student-mode.js ===
// Student Mode (1 button flow director) — local-only

'use strict';

import { shouldShowConsent, runConsentScreen } from './consent-screen.js';
import { runAttentionCheck10s } from './attention-check.js';
import { openPlannerEndDashboard } from './planner-dashboard.js';
import { pickDayOrder, insertBoss, mapToSteps } from './day-flow.js';
import { getTeacherCfg } from './teacher-bar.js';

function qs(k,d=''){
  try{ return new URLSearchParams(location.search).get(k) ?? d; }catch(_){ return d; }
}
function todayKey(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const da=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function setLS(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} }
function getLS(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(_){ return null; } }

export function isStudentMode(){
  return (qs('student','0') === '1');
}

function mkUI(){
  const root = document.createElement('div');
  root.id = 'hhStudentUI';
  root.style.cssText = `
    position:fixed; inset:0; z-index:99990;
    display:flex; align-items:center; justify-content:center;
    padding:16px;
    font-family:system-ui,-apple-system,'Noto Sans Thai',sans-serif;
    color:rgba(255,255,255,.94);
    background:radial-gradient(900px 700px at 20% 0%, rgba(99,102,241,.20), transparent 55%),
               radial-gradient(900px 700px at 90% 10%, rgba(34,211,238,.14), transparent 55%),
               rgba(2,6,23,.96);
  `;
  root.innerHTML = `
    <div style="width:min(720px,96vw); background:rgba(15,23,42,.80);
      border:1px solid rgba(255,255,255,.16); border-radius:20px; overflow:hidden;">
      <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.10); display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <div style="font-weight:900; font-size:18px;">🏃‍♂️ HeroHealth — Fitness Day</div>
        <div id="smMeta" style="margin-left:auto; opacity:.85; font-size:12px;"></div>
      </div>

      <div style="padding:14px;">
        <div style="opacity:.92; line-height:1.5;">
          วันนี้เราจะเล่น 4 เกมสั้น ๆ ให้สนุกและปลอดภัย  
          <div style="margin-top:6px; opacity:.85; font-size:12px;">ถ้าเหนื่อยให้พักได้เสมอ</div>
        </div>

        <div style="margin-top:12px;">
          <div style="opacity:.85; font-size:12px;">ความคืบหน้า</div>
          <div style="height:12px; border-radius:999px; background:rgba(255,255,255,.10); overflow:hidden; margin-top:6px;">
            <div id="smBar" style="height:100%; width:0%; background:rgba(59,130,246,.92);"></div>
          </div>
          <div id="smNext" style="margin-top:10px; font-weight:900;"></div>
        </div>

        <div style="margin-top:14px; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
          <button id="smStart" style="padding:12px 14px; border-radius:16px; border:1px solid rgba(255,255,255,.18);
            background:rgba(59,130,246,.35); color:#fff; font-weight:900; font-size:16px;">▶ เริ่มวันนี้</button>
          <button id="smDash" style="padding:12px 14px; border-radius:16px; border:1px solid rgba(255,255,255,.18);
            background:rgba(0,0,0,.22); color:#fff; font-weight:900;">📊 Dashboard</button>
        </div>

        <div style="margin-top:10px; opacity:.75; font-size:12px;">
          *โหมดนักเรียน: ไม่มีเมนูเยอะ กดเริ่มแล้วเล่นตามลำดับได้เลย
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function buildSteps(RUNTIME, teacherCfg){
  const stepDefs = {
    shadow:   { id:'shadow',   title:'Shadow Breaker', url:'../shadow-breaker/shadow.html', boss:false },
    rhythm:   { id:'rhythm',   title:'Rhythm Boxer',   url:'../rhythm-boxer/rhythm.html',   boss:false },
    jumpduck: { id:'jumpduck', title:'Jump-Duck',      url:'../jumpduck/jumpduck.html',     boss:false },
    balance:  { id:'balance',  title:'Balance Hold',   url:'../balance-hold/balance.html',  boss:false },
    boss:     { id:'shadow_boss', title:'Boss Battle', url:'../shadow-breaker/shadow.html', boss:true, bossHP:12, ts:1.0 }
  };

  const day = todayKey();
  const pick = pickDayOrder({ pid:RUNTIME.pid, dayKey:day, seed:String(RUNTIME.seed||'0'), use8:true });

  const bossDay = (()=>{
    const v = teacherCfg?.bossDay;
    if(v==='1') return true;
    if(v==='0') return false;
    return (RUNTIME.run === 'research'); // auto
  })();

  const where = (teacherCfg?.bossWhere || 'after2');
  const seq2 = insertBoss(pick.seq, bossDay ? where : 'none');
  const steps = mapToSteps(seq2, stepDefs);

  RUNTIME.day_order_id = pick.orderId;
  RUNTIME.day_order_seq = seq2.join('>');
  RUNTIME.steps = steps;
  return steps;
}

function nextLabel(steps, idx){
  if(idx >= steps.length) return '✅ จบวันนี้แล้ว';
  const s = steps[idx];
  return `ถัดไป: ${s.title || s.id}`;
}

function progressPct(steps, idx){
  const n = Math.max(1, steps.length);
  return Math.round( (idx / n) * 100 );
}

export function bootStudentMode(RUNTIME, launchStepFn){
  if(!isStudentMode()) return null;

  const teacherCfg = getTeacherCfg();
  RUNTIME.run = (teacherCfg.run || RUNTIME.run || 'play');

  const steps = buildSteps(RUNTIME, teacherCfg);

  const ui = mkUI();
  const bar = ui.querySelector('#smBar');
  const next = ui.querySelector('#smNext');
  const meta = ui.querySelector('#smMeta');
  const btnStart = ui.querySelector('#smStart');
  const btnDash = ui.querySelector('#smDash');

  meta.textContent = `run: ${RUNTIME.run} | pid: ${RUNTIME.pid||'anon'} | order: ${RUNTIME.day_order_id}`;

  // resume index
  let idx = Number(getLS('HHA_STUDENT_IDX')||0) || 0;
  idx = Math.max(0, Math.min(steps.length, idx));

  function refresh(){
    bar.style.width = progressPct(steps, idx) + '%';
    next.textContent = nextLabel(steps, idx);
    btnStart.textContent = (idx >= steps.length) ? '✅ เปิด Dashboard' : '▶ เล่นด่านถัดไป';
  }
  refresh();

  btnDash.addEventListener('click', ()=>{
    openPlannerEndDashboard({ maxRows: 30 });
  });

  async function runConsentIfNeeded(){
    // teacher override consent
    const c = teacherCfg?.consent;
    if(c==='0') { RUNTIME.consent_ok = 1; return; }
    if(!shouldShowConsent(RUNTIME.pid) && c!=='1') { RUNTIME.consent_ok = 1; return; }

    await new Promise(resolve=>{
      runConsentScreen({
        pid: RUNTIME.pid,
        studyId: RUNTIME.studyId||'',
        onDone: (res)=>{
          RUNTIME.consent_ok = (res && !res.cancelled && res.adult_ok===1 && res.kid_ok===1) ? 1 : 0;
          resolve();
        }
      });
    });
  }

  async function runAttnIfNeeded(){
    const a = teacherCfg?.attn;
    const should = (()=>{
      if(a==='1') return true;
      if(a==='0') return false;
      return (RUNTIME.run === 'research');
    })();
    if(!should) return;

    await new Promise(resolve=>{
      runAttentionCheck10s({
        seed: String(RUNTIME.seed||'0'),
        pid: String(RUNTIME.pid||'anon'),
        onDone: (res)=>{
          setLS('HHA_ATTENTION_LAST', res);
          RUNTIME.attention_passed = res.pass;
          RUNTIME.attention_hits = res.hits;
          RUNTIME.attention_false = res.falses;
          RUNTIME.attention_rtMean = res.rtMean==null?'':Math.round(res.rtMean);
          resolve();
        }
      });
    });
  }

  async function playNext(){
    if(idx >= steps.length){
      openPlannerEndDashboard({ maxRows: 30 });
      return;
    }

    // before first step: consent + attn
    if(idx === 0){
      await runConsentIfNeeded();
      await runAttnIfNeeded();
    }

    const step = steps[idx];
    // persist idx before navigation
    setLS('HHA_STUDENT_IDX', idx);

    // call provided launcher (planner's launch)
    launchStepFn(step, idx, steps.length, teacherCfg, RUNTIME);
  }

  btnStart.addEventListener('click', ()=> playNext());

  // public helpers for planner to call when returning from game
  window.HHStudent = window.HHStudent || {};
  window.HHStudent.onReturn = function(){
    // when coming back from a step run page -> increment
    idx = idx + 1;
    setLS('HHA_STUDENT_IDX', idx);
    refresh();

    if(idx >= steps.length){
      // auto open dashboard at end
      openPlannerEndDashboard({ maxRows: 30 });
    }
  };

  return { ui, steps };
}