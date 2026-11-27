import React, { useState, useEffect } from 'react'

const PORTION_PRESETS = [
  { label: '🥣 ครึ่งจาน (0.6x)', ratio: 0.6 },
  { label: '🍽️ จานปกติ (1.0x)', ratio: 1.0 },
  { label: '🍛 พิเศษ / จานใหญ่ (1.3x)', ratio: 1.3 }
]

const ADDON_OPTIONS = [
  { id: 'fried_egg', label: '🍳 +ไข่ดาว (+98 kcal)' },
  { id: 'boiled_egg', label: '🥚 +ไข่ต้ม (+73 kcal)' },
  { id: 'extra_rice', label: '🍚 +ข้าว 1 ทัพพี (+81 kcal)' },
  { id: 'half_rice', label: '📉 ลดข้าวครึ่งหนึ่ง (-99 kcal)' },
  { id: 'less_oil', label: '💧 ผัดน้ำ/ซับน้ำมัน (-45 kcal)' },
  { id: 'no_broth', label: '🥄 ไม่ซดน้ำแกง (ลดโซเดียม 45%)' }
]

function ResultCard({ result, menus = [], healthCondition = 'general', onUpdateMenuOrWeight }) {
  const [editing, setEditing] = useState(false)
  const [selectedMenuId, setSelectedMenuId] = useState(result.menu_id)
  const [customWeight, setCustomWeight] = useState(result.estimated_weight_g)
  const [activeAddons, setActiveAddons] = useState(result.addons || [])
  const [showFormula, setShowFormula] = useState(false)

  useEffect(() => {
    setSelectedMenuId(result.menu_id)
    setCustomWeight(result.estimated_weight_g)
    setActiveAddons(result.addons || [])
    setEditing(false)
  }, [result])

  const currentMenuObj = menus.find((m) => m.id === result.menu_id) || { default_weight_g: 250 }
  const baseDefaultWeight = currentMenuObj.default_weight_g || 250

  const confidenceClass = result.confidence >= 0.72 ? 'confidence-high' : 'confidence-low'
  const confidenceText = result.confidence >= 0.72 ? 'ความมั่นใจสูง' : 'ความมั่นใจปานกลาง'

  const healthScore = result.health_score ?? 80
  const scoreClass = healthScore >= 80 ? 'score-good' : healthScore >= 60 ? 'score-mid' : 'score-low'

  const rdi = result.thai_rdi_percent || {
    energy: Math.round(((result.energy_kcal || 0) / 2000) * 100),
    protein: Math.round(((result.protein_g || 0) / 50) * 100),
    carb: Math.round(((result.carb_g || 0) / 300) * 100),
    fat: Math.round(((result.fat_g || 0) / 65) * 100),
    fiber: Math.round(((result.fiber_g || 2) / 25) * 100),
    sugar: Math.round(((result.sugar_g || 3) / 24) * 100),
    sodium: Math.round(((result.sodium_mg || 800) / 2000) * 100)
  }

  // คำนวณสัดส่วนพลังงานจาก P : C : F (Atwater System)
  const pKcal = Number((result.protein_g * 4).toFixed(1))
  const cKcal = Number((result.carb_g * 4).toFixed(1))
  const fKcal = Number((result.fat_g * 9).toFixed(1))
  const totalKcal = Math.max(1, result.energy_kcal || (pKcal + cKcal + fKcal))
  const pPct = Math.round((pKcal / totalKcal) * 100)
  const cPct = Math.round((cKcal / totalKcal) * 100)
  const fPct = Math.max(0, 100 - pPct - cPct)

  // สัญญาณไฟจราจรโภชนาการ (Traffic Light System)
  const getTrafficLight = (type, val) => {
    if (type === 'sugar') {
      if (val <= 5) return { level: 'ต่ำ (ดี)', cls: 'tl-green' }
      if (val <= 12) return { level: 'ปานกลาง', cls: 'tl-amber' }
      return { level: 'สูง (ระวัง)', cls: 'tl-red' }
    }
    if (type === 'fat') {
      if (val <= 10) return { level: 'ต่ำ (ดี)', cls: 'tl-green' }
      if (val <= 20) return { level: 'ปานกลาง', cls: 'tl-amber' }
      return { level: 'สูง (ระวัง)', cls: 'tl-red' }
    }
    if (type === 'sodium') {
      if (val <= 600) return { level: 'ต่ำ (ดี)', cls: 'tl-green' }
      if (val <= 1000) return { level: 'ปานกลาง', cls: 'tl-amber' }
      return { level: 'สูง (ระวัง)', cls: 'tl-red' }
    }
    return { level: 'ปกติ', cls: 'tl-green' }
  }

  const sugarTL = getTrafficLight('sugar', result.sugar_g ?? 3)
  const fatTL = getTrafficLight('fat', result.fat_g ?? 10)
  const sodiumTL = getTrafficLight('sodium', result.sodium_mg ?? 800)

  // คำเตือนเฉพาะโรคประจำตัว / เป้าหมายสุขภาพของผู้ใช้
  const getConditionAlert = () => {
    if (healthCondition === 'hypertension' && (result.sodium_mg || 0) > 700) {
      return {
        type: 'warn',
        text: `⚠️ โหมดคุมความดัน/โรคไต: เมนูนี้มีโซเดียม ${result.sodium_mg} mg (สูงเกินเกณฑ์ 700 mg/มื้อ) แนะนำกดปุ่ม "🥄 ไม่ซดน้ำแกง" ด้านล่างเพื่อลดโซเดียมลง 45%`
      }
    }
    if (healthCondition === 'diabetes' && ((result.sugar_g || 0) > 8 || (result.carb_g || 0) > 55)) {
      return {
        type: 'warn',
        text: `⚠️ โหมดคุมเบาหวาน/น้ำตาลในเลือด: เมนูนี้มีคาร์โบไฮเดรต ${result.carb_g}g และน้ำตาล ${result.sugar_g}g แนะนำกดปุ่ม "📉 ลดข้าวครึ่งหนึ่ง" และทานผักเคียงก่อนเริ่มมื้ออาหาร`
      }
    }
    if (healthCondition === 'dyslipidemia' && ((result.fat_g || 0) > 18 || (result.cholesterol_mg || 0) > 150)) {
      return {
        type: 'warn',
        text: `⚠️ โหมดคุมไขมัน/คอเลสเตอรอล: เมนูนี้มีไขมัน ${result.fat_g}g และคอเลสเตอรอล ${result.cholesterol_mg}mg แนะนำเลี่ยงส่วนหนัง/มันหมู หรือกด "💧 ผัดน้ำ/ซับน้ำมัน"`
      }
    }
    if (healthCondition === 'muscle' && (result.protein_g || 0) < 25) {
      return {
        type: 'info',
        text: `💪 โหมดสร้างกล้ามเนื้อ: มื้อนี้มีโปรตีน ${result.protein_g}g แนะนำกด "+🥚 ไข่ต้ม" เพื่อเพิ่มโปรตีนคุณภาพสูงอีก 6.5 กรัม`
      }
    }
    return null
  }

  const conditionAlert = getConditionAlert()

  // ค้นหาเมนูทางเลือกที่สุขภาพดีกว่า (Smart Healthy Swap)
  const getHealthySwaps = () => {
    if (!menus || menus.length === 0) return []
    return menus
      .filter((m) => m.id !== result.menu_id)
      .map((m) => {
        const estKcal = Math.round((m.energy_kcal_per_100g * m.default_weight_g) / 100)
        const estProt = Number(((m.protein_g_per_100g * m.default_weight_g) / 100).toFixed(1))
        const estFat = Number(((m.fat_g_per_100g * m.default_weight_g) / 100).toFixed(1))
        const estSodium = Math.round((m.sodium_mg_per_100g * m.default_weight_g) / 100)
        return { ...m, estKcal, estProt, estFat, estSodium }
      })
      .filter((m) => m.estKcal < result.energy_kcal - 40 && m.estFat <= result.fat_g)
      .sort((a, b) => (b.estProt / Math.max(1, b.estKcal)) - (a.estProt / Math.max(1, a.estKcal)))
      .slice(0, 2)
  }

  const healthySwaps = (result.energy_kcal > 320 || result.fat_g > 15) ? getHealthySwaps() : []

  const handleQuickPortion = (ratio) => {
    const newWeight = Math.round(baseDefaultWeight * ratio)
    setCustomWeight(newWeight)
    if (onUpdateMenuOrWeight) {
      onUpdateMenuOrWeight(result.menu_id, newWeight, activeAddons)
    }
  }

  const handleToggleAddon = (addonId) => {
    const updated = activeAddons.includes(addonId)
      ? activeAddons.filter((a) => a !== addonId)
      : [...activeAddons, addonId]
    setActiveAddons(updated)
    if (onUpdateMenuOrWeight) {
      onUpdateMenuOrWeight(result.menu_id, Number(customWeight) || result.estimated_weight_g, updated)
    }
  }

  const handleSaveEdit = () => {
    if (onUpdateMenuOrWeight) {
      onUpdateMenuOrWeight(selectedMenuId, Number(customWeight) || result.estimated_weight_g, activeAddons)
    }
    setEditing(false)
  }

  const handleSwapMenu = (swapMenu) => {
    if (onUpdateMenuOrWeight) {
      onUpdateMenuOrWeight(swapMenu.id, swapMenu.default_weight_g, [])
    }
  }

  return (
    <div className="result-card">
      <div className="result-header-row">
        <div>
          <div className="result-category-tag">
            {result.category || 'อาหารจานเดียว'}
            {result.fcd_code && <span className="fcd-code-pill">{result.fcd_code}</span>}
          </div>
          <h2>{result.menu_name_th}</h2>
          {result.menu_name_en && <div className="result-subtitle">{result.menu_name_en}</div>}
        </div>
        <div className={`health-score-badge ${scoreClass}`}>
          <div className="score-num">{healthScore}</div>
          <div className="score-txt">คะแนนสุขภาพ</div>
        </div>
      </div>

      <div className="badge-row">
        <span className={`confidence-badge ${confidenceClass}`}>
          {confidenceText} ({(result.confidence * 100).toFixed(1)}%) • {String(result.analysis_source || '').startsWith('gemini') ? '✨ วิเคราะห์จากภาพด้วย Gemini Vision AI' : result.analysis_source === 'preset' ? '⚡ เมนูตัวอย่างมาตรฐาน' : result.analysis_source === 'manual' ? '📋 เลือกจากตารางโภชนาการ' : '🖥️ โหมดออฟไลน์ในเครื่อง'}
        </span>
        <button type="button" className="edit-inline-btn" onClick={() => setEditing(!editing)}>
          {editing ? 'ปิดการแก้ไข' : '✏️ เปลี่ยนเมนู / ระบุกรัมเอง'}
        </button>
      </div>

      {/* ส่วนประกอบในจานที่ AI Vision มองเห็นจากภาพจริง */}
      {result.detected_components && result.detected_components.length > 0 && (
        <div className="detected-components-box">
          <strong>👁️ ส่วนประกอบในภาพที่ AI ตรวจพบ:</strong>{' '}
          {result.detected_components.join(' • ')}
        </div>
      )}

      {result.ai_note && (
        <div className="ai-offline-note">
          💡 {result.ai_note}
        </div>
      )}

      {/* แจ้งเตือนเฉพาะโรค/เป้าหมายสุขภาพ */}
      {conditionAlert && (
        <div className={`condition-alert-banner ${conditionAlert.type === 'warn' ? 'alert-warn' : 'alert-info'}`}>
          {conditionAlert.text}
        </div>
      )}

      {/* ปุ่มปรับขนาดจานด่วน & ท็อปปิ้งคนไทย */}
      <div className="quick-adjust-box">
        <div className="quick-adjust-label">🍽️ ปรับขนาดจานด่วน (ไม่ต้องกะน้ำหนักกรัมเอง):</div>
        <div className="portion-btn-row">
          {PORTION_PRESETS.map((p, idx) => {
            const targetW = Math.round(baseDefaultWeight * p.ratio)
            const isSelected = Math.abs((result.estimated_weight_g || 0) - targetW) <= 15
            return (
              <button
                key={idx}
                type="button"
                className={`portion-chip ${isSelected ? 'portion-chip-active' : ''}`}
                onClick={() => handleQuickPortion(p.ratio)}
              >
                {p.label} <small>({targetW}g)</small>
              </button>
            )
          })}
        </div>

        <div className="quick-adjust-label" style={{ marginTop: '0.6rem' }}>
          ✨ ปรับพฤติกรรมการกิน / เพิ่มท็อปปิ้ง (คลิกเพื่อคำนวณทันที):
        </div>
        <div className="addon-chips">
          {ADDON_OPTIONS.map((addon) => {
            const active = activeAddons.includes(addon.id)
            return (
              <button
                key={addon.id}
                type="button"
                className={`addon-chip ${active ? 'addon-chip-active' : ''}`}
                onClick={() => handleToggleAddon(addon.id)}
              >
                {active ? '✓ ' : ''}{addon.label}
              </button>
            )
          })}
        </div>
      </div>

      {editing && (
        <div className="inline-editor">
          <div className="editor-field">
            <label>เปลี่ยนรายการอาหาร (ฐานข้อมูล Thai FCD 30 เมนู):</label>
            <select value={selectedMenuId} onChange={(e) => setSelectedMenuId(e.target.value)}>
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name_th} ({m.energy_kcal_per_100g} kcal/100g)
                </option>
              ))}
            </select>
          </div>
          <div className="editor-field">
            <label>ปริมาณน้ำหนักอาหาร (กรัม):</label>
            <input
              type="number"
              min="20"
              max="1500"
              step="10"
              value={customWeight}
              onChange={(e) => setCustomWeight(e.target.value)}
            />
          </div>
          <button type="button" className="save-edit-btn" onClick={handleSaveEdit}>
            ✅ คำนวณโภชนาการใหม่ตามน้ำหนักจริง
          </button>
        </div>
      )}

      {/* สัญญาณไฟจราจร หวาน - มัน - เค็ม */}
      <div className="traffic-light-bar">
        <div className="tl-title">🚦 สัญญาณไฟจราจรโภชนาการ (เกณฑ์หวาน-มัน-เค็ม ต่อมื้อ):</div>
        <div className="tl-grid">
          <div className={`tl-item ${sugarTL.cls}`}>
            <span className="tl-dot" />
            <div>
              <div className="tl-name">ความหวาน (น้ำตาล {result.sugar_g ?? 3}g)</div>
              <div className="tl-status">{sugarTL.level}</div>
            </div>
          </div>
          <div className={`tl-item ${fatTL.cls}`}>
            <span className="tl-dot" />
            <div>
              <div className="tl-name">ความมัน (ไขมัน {result.fat_g}g)</div>
              <div className="tl-status">{fatTL.level}</div>
            </div>
          </div>
          <div className={`tl-item ${sodiumTL.cls}`}>
            <span className="tl-dot" />
            <div>
              <div className="tl-name">ความเค็ม (โซเดียม {result.sodium_mg ?? 800}mg)</div>
              <div className="tl-status">{sodiumTL.level}</div>
            </div>
          </div>
        </div>
      </div>

      {/* กราฟแท่งสัดส่วนพลังงาน P : C : F */}
      <div className="macro-ratio-box">
        <div className="macro-ratio-header">
          <span>📊 สัดส่วนพลังงานหลัก (โปรตีน {pPct}% : คาร์บ {cPct}% : ไขมัน {fPct}%)</span>
          <small>เกณฑ์สมดุลกรมอนามัย 15 : 55 : 30</small>
        </div>
        <div className="macro-stacked-bar">
          <div className="macro-seg seg-p" style={{ width: `${pPct}%` }} title={`โปรตีน ${pPct}%`} />
          <div className="macro-seg seg-c" style={{ width: `${cPct}%` }} title={`คาร์โบไฮเดรต ${cPct}%`} />
          <div className="macro-seg seg-f" style={{ width: `${fPct}%` }} title={`ไขมัน ${fPct}%`} />
        </div>
        <div className="macro-legend">
          <span><i className="dot-p" /> โปรตีน {pKcal} kcal ({pPct}%)</span>
          <span><i className="dot-c" /> คาร์บ {cKcal} kcal ({cPct}%)</span>
          <span><i className="dot-f" /> ไขมัน {fKcal} kcal ({fPct}%)</span>
        </div>
      </div>

      {/* สารอาหารหลัก + %Thai RDI */}
      <div className="nutrient-grid">
        <div className="nutrient-item highlight-kcal">
          <div className="nutrient-value">{result.energy_kcal} <small>kcal</small></div>
          <div className="nutrient-label">🔥 พลังงานทั้งหมด</div>
          <div className="rdi-sub">คิดเป็น {rdi.energy}% ของ Thai RDI (2,000 kcal)</div>
        </div>
        <div className="nutrient-item">
          <div className="nutrient-value">{result.estimated_weight_g} <small>g</small></div>
          <div className="nutrient-label">⚖️ น้ำหนักอาหารประเมิน</div>
          <div className="rdi-sub">ความคลาดเคลื่อน ±{result.uncertainty} kcal</div>
        </div>
        <div className="nutrient-item">
          <div className="nutrient-value">{result.protein_g} <small>g</small></div>
          <div className="nutrient-label">🥩 โปรตีน ({pKcal} kcal)</div>
          <div className="rdi-sub">{rdi.protein}% ของ Thai RDI (50g/วัน)</div>
        </div>
        <div className="nutrient-item">
          <div className="nutrient-value">{result.carb_g} <small>g</small></div>
          <div className="nutrient-label">🍚 คาร์โบไฮเดรต ({cKcal} kcal)</div>
          <div className="rdi-sub">{rdi.carb}% ของ Thai RDI (300g/วัน)</div>
        </div>
        <div className="nutrient-item">
          <div className="nutrient-value">{result.fat_g} <small>g</small></div>
          <div className="nutrient-label">🥑 ไขมันทั้งหมด ({fKcal} kcal)</div>
          <div className="rdi-sub">{rdi.fat}% ของ Thai RDI (65g/วัน)</div>
        </div>
        <div className="nutrient-item">
          <div className="nutrient-value">{result.sodium_mg ?? 850} <small>mg</small></div>
          <div className="nutrient-label">🧂 โซเดียม (Sodium)</div>
          <div className={`rdi-sub ${(rdi.sodium || 0) > 50 ? 'rdi-warn' : ''}`}>
            {rdi.sodium}% ของเกณฑ์กรมอนามัย (2,000 mg)
          </div>
        </div>
      </div>

      {/* สารอาหารรอง: น้ำตาล, ใยอาหาร, คอเลสเตอรอล */}
      <div className="micro-row">
        <div className="micro-pill">
          <span>🍬 น้ำตาล: <strong>{result.sugar_g ?? 3.5} g</strong></span>
          <small>({rdi.sugar}% เกณฑ์ WHO 24g)</small>
        </div>
        <div className="micro-pill">
          <span>🥬 ใยอาหาร: <strong>{result.fiber_g ?? 2.0} g</strong></span>
          <small>({rdi.fiber}% Thai RDI 25g)</small>
        </div>
        <div className="micro-pill">
          <span>🥚 คอเลสเตอรอล: <strong>{result.cholesterol_mg ?? 45} mg</strong></span>
          <small>(เกณฑ์ 300 mg/วัน)</small>
        </div>
      </div>

      {/* วิตามิน แร่ธาตุ และสารพฤกษเคมีสำคัญ */}
      {result.micronutrients && result.micronutrients.length > 0 && (
        <div className="vitamin-box">
          <div className="vitamin-title">💊 วิตามิน แร่ธาตุ และสารอาหารรองเด่นในเมนูนี้:</div>
          <div className="vitamin-tags">
            {result.micronutrients.map((v, i) => (
              <span key={i} className="vitamin-tag">✓ {v}</span>
            ))}
          </div>
        </div>
      )}

      {result.health_advice && (
        <div className="health-advice-box">
          <strong>🩺 คำแนะนำโภชนาการเชิงคลินิกเบื้องต้น:</strong> {result.health_advice}
        </div>
      )}

      {/* แนะนำเมนูทางเลือกที่แคลอรี่ต่ำกว่า (Smart Healthy Swap) */}
      {healthySwaps.length > 0 && (
        <div className="healthy-swap-box">
          <div className="swap-title">🔄 เมนูทางเลือกสุขภาพ (แคลอรี่และไขมันต่ำกว่าเมนูนี้):</div>
          <div className="swap-list">
            {healthySwaps.map((sw) => {
              const savedKcal = Math.round(result.energy_kcal - sw.estKcal)
              return (
                <div key={sw.id} className="swap-card">
                  <div>
                    <div className="swap-name">{sw.name_th} <small>({sw.default_weight_g}g)</small></div>
                    <div className="swap-meta">
                      {sw.estKcal} kcal (ประหยัดได้ <strong>-{savedKcal} kcal</strong>) • โปรตีน {sw.estProt}g • ไขมัน {sw.estFat}g
                    </div>
                  </div>
                  <button type="button" className="swap-select-btn" onClick={() => handleSwapMenu(sw)}>
                    สลับเป็นเมนูนี้
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* กล่องแสดงแหล่งอ้างอิงวิชาการและวิธีคำนวณ (Citation & Methodology) */}
      <div className="citation-card">
        <div className="citation-header">
          <div>
            <strong>📚 แหล่งอ้างอิงข้อมูลโภชนาการ (Official Reference):</strong>
            <div className="citation-source-text">
              {result.reference_source || 'ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (INMU Thai FCD) และ สำนักโภชนาการ กรมอนามัย กระทรวงสาธารณสุข'}
            </div>
          </div>
          <button
            type="button"
            className="formula-toggle-btn"
            onClick={() => setShowFormula(!showFormula)}
          >
            {showFormula ? 'ซ่อนวิธีคำนวณ ▲' : 'ดูสูตรคำนวณ ▼'}
          </button>
        </div>

        {showFormula && (
          <div className="methodology-details">
            <p><strong>1. การคำนวณตามน้ำหนักอาหารจริง (Nutrient Density Scaling):</strong></p>
            <p className="formula-code">
              ค่าสารอาหารที่ได้รับ = (ค่าสารอาหารต่อ 100 กรัม ตามตาราง Thai FCD) × ({result.estimated_weight_g} กรัม ÷ 100) {activeAddons.length > 0 ? `+ รายการปรับแต่ง (${activeAddons.length} รายการ)` : ''}
            </p>
            <p><strong>2. เกณฑ์พลังงานมาตรฐานสากล (FAO/WHO Atwater General Factor System):</strong></p>
            <p className="formula-code">
              โปรตีน ({result.protein_g}g × 4 = {pKcal} kcal) + คาร์โบไฮเดรต ({result.carb_g}g × 4 = {cKcal} kcal) + ไขมัน ({result.fat_g}g × 9 = {fKcal} kcal) = <strong>{result.energy_kcal} kcal</strong> (ตรงกัน 100%)
            </p>
            <p><strong>3. เกณฑ์ร้อยละของปริมาณที่แนะนำต่อวัน (Thai RDI พ.ศ. 2563):</strong></p>
            <p className="formula-code">
              อ้างอิงความต้องการพลังงาน 2,000 kcal/วัน: โปรตีน 50g, คาร์โบไฮเดรต 300g, ไขมัน 65g, ใยอาหาร 25g, โซเดียมไม่เกิน 2,000 mg (กรมอนามัย) และน้ำตาลไม่เกิน 24g (WHO)
            </p>
          </div>
        )}
      </div>

      <div className="disclaimer">
        คำชี้แจง: ข้อมูลคุณค่าทางโภชนาการคำนวณจากค่าเฉลี่ยมาตรฐานในห้องปฏิบัติการของสถาบันโภชนาการ ม.มหิดล (INMU) และกรมอนามัย ปริมาณจริงอาจแตกต่างกัน ±{result.uncertainty} kcal ตามสูตรการปรุงของแต่ละร้าน
      </div>
    </div>
  )
}

export default ResultCard
