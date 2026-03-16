// /herohealth/vr-brush/brush.config.js
// HOTFIX v20260316c-BRUSH-CONFIG-MATCH-6ZONES

export function createBrushConfig(qs){
  const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
  const num = (v,d)=>{
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  const CFG = {
    gameId: qs('gameId','brush'),
    run: qs('run','play'),
    diff: qs('diff','normal'),
    view: qs('view','pc'),
    pid: qs('pid',''),
    seed: qs('seed', String(Date.now())),
    studyId: qs('studyId',''),
    time: clamp(num(qs('time','90'), 90), 45, 180),
    cleanTarget: 85,
    bossHP: 120,
    uvCdMs: 6000,
    polishCdMs: 7000,
    bossPhases: [
      { phase:1, hp:55,  label:'คราบหนา' },
      { phase:2, hp:80,  label:'หินปูน' },
      { phase:3, hp:120, label:'บอสหินปูนใหญ่' }
    ]
  };

  const DIFF = {
    easy:   { stroke: 10, bossStroke: 14, missPenalty: 1, comboWindow: 1200, dirtTick: .00 },
    normal: { stroke:  8, bossStroke: 11, missPenalty: 2, comboWindow: 1000, dirtTick: .15 },
    hard:   { stroke:  7, bossStroke:  9, missPenalty: 3, comboWindow: 850,  dirtTick: .28 }
  }[CFG.diff] || {
    stroke: 8, bossStroke: 11, missPenalty: 2, comboWindow: 1000, dirtTick: .15
  };

  const MODES = {
    learn: {
      label: 'Learn',
      time: 9999,
      boss: false,
      uv: true,
      polish: true,
      missPenalty: 0,
      cleanTarget: 75
    },
    practice: {
      label: 'Practice',
      time: CFG.time,
      boss: true,
      uv: true,
      polish: true,
      missPenalty: DIFF.missPenalty,
      cleanTarget: CFG.cleanTarget
    },
    challenge: {
      label: 'Challenge',
      time: Math.max(45, Math.min(CFG.time, 75)),
      boss: true,
      uv: false,
      polish: false,
      missPenalty: DIFF.missPenalty + 1,
      cleanTarget: 90
    }
  };

  // canonical 6 zones — must match brush.ui / brush.coach / brush.input
  const ZONES = [
    {
      id:'upper_outer',
      label:'ฟันบนด้านนอก',
      x:18, y:20, w:64, h:14,
      dirtType:'normal',
      dir:'vertical'
    },
    {
      id:'upper_inner',
      label:'ฟันบนด้านใน',
      x:24, y:36, w:52, h:11,
      dirtType:'germ',
      dir:'vertical'
    },
    {
      id:'upper_chew',
      label:'ฟันบนด้านบดเคี้ยว',
      x:30, y:49, w:40, h:8,
      dirtType:'heavy',
      dir:'horizontal'
    },
    {
      id:'lower_outer',
      label:'ฟันล่างด้านนอก',
      x:18, y:66, w:64, h:14,
      dirtType:'normal',
      dir:'vertical'
    },
    {
      id:'lower_inner',
      label:'ฟันล่างด้านใน',
      x:24, y:54, w:52, h:11,
      dirtType:'germ',
      dir:'vertical'
    },
    {
      id:'lower_chew',
      label:'ฟันล่างด้านบดเคี้ยว',
      x:30, y:44, w:40, h:8,
      dirtType:'heavy',
      dir:'horizontal'
    }
  ];

  return { CFG, DIFF, MODES, ZONES };
}