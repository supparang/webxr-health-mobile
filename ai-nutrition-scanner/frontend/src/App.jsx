import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Camera from './components/Camera'
import ResultCard from './components/ResultCard'
import ConfirmationModal from './components/ConfirmationModal'
import {
  MENU_DATABASE,
  REFERENCE_STANDARDS,
  getMenuById,
  calculateNutrition,
  computeHealthInsights,
  verifyGeminiKeyDirect,
  predictClientSide
} from './nutritionEngine'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const IS_LOCALHOST = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

const HEALTH_CONDITIONS = [
  { id: 'general', label: '🌿 สุขภาพทั่วไป (สมดุลตามเกณฑ์ Thai RDI)' },
  { id: 'hypertension', label: '🧂 คุมโซเดียม / ความดันโลหิตสูง / โรคไต' },
  { id: 'diabetes', label: '🍬 คุมน้ำตาลและคาร์บ / เบาหวาน' },
  { id: 'dyslipidemia', label: '🥑 คุมไขมันและคอเลสเตอรอลในเลือด' },
  { id: 'muscle', label: '💪 เพิ่มกล้ามเนื้อ / เน้นโปรตีนสูง' }
]

const CATEGORIES = ['ทั้งหมด', 'ผัด', 'ต้ม', 'แกง', 'ยำ', 'ทอด', 'ข้าว', 'ก๋วยเตี๋ยว', 'ปิ้งย่าง', 'จิ้ม', 'นึ่ง', 'อบ']

