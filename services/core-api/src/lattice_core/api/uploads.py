from fastapi import UploadFile

from lattice_core.services.documents import IncomingFile


def incoming(upload: UploadFile) -> IncomingFile:
    """Adapt FastAPI's upload object to the framework-free one services accept."""
    return IncomingFile(filename=upload.filename or "file", content_type=upload.content_type,
                        stream=upload.file)
