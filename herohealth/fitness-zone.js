import { createZoneLauncher } from './zone-launcher-core.js';

createZoneLauncher({
  zoneId: 'fitness',
  zoneTitle: 'Fitness Zone',
  zoneLabel: 'Fitness Zone',
  storageKey: 'HH_FITNESS_LAST_GAME_V1',
  emptySearchText: 'ไม่พบเกมที่ตรงคำค้น ลองพิมพ์ shadow, rhythm, jump, balance หรือ planner',
  games: [
    {
      id: 'shadow-breaker',
      title: 'Shadow Breaker',
      subtitle: 'ขยับร่างกายตามเป้าหมายและเอาชนะเงาพลังงาน',
      icon: '🥊',
      color: 'c-purple',
      tags: ['shadow', 'breaker', 'fitness'],
      launcherPath: './shadow-breaker-vr.html'
    },
    {
      id: 'rhythm-boxer',
      title: 'Rhythm Boxer',
      subtitle: 'ต่อยมวยตามจังหวะเพลง สนุกและได้ออกแรง',
      icon: '🥁',
      color: 'c-orange',
      tags: ['rhythm', 'boxer', 'music'],
      launcherPath: './rhythm-boxer-vr.html'
    },
    {
      id: 'jump-duck',
      title: 'Jump & Duck',
      subtitle: 'กระโดดและก้มหลบสิ่งกีดขวางให้ทัน',
      icon: '🐤',
      color: 'c-green',
      tags: ['jump', 'duck', 'movement'],
      launcherPath: './jump-duck-vr.html'
    },
    {
      id: 'balance-hold',
      title: 'Balance Hold',
      subtitle: 'ฝึกการทรงตัวและการควบคุมร่างกาย',
      icon: '🧘',
      color: 'c-blue',
      tags: ['balance', 'hold', 'control'],
      launcherPath: './balance-hold-vr.html'
    },
    {
      id: 'fitness-planner',
      title: 'Fitness Planner',
      subtitle: 'วางแผนกิจกรรมการออกกำลังกายอย่างสนุกและเข้าใจง่าย',
      icon: '📋',
      color: 'c-teal',
      tags: ['planner', 'fitness', 'plan'],
      launcherPath: './fitness-planner.html'
    }
  ]
});