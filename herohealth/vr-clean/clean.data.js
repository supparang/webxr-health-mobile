// === /herohealth/vr-clean/clean.data.js ===
// Clean Objects DATA — v20260301-DATA-HOME+CLASSROOM

'use strict';

// Map is a simple grid layout (w x h)
export const MAPS = {
  home: { id:'home', w: 10, h: 8, label:'บ้าน' },
  classroom: { id:'classroom', w: 12, h: 8, label:'ห้องเรียน' }
};

// Hotspots: x,y are grid coords (0..w-1 / 0..h-1)
export const HOTSPOTS_BY_MAP = {
  home: [
    { id:'door_knob',     label:'D', name:'มือจับประตู',      x:1, y:2, risk:72, traffic:0.9, touchLevel:0.95, surfaceType:'metal', timeLastCleanedMin: 980, zone:'entry' },
    { id:'light_switch',  label:'S', name:'สวิตช์ไฟ',         x:2, y:2, risk:68, traffic:0.85,touchLevel:0.92, surfaceType:'plastic',timeLastCleanedMin: 760, zone:'entry' },
    { id:'table_top',     label:'T', name:'โต๊ะ',             x:5, y:4, risk:62, traffic:0.75,touchLevel:0.85, surfaceType:'wood',   timeLastCleanedMin: 640, zone:'living' },
    { id:'phone',         label:'P', name:'มือถือ',           x:6, y:5, risk:78, traffic:0.65,touchLevel:0.98, surfaceType:'glass',  timeLastCleanedMin: 320, zone:'living' },
    { id:'remote',        label:'R', name:'รีโมต',            x:7, y:4, risk:70, traffic:0.70,touchLevel:0.92, surfaceType:'plastic',timeLastCleanedMin: 520, zone:'living' },
    { id:'sink_faucet',   label:'F', name:'ก๊อกอ่างล้างมือ',  x:8, y:6, risk:74, traffic:0.80,touchLevel:0.90, surfaceType:'metal', timeLastCleanedMin: 840, zone:'wet' },
    { id:'toilet_flush',  label:'B', name:'ที่กดชักโครก',     x:9, y:7, risk:88, traffic:0.85,touchLevel:0.92, surfaceType:'plastic',timeLastCleanedMin: 1200,zone:'wet' },
    { id:'toilet_seat',   label:'W', name:'ฝารองนั่ง',        x:9, y:6, risk:80, traffic:0.75,touchLevel:0.80, surfaceType:'plastic',timeLastCleanedMin: 1200,zone:'wet' },
    { id:'fridge_handle', label:'H', name:'มือจับตู้เย็น',     x:3, y:5, risk:66, traffic:0.70,touchLevel:0.86, surfaceType:'metal', timeLastCleanedMin: 900, zone:'kitchen' },
    { id:'counter',       label:'C', name:'เคาน์เตอร์ครัว',    x:4, y:6, risk:58, traffic:0.60,touchLevel:0.70, surfaceType:'tile',  timeLastCleanedMin: 720, zone:'kitchen' },
  ],

  classroom: [
    { id:'door_knob',     label:'D', name:'มือจับประตูห้อง',   x:1, y:2, risk:78, traffic:0.95,touchLevel:0.95, surfaceType:'metal',  timeLastCleanedMin: 900, zone:'entry' },
    { id:'light_switch',  label:'S', name:'สวิตช์ไฟ',          x:2, y:2, risk:74, traffic:0.90,touchLevel:0.92, surfaceType:'plastic',timeLastCleanedMin: 780, zone:'entry' },

    { id:'teacher_desk',  label:'TD',name:'โต๊ะครู',            x:3, y:2, risk:66, traffic:0.70,touchLevel:0.78, surfaceType:'wood',   timeLastCleanedMin: 640, zone:'front' },
    { id:'whiteboard_marker',label:'M',name:'ปากกาบอร์ด',      x:4, y:2, risk:72, traffic:0.75,touchLevel:0.90, surfaceType:'plastic',timeLastCleanedMin: 520, zone:'front' },
    { id:'attendance_book',label:'AB',name:'สมุดเช็คชื่อ',      x:5, y:2, risk:70, traffic:0.72,touchLevel:0.88, surfaceType:'paper',  timeLastCleanedMin: 420, zone:'front' },

    { id:'student_table_1',label:'T1',name:'โต๊ะนักเรียน (แถวหน้า)', x:3, y:4, risk:64, traffic:0.85,touchLevel:0.82, surfaceType:'wood', timeLastCleanedMin: 600, zone:'rows' },
    { id:'student_table_2',label:'T2',name:'โต๊ะนักเรียน (แถวกลาง)', x:5, y:4, risk:62, traffic:0.88,touchLevel:0.80, surfaceType:'wood', timeLastCleanedMin: 610, zone:'rows' },
    { id:'shared_scissors',label:'SC',name:'กรรไกรส่วนรวม',      x:7, y:4, risk:76, traffic:0.86,touchLevel:0.92, surfaceType:'metal', timeLastCleanedMin: 900, zone:'shared' },
    { id:'shared_tablets', label:'TB',name:'แท็บเล็ตส่วนรวม',     x:8, y:4, risk:82, traffic:0.84,touchLevel:0.96, surfaceType:'glass', timeLastCleanedMin: 300, zone:'shared' },

    { id:'water_faucet',   label:'F', name:'ก๊อกน้ำ/ตู้กดน้ำ',    x:10,y:6, risk:78, traffic:0.92,touchLevel:0.90, surfaceType:'metal', timeLastCleanedMin: 840, zone:'wet' },
    { id:'toilet_flush',   label:'B', name:'ที่กดชักโครก (ห้องน้ำ)',x:11,y:7,risk:90, traffic:0.88,touchLevel:0.92, surfaceType:'plastic',timeLastCleanedMin: 1200,zone:'wet' },
  ]
};

// Backward compatible exports (default home)
export const MAP = MAPS.home;
export const HOTSPOTS = HOTSPOTS_BY_MAP.home;