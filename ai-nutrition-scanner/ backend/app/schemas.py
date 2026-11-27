from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime


class MenuItemResponse(BaseModel):
    id: str
    fcd_code: Optional[str] = None
    name_th: str
    name_en: Optional[str] = None
    category: str
    default_weight_g: float
    energy_kcal_per_100g: float
    protein_g_per_100g: float
    carb_g_per_100g: float
    fat_g_per_100g: float
    fiber_g_per_100g: Optional[float] = 1.2
    sugar_g_per_100g: Optional[float] = 2.0
    sodium_mg_per_100g: Optional[float] = 400
    cholesterol_mg_per_100g: Optional[float] = 35
    micronutrients: Optional[List[str]] = None
    reference_source: Optional[str] = None

    class Config:
        from_attributes = True


class PredictionResponse(BaseModel):
    prediction_id: Optional[int] = None
    menu_id: str
    fcd_code: Optional[str] = None
    menu_name_th: str
    menu_name_en: Optional[str] = None
    category: Optional[str] = None
    confidence: float
    estimated_weight_g: float
    energy_kcal: float
    protein_g: float
    carb_g: float
    fat_g: float
    fiber_g: Optional[float] = None
    sugar_g: Optional[float] = None
    sodium_mg: Optional[float] = None
    cholesterol_mg: Optional[float] = None
    thai_rdi_percent: Optional[Dict[str, float]] = None
    micronutrients: Optional[List[str]] = None
    reference_source: Optional[str] = None
    uncertainty: float
    needs_confirmation: bool
    confirmation_question: Optional[str] = None
    health_score: Optional[int] = None
    health_advice: Optional[str] = None
    analysis_source: Optional[str] = "local"


class ConfirmationRequest(BaseModel):
    prediction_id: int
    confirmed: bool
    correction: Optional[str] = None
    custom_weight_g: Optional[float] = None


class ConfirmationResponse(BaseModel):
    status: str
    menu_id: Optional[str] = None
    fcd_code: Optional[str] = None
    menu_name_th: Optional[str] = None
    menu_name_en: Optional[str] = None
    category: Optional[str] = None
    estimated_weight_g: Optional[float] = None
    updated_energy_kcal: Optional[float] = None
    protein_g: Optional[float] = None
    carb_g: Optional[float] = None
    fat_g: Optional[float] = None
    fiber_g: Optional[float] = None
    sugar_g: Optional[float] = None
    sodium_mg: Optional[float] = None
    cholesterol_mg: Optional[float] = None
    thai_rdi_percent: Optional[Dict[str, float]] = None
    micronutrients: Optional[List[str]] = None
    reference_source: Optional[str] = None
    health_score: Optional[int] = None
    health_advice: Optional[str] = None
