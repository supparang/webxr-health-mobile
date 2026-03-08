import { loadCssOnce } from '../../helpers/css.js';
import { mulberry32 } from '../../helpers/rng.js';
import { mountTargetHitWarmup } from '../../helpers/target-hit-warmup.js';

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

  return mountTargetHitWarmup({
    container,
    api,
    ctx,
    config: {
      rng,
      title: 'Warmup — Germ Detective Quick Scan',
      subtitle: 'แตะจุดเสี่ยงหรือของสกปรกให้ครบ 5 จุดใน 20 วินาที และอย่าแตะของสะอาด',
      startLabel: 'เริ่มสแกน',
      timeLimit: 20,
      goal: 5,

      rootClass: 'germ',
      goodPool: RISK_POOL,
      badPool: SAFE_POOL,
      initialGood: 7,
      initialBad: 5,
      minAliveGood: 3,
      respawnGoodCount: 2,

      renderShell: ({ title, subtitle, startLabel }) => `
        <div class="germ-layer">
          <div class="germ-brief" data-role="brief">
            <div class="germ-brief-card">
              <h2 class="germ-brief-title">${title}</h2>
              <p class="germ-brief-sub">${subtitle}</p>
              <button class="btn btn-primary" data-role="start">${startLabel}</button>
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

                <div class="germ-progress">
                  <div class="germ-row"><span>เป้าหมายที่พบ</span><strong data-role="progress-text">0/5</strong></div>
                  <div class="germ-row"><span>สถานะ</span><strong>Quick Scan</strong></div>
                </div>

                <div class="germ-targets" data-role="targets"></div>
              </div>
            </div>
          </div>
        </div>
      `,

      hostSelector: '[data-role="targets"]',
      briefSelector: '[data-role="brief"]',
      startSelector: '[data-role="start"]',

      goodItemClass: 'germ-item risk',
      badItemClass: 'germ-item safe',

      onGoodToast: ()=> 'เจอจุดเสี่ยงแล้ว!',
      onBadToast: ()=> 'อันนี้เป็นของสะอาด',
      finishTitleSuccess: 'พร้อมสืบต่อแล้ว!',
      finishTitleTimeout: 'หมดเวลา',
      finishSubtitle: 'สรุปผล Warmup — Germ Detective Quick Scan',

      progressText: ({ state }) => `${state.progress}/${state.goal}`,

      finishLines: ({ state, acc, timeBonus })=>[
        `พบจุดเสี่ยง ${state.progress}/${state.goal} จุด`,
        `คะแนน ${state.score}`,
        `พลาด ${state.miss}`,
        `ความแม่นยำ ${acc}%`,
        `โบนัสเวลา +${timeBonus} วินาที`
      ],

      buildBuffs: ({ state, acc, timeBonus, scoreBonus, rank })=>({
        wType: 'germdetective_quick_scan',
        wPct: acc,
        wFound: state.progress,
        wTimeBonus: timeBonus,
        wScoreBonus: scoreBonus,
        wRank: rank
      })
    }
  });
}
