# GACKS Python AI Core Service

Specialized AI, Machine Learning, Computer Vision, Speech Processing, Vector Embeddings, and Semantic RAG service for the **GACKS AI Assistant Operating System**.

## Responsibilities
- **Computer Vision & OCR**: Screen inspection, UI element bounding boxes, document layout recognition, visual features.
- **Vector Embeddings & Semantic Search**: Normalized vector embedding generation, cosine similarity calculation, dense document index retrieval.
- **Semantic RAG**: Multi-document chunk ranking, keyword-boosted similarity retrieval.
- **Speech Processing & Acoustic Intelligence**: Audio feature extraction, waveform energy analysis, speech preprocessing.
- **Document Intelligence**: Entity extraction (emails, URLs, currencies), document summarization, key point extraction.

## Running the Service
```bash
# Optional virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run service (defaults to http://127.0.0.1:8790)
python -m app.main
```

## Health & Capabilities
- Health: `GET http://127.0.0.1:8790/health`
- Capabilities: `GET http://127.0.0.1:8790/capabilities`
