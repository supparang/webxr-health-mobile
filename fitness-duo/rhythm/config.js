// Rhythm Tuning — Day3–5 Ready + Start Offset
window.RHYTHM_CFG = {
  bpm: 108,
  duration: 60,
  sectionBeats: 8,

  hitWindowMs: { perfect: 55, good: 110 },
  tightenPer6ComboMs: 4,

  feverEveryCombo: 8,
  feverSecs: 6,

  holdEnable: true,
  dodgeEnable: true,
  finisherSecs: 10,
  finisherMultiplier: 2.0,

  tutorialSecs: 10,
  showLegend: true,
  showSectionBanners: true,

  calibrationOffsetMs: 0,

  // ✅ ใหม่: ดีเลย์เริ่มเพลงเพื่อให้โน้ตวิ่งมาจากไกล ๆ ก่อน
  startOffsetSec: 1.6,

  PRESET: {
    easy:   { duration: 55, hitWindowMs:{perfect:70, good:130}, feverEveryCombo:7 },
    normal: { duration: 60, hitWindowMs:{perfect:55, good:110}, feverEveryCombo:8 },
    hard:   { duration: 70, hitWindowMs:{perfect:45, good:90},  feverEveryCombo:10 }
  },
  allowURLPreset: true
};

// ตัวอย่าง BeatMap (คงเดิมได้)
window.RHYTHM_BEATMAP = {
  songId: "duo_intro",
  bpm: 108,
  bars: [
    { barIndex:0, theme:"circle_blue",
      notes:[ {t:0.0,lane:0},{t:0.5,lane:1},{t:1.0,lane:2},{t:1.5,lane:1} ] },
    { barIndex:1, theme:"square_pink",
      notes:[ {t:2.0,lane:0},{t:2.5,lane:0,hold:1.0},{t:3.5,lane:2} ] },
    { barIndex:2, theme:"triangle_green",
      notes:[ {t:4.0,lane:1},{t:4.25,lane:2},{t:4.5,lane:1},{t:4.75,lane:0, dodge:true} ] },
    { barIndex:3, theme:"circle_blue", event:"fever_seed", notes:[] }
  ]
};
