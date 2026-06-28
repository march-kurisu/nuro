"""
Living Learning Ecosystem - Backend
- Multi-auth (email/password + Emergent Google OAuth)
- Subjects, Materials (PDF/text ingestion + chunking)
- RAG chat with Claude Sonnet 4.5 (streaming)
- AI curriculum generator
- Adaptive quiz generator
- Mastery tracking
"""
import os
import re
import io
import json
import uuid
import logging
import asyncio
import requests
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt as pyjwt
from dotenv import load_dotenv
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse, JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pypdf import PdfReader

from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------- MongoDB ----------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ---------------- Config ----------------
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
SESSION_DAYS = 7
CLAUDE_MODEL = ("anthropic", "claude-sonnet-4-5-20250929")

# ---------------- App ----------------
app = FastAPI(title="Living Learning Ecosystem API")
api = APIRouter(prefix="/api")
logger = logging.getLogger("lle")
logging.basicConfig(level=logging.INFO)


# =====================================================================
# Helpers
# =====================================================================
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, pw_hash: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), pw_hash.encode())
    except Exception:
        return False


def issue_session_token() -> str:
    return f"sess_{uuid.uuid4().hex}{uuid.uuid4().hex}"


async def create_session(user_id: str) -> str:
    token = issue_session_token()
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": (now_utc() + timedelta(days=SESSION_DAYS)).isoformat(),
        "created_at": now_utc().isoformat(),
    })
    return token


async def get_user_by_token(token: str) -> Optional[dict]:
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        return None
    expires_at = sess["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        return None
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
    return user


async def require_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1].strip()
    user = await get_user_by_token(token)
    if not user:
        raise HTTPException(401, "Invalid or expired session")
    return user


# =====================================================================
# Models
# =====================================================================
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str


class SubjectIn(BaseModel):
    title: str
    description: Optional[str] = ""
    color: Optional[str] = "mint"  # mint | peach | sky | lemon | rose


class SubjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class MaterialTextIn(BaseModel):
    title: str
    content: str


class CurriculumIn(BaseModel):
    goal: str
    weeks: int = Field(ge=1, le=12)
    hours_per_week: int = Field(ge=1, le=40)


class QuizGenIn(BaseModel):
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    topic_hint: Optional[str] = None


class QuizAnswerIn(BaseModel):
    quiz_id: str
    selected_index: int


class ChatIn(BaseModel):
    message: str
    session_id: Optional[str] = None  # chat session per subject


class FocusEventIn(BaseModel):
    url: str
    on_task: bool
    title: Optional[str] = None


# =====================================================================
# Auth Routes
# =====================================================================
@api.post("/auth/register")
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    user_id = new_id("user")
    doc = {
        "user_id": user_id,
        "email": body.email.lower(),
        "name": body.name.strip(),
        "picture": "",
        "auth_provider": "password",
        "password_hash": hash_password(body.password),
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    token = await create_session(user_id)
    return {"token": token, "user": {k: v for k, v in doc.items() if k not in ("password_hash", "_id")}}


@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or user.get("auth_provider") != "password":
        raise HTTPException(401, "Invalid credentials")
    if not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid credentials")
    token = await create_session(user["user_id"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"token": token, "user": user}


@api.post("/auth/google/session")
async def google_session(body: GoogleSessionIn):
    """Exchanges Emergent session_id for our session token."""
    try:
        r = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
            timeout=10,
        )
    except Exception as e:
        raise HTTPException(502, f"Auth service unreachable: {e}")
    if r.status_code != 200:
        raise HTTPException(401, "Invalid Emergent session_id")
    data = r.json()
    email = data.get("email", "").lower()
    if not email:
        raise HTTPException(400, "No email returned from auth provider")

    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        # update picture/name if blank
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": existing.get("name") or data.get("name", ""),
                      "picture": existing.get("picture") or data.get("picture", "")}}
        )
    else:
        user_id = new_id("user")
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", "") or email.split("@")[0],
            "picture": data.get("picture", ""),
            "auth_provider": "google",
            "created_at": now_utc().isoformat(),
        })
    token = await create_session(user_id)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"token": token, "user": user}


