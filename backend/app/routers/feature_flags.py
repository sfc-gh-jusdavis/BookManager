from __future__ import annotations

from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.models.user import CurrentUser
from app.services import get_data_service

router = APIRouter(prefix="/feature-flags", tags=["feature-flags"])


class FlagDef(BaseModel):
    flag_key: str
    description: Optional[str] = None
    category: Optional[str] = None
    default_enabled: bool


class FlagOverride(BaseModel):
    flag_key: str
    target_type: str  # 'user' | 'role'
    target_value: str
    enabled: bool


class FlagWithOverrides(FlagDef):
    overrides: List[FlagOverride] = []


class ResolvedFlags(BaseModel):
    flags: Dict[str, bool]


class UpsertFlagRequest(BaseModel):
    description: Optional[str] = None
    category: Optional[str] = None
    default_enabled: bool = False


class UpsertOverrideRequest(BaseModel):
    target_type: str
    target_value: str
    enabled: bool


def _require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _resolve_flags_for_user(data, user_id: str, role: str) -> Dict[str, bool]:
    if not hasattr(data, "_cursor"):
        return {}
    cur = data._cursor()
    cur.execute(
        """
        SELECT f.FLAG_KEY,
          COALESCE(uo.ENABLED, ro.ENABLED, f.DEFAULT_ENABLED) AS RESOLVED
        FROM TEMP.JUSDAVIS.BKMNG_FEATURE_FLAGS f
        LEFT JOIN TEMP.JUSDAVIS.BKMNG_FEATURE_FLAG_OVERRIDES uo
          ON uo.FLAG_KEY = f.FLAG_KEY
          AND uo.TARGET_TYPE = 'user'
          AND LOWER(uo.TARGET_VALUE) = LOWER(%s)
        LEFT JOIN TEMP.JUSDAVIS.BKMNG_FEATURE_FLAG_OVERRIDES ro
          ON ro.FLAG_KEY = f.FLAG_KEY
          AND ro.TARGET_TYPE = 'role'
          AND LOWER(ro.TARGET_VALUE) = LOWER(%s)
        """,
        (user_id, role),
    )
    rows = cur.fetchall()
    return {r["FLAG_KEY"]: bool(r["RESOLVED"]) for r in rows}


@router.get("/me", response_model=ResolvedFlags)
async def get_my_flags(
    user: CurrentUser = Depends(get_current_user),
    data=Depends(get_data_service),
) -> ResolvedFlags:
    role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
    return ResolvedFlags(flags=_resolve_flags_for_user(data, user.user_id, role_value))


@router.get("/admin", response_model=List[FlagWithOverrides])
async def list_flags_admin(
    _: CurrentUser = Depends(_require_admin),
    data=Depends(get_data_service),
) -> List[FlagWithOverrides]:
    if not hasattr(data, "_cursor"):
        return []
    cur = data._cursor()
    cur.execute(
        "SELECT FLAG_KEY, DESCRIPTION, CATEGORY, DEFAULT_ENABLED "
        "FROM TEMP.JUSDAVIS.BKMNG_FEATURE_FLAGS ORDER BY CATEGORY, FLAG_KEY"
    )
    flags = cur.fetchall()
    cur.execute(
        "SELECT FLAG_KEY, TARGET_TYPE, TARGET_VALUE, ENABLED "
        "FROM TEMP.JUSDAVIS.BKMNG_FEATURE_FLAG_OVERRIDES"
    )
    overrides_by_flag: Dict[str, List[FlagOverride]] = {}
    for r in cur.fetchall():
        overrides_by_flag.setdefault(r["FLAG_KEY"], []).append(
            FlagOverride(
                flag_key=r["FLAG_KEY"],
                target_type=r["TARGET_TYPE"],
                target_value=r["TARGET_VALUE"],
                enabled=bool(r["ENABLED"]),
            )
        )
    return [
        FlagWithOverrides(
            flag_key=f["FLAG_KEY"],
            description=f.get("DESCRIPTION"),
            category=f.get("CATEGORY"),
            default_enabled=bool(f["DEFAULT_ENABLED"]),
            overrides=overrides_by_flag.get(f["FLAG_KEY"], []),
        )
        for f in flags
    ]


