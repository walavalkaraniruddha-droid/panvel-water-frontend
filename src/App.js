import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";

// ─────────────────────────────────────────────────────────────
// CONFIG  (same as original)
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

// ─────────────────────────────────────────────────────────────
// AUTH CONTEXT
// ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
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
// GLOBAL STYLES  (injected once)
// ─────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: #060c14; }
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  select, button, input { font-family: 'Syne', sans-serif; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #0d1a2b; }
  ::-webkit-scrollbar-thumb { background: rgba(0,194,255,0.3); border-radius: 3px; }
  input::placeholder { color: #3a5068; }
  select option { background: #112035; }
`;

// ─────────────────────────────────────────────────────────────
// SHARED COMPONENTS  (identical style to originals)
// ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, unit, color, sub }) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid rgba(0,212,255,0.15)`,
      borderTop: `2px solid ${color}`,
      borderRadius: 8,
      padding: "18px 20px",
      flex: 1,
      minWidth: 150,
    }}>
      <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ color, fontSize: "1.8rem", fontWeight: 700, fontFamily: "monospace" }}>
        {value !== undefined && value !== null ? `${value}` : "—"}
        {unit && <span style={{ fontSize: "0.9rem", marginLeft: 4 }}>{unit}</span>}
      </div>
      {sub && <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{sub}</div>}
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

function OkBanner({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.35)",
      color: "#00ff88", padding: "12px 20px", borderRadius: 8,
      marginBottom: 16, fontSize: 13,
    }}>✓ {msg}</div>
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

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: C.surface2, border: "1px solid rgba(0,212,255,0.2)",
      borderRadius: 8, padding: "12px 16px", fontSize: 12,
    }}>
      <div style={{ color: "white", fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 3 }}>
          {p.name}: <b>{typeof p.value === "number" ? p.value.toFixed(3) : p.value}</b> MLD
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// NAVBAR  (original "PANVEL WATER" style, name updated)
// ─────────────────────────────────────────────────────────────
function Navbar({ tab, setTab }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";

  const baseTabs = [
    { id: "city",       label: "🏙 City"       },
    { id: "ward",       label: "🏘 Ward"        },
    { id: "historical", label: "🗃 Historical"  },
    { id: "metrics",    label: "📊 Metrics"     },
    { id: "analytics",  label: "📈 Analytics"   },
  ];
  const adminTabs = [
    { id: "upload", label: "⬆ Upload" },
    { id: "users",  label: "👥 Users"  },
  ];
  const allTabs = isAdmin ? [...baseTabs, ...adminTabs] : baseTabs;

  return (
    <nav style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px", height: 52,
      background: C.surface,
      borderBottom: "1px solid rgba(0,212,255,0.12)",
      position: "sticky", top: 0, zIndex: 100,
      gap: 12,
    }}>
      {/* Logo — same original cyan style */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, cursor: "pointer" }}
        onClick={() => setTab("city")}>
        <span style={{ fontSize: 22 }}>💧</span>
        <span style={{
          fontWeight: 800, fontSize: 15, letterSpacing: 2,
          color: C.supply, textTransform: "uppercase",
        }}>
          WATER MANAGEMENT
        </span>
      </div>

      {/* Nav tabs */}
      <div style={{ display: "flex", gap: 2, overflow: "auto" }}>
        {allTabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: tab === t.id ? "rgba(0,194,255,0.12)" : "transparent",
            border: tab === t.id ? "1px solid rgba(0,194,255,0.35)" : "1px solid transparent",
            color: tab === t.id ? C.supply : C.muted,
            borderRadius: 5, padding: "6px 12px",
            fontSize: 12, fontWeight: 600, cursor: "pointer",
            whiteSpace: "nowrap", transition: "all 0.18s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Right: user info + logout */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {/* Role badge */}
        <span style={{
          background: isAdmin ? "rgba(168,85,247,0.15)" : "rgba(0,194,255,0.1)",
          color: isAdmin ? "#a855f7" : C.supply,
          border: `1px solid ${isAdmin ? "rgba(168,85,247,0.4)" : "rgba(0,194,255,0.3)"}`,
          fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          padding: "3px 10px", borderRadius: 20, textTransform: "uppercase",
        }}>
          {isAdmin ? "⚙ ADMIN" : "🎓 STUDENT"}
        </span>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "white", fontSize: 12, fontWeight: 700 }}>{user?.name}</div>
          <div style={{ color: C.muted, fontSize: 10 }}>{user?.email}</div>
        </div>
        <button onClick={logout} style={{
          background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.4)",
          color: "#ff4d6d", borderRadius: 5, padding: "6px 14px",
          fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>Logout</button>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGIN PAGE  (original design: big cyan title, dark card)
// ─────────────────────────────────────────────────────────────
function LoginPage({ onSwitchToSignup }) {
  const { login }             = useAuth();
  const [email,   setEmail]   = useState("");
  const [pwd,     setPwd]     = useState("");
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password: pwd });
      login(res.data);
    } catch (ex) {
      setErr(ex.response?.data?.error || "Invalid email or password.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Syne', sans-serif", padding: "20px",
    }}>
      <style>{GLOBAL_CSS}</style>

      {/* Big cyan title — exactly like original screenshots */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>💧</div>
        <h1 style={{
          fontSize: "clamp(2rem, 6vw, 3.2rem)",
          fontWeight: 800,
          color: C.supply,
          margin: 0,
          marginBottom: 8,
          letterSpacing: 1,
          lineHeight: 1.1,
          textShadow: "0 0 40px rgba(0,194,255,0.4)",
        }}>
          Water Management<br />Analytics
        </h1>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>
          Smart City Dashboard · Panvel Municipal Corporation
        </p>
      </div>

      {/* Dark card — same as original */}
      <div style={{
        background: C.surface,
        border: "1px solid rgba(0,212,255,0.15)",
        borderRadius: 12,
        padding: "32px 28px",
        width: "100%", maxWidth: 380,
        animation: "fadeIn 0.3s ease",
      }}>
        <h2 style={{ color: "white", fontWeight: 800, fontSize: "1.3rem", margin: "0 0 24px 0" }}>
          Sign In
        </h2>
        {err && <ErrorBanner msg={err} />}

        <form onSubmit={handle}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: C.muted, fontSize: 11, letterSpacing: 2, display: "block", marginBottom: 6 }}>EMAIL</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="your@email.com"
              style={{
                width: "100%", background: C.surface2,
                border: "1px solid rgba(0,212,255,0.15)", borderRadius: 7,
                padding: "11px 14px", color: "white", fontSize: 14, outline: "none",
              }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ color: C.muted, fontSize: 11, letterSpacing: 2, display: "block", marginBottom: 6 }}>PASSWORD</label>
            <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} required
              placeholder="••••••••"
              style={{
                width: "100%", background: C.surface2,
                border: "1px solid rgba(0,212,255,0.15)", borderRadius: 7,
                padding: "11px 14px", color: "white", fontSize: 14, outline: "none",
              }} />
          </div>

          {/* Cyan button — same as original */}
          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "13px",
            background: loading ? "rgba(0,194,255,0.08)" : "rgba(0,194,255,0.15)",
            border: "1px solid rgba(0,194,255,0.5)",
            borderRadius: 8, color: C.supply,
            fontWeight: 800, fontSize: 14, letterSpacing: 1,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1, transition: "all 0.2s",
          }}>
            {loading ? "Signing in..." : "SIGN IN →"}
          </button>
        </form>

        <p style={{ textAlign: "center", color: C.muted, fontSize: 13, marginTop: 18, marginBottom: 0 }}>
          Don't have an account?{" "}
          <span onClick={onSwitchToSignup}
            style={{ color: C.supply, cursor: "pointer", fontWeight: 700 }}>
            Create one
          </span>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SIGNUP PAGE  (original design + role selector)
