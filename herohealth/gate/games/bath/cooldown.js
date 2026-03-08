import { loadCssOnce } from '../../helpers/css.js';
import { mulberry32 } from '../../helpers/rng.js';
import { runBubblePhase } from '../../helpers/bubbles.js';

export function loadStyle(){
  loadCssOnce('./gate/games/bath/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  container.innerHTML = `
    <div class="bath-layer">
      <div class="bath-brief" style="position:static;padding:0;" id="bathCoolBrief">
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

  const duration = 15;
  let time = duration;
  let timer = null;
  let bubbleRun = null;

  const state = {
    taps: 0,
    goal: 5,
    done: false
  };

  const els = {
    brief: container.querySelector('#bathCoolBrief'),
    start: container.querySelector('#bathCoolStartBtn'),
    field: container.querySelector('#bathCoolField'),
    targets: container.querySelector('#bathCoolTargets')
  };

  function setHud(){
    api.setStats({
      time,
      score: state.taps,
      miss: 0,
      acc: `${state.taps}/${state.goal}`
    });
  }

  function finish(ok){
    if(state.done) return;
    state.done = true;
    clearInterval(timer);
    bubbleRun?.end();

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
        cDone: 1,
        cScore: state.taps
      }
    });
  }

  function start(){
    if(state.done || bubbleRun) return;

    els.brief.classList.add('hidden');
    els.field.classList.remove('hidden');

    bubbleRun = runBubblePhase({
      host: els.targets,
      rng,
      className: 'bath-target bad',
      emoji: '🫧',
      countStart: 3,
      goal: state.goal,
      onPop: ()=>{
        state.taps++;
        api.toast('ผ่อนคลายขึ้นอีกนิด');
        setHud();
      },
      onGoal: ()=>{
        finish(true);
      }
    });

    api.logger.push('bath_cooldown_start', { seed: ctx.seed });
    setHud();

    timer = setInterval(()=>{
      time--;
      setHud();
      if(time <= 0){
        finish(false);
      }
    }, 1000);
  }

  els.start?.addEventListener('click', start);
  setHud();

  return {
    start(){},
    destroy(){
      clearInterval(timer);
      bubbleRun?.end();
    }
  };
}
