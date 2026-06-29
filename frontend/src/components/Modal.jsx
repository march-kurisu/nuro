import { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({ open, onClose, title, children, size = "md", testId = "modal" }) {
  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose?.();
    if (open) document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;
  const widthClass = size === "lg" ? "max-w-2xl" : size === "sm" ? "max-w-sm" : "max-w-md";
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      data-testid={testId}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className={`card w-full ${widthClass} p-6 sm:p-7 relative fade-up`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100"
          data-testid={`${testId}-close`}
          aria-label="Close"
        >
          <X size={18} />
        </button>
        {title && <h3 className="font-display text-2xl font-bold text-slate-900 pr-8">{title}</h3>}
        <div className={title ? "mt-3" : ""}>{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", danger = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} testId="confirm-modal" size="sm">
      <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
      <div className="mt-5 flex gap-2 justify-end">
        <button onClick={onClose} className="btn-ghost text-sm" data-testid="confirm-cancel">Cancel</button>
        <button
          onClick={() => { onConfirm?.(); onClose?.(); }}
          className={danger ? "btn-dark text-sm" : "btn-yellow text-sm"}
          style={danger ? { background: "#DC2626", color: "#fff" } : undefined}
          data-testid="confirm-ok"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function CopyableModal({ open, onClose, title, label, value }) {
  return (
    <Modal open={open} onClose={onClose} title={title} testId="copyable-modal">
      <p className="text-slate-600 text-sm">{label}</p>
      <textarea
        readOnly
        value={value}
        onFocus={(e) => e.target.select()}
        rows={3}
        className="input mt-3 font-mono text-xs"
        style={{ borderRadius: 16, resize: "none" }}
        data-testid="copyable-text"
      />
      <div className="mt-4 flex gap-2 justify-end">
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
            } catch {
              // fallback: select textarea and execCommand
              const ta = document.querySelector('[data-testid="copyable-text"]');
              if (ta) { ta.focus(); ta.select(); try { document.execCommand("copy"); } catch {} }
            }
          }}
          className="btn-yellow text-sm"
          data-testid="copyable-copy"
        >
          Copy
        </button>
        <button onClick={onClose} className="btn-ghost text-sm">Close</button>
      </div>
    </Modal>
  );
}
