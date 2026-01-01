/* === /herohealth/vr-groups/patterns-groups.js ===
GroupsVR Pattern Generator (seeded)
- Provides deterministic spawn positions in % (x,y)
- Modes: grid9, lanesV, lanesH, ring8, spiral, wave
- Safe margins avoid HUD/power by default (can override)
*/
(function(root){
  'use strict';

  function xmur3(str){
    str = String(str||'seed');
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return h >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeRng(seed){
    const g = xmur3(seed);
    return sfc32(g(), g(), g(), g());
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function dist2(a,b){
    const dx = a.x-b.x, dy=a.y-b.y;
    return dx*dx + dy*dy;
  }

  function makePatternGen(opts){
    opts = opts || {};
    const rng = opts.rng || makeRng(String(opts.seed||'seed') + '::groups::patterns');
    const safe = Object.assign({
      // % margins (avoid HUD top + power bottom + edges)
      left: 10, right: 10,
      top:  20, bottom: 14
    }, opts.safe||{});

    const S = {
      mode: String(opts.mode||'mix'),
      step: 0,
      ringI: 0,
      waveT: 0,
      spiralA: 0,
      last: []
    };

    function pick(arr){ return arr[(arr.length*rng())|0]; }

    function randXY(){
      const x = safe.left + rng() * (100 - safe.left - safe.right);
      const y = safe.top  + rng() * (100 - safe.top  - safe.bottom);
      return {x,y};
    }

    function grid9(){
      // 3x3 centers in safe box
      const xs = [
        safe.left + (100-safe.left-safe.right)*0.2,
        safe.left + (100-safe.left-safe.right)*0.5,
        safe.left + (100-safe.left-safe.right)*0.8,
      ];
      const ys = [
        safe.top + (100-safe.top-safe.bottom)*0.2,
        safe.top + (100-safe.top-safe.bottom)*0.5,
        safe.top + (100-safe.top-safe.bottom)*0.8,
      ];
      const x = pick(xs), y = pick(ys);
      return {x,y};
    }

    function lanesV(){
      const w = (100-safe.left-safe.right);
      const xs = [
        safe.left + w*0.25,
        safe.left + w*0.50,
        safe.left + w*0.75
      ];
      const x = pick(xs);
      const y = safe.top + rng() * (100-safe.top-safe.bottom);
      return {x,y};
    }

    function lanesH(){
      const h = (100-safe.top-safe.bottom);
      const ys = [
        safe.top + h*0.25,
        safe.top + h*0.50,
        safe.top + h*0.75
      ];
      const y = pick(ys);
      const x = safe.left + rng() * (100-safe.left-safe.right);
      return {x,y};
    }

    function ring8(){
      const cx = 50, cy = 50;
      const rx = (100 - safe.left - safe.right)*0.35;
      const ry = (100 - safe.top  - safe.bottom)*0.33;
      const k = S.ringI++ % 8;
      const ang = (Math.PI*2)*(k/8);
      const x = clamp(cx + Math.cos(ang)*rx, safe.left, 100-safe.right);
      const y = clamp(cy + Math.sin(ang)*ry, safe.top, 100-safe.bottom);
      return {x,y};
    }

    function spiral(){
      // outward spiral
      const cx=50, cy=50;
      S.spiralA += 0.62;
      const r = 6 + (S.step%18)*2.2;
      const x = clamp(cx + Math.cos(S.spiralA)*r, safe.left, 100-safe.right);
      const y = clamp(cy + Math.sin(S.spiralA)*r, safe.top, 100-safe.bottom);
      return {x,y};
    }

    function wave(){
      // horizontal wave sweep
      S.waveT += 0.15;
      const x = safe.left + (100-safe.left-safe.right) * ((Math.sin(S.waveT)+1)/2);
      const y = safe.top + rng() * (100-safe.top-safe.bottom);
      return {x,y};
    }

    function next(mode){
      mode = String(mode || S.mode || 'mix');
      let m = mode;

      if (m === 'mix'){
        // cycle a bit for feel
        const cycle = ['grid9','lanesV','lanesH','ring8','wave','spiral'];
        m = cycle[(S.step/6|0) % cycle.length];
      }else if (m === 'feel'){
        m = pick(['wave','ring8','lanesV']);
      }else if (m === 'hard'){
        m = pick(['grid9','lanesH','spiral']);
      }

      let p =
        (m==='grid9')  ? grid9()  :
        (m==='lanesV') ? lanesV() :
        (m==='lanesH') ? lanesH() :
        (m==='ring8')  ? ring8()  :
        (m==='spiral') ? spiral() :
        (m==='wave')   ? wave()   :
                         randXY();

      S.step++;

      // avoid too-close repeats
      const minD2 = 7.5*7.5; // in % space
      for (let tries=0; tries<6; tries++){
        let ok = true;
        for (let i=0;i<S.last.length;i++){
          if (dist2(p, S.last[i]) < minD2){ ok=false; break; }
        }
        if (ok) break;
        p = randXY();
      }
      S.last.unshift(p);
      S.last = S.last.slice(0,6);
      return p;
    }

    return { next, rng };
  }

  root.GroupsVR = root.GroupsVR || {};
  root.GroupsVR.Patterns = { makePatternGen };

})(typeof window!=='undefined'?window:globalThis);