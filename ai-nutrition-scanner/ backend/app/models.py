# backend/app/models.py
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, JSON
from sqlalchemy.sql import func
from app.database import Base


class MenuItem(Base):
    __tablename__ = "menu_items"
    
    id = Column(String, primary_key=True, index=True)
    name_th = Column(String, nullable=False)
    name_en = Column(String, nullable=True)
    category = Column(String, nullable=False)
    default_weight_g = Column(Float, nullable=False)
    energy_kcal_per_100g = Column(Float, nullable=False)
    protein_g_per_100g = Column(Float, nullable=False)
    carb_g_per_100g = Column(Float, nullable=False)
    fat_g_per_100g = Column(Float, nullable=False)


class PredictionLog(Base):
    __tablename__ = "prediction_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    image_path = Column(String, nullable=False)
    predicted_menu_id = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    estimated_weight_g = Column(Float, nullable=False)
    energy_kcal = Column(Float, nullable=False)
    protein_g = Column(Float, nullable=False)
    carb_g = Column(Float, nullable=False)
    fat_g = Column(Float, nullable=False)
    uncertainty = Column(Float, nullable=False)
    needs_confirmation = Column(Boolean, default=False)
    user_confirmed = Column(Boolean, nullable=True)
    user_correction = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