@router.put("/admin/{flag_key}")
async def upsert_flag(
    flag_key: str,
    req: UpsertFlagRequest,
    _: CurrentUser = Depends(_require_admin),
    data=Depends(get_data_service),
) -> dict[str, str]:
    if not hasattr(data, "_cursor"):
        return {"status": "not available"}
    cur = data._cursor()
    cur.execute(
        """
        MERGE INTO TEMP.JUSDAVIS.BKMNG_FEATURE_FLAGS t
        USING (SELECT %s AS k) s ON t.FLAG_KEY = s.k
        WHEN MATCHED THEN UPDATE SET
          DESCRIPTION = %s,
          CATEGORY = %s,
          DEFAULT_ENABLED = %s,
          UPDATED_AT = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT (FLAG_KEY, DESCRIPTION, CATEGORY, DEFAULT_ENABLED)
          VALUES (%s, %s, %s, %s)
        """,
        (flag_key, req.description, req.category, req.default_enabled,
         flag_key, req.description, req.category, req.default_enabled),
    )
    return {"status": "ok"}


@router.delete("/admin/{flag_key}")
async def delete_flag(
    flag_key: str,
    _: CurrentUser = Depends(_require_admin),
    data=Depends(get_data_service),
) -> dict[str, str]:
    if not hasattr(data, "_cursor"):
        return {"status": "not available"}
    cur = data._cursor()
    cur.execute(
        "DELETE FROM TEMP.JUSDAVIS.BKMNG_FEATURE_FLAG_OVERRIDES WHERE FLAG_KEY = %s",
        (flag_key,),
    )
    cur.execute(
        "DELETE FROM TEMP.JUSDAVIS.BKMNG_FEATURE_FLAGS WHERE FLAG_KEY = %s",
        (flag_key,),
    )
    return {"status": "ok"}


@router.post("/admin/{flag_key}/overrides")
async def upsert_override(
    flag_key: str,
    req: UpsertOverrideRequest,
    _: CurrentUser = Depends(_require_admin),
    data=Depends(get_data_service),
) -> dict[str, str]:
    if req.target_type not in ("user", "role"):
        raise HTTPException(status_code=400, detail="target_type must be 'user' or 'role'")
    if not hasattr(data, "_cursor"):
        return {"status": "not available"}
    cur = data._cursor()
    cur.execute(
        """
        MERGE INTO TEMP.JUSDAVIS.BKMNG_FEATURE_FLAG_OVERRIDES t
        USING (SELECT %s AS k, %s AS tt, %s AS tv) s
          ON t.FLAG_KEY = s.k AND t.TARGET_TYPE = s.tt AND t.TARGET_VALUE = s.tv
        WHEN MATCHED THEN UPDATE SET ENABLED = %s
        WHEN NOT MATCHED THEN INSERT (FLAG_KEY, TARGET_TYPE, TARGET_VALUE, ENABLED)
          VALUES (%s, %s, %s, %s)
        """,
        (flag_key, req.target_type, req.target_value, req.enabled,
         flag_key, req.target_type, req.target_value, req.enabled),
    )
    return {"status": "ok"}


@router.delete("/admin/{flag_key}/overrides/{target_type}/{target_value}")
async def delete_override(
    flag_key: str,
    target_type: str,
    target_value: str,
    _: CurrentUser = Depends(_require_admin),
    data=Depends(get_data_service),
) -> dict[str, str]:
    if not hasattr(data, "_cursor"):
        return {"status": "not available"}
    cur = data._cursor()
    cur.execute(
        "DELETE FROM TEMP.JUSDAVIS.BKMNG_FEATURE_FLAG_OVERRIDES "
        "WHERE FLAG_KEY = %s AND TARGET_TYPE = %s AND TARGET_VALUE = %s",
        (flag_key, target_type, target_value),
    )
    return {"status": "ok"}
