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
  loadCssOnce('./gate/games/handwash/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  const STEP_POOL = [
    { id:'wet',  label:'ทำมือให้เปียก', desc:'เริ่มด้วยการทำให้มือเปียกด้วยน้ำสะอาด', correctOrder:1, emoji:'💧' },
    { id:'soap', label:'ฟอกสบู่', desc:'กดสบู่หรือถูสบู่ให้ทั่วมือ', correctOrder:2, emoji:'🧼' },
    { id:'rub',  label:'ถูมือ', desc:'ถูฝ่ามือ หลังมือ ซอกนิ้ว และรอบนิ้วโป้ง', correctOrder:3, emoji:'🫲' },
    { id:'rinse',label:'ล้างน้ำออก', desc:'ล้างฟองและคราบสบู่ออกด้วยน้ำสะอาด', correctOrder:4, emoji:'🚿' },
    { id:'dry',  label:'เช็ดมือให้แห้ง', desc:'ใช้ผ้าสะอาดหรือกระดาษเช็ดมือ', correctOrder:5, emoji:'🧻' },
    { id:'play', label:'ไปเล่นต่อเลย', desc:'ยังไม่ล้างมือก็วิ่งออกจากห้องน้ำ', correctOrder:99, emoji:'🏃' },
    { id:'eat',  label:'หยิบขนมกินก่อน', desc:'ข้ามการล้างมือแล้วเริ่มกินทันที', correctOrder:99, emoji:'🍪' }
  ];

  const TARGETS = ['wet','soap','rub'];

  container.innerHTML = `
    <div class="handwash-layer">
      <div class="handwash-brief" id="hwBrief">
        <div class="handwash-brief-card">
          <h2 class="handwash-brief-title">Warmup — Handwash Quick Prep</h2>
          <p class="handwash-brief-sub">
            เลือก 3 ขั้นเริ่มต้นของการล้างมือให้ถูกตามลำดับ ภายใน 20 วินาที
          </p>
          <button class="btn btn-primary" id="hwStartBtn">เริ่มเตรียมล้างมือ</button>
        </div>
      </div>

      <div class="handwash-playfield">
        <div class="handwash-scene" aria-hidden="true">
          <div class="handwash-deco tap">🚰</div>
          <div class="handwash-deco soap">🧼</div>
          <div class="handwash-deco hands">👐</div>
        </div>

        <div class="handwash-board">
          <div class="handwash-left">
            <div class="handwash-goal">
              <div class="handwash-pill">เป้าหมาย: เรียง 3 ขั้น</div>
              <div class="handwash-pill">ห้ามเลือกตัวหลอก</div>
            </div>

            <div class="handwash-dropzone">
              <div class="handwash-dropzone-title">ลำดับที่ต้องเรียง</div>
              <div class="handwash-dropzone-sub">แตะตัวเลือกที่ถูกต้องให้ครบ 3 ขั้นตามลำดับ</div>
              <div class="handwash-slots" id="hwSlots"></div>
            </div>
          </div>

          <div class="handwash-right">
            <div class="handwash-dropzone">
              <div class="handwash-dropzone-title">ตัวเลือก</div>
              <div class="handwash-dropzone-sub">เลือกขั้นตอนที่ถูกต้องทีละข้อ</div>
              <div class="handwash-choice-list" id="hwChoices"></div>
            </div>
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
    timer:null,
    rounds:[]
  };

  const els = {
    brief: container.querySelector('#hwBrief'),
    start: container.querySelector('#hwStartBtn'),
    slots: container.querySelector('#hwSlots'),
    choices: container.querySelector('#hwChoices')
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

  function renderSlots(){
    els.slots.innerHTML = '';
    targetSteps.forEach((step, idx)=>{
      const picked = state.picks[idx];
      const div = document.createElement('div');
      div.className = 'handwash-slot';
      div.innerHTML = `
        <div class="handwash-slot-label">ขั้นที่ ${idx+1}</div>
        <div class="${picked ? '' : 'handwash-slot-empty'}">
          ${picked ? `${picked.emoji} ${picked.label}` : 'ยังไม่ได้เลือก'}
        </div>
      `;
      els.slots.appendChild(div);
    });
  }

  function buildChoiceRound(){
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
    renderSlots();

    setTimeout(()=>{
      if(state.currentIndex >= targetSteps.length){
        finish(true);
      }else{
        buildChoiceRound();
      }
    }, 320);
  }

  function renderChoices(){
    els.choices.innerHTML = '';
    state.rounds.forEach(step=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hw-choice';
      btn.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-size:26px;flex:0 0 auto;">${step.emoji}</div>
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

    api.logger.push('handwash_warmup_end', {
      ok,
      stepsCorrect: state.currentIndex,
      score: state.score,
      miss: state.miss,
      acc: acc(),
      rank
    });

    api.finish({
      ok:true,
      title: ok ? 'พร้อมล้างมือแล้ว!' : 'หมดเวลา',
      subtitle: 'สรุปผล Warmup — Handwash Quick Prep',
      lines: [
        `เรียงถูก ${state.currentIndex}/3 ขั้น`,
        `คะแนน ${state.score}`,
        `พลาด ${state.miss}`,
        `ความแม่นยำ ${acc()}%`,
        `โบนัสเวลา +${timeBonus} วินาที`
      ],
      buffs: {
        wType: 'handwash_quick_prep',
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
    renderSlots();
    buildChoiceRound();
    setHud();

    api.logger.push('handwash_warmup_start', {
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
  renderSlots();
  setHud();

  return {
    start(){},
    destroy(){
      clearInterval(state.timer);
    }
  };
}
