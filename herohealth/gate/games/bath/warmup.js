import { loadCssOnce } from '../../helpers/css.js';
import { mulberry32 } from '../../helpers/rng.js';
import { mountTargetHitWarmup } from '../../helpers/target-hit-warmup.js';

export function loadStyle(){
  loadCssOnce('./gate/games/bath/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  const GOOD_POOL = [
    { emoji:'🦠', label:'เชื้อโรค' },
    { emoji:'👣', label:'รอยเท้าเปื้อน' },
    { emoji:'🧦', label:'ถุงเท้าสกปรก' },
    { emoji:'💨', label:'กลิ่นเหม็น' },
    { emoji:'⬛', label:'คราบดำ' },
    { emoji:'💧', label:'คราบเหงื่อ' },
    { emoji:'🟫', label:'คราบโคลน' },
    { emoji:'🟤', label:'คราบเปื้อน' }
  ];

  const BAD_POOL = [
    { emoji:'🧼', label:'สบู่' },
    { emoji:'🧽', label:'ฟองน้ำ' },
    { emoji:'🚿', label:'ฝักบัว' },
    { emoji:'🧴', label:'แชมพู' },
    { emoji:'🦆', label:'เป็ดยาง' }
  ];

  return mountTargetHitWarmup({
    container,
    api,
    ctx,
    config: {
      rng,
      title: 'Warmup — Bath Clean Hunt',
      subtitle: 'แตะคราบสกปรกให้ครบ 6 จุดใน 20 วินาที และอย่าแตะของใช้ในห้องน้ำ',
      startLabel: 'เริ่มล่าคราบ!',
      timeLimit: 20,
      goal: 6,

      rootClass: 'bath',
      goodPool: GOOD_POOL,
      badPool: BAD_POOL,
      initialGood: 9,
      initialBad: 5,
      minAliveGood: 4,
      respawnGoodCount: 3,

      renderShell: ({ title, subtitle, startLabel }) => `
        <div class="bath-layer">
          <div class="bath-brief" data-role="brief">
            <div class="bath-brief-card">
              <div class="bath-brief-title">${title}</div>
              <p class="bath-brief-sub">${subtitle}</p>
              <button class="btn btn-primary" data-role="start">${startLabel}</button>
            </div>
          </div>

          <div class="bath-playfield">
            <div class="bath-scene" aria-hidden="true">
              <div class="bath-deco tub">🛁</div>
              <div class="bath-deco shower">🚿</div>
              <div class="bath-deco sponge">🧽</div>
            </div>
            <div class="bath-targets" data-role="targets"></div>
          </div>
        </div>
      `,

      hostSelector: '[data-role="targets"]',
      briefSelector: '[data-role="brief"]',
      startSelector: '[data-role="start"]',

      goodItemClass: 'bath-target good',
      badItemClass: 'bath-target bad',

      onGoodToast: ()=> 'เก็บคราบได้แล้ว!',
      onBadToast: ()=> 'อุ๊ปส์! นั่นเป็นของใช้ในห้องน้ำ',
      finishTitleSuccess: 'พร้อมอาบน้ำแล้ว!',
      finishTitleTimeout: 'หมดเวลา',
      finishSubtitle: 'สรุปผล Warmup — Bath Clean Hunt',

      progressText: ({ state }) => `${state.progress}/${state.goal}`,

      finishLines: ({ state, acc, timeBonus })=>[
        `เก็บคราบได้ ${state.progress}/${state.goal} จุด`,
        `คะแนน ${state.score}`,
        `พลาด ${state.miss}`,
        `ความแม่นยำ ${acc}%`,
        `โบนัสเวลา +${timeBonus} วินาที`
      ],

      buildBuffs: ({ state, acc, timeBonus, scoreBonus, rank })=>({
        wType: 'bath_clean_hunt',
        wPct: acc,
        wCleaned: state.progress,
        wTimeBonus: timeBonus,
        wScoreBonus: scoreBonus,
        wRank: rank
      })
    }
  });
}
