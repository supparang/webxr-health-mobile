// === modes/plate.quest.js (production) ===
import { boot as buildMode } from '../vr/mode-factory.js';

var GROUPS = {
  veg : ['🥦','🥕','🌽','🍅','🥒','🥬','🍄'],
  fruit: ['🍎','🍓','🍇','🍌','🍍','🍐','🍉','🥝','🍑','🍊','🫐'],
  protein: ['🍗','🥚','🥩','🐟','🧀','🥜','🍤'],
  grain: ['🍞','🥖','🍚','🍙','🍝','🍜'],
  dairy: ['🥛','🧀','🍦']
};
var EXTRA_BAD = ['🍔','🍟','🍕','🍩','🥤','🧋'];

function inArr(ch, arr){ for(var i=0;i<arr.length;i++){ if(arr[i]===ch) return true; } return false; }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function makeRound(difficulty){
  // สัดส่วน 5 หมู่ — เปลี่ยนตามความยาก
  var base = {veg:2, fruit:1, protein:1, grain:1, dairy:1};
  if(difficulty==='easy'){ base.veg=2; base.fruit=1; base.protein=1; base.grain=1; base.dairy=0; }
  if(difficulty==='hard'){ base.veg=2; base.fruit=1; base.protein=2; base.grain=2; base.dairy=1; }
  return base;
}

export async function boot(cfg){
  cfg = cfg || {};
  var need = makeRound(String(cfg.difficulty||'normal')); // เป้าหมายรอบนี้
  var doneRound = 0;

  function leftText(){
    return 'Healthy Plate — เหลือ: '+
      'VEG '+need.veg+' | FRUIT '+need.fruit+' | PRO '+need.protein+' | GRAIN '+need.grain+' | DAIRY '+need.dairy+
      '  (รอบที่ '+(doneRound+1)+')';
  }
  try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:leftText()}})); }catch(e){}

  // รวมรายการสปอว์น
  var ALL = [].concat(GROUPS.veg, GROUPS.fruit, GROUPS.protein, GROUPS.grain, GROUPS.dairy, EXTRA_BAD);

  function isNeeded(ch){
    if(need.veg>0    && inArr(ch, GROUPS.veg)) return 'veg';
    if(need.fruit>0  && inArr(ch, GROUPS.fruit)) return 'fruit';
    if(need.protein>0&& inArr(ch, GROUPS.protein)) return 'protein';
    if(need.grain>0  && inArr(ch, GROUPS.grain)) return 'grain';
    if(need.dairy>0  && inArr(ch, GROUPS.dairy)) return 'dairy';
    return null;
  }

  function roundFinished(){
    // เริ่มรอบใหม่ เพิ่มความยากเล็กน้อย
    doneRound += 1;
    var d = String(cfg.difficulty||'normal');
    if(doneRound>=2 && d!=='hard'){ d='hard'; } // ขยับไปค่ากลาง/ยาก
    need = makeRound(d);
    try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:leftText()}})); }catch(e){}
  }

  var api = await buildMode({
    host: cfg.host,
    difficulty: