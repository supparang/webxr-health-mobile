// Rhythm Tuning + ตัวอย่าง BeatMap สั้น ๆ
window.RHYTHM_CFG = {
  bpm: 108,
  sectionBeats: 8,
  duration: 60,
  hitWindowMs: { perfect: 55, good: 110 },
  tightenPer6ComboMs: 4,
  feverEveryCombo: 8,
  feverSecs: 6
};

// ตัวอย่าง beatmap เริ่มต้น (เล่นได้เลย)
window.RHYTHM_BEATMAP = {
  songId: "duo_intro",
  bpm: 108,
  bars: [
    { barIndex:0, theme:"circle_blue",
      notes:[ {t:0.0,lane:0},{t:0.5,lane:1},{t:1.0,lane:2},{t:1.5,lane:1} ] },
    { barIndex:1, theme:"square_pink",
      notes:[ {t:2.0,lane:0},{t:2.5,lane:0,hold:1.0},{t:3.5,lane:2} ] },
    { barIndex:2, theme:"triangle_green",
      notes:[ {t:4.0,lane:1},{t:4.25,lane:2},{t:4.5,lane:1},{t:4.75,lane:0} ] },
    { barIndex:3, theme:"circle_blue", event:"fever_seed", notes:[] }
  ]
};
