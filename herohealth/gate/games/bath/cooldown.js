function loadCssOnce(href){
  const id = `css:${href}`;
  if(document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

export function loadStyle(){
  loadCssOnce('./gate/games/bath/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const duration = 15;
  let time = duration;
  let timer = null;

  container.innerHTML = `
    <div class="bath-layer">
      <div class="bath-brief" style="position:static;padding:0;">
        <div class="bath-brief-card" style="margin:18px auto;">
          <div class="bath-brief-title">Cooldown — Bath Calm Bubbles</div>
          <p class="bath-brief-sub">
            หายใจลึก ๆ แล้วแตะฟองอากาศผ่อนคลายให้ครบก่อนกลับ HUB
          </p>
          <button class="btn btn-primary" id="bathCoolStartBtn">เริ่มคูลดาวน์</button>
        </div>
      </div>

      <div class="bath-playfield hidden" id="bathCoolField">
        <div class="bath-scene" aria-hidden="true">
          <div class="bath-deco tub">🛁</div>
        </div>
        <div class="bath-targets" id="bathCoolTargets"></div>
      </div>
    </div>
  `;

  const startBtn = container.querySelector('#bathCoolStartBtn');
  const field = container.querySelector('#bathCoolField');
  const targetHost = container.querySelector('#bathCoolTargets');

  const state = {
    taps: 0,
    goal: 5,
    done: false
  };

  function setHud(){
    api.setStats({
      time,
      score: state.taps,
      miss: 0,
      acc: `${state.taps}/${state.goal}`
    });
  }

  function spawnBubble(){
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'bath-target bad';
    el.textContent = '🫧';
    el.style.left = `${12 + Math.random()*76}%`;
    el.style.top = `${18 + Math.random()*62}%`;
    el.addEventListener('click', ()=>{
      if(state.done) return;
      state.taps++;
      el.remove();
      if(state.taps < state.goal) spawnBubble();
      setHud();
      if(state.taps >= state.goal){
        finish(true);
      }
    });
    targetHost.appendChild(el);
  }

  function finish(ok){
    if(state.done) return;
    state.done = true;
    clearInterval(timer);

    api.logger.push('bath_cooldown_end', {
      ok,
      taps: state.taps,
      goal: state.goal
    });

    api.finish({
      ok: true,
      title: 'คูลดาวน์เสร็จแล้ว',
      subtitle: 'พร้อมกลับ HUB',
      lines: [
        `แตะฟองผ่อนคลาย ${state.taps}/${state.goal} จุด`,
        'เยี่ยมมาก ร่างกายพร้อมพักแล้ว'
      ],
      buffs: {
        cType: 'bath_calm_bubbles',
        cDone: 1
      }
    });
  }

  function start(){
    startBtn.closest('.bath-brief')?.classList.add('hidden');
    field.classList.remove('hidden');
    for(let i=0;i<3;i++) spawnBubble();
    setHud();

    api.logger.push('bath_cooldown_start', { seed: ctx.seed });

    timer = setInterval(()=>{
      time--;
      setHud();
      if(time <= 0){
        finish(false);
      }
    }, 1000);
  }

  startBtn?.addEventListener('click', start);
  setHud();

  return {
    start(){},
    destroy(){
      clearInterval(timer);
    }
  };
}
