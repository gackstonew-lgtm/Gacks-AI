"""GACKS AI Assistant OS — Vector Embeddings & Similarity Service"""

import math
import hashlib
from typing import List, Dict, Any

class EmbeddingsService:
    def __init__(self, default_dim: int = 384):
        self.default_dim = default_dim

    def _hash_vector(self, text: str, dimensions: int) -> List[float]:
        """Generates deterministic unit-normalized semantic pseudo-embeddings without heavy ML dependencies."""
        words = text.lower().split()
        vector = [0.0] * dimensions
        
        for idx, word in enumerate(words):
            h = hashlib.sha256(f"{word}:{idx % 16}".encode("utf-8")).digest()
            for d in range(dimensions):
                byte_val = h[d % len(h)]
                val = ((byte_val / 255.0) - 0.5) * 2.0
                vector[d] += val
        
        # Normalize to unit length
        norm = math.sqrt(sum(x * x for x in vector))
        if norm > 0:
            vector = [round(x / norm, 6) for x in vector]
        else:
            vector = [0.0] * dimensions
            if dimensions > 0:
                vector[0] = 1.0
        return vector

    def generate_embeddings(self, texts: List[str], dimensions: int = 384) -> Dict[str, Any]:
        """Generates vector embeddings for a batch of text strings."""
        if not texts:
            return {
                "success": False,
                "error": "No texts provided for embedding generation",
                "embeddings": [],
                "dimensions": dimensions,
                "count": 0
            }
        
        embeddings = [self._hash_vector(t, dimensions) for t in texts]
        return {
            "success": True,
            "embeddings": embeddings,
            "dimensions": dimensions,
            "count": len(embeddings)
        }

    def cosine_similarity(self, vec_a: List[float], vec_b: List[float]) -> float:
        """Calculates cosine similarity between two vectors."""
        if len(vec_a) != len(vec_b) or not vec_a:
            return 0.0
        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(a * a for a in vec_a))
        norm_b = math.sqrt(sum(b * b for b in vec_b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return max(0.0, min(1.0, dot / (norm_a * norm_b)))

embeddings_service = EmbeddingsService()
