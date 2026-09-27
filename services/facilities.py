import math
from typing import Optional

from sqlalchemy.orm import Session

from services.database import Facility, Outcome, get_db


def find_facilities_by_coords(lat: float, lng: float, limit: int = 3) -> list[dict]:
    db: Session = get_db()
    try:
        facilities = db.query(Facility).filter(Facility.lat.isnot(None), Facility.lng.isnot(None)).all()
        if not facilities:
            return []
        
        # simple distance calculation
        def dist(f):
            return math.sqrt((f.lat - lat) ** 2 + (f.lng - lng) ** 2)
            
        facilities.sort(key=dist)
        return [
            {
                "name": f.name,
                "district": f.district,
                "country": f.country,
                "phone": f.phone or "N/A",
                "services": f.services or "Family planning",
                "lat": f.lat,
                "lng": f.lng,
            }
            for f in facilities[:limit]
        ]
    except Exception:
        return []
    finally:
        db.close()


def find_nearest_facilities(district: str, limit: int = 3, country: Optional[str] = None) -> list[dict]:
    db: Session = get_db()
    try:
        query = db.query(Facility).filter(Facility.district.ilike(f"%{district}%"))
        if country:
            query = query.filter(Facility.country.ilike(f"%{country}%"))
        facilities = query.limit(limit).all()
        if not facilities:
            facilities = db.query(Facility).limit(limit).all()
        return [
            {
                "name": f.name,
                "district": f.district,
                "country": f.country,
                "phone": f.phone or "N/A",
                "services": f.services or "Family planning",
                "lat": f.lat,
                "lng": f.lng,
            }
            for f in facilities
        ]
    except Exception:
        return _fallback_facilities(district, limit)
    finally:
        db.close()


def _fallback_facilities(district: str, limit: int) -> list[dict]:
    samples = [
        {"name": "Nairobi West Health Centre", "district": "Nairobi", "country": "Kenya", "phone": "+254700000001", "services": "FP, ANC"},
        {"name": "Kampala City Clinic", "district": "Kampala", "country": "Uganda", "phone": "+256700000001", "services": "FP, HIV"},
        {"name": "Kibera Community Dispensary", "district": "Nairobi", "country": "Kenya", "phone": "+254700000002", "services": "FP"},
    ]
    matched = [f for f in samples if district.lower() in f["district"].lower()]
    return (matched or samples)[:limit]


def format_facilities_message(facilities: list[dict], max_chars: int = 160) -> str:
    if not facilities:
        return "No clinics found. Ask your CHW or dial local health line."
    parts = []
    for i, f in enumerate(facilities[:2], 1):
        clinic_info = f"{i}. {f['name']} ({f['district']}) {f['phone']}"
        if max_chars > 200:
            if f.get("lat") is not None and f.get("lng") is not None:
                gmaps = f"https://www.google.com/maps/search/?api=1&query={f['lat']},{f['lng']}"
            else:
                q = f"{f['name']} {f['district']}".replace(" ", "+")
                gmaps = f"https://www.google.com/maps/search/?api=1&query={q}"
            clinic_info += f" Map: {gmaps}"
        parts.append(clinic_info)
    msg = "Nearest clinics: " + " | ".join(parts)
    return msg[:max_chars]


def log_outcome(
    district: str,
    recommended_method: str,
    accepted: bool,
    chosen_method: Optional[str] = None,
    notes: Optional[str] = None,
    chw_id: Optional[str] = None,
    followup: Optional[str] = None,
    followup_at: Optional[str] = None,
    session_id: Optional[str] = None,
) -> bool:
    db = get_db()
    try:
        db.add(
            Outcome(
                district=district,
                recommended_method=recommended_method,
                accepted=accepted,
                chosen_method=chosen_method,
                notes=notes,
                chw_id=chw_id,
                followup=followup,
                followup_at=followup_at,
                session_id=session_id,
            )
        )
        db.commit()
        return True
    except Exception:
        db.rollback()
        return False
    finally:
        db.close()


def get_outcome_analytics(district: Optional[str] = None) -> dict:
    db = get_db()
    try:
        query = db.query(Outcome)
        if district:
            query = query.filter(Outcome.district.ilike(f"%{district}%"))
        rows = query.all()

        by_method: dict[str, int] = {}
        by_district: dict[str, int] = {}
        accepted = 0
        for row in rows:
            by_method[row.recommended_method] = by_method.get(row.recommended_method, 0) + 1
            by_district[row.district] = by_district.get(row.district, 0) + 1
            if row.accepted:
                accepted += 1

        return {
            "total": len(rows),
            "accepted": accepted,
            "acceptance_rate": round((accepted / len(rows)) * 100) if rows else 0,
            "by_method": by_method,
            "by_district": by_district,
        }
    except Exception:
        return {"total": 0, "accepted": 0, "acceptance_rate": 0, "by_method": {}, "by_district": {}}
    finally:
        db.close()
