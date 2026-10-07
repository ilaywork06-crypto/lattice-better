"""The domain layer: vocabulary, rules and errors.

Nothing in this package knows about HTTP, SQL or storage. It is the part of the
system that encodes *what Lattice means* — which kinds of item exist, what may
sit inside what, how serials look, how a field value is validated — and every
other layer depends on it, never the other way round.
"""
