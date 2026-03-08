# HeroHealth • GoodJunk Flow Diagram
PATCH v20260307-GJ-FLOW

เอกสารนี้สรุป flow ของ GoodJunk Classroom Suite ด้วย Mermaid diagrams
เพื่อให้ดูโครงระบบ การไหลของข้อมูล และหน้าที่ของแต่ละหน้าได้เร็ว

---

## 1) Classroom Flow หลัก

```mermaid
flowchart TD
    A[Teacher เปิด GoodJunk Index / Launcher] --> B[เปิด Teacher Essential หรือ Teacher Dashboard]
    A --> C[เปิด Board Essential / Kiosk / Live Board บนจอหน้า class]
    A --> D[ส่ง Student Join link หรือ QR ให้นักเรียน]

    D --> E[นักเรียนเข้า Student Join]
    E --> F{ห้องถูกล็อกหรือไม่}
    F -- ไม่ล็อก --> G[กรอกชื่อ / PID / เช็ก duplicate]
    G --> H[เข้า GoodJunk Run Page]
    H --> I[เข้า Battle Room]

    F -- ล็อกธรรมดา --> J[เข้าไม่ได้]
    F -- Spectator Only --> K[ไปหน้า Board / Spectator]

    B --> L[ครูกด Start Class Macro]
    L --> M[unlock room]
    M --> N[clear rematch]
    N --> O[reset room]
    O --> P[announcement เริ่มคาบ]
    P --> Q[countdown 3s]
    Q --> R[เริ่มเล่น]

    I --> R
    R --> S[เล่น battle / score sync / board update]
    S --> T[จบรอบ]
    T --> U[ตัดสินผู้ชนะ]
    U --> V[ขึ้น winner / compare table / board spotlight]

    B --> W[ครูกด End Class Macro]
    W --> X[spectator only]
    X --> Y[announcement จบคาบ]
    Y --> Z[นักเรียนดูผลผ่าน board]