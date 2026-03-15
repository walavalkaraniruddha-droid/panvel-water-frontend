import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import axios from "axios";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";

// ─────────────────────────────────────────────────────────
// CONFIG & THEME
// ─────────────────────────────────────────────────────────
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
  admin:       "#a855f7",
  adminDim:    "rgba(168,85,247,0.15)",
  student:     "#00c2ff",
  studentDim:  "rgba(0,194,255,0.12)",
};

// ─────────────────────────────────────────────────────────
// AUTH CONTEXT
// ─────────────────────────────────────────────────────────
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);   // { name, email, role, token }
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("wma_user");
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch (_) {}
    }
    setReady(true);
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("wma_user", JSON.stringify(userData));
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem("wma_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() { return useContext(AuthContext); }

// ─────────────────────────────────────────────────────────
// AXIOS HELPER — auto-attach JWT
// ─────────────────────────────────────────────────────────
function useApi() {
  const { user } = useAuth();
  return useCallback(async (method, url, data, opts) => {
    const headers = user?.token ? { Authorization: `Bearer ${user.token}` } : {};
    const config  = { method, url: `${API}${url}`, headers, ...opts };
    if (data) config.data = data;
    const res = await axios(config);
    return res.data;
  }, [user]);
}

// ─────────────────────────────────────────────────────────
// SMALL SHARED COMPONENTS
// ─────────────────────────────────────────────────────────
function KpiCard({ label, value, unit, color, sub }) {
  return (
    <div style={{
      background: C.surface, borderTop: `2px solid ${color}`,
      border: `1px solid rgba(0,212,255,0.12)`,
      borderRadius: 8, padding: "16px 18px", flex: 1, minWidth: 140,
    }}>
      <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
      <div style={{ color, fontSize: "1.65rem", fontWeight: 700, fontFamily: "monospace" }}>
        {value ?? "—"}{unit && <span style={{ fontSize: "0.85rem", marginLeft: 3 }}>{unit}</span>}
      </div>
      {sub && <div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ textAlign: "center", padding: 50, color: C.muted }}>
      <div style={{
        display: "inline-block", width: 30, height: 30,
        border: `3px solid ${C.surface2}`, borderTop: `3px solid ${C.supply}`,
        borderRadius: "50%", animation: "spin 0.8s linear infinite",
      }} />
      <div style={{ marginTop: 10, fontSize: 13 }}>Loading...</div>
    </div>
  );
}

function ErrBanner({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.35)",
      color: "#ff4d6d", padding: "10px 16px", borderRadius: 7, marginBottom: 16, fontSize: 13,
    }}>⚠ {msg}</div>
  );
}

function OkBanner({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.3)",
      color: "#00ff88", padding: "10px 16px", borderRadius: 7, marginBottom: 16, fontSize: 13,
    }}>✓ {msg}</div>
  );
}

function Tooltip2({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.surface2, border: "1px solid rgba(0,212,255,0.2)", borderRadius: 7, padding: "10px 14px", fontSize: 12 }}>
      <div style={{ color: "white", fontWeight: 700, marginBottom: 5 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <b>{typeof p.value === "number" ? p.value.toFixed(3) : p.value}</b> MLD
        </div>
      ))}
    </div>
  );
}

function RoleBadge({ role }) {
  const isAdmin = role === "admin";
  return (
    <span style={{
      background: isAdmin ? C.adminDim : C.studentDim,
      color: isAdmin ? C.admin : C.student,
      border: `1px solid ${isAdmin ? "rgba(168,85,247,0.4)" : "rgba(0,194,255,0.3)"}`,
      padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 1,
      textTransform: "uppercase",
    }}>
      {isAdmin ? "⚙ Admin" : "🎓 Student"}
    </span>
  );
}

function Btn({ children, onClick, color, disabled, size, outline }) {
  const bg     = outline ? "transparent" : (color || C.supply);
  const border = color || C.supply;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: outline ? "transparent" : `${bg}22`,
      border: `1px solid ${border}`,
      color: outline ? border : border,
      padding: size === "sm" ? "6px 14px" : "10px 22px",
      borderRadius: 6, fontWeight: 700,
      fontSize: size === "sm" ? 12 : 13,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "all 0.18s",
      letterSpacing: 0.5,
    }}>{children}</button>
  );
}