function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [predictionId, setPredictionId] = useState(null)

  const [menus, setMenus] = useState(MENU_DATABASE)
  const [references, setReferences] = useState(REFERENCE_STANDARDS)
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('nutriscan_history_logs')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return []
  })

  // โหมดการทำงานหลัก: 'scan' (ถ่ายรูป/อัปโหลด) หรือ 'search' (ค้นหาจากฐานข้อมูล 30 เมนู)
  const [activeTab, setActiveTab] = useState('scan')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด')

  // ข้อมูลเป้าหมายและโปรไฟล์ร่างกาย (BMR / TDEE Calculator)
  const [dailyGoal, setDailyGoal] = useState(() => Number(localStorage.getItem('nutriscan_daily_goal')) || 2000)
  const [healthCondition, setHealthCondition] = useState(() => localStorage.getItem('nutriscan_condition') || 'general')
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('nutriscan_gemini_key') || '')

  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('nutriscan_profile')
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return { gender: 'male', age: 30, weight: 65, height: 170, activity: 1.375, goalDiff: 0 }
  })

  const [showProfileCalc, setShowProfileCalc] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showRefModal, setShowRefModal] = useState(false)
  const [keyStatus, setKeyStatus] = useState(null)
  const [testingKey, setTestingKey] = useState(false)

  const saveHistoryLocal = (updater) => {
    setHistory((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      try {
        localStorage.setItem('nutriscan_history_logs', JSON.stringify(next))
      } catch (e) {}
      return next
    })
  }

  const handleVerifyApiKey = async () => {
    const trimmed = geminiKey.trim()
    if (!trimmed) {
      setKeyStatus({ ok: false, msg: 'กรุณาวาง Gemini API Key ก่อนกดทดสอบ' })
      return
    }
    setTestingKey(true)
    setKeyStatus(null)
    try {
      // ทดสอบกับ Google Gemini API โดยตรงจากเบราว์เซอร์ (รองรับ GitHub Pages 100%)
      const check = await verifyGeminiKeyDirect(trimmed)
      if (check.valid) {
        localStorage.setItem('nutriscan_gemini_key', trimmed)
        setKeyStatus({ ok: true, msg: `✅ ${check.detail} — พร้อมสแกนภาพอาหารจริงด้วย AI!` })
      } else {
        setKeyStatus({ ok: false, msg: check.detail || 'ไม่สามารถยืนยัน Key ได้' })
      }
    } catch (err) {
      setKeyStatus({ ok: false, msg: err.message || 'API Key ไม่ถูกต้อง หรือเชื่อมต่อไม่สำเร็จ' })
    } finally {
      setTestingKey(false)
    }
  }

  const fetchInitialData = async () => {
    if (!IS_LOCALHOST) return
    try {
      const [menusRes, histRes, refRes] = await Promise.all([
        axios.get(`${API_URL}/api/predictions/menus`, { timeout: 2000 }),
        axios.get(`${API_URL}/api/predictions/history`, { timeout: 2000 }),
        axios.get(`${API_URL}/api/predictions/references`, { timeout: 2000 }).catch(() => ({ data: { standards: REFERENCE_STANDARDS } }))
      ])
      if (menusRes.data?.length) setMenus(menusRes.data)
      if (histRes.data?.length) saveHistoryLocal(histRes.data)
      if (refRes.data?.standards?.length) setReferences(refRes.data.standards)
    } catch (err) {
      // ทำงานในโหมด Standalone (GitHub Pages / Client-side Engine) อัตโนมัติ
    }
  }

  useEffect(() => {
    fetchInitialData()
  }, [])

  // คำนวณ BMR & TDEE ด้วยสมการมาตรฐานทางการแพทย์ Mifflin-St Jeor
  const computeBmrTdee = (p) => {
    const w = Number(p.weight) || 65
    const h = Number(p.height) || 170
    const a = Number(p.age) || 30
    const bmr = p.gender === 'male'
      ? Math.round(10 * w + 6.25 * h - 5 * a + 5)
      : Math.round(10 * w + 6.25 * h - 5 * a - 161)
    const tdee = Math.round(bmr * (Number(p.activity) || 1.375))
    const targetKcal = Math.max(1000, tdee + (Number(p.goalDiff) || 0))
    return { bmr, tdee, targetKcal }
  }

  const { bmr, tdee, targetKcal: calculatedTargetKcal } = computeBmrTdee(profile)

  const handleApplyTdeeProfile = (e) => {
    e.preventDefault()
    localStorage.setItem('nutriscan_profile', JSON.stringify(profile))
    setDailyGoal(calculatedTargetKcal)
    localStorage.setItem('nutriscan_daily_goal', String(calculatedTargetKcal))
    localStorage.setItem('nutriscan_condition', healthCondition)
    setShowProfileCalc(false)
  }

  const handleSaveSettings = (e) => {
    e.preventDefault()
    localStorage.setItem('nutriscan_daily_goal', String(dailyGoal))
    localStorage.setItem('nutriscan_condition', healthCondition)
    localStorage.setItem('nutriscan_gemini_key', geminiKey.trim())
    setShowSettings(false)
  }

  const handleImageCaptured = async (imageFile, presetMenuId = '') => {
    setLoading(true)
    setError(null)
    setResult(null)
    setShowConfirm(false)

    try {
      let data = null
      if (IS_LOCALHOST) {
        try {
          const formData = new FormData()
          formData.append('file', imageFile)
          if (presetMenuId) formData.append('menu_id', presetMenuId)
          if (geminiKey.trim()) formData.append('gemini_api_key', geminiKey.trim())
          const response = await axios.post(`${API_URL}/api/predictions/predict`, formData, {
            timeout: 15000,
            headers: {
              'Content-Type': 'multipart/form-data',
              ...(geminiKey.trim() ? { 'X-Gemini-Key': geminiKey.trim() } : {})
            }
          })
          data = response.data
        } catch (localErr) {
          if (localErr.response?.data?.detail) {
            throw new Error(localErr.response.data.detail)
          }
          data = await predictClientSide(imageFile, presetMenuId, geminiKey.trim())
        }
      } else {
        data = await predictClientSide(imageFile, presetMenuId, geminiKey.trim())
      }

      setResult(data)
      setPredictionId(data.prediction_id || data.id)
      if (data.needs_confirmation) {
        setShowConfirm(true)
      }
      saveHistoryLocal((prev) => [data, ...prev.filter((item) => item.id !== data.id)].slice(0, 50))
    } catch (err) {
      setError(err.message || err.response?.data?.detail || 'ไม่สามารถวิเคราะห์ภาพได้ กรุณาตรวจสอบ Gemini API Key หรือการเชื่อมต่ออินเทอร์เน็ต')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectMenuManually = async (menuItem) => {
    setLoading(true)
    setError(null)
    setShowConfirm(false)
    try {
      const weightG = menuItem.default_weight_g || 300
      const nutrition = calculateNutrition(menuItem.id, weightG, [])
      const insights = computeHealthInsights(nutrition, weightG, menuItem)
      const newId = Date.now()
      const logItem = {
        id: newId,
        prediction_id: newId,
        menu_id: menuItem.id,
        menu_name_th: menuItem.name_th,
        menu_name_en: menuItem.name_en,
        category: menuItem.category,
        fcd_code: menuItem.fcd_code,
        reference_source: menuItem.reference_source,
        confidence: 1.0,
        estimated_weight_g: weightG,
        addons: [],
        ai_provider: 'Manual Catalog Selection (Thai FCD)',
        ...nutrition,
        ...insights,
        needs_confirmation: false,
        confirmation_question: null,
        created_at: new Date().toISOString()
      }

      if (IS_LOCALHOST) {
        axios.post(`${API_URL}/api/predictions/manual-log`, {
          menu_id: menuItem.id,
          weight_g: weightG,
          addons: []
        }).catch(() => {})
      }

      setResult(logItem)
      setPredictionId(newId)
      saveHistoryLocal((prev) => [logItem, ...prev].slice(0, 50))
    } catch (err) {
      setError('ไม่สามารถบันทึกเมนูที่เลือกได้')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmation = async (correctionMenuId) => {
    try {
      const targetMenuId = correctionMenuId || result?.menu_id || 1
      const menuItem = getMenuById(targetMenuId) || result
      const weightG = result?.estimated_weight_g || menuItem.default_weight_g || 300
      const addons = result?.addons || []
      const nutrition = calculateNutrition(targetMenuId, weightG, addons, menuItem.energy_kcal_per_100g ? null : menuItem)
      const insights = computeHealthInsights(nutrition, weightG, menuItem)

      const updatedItem = {
        ...result,
        menu_id: menuItem.id || targetMenuId,
        menu_name_th: menuItem.name_th || result.menu_name_th,
        menu_name_en: menuItem.name_en || result.menu_name_en,
        category: menuItem.category || result.category,
        fcd_code: menuItem.fcd_code || result.fcd_code,
        reference_source: menuItem.reference_source || result.reference_source,
        estimated_weight_g: weightG,
        addons,
        ...nutrition,
        ...insights,
        confidence: correctionMenuId ? 0.99 : result.confidence,
        needs_confirmation: false
      }

      setShowConfirm(false)
      setResult(updatedItem)
      saveHistoryLocal((prev) => prev.map((item) => (item.id === predictionId ? updatedItem : item)))

      if (IS_LOCALHOST) {
        axios.post(`${API_URL}/api/predictions/confirm`, {
          prediction_id: predictionId,
          confirmed: true,
          correction: correctionMenuId || null
        }).catch(() => {})
      }
    } catch (err) {
      setError('ไม่สามารถบันทึกการยืนยันได้')
    }
  }

  const handleUpdateMenuOrWeight = async (newMenuId, newWeightG, addons = []) => {
    if (!result) return
    try {
      const isChangingMenu = Number(newMenuId) !== Number(result.menu_id)
      const dbMenu = getMenuById(newMenuId)
      const customBase = (!isChangingMenu && Number(newMenuId) === 999) ? {
        energy_kcal_per_100g: (result.energy_kcal / (result.estimated_weight_g || 300)) * 100,
        protein_g_per_100g: (result.protein_g / (result.estimated_weight_g || 300)) * 100,
        carb_g_per_100g: (result.carb_g / (result.estimated_weight_g || 300)) * 100,
        fat_g_per_100g: (result.fat_g / (result.estimated_weight_g || 300)) * 100,
        sugar_g_per_100g: ((result.sugar_g || 3) / (result.estimated_weight_g || 300)) * 100,
        fiber_g_per_100g: ((result.fiber_g || 2) / (result.estimated_weight_g || 300)) * 100,
        sodium_mg_per_100g: ((result.sodium_mg || 700) / (result.estimated_weight_g || 300)) * 100,
        cholesterol_mg_per_100g: ((result.cholesterol_mg || 45) / (result.estimated_weight_g || 300)) * 100
      } : null

      const nutrition = calculateNutrition(newMenuId, newWeightG, addons, customBase)
      const targetMenuMeta = isChangingMenu ? dbMenu : (Number(newMenuId) === 999 ? result : dbMenu)
      const insights = computeHealthInsights(nutrition, newWeightG, targetMenuMeta)

      const updatedItem = {
        ...result,
        menu_id: isChangingMenu ? dbMenu.id : result.menu_id,
        menu_name_th: isChangingMenu ? dbMenu.name_th : result.menu_name_th,
        menu_name_en: isChangingMenu ? dbMenu.name_en : result.menu_name_en,
        category: isChangingMenu ? dbMenu.category : result.category,
        fcd_code: isChangingMenu ? dbMenu.fcd_code : result.fcd_code,
        reference_source: isChangingMenu ? dbMenu.reference_source : result.reference_source,
        estimated_weight_g: newWeightG,
        addons,
        ...nutrition,
        ...insights,
        confidence: 0.99
      }

      setResult(updatedItem)
      saveHistoryLocal((prev) => prev.map((item) => (item.id === predictionId ? updatedItem : item)))

      if (IS_LOCALHOST) {
        axios.post(`${API_URL}/api/predictions/confirm`, {
          prediction_id: predictionId,
          confirmed: true,
          correction: newMenuId,
          custom_weight_g: newWeightG,
          addons
        }).catch(() => {})
      }
    } catch (err) {
      setError('ไม่สามารถอัปเดตเมนูได้')
    }
  }

  const handleDeleteLog = async (id) => {
    saveHistoryLocal((prev) => prev.filter((item) => item.id !== id))
    if (IS_LOCALHOST) {
      axios.delete(`${API_URL}/api/predictions/history/${id}`).catch(() => {})
    }
  }

  // ส่งออกประวัติการกินเป็นไฟล์ CSV (เปิดใน Excel ได้ทันที รองรับภาษาไทย UTF-8 BOM)
  const handleExportCSV = () => {
    if (history.length === 0) return
    const headers = [
      'ลำดับ', 'วันที่-เวลา', 'ชื่อเมนู (ไทย)', 'ชื่อเมนู (อังกฤษ)', 'หมวดหมู่',
      'น้ำหนัก (g)', 'พลังงาน (kcal)', 'โปรตีน (g)', 'คาร์โบไฮเดรต (g)', 'ไขมัน (g)',
      'น้ำตาล (g)', 'ใยอาหาร (g)', 'โซเดียม (mg)', 'คอเลสเตอรอล (mg)', 'คะแนนสุขภาพ', 'แหล่งอ้างอิง'
    ]
    const rows = history.map((item, idx) => [
      idx + 1,
      item.created_at ? new Date(item.created_at).toLocaleString('th-TH') : '-',
      `"${(item.menu_name_th || '').replace(/"/g, '""')}"`,
      `"${(item.menu_name_en || '').replace(/"/g, '""')}"`,
      item.category || '-',
      item.estimated_weight_g,
      item.energy_kcal,
      item.protein_g,
      item.carb_g,
      item.fat_g,
      item.sugar_g ?? 2.0,
      item.fiber_g ?? 1.5,
      item.sodium_mg ?? 800,
      item.cholesterol_mg ?? 40,
      item.health_score ?? 80,
      `"${(item.reference_source || 'Thai FCD / กรมอนามัย').replace(/"/g, '""')}"`
    ])
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nutrition_report_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayLogs = history.filter((h) => !h.created_at || String(h.created_at).slice(0, 10) === todayStr)
  const totalKcalToday = Math.round(todayLogs.reduce((sum, item) => sum + (Number(item.energy_kcal) || 0), 0))
  const totalProteinToday = Math.round(todayLogs.reduce((sum, item) => sum + (Number(item.protein_g) || 0), 0))
  const totalCarbToday = Math.round(todayLogs.reduce((sum, item) => sum + (Number(item.carb_g) || 0), 0))
  const totalFatToday = Math.round(todayLogs.reduce((sum, item) => sum + (Number(item.fat_g) || 0), 0))
  const totalSodiumToday = Math.round(todayLogs.reduce((sum, item) => sum + (Number(item.sodium_mg) || 0), 0))
  const progressPct = Math.min(100, Math.round((totalKcalToday / (dailyGoal || 2000)) * 100))

  // เป้าหมายสารอาหารหลักตามพลังงานเป้าหมายรายวันของผู้ใช้
  const targetProteinG = Math.round((dailyGoal * 0.15) / 4)
  const targetCarbG = Math.round((dailyGoal * 0.55) / 4)
  const targetFatG = Math.round((dailyGoal * 0.30) / 9)

  // กรองรายการเมนูสำหรับแท็บค้นหา
  const filteredMenus = menus.filter((m) => {
    const matchCat = selectedCategory === 'ทั้งหมด' || m.category === selectedCategory
    const q = searchQuery.trim().toLowerCase()
    const matchText = !q || m.name_th.toLowerCase().includes(q) || (m.name_en && m.name_en.toLowerCase().includes(q))
    return matchCat && matchText
  })

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div>
            <h1>🥗 AI Nutrition Scanner</h1>
            <p>อ้างอิงฐานข้อมูลโภชนาการอาหารไทย (INMU Thai FCD & กรมอนามัย)</p>
          </div>
          <div className="header-btn-group">
            <button
              type="button"
              className="settings-btn"
              onClick={() => { setShowProfileCalc(!showProfileCalc); setShowSettings(false); setShowRefModal(false); }}
              title="คำนวณแคลอรี่เฉพาะบุคคล (BMR/TDEE) & โรคประจำตัว"
            >
              ⚖️ คำนวณ TDEE
            </button>
            <button
              type="button"
              className="settings-btn"
              onClick={() => { setShowRefModal(!showRefModal); setShowProfileCalc(false); setShowSettings(false); }}
              title="ดูแหล่งอ้างอิงวิชาการและตารางโภชนาการ"
            >
              📚 อ้างอิง
            </button>
            <button
              type="button"
              className="settings-btn"
              onClick={() => { setShowSettings(!showSettings); setShowProfileCalc(false); setShowRefModal(false); }}
              title="ตั้งค่าเป้าหมายแคลอรี่ & Gemini API Key"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* แถบสรุปเป้าหมายแคลอรี่รายวัน */}
        <div className="daily-tracker">
          <div className="tracker-header">
            <span>
              พลังงานวันนี้ ({todayLogs.length} มื้อ) • {HEALTH_CONDITIONS.find((c) => c.id === healthCondition)?.label.split(' ')[1] || 'ทั่วไป'}
            </span>
            <strong>{totalKcalToday.toLocaleString()} / {dailyGoal.toLocaleString()} kcal ({progressPct}%)</strong>
          </div>
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{
                width: `${progressPct}%`,
                background: progressPct > 100 ? '#ef4444' : '#ffffff'
              }}
            />
          </div>
          <div className="tracker-macros">
            <span>🥩 โปรตีน: {totalProteinToday}/{targetProteinG}g</span>
            <span>🍚 คาร์บ: {totalCarbToday}/{targetCarbG}g</span>
            <span>🥑 ไขมัน: {totalFatToday}/{targetFatG}g</span>
            <span className={totalSodiumToday > 2000 ? 'macro-over' : ''}>🧂 โซเดียม: {totalSodiumToday}/2000mg</span>
          </div>
        </div>
      </header>

      {/* แผงคำนวณ BMR / TDEE เฉพาะบุคคล & เลือกโหมดดูแลสุขภาพ */}
      {showProfileCalc && (
        <form className="settings-panel" onSubmit={handleApplyTdeeProfile}>
          <h3>⚖️ คำนวณพลังงานเฉพาะบุคคล (Mifflin-St Jeor BMR/TDEE)</h3>
          <div className="profile-grid">
            <div className="settings-field">
              <label>เพศ:</label>
              <select value={profile.gender} onChange={(e) => setProfile({ ...profile, gender: e.target.value })}>
                <option value="male">ชาย</option>
                <option value="female">หญิง</option>
              </select>
            </div>
            <div className="settings-field">
              <label>อายุ (ปี):</label>
              <input type="number" min="10" max="100" value={profile.age} onChange={(e) => setProfile({ ...profile, age: e.target.value })} />
            </div>
            <div className="settings-field">
              <label>น้ำหนัก (kg):</label>
              <input type="number" min="30" max="200" value={profile.weight} onChange={(e) => setProfile({ ...profile, weight: e.target.value })} />
            </div>
            <div className="settings-field">
              <label>ส่วนสูง (cm):</label>
              <input type="number" min="120" max="220" value={profile.height} onChange={(e) => setProfile({ ...profile, height: e.target.value })} />
            </div>
          </div>

          <div className="settings-field">
            <label>ระดับกิจกรรมในชีวิตประจำวัน:</label>
            <select value={profile.activity} onChange={(e) => setProfile({ ...profile, activity: Number(e.target.value) })}>
              <option value={1.2}>นั่งทำงานอยู่กับที่ แทบไม่ได้ออกกำลังกาย (1.2x)</option>
              <option value={1.375}>ออกกำลังกายเบาๆ 1-3 วัน/สัปดาห์ (1.375x)</option>
              <option value={1.55}>ออกกำลังกายปานกลาง 3-5 วัน/สัปดาห์ (1.55x)</option>
              <option value={1.725}>ออกกำลังกายหนัก 6-7 วัน/สัปดาห์ (1.725x)</option>
            </select>
          </div>

          <div className="settings-field">
            <label>เป้าหมายการจัดการน้ำหนัก:</label>
            <select value={profile.goalDiff} onChange={(e) => setProfile({ ...profile, goalDiff: Number(e.target.value) })}>
              <option value={-500}>ลดน้ำหนัก (-500 kcal/วัน)</option>
              <option value={-300}>ลีนไขมันแบบค่อยเป็นค่อยไป (-300 kcal/วัน)</option>
              <option value={0}>รักษาน้ำหนักตัวให้คงที่ (สมดุล TDEE)</option>
              <option value={300}>เพิ่มกล้ามเนื้อ / เพิ่มน้ำหนัก (+300 kcal/วัน)</option>
            </select>
          </div>

          <div className="settings-field">
            <label>โหมดแจ้งเตือนโรคประจำตัว / เป้าหมายสุขภาพพิเศษ:</label>
            <select value={healthCondition} onChange={(e) => setHealthCondition(e.target.value)}>
              {HEALTH_CONDITIONS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="tdee-preview-card">
            <div>BMR พื้นฐาน: <strong>{bmr} kcal</strong></div>
            <div>พลังงานที่ใช้จริง (TDEE): <strong>{tdee} kcal</strong></div>
            <div>เป้าหมายที่แนะนำสำหรับคุณ: <strong className="tdee-highlight">{calculatedTargetKcal} kcal/วัน</strong></div>
          </div>

          <div className="settings-actions">
            <button type="submit" className="save-settings-btn">✅ ใช้เป้าหมาย {calculatedTargetKcal} kcal/วัน</button>
            <button type="button" className="cancel-settings-btn" onClick={() => setShowProfileCalc(false)}>ปิด</button>
          </div>
        </form>
      )}

      {showRefModal && (
        <div className="ref-panel">
          <div className="ref-panel-header">
            <h3>📚 มาตรฐานและแหล่งอ้างอิงทางวิชาการ (Official References)</h3>
            <button type="button" className="close-ref-btn" onClick={() => setShowRefModal(false)}>✕</button>
          </div>
          <div className="ref-list">
            {references.map((ref, idx) => (
              <div key={idx} className="ref-item">
                <div className="ref-org"><strong>[{ref.code}]</strong> {ref.organization}</div>
                <div className="ref-desc">{ref.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showSettings && (
        <form className="settings-panel" onSubmit={handleSaveSettings}>
          <h3>🔑 ตั้งค่า Gemini Vision API Key & เป้าหมายรายวัน</h3>
          <div className="settings-field">
            <label>
              Google Gemini API Key (ขอฟรีได้ที่{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                Google AI Studio ↗
              </a>
              ):
            </label>
            <div className="key-input-group">
              <input
                type="password"
                placeholder="วาง API Key ที่ขึ้นต้นด้วย AIzaSy..."
                value={geminiKey}
                onChange={(e) => { setGeminiKey(e.target.value); setKeyStatus(null); }}
              />
              <button
                type="button"
                className="verify-key-btn"
                onClick={handleVerifyApiKey}
                disabled={testingKey}
              >
                {testingKey ? 'กำลังตรวจ...' : '🔍 ทดสอบ Key'}
              </button>
            </div>
            {keyStatus && (
              <div className={`key-status-msg ${keyStatus.ok ? 'key-ok' : 'key-err'}`}>
                {keyStatus.msg}
              </div>
            )}
          </div>
          <div className="settings-field">
            <label>กำหนดเป้าหมายแคลอรี่ต่อวันด้วยตนเอง (kcal):</label>
            <input
              type="number"
              min="800"
              max="5000"
              step="50"
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Number(e.target.value))}
            />
          </div>
          <div className="settings-field">
            <label>โหมดดูแลสุขภาพ / โรคประจำตัว:</label>
            <select value={healthCondition} onChange={(e) => setHealthCondition(e.target.value)}>
              {HEALTH_CONDITIONS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="settings-actions">
            <button type="submit" className="save-settings-btn">✅ บันทึกและเปิดใช้งาน</button>
            <button type="button" className="cancel-settings-btn" onClick={() => setShowSettings(false)}>ปิด</button>
          </div>
        </form>
      )}

      <main className="main">
        {/* แถบสถานะการเชื่อมต่อ AI Vision สำหรับการรันจริงบนเว็บ */}
        <div className={`ai-connection-bar ${geminiKey.trim() ? 'ai-bar-connected' : 'ai-bar-prompt'}`}>
          <div>
            {geminiKey.trim() ? (
              <span>🟢 <strong>Gemini Vision AI: พร้อมใช้งานจริง</strong> (รองรับการสแกนรูปอาหารทุกชนิด)</span>
            ) : (
              <span>🔑 <strong>ยังไม่ได้ใส่ Gemini API Key:</strong> กดตั้งค่าเพื่อเชื่อมต่อ AI Vision สำหรับสแกนรูปถ่ายจริง</span>
            )}
          </div>
          <button
            type="button"
            className="ai-bar-btn"
            onClick={() => { setShowSettings(true); setShowProfileCalc(false); setShowRefModal(false); }}
          >
            {geminiKey.trim() ? 'เปลี่ยน Key' : 'ใส่ API Key'}
          </button>
        </div>

        {/* แถบสลับโหมด: สแกนด้วยรูปภาพ vs ค้นหาจากฐานข้อมูล 30 เมนู */}
        <div className="mode-tabs">
          <button
            type="button"
            className={`mode-tab ${activeTab === 'scan' ? 'mode-tab-active' : ''}`}
            onClick={() => setActiveTab('scan')}
          >
            📸 สแกนรูปอาหาร / กล้อง
          </button>
          <button
            type="button"
            className={`mode-tab ${activeTab === 'search' ? 'mode-tab-active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            🔍 ค้นหาและเลือกเมนู ({menus.length} เมนู)
          </button>
        </div>

        {activeTab === 'scan' ? (
          <Camera onImageCaptured={handleImageCaptured} />
        ) : (
          <div className="menu-browser-box">
            <input
              type="text"
              className="menu-search-input"
              placeholder="🔎 พิมพ์ชื่ออาหาร เช่น กระเพรา, ส้มตำ, ข้าวมันไก่, Pad Thai..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="cat-filter-row">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`cat-chip ${selectedCategory === cat ? 'cat-chip-active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="menu-catalog-grid">
              {filteredMenus.map((m) => {
                const defaultKcal = Math.round((m.energy_kcal_per_100g * m.default_weight_g) / 100)
                const defaultProt = Number(((m.protein_g_per_100g * m.default_weight_g) / 100).toFixed(1))
                return (
                  <div key={m.id} className="catalog-item" onClick={() => handleSelectMenuManually(m)}>
                    <div>
                      <div className="catalog-name">{m.name_th}</div>
                      <div className="catalog-sub">
                        {m.category} • 1 หน่วย ({m.default_weight_g}g) • โปรตีน {defaultProt}g
                      </div>
                    </div>
                    <div className="catalog-right">
                      <span className="catalog-kcal">{defaultKcal} kcal</span>
                      <span className="catalog-add-btn">+ เลือก</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p>กำลังวิเคราะห์ภาพและคำนวณสารอาหารตามตาราง Thai FCD...</p>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {result && !showConfirm && (
          <ResultCard
            result={result}
            menus={menus}
            healthCondition={healthCondition}
            onUpdateMenuOrWeight={handleUpdateMenuOrWeight}
          />
        )}

        {showConfirm && result && (
          <ConfirmationModal
            question={result.confirmation_question}
            menus={menus}
            currentMenuId={result.menu_id}
            onConfirm={(correctionMenuId) => handleConfirmation(correctionMenuId)}
            onDecline={() => setShowConfirm(false)}
          />
        )}

        {/* ประวัติการสแกนอาหาร + ปุ่มส่งออก CSV */}
        <section className="history-section">
          <div className="history-header-flex">
            <h3>📋 ประวัติการบันทึกมื้ออาหาร ({history.length})</h3>
            {history.length > 0 && (
              <button type="button" className="export-csv-btn" onClick={handleExportCSV}>
                📥 ส่งออกรายงาน CSV (Excel)
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="history-empty">ยังไม่มีประวัติการสแกน ลองเลือกเมนูตัวอย่างหรืออัปโหลดรูปอาหารด้านบน</div>
          ) : (
            <div className="history-list">
              {history.map((item) => (
                <div key={item.id} className="history-item">
                  <div className="history-info" onClick={() => { setResult(item); setPredictionId(item.id); }}>
                    <div className="history-name">
                      {item.menu_name_th}
                      {item.fcd_code && <span className="history-fcd-tag">{item.fcd_code}</span>}
                    </div>
                    <div className="history-meta">
                      {item.estimated_weight_g}g • โปรตีน {item.protein_g}g • คาร์บ {item.carb_g}g • ไขมัน {item.fat_g}g • โซเดียม {item.sodium_mg ?? 800}mg
                    </div>
                  </div>
                  <div className="history-right">
                    <span className="history-kcal">{item.energy_kcal} kcal</span>
                    <button
                      type="button"
                      className="history-del-btn"
                      onClick={() => handleDeleteLog(item.id)}
                      title="ลบรายการนี้"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ฟุตเตอร์รับรองความน่าเชื่อถือทางวิชาการ */}
        <footer className="academic-footer">
          <div className="footer-title">🏛️ มาตรฐานอ้างอิงข้อมูลโภชนาการ (Reference Standards)</div>
          <p>
            • <strong>Thai FCD:</strong> ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย สถาบันโภชนาการ มหาวิทยาลัยมหิดล (INMU)<br />
            • <strong>Thai RDI / DRI:</strong> สำนักโภชนาการ กรมอนามัย และสำนักงานคณะกรรมการอาหารและยา (อย.) กระทรวงสาธารณสุข<br />
            • <strong>International Standards:</strong> FAO/WHO Atwater Energy Conversion & Mifflin-St Jeor BMR/TDEE Equation
          </p>
        </footer>
      </main>
    </div>
  )
}

export default App
