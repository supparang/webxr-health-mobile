# backend/app/schemas.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MenuItemResponse(BaseModel):
    id: str
    name_th: str
    name_en: Optional[str]
    category: str
    default_weight_g: float
    energy_kcal_per_100g: float
    protein_g_per_100g: float
    carb_g_per_100g: float
    fat_g_per_100g: float

    class Config:
        from_attributes = True


class PredictionResponse(BaseModel):
    menu_id: str
    menu_name_th: str
    confidence: float
    estimated_weight_g: float
    energy_kcal: float
    protein_g: float
    carb_g: float
    fat_g: float
    uncertainty: float
    needs_confirmation: bool
    confirmation_question: Optional[str]


class ConfirmationRequest(BaseModel):
    prediction_id: int
    confirmed: bool
    correction: Optional[str] = None


class ConfirmationResponse(BaseModel):
    status: str
    updated_energy_kcal: Optional[float]
