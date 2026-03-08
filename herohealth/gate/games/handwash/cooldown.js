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
  loadCssOnce('./gate/games/handwash/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  container.innerHTML = `
    <div class="handwash-layer">
      <div class="handwash-brief" id="hwCoolBrief" style="position:static;padding:0;">
        <div class="handwash-brief-card" style="margin:18px auto;">
          <h2 class="handwash-brief-title">Cooldown — Handwash Calm Check</h2>
          <p class="handwash-brief-sub">
            แตะฟองสะอาดให้ครบ 5 จุด แล้วตอบคำถามสรุปสั้น ๆ ก่อนกลับ HUB
          </p>
          <button class="btn btn-primary" id="hwCoolStartBtn">เริ่มคูลดาวน์</button>
        </div>
      </div>

      <div class="handwash-playfield hidden" id="hwCoolField">
        <div class="handwash-scene" aria-hidden="true">
          <div class="handwash-deco hands">🫧👐</div>
        </div>

        <div class="handwash-bubbles" id="hwBubbles"></div>

        <div id="hwQuestionWrap" class="hidden" style="position:absolute;left:12px;right:12px;bottom:12px;z-index:4;">
          <div class="handwash-brief-card" style="text-align:left;padding:14px;">
            <div style="font-weight:900;font-size:18px;margin-bottom:6px;">คำถามสรุป</div>
            <div style="color:#94a3b8;margin-bottom:10px;">ข้อใดเป็นเหตุผลที่ควรล้างมือด้วยสบู่</div>
            <div style="display:grid;gap:8px;" id="hwQuestionChoices"></div>
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
    brief: container.querySelector('#hwCoolBrief'),
    start: container.querySelector('#hwCoolStartBtn'),
    field: container.querySelector('#hwCoolField'),
    bubbles: container.querySelector('#hwBubbles'),
    qWrap: container.querySelector('#hwQuestionWrap'),
    qChoices: container.querySelector('#hwQuestionChoices')
  };

  function acc(){
    const total = state.taps + state.miss;
    return total > 0 ? Math.round((state.taps / total) * 100) : 0;
  }

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
    el.className = 'hw-bubble';
    el.textContent = '🫧';
    el.style.left = `${12 + rng()*76}%`;
    el.style.top = `${18 + rng()*58}%`;

    el.addEventListener('click', ()=>{
      if(state.ended || state.phase !== 'bubbles') return;
      state.taps++;
      state.score += 5;
      el.remove();
      api.toast('สดชื่นขึ้นอีกนิด!');
      setHud();

      if(state.taps >= state.goal){
        openQuestion();
      }else{
        spawnBubble();
      }
    });

    els.bubbles.appendChild(el);
  }

  function openQuestion(){
    state.phase = 'question';
    els.qWrap.classList.remove('hidden');
    els.qChoices.innerHTML = '';

    const choices = [
      { label:'ช่วยชะล้างสิ่งสกปรกและลดเชื้อโรคบนมือ', good:true },
      { label:'ทำให้กินขนมได้เร็วขึ้นโดยไม่ต้องเช็ดมือ', good:false },
      { label:'ทำให้มือมีสีสวยขึ้นทันที', good:false }
    ];

    choices.sort(()=> rng() - 0.5).forEach(choice=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hw-choice';
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
      els.qChoices.appendChild(btn);
    });

    setHud();
  }

  function finish(ok){
    if(state.ended) return;
    state.ended = true;
    clearInterval(state.timer);

    api.logger.push('handwash_cooldown_end', {
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
        cType:'handwash_calm_check',
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

    api.logger.push('handwash_cooldown_start', {
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