@api.get("/auth/me")
async def me(user=Depends(require_user)):
    return user


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# =====================================================================
# Subjects
# =====================================================================
@api.get("/subjects")
async def list_subjects(user=Depends(require_user)):
    items = await db.subjects.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    # attach stats
    for s in items:
        s["material_count"] = await db.materials.count_documents({"subject_id": s["subject_id"]})
        # mastery avg
        topics = await db.mastery.find({"subject_id": s["subject_id"]}, {"_id": 0}).to_list(500)
        if topics:
            s["mastery_avg"] = round(sum(t["proficiency"] for t in topics) / len(topics))
        else:
            s["mastery_avg"] = 0
    return items


@api.post("/subjects")
async def create_subject(body: SubjectIn, user=Depends(require_user)):
    subject_id = new_id("sub")
    doc = {
        "subject_id": subject_id,
        "user_id": user["user_id"],
        "title": body.title,
        "description": body.description or "",
        "color": body.color or "mint",
        "created_at": now_utc().isoformat(),
    }
    await db.subjects.insert_one(doc)
    doc.pop("_id", None)
    doc["material_count"] = 0
    doc["mastery_avg"] = 0
    return doc


@api.get("/subjects/{subject_id}")
async def get_subject(subject_id: str, user=Depends(require_user)):
    s = await db.subjects.find_one({"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Subject not found")
    return s


@api.patch("/subjects/{subject_id}")
async def update_subject(subject_id: str, body: SubjectUpdate, user=Depends(require_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "Nothing to update")
    res = await db.subjects.update_one(
        {"subject_id": subject_id, "user_id": user["user_id"]}, {"$set": update}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Subject not found")
    s = await db.subjects.find_one({"subject_id": subject_id}, {"_id": 0})
    return s


@api.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str, user=Depends(require_user)):
    res = await db.subjects.delete_one({"subject_id": subject_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Subject not found")
    await db.materials.delete_many({"subject_id": subject_id})
    await db.chunks.delete_many({"subject_id": subject_id})
    await db.curriculum.delete_many({"subject_id": subject_id})
    await db.quizzes.delete_many({"subject_id": subject_id})
    await db.mastery.delete_many({"subject_id": subject_id})
    await db.chat_messages.delete_many({"subject_id": subject_id})
    return {"ok": True}


# =====================================================================
# Materials & Chunks (RAG ingest)
# =====================================================================
def chunk_text(text: str, size: int = 600, overlap: int = 80) -> List[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    chunks = []
    i = 0
    while i < len(text):
        chunks.append(text[i: i + size])
        i += size - overlap
    return chunks


async def _ingest_material(user_id: str, subject_id: str, title: str, content: str, mime: str):
    material_id = new_id("mat")
    pieces = chunk_text(content)
    await db.materials.insert_one({
        "material_id": material_id,
        "subject_id": subject_id,
        "user_id": user_id,
        "title": title,
        "mime": mime,
        "char_count": len(content),
        "chunk_count": len(pieces),
        "created_at": now_utc().isoformat(),
    })
    if pieces:
        await db.chunks.insert_many([
            {
                "chunk_id": new_id("chk"),
                "material_id": material_id,
                "subject_id": subject_id,
                "user_id": user_id,
                "title": title,
                "ord": idx,
                "text": piece,
            } for idx, piece in enumerate(pieces)
        ])
    return material_id, len(pieces)


@api.post("/subjects/{subject_id}/materials/text")
async def add_text_material(subject_id: str, body: MaterialTextIn, user=Depends(require_user)):
    s = await db.subjects.find_one({"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Subject not found")
    material_id, chunks = await _ingest_material(user["user_id"], subject_id, body.title, body.content, "text/plain")
    return {"material_id": material_id, "chunks": chunks}


@api.post("/subjects/{subject_id}/materials/upload")
async def upload_material(subject_id: str, file: UploadFile = File(...), user=Depends(require_user)):
    s = await db.subjects.find_one({"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Subject not found")
    raw = await file.read()
    title = file.filename or "Untitled"
    mime = file.content_type or "application/octet-stream"
    content = ""
    if title.lower().endswith(".pdf") or "pdf" in mime:
        try:
            reader = PdfReader(io.BytesIO(raw))
            content = "\n".join((p.extract_text() or "") for p in reader.pages)
        except Exception as e:
            raise HTTPException(400, f"Could not parse PDF: {e}")
    else:
        try:
            content = raw.decode("utf-8", errors="ignore")
        except Exception:
            content = ""
    if not content.strip():
        raise HTTPException(400, "No text could be extracted from file")
    material_id, chunks = await _ingest_material(user["user_id"], subject_id, title, content, mime)
    return {"material_id": material_id, "chunks": chunks, "char_count": len(content)}


@api.get("/subjects/{subject_id}/materials")
async def list_materials(subject_id: str, user=Depends(require_user)):
    items = await db.materials.find(
        {"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return items


@api.delete("/materials/{material_id}")
async def delete_material(material_id: str, user=Depends(require_user)):
    m = await db.materials.find_one({"material_id": material_id, "user_id": user["user_id"]}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Material not found")
    await db.materials.delete_one({"material_id": material_id})
    await db.chunks.delete_many({"material_id": material_id})
    return {"ok": True}


# =====================================================================
# Retrieval (keyword TF scoring)
# =====================================================================
_STOP = set("a an the and or but if then so to of for in on at by with from as is are was were be been being this that these those it its i you he she we they them their my your our his her not no do does did have has had can could should would may might will shall about into over under up down out off above below than".split())


def _tokenize(text: str) -> List[str]:
    return [w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in _STOP and len(w) > 1]


async def retrieve_chunks(user_id: str, subject_id: str, query: str, k: int = 5) -> List[dict]:
    q_tokens = _tokenize(query)
    if not q_tokens:
        # return first few chunks as fallback context
        return await db.chunks.find(
            {"user_id": user_id, "subject_id": subject_id}, {"_id": 0}
        ).limit(k).to_list(k)
    q_set = set(q_tokens)
    all_chunks = await db.chunks.find(
        {"user_id": user_id, "subject_id": subject_id}, {"_id": 0}
    ).to_list(5000)
    scored = []
    for c in all_chunks:
        toks = _tokenize(c["text"])
        if not toks:
            continue
        # token overlap count + small boost if all query terms present
        overlap = sum(1 for t in toks if t in q_set)
        if overlap == 0:
            continue
        score = overlap / (len(toks) ** 0.5)
        scored.append((score, c))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:k]]


# =====================================================================
# RAG Chat (streaming)
# =====================================================================
def build_rag_system_prompt(subject_title: str, contexts: List[dict]) -> str:
    if contexts:
        ctx_block = "\n\n".join(
            f"[Source: {c.get('title','Material')} #{c.get('ord',0)+1}]\n{c['text']}"
            for c in contexts
        )
    else:
        ctx_block = "(No materials uploaded yet for this subject.)"
    return (
        f"You are an AI study coach for the subject: {subject_title}.\n"
        f"You must ground every answer in the student's own uploaded materials shown below.\n"
        f"- If the materials don't cover the question, say so honestly and answer briefly from general knowledge, "
        f"clearly labeled '(general knowledge)'.\n"
        f"- Be concise, friendly, and ask one helpful follow-up question if useful.\n"
        f"- Use markdown for structure, headings sparingly.\n\n"
        f"--- STUDENT MATERIALS ---\n{ctx_block}\n--- END MATERIALS ---"
    )


@api.post("/subjects/{subject_id}/chat/stream")
async def chat_stream(subject_id: str, body: ChatIn, user=Depends(require_user)):
    s = await db.subjects.find_one({"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Subject not found")
    sid = body.session_id or new_id("chat")
    contexts = await retrieve_chunks(user["user_id"], subject_id, body.message, k=5)
    system_prompt = build_rag_system_prompt(s["title"], contexts)

    # persist user msg
    await db.chat_messages.insert_one({
        "msg_id": new_id("msg"),
        "user_id": user["user_id"],
        "subject_id": subject_id,
        "session_id": sid,
        "role": "user",
        "content": body.message,
        "created_at": now_utc().isoformat(),
    })

    async def event_gen():
        # emit sources first
        sources = [{"title": c.get("title", "Material"), "ord": c.get("ord", 0)} for c in contexts]
        yield f"event: sources\ndata: {json.dumps(sources)}\n\n"
        yield f"event: session\ndata: {json.dumps({'session_id': sid})}\n\n"
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=sid,
            system_message=system_prompt,
        ).with_model(*CLAUDE_MODEL)
        collected = []
        try:
            async for ev in chat.stream_message(UserMessage(text=body.message)):
                if isinstance(ev, TextDelta):
                    collected.append(ev.content)
                    yield f"event: delta\ndata: {json.dumps({'t': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"
        # persist assistant msg
        full = "".join(collected)
        await db.chat_messages.insert_one({
            "msg_id": new_id("msg"),
            "user_id": user["user_id"],
            "subject_id": subject_id,
            "session_id": sid,
            "role": "assistant",
            "content": full,
            "sources": sources,
            "created_at": now_utc().isoformat(),
        })
        yield f"event: done\ndata: {json.dumps({'ok': True})}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@api.get("/subjects/{subject_id}/chat/history")
async def chat_history(subject_id: str, session_id: Optional[str] = None, user=Depends(require_user)):
    q = {"user_id": user["user_id"], "subject_id": subject_id}
    if session_id:
        q["session_id"] = session_id
    msgs = await db.chat_messages.find(q, {"_id": 0}).sort("created_at", 1).to_list(2000)
    return msgs


# =====================================================================
# Curriculum Generator
# =====================================================================
async def _llm_json(system: str, user_text: str, session_id: str) -> dict:
    """Non-streaming JSON-producing helper using Claude."""
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system,
    ).with_model(*CLAUDE_MODEL)
    collected = []
    async for ev in chat.stream_message(UserMessage(text=user_text)):
        if isinstance(ev, TextDelta):
            collected.append(ev.content)
        elif isinstance(ev, StreamDone):
            break
    raw = "".join(collected).strip()
    # extract JSON
    m = re.search(r"\{[\s\S]*\}", raw)
    if not m:
        raise HTTPException(502, "Model did not return JSON")
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError as e:
        raise HTTPException(502, f"Bad JSON from model: {e}")


@api.post("/subjects/{subject_id}/curriculum/generate")
async def gen_curriculum(subject_id: str, body: CurriculumIn, user=Depends(require_user)):
    s = await db.subjects.find_one({"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Subject not found")
    contexts = await retrieve_chunks(user["user_id"], subject_id, body.goal, k=6)
    materials_summary = "\n\n".join(c["text"][:400] for c in contexts) or "(none)"
    system = (
        "You are a curriculum designer. Produce a STRICT JSON object with no extra text. "
        "Schema: {\"weeks\":[{\"week\":1,\"focus\":\"...\",\"days\":[{\"day\":\"Mon\",\"task\":\"...\",\"minutes\":60}]}],"
        "\"topics\":[\"topic1\",\"topic2\"]}. Tasks must be concrete, varied, build on prior weeks."
    )
    user_text = (
        f"Subject: {s['title']}\nGoal: {body.goal}\nDuration: {body.weeks} weeks\n"
        f"Time available: {body.hours_per_week} hours/week\n\n"
        f"Use these materials if relevant:\n{materials_summary}\n\n"
        f"Return JSON only."
    )
    plan = await _llm_json(system, user_text, new_id("cur"))
    doc = {
        "curriculum_id": new_id("cur"),
        "user_id": user["user_id"],
        "subject_id": subject_id,
        "goal": body.goal,
        "weeks": body.weeks,
        "hours_per_week": body.hours_per_week,
        "plan": plan,
        "created_at": now_utc().isoformat(),
    }
    # replace previous
    await db.curriculum.delete_many({"subject_id": subject_id})
    await db.curriculum.insert_one(doc)
    # initialize mastery topics
    topics = plan.get("topics") or []
    if isinstance(topics, list):
        await db.mastery.delete_many({"subject_id": subject_id})
        if topics:
            await db.mastery.insert_many([{
                "topic_id": new_id("top"),
                "subject_id": subject_id,
                "user_id": user["user_id"],
                "name": t,
                "proficiency": 0,
                "attempts": 0,
                "correct": 0,
                "updated_at": now_utc().isoformat(),
            } for t in topics[:20] if isinstance(t, str)])
    doc.pop("_id", None)
    return doc


@api.get("/subjects/{subject_id}/curriculum")
async def get_curriculum(subject_id: str, user=Depends(require_user)):
    doc = await db.curriculum.find_one(
        {"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return doc


# =====================================================================
# Mastery
# =====================================================================
@api.get("/subjects/{subject_id}/mastery")
async def get_mastery(subject_id: str, user=Depends(require_user)):
    items = await db.mastery.find(
        {"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0}
    ).to_list(200)
    return items


# =====================================================================
# Quiz Generator (adaptive)
# =====================================================================
@api.post("/subjects/{subject_id}/quiz/generate")
async def gen_quiz(subject_id: str, body: QuizGenIn, user=Depends(require_user)):
    s = await db.subjects.find_one({"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Subject not found")
    # Pick weakest topic if no hint
    target_topic = body.topic_hint
    if not target_topic:
        topics = await db.mastery.find(
            {"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0}
        ).sort("proficiency", 1).to_list(50)
        if topics:
            target_topic = topics[0]["name"]
    query = target_topic or s["title"]
    contexts = await retrieve_chunks(user["user_id"], subject_id, query, k=4)
    ctx_block = "\n\n".join(c["text"][:600] for c in contexts) or "(no materials)"
    system = (
        "You generate one multiple-choice quiz question grounded in the student's materials. "
        "Return STRICT JSON only: "
        "{\"question\":\"...\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correct_index\":0,"
        "\"explanation\":\"...\",\"topic\":\"...\"}. "
        "Exactly 4 options. correct_index is 0-3. Difficulty must match requested level."
    )
    user_text = (
        f"Subject: {s['title']}\nDifficulty: {body.difficulty}\n"
        f"Focus topic: {target_topic or 'any core concept'}\n\n"
        f"Materials excerpts:\n{ctx_block}\n\nReturn JSON only."
    )
    q = await _llm_json(system, user_text, new_id("quiz"))
    quiz_id = new_id("qz")
    doc = {
        "quiz_id": quiz_id,
        "user_id": user["user_id"],
        "subject_id": subject_id,
        "topic": q.get("topic", target_topic or ""),
        "difficulty": body.difficulty,
        "question": q.get("question", ""),
        "options": q.get("options", [])[:4],
        "correct_index": int(q.get("correct_index", 0)),
        "explanation": q.get("explanation", ""),
        "answered": False,
        "created_at": now_utc().isoformat(),
    }
    await db.quizzes.insert_one(doc)
    # Public payload (no correct_index)
    public = {k: v for k, v in doc.items() if k not in ("correct_index", "_id")}
    return public


@api.post("/quiz/answer")
async def answer_quiz(body: QuizAnswerIn, user=Depends(require_user)):
    q = await db.quizzes.find_one({"quiz_id": body.quiz_id, "user_id": user["user_id"]}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Quiz not found")
    if q.get("answered"):
        raise HTTPException(400, "Already answered")
    correct = (body.selected_index == q["correct_index"])
    await db.quizzes.update_one(
        {"quiz_id": body.quiz_id},
        {"$set": {"answered": True, "selected_index": body.selected_index,
                  "correct": correct, "answered_at": now_utc().isoformat()}}
    )
    # Update mastery
    topic = q.get("topic")
    if topic:
        existing = await db.mastery.find_one(
            {"subject_id": q["subject_id"], "user_id": user["user_id"], "name": topic}, {"_id": 0}
        )
        if existing:
            attempts = existing["attempts"] + 1
            correct_count = existing["correct"] + (1 if correct else 0)
            prof = int(round(100 * correct_count / max(attempts, 1)))
            await db.mastery.update_one(
                {"topic_id": existing["topic_id"]},
                {"$set": {"attempts": attempts, "correct": correct_count,
                          "proficiency": prof, "updated_at": now_utc().isoformat()}}
            )
        else:
            await db.mastery.insert_one({
                "topic_id": new_id("top"),
                "subject_id": q["subject_id"],
                "user_id": user["user_id"],
                "name": topic,
                "proficiency": 100 if correct else 0,
                "attempts": 1,
                "correct": 1 if correct else 0,
                "updated_at": now_utc().isoformat(),
            })
    return {
        "correct": correct,
        "correct_index": q["correct_index"],
        "explanation": q.get("explanation", ""),
    }


# =====================================================================
# Dashboard summary
# =====================================================================
@api.get("/dashboard/summary")
async def dashboard_summary(user=Depends(require_user)):
    user_id = user["user_id"]
    subjects = await db.subjects.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    total_materials = await db.materials.count_documents({"user_id": user_id})
    total_quizzes = await db.quizzes.count_documents({"user_id": user_id, "answered": True})
    correct_quizzes = await db.quizzes.count_documents({"user_id": user_id, "answered": True, "correct": True})
    # mastery avg overall
    mastery = await db.mastery.find({"user_id": user_id}, {"_id": 0}).to_list(2000)
    overall_mastery = int(round(sum(m["proficiency"] for m in mastery) / len(mastery))) if mastery else 0
    # study streak (days with quiz or chat in last 14 days)
    since = now_utc() - timedelta(days=14)
    activity_days = set()
    cur = db.quizzes.find({"user_id": user_id, "answered_at": {"$exists": True}}, {"_id": 0, "answered_at": 1})
    async for d in cur:
        try:
            dt = datetime.fromisoformat(d["answered_at"])
            if dt > since:
                activity_days.add(dt.date().isoformat())
        except Exception:
            pass
    cur2 = db.chat_messages.find({"user_id": user_id, "role": "user"}, {"_id": 0, "created_at": 1})
    async for d in cur2:
        try:
            dt = datetime.fromisoformat(d["created_at"])
            if dt > since:
                activity_days.add(dt.date().isoformat())
        except Exception:
            pass
    # heatmap last 14 days
    today = now_utc().date()
    heatmap = []
    for i in range(13, -1, -1):
        day = (today - timedelta(days=i)).isoformat()
        heatmap.append({"date": day, "active": day in activity_days})

    return {
        "subjects_count": len(subjects),
        "materials_count": total_materials,
        "quizzes_taken": total_quizzes,
        "quiz_accuracy": int(round(100 * correct_quizzes / max(total_quizzes, 1))) if total_quizzes else 0,
        "overall_mastery": overall_mastery,
        "streak_days": len(activity_days),
        "heatmap": heatmap,
    }


# =====================================================================
# Focus mode events (from Chrome extension)
# =====================================================================
@api.post("/focus/event")
async def focus_event(body: FocusEventIn, user=Depends(require_user)):
    await db.focus_events.insert_one({
        "event_id": new_id("fe"),
        "user_id": user["user_id"],
        "url": body.url,
        "title": body.title or "",
        "on_task": body.on_task,
        "created_at": now_utc().isoformat(),
    })
    return {"ok": True}


@api.get("/focus/stats")
async def focus_stats(user=Depends(require_user)):
    since = now_utc() - timedelta(days=7)
    total = await db.focus_events.count_documents(
        {"user_id": user["user_id"], "created_at": {"$gte": since.isoformat()}}
    )
    on_task = await db.focus_events.count_documents(
        {"user_id": user["user_id"], "created_at": {"$gte": since.isoformat()}, "on_task": True}
    )
    return {"total": total, "on_task": on_task, "focus_score": int(round(100 * on_task / max(total, 1))) if total else 0}


# =====================================================================
# Health
# =====================================================================
@api.get("/")
async def root():
    return {"ok": True, "service": "lle", "version": "1.0"}


# =====================================================================
# Wire up
# =====================================================================
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
