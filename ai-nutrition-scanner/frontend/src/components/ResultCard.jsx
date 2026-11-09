// frontend/src/components/ResultCard.jsx
import React from 'react'

function ResultCard({ result }) {
  const confidenceClass = result.confidence >= 0.7 ? 'confidence-high' : 'confidence-low'
  const confidenceText = result.confidence >= 0.7 ? 'ความมั่นใจสูง' : 'ความมั่นใจต่ำ'

  return (
    <div className="result-card">
      <h2>{result.menu_name_th}</h2>
      <span className={`confidence-badge ${confidenceClass}`}>
        {confidenceText} ({(result.confidence * 100).toFixed(1)}%)
      </span>
      
      <div className="nutrient-grid">
        <div className="nutrient-item">
          <div className="nutrient-value">{result.energy_kcal}</div>
          <div className="nutrient-label">พลังงาน (kcal)</div>
        </div>
        <div className="nutrient-item">
          <div className="nutrient-value">{result.estimated_weight_g}g</div>
          <div className="nutrient-label">น้ำหนักประมาณ</div>
        </div>
        <div className="nutrient-item">
          <div className="nutrient-value">{result.protein_g}g</div>
          <div className="nutrient-label">โปรตีน</div>
        </div>
        <div className="nutrient-item">
          <div className="nutrient-value">{result.carb_g}g</div>
          <div className="nutrient-label">คาร์โบไฮเดรต</div>
        </div>
        <div className="nutrient-item">
          <div className="nutrient-value">{result.fat_g}g</div>
          <div className="nutrient-label">ไขมัน</div>
        </div>
        <div className="nutrient-item">
          <div className="nutrient-value">±{result.uncertainty}</div>
          <div className="nutrient-label">ค่าคลาดเคลื่อน (kcal)</div>
        </div>
      </div>
      
      <div className="uncertainty-note">
        ค่าที่แสดงเป็นค่าประมาณ อาจคลาดเคลื่อน ±{result.uncertainty} kcal 
        ขึ้นอยู่กับปริมาณ วิธีปรุง และมุมกล้อง
      </div>
      
      <div className="disclaimer">
        คำเตือน: ระบบนี้ให้ค่าประมาณสำหรับการเรียนรู้และติดตามทั่วไปเท่านั้น 
        ไม่ใช่เครื่องมือวินิจฉัยหรือรักษาโรค
      </div>
    </div>
  )
}

export default ResultCard
