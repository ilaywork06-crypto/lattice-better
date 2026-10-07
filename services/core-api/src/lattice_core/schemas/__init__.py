"""Typed commands (inputs) and views (outputs) — the shapes of the API.

Commands are what a use case accepts; views are what a query returns. Both are
plain Pydantic models with no behaviour, shared by the services and the HTTP
layer, so the API contract is written down in exactly one place.
"""
