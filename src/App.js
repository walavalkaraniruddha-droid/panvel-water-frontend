import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import axios from "axios";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
  PieChart, Pie, RadialBarChart, RadialBar,
  LineChart, Line, ReferenceLine,
} from "recharts";

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

const C = {
  supply:      "#00c2ff",
  consumption: "#00ff88",
  leakage:     "#ff4d6d",
  warning:     "#ffb800",
  bg:          "#060c14",
  surface:     "#0d1a2b",
  surface2:    "#112035",
  muted:       "#6a8aaa",
};

const HORIZON_OPTIONS = [
  { label: "Next 1 Day",    days: 1   },
  { label: "Next 7 Days",   days: 7   },
  { label: "Next 14 Days",  days: 14  },
  { label: "Next 30 Days",  days: 30  },
  { label: "Next 60 Days",  days: 60  },
  { label: "Next 90 Days",  days: 90  },
  { label: "Next 180 Days", days: 180 },
  { label: "Next 1 Year",   days: 365 },
];

// ─────────────────────────────────────────────────────────────
// AUTH CONTEXT
// ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem("wma_user");
      if (s) setUser(JSON.parse(s));
    } catch (_) {}
    setReady(true);
  }, []);

  const login  = (u) => { setUser(u); localStorage.setItem("wma_user", JSON.stringify(u)); };
  const logout = ()  => { setUser(null); localStorage.removeItem("wma_user"); };

  return (
    <AuthContext.Provider value={{ user, login, logout, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() { return useContext(AuthContext); }

// ─────────────────────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: #060c14; }
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeIn  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes bellPulse {
    0%,100% { transform:scale(1) rotate(0deg); }
    20%     { transform:scale(1.15) rotate(-8deg); }
    40%     { transform:scale(1.15) rotate(8deg); }
    60%     { transform:scale(1.1) rotate(-4deg); }
    80%     { transform:scale(1.05) rotate(0deg); }
  }
  select, button, input { font-family: 'Syne', sans-serif; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #0d1a2b; }
  ::-webkit-scrollbar-thumb { background: rgba(0,194,255,0.3); border-radius: 3px; }
  input::placeholder { color: #3a5068; }
  select option { background: #112035; }
`;

// ─────────────────────────────────────────────────────────────
// ALERT SYSTEM — Toast + Bell + Notifications Context
// ─────────────────────────────────────────────────────────────

// Level config
const LEVELS = {
  CRITICAL: { color: "#ff2d55", bg: "rgba(255,45,85,0.12)",  border: "rgba(255,45,85,0.4)",  icon: "🚨", label: "CRITICAL" },
  HIGH:     { color: "#ff4d6d", bg: "rgba(255,77,109,0.1)",  border: "rgba(255,77,109,0.35)", icon: "⚠️", label: "HIGH"     },
  MODERATE: { color: "#ffb800", bg: "rgba(255,184,0,0.1)",   border: "rgba(255,184,0,0.35)",  icon: "⚡", label: "MODERATE" },
  NORMAL:   { color: "#00ff88", bg: "rgba(0,255,136,0.08)",  border: "rgba(0,255,136,0.3)",   icon: "✅", label: "NORMAL"   },
  SUCCESS:  { color: "#00ff88", bg: "rgba(0,255,136,0.08)",  border: "rgba(0,255,136,0.3)",   icon: "✅", label: "OK"       },
  INFO:     { color: "#00c2ff", bg: "rgba(0,194,255,0.08)",  border: "rgba(0,194,255,0.3)",   icon: "ℹ️", label: "INFO"     },
};

function getLevel(pct) {
  if (pct >= 20) return "CRITICAL";
  if (pct >= 15) return "HIGH";
  if (pct >= 10) return "MODERATE";
  return "NORMAL";
}

// ── Toast system ──────────────────────────────────────────────
let _toastId = 0;
let _setToasts = null;

function showToast(message, level = "INFO") {
  if (!_setToasts) return;
  const id = ++_toastId;
  _setToasts(prev => [...prev, { id, message, level }]);
  setTimeout(() => {
    _setToasts(prev => prev.filter(t => t.id !== id));
  }, 5000);
}

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  _setToasts = setToasts;

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      display: "flex", flexDirection: "column-reverse", gap: 10,
      zIndex: 9999, maxWidth: 380,
    }}>
      {toasts.map(t => {
        const lv = LEVELS[t.level] || LEVELS.INFO;
        return (
          <div key={t.id} style={{
            background: lv.bg, border: `1px solid ${lv.border}`,
            borderLeft: `4px solid ${lv.color}`,
            borderRadius: 8, padding: "12px 16px",
            display: "flex", alignItems: "flex-start", gap: 10,
            animation: "fadeIn 0.3s ease",
            boxShadow: `0 4px 20px rgba(0,0,0,0.4)`,
            backdropFilter: "blur(8px)",
          }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{lv.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: lv.color, fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 3 }}>
                {lv.label}
              </div>
              <div style={{ color: "white", fontSize: 12, lineHeight: 1.5 }}>{t.message}</div>
            </div>
            <button onClick={() => _setToasts(p => p.filter(x => x.id !== t.id))}
              style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: 0, flexShrink: 0 }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

// ── Notifications Context ─────────────────────────────────────
const NotifContext = React.createContext(null);

function NotifProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread]               = useState(0);

  const addNotification = (notif) => {
    const entry = { ...notif, id: Date.now() + Math.random(), time: new Date().toISOString() };
    setNotifications(prev => [entry, ...prev].slice(0, 100));
    if (notif.level !== "NORMAL" && notif.level !== "SUCCESS") {
      setUnread(p => p + 1);
    }
  };

  const clearAll     = ()  => { setNotifications([]); setUnread(0); };
  const markAllRead  = ()  => setUnread(0);

  return (
    <NotifContext.Provider value={{ notifications, unread, addNotification, clearAll, markAllRead }}>
      {children}
    </NotifContext.Provider>
  );
}

function useNotif() { return React.useContext(NotifContext); }

// ── Ward scanner ──────────────────────────────────────────────
async function scanAllWards({ days, token, addNotification }) {
  try {
    const res = await axios.get(
      `${API}/alerts/scan?threshold=10&days=${Math.min(days, 90)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const results = res.data;
    const alerting = results.filter(w => w.Level !== "NORMAL");
    const normal   = results.filter(w => w.Level === "NORMAL");

    let delay = 400;

    for (const ward of alerting) {
      const lv = LEVELS[ward.Level] || LEVELS.INFO;
      addNotification({
        wardNo:   ward.Ward_No,
        wardName: ward.Ward_Name,
        level:    ward.Level,
        days,
        avgPct:   ward.Avg_Leakage_Pct,
        maxPct:   ward.Max_Leakage_Pct,
        peakDate: ward.Peak_Date,
        daysExc:  ward.Days_Exceeding,
        message:  `Zone ${ward.Ward_No} · ${ward.Ward_Name}: ${ward.Avg_Leakage_Pct?.toFixed(1)}% avg leakage`,
        detail:   `Peak: ${ward.Max_Leakage_Pct?.toFixed(1)}% on ${ward.Peak_Date} · ${ward.Days_Exceeding}/${days} days exceed threshold`,
      });
      setTimeout(() => {
        showToast(`Zone ${ward.Ward_No} · ${ward.Ward_Name} — ${ward.Avg_Leakage_Pct?.toFixed(1)}% avg leakage`, ward.Level);
      }, delay);
      delay += 520;
    }

    // Summary toast
    setTimeout(() => {
      if (alerting.length > 0) {
        const crit = results.filter(w => w.Level === "CRITICAL").length;
        const high = results.filter(w => w.Level === "HIGH").length;
        const mod  = results.filter(w => w.Level === "MODERATE").length;
        const parts = [];
        if (crit) parts.push(`${crit} CRITICAL`);
        if (high) parts.push(`${high} HIGH`);
        if (mod)  parts.push(`${mod} MODERATE`);
        parts.push(`${normal.length} NORMAL`);
        showToast(`${days}-day scan complete — ${parts.join(" · ")}`, "INFO");
        addNotification({
          wardName: "📊 Scan Summary",
          level:    crit > 0 ? "CRITICAL" : high > 0 ? "HIGH" : "MODERATE",
          days,
          message:  `${days}-day scan: ${alerting.length} zones need attention`,
          detail:   parts.join(" · "),
        });
      } else {
        showToast(`✅ All 27 zones normal — ${days}-day leakage within safe limits`, "SUCCESS");
        addNotification({
          wardName: "✅ All Clear",
          level:    "SUCCESS",
          days,
          message:  `All 27 zones within normal range for ${days}-day forecast`,
          detail:   "No zones exceed 9.52% leakage threshold",
        });
      }
    }, delay + 300);

    return results;
  } catch (err) {
    showToast("Zone scan failed — check Flask connection", "HIGH");
    return [];
  }
}

// ── ALERTS PAGE ───────────────────────────────────────────────
function AlertsPage({ days, onRunScan }) {
  const { user }         = useAuth();
  const { notifications, unread, clearAll, markAllRead } = useNotif();
  const [scanResults, setScanResults] = useState([]);
  const [scanning,    setScanning]    = useState(false);
  const [scanDays,    setScanDays]    = useState(days || 30);
  const [filterLevel, setFilterLevel] = useState("ALL");

  // Mark all read when page opens
  React.useEffect(() => { markAllRead(); }, []);

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await axios.get(
        `${API}/alerts/scan?threshold=10&days=${Math.min(scanDays, 90)}`,
        { headers: { Authorization: `Bearer ${user.token}` } }
      );
      setScanResults(res.data);
      showToast(`Scan complete — ${res.data.length} zones analysed`, "INFO");
    } catch (e) {
      showToast("Scan failed — is the backend running?", "HIGH");
    } finally { setScanning(false); }
  };

  const levelOrder = { CRITICAL: 0, HIGH: 1, MODERATE: 2, NORMAL: 3 };
  const sorted = [...scanResults].sort((a, b) => levelOrder[a.Level] - levelOrder[b.Level]);
  const filtered = filterLevel === "ALL" ? sorted : sorted.filter(r => r.Level === filterLevel);

  const counts = {
    CRITICAL: scanResults.filter(r => r.Level === "CRITICAL").length,
    HIGH:     scanResults.filter(r => r.Level === "HIGH").length,
    MODERATE: scanResults.filter(r => r.Level === "MODERATE").length,
    NORMAL:   scanResults.filter(r => r.Level === "NORMAL").length,
  };

  return (
    <div style={{ padding: "28px 24px" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontWeight: 800, fontSize: "1.2rem" }}>🔔 Smart Leakage Alert System</h2>
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
            4-level auto-classification · Scans all 27 zones · Based on PMC 9.52% benchmark
          </p>
        </div>
        {unread > 0 && (
          <div style={{
            background: "rgba(255,45,85,0.12)", border: "1px solid rgba(255,45,85,0.4)",
            color: "#ff2d55", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
          }}>
            🔔 {unread} unread notification{unread > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* ── 4-Level Classification Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { level: "CRITICAL", pct: "≥ 20%", desc: "Immediate action required — major pipe burst or severe infrastructure failure", icon: "🚨" },
          { level: "HIGH",     pct: "≥ 15%", desc: "Urgent field investigation needed — significantly above acceptable leakage range", icon: "⚠️" },
          { level: "MODERATE", pct: "≥ 10%", desc: "Monitor closely — above official 9.52% PMC benchmark from IIT Bombay ESR", icon: "⚡" },
          { level: "NORMAL",   pct: "< 10%",  desc: "Within acceptable range — aligned with IIT Bombay ESR 2024-25 official figure", icon: "✅" },
        ].map(c => {
          const lv = LEVELS[c.level];
          const count = counts[c.level];
          return (
            <div key={c.level} style={{
              background: count > 0 ? lv.bg : "rgba(255,255,255,0.02)",
              border: `1px solid ${count > 0 ? lv.border : "rgba(255,255,255,0.06)"}`,
              borderTop: `3px solid ${lv.color}`,
              borderRadius: 10, padding: "16px 16px 14px",
              transition: "all 0.2s",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{c.icon}</span>
                {count > 0 && (
                  <span style={{
                    background: lv.color, color: "white",
                    fontSize: 11, fontWeight: 800, fontFamily: "monospace",
                    padding: "2px 8px", borderRadius: 10,
                  }}>{count} zones</span>
                )}
              </div>
              <div style={{ color: lv.color, fontWeight: 800, fontSize: 13, letterSpacing: 0.5, marginBottom: 3 }}>{c.level}</div>
              <div style={{ color: lv.color, fontFamily: "monospace", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Threshold {c.pct}</div>
              <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.6 }}>{c.desc}</div>
            </div>
          );
        })}
      </div>

      {/* ── Scan Controls ── */}
      <div style={{
        background: C.surface, border: "1px solid rgba(0,212,255,0.15)",
        borderRadius: 10, padding: "18px 20px", marginBottom: 24,
        display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap",
      }}>
        <div>
          <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>SCAN HORIZON</div>
          <select value={scanDays} onChange={e => setScanDays(Number(e.target.value))}
            style={{ background: C.surface2, color: "white", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 5, padding: "9px 14px", fontSize: 13 }}>
            {[1, 7, 14, 30, 60, 90].map(d => (
              <option key={d} value={d}>Next {d} Day{d > 1 ? "s" : ""}</option>
            ))}
          </select>
        </div>
        <button onClick={runScan} disabled={scanning} style={{
          background: "rgba(255,45,85,0.12)", border: "1px solid rgba(255,45,85,0.4)",
          color: "#ff2d55", padding: "10px 26px", borderRadius: 5,
          fontWeight: 700, fontSize: 13, letterSpacing: 1,
          cursor: scanning ? "not-allowed" : "pointer", opacity: scanning ? 0.6 : 1,
        }}>
          {scanning ? "🔍 Scanning..." : "🔍 SCAN ALL 27 ZONES"}
        </button>
        {scanResults.length > 0 && !scanning && (
          <div style={{ color: C.muted, fontSize: 11 }}>
            ✅ {scanResults.length} zones scanned · {scanDays}-day horizon
          </div>
        )}
      </div>

      {/* ── Scan Results ── */}
      {scanResults.length > 0 && (
        <>
          {/* Summary KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            {["CRITICAL","HIGH","MODERATE","NORMAL"].map(lv => {
              const lvConf = LEVELS[lv];
              const c = counts[lv];
              return (
                <div key={lv} onClick={() => setFilterLevel(filterLevel === lv ? "ALL" : lv)}
                  style={{
                    background: filterLevel === lv ? lvConf.bg : "rgba(255,255,255,0.02)",
                    border: `1px solid ${filterLevel === lv ? lvConf.border : "rgba(255,255,255,0.06)"}`,
                    borderRadius: 8, padding: "12px 16px", cursor: "pointer",
                    transition: "all 0.2s", textAlign: "center",
                  }}>
                  <div style={{ color: lvConf.color, fontSize: "1.8rem", fontWeight: 700, fontFamily: "monospace" }}>{c}</div>
                  <div style={{ color: lvConf.color, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{lv}</div>
                </div>
              );
            })}
          </div>

          {/* Filter row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
            <span style={{ color: C.muted, fontSize: 11 }}>Filter:</span>
            {["ALL","CRITICAL","HIGH","MODERATE","NORMAL"].map(f => (
              <button key={f} onClick={() => setFilterLevel(f)} style={{
                padding: "4px 12px", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: filterLevel === f ? (LEVELS[f] ? LEVELS[f].bg : "rgba(0,194,255,0.12)") : "transparent",
                border: `1px solid ${filterLevel === f ? (LEVELS[f] ? LEVELS[f].border : "rgba(0,194,255,0.4)") : "rgba(255,255,255,0.1)"}`,
                color: filterLevel === f ? (LEVELS[f] ? LEVELS[f].color : C.supply) : C.muted,
              }}>{f}</button>
            ))}
            <span style={{ marginLeft: "auto", color: C.muted, fontSize: 11 }}>
              Showing {filtered.length} of {scanResults.length} zones
            </span>
          </div>

          {/* Zone cards grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 28 }}>
            {filtered.map(ward => {
              const lv = LEVELS[ward.Level] || LEVELS.INFO;
              return (
                <div key={ward.Ward_No} style={{
                  background: lv.bg, border: `1px solid ${lv.border}`,
                  borderLeft: `4px solid ${lv.color}`,
                  borderRadius: 10, padding: "16px 18px",
                  animation: "fadeIn 0.3s ease",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ color: "white", fontWeight: 700, fontSize: 13 }}>
                        Zone {ward.Ward_No} · {ward.Ward_Name}
                      </div>
                      <div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>{ward.Start_Date} → {ward.End_Date}</div>
                    </div>
                    <span style={{
                      background: `${lv.color}25`, border: `1px solid ${lv.border}`,
                      color: lv.color, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                      padding: "3px 10px", borderRadius: 4,
                    }}>{lv.icon} {ward.Level}</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Avg Leakage", value: `${ward.Avg_Leakage_Pct?.toFixed(2)}%`, color: lv.color },
                      { label: "Max Leakage", value: `${ward.Max_Leakage_Pct?.toFixed(2)}%`, color: lv.color },
                      { label: "Avg MLD",     value: `${ward.Avg_Leakage_MLD?.toFixed(3)}`, color: C.muted },
                      { label: "Days Exceed", value: `${ward.Days_Exceeding}/${scanDays}`,   color: ward.Days_Exceeding > 0 ? C.warning : C.consumption },
                    ].map((s,i) => (
                      <div key={i} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 5, padding: "7px 10px" }}>
                        <div style={{ color: C.muted, fontSize: 9, letterSpacing: 1, marginBottom: 2 }}>{s.label}</div>
                        <div style={{ color: s.color, fontWeight: 700, fontFamily: "monospace", fontSize: 13 }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {ward.Peak_Date && (
                    <div style={{ marginTop: 8, color: C.muted, fontSize: 10 }}>
                      📅 Peak: <span style={{ color: lv.color }}>{ward.Max_Leakage_Pct?.toFixed(1)}%</span> on {ward.Peak_Date}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {scanResults.length === 0 && !scanning && (
        <div style={{ textAlign: "center", color: C.muted, padding: "40px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 14 }}>Click "SCAN ALL 27 ZONES" to run a leakage analysis</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Results will show here with per-zone severity classification</div>
        </div>
      )}

      {/* ── Notification History ── */}
      {notifications.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>
              🔔 Notification History <span style={{ color: C.muted, fontWeight: 400, fontSize: 12 }}>({notifications.length})</span>
            </h3>
            <button onClick={clearAll} style={{
              background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.25)",
              color: C.leakage, padding: "5px 14px", borderRadius: 5,
              fontSize: 11, cursor: "pointer", fontWeight: 600,
            }}>Clear All</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {notifications.slice(0, 20).map(n => {
              const lv = LEVELS[n.level] || LEVELS.INFO;
              return (
                <div key={n.id} style={{
                  background: lv.bg, border: `1px solid ${lv.border}`,
                  borderLeft: `3px solid ${lv.color}`,
                  borderRadius: 8, padding: "12px 16px",
                  display: "flex", gap: 12, alignItems: "flex-start",
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{lv.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <span style={{ color: "white", fontWeight: 700, fontSize: 12 }}>{n.wardName}</span>
                      <span style={{ color: C.muted, fontSize: 10 }}>{n.time ? new Date(n.time).toLocaleTimeString() : ""}</span>
                    </div>
                    <div style={{ color: C.muted, fontSize: 11 }}>{n.message}</div>
                    {n.detail && <div style={{ color: C.muted, fontSize: 10, marginTop: 3, opacity: 0.7 }}>{n.detail}</div>}
                  </div>
                  <span style={{ color: lv.color, fontSize: 10, fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>{lv.label}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, unit, color, sub }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid rgba(0,212,255,0.15)`,
      borderTop: `2px solid ${color}`,
      borderRadius: 8, padding: "16px 18px",
      flex: 1, minWidth: 140,
    }}>
      <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ color, fontSize: "clamp(1.2rem,3vw,1.7rem)", fontWeight: 700, fontFamily: "monospace" }}>
        {value !== undefined && value !== null ? `${value}` : "—"}
        {unit && <span style={{ fontSize: "0.8rem", marginLeft: 4 }}>{unit}</span>}
      </div>
      {sub && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ErrorBanner({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      background: "rgba(255,77,109,0.12)", border: "1px solid rgba(255,77,109,0.4)",
      color: "#ff4d6d", padding: "12px 20px", borderRadius: 8,
      marginBottom: 20, fontFamily: "monospace", fontSize: 13,
    }}>⚠ {msg}</div>
  );
}

function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: 40, color: C.muted }}>
      <div style={{
        display: "inline-block", width: 32, height: 32,
        border: `3px solid ${C.surface2}`, borderTop: `3px solid ${C.supply}`,
        borderRadius: "50%", animation: "spin 0.8s linear infinite",
      }} />
      <div style={{ marginTop: 12, fontSize: 13 }}>Loading...</div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: C.surface2, border: "1px solid rgba(0,212,255,0.2)",
      borderRadius: 8, padding: "12px 16px", fontSize: 12,
    }}>
      <div style={{ color: "white", fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 3 }}>
          {p.name}: <b>{typeof p.value === "number" ? p.value.toFixed(3) : p.value}</b>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// NAVBAR  (original sticky dark design)
// ─────────────────────────────────────────────────────────────
function Navbar({ tab, setTab, unread }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";

  const NAV_ITEMS = [
    { id: "city",       label: "🏙 City"       },
    { id: "ward",       label: "🏘 Ward"       },
    { id: "historical", label: "📅 Historical" },
    { id: "metrics",    label: "📊 Metrics"    },
    { id: "analytics",  label: "📈 Analytics"  },
    { id: "alerts",     label: "🔔 Alerts"     },
    { id: "datafiles",  label: "📁 Data Files" },
    ...(isAdmin ? [
      { id: "upload", label: "⬆ Upload" },
      { id: "users",  label: "👥 Users"  },
    ] : []),
  ];

  return (
    <nav style={{
      background: "rgba(6,12,20,0.98)",
      borderBottom: "1px solid rgba(0,194,255,0.15)",
      backdropFilter: "blur(12px)",
      position: "sticky", top: 0, zIndex: 1000,
      padding: "0 20px",
    }}>
      <div style={{
        maxWidth: 1400, margin: "0 auto",
        display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 58,
      }}>

        {/* Logo */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexShrink: 0, cursor: "pointer",
        }} onClick={() => setTab("city")}>
          <span style={{ fontSize: 20 }}>💧</span>
          <span style={{
            color: "#00c2ff", fontWeight: 800, fontSize: 13,
            fontFamily: "monospace", letterSpacing: 1,
          }}>WATER MANAGEMENT</span>
        </div>

        {/* Nav links */}
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          {NAV_ITEMS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "6px 10px",
              background: tab === t.id ? "rgba(0,212,255,0.12)" : "transparent",
              border: tab === t.id ? "1px solid rgba(0,212,255,0.3)" : "1px solid transparent",
              borderRadius: 5, color: tab === t.id ? C.supply : C.muted,
              fontWeight: 600, fontSize: 12, cursor: "pointer", transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Right — bell + role badge + user + logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>

          {/* Bell button */}
          <button onClick={() => setTab("alerts")} style={{
            position: "relative",
            background: unread > 0 ? "rgba(255,45,85,0.12)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${unread > 0 ? "rgba(255,45,85,0.4)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: 6, padding: "5px 10px",
            display: "flex", alignItems: "center", gap: 6,
            cursor: "pointer", transition: "all 0.2s",
            animation: unread > 0 ? "bellPulse 0.6s ease" : "none",
          }}>
            <span style={{ fontSize: 17 }}>{unread > 0 ? "🔔" : "🔕"}</span>
            {unread > 0 && (
              <span style={{
                background: "#ff2d55", color: "white",
                fontSize: 10, fontWeight: 800, fontFamily: "monospace",
                minWidth: 18, height: 18, borderRadius: 9,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 5px", boxShadow: "0 0 8px rgba(255,45,85,0.6)",
              }}>{unread > 99 ? "99+" : unread}</span>
            )}
          </button>

          {/* Role badge */}
          <div style={{
            background: isAdmin ? "rgba(168,85,247,0.15)" : "rgba(0,194,255,0.12)",
            border: `1px solid ${isAdmin ? "rgba(168,85,247,0.4)" : "rgba(0,194,255,0.4)"}`,
            color: isAdmin ? "#a855f7" : C.supply,
            fontSize: 10, fontWeight: 800, fontFamily: "monospace",
            letterSpacing: 1, padding: "4px 10px", borderRadius: 4,
          }}>
            {isAdmin ? "⚙ ADMIN" : "🎓 STUDENT"}
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ color: "white", fontSize: 12, fontWeight: 700 }}>{user?.name}</div>
            <div style={{ color: C.muted, fontSize: 10 }}>{user?.email}</div>
          </div>

          <button onClick={logout} style={{
            background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)",
            color: "#ff4d6d", padding: "6px 12px", borderRadius: 5,
            cursor: "pointer", fontSize: 11, fontWeight: 700,
          }}>Logout</button>
        </div>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGIN PAGE  (original glowing cyan design)
// ─────────────────────────────────────────────────────────────
function LoginPage({ onSwitchToSignup }) {
  const { login } = useAuth();
  const [email, setEmail]   = useState("");
  const [pass,  setPass]    = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      const r = await axios.post(`${API}/auth/login`, { email, password: pass });
      login({ name: r.data.name, email: r.data.email, token: r.data.token, role: r.data.role || "student" });
    } catch (e) {
      setError(e.response?.data?.error || "Login failed");
    } finally { setLoading(false); }
  };

  const inp = {
    width: "100%", background: "#0d1a2b",
    border: "1px solid rgba(0,194,255,0.2)",
    color: "white", padding: "12px 14px", borderRadius: 6,
    fontSize: 14, outline: "none", marginBottom: 14,
  };

  return (
    <div style={{
      background: C.bg, minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Syne', sans-serif", padding: 20,
    }}>
      <div style={{
        background: "#0d1a2b", border: "1px solid rgba(0,194,255,0.15)",
        borderRadius: 14, padding: "48px 40px", width: "100%", maxWidth: 420,
        animation: "fadeIn 0.4s ease",
      }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💧</div>
          <h1 style={{
            fontSize: "1.8rem", fontWeight: 800, margin: "0 0 8px",
            color: "#00c2ff",
            textShadow: "0 0 30px rgba(0,194,255,0.5)",
          }}>
            Water Management<br />Analytics
          </h1>
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
            Smart City Dashboard · Panvel Municipal Corporation
          </p>
        </div>

        <ErrorBanner msg={error} />

        <input value={email} onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com" type="email" style={inp}
          onKeyDown={e => e.key === "Enter" && submit()} />
        <input value={pass} onChange={e => setPass(e.target.value)}
          placeholder="••••••••" type="password" style={{ ...inp, marginBottom: 20 }}
          onKeyDown={e => e.key === "Enter" && submit()} />

        <button onClick={submit} disabled={loading} style={{
          width: "100%", padding: "13px",
          background: "rgba(0,194,255,0.12)",
          border: "1px solid rgba(0,194,255,0.5)",
          color: "#00c2ff", borderRadius: 6,
          fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
          letterSpacing: 2, opacity: loading ? 0.6 : 1,
          transition: "all 0.2s",
        }}>
          {loading ? "⏳ SIGNING IN..." : "SIGN IN"}
        </button>

        <p style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 20 }}>
          Don't have an account?{" "}
          <span onClick={onSwitchToSignup} style={{
            color: "#00c2ff", cursor: "pointer", fontWeight: 700,
          }}>Create one</span>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SIGNUP PAGE  (role selector cards)
// ─────────────────────────────────────────────────────────────
function SignupPage({ onSwitchToLogin }) {
  const { login } = useAuth();
  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [pass2, setPass2] = useState("");
  const [role,  setRole]  = useState("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    if (pass !== pass2) { setError("Passwords do not match"); return; }
    if (pass.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/auth/register`, { name, email, password: pass, role });
      login({ name: r.data.name, email: r.data.email, token: r.data.token, role: r.data.role || role });
    } catch (e) {
      setError(e.response?.data?.error || "Registration failed");
    } finally { setLoading(false); }
  };

  const inp = {
    width: "100%", background: "#0d1a2b",
    border: "1px solid rgba(0,194,255,0.2)",
    color: "white", padding: "12px 14px", borderRadius: 6,
    fontSize: 14, outline: "none", marginBottom: 12,
  };

  return (
    <div style={{
      background: C.bg, minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Syne', sans-serif", padding: 20,
    }}>
      <div style={{
        background: "#0d1a2b", border: "1px solid rgba(0,194,255,0.15)",
        borderRadius: 14, padding: "40px 36px", width: "100%", maxWidth: 460,
        animation: "fadeIn 0.4s ease",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{
            fontSize: "1.6rem", fontWeight: 800, margin: "0 0 6px",
            color: "#00c2ff", textShadow: "0 0 24px rgba(0,194,255,0.4)",
          }}>
            Water Management<br />Analytics
          </h1>
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Create your account</p>
        </div>

        <ErrorBanner msg={error} />

        <input value={name}  onChange={e => setName(e.target.value)}  placeholder="Full Name"        style={inp} />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"   type="email" style={inp} />
        <input value={pass}  onChange={e => setPass(e.target.value)}  placeholder="Password (min 6)" type="password" style={inp} />
        <input value={pass2} onChange={e => setPass2(e.target.value)} placeholder="Confirm Password" type="password" style={{ ...inp, marginBottom: 18 }} />

        {/* Role selector */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 10 }}>SELECT YOUR ROLE</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { id: "student", icon: "🎓", label: "Student",  desc: "View analytics & download data",   border: C.supply,  bg: "rgba(0,194,255,0.08)"   },
              { id: "admin",   icon: "⚙",  label: "Admin",    desc: "Upload files & manage data",       border: "#a855f7", bg: "rgba(168,85,247,0.08)" },
            ].map(r => (
              <div key={r.id} onClick={() => setRole(r.id)} style={{
                padding: "14px 16px", borderRadius: 8, cursor: "pointer",
                background: role === r.id ? r.bg : "rgba(255,255,255,0.02)",
                border: `2px solid ${role === r.id ? r.border : "rgba(255,255,255,0.08)"}`,
                transition: "all 0.2s",
                boxShadow: role === r.id ? `0 0 14px ${r.border}33` : "none",
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{r.icon}</div>
                <div style={{
                  color: role === r.id ? r.border : "white",
                  fontWeight: 700, fontSize: 13, marginBottom: 3,
                }}>{r.label}</div>
                <div style={{ color: C.muted, fontSize: 11 }}>{r.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={submit} disabled={loading} style={{
          width: "100%", padding: "13px",
          background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.4)",
          color: "#00ff88", borderRadius: 6, fontWeight: 800,
          fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
          letterSpacing: 2, opacity: loading ? 0.6 : 1,
        }}>
          {loading ? "⏳ CREATING..." : "CREATE ACCOUNT"}
        </button>

        <p style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 18 }}>
          Already have an account?{" "}
          <span onClick={onSwitchToLogin} style={{
            color: "#00c2ff", cursor: "pointer", fontWeight: 700,
          }}>Sign in</span>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// UPLOAD PAGE  (admin only)
// ─────────────────────────────────────────────────────────────
function UploadPage() {
  const { user }   = useAuth();
  const [file,     setFile]    = useState(null);
  const [desc,     setDesc]    = useState("");
  const [status,   setStatus]  = useState(null);
  const [loading,  setLoading] = useState(false);

  const upload = async () => {
    if (!file) return;
    setLoading(true); setStatus(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("description", desc);
    try {
      const r = await axios.post(`${API}/admin/upload_excel`, fd, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setStatus({ ok: true, msg: `✅ Uploaded — ${r.data.rows} rows, ${r.data.columns?.join(", ")}` });
      setFile(null); setDesc("");
    } catch (e) {
      setStatus({ ok: false, msg: `Upload failed (${e.response?.status || "network"}): ${e.response?.data?.error || e.message}` });
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: "28px 24px", maxWidth: 700 }}>
      <h2 style={{ margin: "0 0 6px", fontWeight: 800 }}>⬆ Upload Data File</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 28 }}>Upload new Excel or CSV files with ward-wise water data.</p>

      <div style={{ background: C.surface, border: "1px solid rgba(0,212,255,0.15)", borderRadius: 10, padding: "28px" }}>
        <label style={{
          display: "block", border: "2px dashed rgba(0,194,255,0.3)",
          borderRadius: 8, padding: "32px", textAlign: "center", cursor: "pointer",
          marginBottom: 20, transition: "all 0.2s",
          background: file ? "rgba(0,194,255,0.05)" : "transparent",
        }}>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={e => setFile(e.target.files[0])} style={{ display: "none" }} />
          <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
          <div style={{ color: file ? C.supply : C.muted, fontWeight: 600, fontSize: 14 }}>
            {file ? `${file.name} (${(file.size/1024).toFixed(1)} KB)` : "Click to select Excel / CSV file"}
          </div>
        </label>

        <input value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Optional description (e.g. March 2026 ward data)"
          style={{
            width: "100%", background: C.surface2, border: "1px solid rgba(0,212,255,0.2)",
            color: "white", padding: "10px 14px", borderRadius: 6, fontSize: 13,
            outline: "none", marginBottom: 18,
          }} />

        {status && (
          <div style={{
            padding: "12px 16px", borderRadius: 6, marginBottom: 16, fontSize: 13,
            background: status.ok ? "rgba(0,255,136,0.08)" : "rgba(255,77,109,0.1)",
            border: `1px solid ${status.ok ? "rgba(0,255,136,0.3)" : "rgba(255,77,109,0.3)"}`,
            color: status.ok ? C.consumption : C.leakage,
          }}>{status.msg}</div>
        )}

        <button onClick={upload} disabled={!file || loading} style={{
          background: "rgba(0,194,255,0.12)", border: "1px solid rgba(0,194,255,0.4)",
          color: C.supply, padding: "11px 28px", borderRadius: 6,
          fontWeight: 700, fontSize: 13, cursor: !file || loading ? "not-allowed" : "pointer",
          opacity: !file || loading ? 0.5 : 1,
        }}>
          {loading ? "⏳ Uploading..." : "⬆ UPLOAD FILE"}
        </button>
      </div>

      <div style={{
        background: C.surface, border: "1px solid rgba(0,212,255,0.1)",
        borderRadius: 8, padding: "18px 20px", marginTop: 20,
      }}>
        <div style={{ color: C.supply, fontWeight: 700, fontSize: 12, marginBottom: 10 }}>📋 REQUIREMENTS</div>
        <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.8 }}>
          Accepted formats: .xlsx, .xls, .csv · Max size: 50 MB<br />
          Expected columns: Date, Zone_No, Ward_Name, Water_Supplied_MLD, Water_Consumed_MLD, Leakage_MLD
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// USERS PAGE  (admin only)
// ─────────────────────────────────────────────────────────────
function UsersPage() {
  const { user }  = useAuth();
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/admin/users`, {
      headers: { Authorization: `Bearer ${user.token}` },
    }).then(r => setUsers(r.data)).finally(() => setLoading(false));
  }, [user]);

  const admins   = users.filter(u => u.role === "admin").length;
  const students = users.filter(u => u.role === "student").length;

  return (
    <div style={{ padding: "28px 24px" }}>
      <h2 style={{ margin: "0 0 6px", fontWeight: 800 }}>👥 Registered Users</h2>
      <p style={{ color: C.muted, marginBottom: 24, fontSize: 13 }}>All users registered on Water Management Analytics.</p>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
        <KpiCard label="Total Users"    value={users.length} color={C.supply} />
        <KpiCard label="Admins"         value={admins}       color="#a855f7" />
        <KpiCard label="Students"       value={students}     color={C.consumption} />
      </div>

      {loading ? <Spinner /> : (
        <div style={{ overflowX: "auto", background: C.surface, borderRadius: 8, border: "1px solid rgba(0,212,255,0.1)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.2)" }}>
                {["#", "Name", "Email", "Role", "Registered"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: C.supply, fontFamily: "monospace", letterSpacing: 1, fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? C.surface2 : "transparent" }}>
                  <td style={{ padding: "10px 14px", color: C.muted, fontFamily: "monospace" }}>{i + 1}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{u.name}</td>
                  <td style={{ padding: "10px 14px", color: C.muted }}>{u.email}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      background: u.role === "admin" ? "rgba(168,85,247,0.15)" : "rgba(0,194,255,0.12)",
                      color: u.role === "admin" ? "#a855f7" : C.supply,
                      border: `1px solid ${u.role === "admin" ? "rgba(168,85,247,0.3)" : "rgba(0,194,255,0.3)"}`,
                      padding: "2px 10px", borderRadius: 3, fontSize: 10, fontWeight: 700,
                    }}>
                      {u.role === "admin" ? "⚙ ADMIN" : "🎓 STUDENT"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", color: C.muted, fontSize: 12 }}>{u.created?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DATA FILES PAGE  (both roles — admin can delete)
// ─────────────────────────────────────────────────────────────
function DataFilesPage() {
  const { user }  = useAuth();
  const isAdmin   = user?.role === "admin";
  const [files,   setFiles]   = useState([]);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filesErr, setFilesErr] = useState("");

  const loadFiles = () => {
    setLoading(true); setFilesErr("");
    axios.get(`${API}/admin/files`, { headers: { Authorization: `Bearer ${user.token}` } })
      .then(r => setFiles(r.data))
      .catch(e => setFilesErr(e.response?.data?.error || "Could not load uploaded files — backend may not support this yet."))
      .finally(() => setLoading(false));
  };

  useEffect(loadFiles, [user]);

  const del = async (id) => {
    if (!window.confirm("Delete this file?")) return;
    await axios.delete(`${API}/admin/files/${id}`, { headers: { Authorization: `Bearer ${user.token}` } });
    loadFiles();
  };

  const loadPreview = async (id, name) => {
    const r = await axios.get(`${API}/admin/files/${id}/preview`, { headers: { Authorization: `Bearer ${user.token}` } });
    setPreview({ name, rows: r.data });
  };

  // Fix: fetch with Authorization header then trigger blob download
  const downloadWithAuth = async (url, filename) => {
    try {
      const res = await fetch(`${API}${url}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!res.ok) { alert("Download failed: " + res.status); return; }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (e) {
      alert("Download error: " + e.message);
    }
  };

  const download  = (id, name) => downloadWithAuth(`/admin/files/${id}/download`, name);
  const dlBuiltin = (url, name) => downloadWithAuth(url, name);

  const BUILTINS = [
    { label: "City Historical Data (Excel)", url: "/download/historical_excel", file: "City_Historical.xlsx" },
    ...[1,2,3,4,5].map(n => ({
      label: `Zone ${n} Historical (Excel)`,
      url:   `/download/ward_excel/${n}`,
      file:  `Zone_${n}_Historical.xlsx`,
    })),
  ];

  return (
    <div style={{ padding: "28px 24px" }}>
      <h2 style={{ margin: "0 0 6px", fontWeight: 800 }}>📁 Data Files</h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 28 }}>
        Download built-in datasets or files uploaded by administrators.
      </p>

      {/* Built-in downloads */}
      <h4 style={{ color: C.supply, marginBottom: 14, fontSize: 12, letterSpacing: 2 }}>BUILT-IN DOWNLOADS</h4>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 32 }}>
        {BUILTINS.map(b => (
          <button key={b.url} onClick={() => dlBuiltin(b.url, b.file)} style={{
            background: C.surface, border: "1px solid rgba(0,212,255,0.2)",
            color: C.supply, padding: "9px 16px", borderRadius: 6,
            fontSize: 12, cursor: "pointer", fontWeight: 600,
          }}>⬇ {b.label}</button>
        ))}
      </div>

      {/* Uploaded files */}
      <h4 style={{ color: C.supply, marginBottom: 14, fontSize: 12, letterSpacing: 2 }}>UPLOADED FILES</h4>
      {filesErr ? (
        <div style={{ color: C.muted, fontSize: 13, padding: "16px 0" }}>ℹ️ {filesErr}</div>
      ) : loading ? <Spinner /> : files.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 14, padding: "28px 0" }}>No uploaded files yet.</div>
      ) : (
        <div style={{ overflowX: "auto", background: C.surface, borderRadius: 8, border: "1px solid rgba(0,212,255,0.1)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.2)" }}>
                {["File Name", "Rows", "Size", "Date", "Description", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: C.supply, fontFamily: "monospace", fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {files.map((f, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? C.surface2 : "transparent" }}>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>{f.original_name}</td>
                  <td style={{ padding: "10px 14px", color: C.muted, fontFamily: "monospace" }}>{f.rows}</td>
                  <td style={{ padding: "10px 14px", color: C.muted }}>{(f.file_size / 1024).toFixed(1)} KB</td>
                  <td style={{ padding: "10px 14px", color: C.muted }}>{f.uploaded_at?.slice(0, 10)}</td>
                  <td style={{ padding: "10px 14px", color: C.muted, fontSize: 11 }}>{f.description || "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => loadPreview(f.id, f.original_name)} style={{
                        background: "rgba(0,194,255,0.1)", border: "1px solid rgba(0,194,255,0.3)",
                        color: C.supply, padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer",
                      }}>👁 Preview</button>
                      <button onClick={() => download(f.id, f.original_name)} style={{
                        background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.3)",
                        color: C.consumption, padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer",
                      }}>⬇ Download</button>
                      {isAdmin && (
                        <button onClick={() => del(f.id)} style={{
                          background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)",
                          color: C.leakage, padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer",
                        }}>🗑 Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20,
        }}>
          <div style={{
            background: C.surface, border: "1px solid rgba(0,212,255,0.2)",
            borderRadius: 12, padding: 28, width: "100%", maxWidth: 900,
            maxHeight: "80vh", overflow: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 style={{ margin: 0, color: C.supply }}>Preview — {preview.name}</h3>
              <button onClick={() => setPreview(null)} style={{
                background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)",
                color: C.leakage, padding: "6px 14px", borderRadius: 5, cursor: "pointer",
              }}>✕ Close</button>
            </div>
            {preview.rows?.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.2)" }}>
                      {Object.keys(preview.rows[0]).map(k => (
                        <th key={k} style={{ padding: "8px 12px", textAlign: "left", color: C.supply, fontFamily: "monospace", fontSize: 9 }}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? C.surface2 : "transparent" }}>
                        {Object.values(r).map((v, j) => (
                          <td key={j} style={{ padding: "7px 12px", color: C.muted }}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// INSIGHTS BOX  — rich card design
// ─────────────────────────────────────────────────────────────
function InsightsBox() {
  const FEATURES = [
    { icon: "💧", title: "City-Wide Supply Forecast",          desc: "Predicts daily water across all 27 Panvel zones (avg ~211 MLD) for up to 365 days using Gradient Boosting ML.",      color: "#00c2ff" },
    { icon: "📍", title: "Zone-Level Leakage Detection",       desc: "Shows leakage % per zone vs the official 9.52% PMC benchmark — flags CRITICAL, HIGH, MODERATE & NORMAL zones.",        color: "#00ff88" },
    { icon: "📅", title: "181 Days of Historical Trends",      desc: "Actual supply, consumption & leakage data from Sep 2025 – Feb 2026 aligned with IIT Bombay PMC ESR 2024-25.",          color: "#00c2ff" },
    { icon: "🤖", title: "High-Accuracy ML (R² = 0.9802)",     desc: "29 Gradient Boosting models trained on 18 lag & calendar features achieve 98% city-level prediction accuracy.",          color: "#00ff88" },
    { icon: "🔔", title: "Smart Alert Classification",         desc: "Auto-classifies every zone post-prediction: CRITICAL ≥20%, HIGH ≥15%, MODERATE ≥10%, NORMAL <10%.",                    color: "#00c2ff" },
  ];
  const LIMITATIONS = [
    { icon: "📡", title: "No Live IoT Sensor Data",             desc: "Values come from official PMC PDF figures via a mathematical model — not real-time pipe sensors or smart meters.",       color: "#ff4d6d" },
    { icon: "📉", title: "Accuracy Drops Beyond 180 Days",      desc: "Rolling prediction error compounds as the model feeds its own outputs as inputs — R² drops from 0.98 to ~0.89.",        color: "#ffb800" },
    { icon: "🌧️", title: "Weather & Events Not Included",       desc: "Monsoon surges, droughts, dam overflow and pipe bursts are not factored into the forecast model.",                       color: "#ff4d6d" },
    { icon: "🏘️", title: "Leakage Fixed at 9.52% Per Zone",    desc: "The 9.52% is the annual average from IIT Bombay ESR 2024-25. Daily per-zone variation is not tracked live.",            color: "#ffb800" },
    { icon: "😴", title: "Server Cold Start (Free Tier)",        desc: "Render free tier sleeps after 15 min idle. First API call after inactivity takes 30–60 seconds to wake up.",            color: "#ff4d6d" },
  ];

  return (
    <div style={{
      marginTop: 32, background: "linear-gradient(135deg, #0a1628 0%, #0d1a2b 100%)",
      border: "1px solid rgba(0,212,255,0.2)", borderRadius: 16, padding: "32px 28px 28px",
      boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)",
          padding: "6px 18px", borderRadius: 20, marginBottom: 14,
        }}>
          <span style={{ fontSize: 14 }}>💡</span>
          <span style={{ color: "#00c2ff", fontSize: 11, fontFamily: "monospace", letterSpacing: 3, fontWeight: 700 }}>
            DASHBOARD INSIGHTS
          </span>
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: "1.3rem", fontWeight: 800, color: "white" }}>
          What This Dashboard Tells You
        </h2>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
          5 capabilities this system provides · 5 known limitations to be aware of
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* ── FEATURES COLUMN ── */}
        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
            padding: "10px 16px", background: "rgba(0,255,136,0.06)",
            border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8,
          }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <span style={{ color: "#00ff88", fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>WHAT IT DOES WELL</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{
                display: "flex", gap: 14, padding: "14px 16px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderLeft: `3px solid ${f.color}`,
                borderRadius: 8, transition: "all 0.2s",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: `${f.color}15`,
                  border: `1px solid ${f.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18,
                }}>{f.icon}</div>
                <div>
                  <div style={{ color: "white", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{f.title}</div>
                  <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── LIMITATIONS COLUMN ── */}
        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
            padding: "10px 16px", background: "rgba(255,77,109,0.06)",
            border: "1px solid rgba(255,77,109,0.2)", borderRadius: 8,
          }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span style={{ color: "#ff4d6d", fontWeight: 800, fontSize: 12, letterSpacing: 1 }}>KNOWN LIMITATIONS</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {LIMITATIONS.map((f, i) => (
              <div key={i} style={{
                display: "flex", gap: 14, padding: "14px 16px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderLeft: `3px solid ${f.color}`,
                borderRadius: 8,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: `${f.color}15`,
                  border: `1px solid ${f.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18,
                }}>{f.icon}</div>
                <div>
                  <div style={{ color: "white", fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{f.title}</div>
                  <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.6 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer bar */}
      <div style={{
        marginTop: 24, padding: "12px 16px",
        background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)",
        borderRadius: 8, display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 16 }}>📋</span>
        <div style={{ color: C.muted, fontSize: 11, lineHeight: 1.7 }}>
          <span style={{ color: "#00c2ff", fontWeight: 700 }}>Data Source: </span>
          PMC Environmental Status Report 2024-25 · IIT Bombay ESED · Dr. Abhishek Chakraborty ·{" "}
          <span style={{ color: "white" }}>27 Zones · 4,887 Records · 181 Days</span> (Sep 2025 – Feb 2026)
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────
function Dashboard({
  tab, setTab,
  cityData, setCityData,
  wardData, setWardData,
  days, setDays,
  selectedWard, setSelectedWard,
}) {
  const { user }                = useAuth();
  const isAdmin                 = user?.role === "admin";
  const [wardList, setWardList] = useState([]);
  const [summary,  setSummary]  = useState({});
  const [metrics,  setMetrics]  = useState([]);
  const [historical, setHistorical] = useState([]);
  const [loading,  setLoading]  = useState({});
  const [scanning, setScanning] = useState(false);
  const [error,    setError]    = useState("");

  const setLoad = (k, v) => setLoading(p => ({ ...p, [k]: v }));

  const apiGet = useCallback(async (url) => {
    const res = await axios.get(`${API}${url}`, {
      headers: { Authorization: `Bearer ${user?.token}` },
    });
    return res.data;
  }, [user]);

  // Load summary + ward list on mount
  useEffect(() => {
    (async () => {
      try {
        const [sum, wards] = await Promise.all([apiGet("/summary"), apiGet("/wards")]);
        setSummary(sum); setWardList(wards);
      } catch (e) {
        setError("Could not connect to the API. Check if Flask is running.");
      }
    })();
  }, [apiGet]);

  // Load historical on tab switch
  useEffect(() => {
    if (tab === "historical") {
      (async () => {
        setLoad("hist", true);
        try { setHistorical(await apiGet("/historical/city")); }
        catch (e) { setError("Failed to load historical data."); }
        finally { setLoad("hist", false); }
      })();
    }
  }, [tab, apiGet]);

  // Load metrics on tab switch
  useEffect(() => {
    if (tab === "metrics") {
      (async () => {
        setLoad("metrics", true);
        try { setMetrics(await apiGet("/metrics")); }
        catch (e) { setError("Failed to load metrics."); }
        finally { setLoad("metrics", false); }
      })();
    }
  }, [tab, apiGet]);

  // ── City predict ─────────────────────────────────────────
  const { addNotification } = useNotif();

  const fetchCity = useCallback(async () => {
    setError(""); setLoad("city", true);
    try {
      const result = await apiGet(`/predict/city/${days}`);
      setCityData(result);

      // Fire city-level toast
      const avgLeak = result.reduce((a,r) => a + r.Leakage_Percentage, 0) / result.length;
      const critDays = result.filter(r => r.Leakage_Percentage >= 20).length;
      const highDays = result.filter(r => r.Leakage_Percentage >= 15).length;
      if (critDays > 0) {
        showToast(`City ${days}-day: ${critDays} CRITICAL days (≥20% leakage) detected!`, "CRITICAL");
      } else if (highDays > 0) {
        showToast(`City ${days}-day: ${highDays} HIGH days (≥15%) — avg ${avgLeak.toFixed(1)}%`, "HIGH");
      } else {
        showToast(`City ${days}-day forecast loaded — avg leakage ${avgLeak.toFixed(1)}%`, "SUCCESS");
      }

      // Background scan all 27 zones
      setScanning(true);
      scanAllWards({ days, token: user.token, addNotification })
        .finally(() => setScanning(false));

    } catch (e) {
      setError(e.response?.data?.error || e.message);
      showToast("Prediction failed — check if Flask is running", "HIGH");
    } finally { setLoad("city", false); }
  }, [days, apiGet, setCityData, user, addNotification]);

  // ── Ward predict ─────────────────────────────────────────
  const fetchWard = useCallback(async () => {
    setError(""); setLoad("ward", true);
    try {
      const result = await apiGet(`/predict/ward/${selectedWard}/${days}`);
      setWardData(result);
      const lk = result[0]?.Leakage_Percentage || 0;
      const level = lk >= 20 ? "CRITICAL" : lk >= 15 ? "HIGH" : lk >= 10 ? "MODERATE" : "SUCCESS";
      showToast(`Ward ${result[0]?.Ward_Name}: ${lk}% leakage — ${level}`, level);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally { setLoad("ward", false); }
  }, [selectedWard, days, apiGet, setWardData]);

  // Downsample chart data for large day ranges
  const sampleCity = days <= 30 ? cityData
    : days <= 90  ? cityData.filter((_, i) => i % 3  === 0)
    : days <= 180 ? cityData.filter((_, i) => i % 7  === 0)
    : cityData.filter((_, i) => i % 14 === 0);

  const sampleWard = days <= 30 ? wardData
    : days <= 90  ? wardData.filter((_, i) => i % 3  === 0)
    : days <= 180 ? wardData.filter((_, i) => i % 7  === 0)
    : wardData.filter((_, i) => i % 14 === 0);

  const avgOf = (data, key) => data.length
    ? (data.reduce((a, r) => a + (r[key] || 0), 0) / data.length).toFixed(3)
    : null;

  // route special tabs
  if (tab === "upload")    return isAdmin ? <UploadPage />    : null;
  if (tab === "users")     return isAdmin ? <UsersPage />     : null;
  if (tab === "datafiles") return <DataFilesPage />;
  if (tab === "alerts")    return <AlertsPage days={days} />;

  return (
    <div style={{ padding: "clamp(16px,3vw,28px) clamp(16px,3vw,24px)" }}>

      {/* ── Summary KPIs (always visible on city tab) ── */}
      {tab === "city" && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <KpiCard label="Last Data Date"     value={summary.Last_Data_Date}                  color={C.supply} />
          <KpiCard label="Avg Daily Supply"   value={summary.Avg_Daily_Supply_MLD}   unit="MLD" color={C.supply}      sub="Historical avg" />
          <KpiCard label="Avg Daily Leakage"  value={summary.Avg_Daily_Leakage_MLD}  unit="MLD" color={C.leakage}
            sub={summary.Avg_Leakage_Percentage ? `${summary.Avg_Leakage_Percentage}% of supply` : ""} />
          <KpiCard label="Worst Leakage Zone" value={summary.Highest_Leakage_Ward}              color={C.warning}     sub={`Zone ${summary.Highest_Leakage_Ward_No}`} />
          <KpiCard label="Model R²"           value={summary.Model_Accuracy?.City_Supply_R2}   color={C.consumption} sub="27 Zones · Gradient Boosting" />
        </div>
      )}

      <ErrorBanner msg={error} />

      {/* ── Controls (city + ward tabs) ── */}
      {(tab === "city" || tab === "ward") && (
        <div style={{
          background: C.surface, border: "1px solid rgba(0,212,255,0.15)",
          borderRadius: 8, padding: "14px 18px", marginBottom: 20,
          display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap",
        }}>
          <div>
            <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>FORECAST HORIZON</div>
            <select value={days} onChange={e => setDays(Number(e.target.value))}
              style={{ background: C.surface2, color: "white", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 5, padding: "9px 14px", fontSize: 13 }}>
              {HORIZON_OPTIONS.map(o => (
                <option key={o.days} value={o.days}>{o.label}</option>
              ))}
            </select>
          </div>

          {tab === "ward" && (
            <div>
              <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>SELECT WARD</div>
              <select value={selectedWard} onChange={e => setSelectedWard(Number(e.target.value))}
                style={{ background: C.surface2, color: "white", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 5, padding: "9px 14px", fontSize: 13 }}>
                {wardList.map(w => (
                  <option key={w.Ward_No} value={w.Ward_No}>Ward {w.Ward_No} — {w.Ward_Name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={tab === "ward" ? fetchWard : fetchCity}
            disabled={loading.city || loading.ward || scanning}
            style={{
              background: "rgba(0,194,255,0.12)", border: "1px solid rgba(0,194,255,0.4)",
              color: C.supply, padding: "10px 26px", borderRadius: 5,
              fontWeight: 700, fontSize: 13, letterSpacing: 1,
              cursor: loading.city || loading.ward || scanning ? "not-allowed" : "pointer",
              opacity: loading.city || loading.ward || scanning ? 0.6 : 1,
            }}>
            {loading.city || loading.ward ? "⏳ Predicting..."
              : scanning ? "🔍 Scanning wards..." : "▶ PREDICT"}
          </button>

          {scanning && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.warning, fontSize: 12 }}>
              <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⚙️</span>
              Scanning all 27 zones for leakage alerts...
            </div>
          )}

          {((tab === "city" && cityData.length > 0) || (tab === "ward" && wardData.length > 0)) && !loading.city && !loading.ward && !scanning && (
            <div style={{ color: C.muted, fontSize: 11, paddingBottom: 2 }}>
              {tab === "city"
                ? `✅ ${cityData.length} days · ${cityData[0]?.Date} → ${cityData[cityData.length-1]?.Date}`
                : `✅ ${wardData.length} days`}
            </div>
          )}
        </div>
      )}

      {/* ── Tab bar ── */}
      <div style={{
        display: "flex", gap: 4,
        background: C.surface, border: "1px solid rgba(0,212,255,0.15)",
        borderRadius: 8, padding: 6, marginBottom: 28, flexWrap: "wrap",
      }}>
        {[
          { id: "city",       label: "🏙 City Forecast"  },
          { id: "ward",       label: "🏘 Ward Forecast"  },
          { id: "historical", label: "📅 Historical"     },
          { id: "metrics",    label: "📊 Model Metrics"  },
          { id: "analytics",  label: "📈 Analytics"      },
          { id: "alerts",     label: "🔔 Alerts"         },
          { id: "datafiles",  label: "📁 Data Files"     },
          ...(isAdmin ? [
            { id: "upload", label: "⬆ Upload" },
            { id: "users",  label: "👥 Users"  },
          ] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, minWidth: 100, padding: "10px 12px",
            background: tab === t.id ? "rgba(0,212,255,0.12)" : "transparent",
            border:     tab === t.id ? "1px solid rgba(0,212,255,0.3)" : "1px solid transparent",
            borderRadius: 5, color: tab === t.id ? C.supply : C.muted,
            fontWeight: 600, fontSize: 12, cursor: "pointer", transition: "all 0.2s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ─────── CITY TAB ─────── */}
      {tab === "city" && (
        loading.city ? <Spinner /> : cityData.length === 0 ? (
          <div style={{ textAlign: "center", color: C.muted, padding: "60px 20px", fontSize: 14 }}>
            Select a forecast horizon and click PREDICT
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
              <KpiCard label="Avg Predicted Supply"      value={avgOf(cityData, "Predicted_Supply_MLD")}      unit="MLD" color={C.supply} />
              <KpiCard label="Avg Predicted Consumption" value={avgOf(cityData, "Predicted_Consumption_MLD")} unit="MLD" color={C.consumption} />
              <KpiCard label="Avg Predicted Leakage"     value={avgOf(cityData, "Predicted_Leakage_MLD")}     unit="MLD" color={C.leakage} />
              <KpiCard label="Avg Leakage %"             value={avgOf(cityData, "Leakage_Percentage")}         unit="%"   color={C.warning} />
            </div>

            <h3 style={{ marginBottom: 12, color: "#ccd6f6", fontSize: 14 }}>Supply & Consumption Forecast</h3>
            <div style={{ background: C.surface, borderRadius: 10, padding: "clamp(12px,3vw,20px)", marginBottom: 16, border: "1px solid rgba(0,212,255,0.1)" }}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={sampleCity}>
                  <defs>
                    <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.supply}      stopOpacity={0.25} />
                      <stop offset="95%" stopColor={C.supply}      stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.consumption} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={C.consumption} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="Date" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} interval={Math.floor(sampleCity.length / 8)} />
                  <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} unit=" MLD" width={60} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: C.muted, fontSize: 12 }} />
                  <Area type="monotone" dataKey="Predicted_Supply_MLD"      stroke={C.supply}      fill="url(#gS)" strokeWidth={2} name="Supply"      dot={false} />
                  <Area type="monotone" dataKey="Predicted_Consumption_MLD" stroke={C.consumption} fill="url(#gC)" strokeWidth={2} name="Consumption" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <h3 style={{ marginBottom: 12, color: "#ccd6f6", fontSize: 14 }}>Leakage Forecast</h3>
            <div style={{ background: C.surface, borderRadius: 10, padding: "clamp(12px,3vw,20px)", marginBottom: 16, border: "1px solid rgba(0,212,255,0.1)" }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sampleCity}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="Date" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} interval={Math.floor(sampleCity.length / 8)} />
                  <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} unit=" MLD" width={60} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Predicted_Leakage_MLD" name="Leakage" radius={[3, 3, 0, 0]}>
                    {sampleCity.map((r, i) => (
                      <Cell key={i} fill={
                        r.Leakage_Percentage >= 20 ? "#ff2d55" :
                        r.Leakage_Percentage >= 15 ? C.leakage :
                        r.Leakage_Percentage >= 10 ? C.warning : C.consumption
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <h3 style={{ marginBottom: 12, color: "#ccd6f6", fontSize: 14 }}>Detailed Predictions</h3>
            <div style={{ overflowX: "auto", background: C.surface, borderRadius: 8, border: "1px solid rgba(0,212,255,0.1)", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.2)" }}>
                    {["Date", "Supply MLD", "Consumption MLD", "Leakage MLD", "Leakage %", "Status"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: C.supply, fontFamily: "monospace", fontSize: 10, letterSpacing: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cityData.map((row, i) => {
                    const lv = row.Leakage_Percentage >= 20 ? "CRITICAL" : row.Leakage_Percentage >= 15 ? "HIGH" : row.Leakage_Percentage >= 10 ? "MODERATE" : "NORMAL";
                    const lc = lv === "CRITICAL" ? "#ff2d55" : lv === "HIGH" ? C.leakage : lv === "MODERATE" ? C.warning : C.consumption;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? C.surface2 : "transparent" }}>
                        <td style={{ padding: "9px 12px", fontFamily: "monospace", color: C.muted }}>{row.Date}</td>
                        <td style={{ padding: "9px 12px", color: C.supply,      fontWeight: 600 }}>{row.Predicted_Supply_MLD}</td>
                        <td style={{ padding: "9px 12px", color: C.consumption, fontWeight: 600 }}>{row.Predicted_Consumption_MLD}</td>
                        <td style={{ padding: "9px 12px", color: C.leakage,     fontWeight: 600 }}>{row.Predicted_Leakage_MLD}</td>
                        <td style={{ padding: "9px 12px" }}>
                          <span style={{ background: `${lc}18`, color: lc, padding: "2px 8px", borderRadius: 3, fontFamily: "monospace", border: `1px solid ${lc}44` }}>
                            {row.Leakage_Percentage}%
                          </span>
                        </td>
                        <td style={{ padding: "9px 12px", fontSize: 10, color: lc, fontWeight: 700 }}>{lv}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )
      )}

      {/* ─────── WARD TAB ─────── */}
      {tab === "ward" && (
        loading.ward ? <Spinner /> : wardData.length === 0 ? (
          <div style={{ textAlign: "center", color: C.muted, padding: "60px 20px", fontSize: 14 }}>
            Select a ward and click PREDICT
          </div>
        ) : (
          <>
            <h3 style={{ marginBottom: 14 }}>
              Ward {wardData[0]?.Ward_No} — {wardData[0]?.Ward_Name} · {days}-Day Forecast
            </h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
              <KpiCard label="Avg Supply"      value={avgOf(wardData, "Predicted_Supply_MLD")}      unit="MLD" color={C.supply} />
              <KpiCard label="Avg Consumption" value={avgOf(wardData, "Predicted_Consumption_MLD")} unit="MLD" color={C.consumption} />
              <KpiCard label="Avg Leakage"     value={avgOf(wardData, "Predicted_Leakage_MLD")}     unit="MLD" color={C.leakage} />
              <KpiCard label="Leakage %"       value={wardData[0]?.Leakage_Percentage}              unit="%" color={C.warning} />
            </div>

            <div style={{ background: C.surface, borderRadius: 10, padding: "clamp(12px,3vw,20px)", marginBottom: 16, border: "1px solid rgba(0,212,255,0.1)" }}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={sampleWard}>
                  <defs>
                    <linearGradient id="wS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.supply} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={C.supply} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="Date" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} interval={Math.floor(sampleWard.length / 8)} />
                  <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} unit=" MLD" width={60} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: C.muted, fontSize: 12 }} />
                  <Area type="monotone" dataKey="Predicted_Supply_MLD"      stroke={C.supply}      fill="url(#wS)" strokeWidth={2} name="Supply"      dot={false} />
                  <Area type="monotone" dataKey="Predicted_Consumption_MLD" stroke={C.consumption} fill="none"      strokeWidth={2} name="Consumption" dot={false} />
                  <Area type="monotone" dataKey="Predicted_Leakage_MLD"     stroke={C.leakage}     fill="none"      strokeWidth={2} name="Leakage"     dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ overflowX: "auto", background: C.surface, borderRadius: 8, border: "1px solid rgba(0,212,255,0.1)", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 500 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.2)" }}>
                    {["Date", "Supply MLD", "Consumption MLD", "Leakage MLD", "Leakage %"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: C.supply, fontFamily: "monospace", fontSize: 10, letterSpacing: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wardData.map((row, i) => {
                    const lv = row.Leakage_Percentage >= 20 ? "CRITICAL" : row.Leakage_Percentage >= 15 ? "HIGH" : row.Leakage_Percentage >= 10 ? "MODERATE" : "NORMAL";
                    const lc = lv === "CRITICAL" ? "#ff2d55" : lv === "HIGH" ? C.leakage : lv === "MODERATE" ? C.warning : C.consumption;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? C.surface2 : "transparent" }}>
                        <td style={{ padding: "9px 12px", fontFamily: "monospace", color: C.muted }}>{row.Date}</td>
                        <td style={{ padding: "9px 12px", color: C.supply,      fontWeight: 600 }}>{row.Predicted_Supply_MLD}</td>
                        <td style={{ padding: "9px 12px", color: C.consumption, fontWeight: 600 }}>{row.Predicted_Consumption_MLD}</td>
                        <td style={{ padding: "9px 12px", color: C.leakage,     fontWeight: 600 }}>{row.Predicted_Leakage_MLD}</td>
                        <td style={{ padding: "9px 12px" }}>
                          <span style={{ background: `${lc}18`, color: lc, padding: "2px 8px", borderRadius: 3, fontFamily: "monospace", border: `1px solid ${lc}44` }}>
                            {row.Leakage_Percentage}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )
      )}

      {/* ─────── HISTORICAL TAB ─────── */}
      {tab === "historical" && (
        loading.hist ? <Spinner /> : historical.length === 0 ? <Spinner /> : (
          <>
            <h3 style={{ marginBottom: 14 }}>Historical City Data — Sep 2025 to Feb 2026</h3>
            <div style={{ background: C.surface, borderRadius: 10, padding: "clamp(12px,3vw,20px)", border: "1px solid rgba(0,212,255,0.1)", marginBottom: 24 }}>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={historical}>
                  <defs>
                    <linearGradient id="hS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.supply} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={C.supply} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="Date" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} interval={14} />
                  <YAxis tick={{ fill: C.muted, fontSize: 11 }} tickLine={false} unit=" MLD" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: C.muted, fontSize: 12 }} />
                  <Area type="monotone" dataKey="Water_Supplied_MLD" stroke={C.supply}      fill="url(#hS)" strokeWidth={2} name="Supply"      dot={false} />
                  <Area type="monotone" dataKey="Water_Consumed_MLD" stroke={C.consumption} fill="none"      strokeWidth={2} name="Consumption" dot={false} />
                  <Area type="monotone" dataKey="Leakage_MLD"        stroke={C.leakage}     fill="none"      strokeWidth={1.5} name="Leakage"  dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )
      )}

      {/* ─────── METRICS TAB ─────── */}
      {tab === "metrics" && (
        loading.metrics ? <Spinner /> : (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: "clamp(1.1rem,3vw,1.3rem)", fontWeight: 800 }}>📊 Model Performance</h2>
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>
              Gradient Boosting on daily differences · Train/test split 80/20 chronological
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              <KpiCard label="City Supply R²"      value={summary.Model_Accuracy?.City_Supply_R2}      color={C.supply}      sub="Gradient Boosting" />
              <KpiCard label="City Consumption R²" value={summary.Model_Accuracy?.City_Consumption_R2} color={C.consumption} />
              <KpiCard label="City Supply RMSE"    value={summary.Model_Accuracy?.City_Supply_RMSE ? `${Number(summary.Model_Accuracy.City_Supply_RMSE).toFixed(4)} MLD` : null} color={C.leakage} />
              <KpiCard label="Total Zones"         value="27 Zones"                                    color={C.warning} />
            </div>

            {/* R² bar chart */}
            <div style={{ background: C.surface, borderRadius: 10, padding: "clamp(12px,3vw,20px)", marginBottom: 20, border: "1px solid rgba(0,212,255,0.1)" }}>
              <h3 style={{ margin: "0 0 14px", fontSize: 13, color: "#ccd6f6" }}>Supply R² by Zone (27 total)</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={metrics} margin={{ bottom: 50 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="Ward_Name" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} angle={-40} textAnchor="end" interval={0} />
                  <YAxis domain={[0.95, 1]} tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} />
                  <Tooltip contentStyle={{ background: C.surface2, border: "1px solid rgba(0,212,255,0.2)", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "white" }} />
                  <Bar dataKey="Supply_R2" fill={C.supply} name="Supply R²" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Metrics table */}
            <div style={{ overflowX: "auto", background: C.surface, borderRadius: 8, border: "1px solid rgba(0,212,255,0.1)", WebkitOverflowScrolling: "touch", marginBottom: 20 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 550 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.2)" }}>
                    {["Zone", "Zone Name", "Supply R²", "Supply RMSE", "Zone Type"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: C.supply, fontFamily: "monospace", fontSize: 10, letterSpacing: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((row, i) => {
                    const zoneType  = row.Ward_No >= 21 ? (row.Ward_No === 26 ? "MIDC" : row.Ward_No === 27 ? "Village" : "CIDCO") : "PMC Ward";
                    const typeColor = row.Ward_No >= 21 ? (row.Ward_No === 26 ? C.warning : row.Ward_No === 27 ? "#a855f7" : C.consumption) : C.supply;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? C.surface2 : "transparent" }}>
                        <td style={{ padding: "9px 12px", fontFamily: "monospace", color: C.muted }}>{row.Ward_No}</td>
                        <td style={{ padding: "9px 12px", fontWeight: 600 }}>{row.Ward_Name}</td>
                        <td style={{ padding: "9px 12px", color: row.Supply_R2 >= 0.97 ? C.consumption : C.warning, fontWeight: 600, fontFamily: "monospace" }}>{row.Supply_R2?.toFixed?.(4) ?? row.Supply_R2}</td>
                        <td style={{ padding: "9px 12px", color: C.muted, fontFamily: "monospace" }}>{row.Supply_RMSE?.toFixed?.(4) ?? row.Supply_RMSE}</td>
                        <td style={{ padding: "9px 12px" }}>
                          <span style={{ background: `${typeColor}18`, color: typeColor, padding: "2px 8px", borderRadius: 3, fontSize: 10, border: `1px solid ${typeColor}44`, fontWeight: 700 }}>
                            {zoneType}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Methodology */}
            <div style={{ background: C.surface, border: "1px solid rgba(0,194,255,0.12)", borderRadius: 8, padding: "clamp(16px,3vw,24px)" }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 13, color: C.supply }}>📝 Model Methodology</h3>
              <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                <b style={{ color: "white" }}>Algorithm:</b> Gradient Boosting Regressor · 200–300 estimators · learning rate 0.05–0.08<br />
                <b style={{ color: "white" }}>Key Insight:</b> Rolling prediction uses last 14 days as lag features — enables 1 to 365-day forecasting with maintained accuracy<br />
                <b style={{ color: "white" }}>Features:</b> 18 features — lag_1 to lag_14, diff_1, diff_7, rolling_mean_7, rolling_mean_14, rolling_std_7, day_of_year, day_of_week, month<br />
                <b style={{ color: "white" }}>Validation:</b> Chronological 85/15 train/test split · TimeSeriesSplit 5-fold CV<br />
                <b style={{ color: "white" }}>Data:</b> 181 days × 27 zones = 4,887 records (Sep 2025 – Feb 2026) · 20 PMC wards + 7 CIDCO/MIDC/Village zones · ~211 MLD total
              </p>
            </div>
          </>
        )
      )}

      {/* ─────── ANALYTICS TAB ─────── */}
      {tab === "analytics" && (
        <div>
          {cityData.length === 0 && wardData.length === 0 ? (
            <div style={{ textAlign: "center", color: C.muted, padding: "60px 20px" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>📊</div>
              <h3 style={{ color: "white", marginBottom: 8, fontSize: "1.2rem" }}>Analytics Dashboard</h3>
              <p style={{ fontSize: 13, marginBottom: 28 }}>Run a City or Ward prediction first to unlock live analytics, charts, and insights.</p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={() => setTab("city")} style={{
                  background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.4)",
                  color: C.supply, padding: "11px 28px", borderRadius: 6,
                  fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: 1,
                }}>🏙 City Forecast</button>
                <button onClick={() => setTab("ward")} style={{
                  background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.3)",
                  color: C.consumption, padding: "11px 28px", borderRadius: 6,
                  fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: 1,
                }}>🏘 Ward Forecast</button>
              </div>
            </div>
          ) : (() => {
            const src        = cityData.length > 0 ? cityData : wardData;
            const isCityMode = cityData.length > 0;
            const sample     = isCityMode ? sampleCity : sampleWard;
            const totalSupply  = src.reduce((a,r) => a + r.Predicted_Supply_MLD, 0);
            const totalConsume = src.reduce((a,r) => a + r.Predicted_Consumption_MLD, 0);
            const totalLeakage = src.reduce((a,r) => a + r.Predicted_Leakage_MLD, 0);
            const avgLeakPct   = src.reduce((a,r) => a + r.Leakage_Percentage, 0) / src.length;
            const maxSupply    = Math.max(...src.map(r => r.Predicted_Supply_MLD));
            const minSupply    = Math.min(...src.map(r => r.Predicted_Supply_MLD));
            const critDays     = src.filter(r => r.Leakage_Percentage >= 20).length;
            const highDays     = src.filter(r => r.Leakage_Percentage >= 15 && r.Leakage_Percentage < 20).length;
            const modDays      = src.filter(r => r.Leakage_Percentage >= 10 && r.Leakage_Percentage < 15).length;
            const normalDays   = src.filter(r => r.Leakage_Percentage < 10).length;
            const efficiency   = ((totalConsume / totalSupply) * 100).toFixed(1);
            const r2Score      = summary.Model_Accuracy?.City_Supply_R2 || 0.98;

            const pieDist = [
              { name: "Consumed", value: parseFloat((totalConsume / totalSupply * 100).toFixed(1)), color: C.consumption },
              { name: "Leakage",  value: parseFloat((totalLeakage / totalSupply * 100).toFixed(1)), color: C.leakage },
            ];
            const pieAlerts = [
              { name: "Normal",   value: normalDays, color: C.consumption },
              { name: "Moderate", value: modDays,    color: C.warning },
              { name: "High",     value: highDays,   color: C.leakage },
              { name: "Critical", value: critDays,   color: "#ff2d55" },
            ].filter(d => d.value > 0);
            const radialData = [{ name: "R\u00b2", value: parseFloat((r2Score * 100).toFixed(1)), fill: C.supply }];
            const weeklyAvg = [];
            const chunkSize = Math.max(1, Math.floor(src.length / 7));
            for (let i = 0; i < Math.min(src.length, 7 * chunkSize); i += chunkSize) {
              const chunk = src.slice(i, i + chunkSize);
              weeklyAvg.push({
                week: `W${weeklyAvg.length + 1}`,
                Supply:      parseFloat((chunk.reduce((a,r)=>a+r.Predicted_Supply_MLD,0)/chunk.length).toFixed(2)),
                Consumption: parseFloat((chunk.reduce((a,r)=>a+r.Predicted_Consumption_MLD,0)/chunk.length).toFixed(2)),
                Leakage:     parseFloat((chunk.reduce((a,r)=>a+r.Predicted_Leakage_MLD,0)/chunk.length).toFixed(2)),
              });
            }
            const CustomPieTip = ({ active, payload }) => {
              if (!active || !payload?.length) return null;
              return (
                <div style={{ background: C.surface2, border: "1px solid rgba(0,212,255,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
                  <span style={{ color: payload[0].payload.color, fontWeight: 700 }}>{payload[0].name}: </span>
                  <span style={{ color: "white" }}>{payload[0].value}{payload[0].name === "Normal" || payload[0].name === "Critical" || payload[0].name === "Moderate" || payload[0].name === "High" ? " days" : "%"}</span>
                </div>
              );
            };

            return (
              <>
                {/* ── SECTION HEADER ── */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24, flexWrap:"wrap", gap:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:4, height:28, background:`linear-gradient(180deg,${C.supply},${C.consumption})`, borderRadius:2 }} />
                    <div>
                      <h2 style={{ margin:0, fontSize:"1.1rem", fontWeight:800, color:"white" }}>
                        {isCityMode ? `🏙 City Analytics — ${src.length}-Day Forecast` : `🏘 Zone Analytics — ${wardData[0]?.Ward_Name} · ${src.length} Days`}
                      </h2>
                      <p style={{ margin:0, color:C.muted, fontSize:12 }}>
                        {isCityMode ? `${cityData[0]?.Date} → ${cityData[cityData.length-1]?.Date}` : `Ward ${wardData[0]?.Ward_No} · ${wardData.length}-day prediction`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── ROW 1: 5 STAT CARDS ── */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:20 }}>
                  {[
                    { label:"Avg Supply",     value:avgOf(src,"Predicted_Supply_MLD"),      unit:"MLD", color:C.supply,      icon:"💧", sub:`Max ${maxSupply.toFixed(1)} MLD` },
                    { label:"Avg Consumption",value:avgOf(src,"Predicted_Consumption_MLD"), unit:"MLD", color:C.consumption, icon:"🚰", sub:`${efficiency}% efficiency` },
                    { label:"Avg Leakage",    value:avgOf(src,"Predicted_Leakage_MLD"),     unit:"MLD", color:C.leakage,     icon:"⚡", sub:`${avgLeakPct.toFixed(1)}% of supply` },
                    { label:"Model R²",       value:r2Score,                                unit:"",    color:C.supply,      icon:"🤖", sub:"Gradient Boosting" },
                    { label:"Forecast Days",  value:src.length,                             unit:"d",   color:C.warning,     icon:"📅", sub:`${critDays} critical days` },
                  ].map((s,i) => (
                    <div key={i} style={{
                      background:`linear-gradient(135deg,${C.surface} 0%,${C.surface2} 100%)`,
                      border:"1px solid rgba(0,212,255,0.12)", borderTop:`3px solid ${s.color}`,
                      borderRadius:10, padding:"16px 14px", boxShadow:"0 4px 20px rgba(0,0,0,0.3)",
                    }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div style={{ color:C.muted, fontSize:9, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8 }}>{s.label}</div>
                        <span style={{ fontSize:18, opacity:0.8 }}>{s.icon}</span>
                      </div>
                      <div style={{ color:s.color, fontSize:"1.5rem", fontWeight:700, fontFamily:"monospace", lineHeight:1 }}>
                        {s.value}<span style={{ fontSize:"0.7rem", marginLeft:3 }}>{s.unit}</span>
                      </div>
                      <div style={{ color:C.muted, fontSize:10, marginTop:6 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* ── ROW 2: Area chart + Water distribution pie ── */}
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16, marginBottom:16 }}>
                  <div style={{ background:C.surface, borderRadius:12, padding:"20px 20px 14px", border:"1px solid rgba(0,212,255,0.1)" }}>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ color:"white", fontWeight:700, fontSize:13 }}>📈 Supply vs Consumption Trend</div>
                      <div style={{ color:C.muted, fontSize:11 }}>Predicted MLD over forecast period</div>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={sample}>
                        <defs>
                          <linearGradient id="agS" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={C.supply}      stopOpacity={0.35}/>
                            <stop offset="95%" stopColor={C.supply}      stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="agC" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={C.consumption} stopOpacity={0.25}/>
                            <stop offset="95%" stopColor={C.consumption} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.04)"/>
                        <XAxis dataKey="Date" tick={{fill:C.muted,fontSize:10}} tickLine={false} interval={Math.floor(sample.length/6)}/>
                        <YAxis tick={{fill:C.muted,fontSize:10}} tickLine={false} unit=" MLD" width={58}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Legend wrapperStyle={{color:C.muted,fontSize:11}}/>
                        <Area type="monotone" dataKey="Predicted_Supply_MLD"      stroke={C.supply}      fill="url(#agS)" strokeWidth={2.5} name="Supply"      dot={false}/>
                        <Area type="monotone" dataKey="Predicted_Consumption_MLD" stroke={C.consumption} fill="url(#agC)" strokeWidth={2.5} name="Consumption" dot={false}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ background:C.surface, borderRadius:12, padding:"20px 16px 14px", border:"1px solid rgba(0,212,255,0.1)" }}>
                    <div style={{ marginBottom:10 }}>
                      <div style={{ color:"white", fontWeight:700, fontSize:13 }}>🥧 Water Distribution</div>
                      <div style={{ color:C.muted, fontSize:11 }}>% of total supply volume</div>
                    </div>
                    <ResponsiveContainer width="100%" height={155}>
                      <PieChart>
                        <Pie data={pieDist} cx="50%" cy="50%" innerRadius={42} outerRadius={68} dataKey="value" paddingAngle={4} stroke="none">
                          {pieDist.map((d,i) => <Cell key={i} fill={d.color}/>)}
                        </Pie>
                        <Tooltip content={<CustomPieTip/>}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display:"flex", flexDirection:"column", gap:7, marginTop:4 }}>
                      {pieDist.map((d,i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                            <div style={{ width:10, height:10, borderRadius:2, background:d.color }}/>
                            <span style={{ color:C.muted, fontSize:11 }}>{d.name}</span>
                          </div>
                          <span style={{ color:d.color, fontWeight:700, fontFamily:"monospace", fontSize:12 }}>{d.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── ROW 3: Grouped weekly bar + Alert days donut ── */}
                <div style={{ display:"grid", gridTemplateColumns:"3fr 2fr", gap:16, marginBottom:16 }}>
                  <div style={{ background:C.surface, borderRadius:12, padding:"20px 20px 14px", border:"1px solid rgba(0,212,255,0.1)" }}>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ color:"white", fontWeight:700, fontSize:13 }}>📊 Weekly Average Comparison</div>
                      <div style={{ color:C.muted, fontSize:11 }}>Supply · Consumption · Leakage grouped by week</div>
                    </div>
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart data={weeklyAvg} barGap={2}>
                        <CartesianGrid stroke="rgba(255,255,255,0.04)"/>
                        <XAxis dataKey="week" tick={{fill:C.muted,fontSize:11}} tickLine={false}/>
                        <YAxis tick={{fill:C.muted,fontSize:10}} tickLine={false} unit=" MLD" width={58}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Legend wrapperStyle={{color:C.muted,fontSize:11}}/>
                        <Bar dataKey="Supply"      fill={C.supply}      name="Supply"      radius={[3,3,0,0]}/>
                        <Bar dataKey="Consumption" fill={C.consumption} name="Consumption" radius={[3,3,0,0]}/>
                        <Bar dataKey="Leakage"     fill={C.leakage}     name="Leakage"     radius={[3,3,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ background:C.surface, borderRadius:12, padding:"20px 16px 14px", border:"1px solid rgba(0,212,255,0.1)" }}>
                    <div style={{ marginBottom:10 }}>
                      <div style={{ color:"white", fontWeight:700, fontSize:13 }}>🚨 Alert Days Breakdown</div>
                      <div style={{ color:C.muted, fontSize:11 }}>Days by leakage severity level</div>
                    </div>
                    <ResponsiveContainer width="100%" height={155}>
                      <PieChart>
                        <Pie data={pieAlerts} cx="50%" cy="50%" innerRadius={38} outerRadius={65} dataKey="value" paddingAngle={4} stroke="none">
                          {pieAlerts.map((d,i) => <Cell key={i} fill={d.color}/>)}
                        </Pie>
                        <Tooltip content={<CustomPieTip/>}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:"5px 12px", marginTop:6 }}>
                      {pieAlerts.map((d,i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:5 }}>
                          <div style={{ width:8, height:8, borderRadius:2, background:d.color }}/>
                          <span style={{ color:C.muted, fontSize:10 }}>{d.name}</span>
                          <span style={{ color:d.color, fontWeight:700, fontFamily:"monospace", fontSize:10 }}>{d.value}d</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── ROW 4: Severity bar + Radial gauge ── */}
                <div style={{ display:"grid", gridTemplateColumns:"3fr 1fr", gap:16, marginBottom:16 }}>
                  <div style={{ background:C.surface, borderRadius:12, padding:"20px 20px 14px", border:"1px solid rgba(0,212,255,0.1)" }}>
                    <div style={{ marginBottom:14 }}>
                      <div style={{ color:"white", fontWeight:700, fontSize:13 }}>🔴 Leakage Forecast — Severity Coloured</div>
                      <div style={{ color:C.muted, fontSize:11 }}>
                        <span style={{color:"#ff2d55"}}>■ Critical ≥20%</span>{"  "}
                        <span style={{color:C.leakage}}>■ High ≥15%</span>{"  "}
                        <span style={{color:C.warning}}>■ Moderate ≥10%</span>{"  "}
                        <span style={{color:C.consumption}}>■ Normal &lt;10%</span>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart data={sample}>
                        <CartesianGrid stroke="rgba(255,255,255,0.04)"/>
                        <XAxis dataKey="Date" tick={{fill:C.muted,fontSize:10}} tickLine={false} interval={Math.floor(sample.length/8)}/>
                        <YAxis tick={{fill:C.muted,fontSize:10}} tickLine={false} unit=" MLD" width={58}/>
                        <ReferenceLine y={parseFloat(avgOf(src,"Predicted_Leakage_MLD"))} stroke="rgba(255,184,0,0.4)" strokeDasharray="4 3" label={{value:"avg",fill:C.warning,fontSize:9}}/>
                        <Tooltip content={<CustomTooltip/>}/>
                        <Bar dataKey="Predicted_Leakage_MLD" name="Leakage" radius={[3,3,0,0]}>
                          {sample.map((r,i) => (
                            <Cell key={i} fill={r.Leakage_Percentage>=20?"#ff2d55":r.Leakage_Percentage>=15?C.leakage:r.Leakage_Percentage>=10?C.warning:C.consumption}/>
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={{ background:C.surface, borderRadius:12, padding:"20px 14px 14px", border:"1px solid rgba(0,212,255,0.1)", display:"flex", flexDirection:"column", alignItems:"center" }}>
                    <div style={{ color:"white", fontWeight:700, fontSize:13, textAlign:"center", marginBottom:2 }}>🎯 Model Accuracy</div>
                    <div style={{ color:C.muted, fontSize:11, marginBottom:6, textAlign:"center" }}>R² Score (city level)</div>
                    <div style={{ position:"relative", width:"100%" }}>
                      <ResponsiveContainer width="100%" height={150}>
                        <RadialBarChart cx="50%" cy="80%" innerRadius="55%" outerRadius="90%" startAngle={180} endAngle={0} data={radialData}>
                          <RadialBar background={{fill:"rgba(255,255,255,0.05)"}} dataKey="value" cornerRadius={6} fill={C.supply}/>
                        </RadialBarChart>
                      </ResponsiveContainer>
                      <div style={{ position:"absolute", bottom:12, left:"50%", transform:"translateX(-50%)", textAlign:"center" }}>
                        <div style={{ color:C.supply, fontSize:"1.5rem", fontWeight:800, fontFamily:"monospace", lineHeight:1 }}>
                          {(r2Score*100).toFixed(1)}%
                        </div>
                        <div style={{ color:C.muted, fontSize:10, marginTop:3 }}>accuracy</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:7, width:"100%", marginTop:8 }}>
                      {[
                        {label:"City R²", value:r2Score,  color:C.supply},
                        {label:"Zones",   value:"27",     color:C.consumption},
                        {label:"Records", value:"4,887",  color:C.warning},
                      ].map((s,i) => (
                        <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"5px 10px", background:"rgba(255,255,255,0.03)", borderRadius:5 }}>
                          <span style={{ color:C.muted, fontSize:10 }}>{s.label}</span>
                          <span style={{ color:s.color, fontWeight:700, fontFamily:"monospace", fontSize:11 }}>{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── ROW 5: Leakage % line with benchmark ── */}
                <div style={{ background:C.surface, borderRadius:12, padding:"20px 20px 14px", border:"1px solid rgba(0,212,255,0.1)", marginBottom:16 }}>
                  <div style={{ marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                    <div>
                      <div style={{ color:"white", fontWeight:700, fontSize:13 }}>📉 Leakage % Over Time</div>
                      <div style={{ color:C.muted, fontSize:11 }}>Daily leakage % vs PMC benchmark 9.52%</div>
                    </div>
                    <div style={{ display:"flex", gap:14 }}>
                      {[
                        {label:`${critDays} Critical`,  color:"#ff2d55"},
                        {label:`${highDays} High`,      color:C.leakage},
                        {label:`${modDays} Moderate`,   color:C.warning},
                        {label:`${normalDays} Normal`,  color:C.consumption},
                      ].map((b,i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:5 }}>
                          <div style={{ width:10, height:10, borderRadius:2, background:b.color }}/>
                          <span style={{ color:C.muted, fontSize:10 }}>{b.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={sample}>
                      <defs>
                        <linearGradient id="agL" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={C.leakage} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={C.leakage} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.04)"/>
                      <XAxis dataKey="Date" tick={{fill:C.muted,fontSize:10}} tickLine={false} interval={Math.floor(sample.length/8)}/>
                      <YAxis tick={{fill:C.muted,fontSize:10}} tickLine={false} unit="%" width={44}/>
                      <ReferenceLine y={9.52} stroke="rgba(255,184,0,0.5)" strokeDasharray="6 3"
                        label={{value:"9.52% PMC benchmark",fill:C.warning,fontSize:9,position:"insideTopLeft"}}/>
                      <Tooltip content={<CustomTooltip/>}/>
                      <Area type="monotone" dataKey="Leakage_Percentage" stroke={C.leakage} fill="url(#agL)" strokeWidth={2} name="Leakage %" dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* ── ROW 6: 4 summary stat cards ── */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:8 }}>
                  {[
                    { icon:"🏆", label:"Peak Supply Day",  value:src.reduce((b,r)=>r.Predicted_Supply_MLD>b.Predicted_Supply_MLD?r:b,src[0])?.Date||"—", sub:`${maxSupply.toFixed(2)} MLD`, color:C.supply },
                    { icon:"📉", label:"Lowest Supply Day", value:src.reduce((l,r)=>r.Predicted_Supply_MLD<l.Predicted_Supply_MLD?r:l,src[0])?.Date||"—", sub:`${minSupply.toFixed(2)} MLD`, color:C.warning },
                    { icon:"💦", label:"Total Supply",      value:`${totalSupply.toFixed(1)} MLD`, sub:`${src.length}-day cumulative`, color:C.supply },
                    { icon:"⚡", label:"Total Leakage",     value:`${totalLeakage.toFixed(1)} MLD`, sub:`${avgLeakPct.toFixed(2)}% avg rate`, color:C.leakage },
                  ].map((s,i) => (
                    <div key={i} style={{
                      background:C.surface, border:"1px solid rgba(0,212,255,0.1)",
                      borderBottom:`3px solid ${s.color}`, borderRadius:10, padding:"14px 16px",
                    }}>
                      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
                        <span style={{ fontSize:18 }}>{s.icon}</span>
                        <span style={{ color:C.muted, fontSize:9, letterSpacing:1, textTransform:"uppercase" }}>{s.label}</span>
                      </div>
                      <div style={{ color:s.color, fontWeight:700, fontSize:"1rem", fontFamily:"monospace" }}>{s.value}</div>
                      <div style={{ color:C.muted, fontSize:10, marginTop:4 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* ── INSIGHTS BOX ── */}
                <InsightsBox />
              </>
            );
          })()}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 60, textAlign: "center", color: C.muted, fontSize: 11, fontFamily: "monospace", letterSpacing: 1 }}>
        WATER MANAGEMENT ANALYTICS · PMC ESR 2024-25 · GRADIENT BOOSTING + FLASK + REACT
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────
function AppInnerContent() {
  const { user, ready }        = useAuth();
  const { unread }             = useNotif();
  const [authMode, setAuthMode] = useState("login");
  const [tab,      setTab]      = useState("city");

  // Lifted prediction state — survives tab switches
  const [cityData,     setCityData]     = useState([]);
  const [wardData,     setWardData]     = useState([]);
  const [days,         setDays]         = useState(7);
  const [selectedWard, setSelectedWard] = useState(1);

  if (!ready) return null;

  if (!user) {
    return authMode === "login"
      ? <LoginPage  onSwitchToSignup={() => setAuthMode("signup")} />
      : <SignupPage onSwitchToLogin={() => setAuthMode("login")} />;
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: "white", fontFamily: "'Syne', sans-serif" }}>
      <style>{GLOBAL_CSS}</style>
      <Navbar tab={tab} setTab={setTab} unread={unread} />
      <Dashboard
        tab={tab}           setTab={setTab}
        cityData={cityData} setCityData={setCityData}
        wardData={wardData} setWardData={setWardData}
        days={days}         setDays={setDays}
        selectedWard={selectedWard} setSelectedWard={setSelectedWard}
      />
      <ToastContainer />
    </div>
  );
}

function AppInner() {
  return (
    <NotifProvider>
      <AppInnerContent />
    </NotifProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
