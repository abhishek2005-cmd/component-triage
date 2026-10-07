from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AnalysisRequest(BaseModel):
    request_text: str


class CatalogPart(BaseModel):
    model_config = ConfigDict(extra="ignore")

    partNumber: str
    name: str
    category: str
    keySpecs: dict[str, Any]
    package: str
    price: float
    stock: int
    searchableText: str


class PartMatch(BaseModel):
    part: CatalogPart
    relevance_score: float


class AnalysisResult(BaseModel):
    category: str | None = None
    quantity: int | None = None
    matches: list[PartMatch] = Field(default_factory=list)
    needsHumanReview: bool
    draftReply: str
    refusalMessage: str | None = None