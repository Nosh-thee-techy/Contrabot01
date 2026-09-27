"""Anonymous CHW referral queue (no phone numbers stored)."""

from __future__ import annotations

import secrets
import string
from typing import Optional

from sqlalchemy.orm import Session

from services.database import Referral, get_db


def _short_code(length: int = 4) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "CB-" + "".join(secrets.choice(alphabet) for _ in range(length))


def create_referral(
    district: str,
    channel: str = "web",
    method_interest: Optional[str] = None,
    notes: Optional[str] = None,
) -> Optional[dict]:
    db: Session = get_db()
    try:
        code = _short_code()
        # Extremely unlikely collision; retry a few times
        for _ in range(5):
            existing = db.query(Referral).filter(Referral.code == code).first()
            if not existing:
                break
            code = _short_code()

        row = Referral(
            code=code,
            district=(district or "Unknown").strip(),
            channel=(channel or "web").strip().lower(),
            method_interest=method_interest,
            status="open",
            notes=notes,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return _to_dict(row)
    except Exception:
        db.rollback()
        return None
    finally:
        db.close()


def list_referrals(district: Optional[str] = None, status: Optional[str] = "open", limit: int = 50) -> list[dict]:
    db: Session = get_db()
    try:
        query = db.query(Referral)
        if district:
            query = query.filter(Referral.district.ilike(f"%{district}%"))
        if status:
            query = query.filter(Referral.status == status)
        rows = query.order_by(Referral.id.desc()).limit(limit).all()
        return [_to_dict(r) for r in rows]
    except Exception:
        return []
    finally:
        db.close()


def update_referral(referral_id: int, status: str = "claimed", chw_id: Optional[str] = None) -> Optional[dict]:
    db: Session = get_db()
    try:
        row = db.query(Referral).filter(Referral.id == referral_id).first()
        if not row:
            return None
        if status not in ("open", "claimed", "completed"):
            status = "claimed"
        row.status = status
        if chw_id:
            row.claimed_by_chw_id = chw_id
        db.commit()
        db.refresh(row)
        return _to_dict(row)
    except Exception:
        db.rollback()
        return None
    finally:
        db.close()


def referral_counts(district: Optional[str] = None) -> dict:
    db: Session = get_db()
    try:
        query = db.query(Referral)
        if district:
            query = query.filter(Referral.district.ilike(f"%{district}%"))
        rows = query.all()
        counts = {"open": 0, "claimed": 0, "completed": 0, "total": len(rows)}
        for r in rows:
            if r.status in counts:
                counts[r.status] += 1
        return counts
    except Exception:
        return {"open": 0, "claimed": 0, "completed": 0, "total": 0}
    finally:
        db.close()


def _to_dict(row: Referral) -> dict:
    return {
        "id": row.id,
        "code": row.code,
        "district": row.district,
        "channel": row.channel,
        "method_interest": row.method_interest,
        "status": row.status,
        "claimed_by_chw_id": row.claimed_by_chw_id,
        "notes": row.notes,
        "created_at": row.created_at,
    }
