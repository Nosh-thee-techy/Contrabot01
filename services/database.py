import csv
import os
from pathlib import Path
from typing import Optional

from sqlalchemy import Boolean, Column, Float, Integer, String, Text, create_engine, func
from sqlalchemy.orm import Session, declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://contrabot:contrabot@localhost:5432/contrabot")

try:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    # Test connection to check if DB is running
    with engine.connect() as conn:
        pass
except Exception as exc:
    print(f"PostgreSQL connection failed ({DATABASE_URL}): {exc}")
    print("Falling back to local SQLite database: contrabot.db")
    DATABASE_URL = "sqlite:///contrabot.db"
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


class Facility(Base):
    __tablename__ = "facilities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    district = Column(String(128), nullable=False, index=True)
    country = Column(String(64), nullable=False, default="Kenya")
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    services = Column(Text, nullable=True)
    phone = Column(String(32), nullable=True)


class Outcome(Base):
    __tablename__ = "outcomes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    district = Column(String(128), nullable=False, index=True)
    recommended_method = Column(String(64), nullable=False)
    accepted = Column(Boolean, nullable=False)
    chosen_method = Column(String(64), nullable=True)
    notes = Column(Text, nullable=True)
    chw_id = Column(String(64), nullable=True, index=True)
    followup = Column(String(32), nullable=True)
    followup_at = Column(String(32), nullable=True)
    session_id = Column(String(64), nullable=True, index=True)
    created_at = Column(String(32), server_default=func.now())


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(16), nullable=False, unique=True, index=True)
    district = Column(String(128), nullable=False, index=True)
    channel = Column(String(32), nullable=False, default="web")
    method_interest = Column(String(64), nullable=True)
    status = Column(String(32), nullable=False, default="open", index=True)
    claimed_by_chw_id = Column(String(64), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(String(32), server_default=func.now())


def init_db() -> None:
    try:
        Base.metadata.create_all(bind=engine)
        _ensure_columns()
    except Exception as exc:
        print(f"Database init skipped: {exc}")


def _ensure_columns() -> None:
    """Add MVP columns on existing SQLite/Postgres tables without a full migration tool."""
    alterations = [
        ("outcomes", "chw_id", "VARCHAR(64)"),
        ("outcomes", "followup", "VARCHAR(32)"),
        ("outcomes", "followup_at", "VARCHAR(32)"),
        ("outcomes", "session_id", "VARCHAR(64)"),
    ]
    try:
        with engine.begin() as conn:
            for table, column, col_type in alterations:
                try:
                    conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
                except Exception:
                    pass
    except Exception as exc:
        print(f"Schema ensure skipped: {exc}")


def get_db() -> Session:
    return SessionLocal()


def import_facilities_csv(csv_path: Path, country: str = "Kenya") -> int:
    """Load facilities from CSV: name,district,lat,lng,services,phone"""
    if not csv_path.exists():
        return 0
    db = get_db()
    count = 0
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                db.add(
                    Facility(
                        name=row.get("name", "").strip(),
                        district=row.get("district", "").strip(),
                        country=country,
                        lat=_float_or_none(row.get("lat")),
                        lng=_float_or_none(row.get("lng")),
                        services=row.get("services", ""),
                        phone=row.get("phone", ""),
                    )
                )
                count += 1
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"Facility import error: {exc}")
    finally:
        db.close()
    return count


def _float_or_none(value: Optional[str]) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None
