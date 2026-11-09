# backend/app/routers/predictions.py
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from PIL import Image

from app.database import get_db
from app import models, schemas
from app.services.prediction import predict_nutrition
from app.services.nutrition import calculate_nutrition, get_menu_by_id

router = APIRouter(prefix="/api/predictions", tags=["predictions"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/predict", response_model=schemas.PredictionResponse)
async def predict(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="ต้องเป็นไฟล์ภาพเท่านั้น")
    
    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.jpg"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    image = Image.open(filepath).convert("RGB")
    result = predict_nutrition(image, filepath)
    
    # บันทึกลงฐานข้อมูล
    log = models.PredictionLog(
        image_path=filepath,
        predicted_menu_id=result["menu_id"],
        confidence=result["confidence"],
        estimated_weight_g=result["estimated_weight_g"],
        energy_kcal=result["energy_kcal"],
        protein_g=result["protein_g"],
        carb_g=result["carb_g"],
        fat_g=result["fat_g"],
        uncertainty=result["uncertainty"],
        needs_confirmation=result["needs_confirmation"],
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    
    result["prediction_id"] = log.id
    return result


@router.post("/confirm", response_model=schemas.ConfirmationResponse)
async def confirm(data: schemas.ConfirmationRequest, db: Session = Depends(get_db)):
    log = db.query(models.PredictionLog).filter(models.PredictionLog.id == data.prediction_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="ไม่พบรายการ")
    
    log.user_confirmed = data.confirmed
    log.user_correction = data.correction
    
    updated_energy = log.energy_kcal
    if data.confirmed and data.correction:
        # ถ้าผู้ใช้แก้ไขเมนู
        menu = get_menu_by_id(data.correction)
        nutrition = calculate_nutrition(menu, log.estimated_weight_g)
        log.predicted_menu_id = data.correction
        log.energy_kcal = nutrition["energy_kcal"]
        log.protein_g = nutrition["protein_g"]
        log.carb_g = nutrition["carb_g"]
        log.fat_g = nutrition["fat_g"]
        updated_energy = nutrition["energy_kcal"]
    
    db.commit()
    
    return {
        "status": "saved",
        "updated_energy_kcal": updated_energy
    }


@router.get("/history")
async def history(db: Session = Depends(get_db)):
    logs = db.query(models.PredictionLog).order_by(models.PredictionLog.created_at.desc()).limit(20).all()
    return logs
