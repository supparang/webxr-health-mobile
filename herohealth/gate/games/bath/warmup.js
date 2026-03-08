const GOOD_POOL = ['🦠','👣','🧦','💨','⬛','💧','🟫','🟤'];
const BAD_POOL  = ['🧼','🧽','🚿','🧴','🦆'];

function rand(rng, min, max){
  return rng() * (max - min) + min;
}

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
  loadCssOnce('./gate/games/bath/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  container.innerHTML = `
    <div class="bath-layer">
      <div class="bath-brief" id="bathBrief">
        <div class="bath-brief-card">
          <div class="bath-brief-title">Warmup — Bath Clean Hunt</div>
          <p class="bath-brief-sub">แตะคราบสกปรกให้ครบ 6 จุดใน 20 วินาที และอย่าแตะของใช้ในห้องน้ำ</p>
          <button class="btn btn-primary" id="bathStartBtn">เริ่มล่าคราบ!</button>
        </div>
      </div>

      <div class="bath-playfield">
        <div class="bath-scene" aria-hidden="true">
          <div class="bath-deco tub">🛁</div>
          <div class="bath-deco shower">🚿</div>
          <div class="bath-deco sponge">🧽</div>
        </div>
        <div class="bath-targets" id="bathTargets"></div>
      </div>
    </div>
  `;

  const state = {
    time: 20,
    score: 0,
    miss: 0,
    hits: 0,
    taps: 0,
    cleaned: 0,
    goal: 6,
    streak: 0,
    started: false,
    ended: false,
    timer: null,
    objects: []
  };

  const els = {
    brief: container.querySelector('#bathBrief'),
    start: container.querySelector('#bathStartBtn'),
    targets: container.querySelector('#bathTargets')
  };

  function setHud(){
    const acc = state.taps > 0 ? Math.round((state.hits / state.taps) * 100) : 0;
    api.setStats({
      time: state.time,
      score: state.score,
      miss: state.miss,
      acc: `${acc}% • ${state.cleaned}/${state.goal}`
    });
  }

  function popAt(x, y, text){
    const el = document.createElement('div');
    el.className = 'bath-pop';
    el.style.left = x + '%';
    el.style.top = y + '%';
    el.textContent = text;
    els.targets.appendChild(el);
    setTimeout(()=> el.remove(), 560);
  }

  function makeObj(kind, label){
    return {
      id: `${kind}-${Math.random().toString(36).slice(2,8)}`,
      kind,
      label,
      x: rand(rng, 12, 88),
      y: rand(rng, 18, 82),
      alive: true,
      el: null
    };
  }

  function spawnSet(){
    const out = [];
    for(let i=0;i<9;i++) out.push(makeObj('good', GOOD_POOL[i % GOOD_POOL.length]));
    for(let i=0;i<5;i++) out.push(makeObj('bad', BAD_POOL[i % BAD_POOL.length]));
    return out;
  }

  function maybeRespawnGood(){
    const aliveGood = state.objects.filter(o=>o.kind === 'good' && o.alive).length;
    if(aliveGood >= 4) return;
    for(let i=0;i<3;i++){
      state.objects.push(makeObj('good', GOOD_POOL[Math.floor(rand(rng, 0, GOOD_POOL.length))]));
    }
    render();
  }

  function end(ok){
    if(state.ended) return;
    state.ended = true;
    clearInterval(state.timer);

    const acc = state.taps > 0 ? Math.round((state.hits / state.taps) * 100) : 0;

    let timeBonus = 0;
    let scoreBonus = 0;
    let rank = 'try';

    if(state.cleaned >= 6){
      timeBonus = 5;
      scoreBonus = 20;
      rank = 'excellent';
    }else if(state.cleaned >= 4){
      timeBonus = 3;
      scoreBonus = 10;
      rank = 'good';
    }else if(state.cleaned >= 1){
      timeBonus = 1;
      rank = 'ok';
    }

    api.logger.push('bath_warmup_end', {
      ok,
      cleaned: state.cleaned,
      goal: state.goal,
      score: state.score,
      miss: state.miss,
      acc,
      rank
    });

    api.finish({
      ok: true,
      title: ok ? 'พร้อมอาบน้ำแล้ว!' : 'หมดเวลา',
      subtitle: 'สรุปผล Warmup — Bath Clean Hunt',
      lines: [
        `เก็บคราบได้ ${state.cleaned}/${state.goal} จุด`,
        `คะแนน ${state.score}`,
        `พลาด ${state.miss}`,
        `ความแม่นยำ ${acc}%`,
        `โบนัสเวลา +${timeBonus} วินาที`
      ],
      buffs: {
        wType: 'bath_clean_hunt',
        wPct: acc,
        wCleaned: state.cleaned,
        wTimeBonus: timeBonus,
        wScoreBonus: scoreBonus,
        wRank: rank
      }
    });
  }

  function onGood(obj){
    if(state.ended || !obj.alive) return;
    obj.alive = false;
    state.cleaned++;
    state.hits++;
    state.taps++;
    state.streak++;
    state.score += 10;
    if(obj.el) obj.el.remove();

    if(state.streak > 0 && state.streak % 3 === 0){
      state.score += 5;
      api.toast('Clean Combo! +5');
    }

    popAt(obj.x, obj.y, '+10');
    maybeRespawnGood();
    setHud();

    if(state.cleaned >= state.goal){
      end(true);
    }
  }

  function onBad(obj){
    if(state.ended || !obj.alive) return;
    state.miss++;
    state.taps++;
    state.streak = 0;
    obj.el?.animate([
      { transform:'translate(-50%,-50%) rotate(0deg)' },
      { transform:'translate(-50%,-50%) rotate(-8deg)' },
      { transform:'translate(-50%,-50%) rotate(8deg)' },
      { transform:'translate(-50%,-50%) rotate(0deg)' }
    ], { duration: 240, easing:'ease-out' });

    api.toast('อุ๊ปส์! นั่นเป็นของใช้ในห้องน้ำ');
    setHud();
  }

  function render(){
    els.targets.innerHTML = '';
    state.objects.filter(o=>o.alive).forEach(obj=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `bath-target ${obj.kind}`;
      btn.style.left = obj.x + '%';
      btn.style.top = obj.y + '%';
      btn.textContent = obj.label;
      btn.addEventListener('click', ()=>{
        if(obj.kind === 'good') onGood(obj);
        else onBad(obj);
      });
      obj.el = btn;
      els.targets.appendChild(btn);
    });
  }

  function start(){
    if(state.started) return;
    state.started = true;
    els.brief.classList.add('hidden');
    state.objects = spawnSet();
    setHud();
    render();

    api.logger.push('bath_warmup_start', { seed: ctx.seed, diff: ctx.diff });

    state.timer = setInterval(()=>{
      state.time--;
      setHud();
      if(state.time <= 0){
        end(false);
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
