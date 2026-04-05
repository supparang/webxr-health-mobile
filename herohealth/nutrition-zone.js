import { createZoneLauncher } from './zone-launcher-core.js';

createZoneLauncher({
  zoneId: 'nutrition',
  zoneTitle: 'Nutrition Zone',
  zoneLabel: 'Nutrition Zone',
  storageKey: 'HH_NUTRITION_LAST_GAME_V1',
  emptySearchText: 'ไม่พบเกมที่ตรงคำค้น ลองพิมพ์ goodjunk, groups, plate หรือ hydration',
  games: [
    {
      id: 'goodjunk',
      title: 'GoodJunk',
      subtitle: 'แยกอาหารดีและอาหารควรกินน้อยให้ถูกต้อง',
      icon: '🍎',
      color: 'c-green',
      tags: ['goodjunk', 'food', 'healthy choice'],
      launcherPath: './goodjunk-launcher.html'
    },
    {
      id: 'groups',
      title: 'Food Groups',
      subtitle: 'เรียนรู้หมวดอาหารหลัก 5 หมู่ผ่านเกมสนุก',
      icon: '🍱',
      color: 'c-orange',
      tags: ['groups', '5 food groups', 'nutrition'],
      launcherPath: './groups-vr.html'
    },
    {
      id: 'plate',
      title: 'Balanced Plate',
      subtitle: 'จัดจานอาหารให้สมดุลและเหมาะกับสุขภาพ',
      icon: '🍽️',
      color: 'c-purple',
      tags: ['plate', 'balanced plate', 'meal'],
      launcherPath: './plate-vr.html'
    },
    {
      id: 'hydration',
      title: 'Hydration',
      subtitle: 'ดื่มน้ำให้เหมาะสมและเรียนรู้พฤติกรรมการดื่มน้ำ',
      icon: '💧',
      color: 'c-blue',
      tags: ['hydration', 'water', 'drink'],
      launcherPath: './hydration-v2.html'
    }
  ]
});