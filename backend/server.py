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
import zipfile
import requests
from pathlib import Path
from datetime import datetime, timezone, timedelta, date
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

import google.generativeai as genai
from groq import Groq

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------- MongoDB ----------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ---------------- Config ----------------
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
GEMINI_MODEL = "gemini-2.0-flash"

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
GROQ_MODEL = "llama-3.3-70b-versatile"
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
SESSION_DAYS = 7

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
    start_date: Optional[str] = None  # ISO date string (YYYY-MM-DD)
    days_of_week: Optional[List[int]] = None  # 0=Mon ... 6=Sun
    daily_time: Optional[str] = None  # "HH:MM"


class OnboardingIn(BaseModel):
    goal: str
    current_level: Literal["beginner", "some_basics", "intermediate", "advanced"] = "beginner"
    weak_areas: Optional[str] = ""
    target_outcome: Optional[str] = ""


class ModuleCompleteIn(BaseModel):
    score: int = Field(ge=0, le=100)


class QuizGenIn(BaseModel):
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    topic_hint: Optional[str] = None
    deep: bool = False  # if True, generate longer scenario-based question


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
        collected = []
        try:
            if not groq_client:
                raise RuntimeError("GROQ_API_KEY not configured on server")
            stream = await asyncio.to_thread(
                groq_client.chat.completions.create,
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": body.message},
                ],
                stream=True,
            )
            for chunk in stream:
                t = chunk.choices[0].delta.content or ""
                if t:
                    collected.append(t)
                    yield f"event: delta\ndata: {json.dumps({'t': t})}\n\n"
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
    """Non-streaming JSON-producing helper using Groq."""
    if not groq_client:
        raise HTTPException(502, "GROQ_API_KEY not configured on server")
    try:
        resp = await asyncio.to_thread(
            groq_client.chat.completions.create,
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_text},
            ],
        )
        raw = (resp.choices[0].message.content or "").strip()
    except Exception as e:
        raise HTTPException(502, f"Groq error: {e}")
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
        "\"topics\":[\"topic1\",\"topic2\"]}. Tasks must be concrete, varied, build on prior weeks. "
        "Each week MUST contain at most one entry per weekday in 'days' array; use full weekday names (Mon, Tue, Wed, Thu, Fri, Sat, Sun)."
    )
    user_text = (
        f"Subject: {s['title']}\nGoal: {body.goal}\nDuration: {body.weeks} weeks\n"
        f"Time available: {body.hours_per_week} hours/week\n\n"
        f"Use these materials if relevant:\n{materials_summary}\n\n"
        f"Return JSON only."
    )
    plan = await _llm_json(system, user_text, new_id("cur"))

    # ----- Date-stamp the plan -----
    weekday_map = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6,
                   "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
    try:
        start = date.fromisoformat(body.start_date) if body.start_date else date.today()
    except Exception:
        start = date.today()
    daily_time = body.daily_time or "18:00"
    allowed_dows = set(body.days_of_week or [0, 1, 2, 3, 4])  # default Mon-Fri

    events = []  # flat calendar events
    for w_idx, w in enumerate(plan.get("weeks", []) or []):
        week_start = start + timedelta(days=7 * w_idx)
        days = w.get("days", []) or []
        # If day names look like weekdays, map them; else distribute across allowed dows
        for d_idx, day in enumerate(days):
            day_label = str(day.get("day", "")).strip().lower()
            dow = weekday_map.get(day_label)
            if dow is None or dow not in allowed_dows:
                # fallback: pick the next allowed dow in this week index d_idx
                sorted_dows = sorted(allowed_dows) or [0, 1, 2, 3, 4]
                dow = sorted_dows[d_idx % len(sorted_dows)]
            # find date in this week
            target = week_start + timedelta(days=(dow - week_start.weekday()) % 7)
            events.append({
                "date": target.isoformat(),
                "time": daily_time,
                "task": day.get("task", ""),
                "minutes": int(day.get("minutes", 45) or 45),
                "week": w.get("week", w_idx + 1),
                "day_label": day.get("day", ""),
                "focus": w.get("focus", ""),
                "done": False,
            })

    doc = {
        "curriculum_id": new_id("cur"),
        "user_id": user["user_id"],
        "subject_id": subject_id,
        "goal": body.goal,
        "weeks": body.weeks,
        "hours_per_week": body.hours_per_week,
        "start_date": start.isoformat(),
        "daily_time": daily_time,
        "days_of_week": sorted(allowed_dows),
        "plan": plan,
        "events": events,
        "created_at": now_utc().isoformat(),
    }
    # replace previous
    await db.curriculum.delete_many({"subject_id": subject_id})
    await db.curriculum.insert_one(doc)
    # initialize mastery topics (only if none exist yet — onboarding may have created them)
    topics = plan.get("topics") or []
    if isinstance(topics, list):
        existing = await db.mastery.count_documents({"subject_id": subject_id})
        if existing == 0 and topics:
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


