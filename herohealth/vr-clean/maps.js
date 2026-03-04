// === /herohealth/vr-clean/maps.js ===
// Clean Objects Maps — HOME + CLASSROOM (10 hotspots each)
// v20260304-MAPS-HOME-CLASSROOM
'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

// deterministic jitter helper (play only)
function makeRand(key){
  let r = 2166136261 >>> 0;
  const s = String(key||'0');
  for(let i=0;i<s.length;i++){
    r ^= s.charCodeAt(i);
    r = Math.imul(r, 16777619);
  }
  return ()=>((r = (Math.imul(r,1664525) + 1013904223) >>> 0) / 4294967296);
}

function applyJitter(hotspots, key, runMode){
  if(String(runMode||'play') === 'research') return; // research = no jitter
  const rand = makeRand(key);
  for(const h of hotspots){
    const j = (rand() - 0.5);
    // small, fair variation
    h.risk = clamp((h.risk||0) + j*10, 0, 100);               // +/-5
    h.timeLastCleanedMin = clamp((h.timeLastCleanedMin||0) + j*180, 0, 2000);
    // traffic/touch tiny wiggle
    h.traffic = clamp((h.traffic||0) + j*0.10, 0, 1);
    h.touchLevel = clamp((h.touchLevel||0) + j*0.06, 0, 1);
  }
}

export function getMap(mapId, opts={}){
  const id = String(mapId||'home').toLowerCase();
  const seed = String(opts.seed||Date.now());
  const runMode = String(opts.runMode||'play');
  const key = String(opts.dailyKey || `MAP::${seed}::${id}`);

  // Common legend: x,y are grid coords (0..6)
  // zone tags: "wet", "shared", "entry", "rows", "front", "other"
  let map;

  if(id === 'classroom'){
    map = {
      id:'classroom',
      name:'Classroom',
      w:7, h:6,
      // optional: walls/obstacles later
      hotspots:[
        // ENTRY / FRONT
        { id:'door_knob',      name:'ลูกบิดประตู',        x:0, y:2, zone:'entry shared', risk:78, traffic:0.92, touchLevel:0.96, surfaceType:'metal',  timeLastCleanedMin:920 },
        { id:'light_switch',   name:'สวิตช์ไฟ',           x:1, y:1, zone:'entry',        risk:62, traffic:0.82, touchLevel:0.90, surfaceType:'plastic',timeLastCleanedMin:760 },
        { id:'teacher_desk',   name:'โต๊ะครู',            x:5, y:1, zone:'front',        risk:55, traffic:0.55, touchLevel:0.70, surfaceType:'wood',   timeLastCleanedMin:640 },

        // SHARED ITEMS (great for Shared boss)
        { id:'shared_tablets', name:'แท็บเล็ตส่วนกลาง',   x:3, y:2, zone:'shared',       risk:84, traffic:0.86, touchLevel:0.98, surfaceType:'glass',  timeLastCleanedMin:1100 },
        { id:'shared_scissors',name:'กรรไกรส่วนกลาง',     x:2, y:3, zone:'shared',       risk:72, traffic:0.72, touchLevel:0.90, surfaceType:'metal',  timeLastCleanedMin:830 },
        { id:'shared_mouse',   name:'เมาส์คอมฯ',          x:6, y:3, zone:'shared rows',  risk:76, traffic:0.78, touchLevel:0.94, surfaceType:'plastic',timeLastCleanedMin:970 },

        // ROWS / HIGH TRAFFIC
        { id:'desk_row_1',     name:'โต๊ะแถวหน้า',        x:4, y:2, zone:'rows',         risk:58, traffic:0.70, touchLevel:0.82, surfaceType:'wood',   timeLastCleanedMin:700 },
        { id:'desk_row_2',     name:'โต๊ะแถวกลาง',        x:4, y:3, zone:'rows',         risk:60, traffic:0.74, touchLevel:0.84, surfaceType:'wood',   timeLastCleanedMin:720 },
        { id:'desk_row_3',     name:'โต๊ะแถวหลัง',        x:4, y:4, zone:'rows',         risk:56, traffic:0.65, touchLevel:0.80, surfaceType:'wood',   timeLastCleanedMin:690 },

        // WET ZONE (Bathroom boss alt / wet challenge)
        { id:'water_faucet',   name:'ก๊อกน้ำล้างมือ',     x:6, y:1, zone:'wet',          risk:80, traffic:0.88, touchLevel:0.92, surfaceType:'metal',  timeLastCleanedMin:980 }
      ]
    };
  } else {
    // HOME default
    map = {
      id:'home',
      name:'Home',
      w:7, h:6,
      hotspots:[
        // ENTRY
        { id:'home_door_knob', name:'ลูกบิดประตูบ้าน',    x:0, y:2, zone:'entry shared', risk:74, traffic:0.82, touchLevel:0.94, surfaceType:'metal',  timeLastCleanedMin:880 },
        { id:'shoe_rack',      name:'ชั้นวางรองเท้า',     x:1, y:3, zone:'entry',        risk:55, traffic:0.60, touchLevel:0.60, surfaceType:'wood',   timeLastCleanedMin:900 },

        // SHARED / LIVING
        { id:'remote_control', name:'รีโมททีวี',           x:3, y:3, zone:'shared',       risk:82, traffic:0.86, touchLevel:0.98, surfaceType:'plastic',timeLastCleanedMin:1200 },
        { id:'sofa_arm',       name:'พนักโซฟา',           x:2, y:4, zone:'shared',       risk:64, traffic:0.72, touchLevel:0.86, surfaceType:'fabric', timeLastCleanedMin:1000 },
        { id:'phone_charger',  name:'ที่ชาร์จมือถือ',      x:4, y:4, zone:'shared',       risk:70, traffic:0.78, touchLevel:0.90, surfaceType:'plastic',timeLastCleanedMin:950 },

        // KITCHEN
        { id:'fridge_handle',  name:'ที่จับตู้เย็น',       x:6, y:3, zone:'shared',       risk:76, traffic:0.82, touchLevel:0.92, surfaceType:'metal',  timeLastCleanedMin:980 },
        { id:'kitchen_counter',name:'เคาน์เตอร์ครัว',      x:5, y:4, zone:'other',        risk:58, traffic:0.60, touchLevel:0.70, surfaceType:'tile',   timeLastCleanedMin:820 },

        // WET (Bathroom Outbreak boss)
        { id:'bath_faucet',    name:'ก๊อกน้ำห้องน้ำ',      x:6, y:1, zone:'wet',          risk:84, traffic:0.80, touchLevel:0.92, surfaceType:'metal',  timeLastCleanedMin:1050 },
        { id:'toilet_flush',   name:'ที่กดชักโครก',        x:5, y:1, zone:'wet shared',   risk:88, traffic:0.78, touchLevel:0.98, surfaceType:'plastic',timeLastCleanedMin:1300 },
        { id:'bath_door_handle',name:'มือจับประตูห้องน้ำ', x:4, y:1, zone:'wet entry',    risk:80, traffic:0.75, touchLevel:0.94, surfaceType:'metal',  timeLastCleanedMin:990 }
      ]
    };
  }

  // Apply play-only jitter so daily feels fresh
  applyJitter(map.hotspots, key, runMode);
  return map;
}