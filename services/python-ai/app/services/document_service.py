"""GACKS AI Assistant OS — Document Intelligence & Parsing Service"""

import re
from typing import Dict, Any, List

class DocumentService:
    def __init__(self):
        pass

    def process_document(
        self,
        content: str,
        mime_type: str = "text/plain",
        extract_entities: bool = True,
        extract_tables: bool = False
    ) -> Dict[str, Any]:
        """Extracts structured entities, summaries, and key points from text/documents."""
        if not content:
            return {
                "success": False,
                "error": "Document content is empty",
                "word_count": 0,
                "character_count": 0,
                "entities": [],
                "key_points": []
            }

        words = content.split()
        word_count = len(words)
        char_count = len(content)

        entities: List[Dict[str, str]] = []
        if extract_entities:
            # Email extraction
            emails = re.findall(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", content)
            for email in emails[:10]:
                entities.append({"type": "EMAIL", "value": email})

            # URL extraction
            urls = re.findall(r"https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)", content)
            for url in urls[:10]:
                entities.append({"type": "URL", "value": url})

            # Financial/Currency extraction
            currencies = re.findall(r"\$[\d,]+(?:\.\d{2})?|\b[A-Z]{3}\s*\d+(?:\.\d{2})?", content)
            for curr in currencies[:10]:
                entities.append({"type": "CURRENCY", "value": curr})

        # Key sentences
        sentences = [s.strip() for s in re.split(r"[.!?]+", content) if len(s.strip()) > 15]
        key_points = sentences[:5]

        summary = (
            " ".join(key_points[:2]) if key_points else content[:200]
        )

        return {
            "success": True,
            "word_count": word_count,
            "character_count": char_count,
            "summary": summary,
            "entities": entities,
            "key_points": key_points,
            "metadata": {
                "mime_type": mime_type,
                "extracted_entities_count": len(entities),
                "has_tables": extract_tables and "|" in content
            }
        }

document_service = DocumentService()