// ─────────────────────────────────────────────────────────────
function SignupPage({ onSwitchToLogin }) {
  const { login }             = useAuth();
  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [pwd,     setPwd]     = useState("");
  const [confirm, setConfirm] = useState("");
  const [role,    setRole]    = useState("student");
  const [err,     setErr]     = useState("");
  const [ok,      setOk]      = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    if (pwd !== confirm) { setErr("Passwords do not match."); return; }
    setErr(""); setOk(""); setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/register`, { name, email, password: pwd, role });
      setOk(`Account created! Welcome, ${res.data.name}.`);
      setTimeout(() => login(res.data), 700);
    } catch (ex) {
      setErr(ex.response?.data?.error || "Registration failed.");
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Syne', sans-serif", padding: "20px",
    }}>
      <style>{GLOBAL_CSS}</style>

      {/* Same big cyan title */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>💧</div>
        <h1 style={{
          fontSize: "clamp(1.8rem, 5vw, 2.8rem)",
          fontWeight: 800, color: C.supply, margin: 0, marginBottom: 6,
          textShadow: "0 0 40px rgba(0,194,255,0.4)",
        }}>
          Water Management<br />Analytics
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>Create your account</p>
      </div>

      <div style={{
        background: C.surface,
        border: "1px solid rgba(0,212,255,0.15)",
        borderRadius: 12, padding: "32px 28px",
        width: "100%", maxWidth: 420,
        animation: "fadeIn 0.3s ease",
      }}>
        <h2 style={{ color: "white", fontWeight: 800, fontSize: "1.3rem", margin: "0 0 22px 0" }}>
          Create Account
        </h2>
        {err && <ErrorBanner msg={err} />}
        {ok  && <OkBanner    msg={ok}  />}

        <form onSubmit={handle}>
          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: C.muted, fontSize: 11, letterSpacing: 2, display: "block", marginBottom: 6 }}>FULL NAME</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required
              placeholder="Your name"
              style={{ width:"100%", background:C.surface2, border:"1px solid rgba(0,212,255,0.15)", borderRadius:7, padding:"11px 14px", color:"white", fontSize:14, outline:"none" }} />
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: C.muted, fontSize: 11, letterSpacing: 2, display: "block", marginBottom: 6 }}>EMAIL</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="your@email.com"
              style={{ width:"100%", background:C.surface2, border:"1px solid rgba(0,212,255,0.15)", borderRadius:7, padding:"11px 14px", color:"white", fontSize:14, outline:"none" }} />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: C.muted, fontSize: 11, letterSpacing: 2, display: "block", marginBottom: 6 }}>PASSWORD</label>
            <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} required
              placeholder="Min 6 characters"
              style={{ width:"100%", background:C.surface2, border:"1px solid rgba(0,212,255,0.15)", borderRadius:7, padding:"11px 14px", color:"white", fontSize:14, outline:"none" }} />
          </div>

          {/* Confirm password */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ color: C.muted, fontSize: 11, letterSpacing: 2, display: "block", marginBottom: 6 }}>CONFIRM PASSWORD</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              placeholder="Re-enter password"
              style={{ width:"100%", background:C.surface2, border:"1px solid rgba(0,212,255,0.15)", borderRadius:7, padding:"11px 14px", color:"white", fontSize:14, outline:"none" }} />
          </div>

          {/* Role selector — styled in original theme */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ color: C.muted, fontSize: 11, letterSpacing: 2, display: "block", marginBottom: 10 }}>SELECT ROLE</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { id: "student", icon: "🎓", title: "Student",  desc: "View analytics & download data" },
                { id: "admin",   icon: "⚙",  title: "Admin",    desc: "Upload files & manage data" },
              ].map(r => (
                <div key={r.id} onClick={() => setRole(r.id)} style={{
                  border: `2px solid ${role === r.id
                    ? (r.id === "admin" ? "rgba(168,85,247,0.7)" : "rgba(0,194,255,0.7)")
                    : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 10, padding: "14px 10px", cursor: "pointer", textAlign: "center",
                  background: role === r.id
                    ? (r.id === "admin" ? "rgba(168,85,247,0.1)" : "rgba(0,194,255,0.08)")
                    : "rgba(255,255,255,0.02)",
                  transition: "all 0.2s",
                }}>
                  <div style={{ fontSize: 24, marginBottom: 5 }}>{r.icon}</div>
                  <div style={{
                    fontWeight: 800, fontSize: 14,
                    color: role === r.id ? (r.id === "admin" ? "#a855f7" : C.supply) : "white",
                  }}>{r.title}</div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{r.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Green button for create — same as original screenshots */}
          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "13px",
            background: "rgba(0,255,136,0.12)",
            border: "1px solid rgba(0,255,136,0.5)",
            borderRadius: 8, color: C.consumption,
            fontWeight: 800, fontSize: 14, letterSpacing: 1,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1, transition: "all 0.2s",
          }}>
            {loading ? "Creating..." : "CREATE ACCOUNT →"}
          </button>
        </form>

        <p style={{ textAlign:"center", color:C.muted, fontSize:13, marginTop:18, marginBottom:0 }}>
          Already have an account?{" "}
          <span onClick={onSwitchToLogin} style={{ color:C.supply, cursor:"pointer", fontWeight:700 }}>
            Sign in
          </span>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// UPLOAD PAGE  (Admin only)
