// Toast notification system
// showToast(message, level) — callable from anywhere

let _toastContainer = null;

const LEVEL_COLORS = {
  CRITICAL: { bg: "rgba(255,45,85,0.95)",   border: "#ff2d55", icon: "🚨" },
  HIGH:     { bg: "rgba(255,77,109,0.92)",   border: "#ff4d6d", icon: "⚠️" },
  MODERATE: { bg: "rgba(255,184,0,0.92)",    border: "#ffb800", icon: "🔔" },
  NORMAL:   { bg: "rgba(0,255,136,0.88)",    border: "#00ff88", icon: "✅" },
  SUCCESS:  { bg: "rgba(0,194,255,0.88)",    border: "#00c2ff", icon: "💧" },
  ERROR:    { bg: "rgba(255,77,109,0.92)",   border: "#ff4d6d", icon: "❌" },
};

function ensureContainer() {
  if (_toastContainer) return _toastContainer;
  const div = document.createElement("div");
  div.id = "toast-container";
  div.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 99999;
    display: flex;
    flex-direction: column-reverse;
    gap: 10px;
    max-width: 340px;
    pointer-events: none;
  `;
  document.body.appendChild(div);
  _toastContainer = div;
  return div;
}

export function showToast(message, level = "NORMAL", duration = 4000) {
  const container = ensureContainer();
  const style     = LEVEL_COLORS[level] || LEVEL_COLORS.NORMAL;

  const toast = document.createElement("div");
  toast.style.cssText = `
    background: ${style.bg};
    border: 1px solid ${style.border};
    border-radius: 8px;
    padding: 12px 16px;
    color: white;
    font-family: 'Syne', sans-serif;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    pointer-events: auto;
    cursor: pointer;
    animation: slideIn 0.3s ease;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    backdrop-filter: blur(8px);
  `;

  const icon = document.createElement("span");
  icon.textContent = style.icon;
  icon.style.fontSize = "16px";

  const text = document.createElement("span");
  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);

  // Click to dismiss
  toast.onclick = () => toast.remove();

  container.appendChild(toast);

  // Add CSS animation if not already added
  if (!document.getElementById("toast-style")) {
    const styleEl = document.createElement("style");
    styleEl.id = "toast-style";
    styleEl.textContent = `
      @keyframes slideIn {
        from { transform: translateX(120%); opacity: 0; }
        to   { transform: translateX(0);   opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0);   opacity: 1; }
        to   { transform: translateX(120%); opacity: 0; }
      }
    `;
    document.head.appendChild(styleEl);
  }

  // Auto remove
  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
