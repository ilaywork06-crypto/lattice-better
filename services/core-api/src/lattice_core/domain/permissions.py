"""Who may do what.

Authorization is expressed as *permissions*, not as role comparisons scattered
through the code. Routes declare the permission they need; the frontend reads
the same list from ``GET /auth/me`` and shows or hides actions accordingly, so
the two can never disagree about who may do what.

The workflow rule: only managers mutate items and templates directly. Editors
*propose* any change and viewers may propose a location change only — an
approved proposal runs the very same use case a manager would call.
"""

from __future__ import annotations

from enum import StrEnum

from lattice_core.domain.enums import ChangeAction, UserRole


class Permission(StrEnum):
    READ = "read"
    PROPOSE_CHANGES = "propose_changes"
    REVIEW_CHANGES = "review_changes"
    WRITE_ITEMS = "write_items"
    WRITE_TEMPLATES = "write_templates"
    WRITE_FIELD_GROUPS = "write_field_groups"
    STAGE_UPLOADS = "stage_uploads"
    WRITE_LOCATIONS = "write_locations"
    DELETE_LOCATIONS = "delete_locations"
    MANAGE_DESICCATOR = "manage_desiccator"
    WRITE_MAP = "write_map"
    DELETE_MAP = "delete_map"
    WRITE_THRESHOLDS = "write_thresholds"
    DELETE_THRESHOLDS = "delete_thresholds"
    MANAGE_CATALOG = "manage_catalog"
    MANAGE_USERS = "manage_users"
    IMPORT_DATA = "import_data"


_VIEWER = frozenset({Permission.READ, Permission.PROPOSE_CHANGES})
_EDITOR = _VIEWER | {
    Permission.STAGE_UPLOADS,
    Permission.WRITE_LOCATIONS,
    Permission.WRITE_MAP,
    Permission.WRITE_THRESHOLDS,
}

ROLE_PERMISSIONS: dict[UserRole, frozenset[Permission]] = {
    UserRole.VIEWER: _VIEWER,
    UserRole.EDITOR: frozenset(_EDITOR),
    UserRole.MANAGER: frozenset(Permission),
}

#: Which changes each role may *propose*.
PROPOSABLE_ACTIONS: dict[UserRole, frozenset[ChangeAction]] = {
    UserRole.VIEWER: frozenset({ChangeAction.MOVE}),
    UserRole.EDITOR: frozenset(ChangeAction),
    UserRole.MANAGER: frozenset(ChangeAction),
}


def has_permission(role: UserRole, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS[role]


def can_propose(role: UserRole, action: ChangeAction) -> bool:
    return action in PROPOSABLE_ACTIONS[role]
