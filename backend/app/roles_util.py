"""Multi-role helpers for Person.roles (comma-separated)."""

from __future__ import annotations

ALLOWED_ROLES = ("family", "member", "volunteer", "donor", "corporate")


def parse_roles(person) -> list[str]:
    raw = getattr(person, "roles", None) or ""
    roles = [r.strip() for r in raw.split(",") if r.strip()]
    if not roles and getattr(person, "role_primary", None):
        roles = [person.role_primary]
    # always include primary
    primary = getattr(person, "role_primary", None)
    if primary and primary not in roles:
        roles.insert(0, primary)
    # de-dupe preserve order
    seen = set()
    out = []
    for r in roles:
        if r in seen:
            continue
        if r not in ALLOWED_ROLES:
            continue
        seen.add(r)
        out.append(r)
    return out or ["family"]


def has_role(person, role: str) -> bool:
    return role in parse_roles(person)


def serialize_roles(roles: list[str]) -> str:
    clean = []
    seen = set()
    for r in roles:
        r = (r or "").strip().lower()
        if r not in ALLOWED_ROLES or r in seen:
            continue
        seen.add(r)
        clean.append(r)
    return ",".join(clean) if clean else "family"


def pick_primary(roles: list[str]) -> str:
    for preferred in ("family", "member", "volunteer", "donor", "corporate"):
        if preferred in roles:
            return preferred
    return roles[0] if roles else "family"
