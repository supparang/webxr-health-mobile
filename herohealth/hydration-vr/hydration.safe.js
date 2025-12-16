const playfield = document.getElementById('hvr-playfield');

const inst = await factoryBoot({
  difficulty: diff,
  duration: dur,
  modeKey: 'hydration',

  // ✅ เพิ่ม: ให้ engine รู้ว่าจะ spawn ใส่ที่ไหน
  spawnLayer: playfield || document.body,
  container: playfield || document.body,

  // ✅ เพิ่ม: กัน engine บางตัวที่ต้องมีค่าพวกนี้ถึงจะเริ่ม spawn
  spawnInterval: diff === 'easy' ? 1400 : diff === 'hard' ? 900 : 1100,
  maxActive: diff === 'easy' ? 3 : diff === 'hard' ? 6 : 4,

  pools: { good: [...GOOD, ...BONUS], bad: [...BAD] },
  goodRate: 0.60,
  powerups: BONUS,
  powerRate: 0.10,
  powerEvery: 7,
  spawnStyle: 'pop',
  judge: (ch, ctx) => judge(ch, ctx),
  onExpire
});