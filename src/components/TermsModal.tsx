import { useEffect } from "react";
import TermsContent, { DocumentType } from "@/components/TermsContent";

export type { DocumentType } from "@/components/TermsContent";

interface TermsModalProps {
  onClose: () => void;
  initialDoc?: DocumentType;
}

const TermsModal: React.FC<TermsModalProps> = ({ onClose, initialDoc = "terms" }) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2500,
        background: "rgba(8,15,31,0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* X poza scrollowalnym kontenerem — zawsze widoczny */}
      <button
        type="button"
        onClick={onClose}
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          width: 42,
          height: 42,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(15,23,42,0.95)",
          color: "#fff",
          cursor: "pointer",
          fontSize: "1.2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2600,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          transition: "background .2s",
        }}
        aria-label="Zamknij dokument"
      >
        ✕
      </button>

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 980,
          maxHeight: "calc(100vh - 48px)",
          overflow: "auto",
          background: "#0f1117",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          padding: "32px 28px 28px",
        }}
      >
        <TermsContent docType={initialDoc} />
      </div>
    </div>
  );
};

export default TermsModal;
