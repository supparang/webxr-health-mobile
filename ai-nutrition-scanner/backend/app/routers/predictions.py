import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from PIL import Image

from app.database import get_db
from app import models, schemas
from app.services.prediction import predict_nutrition, compute_health_insights
from app.services.nutrition import MENU_DATABASE, THAI_RDI_REFERENCE, calculate_nutrition, get_menu_by_id

router = APIRouter(prefix="/api/predictions", tags=["predictions"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/menus")
async def list_menus():
    return MENU_DATABASE


@router.get("/references")
async def get_references():
    return {
        "thai_rdi": THAI_RDI_REFERENCE,
        "standards": [
            {
                "code": "INMU Thai FCD",
                "organization": "สถาบันโภชนาการ มหาวิทยาลัยมหิดล (Institute of Nutrition, Mahidol University)",
                "description": "ตารางแสดงคุณค่าทางโภชนาการของอาหารไทย (Thai Food Composition Database) สำหรับวิเคราะห์ค่าพลังงาน สารอาหารหลัก วิตามิน และแร่ธาตุต่อน้ำหนักอาหาร 100 กรัม"
            },
            {
                "code": "MOPH Thai RDI / DRI 2563",
                "organization": "สำนักโภชนาการ กรมอนามัย และ อย. กระทรวงสาธารณสุข",
                "description": "ปริมาณสารอาหารอ้างอิงที่ควรได้รับประจำวันสำหรับคนไทย (Thai RDI: พลังงาน 2,000 kcal, โปรตีน 50g, คาร์โบไฮเดรต 300g, ไขมัน 65g, ใยอาหาร 25g, โซเดียมไม่เกิน 2,000 mg)"
            },
            {
                "code": "WHO / FAO Atwater System",
                "organization": "องค์การอนามัยโลก (WHO) และ องค์การอาหารและเกษตรแห่งสหประชาชาติ (FAO)",
                "description": "เกณฑ์คำนวณสัดส่วนพลังงานจากสารอาหารหลัก (โปรตีน 4 kcal/g, คาร์โบไฮเดรต 4 kcal/g, ไขมัน 9 kcal/g) และเกณฑ์จำกัดน้ำตาลอิสระไม่เกิน 24g (6 ช้อนชา) ต่อวัน"
            },
            {
                "code": "USDA FoodData Central",
                "organization": "U.S. Department of Agriculture (Agricultural Research Service)",
                "description": "ฐานข้อมูลโภชนาการมาตรฐานสากลสำหรับวัตถุดิบพื้นฐานและคอเลสเตอรอล"
            }
        ]
    }


@router.post("/predict", response_model=schemas.PredictionResponse)
async def predict(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="ต้องเป็นไฟล์ภาพเท่านั้น")

    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.jpg"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    image = Image.open(filepath).convert("RGB")
    result = predict_nutrition(image, filepath)

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

    menu = get_menu_by_id(data.correction if data.correction else log.predicted_menu_id)
    weight_g = data.custom_weight_g if data.custom_weight_g else log.estimated_weight_g
    nutrition = calculate_nutrition(menu, weight_g)
    score, advice = compute_health_insights(menu, nutrition)

    if data.correction or data.custom_weight_g:
        log.predicted_menu_id = menu["id"]
        log.estimated_weight_g = weight_g
        log.energy_kcal = nutrition["energy_kcal"]
        log.protein_g = nutrition["protein_g"]
        log.carb_g = nutrition["carb_g"]
        log.fat_g = nutrition["fat_g"]

    db.commit()

    return {
        "status": "saved",
        "menu_id": log.predicted_menu_id,
        "fcd_code": menu.get("fcd_code"),
        "menu_name_th": menu["name_th"],
        "menu_name_en": menu.get("name_en"),
        "category": menu.get("category"),
        "estimated_weight_g": log.estimated_weight_g,
        "updated_energy_kcal": log.energy_kcal,
        "protein_g": log.protein_g,
        "carb_g": log.carb_g,
        "fat_g": log.fat_g,
        "fiber_g": nutrition["fiber_g"],
        "sugar_g": nutrition["sugar_g"],
        "sodium_mg": nutrition["sodium_mg"],
        "cholesterol_mg": nutrition["cholesterol_mg"],
        "thai_rdi_percent": nutrition["thai_rdi_percent"],
        "micronutrients": menu.get("micronutrients", []),
        "reference_source": menu.get("reference_source", ""),
        "health_score": score,
        "health_advice": advice,
    }


@router.get("/history")
async def history(db: Session = Depends(get_db)):
    logs = db.query(models.PredictionLog).order_by(models.PredictionLog.created_at.desc()).limit(25).all()
    items = []
    for log in logs:
        menu = get_menu_by_id(log.predicted_menu_id)
        nutrition = calculate_nutrition(menu, log.estimated_weight_g)
        score, advice = compute_health_insights(menu, nutrition)
        items.append({
            "id": log.id,
            "prediction_id": log.id,
            "image_path": log.image_path,
            "menu_id": log.predicted_menu_id,
            "fcd_code": menu.get("fcd_code"),
            "menu_name_th": menu["name_th"],
            "menu_name_en": menu.get("name_en", ""),
            "category": menu.get("category", ""),
            "confidence": log.confidence,
            "estimated_weight_g": log.estimated_weight_g,
            "energy_kcal": log.energy_kcal,
            "protein_g": log.protein_g,
            "carb_g": log.carb_g,
            "fat_g": log.fat_g,
            "fiber_g": nutrition["fiber_g"],
            "sugar_g": nutrition["sugar_g"],
            "sodium_mg": nutrition["sodium_mg"],
            "cholesterol_mg": nutrition["cholesterol_mg"],
            "thai_rdi_percent": nutrition["thai_rdi_percent"],
            "micronutrients": menu.get("micronutrients", []),
            "reference_source": menu.get("reference_source", ""),
            "health_score": score,
            "health_advice": advice,
            "uncertainty": log.uncertainty,
            "user_confirmed": log.user_confirmed,
            "created_at": log.created_at,
        })
    return items


@router.delete("/history/{log_id}")
async def delete_history(log_id: int, db: Session = Depends(get_db)):
    log = db.query(models.PredictionLog).filter(models.PredictionLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="ไม่พบรายการ")
    db.delete(log)
    db.commit()
    return {"status": "deleted", "id": log_id}
