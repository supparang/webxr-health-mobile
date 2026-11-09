# backend/app/services/prediction.py
import random
import numpy as np
from PIL import Image
from typing import Optional
from app.services.nutrition import MENU_DATABASE, get_menu_by_id, calculate_nutrition


CONFIRMATION_THRESHOLD = 0.70
UNCERTAINTY_BASE = 0.15  # 15%


def mock_classify_image(image: Image.Image) -> tuple:
    """
    จำลองโมเดลจำแนกภาพอาหาร
    ในงานวิจัยจริงให้แทนที่ด้วยโมเดล PyTorch/TensorFlow ที่ฝึกมาแล้ว
    """
    # จำลองการทำนายแบบมีความน่าจะเป็นหลายคลาส
    menus = MENU_DATABASE.copy()
    random.shuffle(menus)
    
    # สร้าง softmax probabilities แบบสุ่ม
    logits = np.random.rand(len(menus))
    logits[0] += 2.0  # ให้คลาสแรกมีโอกาสสูงสุด
    exp_logits = np.exp(logits - np.max(logits))
    probs = exp_logits / exp_logits.sum()
    
    top_idx = int(np.argmax(probs))
    top_menu = menus[top_idx]
    confidence = float(probs[top_idx])
    
    return top_menu, confidence


def estimate_portion(image: Image.Image, menu: dict) -> float:
    """
    จำลองการประเมินปริมาณอาหารจากภาพ
    ในงานวิจัยจริงใช้ object detection / depth estimation / reference object
    """
    base_weight = menu["default_weight_g"]
    # สุ่มค่า ±20% เพื่อจำลองความคลาดเคลื่อน
    variation = random.uniform(0.8, 1.2)
    return round(base_weight * variation, 1)


def predict_nutrition(image: Image.Image, image_path: str) -> dict:
    menu, confidence = mock_classify_image(image)
    estimated_weight = estimate_portion(image, menu)
    nutrition = calculate_nutrition(menu, estimated_weight)
    
    # คำนวณความไม่แน่นอน
    uncertainty = UNCERTAINTY_BASE + (1 - confidence) * 0.3
    energy_uncertainty = nutrition["energy_kcal"] * uncertainty
    
    needs_confirmation = confidence < CONFIRMATION_THRESHOLD
    
    confirmation_question = None
    if needs_confirmation:
        confirmation_question = f"เมนูนี้ใช่ “{menu['name_th']}” หรือไม่?"
    
    return {
        "menu_id": menu["id"],
        "menu_name_th": menu["name_th"],
        "confidence": round(confidence, 3),
        "estimated_weight_g": estimated_weight,
        "energy_kcal": nutrition["energy_kcal"],
        "protein_g": nutrition["protein_g"],
        "carb_g": nutrition["carb_g"],
        "fat_g": nutrition["fat_g"],
        "uncertainty": round(energy_uncertainty, 1),
        "needs_confirmation": needs_confirmation,
        "confirmation_question": confirmation_question,
    }
