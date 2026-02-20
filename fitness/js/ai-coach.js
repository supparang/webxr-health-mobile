// === /fitness/js/ai-coach.js ===
// AI Coach (explainable micro-tips), deterministic & rate-limited

'use strict';

function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

function fnv1a32(str){
  let h = 0x811c9dc5;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = (h + ((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))) >>> 0;
  }
  return h >>> 0;
}
function makeRng(seedStr){
  let x = fnv1a32(seedStr) || 2463534242;
  return function(){
    x ^= x<<13; x >>>= 0;
    x ^= x>>17; x >>>= 0;
    x ^= x<<5;  x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

export function createAICoach(opts){
  const o = Object.assign({
    seed:'0',
    pid:'anon',
    game:'unknown',
    cooldownMs: 14000,   // 14s
    windowN: 18,
    // thresholds tuned for ป.5
    hiMiss: 0.55,
    hiMissHard: 0.75,
    fastRt: 260,
    slowRt: 1000
  }, opts||{});

  const rng = makeRng(`${o.seed}|${o.pid}|${o.game}|coach`);
  let hist = []; // {type:'hit/miss', rt, meta}
  let lastTipAt = -1e18;
  let lastTipId = '';

  function push(ev){
    if(!ev || (ev.type!=='hit' && ev.type!=='miss')) return;
    hist.push({
      type: ev.type,
      rt: (typeof ev.rt==='number' && isFinite(ev.rt)) ? ev.rt : null,
      meta: ev.meta || null
    });
    if(hist.length > o.windowN) hist.shift();
  }

  function stats(){
    const acts = hist.length;
    if(!acts) return null;
    const hits = hist.filter(x=>x.type==='hit').length;
    const miss = acts - hits;
    const missRate = miss/acts;

    const rts = hist.map(x=>x.rt).filter(x=>x!=null);
    const rtMean = rts.length ? rts.reduce((a,b)=>a+b,0)/rts.length : null;

    return { acts, hits, miss, missRate, rtMean };
  }

  // deterministic choose from candidates
  function choose(cands){
    if(!cands.length) return null;
    // bias away from repeating same tip
    const filtered = cands.filter(c=>c.tipId !== lastTipId);
    const list = filtered.length ? filtered : cands;
    const idx = Math.floor(rng() * list.length);
    return list[idx];
  }

  function maybeTip(nowMs){
    if(nowMs - lastTipAt < o.cooldownMs) return null;
    const s = stats();
    if(!s || s.acts < 8) return null;

    const cands = [];

    // generic rules
    if(s.missRate >= o.hiMissHard){
      cands.push({
        tipId:'AIM_SLOW',
        text:'ลอง “เล็งค้าง” 0.3 วินาที แล้วค่อยแตะ จะโดนง่ายขึ้น',
        reason:{ missRate:s.missRate }
      });
      cands.push({
        tipId:'FOCUS_ONE',
        text:'เลือก “เป้าทีละอัน” อย่ากดรัว ๆ จะพลาดน้อยลง',
        reason:{ missRate:s.missRate }
      });
    } else if(s.missRate >= o.hiMiss){
      cands.push({
        tipId:'STEADY_HAND',
        text:'ค่อย ๆ แตะให้แม่นก่อน ความเร็วค่อยเพิ่มทีหลัง',
        reason:{ missRate:s.missRate }
      });
    }

    if(s.rtMean != null && s.rtMean < o.fastRt && s.missRate > 0.35){
      cands.push({
        tipId:'TOO_FAST',
        text:'กดเร็วไปนิด ลองช้าลงอีกนิดแล้วเล็งก่อน',
        reason:{ rtMean:s.rtMean, missRate:s.missRate }
      });
    }
    if(s.rtMean != null && s.rtMean > o.slowRt && s.missRate < 0.25){
      cands.push({
        tipId:'SPEED_UP',
        text:'ทำได้ดี! ลองเร็วขึ้นอีกนิด เพื่อทำคะแนนเพิ่ม',
        reason:{ rtMean:s.rtMean, missRate:s.missRate }
      });
    }

    // game-specific hooks (meta)
    if(o.game === 'rhythm'){
      // expect meta.offset (ms) for hits
      const offs = hist.map(x=>x.meta?.offset).filter(v=>typeof v==='number' && isFinite(v));
      if(offs.length >= 6){
        const meanOff = offs.reduce((a,b)=>a+b,0)/offs.length;
        if(meanOff > 45){
          cands.push({
            tipId:'RHY_LATE',
            text:'คุณกด “ช้าไปนิด” ลองกดให้ใกล้เส้นมากขึ้น',
            reason:{ meanOffset: meanOff }
          });
        } else if(meanOff < -45){
          cands.push({
            tipId:'RHY_EARLY',
            text:'คุณกด “เร็วไปนิด” รออีกเสี้ยววินาทีแล้วค่อยกด',
            reason:{ meanOffset: meanOff }
          });
        }
      }
    }

    if(o.game === 'balance'){
      // expect meta.wobble from warn events? (เราจะ push warn แยกไม่ได้ใน coach)
      // แต่ถ้าคุณอยาก: ส่ง miss meta.reason='break' แล้ว coach จะเตือน
      const breaks = hist.filter(x=>x.type==='miss' && x.meta?.reason==='break').length;
      if(breaks >= 2){
        cands.push({
          tipId:'BAL_STEADY',
          text:'คุมตัวให้นิ่ง: มองจุดกลางจอ แล้วหายใจช้า ๆ',
          reason:{ breaks }
        });
      }
    }

    const pick = choose(cands);
    if(!pick) return null;

    lastTipAt = nowMs;
    lastTipId = pick.tipId;
    return pick;
  }

  return { push, maybeTip };
}