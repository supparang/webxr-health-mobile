import { loadCssOnce } from '../../helpers/css.js';
import { mulberry32 } from '../../helpers/rng.js';
import { runBubblePhase } from '../../helpers/bubbles.js';

export function loadStyle(){
  loadCssOnce('./gate/games/maskcough/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  container.innerHTML = `
    <div class="mask-layer">
      <div class="mask-brief" id="maskCoolBrief" style="position:static;padding:0;">
        <div class="mask-brief-card" style="margin:18px auto;">
          <h2 class="mask-brief-title">Cooldown — Calm Air Check</h2>
          <p class="mask-brief-sub">
            แตะฟองอากาศสะอาดให้ครบ 5 จุด แล้วตอบคำถามสั้น ๆ ก่อนกลับ HUB
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
    timer:null
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
      { label:'ปิดปากและจมูกด้วยข้อพับแขนเวลาไอหรือจาม', good:true },
      { label:'ไอใส่มือแล้วจับของต่อทันที', good:false },
      { label:'ดึงหน้ากากลงคางตอนอยู่ใกล้คนอื่น', good:false }
    ];

    choices.sort(()=> rng() - 0.5).forEach(choice=>{
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

    api.logger.push('maskcough_cooldown_end', {
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
        `แตะฟองอากาศสะอาด ${state.taps}/${state.goal} จุด`,
        `ตอบคำถามสรุป ${state.answerCorrect ? 'ถูกต้อง' : 'ยังไม่ถูก'}`,
        `คะแนน ${state.score}`
      ],
      buffs:{
        cType:'maskcough_calm_check',
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
      className: 'mask-bubble',
      emoji: '🫧',
      countStart: 3,
      goal: state.goal,
      onPop: ()=>{
        state.taps++;
        state.score += 5;
        api.toast('อากาศสะอาดขึ้น!');
        setHud();
      },
      onGoal: ()=>{
        openQuiz();
      }
    });

    setHud();

    api.logger.push('maskcough_cooldown_start', {
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
