"""GACKS AI Assistant OS — Semantic RAG & Context Retrieval Service"""

from typing import List, Dict, Any
from .embeddings_service import embeddings_service

class RagService:
    def __init__(self):
        pass

    def query_documents(
        self,
        query: str,
        documents: List[Dict[str, Any]],
        top_k: int = 3,
        similarity_threshold: float = 0.3
    ) -> Dict[str, Any]:
        """Retrieves most relevant document chunks based on semantic similarity."""
        if not query or not documents:
            return {
                "success": False,
                "error": "Query or documents list empty",
                "query": query,
                "matches": [],
                "total_candidates": 0
            }

        dim = 256
        query_vec = embeddings_service._hash_vector(query, dim)
        scored_matches = []

        for doc in documents:
            doc_id = doc.get("id", "unknown")
            content = doc.get("content", "")
            metadata = doc.get("metadata", {})
            
            if not content:
                continue

            doc_vec = embeddings_service._hash_vector(content, dim)
            similarity = embeddings_service.cosine_similarity(query_vec, doc_vec)

            # Keyword overlap boost
            query_words = set(query.lower().split())
            doc_words = set(content.lower().split())
            overlap = len(query_words.intersection(doc_words)) / max(1, len(query_words))
            
            hybrid_score = round(similarity * 0.7 + overlap * 0.3, 4)

            if hybrid_score >= similarity_threshold:
                scored_matches.append({
                    "id": doc_id,
                    "content": content,
                    "score": hybrid_score,
                    "similarity": round(similarity, 4),
                    "metadata": metadata
                })

        scored_matches.sort(key=lambda x: x["score"], reverse=True)
        top_matches = scored_matches[:top_k]

        return {
            "success": True,
            "query": query,
            "matches": top_matches,
            "total_candidates": len(documents)
        }

rag_service = RagService()
