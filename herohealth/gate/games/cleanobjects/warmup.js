import { loadCssOnce } from '../../helpers/css.js';
import { mulberry32 } from '../../helpers/rng.js';
import { mountSequenceWarmup } from '../../helpers/sequence-warmup.js';

export function loadStyle(){
  loadCssOnce('./gate/games/cleanobjects/style.css?v=20260308a');
}

export async function mount(container, ctx, api){
  const rng = mulberry32(ctx.seed || Date.now());

  const STEP_POOL = [
    { id:'desk_dirty', label:'โต๊ะมีคราบเปื้อน', desc:'โต๊ะที่ใช้งานแล้วมีคราบควรเช็ดทำความสะอาด', emoji:'🪑' },
    { id:'toy_dirty', label:'ของเล่นตกพื้นสกปรก', desc:'ของเล่นที่เปื้อนควรเช็ดก่อนใช้อีกครั้ง', emoji:'🧸' },
    { id:'bottle_dirty', label:'ขวดน้ำมีคราบด้านนอก', desc:'ของใช้ที่จับบ่อยควรเช็ดเมื่อสกปรก', emoji:'🍼' },
    { id:'soap_clean', label:'สบู่สะอาดพร้อมใช้', desc:'อันนี้เป็นของสะอาด ไม่ใช่เป้าหมายให้เช็ดตอนนี้', emoji:'🧼' },
    { id:'toothbrush_clean', label:'แปรงสีฟันสะอาด', desc:'เก็บถูกที่และสะอาดอยู่แล้ว', emoji:'🪥' },
    { id:'towel_clean', label:'ผ้าสะอาดพับไว้', desc:'ยังไม่ใช่ของที่ต้องรีบทำความสะอาด', emoji:'🧻' },
    { id:'bubble_clean', label:'ฟองสะอาด', desc:'แปลว่าสะอาด ไม่ใช่ของสกปรก', emoji:'🫧' }
  ];

  return mountSequenceWarmup({
    container,
    api,
    ctx,
    config: {
      rng,
      rootClass: 'clean',
      title: 'Warmup — Clean Objects Quick Check',
      subtitle: 'เลือกวัตถุที่ควรทำความสะอาดให้ถูก 3 อย่าง ภายใน 20 วินาที',
      startLabel: 'เริ่มตรวจวัตถุ',
      timeLimit: 20,
      stepPool: STEP_POOL,
      targetIds: ['desk_dirty','toy_dirty','bottle_dirty'],
      renderShell: ({ title, subtitle, startLabel }) => `
        <div class="clean-layer">
          <div class="clean-brief" data-role="brief">
            <div class="clean-brief-card">
              <h2 class="clean-brief-title">${title}</h2>
              <p class="clean-brief-sub">${subtitle}</p>
              <button class="btn btn-primary" data-role="start">${startLabel}</button>
            </div>
          </div>

          <div class="clean-playfield">
            <div class="clean-scene" aria-hidden="true">
              <div class="clean-deco.bucket">🪣</div>
              <div class="clean-deco.sponge">🧽</div>
              <div class="clean-deco.room">🏠</div>
            </div>

            <div class="clean-board">
              <div class="clean-card">
                <div class="clean-card-title">สิ่งที่ต้องตัดสินใจ</div>
                <div class="clean-card-sub">แตะตัวเลือกที่ “ควรทำความสะอาด” ให้ครบ 3 อย่าง</div>
                <div class="clean-progress" data-role="steps"></div>
              </div>

              <div class="clean-card">
                <div class="clean-card-title">ตัวเลือก</div>
                <div class="clean-card-sub">เลือกวัตถุที่สกปรกหรือมีคราบ</div>
                <div class="clean-choice-list" data-role="choices"></div>
              </div>
            </div>
          </div>
        </div>
      `,
      getChoiceClass: ()=> 'clean-choice',
      getDoneRowClass: (done)=> `clean-row ${done ? 'done' : ''}`,
      onCorrectToast: (n)=> `ถูกต้อง! เลือกครบ ${n}`,
      onWrongToast: ()=> 'อันนี้ยังไม่ใช่เป้าหมายที่ต้องทำความสะอาด',
      finishTitleSuccess: 'พร้อมทำความสะอาดแล้ว!',
      finishTitleTimeout: 'หมดเวลา',
      finishSubtitle: 'สรุปผล Warmup — Clean Objects Quick Check',
      finishLines: ({ state, acc, timeBonus })=>[
        `เลือกถูก ${state.currentIndex}/3 อย่าง`,
        `คะแนน ${state.score}`,
        `พลาด ${state.miss}`,
        `ความแม่นยำ ${acc}%`,
        `โบนัสเวลา +${timeBonus} วินาที`
      ],
      buildBuffs: ({ state, acc, timeBonus, scoreBonus, rank })=>({
        wType: 'cleanobjects_quick_check',
        wPct: acc,
        wSteps: state.currentIndex,
        wTimeBonus: timeBonus,
        wScoreBonus: scoreBonus,
        wRank: rank
      })
    }
  });
}
