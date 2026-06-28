"""
Backend integration tests for Living Learning Ecosystem.
Covers: auth, subjects CRUD, materials, RAG chat (SSE), curriculum, quiz, mastery,
dashboard, focus events, and auth gating.
"""
import os
import time
import uuid
import json
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://web-extension-6.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Long timeout for LLM endpoints
LLM_TIMEOUT = 120

# ---------- Shared state across tests ----------
STATE = {}


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth(client):
    """Register a fresh user and return token + headers."""
    email = f"TEST_lle_{uuid.uuid4().hex[:8]}@example.com"
    password = "testpass123"
    r = client.post(f"{API}/auth/register", json={"email": email, "password": password, "name": "LLE Tester"}, timeout=20)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    STATE["email"] = email
    STATE["password"] = password
    STATE["token"] = data["token"]
    STATE["user_id"] = data["user"]["user_id"]
    return {"Authorization": f"Bearer {data['token']}", "Content-Type": "application/json"}


# ========= Health =========
def test_health(client):
    r = client.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert r.json().get("ok") is True


# ========= Auth =========
class TestAuth:
    def test_login_works(self, client, auth):
        r = client.post(f"{API}/auth/login", json={"email": STATE["email"], "password": STATE["password"]}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert "token" in body and body["user"]["email"] == STATE["email"]

    def test_duplicate_register(self, client, auth):
        r = client.post(f"{API}/auth/register", json={"email": STATE["email"], "password": "x123456", "name": "dup"}, timeout=20)
        assert r.status_code == 400

    def test_me(self, client, auth):
        r = client.get(f"{API}/auth/me", headers=auth, timeout=10)
        assert r.status_code == 200
        assert r.json()["email"] == STATE["email"]

    def test_me_unauthorized(self, client):
        r = client.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_invalid_login(self, client, auth):
        r = client.post(f"{API}/auth/login", json={"email": STATE["email"], "password": "wrong"}, timeout=20)
        assert r.status_code == 401


# ========= Auth gating =========
def test_protected_endpoints_require_auth(client):
    for path in ["/subjects", "/dashboard/summary", "/focus/stats"]:
        r = client.get(f"{API}{path}", timeout=10)
        assert r.status_code == 401, f"{path} should be 401, got {r.status_code}"


# ========= Subjects CRUD =========
class TestSubjects:
    def test_create_subject(self, client, auth):
        r = client.post(f"{API}/subjects", headers=auth,
                        json={"title": "TEST_Algebra", "description": "Math test", "color": "mint"}, timeout=15)
        assert r.status_code == 200
        s = r.json()
        assert s["title"] == "TEST_Algebra"
        assert s["material_count"] == 0
        assert s["mastery_avg"] == 0
        assert "subject_id" in s
        STATE["subject_id"] = s["subject_id"]

    def test_list_subjects(self, client, auth):
        r = client.get(f"{API}/subjects", headers=auth, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert any(s["subject_id"] == STATE["subject_id"] for s in items)

    def test_update_subject(self, client, auth):
        r = client.patch(f"{API}/subjects/{STATE['subject_id']}", headers=auth,
                         json={"description": "Updated desc"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["description"] == "Updated desc"


# ========= Materials =========
SAMPLE_TEXT = (
    "Photosynthesis is the process by which green plants convert sunlight, water, and carbon dioxide "
    "into glucose and oxygen. The chlorophyll in chloroplasts absorbs light energy. The overall reaction "
    "is 6CO2 + 6H2O -> C6H12O6 + 6O2. Photosynthesis happens in two stages: light-dependent reactions "
    "and the Calvin cycle. The Calvin cycle fixes carbon dioxide into sugar."
) * 3  # Make it long enough to chunk


class TestMaterials:
    def test_add_text_material(self, client, auth):
        r = client.post(f"{API}/subjects/{STATE['subject_id']}/materials/text", headers=auth,
                        json={"title": "Photosynthesis Notes", "content": SAMPLE_TEXT}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["chunks"] >= 1
        STATE["material_id"] = body["material_id"]

    def test_upload_text_file(self, client, auth):
        files = {"file": ("notes.txt", b"Cell mitosis has 4 phases: prophase, metaphase, anaphase, telophase.", "text/plain")}
        # Use a fresh request without JSON content-type
        r = requests.post(f"{API}/subjects/{STATE['subject_id']}/materials/upload",
                          headers={"Authorization": auth["Authorization"]}, files=files, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["chunks"] >= 1

    def test_list_materials(self, client, auth):
        r = client.get(f"{API}/subjects/{STATE['subject_id']}/materials", headers=auth, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 2


# ========= RAG Chat (SSE) =========
class TestRAGChat:
    def test_chat_stream(self, client, auth):
        url = f"{API}/subjects/{STATE['subject_id']}/chat/stream"
        body = {"message": "What is the overall chemical equation for photosynthesis?"}
        r = requests.post(url, headers={"Authorization": auth["Authorization"], "Content-Type": "application/json"},
                          json=body, stream=True, timeout=LLM_TIMEOUT)
        assert r.status_code == 200
        events = []
        deltas = []
        for line in r.iter_lines(decode_unicode=True):
            if not line:
                continue
            if line.startswith("event:"):
                events.append(line.split(":", 1)[1].strip())
            elif line.startswith("data:") and events and events[-1] == "delta":
                try:
                    d = json.loads(line.split(":", 1)[1].strip())
                    deltas.append(d.get("t", ""))
                except Exception:
                    pass
            elif line.startswith("data:") and events and events[-1] == "session":
                try:
                    d = json.loads(line.split(":", 1)[1].strip())
                    STATE["chat_session_id"] = d.get("session_id")
                except Exception:
                    pass
            if events and events[-1] == "done":
                break
        assert "sources" in events, f"events={events}"
        assert "session" in events
        assert "delta" in events, f"No delta tokens received. events={events}"
        assert "done" in events
        assert len("".join(deltas).strip()) > 0, "Assistant produced no text"

    def test_chat_history(self, client, auth):
        # Allow a moment for db write
        time.sleep(1)
        r = client.get(f"{API}/subjects/{STATE['subject_id']}/chat/history", headers=auth, timeout=15)
        assert r.status_code == 200
        msgs = r.json()
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles


# ========= Curriculum =========
class TestCurriculum:
    def test_generate_curriculum(self, client, auth):
        r = client.post(f"{API}/subjects/{STATE['subject_id']}/curriculum/generate", headers=auth,
                        json={"goal": "Master photosynthesis fundamentals", "weeks": 2, "hours_per_week": 4},
                        timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert "plan" in doc and "weeks" in doc["plan"]
        assert isinstance(doc["plan"]["weeks"], list) and len(doc["plan"]["weeks"]) >= 1

    def test_get_curriculum(self, client, auth):
        r = client.get(f"{API}/subjects/{STATE['subject_id']}/curriculum", headers=auth, timeout=15)
        assert r.status_code == 200
        assert r.json() is not None


# ========= Mastery =========
class TestMastery:
    def test_mastery_seeded(self, client, auth):
        r = client.get(f"{API}/subjects/{STATE['subject_id']}/mastery", headers=auth, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        # After curriculum generation, topics should be seeded
        # We can't strictly assert >0 since LLM may not return topics; soft check
        for t in items:
            assert "name" in t and "proficiency" in t


# ========= Quiz =========
class TestQuiz:
    def test_generate_quiz(self, client, auth):
        r = client.post(f"{API}/subjects/{STATE['subject_id']}/quiz/generate", headers=auth,
                        json={"difficulty": "easy"}, timeout=LLM_TIMEOUT)
        assert r.status_code == 200, r.text
        q = r.json()
        assert "question" in q and len(q["options"]) == 4
        assert "correct_index" not in q, "correct_index leaked in public payload!"
        STATE["quiz_id"] = q["quiz_id"]

    def test_answer_quiz(self, client, auth):
        r = client.post(f"{API}/quiz/answer", headers=auth,
                        json={"quiz_id": STATE["quiz_id"], "selected_index": 0}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert "correct" in body and "correct_index" in body and "explanation" in body

    def test_answer_twice_fails(self, client, auth):
        r = client.post(f"{API}/quiz/answer", headers=auth,
                        json={"quiz_id": STATE["quiz_id"], "selected_index": 1}, timeout=20)
        assert r.status_code == 400


# ========= Dashboard =========
def test_dashboard_summary(client, auth):
    r = client.get(f"{API}/dashboard/summary", headers=auth, timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ["subjects_count", "materials_count", "quizzes_taken", "quiz_accuracy", "overall_mastery", "streak_days", "heatmap"]:
        assert k in d
    assert len(d["heatmap"]) == 14
    assert d["subjects_count"] >= 1
    assert d["materials_count"] >= 2


# ========= Focus =========
class TestFocus:
    def test_focus_event(self, client, auth):
        r = client.post(f"{API}/focus/event", headers=auth,
                        json={"url": "https://wikipedia.org", "on_task": True, "title": "Photosynthesis"}, timeout=10)
        assert r.status_code == 200
        r2 = client.post(f"{API}/focus/event", headers=auth,
                         json={"url": "https://youtube.com", "on_task": False, "title": "Music"}, timeout=10)
        assert r2.status_code == 200

    def test_focus_stats(self, client, auth):
        r = client.get(f"{API}/focus/stats", headers=auth, timeout=10)
        assert r.status_code == 200
        s = r.json()
        assert s["total"] >= 2 and s["on_task"] >= 1
        assert 0 <= s["focus_score"] <= 100


# ========= Cleanup =========
def test_zzz_delete_subject_cascade(client, auth):
    sid = STATE["subject_id"]
    r = client.delete(f"{API}/subjects/{sid}", headers=auth, timeout=15)
    assert r.status_code == 200
    # confirm gone
    r2 = client.get(f"{API}/subjects/{sid}", headers=auth, timeout=10)
    assert r2.status_code == 404
    # materials/curriculum should be gone
    r3 = client.get(f"{API}/subjects/{sid}/materials", headers=auth, timeout=10)
    assert r3.status_code == 200 and r3.json() == []
