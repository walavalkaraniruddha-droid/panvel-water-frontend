import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";
const C   = { bg:"#060c14", surface:"#0d1a2b", surface2:"#112035",
              supply:"#00c2ff", cons:"#00ff88", leak:"#ff4d6d", warn:"#ffb800", muted:"#6a8aaa" };

export default function Metrics() {
  const { user }   = useAuth();
  const [metrics, setMetrics] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.token) return;
    axios.defaults.headers.common["Authorization"] = `Bearer ${user.token}`;
    Promise.all([axios.get(`${API}/metrics`), axios.get(`${API}/summary`)])
      .then(([m, s]) => { setMetrics(m.data); setSummary(s.data); })
      .finally(() => setLoading(false));
  }, [user]);

  const acc = summary.Model_Accuracy || {};

  return (
    <div style={{ background:C.bg, minHeight:"100vh", padding:"clamp(16px,3vw,28px)",
      color:"white", fontFamily:"'Syne',sans-serif" }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      <h2 style={{ margin:"0 0 4px", fontSize:"clamp(1.1rem,3vw,1.3rem)", fontWeight:800 }}>
        📊 Model Performance
      </h2>
      <p style={{ color:C.muted, fontSize:13, marginBottom:20 }}>
        Gradient Boosting on daily differences · Train/test split 80/20 chronological
      </p>

      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:24 }}>
        {[
          { label:"City Supply R²",      value:acc.City_Supply_R2,      color:C.supply },
          { label:"City Consumption R²", value:acc.City_Consumption_R2, color:C.cons },
          { label:"City Leakage R²",     value:acc.City_Leakage_R2,     color:C.leak },
          { label:"Supply MAE",          value:acc.City_Supply_MAE ? `${acc.City_Supply_MAE?.toFixed(4)} MLD` : null, color:C.warn },
        ].map(k => (
          <div key={k.label} style={{ background:C.surface,
            border:`1px solid rgba(0,212,255,0.12)`,
            borderTop:`2px solid ${k.color}`, borderRadius:8,
            padding:"16px 18px", flex:1, minWidth:140 }}>
            <div style={{ color:C.muted, fontSize:10, letterSpacing:2,
              textTransform:"uppercase", marginBottom:6 }}>{k.label}</div>
            <div style={{ color:k.color, fontSize:"clamp(1.3rem,3vw,1.6rem)",
              fontWeight:700, fontFamily:"monospace" }}>{k.value ?? "—"}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", color:C.muted, padding:40 }}>Loading...</div>
      ) : (
        <>
          <div style={{ background:C.surface, borderRadius:10,
            padding:"clamp(12px,3vw,20px)", marginBottom:20,
            border:"1px solid rgba(0,212,255,0.1)" }}>
            <h3 style={{ margin:"0 0 14px", fontSize:13, color:"#ccd6f6" }}>
              Supply R² by Zone (27 total)
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={metrics} margin={{ bottom:50 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="Ward_Name" tick={{ fill:C.muted, fontSize:9 }}
                  tickLine={false} angle={-40} textAnchor="end" interval={0} />
                <YAxis domain={[0.95,1]} tick={{ fill:C.muted, fontSize:10 }} tickLine={false} />
                <Tooltip contentStyle={{ background:C.surface2,
                  border:"1px solid rgba(0,212,255,0.2)", borderRadius:8, fontSize:12 }}
                  labelStyle={{ color:"white" }} />
                <Bar dataKey="Supply_R2" fill={C.supply} name="Supply R²" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ overflowX:"auto", background:C.surface, borderRadius:8,
            border:"1px solid rgba(0,212,255,0.1)", WebkitOverflowScrolling:"touch",
            marginBottom:20 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:550 }}>
              <thead>
                <tr style={{ borderBottom:"1px solid rgba(0,212,255,0.2)" }}>
                  {["Zone","Zone Name","Supply R²","Supply RMSE","Zone Type"].map(h => (
                    <th key={h} style={{ padding:"10px 12px", textAlign:"left",
                      color:C.supply, fontFamily:"monospace", fontSize:10, letterSpacing:1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((row, i) => {
                  const zoneType = row.Ward_No >= 21
                    ? (row.Ward_No === 26 ? "MIDC" : row.Ward_No === 27 ? "Village" : "CIDCO")
                    : "PMC Ward";
                  const typeColor = row.Ward_No >= 21
                    ? (row.Ward_No === 26 ? "#ffb800" : row.Ward_No === 27 ? "#a855f7" : "#00ff88")
                    : "#00c2ff";
                  return (
                  <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)",
                    background: i%2 ? C.surface2 : "transparent" }}>
                    <td style={{ padding:"9px 12px", fontFamily:"monospace", color:C.muted }}>{row.Ward_No}</td>
                    <td style={{ padding:"9px 12px", fontWeight:600 }}>{row.Ward_Name}</td>
                    <td style={{ padding:"9px 12px", color:row.Supply_R2>0.98?C.cons:C.warn,
                      fontWeight:600, fontFamily:"monospace" }}>{row.Supply_R2?.toFixed(4)}</td>
                    <td style={{ padding:"9px 12px", color:C.muted,
                      fontFamily:"monospace" }}>{row.Supply_RMSE?.toFixed(4)}</td>
                    <td style={{ padding:"9px 12px" }}>
                      <span style={{ background:`${typeColor}18`, color:typeColor,
                        padding:"2px 8px", borderRadius:3, fontSize:10,
                        border:`1px solid ${typeColor}44`, fontWeight:700 }}>
                        {zoneType}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ background:C.surface, border:"1px solid rgba(0,194,255,0.12)",
            borderRadius:8, padding:"clamp(16px,3vw,24px)" }}>
            <h3 style={{ margin:"0 0 12px", fontSize:13, color:C.supply }}>📝 Model Methodology</h3>
            <p style={{ color:C.muted, fontSize:13, lineHeight:1.7, margin:0 }}>
              <b style={{ color:"white" }}>Algorithm:</b> Gradient Boosting Regressor · 200–300 estimators · learning rate 0.05–0.08<br/>
              <b style={{ color:"white" }}>Key Insight:</b> Rolling prediction uses last 14 days as lag features — enables 1 to 365-day forecasting with maintained accuracy<br/>
              <b style={{ color:"white" }}>Features:</b> 21 features — lag values (1,2,3,7 days), rolling means (3,7,14 day), calendar features, cyclical encodings<br/>
              <b style={{ color:"white" }}>Validation:</b> Chronological 80/20 train/test split · TimeSeriesSplit 5-fold CV<br/>
              <b style={{ color:"white" }}>Data:</b> 181 days × 27 zones = 4,887 records (Sep 2025 – Feb 2026) · 20 PMC wards + 7 CIDCO/MIDC/Village zones · ~211 MLD total
            </p>
          </div>
        </>
      )}
    </div>
  );
}
