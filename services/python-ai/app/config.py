"""GACKS AI Assistant OS — Python AI Service Configuration"""

import os
from typing import List

PORT: int = int(os.getenv("PYTHON_SERVICE_PORT", "8790"))
HOST: str = os.getenv("PYTHON_SERVICE_HOST", "127.0.0.1")
DEBUG: bool = os.getenv("PYTHON_DEBUG", "0") == "1"

ALLOWED_ORIGINS: List[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8787",
    "http://127.0.0.1:8787",
    "http://localhost:3000",
    "https://gacks-ai.vercel.app",
]

SERVICE_NAME: str = "gacks-python-ai-core"
SERVICE_VERSION: str = "2.0.0"
PROTOCOL_VERSION: str = "1.0"
