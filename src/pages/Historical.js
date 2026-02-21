import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";
const C   = { bg:"#060c14", surface:"#0d1a2b", surface2:"#112035",
              supply:"#00c2ff", cons:"#00ff88", leak:"#ff4d6d", muted:"#6a8aaa" };

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

export default function Historical() {
  const { user } = useAuth();
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!user?.token) return;
    axios.defaults.headers.common["Authorization"] = `Bearer ${user.token}`;
    axios.get(`${API}/historical/city`)
      .then(r => setData(r.data))
      .catch(() => setError("Could not load historical data."))
      .finally(() => setLoading(false));
  }, [user]);

  const stats = data.length ? {
    maxSupply:  Math.max(...data.map(d => d.Water_Supplied_MLD)).toFixed(2),
    minSupply:  Math.min(...data.map(d => d.Water_Supplied_MLD)).toFixed(2),
    avgLeakage: (data.reduce((a,d) => a + (d.Leakage_Percentage||0), 0) / data.length).toFixed(1),
    days: data.length,
  } : {};

  return (
    <div style={{ background:C.bg, minHeight:"100vh", padding:"clamp(16px,3vw,28px)",
      color:"white", fontFamily:"'Syne',sans-serif" }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      <h2 style={{ margin:"0 0 4px", fontSize:"clamp(1.1rem,3vw,1.3rem)", fontWeight:800 }}>
        📅 Historical Data
      </h2>
      <p style={{ color:C.muted, fontSize:13, marginBottom:20 }}>
        Sep 2025 → Feb 2026 · City-level daily aggregates
      </p>

      {error && (
        <div style={{ background:"rgba(255,77,109,0.1)", border:"1px solid rgba(255,77,109,0.35)",
          color:C.leak, padding:"12px 18px", borderRadius:8, fontSize:13, marginBottom:16 }}>
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:"center", color:C.muted, padding:60 }}>Loading...</div>
      ) : (
        <>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
            {[
              { label:"Total Days",    value:stats.days,              color:C.supply },
              { label:"Max Supply",    value:`${stats.maxSupply} MLD`, color:C.supply },
              { label:"Min Supply",    value:`${stats.minSupply} MLD`, color:C.cons },
              { label:"Avg Leakage %", value:`${stats.avgLeakage}%`,   color:C.leak },
            ].map(s => (
              <div key={s.label} style={{ background:C.surface,
                border:`1px solid rgba(0,212,255,0.12)`,
                borderTop:`2px solid ${s.color}`,
                borderRadius:8, padding:"16px 18px", flex:1, minWidth:140 }}>
                <div style={{ color:C.muted, fontSize:10, letterSpacing:2,
                  textTransform:"uppercase", marginBottom:6 }}>{s.label}</div>
                <div style={{ color:s.color, fontSize:"clamp(1.3rem,3vw,1.5rem)",
                  fontWeight:700, fontFamily:"monospace" }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ background:C.surface, borderRadius:10,
            padding:"clamp(12px,3vw,20px)", marginBottom:16,
            border:"1px solid rgba(0,212,255,0.1)" }}>
            <h3 style={{ margin:"0 0 14px", fontSize:13, color:"#ccd6f6" }}>
              Supply, Consumption & Leakage — Full History
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="hS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.supply} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.supply} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="Date" tick={{ fill:C.muted, fontSize:10 }}
                  tickLine={false} interval={20} />
                <YAxis tick={{ fill:C.muted, fontSize:10 }} tickLine={false}
                  unit=" MLD" width={60} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ color:C.muted, fontSize:12 }} />
                <Area type="monotone" dataKey="Water_Supplied_MLD"
                  stroke={C.supply} fill="url(#hS)" strokeWidth={2} name="Supply" dot={false} />
                <Area type="monotone" dataKey="Water_Consumed_MLD"
                  stroke={C.cons} fill="none" strokeWidth={2} name="Consumption" dot={false} />
                <Area type="monotone" dataKey="Leakage_MLD"
                  stroke={C.leak} fill="none" strokeWidth={1.5} name="Leakage" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background:C.surface, borderRadius:10,
            padding:"clamp(12px,3vw,20px)",
            border:"1px solid rgba(0,212,255,0.1)" }}>
            <h3 style={{ margin:"0 0 14px", fontSize:13, color:"#ccd6f6" }}>
              Daily Leakage % Over Time
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="hL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.leak} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.leak} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="Date" tick={{ fill:C.muted, fontSize:10 }}
                  tickLine={false} interval={20} />
                <YAxis tick={{ fill:C.muted, fontSize:10 }} tickLine={false} unit="%" />
                <Tooltip />
                <Area type="monotone" dataKey="Leakage_Percentage"
                  stroke={C.leak} fill="url(#hL)" strokeWidth={2} name="Leakage %" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
