import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]   = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try { await login(form.email, form.password); navigate("/dashboard"); }
    catch (err) { setError(err.response?.data?.error || "Login failed."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background:"#060c14", minHeight:"100vh", display:"flex",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'Syne',sans-serif", padding:16 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input { font-family: inherit; }
        input:focus { outline: none; border-color: rgba(0,194,255,0.6) !important;
          box-shadow: 0 0 0 3px rgba(0,194,255,0.1); }
        .auth-card { width: 100%; max-width: 420px; }
        @media (max-width: 480px) { .auth-card { max-width: 100%; } }
      `}</style>

      <div className="auth-card">
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:44, marginBottom:10 }}>💧</div>
          <h1 style={{ color:"#00c2ff", fontSize:"clamp(1.4rem, 4vw, 1.9rem)",
            fontWeight:800, margin:"0 0 6px", letterSpacing:-1 }}>
            Panvel Water Analytics
          </h1>
          <p style={{ color:"#6a8aaa", fontSize:13, margin:0 }}>
            Smart City Dashboard · Panvel Municipal Corporation
          </p>
        </div>

        <div style={{ background:"#0d1a2b", border:"1px solid rgba(0,194,255,0.15)",
          borderRadius:12, padding:"clamp(20px, 5vw, 36px)" }}>
          <h2 style={{ color:"white", fontSize:"1.1rem", fontWeight:700, margin:"0 0 24px" }}>
            Sign In
          </h2>
          {error && (
            <div style={{ background:"rgba(255,77,109,0.1)",
              border:"1px solid rgba(255,77,109,0.3)", color:"#ff4d6d",
              padding:"12px 16px", borderRadius:7, fontSize:13, marginBottom:20 }}>
              ⚠ {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            {[
              { label:"Email",    key:"email",    type:"email",    ph:"your@email.com" },
              { label:"Password", key:"password", type:"password", ph:"••••••••" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:18 }}>
                <label style={{ color:"#6a8aaa", fontSize:11, letterSpacing:2,
                  textTransform:"uppercase", display:"block", marginBottom:7 }}>{f.label}</label>
                <input type={f.type} required placeholder={f.ph}
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  style={{ width:"100%", background:"#112035",
                    border:"1px solid rgba(0,194,255,0.15)", color:"white",
                    padding:"11px 14px", borderRadius:7, fontSize:14 }} />
              </div>
            ))}
            <button type="submit" disabled={loading} style={{
              width:"100%", background:"rgba(0,194,255,0.15)",
              border:"1px solid rgba(0,194,255,0.4)", color:"#00c2ff",
              padding:13, borderRadius:7, fontWeight:700, fontSize:14,
              cursor:loading?"not-allowed":"pointer", opacity:loading?0.7:1,
              fontFamily:"inherit", letterSpacing:1 }}>
              {loading ? "Signing in..." : "SIGN IN →"}
            </button>
          </form>
          <p style={{ color:"#6a8aaa", fontSize:13, textAlign:"center",
            marginTop:20, marginBottom:0 }}>
            Don't have an account?{" "}
            <Link to="/register" style={{ color:"#00c2ff", fontWeight:600 }}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
