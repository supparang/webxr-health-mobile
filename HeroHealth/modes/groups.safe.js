// === modes/groups.safe.js (production) ===
import { boot as buildMode } from '../vr/mode-factory.js';

// แบ่งหมวดอาหารหลัก ๆ
var GROUPS = {
  veg : ['🥦','🥕','🌽','🍅','🥒','🥬','🧄','🧅','🍆','🍄'],
  fruit: ['🍎','🍓','🍇','🍌','🍍','🍐','🍉','🥝','🍑','🍊','🫐'],
  protein: ['🍗','🥚','🥩','🐟','🧀','🥜','🍤'],
  grain: ['🍞','🥖','🥯','🍚','🍙','🍝','🍜'],
  dairy: ['🥛','🧈','🧀','🍦']
};
var BAD = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭'];

function inArr(ch, arr){ for(var i=0;i<arr.length;i++){ if(arr[i]===ch) return true; } return false; }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

export async function boot(cfg){
  cfg = cfg || {};

  // เป้าหมวดหมุนเวียน: veg → protein → grain → fruit → dairy …
  var order = ['veg','protein','grain','fruit','dairy'];
  var idx=0, target = order[idx];

  function questText(){
    return 'เลือกตามหมวด: ' + target.toUpperCase() + ' (แต้มพิเศษคอมโบ)';
  }
  try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:questText()}})); }catch(e){}

  var ALL_GOOD = [].concat(GROUPS.veg, GROUPS.fruit, GROUPS.protein, GROUPS.grain, GROUPS.dairy);

  var api = await buildMode({
    host: cfg.host,
    difficulty: cfg.difficulty,
    duration: cfg.duration,
    pools: { good: ALL_GOOD, bad: BAD },
    goodRate: 0.75,
    goal: 9999,
    judge: function(char, ctx){
      // ดีแค่ไหน ขึ้นกับว่าตรงหมวดเป้าหมายหรือไม่
      var isGood = inArr(char, ALL_GOOD);
      if(!isGood) return { good:false, scoreDelta:-6 };

      var hitTarget = inArr(char, GROUPS[target]);
      var delta = hitTarget ? 15 : 8; // ตรงหมวดได้แต้มมากกว่า
      // ถ้าตรงหมวด 6 ครั้งติด → สลับหมวด
      if(hitTarget){ if((ctx && ctx.combo % 6)===5){ idx=(idx+1)%order.length; target=order[idx];
        try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:questText()}})); }catch(e){} } }
      return { good:true, scoreDelta:delta };
    }
  });

  return {
    stop: function(){ api && api.stop && api.stop(); },
    pause: function(){ api && api.pause && api.pause(); },
    resume: function(){ api && api.resume && api.resume(); }
  };
}

export default { boot };