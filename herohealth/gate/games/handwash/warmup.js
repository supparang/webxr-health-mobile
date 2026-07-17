import { loadCssOnce } from '../../helpers/css.js';
import { mulberry32 } from '../../helpers/rng.js';
import { mountSequenceWarmup } from '../../helpers/sequence-warmup.js';

export function loadStyle(){
  loadCssOnce('./gate/games/handwash/style.css?v=20260717-warmup-r9');
  loadCssOnce('./gate/games/handwash/warmup-r9.css?v=20260717-warmup-r9');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  const STEP_POOL = [
    { id:'wet',  label:'ทำมือให้เปียก', desc:'เริ่มด้วยการทำให้มือเปียกด้วยน้ำสะอาด', emoji:'💧' },
    { id:'soap', label:'ใช้สบู่ให้ทั่วมือ', desc:'ใช้สบู่ในปริมาณเพียงพอให้ครอบคลุมทุกพื้นผิวมือ', emoji:'🧼' },
    { id:'palm', label:'ถูฝ่ามือ', desc:'เริ่มเทคนิค WHO ด้วยการถูฝ่ามือเข้าหากัน', emoji:'👐' },
    { id:'dry',  label:'เช็ดมือก่อนล้าง', desc:'เช็ดมือให้แห้งก่อนใส่สบู่', emoji:'🧻' },
    { id:'play', label:'ไปเล่นต่อเลย', desc:'ยังไม่ล้างมือก็ออกจากพื้นที่ทันที', emoji:'🏃' },
    { id:'eat',  label:'หยิบขนมกินก่อน', desc:'ข้ามการล้างมือแล้วเริ่มกินทันที', emoji:'🍪' }
  ];

  return mountSequenceWarmup({
    container,
    api,
    ctx,
    config: {
      rng,
      rootClass: 'hw',
      title: 'Warmup — Handwash WHO Quick Prep',
      subtitle: 'เลือก 3 ขั้นเริ่มต้นให้ถูกตามลำดับ ก่อนเข้าสู่ WHO Technique',
      startLabel: 'เริ่มทำ Warmup',
      timeLimit: 25,
      stepPool: STEP_POOL,
      targetIds: ['wet','soap','palm'],
      renderShell: ({ title, subtitle, startLabel }) => `
        <div class="handwash-layer">
          <div class="handwash-brief" data-role="brief">
            <div class="handwash-brief-card">
              <div style="font-size:48px;margin-bottom:6px">🧼</div>
              <h2 class="handwash-brief-title">${title}</h2>
              <p class="handwash-brief-sub">${subtitle}</p>
              <button class="btn handwash-start-btn" data-role="start" type="button">${startLabel}</button>
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
                  <div class="handwash-pill">ต้องทำครบก่อนเข้าเกมหลัก</div>
                </div>

                <div class="handwash-dropzone">
                  <div class="handwash-dropzone-title">ลำดับที่ต้องเรียง</div>
                  <div class="handwash-dropzone-sub">แตะตัวเลือกที่ถูกต้องให้ครบตามลำดับ</div>
                  <div class="handwash-slots" data-role="steps"></div>
                </div>
              </div>

              <div class="handwash-right">
                <div class="handwash-dropzone">
                  <div class="handwash-dropzone-title">ตัวเลือก</div>
                  <div class="handwash-dropzone-sub">เริ่มจากเปียกมือ → สบู่ → ถูฝ่ามือ</div>
                  <div class="handwash-choice-list" data-role="choices"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
      getChoiceClass: ()=> 'hw-choice',
      getDoneRowClass: (done)=> `hw-step-card ${done ? 'done' : ''}`,
      onCorrectToast: (n)=> `ถูกต้อง! ผ่านขั้นที่ ${n}`,
      onWrongToast: ()=> 'ยังไม่ใช่ขั้นตอนถัดไป ลองดูเหตุผลอีกครั้ง',
      finishTitleSuccess: 'Warmup สำเร็จ — พร้อมล้างมือแล้ว!',
      finishTitleTimeout: 'Warmup ยังไม่ครบ',
      finishSubtitle: 'ต้องเรียงขั้นให้ครบก่อนเข้าสู่ Handwash WHO Technique',
      finishLines: ({ state, acc, timeBonus })=>[
        `เรียงถูก ${state.currentIndex}/3 ขั้น`,
        `คะแนน ${state.score}`,
        `พลาด ${state.miss}`,
        `ความแม่นยำ ${acc}%`,
        `โบนัสเวลา +${timeBonus} วินาที`
      ],
      buildBuffs: ({ state, acc, timeBonus, scoreBonus, rank })=>({
        wType: 'handwash_who_quick_prep',
        wPct: acc,
        wSteps: state.currentIndex,
        wTimeBonus: timeBonus,
        wScoreBonus: scoreBonus,
        wRank: rank
      })
    }
  });
}
