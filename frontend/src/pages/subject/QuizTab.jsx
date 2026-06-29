import { useState } from "react";
import api from "@/lib/api";
import { Sparkles, Check, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const DIFFS = ["easy", "medium", "hard"];

export default function QuizTab({ subjectId }) {
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [diff, setDiff] = useState("medium");
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    setResult(null);
    setSelected(null);
    try {
      const { data } = await api.post(`/subjects/${subjectId}/quiz/generate`, { difficulty: diff });
      setQuiz(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not generate quiz. Add materials first.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (selected === null || !quiz) return;
    try {
      const { data } = await api.post(`/quiz/answer`, { quiz_id: quiz.quiz_id, selected_index: selected });
      setResult(data);
    } catch { toast.error("Submit failed"); }
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="card p-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-bold text-slate-900">Adaptive Quiz</h3>
          <p className="text-slate-500 text-sm">We pick your weakest topic — answer to level up mastery.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-full p-1">
            {DIFFS.map((d) => (
              <button
                key={d}
                data-testid={`quiz-diff-${d}`}
                onClick={() => setDiff(d)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition ${
                  diff === d ? "bg-slate-900 text-white" : "text-slate-600"
                }`}
              >{d}</button>
            ))}
          </div>
          <button data-testid="quiz-generate-btn" onClick={generate} disabled={busy} className="btn-yellow disabled:opacity-50">
            <Sparkles size={14} /> {busy ? "Generating…" : "Next question"}
          </button>
        </div>
      </div>

      {!quiz && !busy && (
        <div className="card p-12 text-center">
          <div className="icon-square mx-auto mb-3 float-anim" style={{ width: 56, height: 56, borderRadius: 16 }}>
            <Sparkles size={26} strokeWidth={2.4} />
          </div>
          <p className="font-display text-2xl font-bold text-slate-900">Ready when you are</p>
          <p className="text-slate-500 mt-1">Generate a question to start your adaptive session.</p>
        </div>
      )}

      {busy && <QuestionSkeleton />}

      {quiz && !busy && (
        <div className="card p-7 fade-up">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-700 uppercase tracking-widest">
              {quiz.topic || "Topic"} · {quiz.difficulty}
            </div>
          </div>
          <h4 className="font-display text-2xl font-bold text-slate-900 leading-snug">{quiz.question}</h4>

          <div className="mt-5 space-y-2">
            {quiz.options.map((opt, i) => {
              const isCorrect = result && i === result.correct_index;
              const isWrong = result && selected === i && !result.correct;
              return (
                <button
                  key={i}
                  data-testid={`quiz-option-${i}`}
                  disabled={!!result}
                  onClick={() => setSelected(i)}
                  className={`w-full text-left p-4 rounded-2xl border-2 flex items-center gap-3 transition ${
                    isCorrect
                      ? "bg-green-50 border-green-500"
                      : isWrong
                      ? "bg-red-50 border-red-500"
                      : selected === i
                      ? "bg-slate-50 border-slate-900"
                      : "bg-white border-slate-200 hover:border-slate-900"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center shrink-0 ${
                    isCorrect ? "bg-green-500 text-white" : isWrong ? "bg-red-500 text-white" : selected === i ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                  }`}>
                    {isCorrect ? <Check size={16} /> : isWrong ? <X size={16} /> : String.fromCharCode(65 + i)}
                  </div>
                  <span className="flex-1 text-slate-900">{opt}</span>
                </button>
              );
            })}
          </div>

          {!result && (
            <button data-testid="quiz-submit-btn" disabled={selected === null} onClick={submit}
              className="mt-5 btn-dark disabled:opacity-40">
              Submit answer <ArrowRight size={14} />
            </button>
          )}

          {result && (
            <div className={`mt-5 p-5 rounded-2xl ${result.correct ? "bg-green-50 border-2 border-green-200" : "bg-red-50 border-2 border-red-200"}`} data-testid="quiz-result">
              <div className={`font-display text-xl font-bold ${result.correct ? "text-green-700" : "text-red-700"}`}>
                {result.correct ? "Correct!" : "Not quite."}
              </div>
              <p className="mt-1 text-slate-700 text-sm leading-relaxed">{result.explanation}</p>
              <button onClick={generate} data-testid="quiz-next-btn" className="mt-4 btn-dark">
                Next question <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
