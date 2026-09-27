from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ContraceptiveMethod(str, Enum):
    COC = "coc"
    POP = "pop"
    INJECTABLE = "injectable"
    IMPLANT = "implant"
    IUD_COPPER = "iud_copper"
    IUD_LNG = "iud_lng"
    CONDOM = "condom"
    EMERGENCY = "emergency"
    LAM = "lam"
    STERILIZATION = "sterilization"


METHOD_LABELS = {
    ContraceptiveMethod.COC: "Combined oral contraceptive (pill)",
    ContraceptiveMethod.POP: "Progestogen-only pill",
    ContraceptiveMethod.INJECTABLE: "Injectable (DMPA)",
    ContraceptiveMethod.IMPLANT: "Contraceptive implant",
    ContraceptiveMethod.IUD_COPPER: "Copper IUD",
    ContraceptiveMethod.IUD_LNG: "Hormonal IUD (LNG)",
    ContraceptiveMethod.CONDOM: "Male/female condom",
    ContraceptiveMethod.EMERGENCY: "Emergency contraception",
    ContraceptiveMethod.LAM: "Lactational amenorrhea (LAM)",
    ContraceptiveMethod.STERILIZATION: "Permanent sterilization",
}


LOCAL_NAMES = {
    ContraceptiveMethod.COC: ["vidonge", "pills", "pips"],
    ContraceptiveMethod.POP: ["vidonge vya kunyonyesha", "pop"],
    ContraceptiveMethod.INJECTABLE: ["sindano", "depo", "depo-provera"],
    ContraceptiveMethod.IMPLANT: ["njiti", "kipandikizi", "implant"],
    ContraceptiveMethod.IUD_COPPER: ["coil", "kitanzi", "iud"],
    ContraceptiveMethod.IUD_LNG: ["hormonal coil", "kitanzi cha homoni"],
    ContraceptiveMethod.CONDOM: ["mpira", "condom", "juala", "socks"],
    ContraceptiveMethod.EMERGENCY: ["p2", "emergency pill", "dharura"],
    ContraceptiveMethod.LAM: ["lam", "kunyonyesha"],
    ContraceptiveMethod.STERILIZATION: ["kufunga kizazi", "vasectomy", "tubal ligation"],
}


METHOD_METADATA = {
    ContraceptiveMethod.COC: {
        "effectiveness": 0.91,
        "convenience_daily": 0.95,
        "convenience_laa": 0.2,
        "cost_score": 0.8,
        "reversibility": 0.95,
        "side_effect_score": 0.65,
        "requires_clinic": False,
        "duration": "Daily pill",
        "cost": "Low",
    },
    ContraceptiveMethod.POP: {
        "effectiveness": 0.91,
        "convenience_daily": 0.9,
        "convenience_laa": 0.25,
        "cost_score": 0.85,
        "reversibility": 0.95,
        "side_effect_score": 0.75,
        "requires_clinic": False,
        "duration": "Daily pill",
        "cost": "Low",
    },
    ContraceptiveMethod.INJECTABLE: {
        "effectiveness": 0.94,
        "convenience_daily": 0.3,
        "convenience_laa": 0.95,
        "cost_score": 0.7,
        "reversibility": 0.7,
        "side_effect_score": 0.6,
        "requires_clinic": True,
        "duration": "Every 3 months",
        "cost": "Moderate",
    },
    ContraceptiveMethod.IMPLANT: {
        "effectiveness": 0.99,
        "convenience_daily": 0.2,
        "convenience_laa": 0.98,
        "cost_score": 0.65,
        "reversibility": 0.75,
        "side_effect_score": 0.55,
        "requires_clinic": True,
        "duration": "3-5 years",
        "cost": "Moderate",
    },
    ContraceptiveMethod.IUD_COPPER: {
        "effectiveness": 0.99,
        "convenience_daily": 0.15,
        "convenience_laa": 0.9,
        "cost_score": 0.75,
        "reversibility": 0.9,
        "side_effect_score": 0.7,
        "requires_clinic": True,
        "duration": "5-10 years",
        "cost": "Moderate",
    },
    ContraceptiveMethod.IUD_LNG: {
        "effectiveness": 0.99,
        "convenience_daily": 0.15,
        "convenience_laa": 0.9,
        "cost_score": 0.6,
        "reversibility": 0.85,
        "side_effect_score": 0.65,
        "requires_clinic": True,
        "duration": "3-6 years",
        "cost": "Higher",
    },
    ContraceptiveMethod.CONDOM: {
        "effectiveness": 0.85,
        "convenience_daily": 0.7,
        "convenience_laa": 0.7,
        "cost_score": 0.95,
        "reversibility": 1.0,
        "side_effect_score": 0.95,
        "requires_clinic": False,
        "duration": "Per use",
        "cost": "Very low",
    },
    ContraceptiveMethod.EMERGENCY: {
        "effectiveness": 0.75,
        "convenience_daily": 0.5,
        "convenience_laa": 0.5,
        "cost_score": 0.9,
        "reversibility": 1.0,
        "side_effect_score": 0.8,
        "requires_clinic": False,
        "duration": "One-time",
        "cost": "Low",
    },
    ContraceptiveMethod.LAM: {
        "effectiveness": 0.98,
        "convenience_daily": 0.6,
        "convenience_laa": 0.5,
        "cost_score": 1.0,
        "reversibility": 1.0,
        "side_effect_score": 1.0,
        "requires_clinic": False,
        "duration": "While breastfeeding",
        "cost": "Free",
    },
    ContraceptiveMethod.STERILIZATION: {
        "effectiveness": 0.99,
        "convenience_daily": 0.1,
        "convenience_laa": 0.99,
        "cost_score": 0.5,
        "reversibility": 0.1,
        "side_effect_score": 0.85,
        "requires_clinic": True,
        "duration": "Permanent",
        "cost": "Moderate",
    },
}


class UserProfile(BaseModel):
    name: Optional[str] = None
    gender: str = "female"  # "female" or "male"
    age: int = Field(ge=10, le=55)
    breastfeeding: bool = False
    health_risk: bool = False  # hypertension, migraine with aura, or clot history
    preference: str = "daily"  # "daily" or "long_acting"
    clinic_access: bool = True
    parity: bool = False
    language: str = "english"
    district: Optional[str] = None
    region: Optional[str] = None
    channel: str = "web"


class SafetyScreenResult(BaseModel):
    eliminated: list[str]
    mec_categories: dict[str, int]
    warnings: list[str]
    eligible: list[str]


class ScoredMethod(BaseModel):
    method: str
    label: str
    score: float
    breakdown: dict[str, float]


class RecommendationResult(BaseModel):
    profile: UserProfile
    safety: SafetyScreenResult
    ranked_methods: list[ScoredMethod]
    recommendation_text: str
    top_method: str
    rag_context: list[str] = []
    disclaimer: str = "Please visit a clinic or CHW to confirm your choice before starting any method."


class OutcomeLog(BaseModel):
    district: str
    recommended_method: str
    accepted: bool
    chosen_method: Optional[str] = None
    notes: Optional[str] = None
    chw_id: Optional[str] = None
    followup: Optional[str] = None
    followup_at: Optional[str] = None
    session_id: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    profile: Optional[UserProfile] = None


class RecommendRequest(BaseModel):
    profile: UserProfile


class ReferralCreate(BaseModel):
    district: str
    channel: str = "web"
    method_interest: Optional[str] = None
    notes: Optional[str] = None


class ReferralClaim(BaseModel):
    chw_id: Optional[str] = None
    status: str = "claimed"
