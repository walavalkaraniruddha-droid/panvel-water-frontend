/**
 * ToastNotification — floating toast popups (top-right corner)
 * Separate from the notification bell system.
 * Used for real-time feedback as ward scans complete.
 */
import { useState, useEffect, useCallback } from "react";

const TOAST_EVENT = "panvel-toast";

export function showToast(message, level = "INFO") {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, {
    detail: { message, level, id: Date.now() + Math.random() }
  }));
}

const LEVEL_CFG = {
  CRITICAL: { color:"#ff2d55", bg:"rgba(255,45,85,0.15)",  border:"rgba(255,45,85,0.5)",  icon:"🚨" },
  HIGH:     { color:"#ff4d6d", bg:"rgba(255,77,109,0.12)", border:"rgba(255,77,109,0.4)", icon:"⚠️" },
  MODERATE: { color:"#ffb800", bg:"rgba(255,184,0,0.12)",  border:"rgba(255,184,0,0.4)",  icon:"⚡" },
  INFO:     { color:"#00c2ff", bg:"rgba(0,194,255,0.1)",   border:"rgba(0,194,255,0.3)",  icon:"ℹ️" },
  SUCCESS:  { color:"#00ff88", bg:"rgba(0,255,136,0.1)",   border:"rgba(0,255,136,0.3)",  icon:"✅" },
};

export default function ToastNotification() {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const toast = { ...e.detail };
      setToasts(prev => [toast, ...prev].slice(0, 5));
      const dur = e.detail.level === "CRITICAL" ? 7000 : 4500;
      setTimeout(() => remove(toast.id), dur);
    };
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, [remove]);

  if (!toasts.length) return null;

  return (
    <>
      <style>{`
        @keyframes slideInToast {
          from { opacity:0; transform:translateX(30px) scale(0.95); }
          to   { opacity:1; transform:translateX(0) scale(1); }
        }
      `}</style>
      <div style={{ position:"fixed", top:70, right:16, zIndex:9999,
        display:"flex", flexDirection:"column", gap:8,
        maxWidth:"min(360px, calc(100vw - 32px))", pointerEvents:"none" }}>
        {toasts.map(t => {
          const cfg = LEVEL_CFG[t.level] || LEVEL_CFG.INFO;
          return (
            <div key={t.id} style={{ background:cfg.bg,
              border:`1px solid ${cfg.border}`, borderLeft:`4px solid ${cfg.color}`,
              borderRadius:8, padding:"11px 14px",
              backdropFilter:"blur(12px)",
              boxShadow:`0 4px 20px rgba(0,0,0,0.4), 0 0 10px ${cfg.color}22`,
              animation:"slideInToast 0.3s ease",
              display:"flex", gap:9, alignItems:"flex-start",
              pointerEvents:"all" }}>
              <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>{cfg.icon}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color:cfg.color, fontWeight:700,
                  fontSize:10, letterSpacing:1, marginBottom:2 }}>
                  {t.level}
                </div>
                <div style={{ color:"white", fontSize:12, lineHeight:1.5,
                  wordBreak:"break-word" }}>{t.message}</div>
              </div>
              <button onClick={() => remove(t.id)}
                style={{ background:"none", border:"none", color:"#6a8aaa",
                  cursor:"pointer", fontSize:13, padding:"0 0 0 4px",
                  flexShrink:0, lineHeight:1 }}>✕</button>
            </div>
          );
        })}
      </div>
    </>
  );
}
