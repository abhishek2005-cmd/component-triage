from collections.abc import Callable, Sequence
import re

import faiss
import numpy as np

from .config import settings
from .embeddings import embed_texts
from .schemas import CatalogPart, PartMatch


class FaissPartRetriever:
    def __init__(
        self,
        embedder: Callable[[Sequence[str]], np.ndarray] = embed_texts,
        top_k: int = settings.max_results,
        relevance_threshold: float = settings.relevance_threshold,
    ) -> None:
        self._embedder = embedder
        self._top_k = min(max(top_k, 1), 3)
        self._relevance_threshold = relevance_threshold
        self._index: faiss.Index | None = None
        self._parts: list[CatalogPart] = []

    @property
    def categories(self) -> list[str]:
        return sorted({part.category for part in self._parts})

    def build_index(self, parts: Sequence[CatalogPart | dict]) -> None:
        self._parts = [
            part if isinstance(part, CatalogPart) else CatalogPart.model_validate(part)
            for part in parts
        ]

        if not self._parts:
            self._index = None
            return

        vectors = self._embedder([part.searchableText for part in self._parts])
        index = faiss.IndexFlatIP(vectors.shape[1])
        index.add(vectors)
        self._index = index

    def search(self, query: str) -> list[PartMatch]:
        if self._index is None or not query.strip():
            return []

        query_vector = self._embedder([query])
        result_count = min(self._top_k, self._index.ntotal)
        scores, indices = self._index.search(query_vector, result_count)

        matches = []
        for score, index in zip(scores[0], indices[0]):
            if index < 0 or score < self._relevance_threshold:
                continue
            matches.append(
                PartMatch(part=self._parts[index], relevance_score=float(score))
            )
        return matches


def extract_category(request_text: str, categories: Sequence[str]) -> str | None:
    normalized_text = _normalize_text(request_text)

    for category in sorted(set(categories), key=len, reverse=True):
        normalized_category = _normalize_text(category)
        patterns = (normalized_category, f"{normalized_category}s")
        if any(
            re.search(rf"(?<![a-z0-9]){re.escape(pattern)}(?![a-z0-9])", normalized_text)
            for pattern in patterns
        ):
            return category
    return None


def extract_quantity(
    request_text: str, categories: Sequence[str] = ()
) -> int | None:
    patterns = (
        r"\b(?:qty|quantity|count)\s*(?:(?:is|of)\s*)?(?:[:=]\s*)?(\d+)\b",
        r"\b(\d+)\s*(?:pcs?|pieces?|units?|components?|parts?)\b",
        r"\b(?:need|require|order|buy)\s+(\d+)(?=\s*(?:of\b|$|[,;!?]))",
    )

    for pattern in patterns:
        match = re.search(pattern, request_text, flags=re.IGNORECASE)
        if match:
            quantity = int(match.group(1))
            return quantity if quantity > 0 else None

    normalized_text = _normalize_text(request_text)
    for category in categories:
        normalized_category = _normalize_text(category)
        category_pattern = rf"(?<![a-z0-9])(\d+)\s+{re.escape(normalized_category)}s?(?![a-z0-9])"
        match = re.search(category_pattern, normalized_text)
        if match:
            quantity = int(match.group(1))
            return quantity if quantity > 0 else None

    return None


def _normalize_text(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", value.casefold()))