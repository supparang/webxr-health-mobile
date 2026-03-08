function loadCssOnce(href){
  const id = `css:${href}`;
  if(document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function mulberry32(seed){
  let t = seed >>> 0;
  return ()=>{
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function loadStyle(){
  loadCssOnce('./gate/games/cleanobjects/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  container.innerHTML = `
    <div class="clean-layer">
      <div class="clean-brief" id="cleanCoolBrief" style="position:static;padding:0;">
        <div class="clean-brief-card" style="margin:18px auto;">
          <h2 class="clean-brief-title">Cooldown — Clean Bubble Review</h2>
          <p class="clean-brief-sub">
            แตะฟองสะอาดให้ครบ 5 จุด แล้วตอบคำถามสั้น ๆ ก่อนกลับ HUB
          </p>
          <button class="btn btn-primary" id="cleanCoolStartBtn">เริ่มคูลดาวน์</button>
        </div>
      </div>

      <div class="clean-playfield hidden" id="cleanCoolField">
        <div class="clean-scene" aria-hidden="true">
          <div class="clean-deco.room">✨</div>
        </div>

        <div class="clean-bubbles" id="cleanBubbles"></div>

        <div id="cleanQuizWrap" class="clean-quiz-wrap hidden">
          <div class="clean-brief-card" style="text-align:left;padding:14px;">
            <div style="font-weight:900;font-size:18px;margin-bottom:6px;">คำถามสรุป</div>
            <div style="color:#94a3b8;margin-bottom:10px;">ข้อใดเป็นนิสัยที่ช่วยให้ของใช้สะอาดน่าใช้</div>
            <div style="display:grid;gap:8px;" id="cleanQuizChoices"></div>
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
    brief: container.querySelector('#cleanCoolBrief'),
    start: container.querySelector('#cleanCoolStartBtn'),
    field: container.querySelector('#cleanCoolField'),
    bubbles: container.querySelector('#cleanBubbles'),
    quizWrap: container.querySelector('#cleanQuizWrap'),
    quizChoices: container.querySelector('#cleanQuizChoices')
  };

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

  function spawnBubble(){
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'clean-bubble';
    el.textContent = '🫧';
    el.style.left = `${12 + rng()*76}%`;
    el.style.top = `${18 + rng()*58}%`;

    el.addEventListener('click', ()=>{
      if(state.ended || state.phase !== 'bubbles') return;
      state.taps++;
      state.score += 5;
      el.remove();
      api.toast('สะอาดขึ้นอีกนิด!');
      setHud();

      if(state.taps >= state.goal){
        openQuiz();
      }else{
        spawnBubble();
      }
    });

    els.bubbles.appendChild(el);
  }

  function openQuiz(){
    state.phase = 'quiz';
    els.quizWrap.classList.remove('hidden');
    els.quizChoices.innerHTML = '';

    const choices = [
      { label:'เช็ดทำความสะอาดของใช้เมื่อสกปรกและเก็บให้เป็นที่', good:true },
      { label:'ใช้ของเปื้อนต่อไปโดยไม่ต้องสนใจ', good:false },
      { label:'โยนของไว้ที่พื้นหลังใช้เสร็จ', good:false }
    ];

    choices.sort(()=> rng() - 0.5).forEach(choice=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'clean-choice';
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

    api.logger.push('cleanobjects_cooldown_end', {
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
        cType:'cleanobjects_bubble_review',
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

    for(let i=0;i<3;i++) spawnBubble();
    setHud();

    api.logger.push('cleanobjects_cooldown_start', {
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
    }
  };
}