// ─────────────────────────────────────────────────────────────
function UploadPage() {
  const { user }              = useAuth();
  const [file,    setFile]    = useState(null);
  const [desc,    setDesc]    = useState("");
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");
  const [ok,      setOk]      = useState("");
  const [result,  setResult]  = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) { setErr("Please select a file."); return; }
    setErr(""); setOk(""); setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("description", desc);
      const res = await axios.post(`${API}/admin/upload_excel`, form, {
        headers: { Authorization: `Bearer ${user?.token}`, "Content-Type": "multipart/form-data" },
      });
      setOk(`"${file.name}" uploaded! ${res.data.rows} rows loaded.`);
      setResult(res.data);
      setFile(null); setDesc("");
    } catch (ex) {
      setErr(ex.response?.data?.error || "Upload failed.");
    } finally { setLoading(false); }
  };

  return (
    <div>
      <h2 style={{ color:"white", margin:"0 0 4px 0", fontSize:"1.2rem" }}>⬆ Upload Water Data</h2>
      <p style={{ color:C.muted, marginBottom:24, fontSize:13 }}>
        Upload Excel or CSV files with ward-wise water analytics data.
      </p>
      <ErrorBanner msg={err} />
      <OkBanner    msg={ok}  />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:20 }}>
        {/* Form */}
        <div style={{ background:C.surface, border:"1px solid rgba(0,212,255,0.15)", borderRadius:10, padding:24 }}>
          <h4 style={{ color:C.supply, margin:"0 0 18px 0", fontSize:12, letterSpacing:2 }}>UPLOAD NEW FILE</h4>
          <form onSubmit={handleUpload}>
            <div onClick={() => document.getElementById("fi").click()}
              style={{
                border:`2px dashed ${file ? "rgba(0,194,255,0.6)" : "rgba(0,212,255,0.2)"}`,
                borderRadius:8, padding:"28px 16px", textAlign:"center", cursor:"pointer",
                background: file ? "rgba(0,194,255,0.05)" : "transparent",
                marginBottom:14, transition:"all 0.2s",
              }}>
              <div style={{ fontSize:28, marginBottom:6 }}>{file ? "📄" : "📂"}</div>
              <div style={{ color: file ? C.supply : C.muted, fontSize:13, fontWeight:600 }}>
                {file ? file.name : "Click to select .xlsx / .xls / .csv"}
              </div>
              {file && <div style={{ color:C.muted, fontSize:11, marginTop:3 }}>{(file.size/1024).toFixed(1)} KB</div>}
            </div>
            <input id="fi" type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }}
              onChange={e => setFile(e.target.files[0] || null)} />

            <div style={{ marginBottom:14 }}>
              <label style={{ color:C.muted, fontSize:11, letterSpacing:2, display:"block", marginBottom:5 }}>DESCRIPTION (optional)</label>
              <input type="text" value={desc} onChange={e => setDesc(e.target.value)}
                placeholder="e.g. March 2026 ward data"
                style={{ width:"100%", background:C.surface2, border:"1px solid rgba(0,212,255,0.15)", borderRadius:7, padding:"10px 12px", color:"white", fontSize:13, outline:"none" }} />
            </div>

            <button type="submit" disabled={loading || !file} style={{
              width:"100%", padding:"12px",
              background:"rgba(0,194,255,0.12)", border:"1px solid rgba(0,194,255,0.4)",
              borderRadius:8, color:C.supply, fontWeight:800, fontSize:13, letterSpacing:1,
              cursor: loading || !file ? "not-allowed" : "pointer",
              opacity: loading || !file ? 0.5 : 1,
            }}>
              {loading ? "⏳ Uploading..." : "⬆ UPLOAD FILE"}
            </button>
          </form>
        </div>

        {/* Requirements */}
        <div style={{ background:C.surface, border:"1px solid rgba(0,212,255,0.15)", borderRadius:10, padding:24 }}>
          <h4 style={{ color:C.supply, margin:"0 0 14px 0", fontSize:12, letterSpacing:2 }}>FILE REQUIREMENTS</h4>
          {[
            ["Format",  ".xlsx, .xls, .csv"],
            ["Max Size","50 MB"],
            ["Columns", "Date, Ward_No, Ward_Name, Water_Supplied_MLD, Water_Consumed_MLD, Leakage_MLD"],
            ["Zones",   "1 to 27"],
          ].map(([k,v]) => (
            <div key={k} style={{ borderBottom:"1px solid rgba(255,255,255,0.05)", padding:"8px 0", display:"flex", gap:10 }}>
              <span style={{ color:C.muted, fontSize:12, minWidth:70 }}>{k}:</span>
              <span style={{ color:"white", fontSize:12 }}>{v}</span>
            </div>
          ))}
          {result && (
            <div style={{ marginTop:14, background:"rgba(0,255,136,0.06)", border:"1px solid rgba(0,255,136,0.2)", borderRadius:8, padding:"12px" }}>
              <div style={{ color:C.consumption, fontWeight:700, marginBottom:5, fontSize:12 }}>✓ Upload Result</div>
              <div style={{ color:C.muted, fontSize:12 }}>Rows: <span style={{ color:"white" }}>{result.rows?.toLocaleString()}</span></div>
              <div style={{ color:C.muted, fontSize:12 }}>Cols: <span style={{ color:"white" }}>{result.columns?.join(", ")}</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DATA FILES + DOWNLOAD PAGE  (both roles)
// ─────────────────────────────────────────────────────────────
function DataFilesPage() {
  const { user }                  = useAuth();
  const isAdmin                   = user?.role === "admin";
  const [files,   setFiles]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [err,     setErr]         = useState("");
  const [ok,      setOk]          = useState("");
  const [preview, setPreview]     = useState(null);
  const [prevLoad, setPrevLoad]   = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/admin/files`, { headers:{ Authorization:`Bearer ${user?.token}` } })
      .then(r => setFiles(r.data))
      .catch(e => setErr(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const del = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      await axios.delete(`${API}/admin/files/${id}`, { headers:{ Authorization:`Bearer ${user?.token}` } });
      setOk("File deleted."); load();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
  };

  const download = (url, filename) => {
    fetch(`${API}${url}`, { headers:{ Authorization:`Bearer ${user?.token}` } })
      .then(r => r.blob())
      .then(blob => { const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); });
  };

  const previewFile = async (id) => {
    if (preview?.id === id) { setPreview(null); return; }
    setPrevLoad(true);
    try {
      const r = await axios.get(`${API}/admin/files/${id}/preview`, { headers:{ Authorization:`Bearer ${user?.token}` } });
      setPreview({ id, data: r.data });
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    finally { setPrevLoad(false); }
  };

  return (
    <div>
      <h2 style={{ color:"white", margin:"0 0 4px 0", fontSize:"1.2rem" }}>📁 Data Files</h2>
      <p style={{ color:C.muted, marginBottom:20, fontSize:13 }}>
        {isAdmin ? "Manage uploaded data files." : "Download water data Excel files."}
      </p>
      <ErrorBanner msg={err} />
      <OkBanner    msg={ok}  />

      {/* Built-in downloads */}
      <div style={{ background:C.surface, border:"1px solid rgba(0,212,255,0.15)", borderRadius:8, padding:"14px 18px", marginBottom:20 }}>
        <div style={{ color:C.muted, fontSize:11, letterSpacing:2, marginBottom:10 }}>BUILT-IN DOWNLOADS</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <button onClick={() => download("/download/historical_excel","WMA_City_Historical.xlsx")}
            style={{ background:"rgba(0,194,255,0.1)", border:"1px solid rgba(0,194,255,0.3)", color:C.supply, padding:"8px 14px", borderRadius:6, fontSize:12, fontWeight:700, cursor:"pointer" }}>
            📊 City Historical (.xlsx)
          </button>
          {[1,2,3,4,5].map(z => (
            <button key={z} onClick={() => download(`/download/ward_excel/${z}`,`WMA_Zone${z}.xlsx`)}
              style={{ background:"rgba(0,255,136,0.08)", border:"1px solid rgba(0,255,136,0.2)", color:C.consumption, padding:"8px 12px", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer" }}>
              Zone {z}
            </button>
          ))}
        </div>
      </div>

      {loading ? <Spinner /> : files.length === 0 ? (
        <div style={{ textAlign:"center", color:C.muted, padding:40, fontSize:14 }}>
          {isAdmin ? "No uploaded files yet. Use ⬆ Upload to add files." : "No uploaded files available yet."}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {files.map(f => (
            <div key={f.id} style={{ background:C.surface, border:"1px solid rgba(0,212,255,0.12)", borderRadius:8, padding:"12px 16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                <div>
                  <span style={{ color:"white", fontWeight:700 }}>📄 {f.original_name}</span>
                  <span style={{ color:C.muted, fontSize:12, marginLeft:12 }}>
                    {f.rows?.toLocaleString()} rows · {(f.file_size/1024).toFixed(1)} KB · {f.uploaded_at?.slice(0,10)}
                    {f.description ? ` · ${f.description}` : ""}
                  </span>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => previewFile(f.id)}
                    style={{ background:"rgba(0,194,255,0.08)", border:"1px solid rgba(0,194,255,0.25)", color:C.supply, padding:"5px 12px", borderRadius:5, fontSize:12, cursor:"pointer" }}>
                    {preview?.id===f.id ? "Hide" : "👁 Preview"}
                  </button>
                  <button onClick={() => download(`/admin/files/${f.id}/download`, f.original_name)}
                    style={{ background:"rgba(0,255,136,0.08)", border:"1px solid rgba(0,255,136,0.25)", color:C.consumption, padding:"5px 12px", borderRadius:5, fontSize:12, cursor:"pointer" }}>
                    ⬇ Download
                  </button>
                  {isAdmin && (
                    <button onClick={() => del(f.id, f.original_name)}
                      style={{ background:"rgba(255,77,109,0.08)", border:"1px solid rgba(255,77,109,0.25)", color:C.leakage, padding:"5px 12px", borderRadius:5, fontSize:12, cursor:"pointer" }}>
                      🗑 Delete
                    </button>
                  )}
                </div>
              </div>
              {preview?.id === f.id && (
                prevLoad ? <Spinner /> : preview.data && (
                  <div style={{ marginTop:12, overflowX:"auto" }}>
                    <div style={{ color:C.muted, fontSize:11, marginBottom:5 }}>
                      First {preview.data.rows.length} of {preview.data.total_rows} rows
                    </div>
                    <table style={{ borderCollapse:"collapse", fontSize:11 }}>
                      <thead><tr style={{ borderBottom:"1px solid rgba(0,212,255,0.15)" }}>
                        {preview.data.columns.map(c => <th key={c} style={{ padding:"6px 10px", color:C.supply, fontSize:10, textAlign:"left", whiteSpace:"nowrap" }}>{c}</th>)}
                      </tr></thead>
                      <tbody>
                        {preview.data.rows.map((row,i) => (
                          <tr key={i} style={{ background:i%2?C.surface2:"transparent" }}>
                            {preview.data.columns.map(c => <td key={c} style={{ padding:"5px 10px", color:C.muted, whiteSpace:"nowrap" }}>{String(row[c]??"")}</td>)}
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

// ─────────────────────────────────────────────────────────────
// USERS PAGE  (Admin only)
// ─────────────────────────────────────────────────────────────
function UsersPage() {
  const { user }              = useAuth();
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  useEffect(() => {
    axios.get(`${API}/admin/users`, { headers:{ Authorization:`Bearer ${user?.token}` } })
      .then(r => setUsers(r.data))
      .catch(e => setErr(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div>
      <h2 style={{ color:"white", margin:"0 0 4px 0", fontSize:"1.2rem" }}>👥 Registered Users</h2>
      <p style={{ color:C.muted, marginBottom:20, fontSize:13 }}>All users registered on Water Management Analytics.</p>
      <ErrorBanner msg={err} />
      {loading ? <Spinner /> : (
        <>
          <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:20 }}>
            <KpiCard label="Total Users" value={users.length} color={C.supply} />
            <KpiCard label="Admins"   value={users.filter(u=>u.role==="admin").length}   color="#a855f7" />
            <KpiCard label="Students" value={users.filter(u=>u.role==="student").length} color={C.consumption} />
          </div>
          <div style={{ overflowX:"auto", background:C.surface, borderRadius:8, border:"1px solid rgba(0,212,255,0.12)" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead><tr style={{ borderBottom:"1px solid rgba(0,212,255,0.2)" }}>
                {["#","Name","Email","Role","Registered"].map(h => (
                  <th key={h} style={{ padding:"10px 14px", textAlign:"left", color:C.supply, fontSize:10, letterSpacing:1 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {users.map((u,i) => (
                  <tr key={u.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)", background:i%2?C.surface2:"transparent" }}>
                    <td style={{ padding:"9px 14px", color:C.muted, fontFamily:"monospace" }}>{i+1}</td>
                    <td style={{ padding:"9px 14px", color:"white", fontWeight:600 }}>{u.name}</td>
                    <td style={{ padding:"9px 14px", color:C.muted, fontSize:12 }}>{u.email}</td>
                    <td style={{ padding:"9px 14px" }}>
                      <span style={{
                        background: u.role==="admin" ? "rgba(168,85,247,0.15)" : "rgba(0,194,255,0.1)",
                        color: u.role==="admin" ? "#a855f7" : C.supply,
                        border:`1px solid ${u.role==="admin" ? "rgba(168,85,247,0.35)" : "rgba(0,194,255,0.25)"}`,
                        padding:"2px 8px", borderRadius:20, fontSize:10, fontWeight:700, letterSpacing:1,
                      }}>{u.role === "admin" ? "⚙ ADMIN" : "🎓 STUDENT"}</span>
                    </td>
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

// ─────────────────────────────────────────────────────────────
// MAIN DASHBOARD  (IDENTICAL to original App_improved.js)
// ─────────────────────────────────────────────────────────────
function Dashboard({ tab, setTab }) {
  const { user }                    = useAuth();
  const [days, setDays]             = useState(7);
  const [cityData, setCityData]     = useState([]);
  const [wardData, setWardData]     = useState([]);
  const [wardList, setWardList]     = useState([]);
  const [selectedWard, setSelectedWard] = useState(1);
  const [summary, setSummary]       = useState({});
  const [metrics, setMetrics]       = useState([]);
  const [historical, setHistorical] = useState([]);
  const [loading, setLoading]       = useState({});
  const [error, setError]           = useState("");

  const setLoad = (k, v) => setLoading(p => ({...p, [k]: v}));

  const apiGet = useCallback(async (url) => {
    const res = await axios.get(`${API}${url}`, {
      headers: { Authorization: `Bearer ${user?.token}` },
    });
    return res.data;
  }, [user]);

  // Load summary + ward list
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

  // Load historical when tab changes
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

  // Load metrics when tab changes
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

  const fetchCity = useCallback(async () => {
    setError(""); setLoad("city", true);
    try { setCityData(await apiGet(`/predict/city/${days}`)); }
    catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setLoad("city", false); }
  }, [days, apiGet]);

  const fetchWard = useCallback(async () => {
    setError(""); setLoad("ward", true);
    try { setWardData(await apiGet(`/predict/ward/${selectedWard}/${days}`)); }
    catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setLoad("ward", false); }
  }, [selectedWard, days, apiGet]);

  const isAdmin = user?.role === "admin";

  // Special tabs that go outside the dashboard layout
  if (tab === "upload")    return isAdmin ? <UploadPage />   : null;
  if (tab === "users")     return isAdmin ? <UsersPage />    : null;
  if (tab === "datafiles") return <DataFilesPage />;

  return (
    <div style={{ padding: "28px 24px" }}>

      {/* ── KPI Strip — exactly same as original ── */}
      {tab === "city" && (
        <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:28 }}>
          <KpiCard label="Last Data Date"    value={summary.Last_Data_Date}                color={C.supply} />
          <KpiCard label="Avg Daily Supply"  value={summary.Avg_Daily_Supply_MLD}  unit="MLD" color={C.supply}  sub="Historical avg" />
          <KpiCard label="Avg Daily Leakage" value={summary.Avg_Daily_Leakage_MLD} unit="MLD" color={C.leakage} sub={`${summary.Avg_Leakage_Percentage}% of supply`} />
          <KpiCard label="Worst Leakage Zone" value={summary.Highest_Leakage_Ward}            color={C.warning}  sub={`Zone ${summary.Highest_Leakage_Ward_No}`} />
          <KpiCard label="Model R²"          value={summary.Model_Accuracy?.City_Supply_R2}   color={C.consumption} sub="27 Zones · Gradient Boosting" />
        </div>
      )}

      <ErrorBanner msg={error} />

      {/* ── Controls — same layout as original ── */}
      {(tab === "city" || tab === "ward") && (
        <div style={{
          display:"flex", gap:12, alignItems:"center", flexWrap:"wrap",
          marginBottom:24, background:C.surface,
          border:"1px solid rgba(0,212,255,0.15)",
          borderRadius:8, padding:"16px 20px",
        }}>
          <div>
            <label style={{ color:C.muted, fontSize:11, letterSpacing:2, display:"block", marginBottom:4 }}>FORECAST HORIZON</label>
            <select value={days} onChange={e => setDays(Number(e.target.value))}
              style={{ background:C.surface2, color:"white", border:"1px solid rgba(0,212,255,0.2)", borderRadius:5, padding:"8px 12px", fontSize:13 }}>
              {[1,7,14,30,60,90,180,365].map(d => (
                <option key={d} value={d}>Next {d} Day{d>1?"s":""}</option>
              ))}
            </select>
          </div>

          {tab === "ward" && (
            <div>
              <label style={{ color:C.muted, fontSize:11, letterSpacing:2, display:"block", marginBottom:4 }}>SELECT WARD</label>
              <select value={selectedWard} onChange={e => setSelectedWard(Number(e.target.value))}
                style={{ background:C.surface2, color:"white", border:"1px solid rgba(0,212,255,0.2)", borderRadius:5, padding:"8px 12px", fontSize:13 }}>
                {wardList.map(w => (
                  <option key={w.Ward_No} value={w.Ward_No}>Ward {w.Ward_No} — {w.Ward_Name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginTop:18 }}>
            <button
              onClick={tab === "ward" ? fetchWard : fetchCity}
              disabled={loading.city || loading.ward}
              style={{
                background:"rgba(0,212,255,0.15)", border:"1px solid rgba(0,212,255,0.4)",
                color:C.supply, padding:"10px 24px", borderRadius:5,
                fontWeight:700, fontSize:13, letterSpacing:1,
                cursor: loading.city||loading.ward ? "not-allowed":"pointer",
                opacity: loading.city||loading.ward ? 0.6:1,
              }}>
              {loading.city || loading.ward ? "⏳ Loading..." : "▶ PREDICT"}
            </button>
          </div>

          {(cityData.length > 0 || wardData.length > 0) && !loading.city && !loading.ward && (
            <div style={{ color:C.muted, fontSize:11, paddingTop:18 }}>
              {tab==="city"
                ? `✅ ${cityData.length} days · ${cityData[0]?.Date} → ${cityData[cityData.length-1]?.Date}`
                : wardData.length > 0 ? `✅ ${wardData.length} days` : ""}
            </div>
          )}
        </div>
      )}

      {/* ── Tabs — same style as original ── */}
      <div style={{
        display:"flex", gap:4,
        background:C.surface, border:"1px solid rgba(0,212,255,0.15)",
        borderRadius:8, padding:6, marginBottom:28, flexWrap:"wrap",
      }}>
        {[
          { id:"city",       label:"🏙 City Forecast"  },
          { id:"ward",       label:"🏘 Ward Forecast"  },
          { id:"historical", label:"📅 Historical"     },
          { id:"metrics",    label:"📊 Model Metrics"  },
          { id:"analytics",  label:"📈 Analytics"      },
          { id:"datafiles",  label:"📁 Data Files"     },
          ...(isAdmin ? [
            { id:"upload", label:"⬆ Upload" },
            { id:"users",  label:"👥 Users"  },
          ] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex:1, minWidth:100, padding:"10px 12px",
            background: tab===t.id ? "rgba(0,212,255,0.12)" : "transparent",
            border:     tab===t.id ? "1px solid rgba(0,212,255,0.3)" : "1px solid transparent",
            borderRadius:5, color: tab===t.id ? C.supply : C.muted,
            fontWeight:600, fontSize:12, cursor:"pointer", transition:"all 0.2s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ─────── CITY TAB — identical to original ─────── */}
      {tab === "city" && (
        loading.city ? <Spinner /> : cityData.length === 0 ? (
          <div style={{ textAlign:"center", color:C.muted, padding:60, fontSize:14 }}>
            Select a forecast horizon and click PREDICT
          </div>
        ) : (
          <>
            <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:28 }}>
              <KpiCard label="Avg Predicted Supply"      value={(cityData.reduce((a,r)=>a+r.Predicted_Supply_MLD,0)/cityData.length).toFixed(2)}      unit="MLD" color={C.supply} />
              <KpiCard label="Avg Predicted Consumption" value={(cityData.reduce((a,r)=>a+r.Predicted_Consumption_MLD,0)/cityData.length).toFixed(2)}  unit="MLD" color={C.consumption} />
              <KpiCard label="Avg Predicted Leakage"     value={(cityData.reduce((a,r)=>a+r.Predicted_Leakage_MLD,0)/cityData.length).toFixed(2)}      unit="MLD" color={C.leakage} />
              <KpiCard label="Avg Leakage %"             value={(cityData.reduce((a,r)=>a+r.Leakage_Percentage,0)/cityData.length).toFixed(1)}          unit="%" color={C.warning} />
            </div>

            <h3 style={{ marginBottom:14, color:"#ccd6f6" }}>Supply & Consumption Forecast</h3>
            <div style={{ background:C.surface, borderRadius:10, padding:20, marginBottom:24, border:"1px solid rgba(0,212,255,0.1)" }}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={cityData}>
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
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="Date" tick={{ fill:C.muted, fontSize:11 }} tickLine={false} />
                  <YAxis tick={{ fill:C.muted, fontSize:11 }} tickLine={false} unit=" MLD" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color:C.muted, fontSize:12 }} />
                  <Area type="monotone" dataKey="Predicted_Supply_MLD"      stroke={C.supply}      fill="url(#gS)" strokeWidth={2} name="Supply"      dot={false} />
                  <Area type="monotone" dataKey="Predicted_Consumption_MLD" stroke={C.consumption} fill="url(#gC)" strokeWidth={2} name="Consumption" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <h3 style={{ marginBottom:14, color:"#ccd6f6" }}>Leakage Forecast</h3>
            <div style={{ background:C.surface, borderRadius:10, padding:20, marginBottom:24, border:"1px solid rgba(0,212,255,0.1)" }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={cityData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="Date" tick={{ fill:C.muted, fontSize:11 }} tickLine={false} />
                  <YAxis tick={{ fill:C.muted, fontSize:11 }} tickLine={false} unit=" MLD" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Predicted_Leakage_MLD" fill={C.consumption} name="Leakage" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <h3 style={{ marginBottom:14, color:"#ccd6f6" }}>Detailed Predictions</h3>
            <div style={{ overflowX:"auto", background:C.surface, borderRadius:8, border:"1px solid rgba(0,212,255,0.1)" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid rgba(0,212,255,0.2)" }}>
                    {["Date","Supply MLD","Consumption MLD","Leakage MLD","Leakage %"].map(h => (
                      <th key={h} style={{ padding:"12px 14px", textAlign:"left", color:C.supply, fontFamily:"monospace", letterSpacing:1, fontSize:10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cityData.map((row,i) => (
                    <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)", background:i%2?C.surface2:"transparent" }}>
                      <td style={{ padding:"10px 14px", fontFamily:"monospace", color:C.muted }}>{row.Date}</td>
                      <td style={{ padding:"10px 14px", color:C.supply,      fontWeight:600 }}>{row.Predicted_Supply_MLD}</td>
                      <td style={{ padding:"10px 14px", color:C.consumption, fontWeight:600 }}>{row.Predicted_Consumption_MLD}</td>
                      <td style={{ padding:"10px 14px", color:C.leakage,     fontWeight:600 }}>{row.Predicted_Leakage_MLD}</td>
                      <td style={{ padding:"10px 14px" }}>
                        <span style={{
                          background: row.Leakage_Percentage>15?"rgba(255,77,109,0.15)":row.Leakage_Percentage>10?"rgba(255,184,0,0.15)":"rgba(0,255,136,0.1)",
                          color: row.Leakage_Percentage>15?C.leakage:row.Leakage_Percentage>10?C.warning:C.consumption,
                          padding:"2px 8px", borderRadius:3, fontFamily:"monospace",
                        }}>{row.Leakage_Percentage}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}

      {/* ─────── WARD TAB — identical to original ─────── */}
      {tab === "ward" && (
        loading.ward ? <Spinner /> : wardData.length === 0 ? (
          <div style={{ textAlign:"center", color:C.muted, padding:60, fontSize:14 }}>
            Select a ward and click PREDICT
          </div>
        ) : (
          <>
            <h3 style={{ marginBottom:14 }}>
              Ward {wardData[0]?.Ward_No} — {wardData[0]?.Ward_Name} · {days}-Day Forecast
            </h3>
            <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:20 }}>
              <KpiCard label="Avg Supply"      value={(wardData.reduce((a,r)=>a+r.Predicted_Supply_MLD,0)/wardData.length).toFixed(3)} unit="MLD" color={C.supply} />
              <KpiCard label="Avg Consumption" value={(wardData.reduce((a,r)=>a+r.Predicted_Consumption_MLD,0)/wardData.length).toFixed(3)} unit="MLD" color={C.consumption} />
              <KpiCard label="Avg Leakage"     value={(wardData.reduce((a,r)=>a+r.Predicted_Leakage_MLD,0)/wardData.length).toFixed(3)} unit="MLD" color={C.leakage} />
              <KpiCard label="Avg Leakage %"   value={wardData[0]?.Leakage_Percentage} unit="%" color={C.warning} />
            </div>
            <div style={{ background:C.surface, borderRadius:10, padding:20, marginBottom:24, border:"1px solid rgba(0,212,255,0.1)" }}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={wardData}>
                  <defs>
                    <linearGradient id="wS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.supply} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={C.supply} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="Date" tick={{ fill:C.muted, fontSize:11 }} tickLine={false} />
                  <YAxis tick={{ fill:C.muted, fontSize:11 }} tickLine={false} unit=" MLD" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color:C.muted, fontSize:12 }} />
                  <Area type="monotone" dataKey="Predicted_Supply_MLD"      stroke={C.supply}      fill="url(#wS)" strokeWidth={2} name="Supply"      dot={false} />
                  <Area type="monotone" dataKey="Predicted_Consumption_MLD" stroke={C.consumption} fill="none"     strokeWidth={2} name="Consumption" dot={false} />
                  <Area type="monotone" dataKey="Predicted_Leakage_MLD"     stroke={C.leakage}     fill="none"     strokeWidth={2} name="Leakage"     dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ overflowX:"auto", background:C.surface, borderRadius:8, border:"1px solid rgba(0,212,255,0.1)" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid rgba(0,212,255,0.2)" }}>
                    {["Date","Supply MLD","Consumption MLD","Leakage MLD","Leakage %"].map(h => (
                      <th key={h} style={{ padding:"12px 14px", textAlign:"left", color:C.supply, fontFamily:"monospace", fontSize:10, letterSpacing:1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wardData.map((row,i) => (
                    <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)", background:i%2?C.surface2:"transparent" }}>
                      <td style={{ padding:"10px 14px", fontFamily:"monospace", color:C.muted }}>{row.Date}</td>
                      <td style={{ padding:"10px 14px", color:C.supply,      fontWeight:600 }}>{row.Predicted_Supply_MLD}</td>
                      <td style={{ padding:"10px 14px", color:C.consumption, fontWeight:600 }}>{row.Predicted_Consumption_MLD}</td>
                      <td style={{ padding:"10px 14px", color:C.leakage,     fontWeight:600 }}>{row.Predicted_Leakage_MLD}</td>
                      <td style={{ padding:"10px 14px" }}>
                        <span style={{
                          background: row.Leakage_Percentage>15?"rgba(255,77,109,0.15)":"rgba(0,255,136,0.1)",
                          color: row.Leakage_Percentage>15?C.leakage:C.consumption,
                          padding:"2px 8px", borderRadius:3, fontFamily:"monospace",
                        }}>{row.Leakage_Percentage}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}

      {/* ─────── HISTORICAL TAB — identical to original ─────── */}
      {tab === "historical" && (
        loading.hist ? <Spinner /> : historical.length === 0 ? <Spinner /> : (
          <>
            <h3 style={{ marginBottom:14 }}>Historical City Data — Sep 2025 to Feb 2026</h3>
            <div style={{ background:C.surface, borderRadius:10, padding:20, border:"1px solid rgba(0,212,255,0.1)" }}>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={historical}>
                  <defs>
                    <linearGradient id="hS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.supply} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={C.supply} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="Date" tick={{ fill:C.muted, fontSize:10 }} tickLine={false} interval={14} />
                  <YAxis tick={{ fill:C.muted, fontSize:11 }} tickLine={false} unit=" MLD" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color:C.muted, fontSize:12 }} />
                  <Area type="monotone" dataKey="Water_Supplied_MLD"  stroke={C.supply}      fill="url(#hS)" strokeWidth={2}   name="Supply"      dot={false} />
                  <Area type="monotone" dataKey="Water_Consumed_MLD"  stroke={C.consumption} fill="none"     strokeWidth={2}   name="Consumption" dot={false} />
                  <Area type="monotone" dataKey="Leakage_MLD"         stroke={C.leakage}     fill="none"     strokeWidth={1.5} name="Leakage"     dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )
      )}

      {/* ─────── METRICS TAB — identical to original ─────── */}
      {tab === "metrics" && (
        loading.metrics ? <Spinner /> : (
          <>
            <h2 style={{ margin:"0 0 4px 0", fontSize:"1.2rem", fontWeight:800 }}>📊 Model Performance</h2>
            <p style={{ color:C.muted, fontSize:13, marginBottom:20 }}>
              Gradient Boosting on daily differences · Train/test split 80/20 chronological
            </p>
            <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:28 }}>
              <KpiCard label="City Supply R²"      value={summary.Model_Accuracy?.City_Supply_R2}      color={C.supply}      sub="Gradient Boosting" />
              <KpiCard label="City Consumption R²" value={summary.Model_Accuracy?.City_Consumption_R2} color={C.consumption} />
              <KpiCard label="City Supply RMSE"    value={summary.Model_Accuracy?.City_Supply_RMSE ? `${Number(summary.Model_Accuracy?.City_Supply_RMSE).toFixed(4)} MLD` : null} color={C.leakage} />
              <KpiCard label="Total Zones"         value="27 Zones"                                    color={C.warning} />
            </div>
            <div style={{ background:C.surface, borderRadius:10, padding:20, marginBottom:20, border:"1px solid rgba(0,212,255,0.1)" }}>
              <h3 style={{ margin:"0 0 14px 0", fontSize:13, color:"#ccd6f6" }}>Supply R² by Zone (27 total)</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics} margin={{ bottom:50 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="Ward_Name" tick={{ fill:C.muted, fontSize:9 }} tickLine={false} angle={-40} textAnchor="end" interval={0} />
                  <YAxis domain={[0.92,1]} tick={{ fill:C.muted, fontSize:10 }} tickLine={false} />
                  <Tooltip contentStyle={{ background:C.surface2, border:"1px solid rgba(0,212,255,0.2)", borderRadius:8, fontSize:12 }} labelStyle={{ color:"white" }} />
                  <Bar dataKey="Supply_R2" fill={C.supply} name="Supply R²" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ overflowX:"auto", background:C.surface, borderRadius:8, border:"1px solid rgba(0,212,255,0.1)" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid rgba(0,212,255,0.2)" }}>
                    {["Zone","Zone Name","Supply R²","RMSE (MLD)","Zone Type"].map(h => (
                      <th key={h} style={{ padding:"10px 12px", textAlign:"left", color:C.supply, fontFamily:"monospace", fontSize:10, letterSpacing:1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((row,i) => {
                    const type  = row.Ward_No>=21 ? (row.Ward_No===26?"MIDC":row.Ward_No===27?"Village":"CIDCO") : "PMC Ward";
                    const typeC = row.Ward_No>=21 ? (row.Ward_No===26?C.warning:row.Ward_No===27?"#a855f7":C.consumption) : C.supply;
                    return (
                      <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)", background:i%2?C.surface2:"transparent" }}>
                        <td style={{ padding:"9px 12px", fontFamily:"monospace", color:C.muted }}>{row.Ward_No}</td>
                        <td style={{ padding:"9px 12px", fontWeight:600 }}>{row.Ward_Name}</td>
                        <td style={{ padding:"9px 12px", color:row.Supply_R2>=0.97?C.consumption:C.warning, fontWeight:600 }}>{row.Supply_R2?.toFixed?.(4) ?? row.Supply_R2}</td>
                        <td style={{ padding:"9px 12px", color:C.muted, fontFamily:"monospace" }}>{row.Supply_RMSE?.toFixed?.(4) ?? row.Supply_RMSE}</td>
                        <td style={{ padding:"9px 12px" }}>
                          <span style={{ background:`${typeC}18`, color:typeC, padding:"2px 8px", borderRadius:3, fontSize:10, border:`1px solid ${typeC}44`, fontWeight:700 }}>{type}</span>
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

      {/* ─────── ANALYTICS TAB ─────── */}
      {tab === "analytics" && (
        <div>
          {cityData.length === 0 && wardData.length === 0 ? (
            <div style={{ textAlign:"center", color:"#6a8aaa", padding:60 }}>
              <div style={{ fontSize:48, marginBottom:16 }}>📈</div>
              <h3 style={{ color:"white", marginBottom:8 }}>Analytics Dashboard</h3>
              <p style={{ fontSize:13 }}>Run a City or Ward prediction first to see insights here.</p>
            </div>
          ) : (
            <>
              {/* Summary from latest prediction */}
              {cityData.length > 0 && (
                <>
                  <h3 style={{ marginBottom:14, color:"#ccd6f6" }}>Latest City Forecast Summary</h3>
                  <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:28 }}>
                    <KpiCard label="Avg Predicted Supply"      value={(cityData.reduce((a,r)=>a+r.Predicted_Supply_MLD,0)/cityData.length).toFixed(2)}      unit="MLD" color="#00c2ff" />
                    <KpiCard label="Avg Predicted Consumption" value={(cityData.reduce((a,r)=>a+r.Predicted_Consumption_MLD,0)/cityData.length).toFixed(2)}  unit="MLD" color="#00ff88" />
                    <KpiCard label="Avg Predicted Leakage"     value={(cityData.reduce((a,r)=>a+r.Predicted_Leakage_MLD,0)/cityData.length).toFixed(2)}      unit="MLD" color="#ff4d6d" />
                    <KpiCard label="Avg Leakage %"             value={(cityData.reduce((a,r)=>a+r.Leakage_Percentage,0)/cityData.length).toFixed(1)}          unit="%" color="#ffb800" />
                    <KpiCard label="Forecast Days"             value={cityData.length}                                                                         color="#00c2ff" sub="Days predicted" />
                  </div>
                </>
              )}
              {wardData.length > 0 && (
                <>
                  <h3 style={{ marginBottom:14, color:"#ccd6f6" }}>Latest Zone Forecast Summary</h3>
                  <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginBottom:28 }}>
                    <KpiCard label="Zone"         value={wardData[0]?.Ward_Name}                                                                               color="#00c2ff" />
                    <KpiCard label="Avg Supply"   value={(wardData.reduce((a,r)=>a+r.Predicted_Supply_MLD,0)/wardData.length).toFixed(4)}   unit="MLD" color="#00c2ff" />
                    <KpiCard label="Avg Leakage"  value={(wardData.reduce((a,r)=>a+r.Predicted_Leakage_MLD,0)/wardData.length).toFixed(4)}  unit="MLD" color="#ff4d6d" />
                    <KpiCard label="Leakage %"    value={wardData[0]?.Leakage_Percentage}                                                   unit="%" color="#ffb800" />
                    <KpiCard label="Forecast Days" value={wardData.length}                                                                                     color="#00ff88" sub="Days predicted" />
                  </div>
                </>
              )}

              {/* ── INSIGHTS BOX ── */}
              <div style={{
                marginTop: 8,
                background: "#0d1a2b",
                border: "1px solid rgba(0,212,255,0.15)",
                borderRadius: 12,
                padding: "28px 28px 24px",
              }}>
                {/* Header */}
                <div style={{ marginBottom: 22 }}>
                  <div style={{
                    display: "inline-block",
                    background: "rgba(0,212,255,0.08)",
                    border: "1px solid rgba(0,212,255,0.25)",
                    color: "#00c2ff", fontSize: 10,
                    fontFamily: "monospace", letterSpacing: 3,
                    padding: "4px 12px", borderRadius: 2, marginBottom: 10,
                  }}>DASHBOARD INSIGHTS</div>
                  <h3 style={{ margin:0, fontSize:"1.05rem", fontWeight:800, color:"white" }}>
                    What This Dashboard Tells You
                  </h3>
                  <p style={{ color:"#6a8aaa", fontSize:12, margin:"5px 0 0 0" }}>
                    5 key features and 5 known limitations of the Water Management Analytics system
                  </p>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>

                  {/* LEFT — 5 FEATURES */}
                  <div style={{
                    background: "rgba(0,255,136,0.04)",
                    border: "1px solid rgba(0,255,136,0.2)",
                    borderLeft: "4px solid #00ff88",
                    borderRadius: 8, padding: "18px 20px",
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                      <span style={{ fontSize:17 }}>✅</span>
                      <span style={{ color:"#00ff88", fontWeight:800, fontSize:12, letterSpacing:1 }}>
                        WHAT THIS DASHBOARD SHOWS
                      </span>
                    </div>
                    {[
                      { icon:"💧", title:"City-Wide Supply Forecast",      desc:"Predicts total daily water supplied across all 27 Panvel zones (avg ~211 MLD) for up to 365 days using Gradient Boosting ML." },
                      { icon:"📍", title:"Zone-Level Leakage Detection",   desc:"Shows individual leakage % for each of the 27 zones (PMC wards, CIDCO sectors, MIDC, villages) vs the official 9.52% PMC benchmark." },
                      { icon:"📅", title:"181 Days of Historical Trends",  desc:"Displays actual supply, consumption and leakage from Sep 2025 – Feb 2026 aligned with the IIT Bombay PMC ESR 2024-25 report." },
                      { icon:"🤖", title:"High-Accuracy ML (R² = 0.9802)", desc:"29 Gradient Boosting models trained on 18 lag and calendar features achieve 98% prediction accuracy at city level." },
                      { icon:"🔔", title:"Smart Leakage Alert Classification", desc:"Automatically classifies every zone as CRITICAL ≥20%, HIGH ≥15%, MODERATE ≥10%, or NORMAL <10% after each prediction scan." },
                    ].map((f, i) => (
                      <div key={i} style={{
                        display:"flex", gap:11, marginBottom:i<4?13:0,
                        paddingBottom:i<4?13:0,
                        borderBottom:i<4?"1px solid rgba(0,255,136,0.1)":"none",
                      }}>
                        <span style={{ fontSize:17, flexShrink:0, marginTop:1 }}>{f.icon}</span>
                        <div>
                          <div style={{ color:"white", fontWeight:700, fontSize:12, marginBottom:3 }}>{f.title}</div>
                          <div style={{ color:"#6a8aaa", fontSize:11, lineHeight:1.6 }}>{f.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* RIGHT — 5 LIMITATIONS */}
                  <div style={{
                    background: "rgba(255,77,109,0.04)",
                    border: "1px solid rgba(255,77,109,0.2)",
                    borderLeft: "4px solid #ff4d6d",
                    borderRadius: 8, padding: "18px 20px",
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                      <span style={{ fontSize:17 }}>⚠️</span>
                      <span style={{ color:"#ff4d6d", fontWeight:800, fontSize:12, letterSpacing:1 }}>
                        KNOWN LIMITATIONS
                      </span>
                    </div>
                    {[
                      { icon:"📡", title:"No Live IoT Sensor Data",             desc:"All values are generated from official PMC PDF aggregate figures using a mathematical model — not from real-time pipe sensors or smart meters." },
                      { icon:"📉", title:"Accuracy Drops Beyond 180 Days",      desc:"Rolling prediction error compounds for long forecasts as the model feeds its own outputs as inputs, dropping R² from 0.98 to ~0.89." },
                      { icon:"🌧️", title:"Weather and Events Not Included",     desc:"Rainfall, monsoon surges, droughts and pipe bursts are not factored in. Sudden supply changes due to dam overflow are not detectable." },
                      { icon:"🏘️", title:"Leakage Rate Fixed at 9.52%",        desc:"The 9.52% is the official annual average from IIT Bombay ESR 2024-25. Actual daily per-zone leakage varies and is not tracked live." },
                      { icon:"😴", title:"Server Cold Start Delay (Free Tier)", desc:"The backend API sleeps after 15 min of inactivity on Render free tier. First request after idle takes 30–60 seconds to wake up." },
                    ].map((f, i) => (
                      <div key={i} style={{
                        display:"flex", gap:11, marginBottom:i<4?13:0,
                        paddingBottom:i<4?13:0,
                        borderBottom:i<4?"1px solid rgba(255,77,109,0.1)":"none",
                      }}>
                        <span style={{ fontSize:17, flexShrink:0, marginTop:1 }}>{f.icon}</span>
                        <div>
                          <div style={{ color:"white", fontWeight:700, fontSize:12, marginBottom:3 }}>{f.title}</div>
                          <div style={{ color:"#6a8aaa", fontSize:11, lineHeight:1.6 }}>{f.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>

                {/* Bottom data source note */}
                <div style={{
                  marginTop: 16, padding: "10px 14px",
                  background: "rgba(0,212,255,0.04)",
                  border: "1px solid rgba(0,212,255,0.1)",
                  borderRadius: 6, display:"flex", alignItems:"center", gap:10,
                }}>
                  <span style={{ fontSize:13 }}>📋</span>
                  <span style={{ color:"#6a8aaa", fontSize:11 }}>
                    <span style={{ color:"#00c2ff", fontWeight:700 }}>Data Source: </span>
                    PMC Environmental Status Report 2024-25 · IIT Bombay ESED · Dr. Abhishek Chakraborty ·
                    27 Zones · 4,887 Records · 181 Days (Sep 2025 – Feb 2026)
                  </span>
                </div>

              </div>
            </>
          )}
        </div>
      )}

      {/* Footer — same as original */}
      <div style={{ marginTop:60, textAlign:"center", color:C.muted, fontSize:11, fontFamily:"monospace", letterSpacing:1 }}>
        WATER MANAGEMENT ANALYTICS · PMC ESR 2024-25 · GRADIENT BOOSTING + FLASK + REACT
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT — auth gate → login/signup → dashboard
// ─────────────────────────────────────────────────────────────
function AppInner() {
  const { user, ready }         = useAuth();
  const [authMode, setAuthMode] = useState("login");
  const [tab, setTab]           = useState("city");

  if (!ready) return null;

  if (!user) {
    return authMode === "login"
      ? <LoginPage  onSwitchToSignup={() => setAuthMode("signup")} />
      : <SignupPage onSwitchToLogin={() => setAuthMode("login")} />;
  }

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:"white", fontFamily:"'Syne',sans-serif" }}>
      <style>{GLOBAL_CSS}</style>
      <Navbar tab={tab} setTab={setTab} />
      <Dashboard key={tab} tab={tab} setTab={setTab} />
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
