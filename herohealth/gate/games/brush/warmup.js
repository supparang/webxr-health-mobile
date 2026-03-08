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
  loadCssOnce('./gate/games/brush/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  const STEP_POOL = [
    { id:'pick',  label:'หยิบแปรงสีฟัน', desc:'เตรียมแปรงที่สะอาดพร้อมใช้งาน', correctOrder:1, emoji:'🪥' },
    { id:'paste', label:'บีบยาสีฟันพอเหมาะ', desc:'บีบยาสีฟันปริมาณพอดีบนแปรง', correctOrder:2, emoji:'🧴' },
    { id:'brush', label:'แปรงให้ทั่วปาก', desc:'แปรงฟันด้านนอก ด้านใน และด้านเคี้ยว', correctOrder:3, emoji:'😁' },
    { id:'rinse', label:'บ้วนปาก', desc:'บ้วนปากหลังแปรงเสร็จ', correctOrder:4, emoji:'💧' },
    { id:'sleep', label:'นอนเลยโดยไม่แปรง', desc:'ข้ามการแปรงฟันแล้วไปนอนทันที', correctOrder:99, emoji:'😴' },
    { id:'candy', label:'กินลูกอมก่อน', desc:'เริ่มกินหวานก่อนโดยไม่แปรงฟัน', correctOrder:99, emoji:'🍬' },
    { id:'phone', label:'เล่นมือถือก่อน', desc:'วางแปรงไว้แล้วไปเล่นต่อ', correctOrder:99, emoji:'📱' }
  ];

  const TARGETS = ['pick','paste','brush'];

  container.innerHTML = `
    <div class="brush-layer">
      <div class="brush-brief" id="brushBrief">
        <div class="brush-brief-card">
          <h2 class="brush-brief-title">Warmup — Brush Quick Prep</h2>
          <p class="brush-brief-sub">
            เลือก 3 ขั้นเริ่มต้นของการแปรงฟันให้ถูกตามลำดับ ภายใน 20 วินาที
          </p>
          <button class="btn btn-primary" id="brushStartBtn">เริ่มเตรียมแปรงฟัน</button>
        </div>
      </div>

      <div class="brush-playfield">
        <div class="brush-scene" aria-hidden="true">
          <div class="brush-deco tooth">🦷</div>
          <div class="brush-deco brush">🪥</div>
          <div class="brush-deco.spark">✨</div>
        </div>

        <div class="brush-board">
          <div class="brush-card">
            <div class="brush-card-title">ลำดับที่ต้องเรียง</div>
            <div class="brush-card-sub">แตะตัวเลือกที่ถูกต้องให้ครบ 3 ขั้นตามลำดับ</div>
            <div class="brush-progress" id="brushSteps"></div>
          </div>

          <div class="brush-card">
            <div class="brush-card-title">ตัวเลือก</div>
            <div class="brush-card-sub">เลือกขั้นตอนที่ถูกต้องทีละข้อ</div>
            <div class="brush-choice-list" id="brushChoices"></div>
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
    brief: container.querySelector('#brushBrief'),
    start: container.querySelector('#brushStartBtn'),
    steps: container.querySelector('#brushSteps'),
    choices: container.querySelector('#brushChoices')
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
      div.className = `brush-step ${picked ? 'done' : ''}`;
      div.innerHTML = `
        <div class="brush-step-num">${idx+1}</div>
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
      api.toast('ยังไม่ใช่ขั้นตอนถัดไป');
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
      btn.className = 'brush-choice';
      btn.innerHTML = `
        <div class="brush-choice-head">
          <div class="brush-choice-emoji">${step.emoji}</div>
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

    api.logger.push('brush_warmup_end', {
      ok,
      stepsCorrect: state.currentIndex,
      score: state.score,
      miss: state.miss,
      acc: acc(),
      rank
    });

    api.finish({
      ok:true,
      title: ok ? 'พร้อมแปรงฟันแล้ว!' : 'หมดเวลา',
      subtitle: 'สรุปผล Warmup — Brush Quick Prep',
      lines: [
        `เรียงถูก ${state.currentIndex}/3 ขั้น`,
        `คะแนน ${state.score}`,
        `พลาด ${state.miss}`,
        `ความแม่นยำ ${acc()}%`,
        `โบนัสเวลา +${timeBonus} วินาที`
      ],
      buffs: {
        wType: 'brush_quick_prep',
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

    api.logger.push('brush_warmup_start', {
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