class EventToggleIn(BaseModel):
    event_index: int
    done: bool


class EventEditIn(BaseModel):
    date: Optional[str] = None  # YYYY-MM-DD
    time: Optional[str] = None  # HH:MM
    task: Optional[str] = None
    minutes: Optional[int] = Field(default=None, ge=5, le=480)


class EventAddIn(BaseModel):
    date: str  # YYYY-MM-DD
    time: str = "18:00"
    task: str
    minutes: int = Field(default=45, ge=5, le=480)


@api.post("/subjects/{subject_id}/curriculum/event")
async def toggle_event(subject_id: str, body: EventToggleIn, user=Depends(require_user)):
    doc = await db.curriculum.find_one(
        {"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "No curriculum")
    events = doc.get("events", [])
    if body.event_index < 0 or body.event_index >= len(events):
        raise HTTPException(400, "Bad index")
    events[body.event_index]["done"] = body.done
    await db.curriculum.update_one(
        {"curriculum_id": doc["curriculum_id"]}, {"$set": {"events": events}}
    )
    return {"ok": True}


@api.patch("/subjects/{subject_id}/curriculum/event/{event_index}")
async def edit_event(subject_id: str, event_index: int, body: EventEditIn, user=Depends(require_user)):
    doc = await db.curriculum.find_one(
        {"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "No curriculum")
    events = doc.get("events", [])
    if event_index < 0 or event_index >= len(events):
        raise HTTPException(400, "Bad index")
    update = body.model_dump(exclude_none=True)
    events[event_index].update(update)
    await db.curriculum.update_one(
        {"curriculum_id": doc["curriculum_id"]}, {"$set": {"events": events}}
    )
    return {"ok": True, "event": events[event_index]}


@api.delete("/subjects/{subject_id}/curriculum/event/{event_index}")
async def delete_event(subject_id: str, event_index: int, user=Depends(require_user)):
    doc = await db.curriculum.find_one(
        {"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(404, "No curriculum")
    events = doc.get("events", [])
    if event_index < 0 or event_index >= len(events):
        raise HTTPException(400, "Bad index")
    events.pop(event_index)
    await db.curriculum.update_one(
        {"curriculum_id": doc["curriculum_id"]}, {"$set": {"events": events}}
    )
    return {"ok": True}


@api.post("/subjects/{subject_id}/curriculum/event/add")
async def add_event(subject_id: str, body: EventAddIn, user=Depends(require_user)):
    doc = await db.curriculum.find_one(
        {"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not doc:
        # Create a minimal curriculum doc to host user-added events
        doc = {
            "curriculum_id": new_id("cur"),
            "user_id": user["user_id"],
            "subject_id": subject_id,
            "goal": "",
            "weeks": 0,
            "hours_per_week": 0,
            "start_date": body.date,
            "daily_time": body.time,
            "days_of_week": [],
            "plan": {"weeks": [], "topics": []},
            "events": [],
            "created_at": now_utc().isoformat(),
        }
        await db.curriculum.insert_one(doc.copy())
    new_event = {
        "date": body.date,
        "time": body.time,
        "task": body.task,
        "minutes": body.minutes,
        "week": 0,
        "day_label": "",
        "focus": "Manual entry",
        "done": False,
        "manual": True,
    }
    events = list(doc.get("events", []))
    events.append(new_event)
    # Sort by date+time for stable indices
    events.sort(key=lambda e: (e.get("date", ""), e.get("time", "")))
    await db.curriculum.update_one(
        {"curriculum_id": doc["curriculum_id"]}, {"$set": {"events": events}}
    )
    return {"ok": True, "events": events}


# =====================================================================
# Onboarding survey + Structured Modules (forced ordered learning path)
# =====================================================================
@api.post("/subjects/{subject_id}/onboard")
async def onboard_subject(subject_id: str, body: OnboardingIn, user=Depends(require_user)):
    s = await db.subjects.find_one({"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Subject not found")

    contexts = await retrieve_chunks(user["user_id"], subject_id, body.goal + " " + (body.weak_areas or ""), k=8)
    materials_summary = "\n\n".join(c["text"][:400] for c in contexts) or "(no materials uploaded)"
    system = (
        "You design a structured, ordered learning path. Return STRICT JSON only. Schema: "
        "{\"modules\":[{\"title\":\"...\",\"level\":\"foundation|intermediate|advanced\","
        "\"summary\":\"1-2 sentence description\",\"prerequisites\":[],"
        "\"learning_objectives\":[\"...\",\"...\"],\"estimated_minutes\":30}]} "
        "Rules: 5-9 modules. Order MUST be strictly foundation → intermediate → advanced. "
        "First module unlocked, others depend on prior module. Tailor difficulty to student's stated level. "
        "Modules must be SPECIFIC to the subject and materials (not generic)."
    )
    user_text = (
        f"Subject: {s['title']}\nGoal: {body.goal}\nCurrent level: {body.current_level}\n"
        f"Weak areas: {body.weak_areas or '(none stated)'}\n"
        f"Target outcome: {body.target_outcome or body.goal}\n\n"
        f"Materials excerpts:\n{materials_summary}\n\nReturn JSON only."
    )
    plan = await _llm_json(system, user_text, new_id("ob"))
    modules_in = plan.get("modules", []) or []

    # Save onboarding survey
    await db.subjects.update_one(
        {"subject_id": subject_id},
        {"$set": {
            "onboarding": {
                "goal": body.goal,
                "current_level": body.current_level,
                "weak_areas": body.weak_areas or "",
                "target_outcome": body.target_outcome or "",
                "completed_at": now_utc().isoformat(),
            }
        }}
    )

    # Replace modules
    await db.modules.delete_many({"subject_id": subject_id})
    docs = []
    for i, m in enumerate(modules_in[:9]):
        docs.append({
            "module_id": new_id("mod"),
            "subject_id": subject_id,
            "user_id": user["user_id"],
            "order": i,
            "title": m.get("title", f"Module {i+1}"),
            "level": m.get("level", "foundation"),
            "summary": m.get("summary", ""),
            "objectives": m.get("learning_objectives", []) or [],
            "estimated_minutes": int(m.get("estimated_minutes", 30) or 30),
            "status": "unlocked" if i == 0 else "locked",
            "score": 0,
            "created_at": now_utc().isoformat(),
        })
    if docs:
        await db.modules.insert_many(docs)

    # Seed mastery topics from module titles
    await db.mastery.delete_many({"subject_id": subject_id})
    if docs:
        await db.mastery.insert_many([{
            "topic_id": new_id("top"),
            "subject_id": subject_id,
            "user_id": user["user_id"],
            "name": d["title"],
            "proficiency": 0,
            "attempts": 0,
            "correct": 0,
            "module_id": d["module_id"],
            "updated_at": now_utc().isoformat(),
        } for d in docs])

    return {"modules": [{k: v for k, v in d.items() if k != "_id"} for d in docs]}


@api.get("/subjects/{subject_id}/modules")
async def list_modules(subject_id: str, user=Depends(require_user)):
    items = await db.modules.find(
        {"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0}
    ).sort("order", 1).to_list(50)
    return items


@api.post("/modules/{module_id}/complete")
async def complete_module(module_id: str, body: ModuleCompleteIn, user=Depends(require_user)):
    m = await db.modules.find_one({"module_id": module_id, "user_id": user["user_id"]}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Module not found")
    if m["status"] == "locked":
        raise HTTPException(403, "Module is locked")
    passing = body.score >= 70
    new_status = "mastered" if passing else "in_progress"
    await db.modules.update_one(
        {"module_id": module_id},
        {"$set": {"status": new_status, "score": body.score, "updated_at": now_utc().isoformat()}}
    )
    # Unlock next if passed
    if passing:
        nxt = await db.modules.find_one(
            {"subject_id": m["subject_id"], "user_id": user["user_id"], "order": m["order"] + 1},
            {"_id": 0}
        )
        if nxt and nxt["status"] == "locked":
            await db.modules.update_one(
                {"module_id": nxt["module_id"]},
                {"$set": {"status": "unlocked"}}
            )
    # Update mastery for this module's topic
    await db.mastery.update_one(
        {"module_id": module_id},
        {"$set": {"proficiency": body.score, "updated_at": now_utc().isoformat()}}
    )
    items = await db.modules.find(
        {"subject_id": m["subject_id"], "user_id": user["user_id"]}, {"_id": 0}
    ).sort("order", 1).to_list(50)
    return {"ok": True, "modules": items}


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
    if body.deep:
        system = (
            "You generate ONE deep, scenario-based multiple-choice question for a learning module check. "
            "Requirements: question MUST be at least 2-3 sentences long. Include a concrete scenario, example, or applied context. "
            "Avoid trivial recall questions. Test understanding and reasoning. "
            "Return STRICT JSON only: "
            "{\"question\":\"...\",\"options\":[\"A\",\"B\",\"C\",\"D\"],\"correct_index\":0,"
            "\"explanation\":\"2-3 sentence explanation referencing why each wrong option is wrong\",\"topic\":\"...\"}. "
            "Exactly 4 options. Each option must be a complete, specific statement (not single words). correct_index is 0-3."
        )
    else:
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
# AI Schedule Suggestion (suggests start_date, daily_time, days_of_week based on goal/user)
# =====================================================================
class ScheduleSuggestIn(BaseModel):
    goal: str
    target_date: Optional[str] = None  # ISO YYYY-MM-DD (deadline)
    hours_per_week: int = Field(ge=1, le=40, default=5)


@api.post("/subjects/{subject_id}/curriculum/suggest")
async def suggest_schedule(subject_id: str, body: ScheduleSuggestIn, user=Depends(require_user)):
    s = await db.subjects.find_one({"subject_id": subject_id, "user_id": user["user_id"]}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Subject not found")
    # Compute weeks until target if given
    today = date.today()
    weeks_until = None
    if body.target_date:
        try:
            td = date.fromisoformat(body.target_date)
            weeks_until = max(1, (td - today).days // 7)
        except Exception:
            pass
    system = (
        "You are a study scheduler. Return STRICT JSON only: "
        "{\"start_date\":\"YYYY-MM-DD\",\"weeks\":<int 1-12>,\"days_of_week\":[0-6 integers, 0=Mon],"
        "\"daily_time\":\"HH:MM 24h\",\"reasoning\":\"1 short sentence\"}. "
        "Pick 3-5 days/week balancing rest. Prefer evening study slots."
    )
    user_text = (
        f"Today is {today.isoformat()}. Goal: {body.goal}. "
        f"Hours/week available: {body.hours_per_week}. "
        f"{'Target deadline: ' + body.target_date + ' (' + str(weeks_until) + ' weeks)' if body.target_date else 'No deadline.'}\n"
        "Return JSON only."
    )
    plan = await _llm_json(system, user_text, new_id("sch"))
    # sanitize
    if "weeks" not in plan and weeks_until:
        plan["weeks"] = weeks_until
    return plan


# =====================================================================
# Visual generation (Gemini Nano Banana) - turns chat answers into diagrams
# =====================================================================
class VisualizeIn(BaseModel):
    prompt: str
    subject: Optional[str] = ""


@api.post("/visualize")
async def visualize(body: VisualizeIn, user=Depends(require_user)):
    """Generate an educational diagram/illustration from text."""
    raise HTTPException(
        501,
        "Image generation is not configured. This feature requires a paid image-generation API "
        "(e.g. Gemini Imagen or DALL-E). Currently disabled."
    )


# =====================================================================
# Chrome Extension Download (.zip)
# =====================================================================
@api.get("/extension/download")
async def download_extension():
    ext_dir = ROOT_DIR / "chrome-extension"
    if not ext_dir.exists():
        raise HTTPException(404, "Extension folder not found")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in ext_dir.rglob("*"):
            if p.is_file():
                arc = p.relative_to(ext_dir.parent)  # arcname starts with 'chrome-extension/'
                zf.write(p, arcname=str(arc))
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=nuro-chrome-extension.zip"},
    )


# =====================================================================
# Wire up
# =====================================================================
_cors_origins_env = os.environ.get("CORS_ORIGINS", "")
if _cors_origins_env and _cors_origins_env.strip() != "*":
    _allow_origins = [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
    _allow_credentials = True
else:
    _allow_origins = ["*"]
    _allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_credentials=_allow_credentials,
    allow_origins=_allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api)


@app.on_event("shutdown")
async def shutdown():
    client.close()
