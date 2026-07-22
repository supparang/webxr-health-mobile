# Game Integration Contract

แต่ละเกมควรกลับมายัง Platform ด้วยข้อมูลขั้นต่ำ:

```js
window.parent.postMessage({
  type: "HEROHEALTH_GAME_COMPLETE",
  payload: {
    studentId: "050101",
    section: "P5-1",
    zone: "hygiene",
    gameId: "handwash",
    passed: true,
    score: 88,
    accuracy: 91,
    usedTimeSec: 184,
    eventId: crypto.randomUUID(),
    clientTs: new Date().toISOString(),
    version: "..."
  }
}, location.origin);
```

Platform ต้องตรวจ:
- origin
- schema
- student identity
- duplicate eventId
- gameId อยู่ใน Zone ที่เปิด
- backend acknowledgement ก่อนถือว่าผ่านอย่างเป็นทางการ
