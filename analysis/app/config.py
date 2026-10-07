import os

from pydantic import BaseModel, Field


class Settings(BaseModel):
    embedding_model: str = Field(
        default_factory=lambda: os.getenv(
            "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
        )
    )
    mongo_uri: str = Field(
        default_factory=lambda: os.getenv(
            "MONGODB_URI", "mongodb://localhost:27017/component_request_triage"
        )
    )
    mongo_database: str = Field(
        default_factory=lambda: os.getenv("MONGODB_DATABASE", "component_request_triage")
    )
    relevance_threshold: float = Field(
        default_factory=lambda: float(os.getenv("RELEVANCE_THRESHOLD", "0.35")),
        ge=0,
        le=1,
    )
    llm_provider: str = Field(
        default_factory=lambda: os.getenv("LLM_PROVIDER", "openai_compatible")
    )
    llm_api_key: str | None = Field(
        default_factory=lambda: os.getenv("LLM_API_KEY") or None
    )
    llm_base_url: str = Field(
        default_factory=lambda: os.getenv(
            "LLM_BASE_URL", "https://api.openai.com/v1"
        )
    )
    llm_model: str = Field(
        default_factory=lambda: os.getenv("LLM_MODEL", "gpt-4o-mini")
    )
    llm_timeout_seconds: float = Field(
        default_factory=lambda: float(os.getenv("LLM_TIMEOUT_SECONDS", "8")),
        gt=0,
        le=120,
    )
    max_results: int = 3


settings = Settings()