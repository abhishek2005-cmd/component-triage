from contextlib import asynccontextmanager

from fastapi import FastAPI
from pymongo import MongoClient

from .config import settings
from .llm import draft_reply, no_match_refusal
from .retrieval import FaissPartRetriever, extract_category, extract_quantity
from .schemas import AnalysisRequest, AnalysisResult

retriever = FaissPartRetriever()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    with MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=5000) as mongo:
        mongo.admin.command("ping")
        parts = list(
            mongo[settings.mongo_database]["parts"].find({}, {"_id": 0})
        )
        retriever.build_index(parts)
        yield


app = FastAPI(title="Component Request Triage Analysis", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze", response_model=AnalysisResult)
def analyze(request: AnalysisRequest) -> AnalysisResult:
    matches = retriever.search(request.request_text)
    needs_human_review = not matches
    categories = retriever.categories

    return AnalysisResult(
        category=extract_category(request.request_text, categories),
        quantity=extract_quantity(request.request_text, categories),
        matches=matches,
        needsHumanReview=needs_human_review,
        draftReply=draft_reply(request.request_text, matches),
        refusalMessage=no_match_refusal() if needs_human_review else None,
    )
