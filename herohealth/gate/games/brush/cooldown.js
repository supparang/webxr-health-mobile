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
    el.className = 'brush-bubble';
    el.textContent = '🫧';
    el.style.left = `${12 + rng()*76}%`;
    el.style.top = `${18 + rng()*58}%`;

    el.addEventListener('click', ()=>{
      if(state.ended || state.phase !== 'bubbles') return;
      state.taps++;
      state.score += 5;
      el.remove();
      api.toast('ฟองสะอาดแตกแล้ว!');
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

    for(let i=0;i<3;i++) spawnBubble();
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
    }
  };
}
