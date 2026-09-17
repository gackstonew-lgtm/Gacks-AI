"""GACKS AI Assistant OS — Python AI Service Main Entrypoint"""

import sys
import time
import json
from .config import PORT, HOST, SERVICE_NAME, SERVICE_VERSION, PROTOCOL_VERSION
from .services.vision_service import vision_service
from .services.embeddings_service import embeddings_service
from .services.rag_service import rag_service
from .services.speech_service import speech_service
from .services.document_service import document_service

# Attempt to load FastAPI / Uvicorn; fallback to Python standard library http.server
try:
    from fastapi import FastAPI, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
    USE_FASTAPI = True
except ImportError:
    USE_FASTAPI = False

if USE_FASTAPI:
    app = FastAPI(
        title="GACKS Python AI Core",
        description="Specialized AI/ML, Vision, Speech, RAG, and Document Intelligence Service",
        version=SERVICE_VERSION
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health():
        return {
            "ok": True,
            "service": SERVICE_NAME,
            "version": SERVICE_VERSION,
            "protocolVersion": PROTOCOL_VERSION,
            "status": "ONLINE",
            "timestamp": time.time(),
            "capabilities": [
                "vision",
                "ocr",
                "embeddings",
                "rag",
                "speech_analysis",
                "document_intelligence"
            ]
        }

    @app.get("/capabilities")
    async def capabilities():
        return {
            "service": SERVICE_NAME,
            "version": SERVICE_VERSION,
            "capabilities": {
                "vision": {"enabled": True, "modes": ["ocr", "layout", "screen", "features"]},
                "embeddings": {"enabled": True, "default_dim": 384},
                "rag": {"enabled": True, "hybrid_ranking": True},
                "speech": {"enabled": True, "formats": ["wav", "mp3", "webm", "pcm"]},
                "documents": {"enabled": True, "entity_extraction": True}
            }
        }

    @app.post("/api/v1/vision/analyze")
    async def vision_analyze(req: Request):
        body = await req.json()
        return vision_service.analyze_image(
            image_base64=body.get("image_base64") or body.get("image"),
            mode=body.get("mode", "ocr"),
            prompt=body.get("prompt")
        )

    @app.post("/api/v1/embeddings/create")
    async def embeddings_create(req: Request):
        body = await req.json()
        texts = body.get("texts", [])
        dim = int(body.get("dimensions", 384))
        return embeddings_service.generate_embeddings(texts, dim)

    @app.post("/api/v1/rag/query")
    async def rag_query(req: Request):
        body = await req.json()
        query = body.get("query", "")
        docs = body.get("documents", [])
        top_k = int(body.get("top_k", 3))
        threshold = float(body.get("similarity_threshold", 0.3))
        return rag_service.query_documents(query, docs, top_k, threshold)

    @app.post("/api/v1/speech/transcribe")
    async def speech_transcribe(req: Request):
        body = await req.json()
        audio = body.get("audio_base64") or body.get("audio")
        fmt = body.get("audio_format", "wav")
        lang = body.get("language", "en")
        return speech_service.analyze_audio(audio, fmt, lang)

    @app.post("/api/v1/documents/process")
    async def document_process(req: Request):
        body = await req.json()
        content = body.get("content", "")
        mime = body.get("mime_type", "text/plain")
        entities = body.get("extract_entities", True)
        tables = body.get("extract_tables", False)
        return document_service.process_document(content, mime, entities, tables)

else:
    # Standard library fallback server
    from http.server import HTTPServer, BaseHTTPRequestHandler

    class FallbackHandler(BaseHTTPRequestHandler):
        def _send_json(self, status: int, payload: dict):
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.end_headers()
            self.wfile.write(json.dumps(payload).encode("utf-8"))

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.end_headers()

        def do_GET(self):
            if self.path in ("/health", "/api/v1/health"):
                self._send_json(200, {
                    "ok": True,
                    "service": SERVICE_NAME,
                    "version": SERVICE_VERSION,
                    "protocolVersion": PROTOCOL_VERSION,
                    "status": "ONLINE",
                    "timestamp": time.time(),
                    "capabilities": [
                        "vision", "ocr", "embeddings", "rag", "speech_analysis", "document_intelligence"
                    ]
                })
            elif self.path == "/capabilities":
                self._send_json(200, {
                    "service": SERVICE_NAME,
                    "version": SERVICE_VERSION,
                    "capabilities": {
                        "vision": {"enabled": True, "modes": ["ocr", "layout", "screen", "features"]},
                        "embeddings": {"enabled": True, "default_dim": 384},
                        "rag": {"enabled": True, "hybrid_ranking": True},
                        "speech": {"enabled": True, "formats": ["wav", "mp3", "webm", "pcm"]},
                        "documents": {"enabled": True, "entity_extraction": True}
                    }
                })
            else:
                self._send_json(404, {"error": "Not found"})

        def do_POST(self):
            content_len = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_len) if content_len > 0 else b'{}'
            try:
                body = json.loads(body_bytes.decode('utf-8'))
            except Exception:
                body = {}

            if self.path == "/api/v1/vision/analyze":
                res = vision_service.analyze_image(
                    image_base64=body.get("image_base64") or body.get("image"),
                    mode=body.get("mode", "ocr"),
                    prompt=body.get("prompt")
                )
                self._send_json(200, res)
            elif self.path == "/api/v1/embeddings/create":
                res = embeddings_service.generate_embeddings(
                    body.get("texts", []),
                    int(body.get("dimensions", 384))
                )
                self._send_json(200, res)
            elif self.path == "/api/v1/rag/query":
                res = rag_service.query_documents(
                    body.get("query", ""),
                    body.get("documents", []),
                    int(body.get("top_k", 3)),
                    float(body.get("similarity_threshold", 0.3))
                )
                self._send_json(200, res)
            elif self.path == "/api/v1/speech/transcribe":
                res = speech_service.analyze_audio(
                    body.get("audio_base64") or body.get("audio"),
                    body.get("audio_format", "wav"),
                    body.get("language", "en")
                )
                self._send_json(200, res)
            elif self.path == "/api/v1/documents/process":
                res = document_service.process_document(
                    body.get("content", ""),
                    body.get("mime_type", "text/plain"),
                    body.get("extract_entities", True),
                    body.get("extract_tables", False)
                )
                self._send_json(200, res)
            else:
                self._send_json(404, {"error": "Not found"})

def run_server():
    print(f"====================================================")
    print(f" GACKS AI ASSISTANT OS — PYTHON AI CORE SERVICE")
    print(f"====================================================")
    print(f"Service: {SERVICE_NAME} v{SERVICE_VERSION}")
    print(f"Listening on: http://{HOST}:{PORT}")
    print(f"Health Endpoint: http://{HOST}:{PORT}/health")
    print(f"Capabilities: Vision, Embeddings, RAG, Speech, Documents")
    print(f"====================================================")
    
    if USE_FASTAPI:
        import uvicorn
        uvicorn.run(app, host=HOST, port=PORT, log_level="info")
    else:
        server = HTTPServer((HOST, PORT), FallbackHandler)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            server.server_close()

if __name__ == "__main__":
    run_server()
