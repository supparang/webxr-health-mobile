// === /herohealth/core/bloom-engine.js ===
// HeroHealth Bloom Engine — inject Remember→Understand→Apply→Analyze→Evaluate→Create
// ✅ Self-contained DOM overlay (no deps)
// ✅ Deterministic prompts by seed(+pid/day) for research repeatability
// ✅ Minimal integration: createBloomEngine(...), bloom.start(), bloom.setAnalyze(...), bloom.end(...)
// ✅ Emits events: hha:bloom (and optional onLog callback)
//
// Usage (minimal):
//   import { createBloomEngine } from '../core/bloom-engine.js';
//   const bloom = createBloomEngine({ gameId:'plate', mount, pid, seed, dayKey, domain:'nutrition', onLog: logFn });
//   bloom.start({ mode, diff, timeSec });
//   ...during play: bloom.setAnalyze({ risk:0.72, timeLeft:33, energy:0.4 });
//   ...on end: bloom.end({ score, summaryText:'...' });

'use strict';

export function createBloomEngine(opts){
  opts = opts || {};
  const mount   = opts.mount || document.body;
  const gameId  = String(opts.gameId || 'game');
  const domain  = String(opts.domain || 'generic'); // nutrition|hygiene|fitness|generic
  const pid     = String(opts.pid || '');
  const seed0   = String(opts.seed || Date.now());
  const dayKey  = String(opts.dayKey || ''); // e.g. YYYY-MM-DD for daily deterministic
  const onLog   = typeof opts.onLog === 'function' ? opts.onLog : null;

  const rng = makeRng(hash32([gameId, domain, pid, dayKey, seed0].join('|')));

  const state = {
    started: false,
    ended: false,
    step: 'idle', // remember|understand|apply|analyze|evaluate|create|done
    session: { mode:'', diff:'', timeSec:0, ts0:0 },
    analyze: {},
    remember: null,
    evaluate: null,
    create: null,
  };

  // --- UI ---
  injectStyleOnce();
  const ui = buildUI();
  mount.appendChild(ui.root);

  // Default content packs (you can override via opts.content)
  const content = normalizeContent(opts.content, domain);

  // --- public API ---
  const api = {
    uiRoot: ui.root,
    start,
    setAnalyze,
    coach,
    promptRemember,
    promptEvaluate,
    promptCreate,
    end,
    destroy
  };

  // auto-hide unless started
  hide(ui.root);

  return api;

  // ---------------------------
  function start(meta){
    if(state.started) return;
    state.started = true;
    state.ended = false;
    state.session.ts0 = Date.now();
    state.session.mode = String(meta && meta.mode || '');
    state.session.diff = String(meta && meta.diff || '');
    state.session.timeSec = Number(meta && meta.timeSec || 0) || 0;

    show(ui.root);
    setStep('remember');

    // REMEMBER: micro prompt (fast)
    const rem = pick(content.remember);
    state.remember = rem;

    renderRemember(rem);
    log('bloom_start', { meta: state.session, rememberId: rem && rem.id });

    // If user ignores, auto-advance
    armAutoAdvance('remember', 9000);
  }

  function setAnalyze(metrics){
    if(!state.started || state.ended) return;
    state.analyze = shallowCopy(metrics || {});
    // if not in analyze view yet, we still update the compact chip bar
    renderAnalyzeCompact(state.analyze);
  }

  function coach(text, level){
    if(!state.started || state.ended) return;
    const t = String(text || '').trim();
    if(!t) return;
    renderCoach(t, level || 'tip');
    log('coach', { text:t, level:String(level||'tip') });
  }

  // Optional: call to force Remember prompt again (e.g., new round)
  function promptRemember(){
    if(!state.started || state.ended) return;
    setStep('remember');
    const rem = pick(content.remember);
    state.remember = rem;
    renderRemember(rem);
    log('remember', { rememberId: rem && rem.id, forced:true });
    armAutoAdvance('remember', 9000);
  }

  // Optional: call near end to trigger Evaluate (A/B choice)
  function promptEvaluate(payload){
    if(!state.started || state.ended) return;
    setStep('evaluate');
    const ev = buildEvaluate(payload);
    state.evaluate = ev;
    renderEvaluate(ev);
    log('evaluate_show', { evalId: ev.id, a: ev.a && ev.a.id, b: ev.b && ev.b.id });
  }

  // Optional: call near end or after Evaluate to trigger Create mini-planner
  function promptCreate(payload){
    if(!state.started || state.ended) return;
    setStep('create');
    const cr = buildCreate(payload);
    state.create = cr;
    renderCreate(cr);
    log('create_show', { createId: cr.id, type: cr.type, items: (cr.items||[]).length });
  }

  // Call when the game ends (or when you show End Summary)
  function end(result){
    if(!state.started || state.ended) return;
    state.ended = true;

    // If player never did Evaluate/Create, we do lightweight versions automatically
    // (so every session still reaches Bloom-complete, but short)
    if(!state.evaluate){
      state.evaluate = buildEvaluate({ auto:true });
    }
    if(!state.create){
      state.create = buildCreate({ auto:true });
    }

    // show end panel
    setStep('done');
    renderDone(result || {});
    log('bloom_end', {
      result: sanitizeResult(result),
      rememberId: state.remember && state.remember.id,
      evaluate: summarizeEvaluate(state.evaluate),
      create: summarizeCreate(state.create),
      analyze: shallowCopy(state.analyze)
    });

    // keep UI visible for a bit
    armAutoAdvance('done', 60000);
  }

  function destroy(){
    try { ui.root.remove(); } catch(e){}
  }

  // ---------------------------
  // Step state + auto-advance
  function setStep(s){
    state.step = s;
    ui.badgeStep.textContent = labelStep(s);
    ui.root.setAttribute('data-bloom-step', s);

    // Compact chips always visible during started session
    renderAnalyzeCompact(state.analyze);

    // Hide/show panels
    ui.pRemember.style.display  = (s==='remember') ? '' : 'none';
    ui.pUnderstand.style.display= (s==='understand') ? '' : 'none';
    ui.pApply.style.display     = (s==='apply') ? '' : 'none';
    ui.pAnalyze.style.display   = (s==='analyze') ? '' : 'none';
    ui.pEvaluate.style.display  = (s==='evaluate') ? '' : 'none';
    ui.pCreate.style.display    = (s==='create') ? '' : 'none';
    ui.pDone.style.display      = (s==='done') ? '' : 'none';

    // When we leave remember, we show a tiny understand cue (coach) then default to apply/analyze
    if(s==='remember'){
      // nothing
    } else if(s==='understand'){
      // auto-advance quickly to apply
      armAutoAdvance('understand', 4500);
    } else if(s==='apply'){
      // allow user to open analyze/evaluate/create via buttons
    }
  }

  let autoTimer = 0;
  function armAutoAdvance(step, ms){
    clearTimeout(autoTimer);
    autoTimer = setTimeout(()=> {
      if(!state.started || state.ended && step!=='done') return;

      // only advance if still on same step
      if(state.step !== step) return;

      if(step==='remember'){
        // show understand micro-tip, then go apply
        setStep('understand');
        const tip = pick(content.understand);
        renderUnderstand(tip);
        log('understand', { tipId: tip && tip.id });
      } else if(step==='understand'){
        setStep('apply');
        renderApplyHint();
        log('apply', { auto:true });
      } else if(step==='done'){
        // keep visible; do nothing
      }
    }, Math.max(800, Number(ms||0)));
  }

  // ---------------------------
  // Renderers
  function renderRemember(rem){
    ui.remTitle.textContent = 'Remember';
    ui.remQ.textContent = rem && rem.q ? rem.q : 'เริ่มกันเลย! คุณจำได้ไหมว่า…';
    ui.remChips.innerHTML = '';
    const choices = (rem && rem.choices && rem.choices.length) ? rem.choices : ['ตัวเลือก A','ตัวเลือก B'];
    choices.forEach((c, i)=>{
      const b = chipBtn(String(c), ()=>{
        const correct = (rem && typeof rem.correctIndex==='number') ? (i===rem.correctIndex) : null;
        ui.remFeedback.textContent = correct===null
          ? 'รับทราบ!'
          : (correct ? 'ถูกต้อง ✅' : 'ยังไม่ใช่ ลองดูเหตุผลต่อไปนะ');
        log('remember_answer', { rememberId: rem && rem.id, i, text:String(c), correct });
        // move to understand quickly
        setTimeout(()=>{
          setStep('understand');
          const tip = pick(content.understand);
          renderUnderstand(tip, rem);
          log('understand', { tipId: tip && tip.id, fromRemember:true });
        }, 350);
      });
      ui.remChips.appendChild(b);
    });
    ui.remFeedback.textContent = '';
  }

  function renderUnderstand(tip, rem){
    ui.undTitle.textContent = 'Understand';
    ui.undBody.textContent = (tip && tip.text) ? tip.text : 'เหตุผลสำคัญคือ…';
    if(rem && rem.explain){
      // If remember prompt has specific explanation, prefer it
      ui.undBody.textContent = String(rem.explain);
    }
    renderCoach(ui.undBody.textContent, 'why');
  }

  function renderApplyHint(){
    ui.appTitle.textContent = 'Apply';
    ui.appBody.textContent = 'ลงมือเล่นเลย! (ระบบจะสรุปให้คุณวิเคราะห์/ตัดสินใจ/วางแผนต่อท้าย)';
  }

  function renderAnalyzeCompact(m){
    const keys = Object.keys(m||{});
    const chips = [];
    keys.slice(0,4).forEach(k=>{
      const v = m[k];
      chips.push(`${k}:${fmt(v)}`);
    });
    ui.chipsAnalyze.textContent = chips.length ? chips.join('  •  ') : 'analyze: —';
  }

  function renderCoach(text, level){
    ui.coach.textContent = String(text||'');
    ui.coach.setAttribute('data-level', String(level||'tip'));
    ui.coach.classList.add('is-show');
    clearTimeout(ui._coachTimer);
    ui._coachTimer = setTimeout(()=> ui.coach.classList.remove('is-show'), 5200);
  }

  function renderAnalyzePanel(){
    setStep('analyze');
    ui.anTitle.textContent = 'Analyze';
    ui.anBody.textContent = 'ดูตัวแปรสำคัญ แล้วคิดก่อนตัดสินใจ';
    ui.anTable.innerHTML = '';
    const m = state.analyze || {};
    const keys = Object.keys(m);
    if(!keys.length){
      ui.anTable.innerHTML = `<div class="be-row"><span class="be-k">metrics</span><span class="be-v">ยังไม่มี</span></div>`;
      return;
    }
    keys.forEach(k=>{
      const row = document.createElement('div');
      row.className = 'be-row';
      row.innerHTML = `<span class="be-k">${escapeHtml(k)}</span><span class="be-v">${escapeHtml(fmt(m[k]))}</span>`;
      ui.anTable.appendChild(row);
    });
  }

  function renderEvaluate(ev){
    ui.evTitle.textContent = 'Evaluate';
    ui.evBody.textContent = ev.prompt || 'เลือกตัวเลือกที่ “เหมาะที่สุด”';
    ui.evA.textContent = ev.a && ev.a.text ? ev.a.text : 'Option A';
    ui.evB.textContent = ev.b && ev.b.text ? ev.b.text : 'Option B';
    ui.evWhy.value = '';
    ui.evFeedback.textContent = '';

    ui.btnPickA.onclick = ()=>{
      const why = (ui.evWhy.value||'').trim();
      ev.pick = 'A'; ev.why = why;
      ui.evFeedback.textContent = 'เลือก A แล้ว ✅';
      log('evaluate_pick', { evalId: ev.id, pick:'A', why });
      // next: create
      setTimeout(()=> promptCreate({ fromEvaluate:true }), 350);
    };
    ui.btnPickB.onclick = ()=>{
      const why = (ui.evWhy.value||'').trim();
      ev.pick = 'B'; ev.why = why;
      ui.evFeedback.textContent = 'เลือก B แล้ว ✅';
      log('evaluate_pick', { evalId: ev.id, pick:'B', why });
      setTimeout(()=> promptCreate({ fromEvaluate:true }), 350);
    };
  }

  function renderCreate(cr){
    ui.crTitle.textContent = 'Create';
    ui.crBody.textContent = cr.prompt || 'ลอง “ออกแบบเอง” แบบสั้น ๆ';
    ui.crList.innerHTML = '';

    // simple plan builder: choose and order (tap toggles order)
    const picked = [];
    const items = cr.items || [];
    items.forEach((it, idx)=>{
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'be-item';
      row.innerHTML = `<span class="be-n">+</span><span class="be-t">${escapeHtml(it.text || String(it))}</span>`;
      row.onclick = ()=>{
        const id = it.id || String(idx);
        const pos = picked.indexOf(id);
        if(pos>=0){
          picked.splice(pos,1);
        } else {
          picked.push(id);
        }
        update();
      };
      ui.crList.appendChild(row);
    });

    function update(){
      // update numbers
      const btns = ui.crList.querySelectorAll('.be-item');
      btns.forEach((b, i)=>{
        const it = items[i];
        const id = it.id || String(i);
        const pos = picked.indexOf(id);
        b.classList.toggle('is-on', pos>=0);
        const n = b.querySelector('.be-n');
        n.textContent = pos>=0 ? String(pos+1) : '+';
      });
      ui.crPreview.textContent = picked.length
        ? ('แผนของคุณ: ' + picked.map(id=>{
            const it = items.find((x, j)=> (x.id||String(j))===id);
            return it ? (it.text||String(it)) : id;
          }).join(' → '))
        : 'แตะเพื่อเลือกและเรียงลำดับ';
    }

    update();

    ui.btnCreateDone.onclick = ()=>{
      cr.plan = picked.slice(0);
      ui.crFeedback.textContent = 'บันทึกแผนแล้ว ✅';
      log('create_done', { createId: cr.id, plan: cr.plan });
      // return to apply or done later; we keep create visible until end()
      setTimeout(()=> setStep('apply'), 350);
    };
  }

  function renderDone(result){
    ui.doneTitle.textContent = 'Bloom Summary';
    const r = result || {};
    const lines = [];
    if(r.summaryText) lines.push(String(r.summaryText));
    if(Number.isFinite(r.score)) lines.push(`score: ${r.score}`);
    if(state.analyze && Object.keys(state.analyze).length){
      lines.push('analyze: ' + Object.keys(state.analyze).slice(0,4).map(k=>`${k}=${fmt(state.analyze[k])}`).join(', '));
    }
    if(state.evaluate && state.evaluate.pick){
      lines.push(`evaluate: pick ${state.evaluate.pick}${state.evaluate.why?` (“${state.evaluate.why}”)`:''}`);
    }
    if(state.create && state.create.plan && state.create.plan.length){
      lines.push(`create: plan ${state.create.plan.length} step(s)`);
    }
    ui.doneBody.textContent = lines.join('\n') || 'จบเซสชัน';
  }

  // ---------------------------
  // UI build
  function buildUI(){
    const root = el('div','be-root');
    root.innerHTML = `
      <div class="be-bar">
        <div class="be-left">
          <span class="be-badge">BLOOM</span>
          <span class="be-step" id="be-step">idle</span>
          <span class="be-chips" id="be-chips">analyze: —</span>
        </div>
        <div class="be-right">
          <button class="be-btn" id="be-btn-an">Analyze</button>
          <button class="be-btn" id="be-btn-ev">Evaluate</button>
          <button class="be-btn" id="be-btn-cr">Create</button>
        </div>
      </div>

      <div class="be-coach" id="be-coach"></div>

      <div class="be-panel" id="be-p-remember">
        <div class="be-h">Remember</div>
        <div class="be-q" id="be-rem-q"></div>
        <div class="be-chips-row" id="be-rem-chips"></div>
        <div class="be-fb" id="be-rem-fb"></div>
      </div>

      <div class="be-panel" id="be-p-understand">
        <div class="be-h">Understand</div>
        <div class="be-body" id="be-und-body"></div>
      </div>

      <div class="be-panel" id="be-p-apply">
        <div class="be-h">Apply</div>
        <div class="be-body" id="be-app-body"></div>
      </div>

      <div class="be-panel" id="be-p-analyze">
        <div class="be-h">Analyze</div>
        <div class="be-body" id="be-an-body"></div>
        <div class="be-table" id="be-an-table"></div>
      </div>

      <div class="be-panel" id="be-p-evaluate">
        <div class="be-h">Evaluate</div>
        <div class="be-body" id="be-ev-body"></div>
        <div class="be-2col">
          <div class="be-card">
            <div class="be-ct">Option A</div>
            <div class="be-cb" id="be-ev-a"></div>
            <button class="be-pick" id="be-pick-a">เลือก A</button>
          </div>
          <div class="be-card">
            <div class="be-ct">Option B</div>
            <div class="be-cb" id="be-ev-b"></div>
            <button class="be-pick" id="be-pick-b">เลือก B</button>
          </div>
        </div>
        <textarea class="be-why" id="be-ev-why" placeholder="เหตุผล (สั้น ๆ) — ถ้าไม่พิมพ์ก็ได้"></textarea>
        <div class="be-fb" id="be-ev-fb"></div>
      </div>

      <div class="be-panel" id="be-p-create">
        <div class="be-h">Create</div>
        <div class="be-body" id="be-cr-body"></div>
        <div class="be-list" id="be-cr-list"></div>
        <div class="be-prev" id="be-cr-prev"></div>
        <div class="be-row2">
          <button class="be-btn2" id="be-cr-done">บันทึกแผน</button>
          <div class="be-fb" id="be-cr-fb"></div>
        </div>
      </div>

      <div class="be-panel" id="be-p-done">
        <div class="be-h">Summary</div>
        <pre class="be-pre" id="be-done-body"></pre>
      </div>
    `;

    const q = (id)=> root.querySelector(id);

    const ui = {
      root,
      badgeStep: q('#be-step'),
      chipsAnalyze: q('#be-chips'),
      coach: q('#be-coach'),

      pRemember: q('#be-p-remember'),
      remTitle: null,
      remQ: q('#be-rem-q'),
      remChips: q('#be-rem-chips'),
      remFeedback: q('#be-rem-fb'),

      pUnderstand: q('#be-p-understand'),
      undTitle: null,
      undBody: q('#be-und-body'),

      pApply: q('#be-p-apply'),
      appTitle: null,
      appBody: q('#be-app-body'),

      pAnalyze: q('#be-p-analyze'),
      anTitle: null,
      anBody: q('#be-an-body'),
      anTable: q('#be-an-table'),

      pEvaluate: q('#be-p-evaluate'),
      evTitle: null,
      evBody: q('#be-ev-body'),
      evA: q('#be-ev-a'),
      evB: q('#be-ev-b'),
      evWhy: q('#be-ev-why'),
      evFeedback: q('#be-ev-fb'),
      btnPickA: q('#be-pick-a'),
      btnPickB: q('#be-pick-b'),

      pCreate: q('#be-p-create'),
      crTitle: null,
      crBody: q('#be-cr-body'),
      crList: q('#be-cr-list'),
      crPreview: q('#be-cr-prev'),
      crFeedback: q('#be-cr-fb'),
      btnCreateDone: q('#be-cr-done'),

      pDone: q('#be-p-done'),
      doneTitle: null,
      doneBody: q('#be-done-body'),

      _coachTimer: 0
    };

    // bar buttons
    q('#be-btn-an').onclick = ()=> { renderAnalyzePanel(); log('open_analyze', {}); };
    q('#be-btn-ev').onclick = ()=> { promptEvaluate({}); };
    q('#be-btn-cr').onclick = ()=> { promptCreate({}); };

    return ui;
  }

  // ---------------------------
  // Content builders
  function normalizeContent(userContent, domain){
    const base = defaultContent(domain);
    if(!userContent) return base;
    // allow partial overrides
    ['remember','understand','evaluate','create'].forEach(k=>{
      if(Array.isArray(userContent[k]) && userContent[k].length){
        base[k] = userContent[k].map(x=> normalizeItem(k, x));
      }
    });
    return base;
  }

  function defaultContent(domain){
    // Short, reusable, and not game-specific (so you can inject everywhere)
    if(domain==='hygiene'){
      return {
        remember: [
          { id:'hw1', q:'ก่อนกินข้าว ควรทำอะไร?', choices:['ล้างมือ','จับหน้าจอมือถือก่อน'], correctIndex:0,
            explain:'ล้างมือก่อนกินช่วยลดเชื้อจากสิ่งของ/พื้นผิวเข้าสู่ปาก' },
          { id:'hw2', q:'จุดไหน “เสี่ยง” มากในบ้าน?', choices:['ลูกบิดประตู','ผนัง'], correctIndex:0,
            explain:'พื้นผิวสัมผัสบ่อย (high-touch) มักมีการปนเปื้อนสูงกว่า' },
        ],
        understand: [
          { id:'hu1', text:'ไม่ใช่แค่ “ทำให้สะอาด” แต่ต้องทำ “จุดคุ้มค่า” ก่อน (high-touch/high-risk)' },
          { id:'hu2', text:'ลำดับการทำความสะอาดสำคัญ: สกปรกมาก→น้อย เพื่อไม่ให้เชื้อกระจาย' },
        ],
        evaluate: [
          { id:'he1', prompt:'ถ้าทำได้แค่ 1 อย่างก่อน คุณจะเลือกอะไร?', a:{id:'A',text:'ทำความสะอาดลูกบิด/สวิตช์ไฟ'}, b:{id:'B',text:'เช็ดโต๊ะที่ไม่มีคนใช้'} },
        ],
        create: [
          { id:'hc1', prompt:'จัดรูทีนสั้น ๆ ให้บ้านปลอดภัยขึ้น', type:'routine',
            items:[
              {id:'r1',text:'ลูกบิดประตู'}, {id:'r2',text:'สวิตช์ไฟ'}, {id:'r3',text:'โต๊ะกินข้าว'}, {id:'r4',text:'มือถือ/แท็บเล็ต'}
            ]
          }
        ]
      };
    }

    if(domain==='nutrition'){
      return {
        remember: [
          { id:'nu1', q:'หมู่ที่ให้พลังงานหลักคือ?', choices:['คาร์โบไฮเดรต','ผัก'], correctIndex:0,
            explain:'คาร์โบไฮเดรตเป็นแหล่งพลังงานหลักของร่างกาย' },
          { id:'nu2', q:'ข้อไหนช่วยให้ “จานสมดุล” มากขึ้น?', choices:['เพิ่มผัก','เพิ่มน้ำตาล'], correctIndex:0,
            explain:'ผักเพิ่มใยอาหาร/วิตามิน และช่วยสมดุลพลังงาน' },
        ],
        understand: [
          { id:'nuu1', text:'อาหารบางอย่างดูดี แต่ “น้ำตาล/ไขมันแฝง” อาจสูง ต้องดูภาพรวม' },
          { id:'nuu2', text:'สมดุล = เหมาะกับเป้าหมาย + เงื่อนไข (เวลา/งบ/แพ้อาหาร)' },
        ],
        evaluate: [
          { id:'nue1', prompt:'เลือกชุดที่ “สมดุลกว่า”', a:{id:'A',text:'มีผัก+โปรตีนพอ'}, b:{id:'B',text:'หวานสูงแต่ดูน่ากิน'} },
        ],
        create: [
          { id:'nuc1', prompt:'จัดลำดับ “มื้อเช้า” แบบสมดุล (สั้น ๆ)', type:'meal',
            items:[
              {id:'m1',text:'โปรตีน (ไข่/ถั่ว)'},{id:'m2',text:'ผัก'},{id:'m3',text:'ผลไม้'},{id:'m4',text:'คาร์บ (ข้าว/ขนมปัง)'}
            ]
          }
        ]
      };
    }

    if(domain==='fitness'){
      return {
        remember: [
          { id:'fi1', q:'ถ้าวันนี้เหนื่อย ควรทำยังไง?', choices:['ลดความหนักลง','ฝืนให้หนักขึ้น'], correctIndex:0,
            explain:'การปรับความหนักให้เหมาะ ช่วยให้ฝึกต่อเนื่องและปลอดภัย' },
          { id:'fi2', q:'การวอร์มอัปช่วยอะไร?', choices:['ลดการบาดเจ็บ','ทำให้เมื่อยทันที'], correctIndex:0,
            explain:'วอร์มอัปช่วยเตรียมกล้ามเนื้อ/ข้อต่อ ลดความเสี่ยงบาดเจ็บ' },
        ],
        understand: [
          { id:'fiu1', text:'ดู “แนวโน้ม” ของความนิ่ง/จังหวะ แล้วค่อยปรับความยาก' },
          { id:'fiu2', text:'เป้าหมายต่างกัน → แผนฝึกต่างกัน (ทน/ไว/ทรงตัว)' },
        ],
        evaluate: [
          { id:'fie1', prompt:'ถ้ามีเวลา 10 นาที เลือกแบบไหนดี?', a:{id:'A',text:'ฝึกทรงตัว+จังหวะเบา ๆ'}, b:{id:'B',text:'หนักมากอย่างเดียว'} },
        ],
        create: [
          { id:'fic1', prompt:'เรียงลำดับ “เซสชันวันนี้”', type:'session',
            items:[
              {id:'s1',text:'วอร์มอัป 1 นาที'}, {id:'s2',text:'ฝึกหลัก 6 นาที'}, {id:'s3',text:'คูลดาวน์ 1 นาที'}, {id:'s4',text:'ยืดเหยียด 2 นาที'}
            ]
          }
        ]
      };
    }

    return {
      remember: [{ id:'g1', q:'พร้อมเริ่มไหม?', choices:['พร้อม','ยัง'], correctIndex:0, explain:'เริ่มแบบสั้น ๆ แล้วค่อยไปต่อ' }],
      understand: [{ id:'g2', text:'ระหว่างเล่น ให้สังเกตตัวแปรสำคัญ แล้วตัดสินใจให้เหมาะ' }],
      evaluate: [{ id:'g3', prompt:'เลือกทางที่เหมาะที่สุด', a:{id:'A',text:'ทางเลือก A'}, b:{id:'B',text:'ทางเลือก B'} }],
      create: [{ id:'g4', prompt:'จัดแผนสั้น ๆ', type:'plan', items:[{id:'p1',text:'Step 1'},{id:'p2',text:'Step 2'}] }]
    };
  }

  function normalizeItem(kind, x){
    if(typeof x === 'string') return { id: kind+'_'+hash32(x), text:x };
    return x || {};
  }

  function buildEvaluate(payload){
    // If payload provides a/b, use it; else pick from content
    const base = payload && payload.a && payload.b
      ? { id: 'ev_'+Date.now(), prompt: payload.prompt, a: payload.a, b: payload.b }
      : shallowCopy(pick(content.evaluate) || {});
    base.id = base.id || ('ev_'+Math.floor(rng()*1e9));
    base.prompt = base.prompt || 'เลือกตัวเลือกที่เหมาะที่สุด';
    base.a = base.a || { id:'A', text:'Option A' };
    base.b = base.b || { id:'B', text:'Option B' };
    if(payload && payload.auto) base.auto = true;
    return base;
  }

  function buildCreate(payload){
    const base = shallowCopy(pick(content.create) || {});
    base.id = base.id || ('cr_'+Math.floor(rng()*1e9));
    base.prompt = base.prompt || 'ลองออกแบบเองแบบสั้น ๆ';
    base.type = base.type || 'plan';
    base.items = Array.isArray(base.items) ? base.items.slice(0) : [];
    if(payload && payload.items) base.items = payload.items;
    if(base.items.length < 2){
      base.items = [
        {id:'x1',text:'ขั้นตอน 1'},
        {id:'x2',text:'ขั้นตอน 2'},
        {id:'x3',text:'ขั้นตอน 3'}
      ];
    }
    if(payload && payload.auto) base.auto = true;
    return base;
  }

  // ---------------------------
  // Logging + Events
  function log(type, data){
    const ev = {
      kind: 'bloom',
      gameId, domain,
      pid, seed: seed0, dayKey,
      t: Date.now(),
      step: state.step,
      type: String(type||''),
      data: data || {}
    };
    // dispatch DOM event for your existing HHA logger hooks
    try{
      window.dispatchEvent(new CustomEvent('hha:bloom', { detail: ev }));
    }catch(e){}

    if(onLog){
      try { onLog(ev); } catch(e){}
    }
  }

  // ---------------------------
  // helpers
  function pick(arr){
    if(!arr || !arr.length) return null;
    return arr[Math.floor(rng()*arr.length)];
  }
  function shallowCopy(o){
    const out = {};
    if(!o) return out;
    Object.keys(o).forEach(k=> out[k]=o[k]);
    return out;
  }
  function sanitizeResult(r){
    if(!r) return {};
    const out = {};
    ['score','timeMs','summaryText','mode','diff'].forEach(k=>{
      if(r[k]!==undefined) out[k]=r[k];
    });
    return out;
  }
  function summarizeEvaluate(ev){
    if(!ev) return null;
    return { id:ev.id, pick:ev.pick||'', why:ev.why||'', auto:!!ev.auto };
  }
  function summarizeCreate(cr){
    if(!cr) return null;
    return { id:cr.id, type:cr.type||'', plan:(cr.plan||[]).slice(0), auto:!!cr.auto };
  }

  function labelStep(s){
    const m = { idle:'idle', remember:'Remember', understand:'Understand', apply:'Apply', analyze:'Analyze', evaluate:'Evaluate', create:'Create', done:'Done' };
    return m[s] || s;
  }

  function el(tag, cls){
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    return e;
  }
  function chipBtn(text, onClick){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'be-chip';
    b.textContent = text;
    b.onclick = onClick;
    return b;
  }
  function fmt(v){
    if(v===null || v===undefined) return '—';
    if(typeof v === 'number'){
      if(!Number.isFinite(v)) return '—';
      // pretty for 0..1 ratios
      if(v>=0 && v<=1) return (Math.round(v*100)/100).toFixed(2);
      return String(Math.round(v*100)/100);
    }
    if(typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
  }

  function show(node){ node.style.display=''; }
  function hide(node){ node.style.display='none'; }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // ---------------------------
  // style
  function injectStyleOnce(){
    if(document.getElementById('HHA_BLOOM_ENGINE_STYLE')) return;
    const st = document.createElement('style');
    st.id = 'HHA_BLOOM_ENGINE_STYLE';
    st.textContent = `
      .be-root{
        position: fixed;
        left: max(10px, env(safe-area-inset-left));
        right: max(10px, env(safe-area-inset-right));
        top: max(10px, env(safe-area-inset-top));
        z-index: 9999;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial;
        color: rgba(229,231,235,.95);
        pointer-events: none;
      }
      .be-bar{
        display:flex; align-items:center; justify-content:space-between;
        background: rgba(2,6,23,.72);
        border: 1px solid rgba(148,163,184,.18);
        border-radius: 14px;
        padding: 8px 10px;
        backdrop-filter: blur(8px);
        pointer-events: auto;
      }
      .be-left{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
      .be-badge{
        font-weight:800; letter-spacing:.08em;
        font-size:12px;
        padding:4px 8px;
        border-radius:999px;
        background: rgba(99,102,241,.22);
        border:1px solid rgba(99,102,241,.35);
      }
      .be-step{ font-weight:700; font-size:12px; opacity:.95; }
      .be-chips{ font-size:12px; opacity:.9; color: rgba(148,163,184,.95); }
      .be-right{ display:flex; gap:8px; }
      .be-btn{
        border-radius: 999px;
        padding: 6px 10px;
        border: 1px solid rgba(148,163,184,.20);
        background: rgba(15,23,42,.55);
        color: rgba(229,231,235,.95);
        font-weight:700;
        font-size:12px;
      }
      .be-btn:active{ transform: translateY(1px); }

      .be-coach{
        margin-top: 8px;
        max-width: 860px;
        background: rgba(15,23,42,.62);
        border: 1px solid rgba(148,163,184,.16);
        border-radius: 14px;
        padding: 10px 12px;
        line-height: 1.25;
        opacity: 0;
        transform: translateY(-6px);
        transition: opacity .22s ease, transform .22s ease;
        pointer-events: none;
      }
      .be-coach.is-show{ opacity: 1; transform: translateY(0); }
      .be-coach[data-level="why"]{ border-color: rgba(34,211,238,.25); }
      .be-coach[data-level="warn"]{ border-color: rgba(251,191,36,.28); }

      .be-panel{
        margin-top: 8px;
        max-width: 860px;
        background: rgba(2,6,23,.72);
        border: 1px solid rgba(148,163,184,.18);
        border-radius: 16px;
        padding: 10px 12px;
        pointer-events: auto;
      }
      .be-h{ font-weight:900; font-size:12px; letter-spacing:.08em; opacity:.95; margin-bottom:6px; }
      .be-q, .be-body{ font-size: 14px; line-height:1.25; }
      .be-chips-row{ display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
      .be-chip{
        border-radius:999px;
        padding: 8px 10px;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(15,23,42,.55);
        color: rgba(229,231,235,.95);
        font-weight:800;
        font-size:13px;
      }
      .be-fb{ margin-top:8px; font-size:13px; color: rgba(34,211,238,.95); min-height: 18px; }

      .be-table{ margin-top:8px; display:grid; gap:6px; }
      .be-row{ display:flex; justify-content:space-between; gap:10px; padding:6px 8px;
               border-radius: 12px; background: rgba(15,23,42,.45); border:1px solid rgba(148,163,184,.14); }
      .be-k{ opacity:.9; font-weight:800; font-size:12px; }
      .be-v{ opacity:.92; font-weight:700; font-size:12px; color: rgba(229,231,235,.92); }

      .be-2col{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:8px; }
      @media (max-width: 720px){
        .be-2col{ grid-template-columns:1fr; }
      }
      .be-card{
        background: rgba(15,23,42,.45);
        border:1px solid rgba(148,163,184,.14);
        border-radius:14px;
        padding:10px;
      }
      .be-ct{ font-weight:900; font-size:12px; letter-spacing:.06em; opacity:.9; }
      .be-cb{ margin-top:6px; font-size:14px; font-weight:800; line-height:1.2; }
      .be-pick{
        margin-top:10px;
        width:100%;
        border-radius: 12px;
        padding: 10px 10px;
        border:1px solid rgba(99,102,241,.30);
        background: rgba(99,102,241,.22);
        color: rgba(229,231,235,.95);
        font-weight:900;
        font-size:14px;
      }
      .be-why{
        margin-top:10px;
        width:100%;
        min-height: 54px;
        border-radius: 12px;
        padding: 10px 10px;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.45);
        color: rgba(229,231,235,.95);
        font-weight:700;
        font-size:13px;
        resize: vertical;
      }

      .be-list{ display:grid; gap:8px; margin-top:8px; }
      .be-item{
        display:flex; align-items:center; gap:10px;
        border-radius: 14px;
        padding: 10px 10px;
        border:1px solid rgba(148,163,184,.16);
        background: rgba(15,23,42,.45);
        color: rgba(229,231,235,.95);
        font-weight:800;
      }
      .be-item.is-on{ border-color: rgba(34,211,238,.28); }
      .be-n{
        width: 24px; height:24px;
        display:inline-flex; align-items:center; justify-content:center;
        border-radius: 10px;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.35);
        font-weight:900;
      }
      .be-prev{
        margin-top:8px;
        font-size:13px;
        opacity:.92;
        color: rgba(148,163,184,.96);
        white-space: normal;
      }
      .be-row2{ display:flex; align-items:center; gap:10px; margin-top:10px; }
      .be-btn2{
        border-radius: 12px;
        padding: 10px 12px;
        border:1px solid rgba(34,211,238,.25);
        background: rgba(34,211,238,.12);
        color: rgba(229,231,235,.95);
        font-weight:900;
      }
      .be-pre{
        margin: 0;
        font-size: 12px;
        line-height: 1.25;
        white-space: pre-wrap;
        color: rgba(229,231,235,.92);
      }
    `;
    document.head.appendChild(st);
  }

  // ---------------------------
  // deterministic rng
  function makeRng(seed){
    // mulberry32
    let a = seed >>> 0;
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash32(str){
    // FNV-1a 32-bit
    let h = 0x811c9dc5;
    str = String(str||'');
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }
}