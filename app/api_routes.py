"""Frontend API routes under /api prefix."""

import uuid

from fastapi import APIRouter, HTTPException

from app.api_schemas import (
    WebChatRequest,
    WebChatResponse,
    WebRecommendRequest,
    WebRecommendResponse,
    MethodRecommendation,
    SafetyElimination,
    SideEffectItem,
)
from engine.models import UserProfile, OutcomeLog, ReferralCreate, ReferralClaim
from engine.method_catalog import build_method_payload, all_methods_list
from engine.pipeline import run_recommendation
from engine.recommender import load_system_prompt
from services.facilities import find_nearest_facilities, get_outcome_analytics, log_outcome
from services.referrals import create_referral, list_referrals, update_referral, referral_counts
from services.knowledge import query_all_collections
from app.openai_client import chat_completion

router = APIRouter()

AGE_MAP = {"under_18": 17, "18-24": 21, "25-34": 30, "35-44": 40, "45+": 47}
RED_FLAG_FLAGS = {
    "high_blood_pressure",
    "migraines_aura",
    "blood_clots",
    "diabetes",
    "liver_disease",
    "breast_cancer",
}
PREF_MAP = {
    "set_forget": "long_acting",
    "daily_control": "daily",
    "non_hormonal": "non_hormonal",
    "unsure": "daily",
}


def _fallback_chat_reply(message: str) -> str:
    text = message.lower()
    if "breast" in text:
        return (
            "If you are breastfeeding, options that are often considered include lactational amenorrhea "
            "in the first 6 months when strict criteria are met, progestogen-only pills, implants, injectables, "
            "IUDs, and condoms. A clinic or CHW should confirm what is safest for your health history."
        )
    if "side effect" in text or "bleeding" in text:
        return (
            "Some side effects, such as irregular bleeding or mild headaches, can happen with hormonal methods "
            "and may settle with time. Heavy bleeding, severe pain, chest pain, fainting, or symptoms that worry "
            "you should be checked at a clinic promptly."
        )
    if "clinic" in text or "facility" in text:
        return "Use the clinic finder to look for nearby family planning services, or speak with a CHW for referral support."
    return (
        "I can help with contraception options, side effects, breastfeeding considerations, and clinic access. "
        "For a personalized recommendation, start the guided consultation and answer the five quick questions."
    )


def _to_user_profile(body: WebRecommendRequest) -> UserProfile:
    health_risk = any(f in RED_FLAG_FLAGS for f in body.health_flags)
    clinic_access = body.access == "clinic"
    return UserProfile(
        age=AGE_MAP[body.age_group],
        breastfeeding=body.breastfeeding,
        health_risk=health_risk,
        preference=PREF_MAP.get(body.preference, "daily"),
        clinic_access=clinic_access,
        parity=body.parity,
        language=body.language,
        district=body.district,
        channel="web",
    )


@router.post("/recommend", response_model=WebRecommendResponse)
def api_recommend(body: WebRecommendRequest):
    profile = _to_user_profile(body)
    result = run_recommendation(profile)

    recommendations = []
    for scored in result.ranked_methods[:2]:
        mec_cat = result.safety.mec_categories.get(scored.method, 1)
        payload = build_method_payload(scored.method, mec_category=mec_cat)
        recommendations.append(MethodRecommendation(**payload))

    eliminations = []
    for method_id in result.safety.eliminated:
        reason = next((w for w in result.safety.warnings if method_id in w.lower()), f"MEC category {result.safety.mec_categories.get(method_id, 3)}")
        eliminations.append(SafetyElimination(method=method_id, reason=reason or "Not recommended for this profile"))

    return WebRecommendResponse(
        recommendations=recommendations,
        safety_eliminations=eliminations,
        recommendation_text=result.recommendation_text,
    )


@router.post("/chat", response_model=WebChatResponse)
def api_chat(body: WebChatRequest):
    session_id = body.session_id or str(uuid.uuid4())
    rag = query_all_collections(body.message, num_results=2)
    context = "\n".join(rag[:2]) if rag else ""
    system = load_system_prompt()
    try:
        reply = chat_completion(
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f"Context:\n{context}\n\nUser ({body.language}): {body.message}"},
            ],
            max_tokens=400,
            temperature=0.6,
        )
    except Exception as exc:
        reply = _fallback_chat_reply(body.message)

    quick = []
    if body.context and body.context.get("mode") == "side_effects":
        quick = ["Thank you", "Find a clinic"]
    return WebChatResponse(
        reply=reply.strip(),
        quick_replies=quick,
        state=body.context.get("mode") if body.context else None,
        session_id=session_id,
    )


@router.get("/facilities")
def api_facilities(district: str, country: str | None = None, limit: int = 5):
    items = find_nearest_facilities(district, limit=limit, country=country)
    facilities = []
    for f in items:
        services = (f.get("services") or "Family planning").split(",")
        facilities.append(
            {
                "name": f["name"],
                "district": f["district"],
                "lat": f.get("lat"),
                "lng": f.get("lng"),
                "services": [s.strip() for s in services if s.strip()],
                "phone": f.get("phone", "N/A"),
                "hours": "Mon–Fri 8am–5pm",
                "country": f.get("country", ""),
            }
        )
    return {"facilities": facilities, "district": district}


@router.get("/methods")
def api_methods():
    return {"methods": all_methods_list()}


@router.post("/outcomes")
def api_outcomes(body: OutcomeLog):
    ok = log_outcome(
        body.district,
        body.recommended_method,
        body.accepted,
        body.chosen_method,
        body.notes,
        chw_id=body.chw_id,
        followup=body.followup,
        followup_at=body.followup_at,
        session_id=body.session_id,
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Could not log outcome")
    return {"status": "logged"}


@router.get("/analytics/outcomes")
def api_analytics(district: str | None = None):
    return get_outcome_analytics(district=district)


@router.post("/referrals")
def api_create_referral(body: ReferralCreate):
    row = create_referral(
        district=body.district,
        channel=body.channel,
        method_interest=body.method_interest,
        notes=body.notes,
    )
    if not row:
        raise HTTPException(status_code=500, detail="Could not create referral")
    return row


@router.get("/referrals")
def api_list_referrals(district: str | None = None, status: str | None = "open", limit: int = 50):
    return {
        "referrals": list_referrals(district=district, status=status, limit=limit),
        "counts": referral_counts(district=district),
    }


@router.patch("/referrals/{referral_id}")
def api_update_referral(referral_id: int, body: ReferralClaim):
    row = update_referral(referral_id, status=body.status, chw_id=body.chw_id)
    if not row:
        raise HTTPException(status_code=404, detail="Referral not found")
    return row