// ─────────────────────────────────────────────────────────
// NAVBAR
// ─────────────────────────────────────────────────────────
function Navbar({ page, setPage }) {
  const { user, logout } = useAuth();
  const [open, setOpen]  = useState(false);
  const isAdmin = user?.role === "admin";

  const basePages = [
    { id: "city",       label: "🏙 City Forecast" },
    { id: "ward",       label: "🏘 Zone Forecast" },
    { id: "alerts",     label: "🔔 Alerts" },
    { id: "historical", label: "📅 Historical" },
    { id: "metrics",    label: "📊 Metrics" },
    { id: "datafiles",  label: "📁 Data Files" },
  ];
  const adminPages = [
    { id: "upload",  label: "⬆ Upload Data" },
    { id: "users",   label: "👥 Users" },
  ];
  const navItems = isAdmin ? [...basePages, ...adminPages] : basePages;

  return (
    <nav style={{
      background: C.surface, borderBottom: "1px solid rgba(0,212,255,0.12)",
      padding: "0 20px", display: "flex", alignItems: "center",
      justifyContent: "space-between", height: 52, position: "sticky", top: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div
        onClick={() => setPage("city")}
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
      >
        <span style={{ fontSize: 20 }}>💧</span>
        <span style={{ fontWeight: 800, fontSize: 14, color: "white", letterSpacing: 0.5 }}>
          Water Management Analytics
        </span>
      </div>

      {/* Desktop links */}
      <div style={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "nowrap", overflow: "auto" }}>
        {navItems.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)} style={{
            background: page === n.id ? "rgba(0,212,255,0.1)" : "transparent",
            border: page === n.id ? "1px solid rgba(0,212,255,0.3)" : "1px solid transparent",
            color: page === n.id ? C.supply : C.muted,
            padding: "5px 10px", borderRadius: 5,
            fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
          }}>{n.label}</button>
        ))}
      </div>

      {/* User + logout */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <RoleBadge role={user?.role} />
        <span style={{ color: C.muted, fontSize: 12 }}>{user?.name}</span>
        <Btn size="sm" outline color="#ff4d6d" onClick={logout}>Logout</Btn>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────
// LOGIN PAGE
// ─────────────────────────────────────────────────────────
function LoginPage({ onSwitchToSignup }) {
  const { login }        = useAuth();
  const [email, setEmail]  = useState("");
  const [pwd,   setPwd]    = useState("");
  const [err,   setErr]    = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const data = await axios.post(`${API}/auth/login`, { email, password: pwd });
      login(data.data);
    } catch (ex) {
      setErr(ex.response?.data?.error || "Login failed. Check your credentials.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Syne', sans-serif",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap'); *{box-sizing:border-box} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{
        background: C.surface, border: "1px solid rgba(0,212,255,0.15)",
        borderRadius: 16, padding: "44px 40px", width: "100%", maxWidth: 420,
      }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 42, marginBottom: 10 }}>💧</div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "white", margin: 0, marginBottom: 6 }}>
            Water Management Analytics
          </h1>
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
            Panvel Municipal Corporation · PMC ESR 2024-25
          </p>
        </div>

        <ErrBanner msg={err} />

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: C.muted, fontSize: 11, letterSpacing: 1.5, display: "block", marginBottom: 6 }}>EMAIL ADDRESS</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="your@email.com"
              style={{ width: "100%", background: C.surface2, border: "1px solid rgba(0,212,255,0.2)", borderRadius: 7, padding: "10px 14px", color: "white", fontSize: 14, outline: "none" }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ color: C.muted, fontSize: 11, letterSpacing: 1.5, display: "block", marginBottom: 6 }}>PASSWORD</label>
            <input
              type="password" value={pwd} onChange={e => setPwd(e.target.value)}
              required placeholder="••••••••"
              style={{ width: "100%", background: C.surface2, border: "1px solid rgba(0,212,255,0.2)", borderRadius: 7, padding: "10px 14px", color: "white", fontSize: 14, outline: "none" }}
            />
          </div>

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "12px", background: "rgba(0,194,255,0.15)",
            border: "1px solid rgba(0,194,255,0.5)", borderRadius: 8,
            color: C.supply, fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: 1, opacity: loading ? 0.6 : 1,
          }}>
            {loading ? "Signing in..." : "SIGN IN →"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 22, color: C.muted, fontSize: 13 }}>
          Don't have an account?{" "}
          <span onClick={onSwitchToSignup} style={{ color: C.supply, cursor: "pointer", fontWeight: 700 }}>
            Create Account
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SIGNUP PAGE
// ─────────────────────────────────────────────────────────
function SignupPage({ onSwitchToLogin }) {
  const { login }          = useAuth();
  const [name,   setName]  = useState("");
  const [email,  setEmail] = useState("");
  const [pwd,    setPwd]   = useState("");
  const [role,   setRole]  = useState("student");
  const [err,    setErr]   = useState("");
  const [ok,     setOk]    = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setErr(""); setOk(""); setLoading(true);
    try {
      const data = await axios.post(`${API}/auth/register`, { name, email, password: pwd, role });
      setOk(`Account created! Welcome, ${data.data.name}.`);
      setTimeout(() => login(data.data), 800);
    } catch (ex) {
      setErr(ex.response?.data?.error || "Registration failed.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Syne', sans-serif",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap'); *{box-sizing:border-box} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{
        background: C.surface, border: "1px solid rgba(0,212,255,0.15)",
        borderRadius: 16, padding: "44px 40px", width: "100%", maxWidth: 440,
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 38, marginBottom: 8 }}>💧</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "white", margin: 0, marginBottom: 5 }}>Create Account</h1>
          <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Water Management Analytics</p>
        </div>

        <ErrBanner msg={err} />
        <OkBanner  msg={ok}  />

        <form onSubmit={handleSignup}>
          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: C.muted, fontSize: 11, letterSpacing: 1.5, display: "block", marginBottom: 5 }}>FULL NAME</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Aniruddha Walavalkar"
              style={{ width: "100%", background: C.surface2, border: "1px solid rgba(0,212,255,0.2)", borderRadius: 7, padding: "10px 14px", color: "white", fontSize: 14, outline: "none" }} />
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: C.muted, fontSize: 11, letterSpacing: 1.5, display: "block", marginBottom: 5 }}>EMAIL ADDRESS</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com"
              style={{ width: "100%", background: C.surface2, border: "1px solid rgba(0,212,255,0.2)", borderRadius: 7, padding: "10px 14px", color: "white", fontSize: 14, outline: "none" }} />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: C.muted, fontSize: 11, letterSpacing: 1.5, display: "block", marginBottom: 5 }}>PASSWORD</label>
            <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} required placeholder="Min 6 characters"
              style={{ width: "100%", background: C.surface2, border: "1px solid rgba(0,212,255,0.2)", borderRadius: 7, padding: "10px 14px", color: "white", fontSize: 14, outline: "none" }} />
          </div>

          {/* Role selector */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ color: C.muted, fontSize: 11, letterSpacing: 1.5, display: "block", marginBottom: 10 }}>SELECT YOUR ROLE</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { id: "student", icon: "🎓", title: "Student", desc: "View analytics, download Excel data" },
                { id: "admin",   icon: "⚙",  title: "Admin",   desc: "Upload Excel files, manage water data, track users" },
              ].map(r => (
                <div
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  style={{
                    border: role === r.id
                      ? `2px solid ${r.id === "admin" ? C.admin : C.supply}`
                      : "2px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    padding: "14px 12px",
                    cursor: "pointer",
                    background: role === r.id
                      ? (r.id === "admin" ? C.adminDim : C.studentDim)
                      : "rgba(255,255,255,0.02)",
                    transition: "all 0.18s",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{r.icon}</div>
                  <div style={{
                    fontWeight: 800, fontSize: 14,
                    color: role === r.id ? (r.id === "admin" ? C.admin : C.supply) : "white",
                  }}>{r.title}</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 3, lineHeight: 1.4 }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "12px",
            background: role === "admin" ? "rgba(168,85,247,0.15)" : "rgba(0,194,255,0.15)",
            border: `1px solid ${role === "admin" ? "rgba(168,85,247,0.5)" : "rgba(0,194,255,0.5)"}`,
            borderRadius: 8,
            color: role === "admin" ? C.admin : C.supply,
            fontWeight: 800, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: 1, opacity: loading ? 0.6 : 1,
          }}>
            {loading ? "Creating..." : `CREATE ${role.toUpperCase()} ACCOUNT →`}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, color: C.muted, fontSize: 13 }}>
          Already have an account?{" "}
          <span onClick={onSwitchToLogin} style={{ color: C.supply, cursor: "pointer", fontWeight: 700 }}>Sign In</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CITY FORECAST PAGE
