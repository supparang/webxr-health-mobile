import { loadCssOnce } from '../../helpers/css.js';
import { mulberry32 } from '../../helpers/rng.js';
import { mountSequenceWarmup } from '../../helpers/sequence-warmup.js';

export function loadStyle(){
  loadCssOnce('./gate/games/handwash/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  const STEP_POOL = [
    { id:'wet',  label:'ทำมือให้เปียก', desc:'เริ่มด้วยการทำให้มือเปียกด้วยน้ำสะอาด', emoji:'💧' },
    { id:'soap', label:'ฟอกสบู่', desc:'กดสบู่หรือถูสบู่ให้ทั่วมือ', emoji:'🧼' },
    { id:'rub',  label:'ถูมือ', desc:'ถูฝ่ามือ หลังมือ ซอกนิ้ว และรอบนิ้วโป้ง', emoji:'🫲' },
    { id:'rinse',label:'ล้างน้ำออก', desc:'ล้างฟองและคราบสบู่ออกด้วยน้ำสะอาด', emoji:'🚿' },
    { id:'dry',  label:'เช็ดมือให้แห้ง', desc:'ใช้ผ้าสะอาดหรือกระดาษเช็ดมือ', emoji:'🧻' },
    { id:'play', label:'ไปเล่นต่อเลย', desc:'ยังไม่ล้างมือก็วิ่งออกจากห้องน้ำ', emoji:'🏃' },
    { id:'eat',  label:'หยิบขนมกินก่อน', desc:'ข้ามการล้างมือแล้วเริ่มกินทันที', emoji:'🍪' }
  ];

  return mountSequenceWarmup({
    container,
    api,
    ctx,
    config: {
      rng,
      rootClass: 'hw',
      title: 'Warmup — Handwash Quick Prep',
      subtitle: 'เลือก 3 ขั้นเริ่มต้นของการล้างมือให้ถูกตามลำดับ ภายใน 20 วินาที',
      startLabel: 'เริ่มเตรียมล้างมือ',
      timeLimit: 20,
      stepPool: STEP_POOL,
      targetIds: ['wet','soap','rub'],
      renderShell: ({ title, subtitle, startLabel }) => `
        <div class="handwash-layer">
          <div class="handwash-brief" data-role="brief">
            <div class="handwash-brief-card">
              <h2 class="handwash-brief-title">${title}</h2>
              <p class="handwash-brief-sub">${subtitle}</p>
              <button class="btn btn-primary" data-role="start">${startLabel}</button>
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
                  <div class="handwash-slots" data-role="steps"></div>
                </div>
              </div>

              <div class="handwash-right">
                <div class="handwash-dropzone">
                  <div class="handwash-dropzone-title">ตัวเลือก</div>
                  <div class="handwash-dropzone-sub">เลือกขั้นตอนที่ถูกต้องทีละข้อ</div>
                  <div class="handwash-choice-list" data-role="choices"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
      getChoiceClass: ()=> 'hw-choice',
      getDoneRowClass: (done)=> `hw-step-card ${done ? 'done' : ''}`,
      onCorrectToast: (n)=> `ถูกต้อง! ขั้นที่ ${n}`,
      onWrongToast: ()=> 'ยังไม่ใช่ขั้นตอนถัดไป',
      finishTitleSuccess: 'พร้อมล้างมือแล้ว!',
      finishTitleTimeout: 'หมดเวลา',
      finishSubtitle: 'สรุปผล Warmup — Handwash Quick Prep',
      finishLines: ({ state, acc, timeBonus })=>[
        `เรียงถูก ${state.currentIndex}/3 ขั้น`,
        `คะแนน ${state.score}`,
        `พลาด ${state.miss}`,
        `ความแม่นยำ ${acc}%`,
        `โบนัสเวลา +${timeBonus} วินาที`
      ],
      buildBuffs: ({ state, acc, timeBonus, scoreBonus, rank })=>({
        wType: 'handwash_quick_prep',
        wPct: acc,
        wSteps: state.currentIndex,
        wTimeBonus: timeBonus,
        wScoreBonus: scoreBonus,
        wRank: rank
      })
    }
  });
}
