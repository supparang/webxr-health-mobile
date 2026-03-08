import { loadCssOnce } from '../../helpers/css.js';
import { mulberry32 } from '../../helpers/rng.js';
import { mountSequenceWarmup } from '../../helpers/sequence-warmup.js';

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

  return mountSequenceWarmup({
    container,
    api,
    ctx,
    config: {
      rng,
      rootClass: 'mask',
      title: 'Warmup — Mask & Cough Quick Prep',
      subtitle: 'เลือก 3 พฤติกรรมป้องกันที่ถูกต้องตามลำดับ ภายใน 20 วินาที',
      startLabel: 'เริ่มเตรียมป้องกัน',
      timeLimit: 20,
      stepPool: STEP_POOL,
      targetIds: ['mask','elbow','wash'],
      renderShell: ({ title, subtitle, startLabel }) => `
        <div class="mask-layer">
          <div class="mask-brief" data-role="brief">
            <div class="mask-brief-card">
              <h2 class="mask-brief-title">${title}</h2>
              <p class="mask-brief-sub">${subtitle}</p>
              <button class="btn btn-primary" data-role="start">${startLabel}</button>
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
                <div class="mask-progress" data-role="steps"></div>
              </div>

              <div class="mask-card">
                <div class="mask-card-title">ตัวเลือก</div>
                <div class="mask-card-sub">เลือกพฤติกรรมที่ถูกต้องทีละข้อ</div>
                <div class="mask-choice-list" data-role="choices"></div>
              </div>
            </div>
          </div>
        </div>
      `,
      getChoiceClass: ()=> 'mask-choice',
      getDoneRowClass: (done)=> `mask-step ${done ? 'done' : ''}`,
      onCorrectToast: (n)=> `ถูกต้อง! ขั้นที่ ${n}`,
      onWrongToast: ()=> 'ยังไม่ใช่พฤติกรรมถัดไป',
      finishTitleSuccess: 'พร้อมป้องกันแล้ว!',
      finishTitleTimeout: 'หมดเวลา',
      finishSubtitle: 'สรุปผล Warmup — Mask & Cough Quick Prep',
      finishLines: ({ state, acc, timeBonus })=>[
        `เรียงถูก ${state.currentIndex}/3 ขั้น`,
        `คะแนน ${state.score}`,
        `พลาด ${state.miss}`,
        `ความแม่นยำ ${acc}%`,
        `โบนัสเวลา +${timeBonus} วินาที`
      ],
      buildBuffs: ({ state, acc, timeBonus, scoreBonus, rank })=>({
        wType: 'maskcough_quick_prep',
        wPct: acc,
        wSteps: state.currentIndex,
        wTimeBonus: timeBonus,
        wScoreBonus: scoreBonus,
        wRank: rank
      })
    }
  });
}