// ─────────────────────────────────────────────────────────
function CityPage() {
  const api = useApi();
  const [days, setDays] = useState(7);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const predict = async () => {
    setErr(""); setLoading(true);
    try { setData(await api("get", `/predict/city/${days}`)); }
    catch (e) { setErr(e.response?.data?.error || e.message); }
    finally   { setLoading(false); }
  };

  return (
    <div>
      <h2 style={{ color: "white", marginBottom: 6 }}>🏙 City Forecast</h2>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 13 }}>Predict total daily water supply and consumption for the entire Panvel city.</p>
      <ErrBanner msg={err} />

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <label style={{ color: C.muted, fontSize: 11, letterSpacing: 1.5, display: "block", marginBottom: 5 }}>FORECAST DAYS</label>
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            style={{ background: C.surface2, color: "white", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 6, padding: "9px 12px", fontSize: 13 }}>
            {[1,7,14,30,60,90,180,365].map(d => <option key={d} value={d}>Next {d} day{d>1?"s":""}</option>)}
          </select>
        </div>
        <Btn onClick={predict} disabled={loading}>{loading ? "⏳ Loading..." : "▶ PREDICT"}</Btn>
      </div>

      {loading ? <Spinner /> : data.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <KpiCard label="Avg Supply"      value={(data.reduce((a,r)=>a+r.Predicted_Supply_MLD,0)/data.length).toFixed(2)} unit="MLD" color={C.supply} />
            <KpiCard label="Avg Consumption" value={(data.reduce((a,r)=>a+r.Predicted_Consumption_MLD,0)/data.length).toFixed(2)} unit="MLD" color={C.consumption} />
            <KpiCard label="Avg Leakage"     value={(data.reduce((a,r)=>a+r.Predicted_Leakage_MLD,0)/data.length).toFixed(2)} unit="MLD" color={C.leakage} />
            <KpiCard label="Avg Leakage %"   value={(data.reduce((a,r)=>a+r.Leakage_Percentage,0)/data.length).toFixed(1)} unit="%" color={C.warning} />
          </div>
          <div style={{ background: C.surface, borderRadius: 10, padding: 18, marginBottom: 20, border: "1px solid rgba(0,212,255,0.08)" }}>
            <h4 style={{ color: "#ccd6f6", marginBottom: 12, marginTop: 0 }}>Supply & Consumption</h4>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.supply} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.supply} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="Date" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} unit=" MLD" />
                <Tooltip content={<Tooltip2 />} />
                <Legend wrapperStyle={{ color: C.muted, fontSize: 12 }} />
                <Area type="monotone" dataKey="Predicted_Supply_MLD"      stroke={C.supply}      fill="url(#gS)" strokeWidth={2} name="Supply" dot={false} />
                <Area type="monotone" dataKey="Predicted_Consumption_MLD" stroke={C.consumption} fill="none"     strokeWidth={2} name="Consumption" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ overflowX: "auto", background: C.surface, borderRadius: 8, border: "1px solid rgba(0,212,255,0.08)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ borderBottom: "1px solid rgba(0,212,255,0.15)" }}>
                {["Date","Supply MLD","Consumption MLD","Leakage MLD","Leakage %"].map(h =>
                  <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: C.supply, fontSize: 10, letterSpacing: 1 }}>{h}</th>
                )}
              </tr></thead>
              <tbody>
                {data.map((r,i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: i%2?C.surface2:"transparent" }}>
                    <td style={{ padding:"9px 12px", color:C.muted, fontFamily:"monospace" }}>{r.Date}</td>
                    <td style={{ padding:"9px 12px", color:C.supply,      fontWeight:600 }}>{r.Predicted_Supply_MLD}</td>
                    <td style={{ padding:"9px 12px", color:C.consumption, fontWeight:600 }}>{r.Predicted_Consumption_MLD}</td>
                    <td style={{ padding:"9px 12px", color:C.leakage,     fontWeight:600 }}>{r.Predicted_Leakage_MLD}</td>
                    <td style={{ padding:"9px 12px" }}>
                      <span style={{ background: r.Leakage_Percentage>=15?"rgba(255,77,109,0.15)":"rgba(0,255,136,0.1)", color:r.Leakage_Percentage>=15?C.leakage:C.consumption, padding:"1px 7px", borderRadius:3, fontFamily:"monospace" }}>
                        {r.Leakage_Percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ZONE FORECAST PAGE
// ─────────────────────────────────────────────────────────
function WardPage() {
  const api = useApi();
  const [days, setDays]     = useState(7);
  const [wardList, setWardList] = useState([]);
  const [selected, setSelected] = useState(1);
  const [data, setData]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState("");

  useEffect(() => {
    api("get", "/wards").then(setWardList).catch(() => {});
  }, [api]);

  const predict = async () => {
    setErr(""); setLoading(true);
    try { setData(await api("get", `/predict/ward/${selected}/${days}`)); }
    catch (e) { setErr(e.response?.data?.error || e.message); }
    finally   { setLoading(false); }
  };

  const leakLevel = data[0]?.Leakage_Percentage;
  const levelColor = leakLevel >= 20 ? "#ff4d6d" : leakLevel >= 15 ? "#ffb800" : leakLevel >= 10 ? "#ffd700" : "#00ff88";
  const levelLabel = leakLevel >= 20 ? "CRITICAL" : leakLevel >= 15 ? "HIGH" : leakLevel >= 10 ? "MODERATE" : "NORMAL";

  return (
    <div>
      <h2 style={{ color: "white", marginBottom: 6 }}>🏘 Zone Forecast</h2>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 13 }}>Predict water supply for any individual zone.</p>
      <ErrBanner msg={err} />

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <label style={{ color: C.muted, fontSize: 11, letterSpacing: 1.5, display: "block", marginBottom: 5 }}>SELECT ZONE</label>
          <select value={selected} onChange={e => setSelected(Number(e.target.value))}
            style={{ background: C.surface2, color: "white", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 6, padding: "9px 12px", fontSize: 13, minWidth: 220 }}>
            {wardList.map(w => <option key={w.Ward_No} value={w.Ward_No}>Zone {w.Ward_No} — {w.Ward_Name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ color: C.muted, fontSize: 11, letterSpacing: 1.5, display: "block", marginBottom: 5 }}>FORECAST DAYS</label>
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            style={{ background: C.surface2, color: "white", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 6, padding: "9px 12px", fontSize: 13 }}>
            {[1,7,14,30,60,90].map(d => <option key={d} value={d}>Next {d} day{d>1?"s":""}</option>)}
          </select>
        </div>
        <Btn onClick={predict} disabled={loading}>{loading ? "⏳ Loading..." : "▶ PREDICT"}</Btn>
      </div>

      {loading ? <Spinner /> : data.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24, alignItems: "center" }}>
            <KpiCard label="Avg Supply"   value={(data.reduce((a,r)=>a+r.Predicted_Supply_MLD,0)/data.length).toFixed(4)} unit="MLD" color={C.supply} />
            <KpiCard label="Avg Leakage"  value={(data.reduce((a,r)=>a+r.Predicted_Leakage_MLD,0)/data.length).toFixed(4)} unit="MLD" color={C.leakage} />
            <div style={{ background: C.surface, border: `2px solid ${levelColor}`, borderRadius: 8, padding: "14px 20px", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 130 }}>
              <span style={{ color: C.muted, fontSize: 10, letterSpacing: 2 }}>ALERT LEVEL</span>
              <span style={{ color: levelColor, fontWeight: 800, fontSize: "1.4rem", marginTop: 4 }}>{levelLabel}</span>
            </div>
          </div>
          <div style={{ background: C.surface, borderRadius: 10, padding: 18, marginBottom: 20, border: "1px solid rgba(0,212,255,0.08)" }}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="wG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.supply} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={C.supply} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="Date" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} unit=" MLD" />
                <Tooltip content={<Tooltip2 />} />
                <Legend wrapperStyle={{ color: C.muted, fontSize: 12 }} />
                <Area type="monotone" dataKey="Predicted_Supply_MLD"      stroke={C.supply}      fill="url(#wG)" strokeWidth={2} name="Supply" dot={false} />
                <Area type="monotone" dataKey="Predicted_Consumption_MLD" stroke={C.consumption} fill="none"     strokeWidth={2} name="Consumption" dot={false} />
                <Area type="monotone" dataKey="Predicted_Leakage_MLD"     stroke={C.leakage}     fill="none"     strokeWidth={1.5} name="Leakage" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ALERTS PAGE
// ─────────────────────────────────────────────────────────
function AlertsPage() {
  const api = useApi();
  const [data, setData]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]     = useState("");
  const [days, setDays]   = useState(30);

  const scan = async () => {
    setErr(""); setLoading(true);
    try { setData(await api("get", `/alerts/scan?days=${days}`)); }
    catch (e) { setErr(e.response?.data?.error || e.message); }
    finally   { setLoading(false); }
  };

  const levelStyle = (lvl) => {
    const m = { CRITICAL: ["#ff4d6d","rgba(255,77,109,0.12)"], HIGH: ["#ffb800","rgba(255,184,0,0.1)"], MODERATE: ["#ffd700","rgba(255,215,0,0.08)"], NORMAL: ["#00ff88","rgba(0,255,136,0.08)"] };
    return m[lvl] || ["white","transparent"];
  };

  return (
    <div>
      <h2 style={{ color: "white", marginBottom: 6 }}>🔔 Leakage Alert Scan</h2>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 13 }}>Scan all 27 zones and classify leakage levels.</p>
      <ErrBanner msg={err} />
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <label style={{ color: C.muted, fontSize: 11, letterSpacing: 1.5, display: "block", marginBottom: 5 }}>SCAN HORIZON</label>
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            style={{ background: C.surface2, color: "white", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 6, padding: "9px 12px", fontSize: 13 }}>
            {[7,14,30,60,90].map(d => <option key={d} value={d}>{d} days</option>)}
          </select>
        </div>
        <Btn onClick={scan} disabled={loading} color={C.warning}>{loading ? "⏳ Scanning..." : "🔍 SCAN ALL ZONES"}</Btn>
      </div>
      {loading ? <Spinner /> : data.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.map((r, i) => {
            const [col, bg] = levelStyle(r.Level);
            return (
              <div key={i} style={{ background: bg, border: `1px solid ${col}44`, borderLeft: `4px solid ${col}`, borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <span style={{ color: col, fontWeight: 700, fontSize: 13 }}>[{r.Level}]</span>
                  <span style={{ color: "white", marginLeft: 10, fontWeight: 600 }}>Zone {r.Ward_No} — {r.Ward_Name}</span>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: C.muted }}>
                  <span>Avg: <b style={{ color: col }}>{r.Avg_Leakage_Pct}%</b></span>
                  <span>Max: <b style={{ color: col }}>{r.Max_Leakage_Pct}%</b></span>
                  <span>Days exc: <b style={{ color: "white" }}>{r.Days_Exceeding}</b></span>
                  <span>Peak: <b style={{ color: "white" }}>{r.Peak_Date}</b></span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// HISTORICAL PAGE
// ─────────────────────────────────────────────────────────
function HistoricalPage() {
  const api = useApi();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]   = useState("");

  useEffect(() => {
    api("get", "/historical/city")
      .then(setData)
      .catch(e => setErr(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <div>
      <h2 style={{ color: "white", marginBottom: 6 }}>📅 Historical Data</h2>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 13 }}>181 days of city-level water supply data — September 2025 to February 2026.</p>
      <ErrBanner msg={err} />
      {loading ? <Spinner /> : (
        <div style={{ background: C.surface, borderRadius: 10, padding: 18, border: "1px solid rgba(0,212,255,0.08)" }}>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="hG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.supply} stopOpacity={0.28}/>
                  <stop offset="95%" stopColor={C.supply} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="Date" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} interval={14} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} unit=" MLD" />
              <Tooltip content={<Tooltip2 />} />
              <Legend wrapperStyle={{ color: C.muted, fontSize: 12 }} />
              <Area type="monotone" dataKey="Water_Supplied_MLD"  stroke={C.supply}      fill="url(#hG)" strokeWidth={2} name="Supply" dot={false} />
              <Area type="monotone" dataKey="Water_Consumed_MLD"  stroke={C.consumption} fill="none"     strokeWidth={2} name="Consumption" dot={false} />
              <Area type="monotone" dataKey="Leakage_MLD"         stroke={C.leakage}     fill="none"     strokeWidth={1.5} name="Leakage" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// METRICS PAGE
// ─────────────────────────────────────────────────────────
function MetricsPage() {
  const api = useApi();
  const [metrics, setMetrics] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api("get", "/metrics"), api("get", "/summary")])
      .then(([m, s]) => { setMetrics(m); setSummary(s); })
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <div>
      <h2 style={{ color: "white", marginBottom: 6 }}>📊 Model Metrics</h2>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 13 }}>R² accuracy scores for all 29 Gradient Boosting models.</p>
      {loading ? <Spinner /> : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
            <KpiCard label="City Supply R²"   value={summary.Model_Accuracy?.City_Supply_R2}      color={C.supply}      sub="Gradient Boosting" />
            <KpiCard label="City Consump R²"  value={summary.Model_Accuracy?.City_Consumption_R2} color={C.consumption} />
            <KpiCard label="City RMSE"        value={summary.Model_Accuracy?.City_Supply_RMSE}     unit=" MLD" color={C.warning} />
          </div>
          <div style={{ background: C.surface, borderRadius: 10, padding: 18, border: "1px solid rgba(0,212,255,0.08)", marginBottom: 20 }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={metrics}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="Ward_No" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} label={{ value: "Zone", position: "insideBottom", fill: C.muted, fontSize: 11 }} />
                <YAxis domain={[0.9, 1]} tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} />
                <Tooltip content={({ active, payload }) => active && payload?.length ? (
                  <div style={{ background: C.surface2, border: "1px solid rgba(0,212,255,0.2)", borderRadius: 7, padding: "8px 12px", fontSize: 12 }}>
                    <div style={{ color: "white" }}>{payload[0]?.payload?.Ward_Name}</div>
                    <div style={{ color: C.supply }}>R² = {payload[0]?.value}</div>
                  </div>
                ) : null} />
                <Bar dataKey="Supply_R2" fill={C.supply} radius={[3,3,0,0]} name="R²" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ overflowX: "auto", background: C.surface, borderRadius: 8, border: "1px solid rgba(0,212,255,0.08)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ borderBottom: "1px solid rgba(0,212,255,0.15)" }}>
                {["Zone","Name","Supply R²","RMSE (MLD)"].map(h => <th key={h} style={{ padding:"10px 12px", textAlign:"left", color:C.supply, fontSize:10, letterSpacing:1 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {metrics.map((r,i) => (
                  <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)", background:i%2?C.surface2:"transparent" }}>
                    <td style={{ padding:"9px 12px", color:C.muted, fontFamily:"monospace" }}>{r.Ward_No}</td>
                    <td style={{ padding:"9px 12px", color:"white" }}>{r.Ward_Name}</td>
                    <td style={{ padding:"9px 12px", color:r.Supply_R2>=0.97?C.consumption:C.warning, fontWeight:600 }}>{r.Supply_R2}</td>
                    <td style={{ padding:"9px 12px", color:C.muted }}>{r.Supply_RMSE}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// DATA FILES PAGE  (both roles — students can download)
// ─────────────────────────────────────────────────────────
function DataFilesPage() {
  const api = useApi();
  const { user } = useAuth();
  const isAdmin  = user?.role === "admin";
  const [files, setFiles]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]       = useState("");
  const [ok, setOk]         = useState("");
  const [preview, setPreview] = useState(null);   // { id, data }
  const [previewLoading, setPreviewLoading] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    api("get", "/admin/files")
      .then(setFiles)
      .catch(e => setErr(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await api("delete", `/admin/files/${id}`);
      setOk("File deleted."); reload();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
  };

  const handleDownload = (id) => {
    const token = user?.token;
    const url   = `${API}/admin/files/${id}/download`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement("a");
        a.href  = URL.createObjectURL(blob);
        a.download = "download";
        a.click();
      });
  };

  const handlePreview = async (id) => {
    if (preview?.id === id) { setPreview(null); return; }
    setPreviewLoading(true);
    try {
      const data = await api("get", `/admin/files/${id}/preview`);
      setPreview({ id, data });
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    finally { setPreviewLoading(false); }
  };

  return (
    <div>
      <h2 style={{ color: "white", marginBottom: 6 }}>📁 Water Data Files</h2>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 13 }}>
        {isAdmin ? "Manage uploaded Excel/CSV files. You can preview, download, or delete." : "Browse and download water data Excel files uploaded by administrators."}
      </p>
      <ErrBanner msg={err} />
      <OkBanner  msg={ok}  />

      {/* Built-in download buttons for both roles */}
      <div style={{ background: C.surface, border: "1px solid rgba(0,212,255,0.12)", borderRadius: 10, padding: "16px 20px", marginBottom: 24 }}>
        <h4 style={{ color: C.supply, margin: "0 0 12px 0", fontSize: 13, letterSpacing: 1 }}>⬇ BUILT-IN DATASET DOWNLOADS</h4>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a href={`${API}/download/historical_excel`}
            onClick={e => { e.preventDefault(); fetch(`${API}/download/historical_excel`, { headers:{ Authorization:`Bearer ${user?.token}` } }).then(r=>r.blob()).then(blob=>{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="WMA_Historical_City_Data.xlsx";a.click();}); }}
            style={{ background:"rgba(0,194,255,0.1)", border:"1px solid rgba(0,194,255,0.35)", color:C.supply, padding:"9px 16px", borderRadius:7, fontSize:12, fontWeight:700, cursor:"pointer", textDecoration:"none" }}>
            📊 City Historical Data (.xlsx)
          </a>
          {[1,2,3,4,5].map(z => (
            <button key={z} onClick={() => {
              fetch(`${API}/download/ward_excel/${z}`, { headers:{ Authorization:`Bearer ${user?.token}` } })
                .then(r=>r.blob()).then(blob=>{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`WMA_Zone${z}.xlsx`;a.click();});
            }} style={{ background:"rgba(0,255,136,0.08)", border:"1px solid rgba(0,255,136,0.25)", color:C.consumption, padding:"9px 14px", borderRadius:7, fontSize:12, fontWeight:600, cursor:"pointer" }}>
              Zone {z} Data
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : files.length === 0 ? (
        <div style={{ textAlign: "center", padding: 50, color: C.muted, fontSize: 14 }}>
          {isAdmin ? "No files uploaded yet. Use the Upload page to add Excel files." : "No data files have been uploaded by admins yet."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {files.map(f => (
            <div key={f.id} style={{ background: C.surface, border: "1px solid rgba(0,212,255,0.1)", borderRadius: 10, padding: "14px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <span style={{ color: "white", fontWeight: 700, fontSize: 14 }}>📄 {f.original_name}</span>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>
                    {f.rows.toLocaleString()} rows · {(f.file_size/1024).toFixed(1)} KB · Uploaded {f.uploaded_at?.slice(0,10)} by {f.uploaded_by}
                    {f.description && <span> · {f.description}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn size="sm" onClick={() => handlePreview(f.id)} outline color={C.supply}>
                    {preview?.id === f.id ? "Hide Preview" : "👁 Preview"}
                  </Btn>
                  <Btn size="sm" onClick={() => handleDownload(f.id)} color={C.consumption}>
                    ⬇ Download
                  </Btn>
                  {isAdmin && (
                    <Btn size="sm" onClick={() => handleDelete(f.id, f.original_name)} outline color={C.leakage}>
                      🗑 Delete
                    </Btn>
                  )}
                </div>
              </div>

              {/* Inline Preview */}
              {preview?.id === f.id && (
                previewLoading ? <Spinner /> : (
                  <div style={{ marginTop: 14, overflowX: "auto" }}>
                    <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>
                      Showing first {preview.data.rows.length} of {preview.data.total_rows} rows
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead><tr style={{ borderBottom: "1px solid rgba(0,212,255,0.15)" }}>
                        {preview.data.columns.map(col => (
                          <th key={col} style={{ padding: "7px 10px", textAlign: "left", color: C.supply, fontSize: 10, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{col}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {preview.data.rows.map((row, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", background: i%2?C.surface2:"transparent" }}>
                            {preview.data.columns.map(col => (
                              <td key={col} style={{ padding: "6px 10px", color: C.muted, whiteSpace: "nowrap" }}>{String(row[col] ?? "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// UPLOAD PAGE  (Admin only)
// ─────────────────────────────────────────────────────────
function UploadPage() {
  const api = useApi();
  const { user } = useAuth();
  const [file, setFile]   = useState(null);
  const [desc, setDesc]   = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr]     = useState("");
  const [ok, setOk]       = useState("");
  const [result, setResult] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) { setErr("Please select a file first."); return; }
    setErr(""); setOk(""); setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("description", desc);
      const res = await axios.post(`${API}/admin/upload_excel`, form, {
        headers: { Authorization: `Bearer ${user?.token}`, "Content-Type": "multipart/form-data" }
      });
      setOk(`File "${file.name}" uploaded successfully! ${res.data.rows} rows loaded.`);
      setResult(res.data);
      setFile(null); setDesc("");
    } catch (ex) {
      setErr(ex.response?.data?.error || "Upload failed.");
    } finally { setLoading(false); }
  };

  return (
    <div>
      <h2 style={{ color: "white", marginBottom: 6 }}>⬆ Upload Water Data</h2>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 13 }}>Upload new Excel or CSV files containing ward-wise water analytics data.</p>
      <ErrBanner msg={err} />
      <OkBanner  msg={ok}  />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 900 }}>
        {/* Upload Form */}
        <div style={{ background: C.surface, border: "1px solid rgba(168,85,247,0.2)", borderRadius: 12, padding: "24px" }}>
          <h4 style={{ color: C.admin, margin: "0 0 20px 0", fontSize: 14, letterSpacing: 1 }}>⚙ UPLOAD NEW FILE</h4>
          <form onSubmit={handleUpload}>
            {/* Drop zone */}
            <div
              onClick={() => document.getElementById("fileInput").click()}
              style={{
                border: `2px dashed ${file ? "rgba(168,85,247,0.6)" : "rgba(168,85,247,0.25)"}`,
                borderRadius: 10, padding: "28px 20px", textAlign: "center",
                cursor: "pointer", marginBottom: 16, background: file ? C.adminDim : "transparent",
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>{file ? "📄" : "📂"}</div>
              <div style={{ color: file ? C.admin : C.muted, fontWeight: 600, fontSize: 13 }}>
                {file ? file.name : "Click to select Excel / CSV file"}
              </div>
              {file && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{(file.size/1024).toFixed(1)} KB</div>}
              {!file && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>Supports .xlsx, .xls, .csv</div>}
            </div>
            <input id="fileInput" type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }}
              onChange={e => setFile(e.target.files[0] || null)} />

            <div style={{ marginBottom: 16 }}>
              <label style={{ color: C.muted, fontSize: 11, letterSpacing: 1.5, display: "block", marginBottom: 5 }}>DESCRIPTION (optional)</label>
              <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="e.g. March 2026 ward-wise data"
                style={{ width: "100%", background: C.surface2, border: "1px solid rgba(168,85,247,0.2)", borderRadius: 7, padding: "9px 12px", color: "white", fontSize: 13, outline: "none" }} />
            </div>

            <button type="submit" disabled={loading || !file} style={{
              width: "100%", padding: "11px",
              background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.5)",
              borderRadius: 8, color: C.admin, fontWeight: 800, fontSize: 14,
              cursor: loading || !file ? "not-allowed" : "pointer", opacity: loading || !file ? 0.5 : 1,
            }}>
              {loading ? "⏳ Uploading..." : "⬆ UPLOAD FILE"}
            </button>
          </form>
        </div>

        {/* Requirements card */}
        <div style={{ background: C.surface, border: "1px solid rgba(0,212,255,0.12)", borderRadius: 12, padding: "24px" }}>
          <h4 style={{ color: C.supply, margin: "0 0 16px 0", fontSize: 14, letterSpacing: 1 }}>📋 FILE REQUIREMENTS</h4>
          {[
            ["Format", "Excel (.xlsx, .xls) or CSV (.csv)"],
            ["Max Size", "50 MB per file"],
            ["Expected Columns", "Date, Ward_No, Ward_Name, Water_Supplied_MLD, Water_Consumed_MLD, Leakage_MLD"],
            ["Date Format", "YYYY-MM-DD (e.g. 2026-03-01)"],
            ["Zones", "1 to 27 (one row per zone per day)"],
            ["MLD Values", "Positive decimal numbers"],
          ].map(([k,v]) => (
            <div key={k} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "8px 0", display: "flex", gap: 12 }}>
              <span style={{ color: C.muted, fontSize: 12, minWidth: 130 }}>{k}:</span>
              <span style={{ color: "white", fontSize: 12 }}>{v}</span>
            </div>
          ))}

          {result && (
            <div style={{ marginTop: 20, background: "rgba(0,255,136,0.06)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ color: C.consumption, fontWeight: 700, marginBottom: 8, fontSize: 13 }}>✓ Last Upload Result</div>
              <div style={{ color: C.muted, fontSize: 12 }}>Rows: <span style={{ color:"white" }}>{result.rows?.toLocaleString()}</span></div>
              <div style={{ color: C.muted, fontSize: 12 }}>Columns: <span style={{ color:"white" }}>{result.columns?.join(", ")}</span></div>
              <div style={{ color: C.muted, fontSize: 12 }}>Size: <span style={{ color:"white" }}>{result.file_size ? (result.file_size/1024).toFixed(1)+"KB" : "-"}</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// USERS PAGE  (Admin only)
// ─────────────────────────────────────────────────────────
function UsersPage() {
  const api = useApi();
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]       = useState("");

  useEffect(() => {
    api("get", "/admin/users")
      .then(setUsers)
      .catch(e => setErr(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <div>
      <h2 style={{ color: "white", marginBottom: 6 }}>👥 Registered Users</h2>
      <p style={{ color: C.muted, marginBottom: 20, fontSize: 13 }}>All users registered on the Water Management Analytics platform.</p>
      <ErrBanner msg={err} />
      {loading ? <Spinner /> : (
        <>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <KpiCard label="Total Users"    value={users.length}                                        color={C.supply} />
            <KpiCard label="Admin Accounts" value={users.filter(u=>u.role==="admin").length}            color={C.admin} />
            <KpiCard label="Student Accounts" value={users.filter(u=>u.role==="student").length}       color={C.consumption} />
          </div>
          <div style={{ overflowX: "auto", background: C.surface, borderRadius: 10, border: "1px solid rgba(0,212,255,0.08)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ borderBottom: "1px solid rgba(0,212,255,0.15)" }}>
                {["#","Name","Email","Role","Registered"].map(h => <th key={h} style={{ padding:"11px 14px", textAlign:"left", color:C.supply, fontSize:10, letterSpacing:1 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {users.map((u,i) => (
                  <tr key={u.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)", background:i%2?C.surface2:"transparent" }}>
                    <td style={{ padding:"9px 14px", color:C.muted, fontFamily:"monospace" }}>{i+1}</td>
                    <td style={{ padding:"9px 14px", color:"white", fontWeight:600 }}>{u.name}</td>
                    <td style={{ padding:"9px 14px", color:C.muted, fontFamily:"monospace", fontSize:12 }}>{u.email}</td>
                    <td style={{ padding:"9px 14px" }}><RoleBadge role={u.role} /></td>
                    <td style={{ padding:"9px 14px", color:C.muted, fontSize:12 }}>{u.created?.slice(0,10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────
function AppInner() {
  const { user, ready }    = useAuth();
  const [authMode, setAuthMode] = useState("login");  // "login" | "signup"
  const [page, setPage]    = useState("city");

  if (!ready) return null;

  // Not logged in → show auth screen
  if (!user) {
    return authMode === "login"
      ? <LoginPage  onSwitchToSignup={() => setAuthMode("signup")} />
      : <SignupPage onSwitchToLogin={()  => setAuthMode("login")}  />;
  }

  // Admin-only page guard
  const isAdmin = user.role === "admin";
  if ((page === "upload" || page === "users") && !isAdmin) {
    setPage("city");
    return null;
  }

  const renderPage = () => {
    switch (page) {
      case "city":       return <CityPage />;
      case "ward":       return <WardPage />;
      case "alerts":     return <AlertsPage />;
      case "historical": return <HistoricalPage />;
      case "metrics":    return <MetricsPage />;
      case "datafiles":  return <DataFilesPage />;
      case "upload":     return isAdmin ? <UploadPage /> : null;
      case "users":      return isAdmin ? <UsersPage />  : null;
      default:           return <CityPage />;
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Syne', sans-serif", color: "white" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${C.surface}; }
        ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.25); border-radius: 3px; }
        input::placeholder { color: ${C.muted}; }
        select option { background: ${C.surface2}; }
      `}</style>

      <Navbar page={page} setPage={setPage} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px" }}>
        {/* Role-specific welcome banner */}
        {(page === "city") && (
          <div style={{
            background: isAdmin ? C.adminDim : C.studentDim,
            border: `1px solid ${isAdmin ? "rgba(168,85,247,0.25)" : "rgba(0,194,255,0.2)"}`,
            borderRadius: 10, padding: "12px 18px", marginBottom: 24,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ color: isAdmin ? C.admin : C.supply, fontSize: 13 }}>
              {isAdmin
                ? `⚙ Admin Dashboard — You can upload Excel files, view all analytics, and manage users.`
                : `🎓 Student Dashboard — View all water analytics and download Excel data files.`}
            </span>
            <RoleBadge role={user.role} />
          </div>
        )}

        {renderPage()}
      </div>

      <div style={{ textAlign: "center", padding: "24px 0 32px", color: C.muted, fontSize: 11, letterSpacing: 1, fontFamily: "monospace" }}>
        WATER MANAGEMENT ANALYTICS · PMC ESR 2024-25 · GRADIENT BOOSTING + FLASK + REACT
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
