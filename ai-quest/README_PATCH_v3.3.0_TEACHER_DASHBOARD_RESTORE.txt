CSAI2102 AI Quest — PATCH v3.3.0 Teacher Dashboard Restore

ปัญหา:
v3.2.9 dedupe แรงเกินไป จนหน้า Teacher เหลือแค่ Phase 1 Final/Checklist
และส่วนหลักหายจากสายตา:
- All Students Detail
- Production Classroom Checklist
- Teaching Decision
- Google Sheets Status

แก้:
1) แทนที่ logic aiquest-phase1-final-dedupe เป็น safe dedupe
2) protect core dashboard ไม่ให้ถูกลบ/ซ่อน:
   - Student table
   - Production Checklist
   - Teaching Decision
   - Google Sheets Status
3) ลบเฉพาะ loose duplicate Phase 1 note เท่านั้น
4) คงไว้:
   - 1 badge
   - 1 Teaching Decision note
   - 1 Final card
   - 1 Checklist
5) ถ้า dashboard core ไม่แสดง จะขึ้น restore warning ให้ hard reload/กด Dashboard
6) ระบบ Phase 1 ทั้งหมดเดิมยังอยู่ครบ

เปิด:
 /ai-quest/index.html?teacher=1&v=20260614-restore330

เช็ก:
 AIQUEST_TEACHER_DASHBOARD_RESTORE
 AIQUEST_TEACHER_DASHBOARD_RESTORE.clean()
