"""The errors the domain and application layers raise.

Each class carries a stable machine-readable ``code`` and maps to exactly one
HTTP status in the API layer, so the meaning of an error is decided where it is
raised — not re-guessed by every route.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True, slots=True)
class Issue:
    """One precise problem: a form field, a spreadsheet cell, a payload key."""

    message: str
    field: str | None = None
    label: str | None = None
    sheet: str | None = None
    cell: str | None = None
    row: int | None = None
    column: str | None = None

    def as_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}

    def describe(self) -> str:
        where = self.label or self.field or self.cell
        return f"{where}: {self.message}" if where else self.message


class LatticeError(Exception):
    """Base of every expected, explainable failure."""

    code = "error"
    status = 400

    def __init__(self, message: str, issues: list[Issue] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.issues = list(issues or [])


class RuleViolation(LatticeError):
    """The request is well-formed but breaks a domain rule."""

    code = "rule_violation"
    status = 400


class ValidationFailed(LatticeError):
    """One or more values are invalid; ``issues`` lists every one of them."""

    code = "validation_failed"
    status = 400

    @classmethod
    def from_issues(cls, issues: list[Issue], summary: str | None = None) -> ValidationFailed:
        return cls(summary or "; ".join(i.describe() for i in issues), issues)


class NotFound(LatticeError):
    code = "not_found"
    status = 404

    def __init__(self, what: str, ident: object | None = None) -> None:
        super().__init__(f"{what} not found" if ident is None else f"{what} #{ident} not found")


class Conflict(LatticeError):
    """The operation clashes with existing state (a duplicate, a dependency)."""

    code = "conflict"
    status = 409


class PermissionDenied(LatticeError):
    code = "forbidden"
    status = 403


class Unauthenticated(LatticeError):
    code = "unauthenticated"
    status = 401
