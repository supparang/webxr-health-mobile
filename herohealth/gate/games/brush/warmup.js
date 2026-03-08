import { loadCssOnce } from '../../helpers/css.js';
import { mulberry32 } from '../../helpers/rng.js';
import { mountSequenceWarmup } from '../../helpers/sequence-warmup.js';

export function loadStyle(){
  loadCssOnce('./gate/games/brush/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  const STEP_POOL = [
    { id:'pick',  label:'หยิบแปรงสีฟัน', desc:'เตรียมแปรงที่สะอาดพร้อมใช้งาน', emoji:'🪥' },
    { id:'paste', label:'บีบยาสีฟันพอเหมาะ', desc:'บีบยาสีฟันปริมาณพอดีบนแปรง', emoji:'🧴' },
    { id:'brush', label:'แปรงให้ทั่วปาก', desc:'แปรงฟันด้านนอก ด้านใน และด้านเคี้ยว', emoji:'😁' },
    { id:'rinse', label:'บ้วนปาก', desc:'บ้วนปากหลังแปรงเสร็จ', emoji:'💧' },
    { id:'sleep', label:'นอนเลยโดยไม่แปรง', desc:'ข้ามการแปรงฟันแล้วไปนอนทันที', emoji:'😴' },
    { id:'candy', label:'กินลูกอมก่อน', desc:'เริ่มกินหวานก่อนโดยไม่แปรงฟัน', emoji:'🍬' },
    { id:'phone', label:'เล่นมือถือก่อน', desc:'วางแปรงไว้แล้วไปเล่นต่อ', emoji:'📱' }
  ];

  return mountSequenceWarmup({
    container,
    api,
    ctx,
    config: {
      rng,
      rootClass: 'brush',
      title: 'Warmup — Brush Quick Prep',
      subtitle: 'เลือก 3 ขั้นเริ่มต้นของการแปรงฟันให้ถูกตามลำดับ ภายใน 20 วินาที',
      startLabel: 'เริ่มเตรียมแปรงฟัน',
      timeLimit: 20,
      stepPool: STEP_POOL,
      targetIds: ['pick','paste','brush'],
      renderShell: ({ title, subtitle, startLabel }) => `
        <div class="brush-layer">
          <div class="brush-brief" data-role="brief">
            <div class="brush-brief-card">
              <h2 class="brush-brief-title">${title}</h2>
              <p class="brush-brief-sub">${subtitle}</p>
              <button class="btn btn-primary" data-role="start">${startLabel}</button>
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
                <div class="brush-progress" data-role="steps"></div>
              </div>

              <div class="brush-card">
                <div class="brush-card-title">ตัวเลือก</div>
                <div class="brush-card-sub">เลือกขั้นตอนที่ถูกต้องทีละข้อ</div>
                <div class="brush-choice-list" data-role="choices"></div>
              </div>
            </div>
          </div>
        </div>
      `,
      getChoiceClass: ()=> 'brush-choice',
      getDoneRowClass: (done)=> `brush-step ${done ? 'done' : ''}`,
      onCorrectToast: (n)=> `ถูกต้อง! ขั้นที่ ${n}`,
      onWrongToast: ()=> 'ยังไม่ใช่ขั้นตอนถัดไป',
      finishTitleSuccess: 'พร้อมแปรงฟันแล้ว!',
      finishTitleTimeout: 'หมดเวลา',
      finishSubtitle: 'สรุปผล Warmup — Brush Quick Prep',
      finishLines: ({ state, acc, timeBonus })=>[
        `เรียงถูก ${state.currentIndex}/3 ขั้น`,
        `คะแนน ${state.score}`,
        `พลาด ${state.miss}`,
        `ความแม่นยำ ${acc}%`,
        `โบนัสเวลา +${timeBonus} วินาที`
      ],
      buildBuffs: ({ state, acc, timeBonus, scoreBonus, rank })=>({
        wType: 'brush_quick_prep',
        wPct: acc,
        wSteps: state.currentIndex,
        wTimeBonus: timeBonus,
        wScoreBonus: scoreBonus,
        wRank: rank
      })
    }
  });
}
