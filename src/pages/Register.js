import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [form, setForm]   = useState({ name:"", email:"", password:"", confirm:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError("");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true);
    try { await register(form.name, form.email, form.password); navigate("/dashboard"); }
    catch (err) { setError(err.response?.data?.error || "Registration failed."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background:"#060c14", minHeight:"100vh", display:"flex",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'Syne',sans-serif", padding:16 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input:focus { outline:none; border-color:rgba(0,194,255,0.6)!important; box-shadow:0 0 0 3px rgba(0,194,255,0.1); }
      `}</style>

      <div style={{ width:"100%", maxWidth:420 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:44, marginBottom:10 }}>💧</div>
          <h1 style={{ color:"#00c2ff", fontSize:"clamp(1.4rem,4vw,1.9rem)",
            fontWeight:800, margin:"0 0 6px", letterSpacing:-1 }}>
            Panvel Water Analytics
          </h1>
          <p style={{ color:"#6a8aaa", fontSize:13, margin:0 }}>Create your account</p>
        </div>

        <div style={{ background:"#0d1a2b", border:"1px solid rgba(0,194,255,0.15)",
          borderRadius:12, padding:"clamp(20px,5vw,36px)" }}>
          <h2 style={{ color:"white", fontSize:"1.1rem", fontWeight:700, margin:"0 0 24px" }}>
            Create Account
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
              { label:"Full Name",        key:"name",     type:"text",     ph:"Your name" },
              { label:"Email",            key:"email",    type:"email",    ph:"your@email.com" },
              { label:"Password",         key:"password", type:"password", ph:"Min 6 characters" },
              { label:"Confirm Password", key:"confirm",  type:"password", ph:"Re-enter password" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:16 }}>
                <label style={{ color:"#6a8aaa", fontSize:11, letterSpacing:2,
                  textTransform:"uppercase", display:"block", marginBottom:7 }}>{f.label}</label>
                <input type={f.type} required placeholder={f.ph}
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  style={{ width:"100%", background:"#112035",
                    border:"1px solid rgba(0,194,255,0.15)", color:"white",
                    padding:"11px 14px", borderRadius:7, fontSize:14, fontFamily:"inherit" }} />
              </div>
            ))}
            <button type="submit" disabled={loading} style={{
              width:"100%", background:"rgba(0,255,136,0.12)",
              border:"1px solid rgba(0,255,136,0.35)", color:"#00ff88",
              padding:13, borderRadius:7, fontWeight:700, fontSize:14,
              cursor:loading?"not-allowed":"pointer", opacity:loading?0.7:1,
              fontFamily:"inherit", letterSpacing:1, marginTop:4 }}>
              {loading ? "Creating..." : "CREATE ACCOUNT →"}
            </button>
          </form>
          <p style={{ color:"#6a8aaa", fontSize:13, textAlign:"center", marginTop:20, marginBottom:0 }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color:"#00c2ff", fontWeight:600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
