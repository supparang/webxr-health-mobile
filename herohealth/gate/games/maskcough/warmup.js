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

function shuffle(arr, rng){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(rng() * (i+1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function loadStyle(){
  loadCssOnce('./gate/games/maskcough/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  const STEP_POOL = [
    { id:'mask', label:'สวมหน้ากากให้ปิดจมูกและปาก', desc:'ใส่หน้ากากให้พอดีและปิดครบทั้งจมูกกับปาก', emoji:'😷' },
    { id:'elbow', label:'ไอหรือจามใส่ข้อพับแขน', desc:'ใช้ข้อพับแขนปิดปากและจมูกเวลาไอหรือจาม', emoji:'🤧' },
    { id:'wash', label:'ล้างมือหลังไอหรือจาม', desc:'ชะล้างสิ่งสกปรกและลดการแพร่เชื้อ', emoji:'🧼' },
    { id:'share', label:'แบ่งหน้ากากกับเพื่อน', desc:'ใช้หน้ากากร่วมกันไม่เหมาะสม', emoji:'🫱' },
    { id:'open', label:'ดึงหน้ากากลงคางตลอดเวลา', desc:'ใส่ไม่ปิดจมูกและปากจึงไม่ช่วยป้องกัน', emoji:'🫥' },
    { id:'coverhand', label:'ใช้มือเปล่าปิดปากแล้วไม่ล้างมือ', desc:'ยังเสี่ยงแพร่เชื้อได้', emoji:'✋' },
    { id:'laugh', label:'ไอใส่คนอื่นแล้วหัวเราะ', desc:'เป็นพฤติกรรมไม่เหมาะสม', emoji:'😅' }
  ];

  const TARGETS = ['mask','elbow','wash'];

  container.innerHTML = `
    <div class="mask-layer">
      <div class="mask-brief" id="maskBrief">
        <div class="mask-brief-card">
          <h2 class="mask-brief-title">Warmup — Mask & Cough Quick Prep</h2>
          <p class="mask-brief-sub">
            เลือก 3 พฤติกรรมป้องกันที่ถูกต้องตามลำดับ ภายใน 20 วินาที
          </p>
          <button class="btn btn-primary" id="maskStartBtn">เริ่มเตรียมป้องกัน</button>
        </div>
      </div>

      <div class="mask-playfield">
        <div class="mask-scene" aria-hidden="true">
          <div class="mask-deco face">😷</div>
          <div class="mask-deco mask">🛡️</div>
          <div class="mask-deco.spark">✨</div>
        </div>

        <div class="mask-board">
          <div class="mask-card">
            <div class="mask-card-title">ลำดับที่ต้องเรียง</div>
            <div class="mask-card-sub">แตะตัวเลือกที่ถูกต้องให้ครบ 3 ขั้นตามลำดับ</div>
            <div class="mask-progress" id="maskSteps"></div>
          </div>

          <div class="mask-card">
            <div class="mask-card-title">ตัวเลือก</div>
            <div class="mask-card-sub">เลือกพฤติกรรมที่ถูกต้องทีละข้อ</div>
            <div class="mask-choice-list" id="maskChoices"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const state = {
    started:false,
    ended:false,
    time:20,
    score:0,
    miss:0,
    taps:0,
    hits:0,
    currentIndex:0,
    picks:[],
    rounds:[],
    timer:null
  };

  const els = {
    brief: container.querySelector('#maskBrief'),
    start: container.querySelector('#maskStartBtn'),
    steps: container.querySelector('#maskSteps'),
    choices: container.querySelector('#maskChoices')
  };

  const targetSteps = TARGETS.map(id => STEP_POOL.find(s=>s.id===id));

  function acc(){
    return state.taps > 0 ? Math.round((state.hits / state.taps) * 100) : 0;
  }

  function setHud(){
    api.setStats({
      time: state.time,
      score: state.score,
      miss: state.miss,
      acc: `${acc()}% • ${state.currentIndex}/${targetSteps.length}`
    });
  }

  function renderSteps(){
    els.steps.innerHTML = '';
    targetSteps.forEach((step, idx)=>{
      const picked = state.picks[idx];
      const div = document.createElement('div');
      div.className = `mask-step ${picked ? 'done' : ''}`;
      div.innerHTML = `
        <div class="mask-step-num">${idx+1}</div>
        <div style="min-width:0;flex:1 1 auto;">
          <div style="font-weight:900;">${picked ? `${picked.emoji} ${picked.label}` : 'ยังไม่ได้เลือก'}</div>
          <div style="color:#94a3b8;font-size:13px;margin-top:2px;">
            ${picked ? picked.desc : 'รอการเลือก'}
          </div>
        </div>
      `;
      els.steps.appendChild(div);
    });
  }

  function buildRound(){
    const needed = targetSteps[state.currentIndex];
    const distractors = shuffle(
      STEP_POOL.filter(s => s.id !== needed.id),
      rng
    ).slice(0, 2);

    state.rounds = shuffle([needed, ...distractors], rng);
    renderChoices();
  }

  function onChoice(step, btn){
    if(state.ended) return;
    state.taps++;

    const expected = targetSteps[state.currentIndex];
    const isGood = step.id === expected.id;

    if(isGood){
      state.hits++;
      state.score += 15;
      state.picks.push(step);
      state.currentIndex++;
      btn.classList.add('good');
      btn.disabled = true;
      api.toast(`ถูกต้อง! ขั้นที่ ${state.currentIndex}`);
    }else{
      state.miss++;
      state.score = Math.max(0, state.score - 2);
      btn.classList.add('bad');
      btn.disabled = true;
      api.toast('ยังไม่ใช่พฤติกรรมถัดไป');
    }

    setHud();
    renderSteps();

    setTimeout(()=>{
      if(state.currentIndex >= targetSteps.length){
        finish(true);
      }else{
        buildRound();
      }
    }, 320);
  }

  function renderChoices(){
    els.choices.innerHTML = '';
    state.rounds.forEach(step=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mask-choice';
      btn.innerHTML = `
        <div class="mask-choice-head">
          <div class="mask-choice-emoji">${step.emoji}</div>
          <div style="min-width:0;">
            <div style="font-weight:900;">${step.label}</div>
            <div style="color:#94a3b8;font-size:13px;margin-top:2px;">${step.desc}</div>
          </div>
        </div>
      `;
      btn.addEventListener('click', ()=> onChoice(step, btn));
      els.choices.appendChild(btn);
    });
  }

  function finish(ok){
    if(state.ended) return;
    state.ended = true;
    clearInterval(state.timer);

    let timeBonus = 0;
    let scoreBonus = 0;
    let rank = 'try';

    if(state.currentIndex >= 3){
      timeBonus = 5;
      scoreBonus = 20;
      rank = 'excellent';
    }else if(state.currentIndex >= 2){
      timeBonus = 3;
      scoreBonus = 10;
      rank = 'good';
    }else if(state.currentIndex >= 1){
      timeBonus = 1;
      rank = 'ok';
    }

    api.logger.push('maskcough_warmup_end', {
      ok,
      stepsCorrect: state.currentIndex,
      score: state.score,
      miss: state.miss,
      acc: acc(),
      rank
    });

    api.finish({
      ok:true,
      title: ok ? 'พร้อมป้องกันแล้ว!' : 'หมดเวลา',
      subtitle: 'สรุปผล Warmup — Mask & Cough Quick Prep',
      lines: [
        `เรียงถูก ${state.currentIndex}/3 ขั้น`,
        `คะแนน ${state.score}`,
        `พลาด ${state.miss}`,
        `ความแม่นยำ ${acc()}%`,
        `โบนัสเวลา +${timeBonus} วินาที`
      ],
      buffs: {
        wType: 'maskcough_quick_prep',
        wPct: acc(),
        wSteps: state.currentIndex,
        wTimeBonus: timeBonus,
        wScoreBonus: scoreBonus,
        wRank: rank
      }
    });
  }

  function start(){
    if(state.started) return;
    state.started = true;
    els.brief.classList.add('hidden');
    renderSteps();
    buildRound();
    setHud();

    api.logger.push('maskcough_warmup_start', {
      seed: ctx.seed,
      diff: ctx.diff
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
  renderSteps();
  setHud();

  return {
    start(){},
    destroy(){
      clearInterval(state.timer);
    }
  };
}
