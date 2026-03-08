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
  loadCssOnce('./gate/games/cleanobjects/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  const STEP_POOL = [
    { id:'desk_dirty', label:'โต๊ะมีคราบเปื้อน', desc:'โต๊ะที่ใช้งานแล้วมีคราบควรเช็ดทำความสะอาด', emoji:'🪑', good:true },
    { id:'toy_dirty', label:'ของเล่นตกพื้นสกปรก', desc:'ของเล่นที่เปื้อนควรเช็ดก่อนใช้อีกครั้ง', emoji:'🧸', good:true },
    { id:'bottle_dirty', label:'ขวดน้ำมีคราบด้านนอก', desc:'ของใช้ที่จับบ่อยควรเช็ดเมื่อสกปรก', emoji:'🍼', good:true },
    { id:'soap_clean', label:'สบู่สะอาดพร้อมใช้', desc:'อันนี้เป็นของสะอาด ไม่ใช่เป้าหมายให้เช็ดตอนนี้', emoji:'🧼', good:false },
    { id:'toothbrush_clean', label:'แปรงสีฟันสะอาด', desc:'เก็บถูกที่และสะอาดอยู่แล้ว', emoji:'🪥', good:false },
    { id:'towel_clean', label:'ผ้าสะอาดพับไว้', desc:'ยังไม่ใช่ของที่ต้องรีบทำความสะอาด', emoji:'🧻', good:false },
    { id:'bubble_clean', label:'ฟองสะอาด', desc:'แปลว่าสะอาด ไม่ใช่ของสกปรก', emoji:'🫧', good:false }
  ];

  const TARGETS = ['desk_dirty','toy_dirty','bottle_dirty'];

  container.innerHTML = `
    <div class="clean-layer">
      <div class="clean-brief" id="cleanBrief">
        <div class="clean-brief-card">
          <h2 class="clean-brief-title">Warmup — Clean Objects Quick Check</h2>
          <p class="clean-brief-sub">
            เลือกวัตถุที่ควรทำความสะอาดให้ถูก 3 อย่าง ภายใน 20 วินาที
          </p>
          <button class="btn btn-primary" id="cleanStartBtn">เริ่มตรวจวัตถุ</button>
        </div>
      </div>

      <div class="clean-playfield">
        <div class="clean-scene" aria-hidden="true">
          <div class="clean-deco.bucket">🪣</div>
          <div class="clean-deco.sponge">🧽</div>
          <div class="clean-deco.room">🏠</div>
        </div>

        <div class="clean-board">
          <div class="clean-card">
            <div class="clean-card-title">สิ่งที่ต้องตัดสินใจ</div>
            <div class="clean-card-sub">แตะตัวเลือกที่ “ควรทำความสะอาด” ให้ครบ 3 อย่าง</div>
            <div class="clean-progress" id="cleanSteps"></div>
          </div>

          <div class="clean-card">
            <div class="clean-card-title">ตัวเลือก</div>
            <div class="clean-card-sub">เลือกวัตถุที่สกปรกหรือมีคราบ</div>
            <div class="clean-choice-list" id="cleanChoices"></div>
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
    brief: container.querySelector('#cleanBrief'),
    start: container.querySelector('#cleanStartBtn'),
    steps: container.querySelector('#cleanSteps'),
    choices: container.querySelector('#cleanChoices')
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
      div.className = `clean-row ${picked ? 'done' : ''}`;
      div.innerHTML = `
        <span>${idx+1}. ${picked ? `${picked.emoji} ${picked.label}` : 'ยังไม่ได้เลือก'}</span>
        <strong>${picked ? 'OK' : 'รอเลือก'}</strong>
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
      api.toast(`ถูกต้อง! เลือกครบ ${state.currentIndex}`);
    }else{
      state.miss++;
      state.score = Math.max(0, state.score - 2);
      btn.classList.add('bad');
      btn.disabled = true;
      api.toast('อันนี้ยังไม่ใช่เป้าหมายที่ต้องทำความสะอาด');
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
      btn.className = 'clean-choice';
      btn.innerHTML = `
        <div class="clean-choice-head">
          <div class="clean-choice-emoji">${step.emoji}</div>
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

    api.logger.push('cleanobjects_warmup_end', {
      ok,
      stepsCorrect: state.currentIndex,
      score: state.score,
      miss: state.miss,
      acc: acc(),
      rank
    });

    api.finish({
      ok:true,
      title: ok ? 'พร้อมทำความสะอาดแล้ว!' : 'หมดเวลา',
      subtitle: 'สรุปผล Warmup — Clean Objects Quick Check',
      lines: [
        `เลือกถูก ${state.currentIndex}/3 อย่าง`,
        `คะแนน ${state.score}`,
        `พลาด ${state.miss}`,
        `ความแม่นยำ ${acc()}%`,
        `โบนัสเวลา +${timeBonus} วินาที`
      ],
      buffs: {
        wType: 'cleanobjects_quick_check',
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

    api.logger.push('cleanobjects_warmup_start', {
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
