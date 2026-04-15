import { loadCssOnce } from '../../helpers/css.js';
import { mulberry32 } from '../../helpers/rng.js';
import { runBubblePhase } from '../../helpers/bubbles.js';

export function loadStyle(){
  loadCssOnce('./gate/games/maskcough/style.css?v=20260415b');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  function safeToast(msg){
    try{
      if(api && typeof api.toast === 'function'){
        api.toast(msg);
        return;
      }
    }catch(_){}
    try{
      console.log('[maskcough cooldown toast]', msg);
    }catch(_){}
  }

  function readCtxValue(key){
    try{
      const direct = ctx?.[key];
      if (direct != null && String(direct).trim() !== '') return String(direct).trim();
    }catch(_){}
    try{
      const param = ctx?.params?.get?.(key);
      if (param != null && String(param).trim() !== '') return String(param).trim();
    }catch(_){}
    return '';
  }

  function resolveReturnTarget(){
    const next = readCtxValue('next');
    const cdnext = readCtxValue('cdnext');
    const zoneReturn = readCtxValue('zoneReturn');
    const hubRoot = readCtxValue('hubRoot');
    const hub = readCtxValue('hub');

    const combined = `${next} ${cdnext} ${zoneReturn} ${hubRoot} ${hub}`.toLowerCase();

    let label = 'ไปหน้าถัดไป';
    if (combined.includes('hygiene-zone.html')) label = 'กลับ Hygiene Zone';
    else if (combined.includes('nutrition-zone.html')) label = 'กลับ Nutrition Zone';
    else if (combined.includes('fitness-zone.html')) label = 'กลับ Fitness Zone';
    else if (combined.includes('hub-v2.html') || combined.includes('hub.html')) label = 'กลับหน้าหลัก';

    return { next, cdnext, zoneReturn, hubRoot, hub, label };
  }

  const returnTarget = resolveReturnTarget();

  container.innerHTML = `
    <div class="mask-layer">
      <div class="mask-brief" id="maskCoolBrief" style="position:static;padding:0;">
        <div class="mask-brief-card" style="margin:18px auto;">
          <h2 class="mask-brief-title">Cooldown — Calm Air Check</h2>
          <p class="mask-brief-sub">
            แตะฟองอากาศสะอาดให้ครบ 5 จุด แล้วตอบคำถามสั้น ๆ ก่อน${returnTarget.label}
          </p>
          <button class="btn btn-primary" id="maskCoolStartBtn">เริ่มคูลดาวน์</button>
        </div>
      </div>

      <div class="mask-playfield hidden" id="maskCoolField">
        <div class="mask-scene" aria-hidden="true">
          <div class="mask-deco face">😌</div>
        </div>

        <div class="mask-bubbles" id="maskBubbles"></div>

        <div id="maskQuizWrap" class="mask-quiz-wrap hidden">
          <div class="mask-brief-card" style="text-align:left;padding:14px;">
            <div style="font-weight:900;font-size:18px;margin-bottom:6px;">คำถามสรุป</div>
            <div style="color:#94a3b8;margin-bottom:10px;">ข้อใดเป็นพฤติกรรมที่ช่วยลดการแพร่กระจายเชื้อจากการไอจาม</div>
            <div style="display:grid;gap:8px;" id="maskQuizChoices"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const state = {
    started:false,
    ended:false,
    phase:'bubbles',
    time:15,
    taps:0,
    goal:5,
    score:0,
    miss:0,
    answerCorrect:false,
    timer:null,
    quizOpened:false
  };

  const els = {
    brief: container.querySelector('#maskCoolBrief'),
    start: container.querySelector('#maskCoolStartBtn'),
    field: container.querySelector('#maskCoolField'),
    bubbles: container.querySelector('#maskBubbles'),
    quizWrap: container.querySelector('#maskQuizWrap'),
    quizChoices: container.querySelector('#maskQuizChoices')
  };

  let bubbleRun = null;

  function setHud(){
    const prog = state.phase === 'bubbles'
      ? `${state.taps}/${state.goal}`
      : (state.answerCorrect ? 'DONE' : 'Q1');

    if(api && typeof api.setStats === 'function'){
      api.setStats({
        time: Math.max(0, state.time),
        score: state.score,
        miss: state.miss,
        acc: prog
      });
    }
  }

  function openQuiz(){
    if(state.ended || state.quizOpened) return;
    state.quizOpened = true;
    state.phase = 'quiz';

    if (bubbleRun && typeof bubbleRun.end === 'function') {
      try{ bubbleRun.end(); }catch(_){}
    }

    els.quizWrap.classList.remove('hidden');
    els.quizChoices.innerHTML = '';

    const choices = [
      { label:'ปิดปากและจมูกด้วยข้อพับแขนเวลาไอหรือจาม', good:true },
      { label:'ไอใส่มือแล้วจับของต่อทันที', good:false },
      { label:'ดึงหน้ากากลงคางตอนอยู่ใกล้คนอื่น', good:false }
    ];

    choices
      .map(choice => ({ choice, sort:rng() }))
      .sort((a,b)=> a.sort - b.sort)
      .forEach(({ choice })=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mask-choice';
        btn.textContent = choice.label;

        btn.addEventListener('click', ()=>{
          if(state.ended || state.answerCorrect) return;

          if(choice.good){
            btn.classList.add('good');
            state.answerCorrect = true;
            state.score += 10;
            safeToast('ถูกต้อง!');
            setHud();
            setTimeout(()=> finish(true), 320);
          }else{
            btn.classList.add('bad');
            state.miss++;
            safeToast('ลองคิดอีกครั้ง');
            setHud();
          }
        });

        els.quizChoices.appendChild(btn);
      });

    setHud();
  }

  function finish(ok){
    if(state.ended) return;
    state.ended = true;

    clearInterval(state.timer);
    state.timer = null;

    if (bubbleRun && typeof bubbleRun.end === 'function') {
      try{ bubbleRun.end(); }catch(_){}
    }

    try{
      api?.logger?.push?.('maskcough_cooldown_end', {
        ok: !!ok,
        bubbles: state.taps,
        goal: state.goal,
        score: state.score,
        miss: state.miss,
        answerCorrect: state.answerCorrect,
        next: returnTarget.next,
        cdnext: returnTarget.cdnext,
        zoneReturn: returnTarget.zoneReturn,
        hub: returnTarget.hub,
        hubRoot: returnTarget.hubRoot
      });
    }catch(_){}

    if(api && typeof api.finish === 'function'){
      api.finish({
        ok: !!ok,
        title: 'คูลดาวน์เสร็จแล้ว',
        subtitle: ok
          ? `พร้อม${returnTarget.label}`
          : `หมดเวลาแล้ว แต่ยัง${returnTarget.label}ได้`,
        lines:[
          `แตะฟองอากาศสะอาด ${state.taps}/${state.goal} จุด`,
          `ตอบคำถามสรุป ${state.answerCorrect ? 'ถูกต้อง' : 'ยังไม่ถูก'}`,
          `คะแนน ${state.score}`,
          `พลาด ${state.miss} ครั้ง`
        ],

        next: returnTarget.next,
        cdnext: returnTarget.cdnext,
        zoneReturn: returnTarget.zoneReturn,
        hub: returnTarget.hub,
        hubRoot: returnTarget.hubRoot,

        buffs:{
          cType:'maskcough_calm_check',
          cDone: 1,
          cOk: ok ? 1 : 0,
          cScore: state.score
        },

        cooldownResult:{
          ok: !!ok,
          taps: state.taps,
          goal: state.goal,
          answerCorrect: state.answerCorrect,
          miss: state.miss,
          score: state.score,
          returnLabel: returnTarget.label
        }
      });
    }
  }

  function start(){
    if(state.started || state.ended) return;
    state.started = true;
    els.brief.classList.add('hidden');
    els.field.classList.remove('hidden');

    bubbleRun = runBubblePhase({
      host: els.bubbles,
      rng,
      className: 'mask-bubble',
      emoji: '🫧',
      countStart: 3,
      goal: state.goal,
      onPop: ()=>{
        if(state.ended || state.phase !== 'bubbles') return;
        state.taps++;
        state.score += 5;
        safeToast('อากาศสะอาดขึ้น!');
        setHud();
      },
      onGoal: ()=>{
        openQuiz();
      }
    });

    setHud();

    try{
      api?.logger?.push?.('maskcough_cooldown_start', {
        seed: ctx.seed,
        goal: state.goal,
        time: state.time,
        next: returnTarget.next,
        cdnext: returnTarget.cdnext,
        zoneReturn: returnTarget.zoneReturn
      });
    }catch(_){}

    state.timer = setInterval(()=>{
      if(state.ended) return;
      state.time = Math.max(0, state.time - 1);
      setHud();
      if(state.time <= 0){
        finish(false);
      }
    }, 1000);
  }

  els.start?.addEventListener('click', start);
  setHud();

  return {
    start(){},
    destroy(){
      clearInterval(state.timer);
      state.timer = null;
      try{ bubbleRun?.end?.(); }catch(_){}
    }
  };
}