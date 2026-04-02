export function createRewardEngine({
  storageKey = 'HHA_REWARDS_V1'
} = {}) {
  function defaultStore() {
    return {
      version: 1,
      unlockedBadgeIds: [],
      stickerCount: 0,
      lastRank: ''
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaultStore();
      const obj = JSON.parse(raw);
      return {
        ...defaultStore(),
        ...(obj || {}),
        unlockedBadgeIds: Array.isArray(obj?.unlockedBadgeIds) ? obj.unlockedBadgeIds : []
      };
    } catch {
      return defaultStore();
    }
  }

  function save(store) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(store));
    } catch {}
  }

  function computeOutcome({
    score = 0,
    timeoutCount = 0,
    perfectCount = 0,
    bestCombo = 1,
    store = defaultStore()
  } = {}) {
    const outStore = {
      ...defaultStore(),
      ...(store || {})
    };

    let rank = 'C';
    if (score >= 360 && timeoutCount === 0 && perfectCount >= 3) rank = 'S';
    else if (score >= 300) rank = 'A';
    else if (score >= 220) rank = 'B';

    const badgeDefs = [
      { id: 'first-clear', label: 'ผ่านด่านแรก', emoji: '🎉', when: () => true },
      { id: 'zero-timeout', label: 'ไม่หมดเวลาเลย', emoji: '⏱️', when: () => timeoutCount === 0 },
      { id: 'combo-5', label: 'คอมโบ 5+', emoji: '🔥', when: () => bestCombo >= 5 },
      { id: 'perfect-3', label: 'Perfect 3+', emoji: '✨', when: () => perfectCount >= 3 },
      { id: 'rank-s', label: 'แรงก์ S', emoji: '🏆', when: () => rank === 'S' }
    ];

    const unlocked = new Set(outStore.unlockedBadgeIds || []);
    const newly = [];

    badgeDefs.forEach(b => {
      if (b.when() && !unlocked.has(b.id)) {
        unlocked.add(b.id);
        newly.push(b);
      }
    });

    outStore.unlockedBadgeIds = Array.from(unlocked);
    outStore.lastRank = rank;
    outStore.stickerCount = Number(outStore.stickerCount || 0) + (rank === 'S' ? 3 : rank === 'A' ? 2 : 1);

    save(outStore);

    return {
      rank,
      stickerGain: rank === 'S' ? 3 : rank === 'A' ? 2 : 1,
      store: outStore,
      badges: badgeDefs.filter(b => unlocked.has(b.id)),
      newly
    };
  }

  return {
    load,
    save,
    computeOutcome,
    defaultStore
  };
}