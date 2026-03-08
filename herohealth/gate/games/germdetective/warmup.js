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
  loadCssOnce('./gate/games/germdetective/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  const RISK_POOL = [
    { emoji:'🦠', label:'เชื้อโรค' },
    { emoji:'🧦', label:'ถุงเท้าสกปรก' },
    { emoji:'🟫', label:'คราบสกปรก' },
    { emoji:'🤧', label:'ทิชชูใช้แล้ว' },
    { emoji:'🗑️', label:'ขยะเปื้อน' },
    { emoji:'👣', label:'รอยเปื้อน' }
  ];

  const SAFE_POOL = [
    { emoji:'🧼', label:'สบู่' },
    { emoji:'🧽', label:'ฟองน้ำสะอาด' },
    { emoji:'🪥', label:'แปรงสีฟัน' },
    { emoji:'🧴', label:'ขวดสบู่' },
    { emoji:'🫧', label:'ฟองสะอาด' }
  ];

  container.innerHTML = `
    <div class="germ-layer">
      <div class="germ-brief" id="germBrief">
        <div class="germ-brief-card">
          <h2 class="germ-brief-title">Warmup — Germ Detective Quick Scan</h2>
          <p class="germ-brief-sub">
            แตะจุดเสี่ยงหรือของสกปรกให้ครบ 5 จุดใน 20 วินาที และอย่าแตะของสะอาด
          </p>
          <button class="btn btn-primary" id="germStartBtn">เริ่มสแกน</button>
        </div>
      </div>

      <div class="germ-playfield">
        <div class="germ-scene" aria-hidden="true">
          <div class="germ-deco detective">🕵️</div>
          <div class="germ-deco germ">🦠</div>
          <div class="germ-deco room">🧪</div>
        </div>

        <div class="germ-board">
          <div class="germ-card">
            <div class="germ-card-title">ภารกิจสแกนจุดเสี่ยง</div>
            <div class="germ-card-sub">แตะเป้าหมายสีแดงให้ครบ และหลีกเลี่ยงของสะอาด</div>

            <div class="germ-progress" id="germProgress">
              <div class="germ-row"><span>เป้าหมายที่พบ</span><strong id="germFoundText">0/5</strong></div>
              <div class="germ-row"><span>สถานะ</span><strong>Quick Scan</strong></div>
            </div>

            <div class="germ-targets" id="germTargets"></div>
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
    found:0,
    goal:5,
    timer:null,
    items:[]
  };

  const els = {
    brief: container.querySelector('#germBrief'),
    start: container.querySelector('#germStartBtn'),
    targets: container.querySelector('#germTargets'),
    foundText: container.querySelector('#germFoundText')
  };

  function acc(){
    return state.taps > 0 ? Math.round((state.hits / state.taps) * 100) : 0;
  }

  function setHud(){
    api.setStats({
      time: state.time,
      score: state.score,
      miss: state.miss,
      acc: `${acc()}% • ${state.found}/${state.goal}`
    });
    els.foundText.textContent = `${state.found}/${state.goal}`;
  }

  function popAt(x, y, text){
    const el = document.createElement('div');
    el.className = 'germ-pop';
    el.style.left = x + '%';
    el.style.top = y + '%';
    el.textContent = text;
    els.targets.appendChild(el);
    setTimeout(()=> el.remove(), 560);
  }

  function rand(min, max){
    return rng() * (max - min) + min;
  }

  function makeItem(kind, data){
    return {
      id: `${kind}-${Math.random().toString(36).slice(2,8)}`,
      kind,
      emoji: data.emoji,
      label: data.label,
      x: rand(12, 88),
      y: rand(18, 82),
      alive: true,
      el: null
    };
  }

  function spawnSet(){
    const out = [];
    for(let i=0;i<7;i++) out.push(makeItem('risk', RISK_POOL[i % RISK_POOL.length]));
    for(let i=0;i<5;i++) out.push(makeItem('safe', SAFE_POOL[i % SAFE_POOL.length]));
    return out;
  }

  function maybeRespawnRisk(){
    const aliveRisk = state.items.filter(o=>o.kind === 'risk' && o.alive).length;
    if(aliveRisk >= 3) return;
    for(let i=0;i<2;i++){
      state.items.push(makeItem('risk', RISK_POOL[Math.floor(rand(0, RISK_POOL.length))]));
    }
    render();
  }

  function finish(ok){
    if(state.ended) return;
    state.ended = true;
    clearInterval(state.timer);

    let timeBonus = 0;
    let scoreBonus = 0;
    let rank = 'try';

    if(state.found >= 5){
      timeBonus = 5;
      scoreBonus = 20;
      rank = 'excellent';
    }else if(state.found >= 3){
      timeBonus = 3;
      scoreBonus = 10;
      rank = 'good';
    }else if(state.found >= 1){
      timeBonus = 1;
      rank = 'ok';
    }

    api.logger.push('germdetective_warmup_end', {
      ok,
      found: state.found,
      goal: state.goal,
      score: state.score,
      miss: state.miss,
      acc: acc(),
      rank
    });

    api.finish({
      ok:true,
      title: ok ? 'พร้อมสืบต่อแล้ว!' : 'หมดเวลา',
      subtitle: 'สรุปผล Warmup — Germ Detective Quick Scan',
      lines: [
        `พบจุดเสี่ยง ${state.found}/${state.goal} จุด`,
        `คะแนน ${state.score}`,
        `พลาด ${state.miss}`,
        `ความแม่นยำ ${acc()}%`,
        `โบนัสเวลา +${timeBonus} วินาที`
      ],
      buffs: {
        wType: 'germdetective_quick_scan',
        wPct: acc(),
        wFound: state.found,
        wTimeBonus: timeBonus,
        wScoreBonus: scoreBonus,
        wRank: rank
      }
    });
  }

  function onRisk(item){
    if(state.ended || !item.alive) return;
    item.alive = false;
    state.found++;
    state.hits++;
    state.taps++;
    state.score += 10;
    item.el?.remove();
    popAt(item.x, item.y, '+10');
    api.toast('เจอจุดเสี่ยงแล้ว!');
    maybeRespawnRisk();
    setHud();

    if(state.found >= state.goal){
      finish(true);
    }
  }

  function onSafe(item){
    if(state.ended || !item.alive) return;
    state.miss++;
    state.taps++;
    state.score = Math.max(0, state.score - 2);
    item.el?.animate([
      { transform:'translate(-50%,-50%) rotate(0deg)' },
      { transform:'translate(-50%,-50%) rotate(-8deg)' },
      { transform:'translate(-50%,-50%) rotate(8deg)' },
      { transform:'translate(-50%,-50%) rotate(0deg)' }
    ], { duration: 240, easing:'ease-out' });
    api.toast('อันนี้เป็นของสะอาด');
    setHud();
  }

  function render(){
    els.targets.innerHTML = '';
    state.items.filter(o=>o.alive).forEach(item=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `germ-item ${item.kind}`;
      btn.style.left = item.x + '%';
      btn.style.top = item.y + '%';
      btn.textContent = item.emoji;
      btn.title = item.label;
      btn.addEventListener('click', ()=>{
        if(item.kind === 'risk') onRisk(item);
        else onSafe(item);
      });
      item.el = btn;
      els.targets.appendChild(btn);
    });
  }

  function start(){
    if(state.started) return;
    state.started = true;
    els.brief.classList.add('hidden');
    state.items = spawnSet();
    render();
    setHud();

    api.logger.push('germdetective_warmup_start', {
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
  setHud();

  return {
    start(){},
    destroy(){
      clearInterval(state.timer);
    }
  };
}
