"""The application layer: one class per area, one method per use case.

Use cases receive typed commands (``lattice_core.schemas``), enforce the domain
rules, write through repositories and record what happened in the audit log.
They never commit on their own — the Unit of Work does, once, around the whole
use case — so an approved change request that runs several use cases is still
one transaction.
"""
