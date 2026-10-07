"""Presenters: ORM rows → view models (``lattice_core.schemas``).

Ids are what the database stores; people read names. Everything here resolves
stored values into displayable ones next to the raw value, so the UI never
has to fetch a catalog or the user list just to render one item.
"""
