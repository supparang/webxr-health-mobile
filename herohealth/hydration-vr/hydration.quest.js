/**
   * คืน progress ตามประเภท
   * - 'goals' → แสดงทีละ 1 goal (ตัวที่กำลังทำอยู่)
   * - 'mini'  → แสดงทีละ 1 mini quest (ตัวที่กำลังทำอยู่)
   * พร้อม status ว่าผ่านไปแล้วกี่อันจากทั้งหมด
   */
  function singleActiveView(list, typeLabel) {
    if (!list || !list.length) return [];

    const total = list.length;
    const doneCount = list.filter(q => q._done).length;

    // quest ปัจจุบัน = ตัวแรกที่ยังไม่ done ถ้าผ่านหมดแล้วให้ใช้ตัวสุดท้าย
    let current = list.find(q => !q._done);
    if (!current) current = list[list.length - 1];
    if (!current) return [];

    const view = {
      id: current.id,
      target: current.target,
      prog: current._value,
      done: !!current._done,
      isMiss: !!current._isMiss
    };

    if (doneCount >= total && current._done) {
      // เคลียร์ครบชุดแล้ว
      view.label = `${typeLabel}: สำเร็จครบแล้ว (${doneCount}/${total}) 🎉`;
    } else {
      // ยังมีเควสต์ในชุดนี้อยู่
      const idx = doneCount + 1; // ลำดับเควสต์ปัจจุบัน
      view.label = `${idx}. ${current.label}  (ผ่านแล้ว ${doneCount}/${total})`;
    }

    return [view];
  }

  function getProgress(kind) {
    if (kind === 'goals') return singleActiveView(activeGoals, 'Goal');
    if (kind === 'mini')  return singleActiveView(activeMinis, 'Mini quest');

    // default: รวมทั้ง goal + mini แต่ก็ยังทีละอันต่อประเภท
    return [
      ...singleActiveView(activeGoals, 'Goal'),
      ...singleActiveView(activeMinis, 'Mini quest')
    ];
  }