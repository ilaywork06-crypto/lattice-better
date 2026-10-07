"""File storage for uploaded documents.

The stored name is a random key, never the user's file name, so an upload can't
choose where it lands or overwrite another one. The interface is small on
purpose: swapping the local disk for object storage means one new class.
"""

from __future__ import annotations

import secrets
import shutil
from pathlib import Path
from typing import BinaryIO, Protocol

from lattice_core.domain.errors import RuleViolation

_CHUNK = 1024 * 1024


class FileStorage(Protocol):
    def save(self, stream: BinaryIO, *, suffix: str, max_bytes: int, name: str) -> tuple[str, int]:
        """Store the stream; returns ``(key, size)``."""

    def copy(self, key: str) -> str: ...

    def delete(self, key: str) -> None: ...

    def path(self, key: str) -> Path: ...

    def exists(self, key: str) -> bool: ...


class LocalFileStorage:
    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _new_key(suffix: str) -> str:
        return f"{secrets.token_hex(16)}{suffix[:16].lower()}"

    def save(self, stream: BinaryIO, *, suffix: str, max_bytes: int, name: str) -> tuple[str, int]:
        key = self._new_key(suffix)
        target = self.root / key
        size = 0
        try:
            with target.open("wb") as fh:
                while chunk := stream.read(_CHUNK):
                    size += len(chunk)
                    if size > max_bytes:
                        raise RuleViolation(
                            f"'{name}' is larger than the {max_bytes // (1024 * 1024)} MB limit"
                        )
                    fh.write(chunk)
        except BaseException:
            target.unlink(missing_ok=True)
            raise
        return key, size

    def copy(self, key: str) -> str:
        new_key = self._new_key(Path(key).suffix)
        shutil.copyfile(self.path(key), self.root / new_key)
        return new_key

    def delete(self, key: str) -> None:
        (self.root / key).unlink(missing_ok=True)

    def path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if path.parent != self.root:
            raise RuleViolation("Invalid storage key")
        return path

    def exists(self, key: str) -> bool:
        return self.path(key).exists()
