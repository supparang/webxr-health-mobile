import { loadCssOnce } from '../../helpers/css.js';
import { mulberry32 } from '../../helpers/rng.js';
import { runBubblePhase } from '../../helpers/bubbles.js';

export function loadStyle(){
  loadCssOnce('./gate/games/brush/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  container.innerHTML = `
    <div class="brush-layer">
      <div class="brush-brief" id="brushCoolBrief" style="position:static;padding:0;">
        <div class="brush-brief-card" style="margin:18px auto;">
          <h2 class="brush-brief-title">Cooldown — Brush Calm Check</h2>
          <p class="brush-brief-sub">
            แตะฟองสะอาดให้ครบ 5 จุด แล้วตอบคำถามสั้น ๆ ก่อนกลับ HUB
          </p>
          <button class="btn btn-primary" id="brushCoolStartBtn">เริ่มคูลดาวน์</button>
        </div>
      </div>

      <div class="brush-playfield hidden" id="brushCoolField">
        <div class="brush-scene" aria-hidden="true">
          <div class="brush-deco tooth">🫧🦷</div>
        </div>

        <div class="brush-bubbles" id="brushBubbles"></div>

        <div id="brushQuizWrap" class="brush-quiz-wrap hidden">
          <div class="brush-brief-card" style="text-align:left;padding:14px;">
            <div style="font-weight:900;font-size:18px;margin-bottom:6px;">คำถามสรุป</div>
            <div style="color:#94a3b8;margin-bottom:10px;">ข้อใดช่วยให้ฟันสะอาดและลดกลิ่นปาก</div>
            <div style="display:grid;gap:8px;" id="brushQuizChoices"></div>
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
    timer:null
  };

  const els = {
    brief: container.querySelector('#brushCoolBrief'),
    start: container.querySelector('#brushCoolStartBtn'),
    field: container.querySelector('#brushCoolField'),
    bubbles: container.querySelector('#brushBubbles'),
    quizWrap: container.querySelector('#brushQuizWrap'),
    quizChoices: container.querySelector('#brushQuizChoices')
  };

  let bubbleRun = null;

  function setHud(){
    const prog = state.phase === 'bubbles'
      ? `${state.taps}/${state.goal}`
      : (state.answerCorrect ? 'DONE' : 'Q1');

    api.setStats({
      time: state.time,
      score: state.score,
      miss: state.miss,
      acc: prog
    });
  }

  function openQuiz(){
    state.phase = 'quiz';
    els.quizWrap.classList.remove('hidden');
    els.quizChoices.innerHTML = '';

    const choices = [
      { label:'แปรงฟันให้ทั่วอย่างสม่ำเสมอ', good:true },
      { label:'กินขนมก่อนนอนแล้วไม่ต้องแปรง', good:false },
      { label:'ใช้แปรงฟันเล่นแทนของเล่น', good:false }
    ];

    choices.sort(()=> rng() - 0.5).forEach(choice=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'brush-choice';
      btn.textContent = choice.label;
      btn.addEventListener('click', ()=>{
        if(state.ended || state.answerCorrect) return;

        if(choice.good){
          btn.classList.add('good');
          state.answerCorrect = true;
          state.score += 10;
          api.toast('ถูกต้อง!');
          setHud();
          setTimeout(()=> finish(true), 320);
        }else{
          btn.classList.add('bad');
          state.miss++;
          api.toast('ลองคิดอีกครั้ง');
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
    bubbleRun?.end();

    api.logger.push('brush_cooldown_end', {
      ok,
      bubbles: state.taps,
      goal: state.goal,
      score: state.score,
      miss: state.miss,
      answerCorrect: state.answerCorrect
    });

    api.finish({
      ok:true,
      title:'คูลดาวน์เสร็จแล้ว',
      subtitle:'พร้อมกลับ HUB',
      lines:[
        `แตะฟองสะอาด ${state.taps}/${state.goal} จุด`,
        `ตอบคำถามสรุป ${state.answerCorrect ? 'ถูกต้อง' : 'ยังไม่ถูก'}`,
        `คะแนน ${state.score}`
      ],
      buffs:{
        cType:'brush_calm_check',
        cDone:1,
        cScore:state.score
      }
    });
  }

  function start(){
    if(state.started) return;
    state.started = true;
    els.brief.classList.add('hidden');
    els.field.classList.remove('hidden');

    bubbleRun = runBubblePhase({
      host: els.bubbles,
      rng,
      className: 'brush-bubble',
      emoji: '🫧',
      countStart: 3,
      goal: state.goal,
      onPop: ()=>{
        state.taps++;
        state.score += 5;
        api.toast('ฟองสะอาดแตกแล้ว!');
        setHud();
      },
      onGoal: ()=>{
        openQuiz();
      }
    });

    setHud();

    api.logger.push('brush_cooldown_start', {
      seed: ctx.seed
    });

    state.timer = setInterval(()=>{
      state.time--;
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
      bubbleRun?.end();
    }
  };
}
