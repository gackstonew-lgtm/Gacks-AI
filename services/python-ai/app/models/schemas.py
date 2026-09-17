"""GACKS AI Assistant OS — Python AI Service Data Contracts & Schemas"""

from typing import List, Dict, Any, Optional
try:
    from pydantic import BaseModel, Field
except ImportError:
    # Fallback lightweight BaseModel if Pydantic is not yet installed
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def dict(self):
            return self.__dict__
        def model_dump(self):
            return self.__dict__

class HealthResponse(BaseModel):
    ok: bool
    service: str
    version: str
    status: str
    timestamp: float
    capabilities: List[str]

class VisionAnalysisRequest(BaseModel):
    image_base64: Optional[str] = None
    image_url: Optional[str] = None
    mode: str = "ocr"  # "ocr", "layout", "screen", "features"
    prompt: Optional[str] = None

class VisionAnalysisResult(BaseModel):
    success: bool
    mode: str
    text_content: Optional[str] = None
    elements: List[Dict[str, Any]] = []
    labels: List[str] = []
    confidence: float = 1.0
    error: Optional[str] = None

class EmbeddingRequest(BaseModel):
    texts: List[str]
    model: Optional[str] = "all-MiniLM-L6-v2"
    dimensions: Optional[int] = 384

class EmbeddingResult(BaseModel):
    success: bool
    embeddings: List[List[float]]
    dimensions: int
    count: int
    error: Optional[str] = None

class RagDocument(BaseModel):
    id: str
    content: str
    metadata: Dict[str, Any] = {}

class RagQueryRequest(BaseModel):
    query: str
    documents: List[RagDocument]
    top_k: int = 3
    similarity_threshold: float = 0.5

class RagQueryResult(BaseModel):
    success: bool
    query: str
    matches: List[Dict[str, Any]]
    total_candidates: int
    error: Optional[str] = None

class SpeechTranscriptionRequest(BaseModel):
    audio_base64: Optional[str] = None
    audio_format: str = "wav"
    language: Optional[str] = "en"

class SpeechTranscriptionResult(BaseModel):
    success: bool
    transcript: str
    confidence: float
    duration_seconds: float
    features: Dict[str, Any] = {}
    error: Optional[str] = None

class DocumentProcessRequest(BaseModel):
    content: str
    mime_type: str = "text/plain"
    extract_entities: bool = True
    extract_tables: bool = False

class DocumentProcessResult(BaseModel):
    success: bool
    word_count: int
    character_count: int
    summary: Optional[str] = None
    entities: List[Dict[str, str]] = []
    key_points: List[str] = []
    error: Optional[str] = None
