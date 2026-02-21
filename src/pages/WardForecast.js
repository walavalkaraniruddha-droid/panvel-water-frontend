import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { showToast } from "../components/ToastNotification";
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";
const C   = { bg:"#060c14", surface:"#0d1a2b", surface2:"#112035",
              supply:"#00c2ff", cons:"#00ff88", leak:"#ff4d6d", warn:"#ffb800", muted:"#6a8aaa" };

const HORIZON_OPTIONS = [
  { label:"1 Day",    days:1   },
  { label:"7 Days",   days:7   },
  { label:"30 Days",  days:30  },
  { label:"60 Days",  days:60  },
  { label:"90 Days",  days:90  },
  { label:"180 Days", days:180 },
  { label:"1 Year",   days:365 },
];

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:C.surface2, border:"1px solid rgba(0,212,255,0.2)",
      borderRadius:8, padding:"10px 14px", fontSize:12 }}>
      <div style={{ color:"white", fontWeight:700, marginBottom:5 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color, marginBottom:2 }}>
          {p.name}: <b>{typeof p.value==="number" ? p.value.toFixed(3) : p.value}</b>
        </div>
      ))}
    </div>
  );
};

export default function WardForecast() {
  const { user } = useAuth();
  const [wards, setWards]     = useState([]);
  const [ward, setWard]       = useState(1);
  const [days, setDays]       = useState(30);
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!user?.token) return;
    axios.defaults.headers.common["Authorization"] = `Bearer ${user.token}`;
    axios.get(`${API}/wards`)
      .then(r => { setWards(r.data); setWard(r.data[0]?.Ward_No || 1); })
      .catch(() => setError("Could not load ward list."));
  }, [user]);

  const predict = useCallback(async () => {
    if (!user?.token) return;
    setError(""); setLoading(true);
    axios.defaults.headers.common["Authorization"] = `Bearer ${user.token}`;
    try {
      const r    = await axios.get(`${API}/predict/ward/${ward}/${days}`);
      const result = r.data;
      setData(result);

      // Alert toasts based on leakage
      const wardName = result[0]?.Ward_Name || `Ward ${ward}`;
      const critDays = result.filter(d => d.Leakage_Percentage >= 20);
      const highDays = result.filter(d => d.Leakage_Percentage >= 15);
      const avgLeak  = result.reduce((a,d) => a + d.Leakage_Percentage, 0) / result.length;

      if (critDays.length > 0) {
        showToast(
          `${wardName}: CRITICAL leakage ≥20% on ${critDays.length} days! Peak on ${critDays[0].Date}`,
          "CRITICAL", wardName
        );
      } else if (highDays.length > 0) {
        showToast(
          `${wardName}: HIGH leakage ≥15% on ${highDays.length} days — avg ${avgLeak.toFixed(1)}%`,
          "HIGH", wardName
        );
      } else if (avgLeak >= 10) {
        showToast(
          `${wardName}: Moderate leakage — avg ${avgLeak.toFixed(1)}% over ${days} days`,
          "MODERATE", wardName
        );
      } else {
        showToast(`${wardName}: ${days}-day forecast loaded — leakage normal at ${avgLeak.toFixed(1)}%`, "SUCCESS");
      }
    } catch (e) {
      setError(e.response?.data?.error || "Ward prediction failed.");
      showToast("Ward prediction failed", "HIGH");
    } finally { setLoading(false); }
  }, [ward, days, user]);

  const wardName = data[0]?.Ward_Name || wards.find(w => w.Ward_No === ward)?.Ward_Name || "";
  const chartSample = days <= 30 ? data
    : days <= 90  ? data.filter((_,i) => i%3===0)
    : days <= 180 ? data.filter((_,i) => i%7===0)
    : data.filter((_,i) => i%14===0);

  return (
    <div style={{ background:C.bg, minHeight:"100vh", padding:"clamp(16px,3vw,28px)",
      color:"white", fontFamily:"'Syne',sans-serif" }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      {error && (
        <div style={{ background:"rgba(255,77,109,0.1)", border:"1px solid rgba(255,77,109,0.35)",
          color:C.leak, padding:"12px 18px", borderRadius:8, fontSize:13, marginBottom:16 }}>
          ⚠ {error}
        </div>
      )}

      {/* Controls */}
      <div style={{ background:C.surface, border:"1px solid rgba(0,212,255,0.12)",
        borderRadius:8, padding:"14px 18px", marginBottom:24,
        display:"flex", gap:12, alignItems:"flex-end", flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ color:C.muted, fontSize:10, letterSpacing:2, marginBottom:6 }}>SELECT WARD</div>
          <select value={ward} onChange={e => setWard(Number(e.target.value))}
            style={{ width:"100%", background:C.surface2, color:"white",
              border:"1px solid rgba(0,212,255,0.2)", borderRadius:5,
              padding:"9px 14px", fontSize:13, fontFamily:"inherit" }}>
            {wards.map(w => (
              <option key={w.Ward_No} value={w.Ward_No}>
                Ward {w.Ward_No} — {w.Ward_Name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ color:C.muted, fontSize:10, letterSpacing:2, marginBottom:6 }}>HORIZON</div>
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            style={{ background:C.surface2, color:"white",
              border:"1px solid rgba(0,212,255,0.2)", borderRadius:5,
              padding:"9px 14px", fontSize:13, fontFamily:"inherit" }}>
            {HORIZON_OPTIONS.map(o => (
              <option key={o.days} value={o.days}>{o.label}</option>
            ))}
          </select>
        </div>
        <button onClick={predict} disabled={loading} style={{
          background:"rgba(0,194,255,0.12)", border:"1px solid rgba(0,194,255,0.4)",
          color:C.supply, padding:"10px 26px", borderRadius:5, fontWeight:700,
          fontSize:13, cursor:loading?"not-allowed":"pointer",
          opacity:loading?0.6:1, fontFamily:"inherit" }}>
          {loading ? "⏳ Loading..." : "▶ PREDICT"}
        </button>
      </div>

      {data.length > 0 && (
        <>
          <h3 style={{ marginBottom:16, fontSize:15, fontWeight:700 }}>
            Ward {ward} — {wardName} · {days}-Day Forecast
            <span style={{ color:C.muted, fontSize:11, fontWeight:400, marginLeft:8 }}>
              {data[0]?.Date} → {data[data.length-1]?.Date}
            </span>
          </h3>

          {/* Summary KPIs */}
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 }}>
            {[
              { label:"Avg Supply",      value:(data.reduce((a,d)=>a+d.Predicted_Supply_MLD,0)/data.length).toFixed(3),      unit:"MLD", color:C.supply },
              { label:"Avg Consumption", value:(data.reduce((a,d)=>a+d.Predicted_Consumption_MLD,0)/data.length).toFixed(3), unit:"MLD", color:C.cons },
              { label:"Avg Leakage",     value:(data.reduce((a,d)=>a+d.Predicted_Leakage_MLD,0)/data.length).toFixed(3),     unit:"MLD", color:C.leak },
              { label:"Avg Leakage %",   value:(data.reduce((a,d)=>a+d.Leakage_Percentage,0)/data.length).toFixed(1),         unit:"%",   color:C.warn },
            ].map(k => (
              <div key={k.label} style={{ background:C.surface, borderTop:`2px solid ${k.color}`,
                border:`1px solid rgba(0,212,255,0.1)`, borderRadius:8,
                padding:"14px 18px", flex:1, minWidth:130 }}>
                <div style={{ color:C.muted, fontSize:10, letterSpacing:2,
                  textTransform:"uppercase", marginBottom:4 }}>{k.label}</div>
                <div style={{ color:k.color, fontSize:"1.4rem",
                  fontWeight:700, fontFamily:"monospace" }}>
                  {k.value}<span style={{ fontSize:"0.8rem" }}> {k.unit}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background:C.surface, borderRadius:10,
            padding:"clamp(12px,3vw,20px)", marginBottom:20,
            border:"1px solid rgba(0,212,255,0.1)" }}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartSample}>
                <defs>
                  <linearGradient id="wS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.supply} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.supply} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="Date" tick={{ fill:C.muted, fontSize:10 }} tickLine={false}
                  interval={Math.floor(chartSample.length/8)} />
                <YAxis tick={{ fill:C.muted, fontSize:10 }} tickLine={false} unit=" MLD" width={60} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ color:C.muted, fontSize:12 }} />
                <Area type="monotone" dataKey="Predicted_Supply_MLD"
                  stroke={C.supply} fill="url(#wS)" strokeWidth={2} name="Supply" dot={false} />
                <Area type="monotone" dataKey="Predicted_Consumption_MLD"
                  stroke={C.cons} fill="none" strokeWidth={2} name="Consumption" dot={false} />
                <Area type="monotone" dataKey="Predicted_Leakage_MLD"
                  stroke={C.leak} fill="none" strokeWidth={2} name="Leakage" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ overflowX:"auto", background:C.surface, borderRadius:8,
            border:"1px solid rgba(0,212,255,0.1)", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:500 }}>
              <thead>
                <tr style={{ borderBottom:"1px solid rgba(0,212,255,0.2)" }}>
                  {["Date","Supply MLD","Consumption MLD","Leakage MLD","Leakage %","Alert"].map(h => (
                    <th key={h} style={{ padding:"10px 12px", textAlign:"left",
                      color:C.supply, fontFamily:"monospace", fontSize:10, letterSpacing:1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => {
                  const lv = row.Leakage_Percentage>=20?"🚨 CRITICAL":
                    row.Leakage_Percentage>=15?"⚠️ HIGH":
                    row.Leakage_Percentage>=10?"⚡ MODERATE":"✅ NORMAL";
                  const lc = row.Leakage_Percentage>=20?"#ff2d55":
                    row.Leakage_Percentage>=15?C.leak:
                    row.Leakage_Percentage>=10?C.warn:C.cons;
                  return (
                    <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)",
                      background: i%2 ? C.surface2 : "transparent",
                      ...(row.Leakage_Percentage>=15 ? { background:"rgba(255,77,109,0.05)" }:{}) }}>
                      <td style={{ padding:"9px 12px", fontFamily:"monospace", color:C.muted }}>{row.Date}</td>
                      <td style={{ padding:"9px 12px", color:C.supply, fontWeight:600 }}>{row.Predicted_Supply_MLD}</td>
                      <td style={{ padding:"9px 12px", color:C.cons, fontWeight:600 }}>{row.Predicted_Consumption_MLD}</td>
                      <td style={{ padding:"9px 12px", color:C.leak, fontWeight:600 }}>{row.Predicted_Leakage_MLD}</td>
                      <td style={{ padding:"9px 12px" }}>
                        <span style={{ color:lc, fontFamily:"monospace",
                          fontWeight:700, background:`${lc}15`,
                          padding:"2px 7px", borderRadius:3 }}>
                          {row.Leakage_Percentage}%
                        </span>
                      </td>
                      <td style={{ padding:"9px 12px", fontSize:11, color:lc, fontWeight:700 }}>{lv}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data.length === 0 && !loading && (
        <div style={{ textAlign:"center", color:C.muted, padding:"60px 20px", fontSize:14 }}>
          Select a ward and click PREDICT
        </div>
      )}
    </div>
  );
}
