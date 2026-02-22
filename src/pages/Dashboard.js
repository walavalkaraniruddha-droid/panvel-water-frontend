import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useAuth }          from "../context/AuthContext";
import { useForecast }      from "../context/ForecastContext";
import { useNotifications } from "../context/NotificationContext";
import { showToast }        from "../components/ToastNotification";
import { scanAllWards }     from "../utils/wardScanner";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";
const C   = { bg:"#060c14", surface:"#0d1a2b", surface2:"#112035",
              supply:"#00c2ff", cons:"#00ff88", leak:"#ff4d6d", warn:"#ffb800", muted:"#6a8aaa" };

const HORIZON_OPTIONS = [
  { label:"Next 1 Day",    days:1   },
  { label:"Next 7 Days",   days:7   },
  { label:"Next 30 Days",  days:30  },
  { label:"Next 60 Days",  days:60  },
  { label:"Next 90 Days",  days:90  },
  { label:"Next 180 Days", days:180 },
  { label:"Next 1 Year",   days:365 },
];

const KpiCard = ({ label, value, unit, color, sub }) => (
  <div style={{ background:C.surface, border:`1px solid rgba(0,212,255,0.12)`,
    borderTop:`2px solid ${color}`, borderRadius:8, padding:"16px 18px",
    flex:1, minWidth:140 }}>
    <div style={{ color:C.muted, fontSize:10, letterSpacing:2,
      textTransform:"uppercase", marginBottom:6 }}>{label}</div>
    <div style={{ color, fontSize:"clamp(1.2rem,3vw,1.7rem)",
      fontWeight:700, fontFamily:"monospace" }}>
      {value ?? "—"}{unit && <span style={{ fontSize:"0.8rem", marginLeft:4 }}>{unit}</span>}
    </div>
    {sub && <div style={{ color:C.muted, fontSize:11, marginTop:4 }}>{sub}</div>}
  </div>
);

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:C.surface2, border:"1px solid rgba(0,212,255,0.2)",
      borderRadius:8, padding:"10px 14px", fontSize:12 }}>
      <div style={{ color:"white", fontWeight:700, marginBottom:5 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color, marginBottom:2 }}>
          {p.name}: <b>{typeof p.value==="number"?p.value.toFixed(3):p.value}</b>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { user }                          = useAuth();
  const { updateForecast }                = useForecast();
  const { addNotification, clearByDays }  = useNotifications();

  const [days, setDays]       = useState(7);
  const [data, setData]       = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError]     = useState("");

  useEffect(() => {
    if (!user?.token) return;
    axios.defaults.headers.common["Authorization"] = `Bearer ${user.token}`;
    axios.get(`${API}/summary`)
      .then(r => setSummary(r.data))
      .catch(() => setError("Could not load summary. Is Flask running?"));
  }, [user]);

  const predict = useCallback(async () => {
    if (!user?.token) return;
    setError(""); setLoading(true);
    axios.defaults.headers.common["Authorization"] = `Bearer ${user.token}`;
    try {
      const r      = await axios.get(`${API}/predict/city/${days}`);
      const result = r.data;
      setData(result);
      updateForecast(result, days);

      // Immediate city-level toast
      const avgLeak = result.reduce((a,d)=>a+d.Leakage_Percentage,0)/result.length;
      const critDays = result.filter(d=>d.Leakage_Percentage>=20).length;
      const highDays = result.filter(d=>d.Leakage_Percentage>=15).length;
      if (critDays > 0) {
        showToast(`City ${days}-day: ${critDays} CRITICAL days (≥20% leakage) detected!`, "CRITICAL");
      } else if (highDays > 0) {
        showToast(`City ${days}-day: ${highDays} HIGH days (≥15%) — avg ${avgLeak.toFixed(1)}%`, "HIGH");
      } else {
        showToast(`City ${days}-day forecast loaded — avg leakage ${avgLeak.toFixed(1)}%`, "SUCCESS");
      }

      // Now scan all wards dynamically in background — fires per-ward toasts + bell notifications
      setScanning(true);
      scanAllWards({
        days,
        token:           user.token,
        addNotification,
        clearByDays,
        threshold:       10,
      }).finally(() => setScanning(false));

    } catch (e) {
      setError(e.response?.data?.error || "Prediction failed.");
      showToast("Prediction failed — check if Flask is running", "HIGH");
    } finally { setLoading(false); }
  }, [days, user, updateForecast, addNotification, clearByDays]);

  const chartSample = days<=30 ? data
    : days<=90  ? data.filter((_,i)=>i%3===0)
    : days<=180 ? data.filter((_,i)=>i%7===0)
    : data.filter((_,i)=>i%14===0);

  const avgOf = key => data.length
    ? (data.reduce((a,r)=>a+(r[key]||0),0)/data.length).toFixed(3) : null;

  return (
    <div style={{ background:C.bg, minHeight:"100vh", padding:"clamp(16px,3vw,28px)",
      color:"white", fontFamily:"'Syne',sans-serif" }}>
      <style>{`* { box-sizing:border-box; }`}</style>

      {/* Summary KPIs */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
        <KpiCard label="Last Data Date"     value={summary.Last_Data_Date}                color={C.supply} />
        <KpiCard label="Avg Daily Supply"   value={summary.Avg_Daily_Supply_MLD}   unit="MLD" color={C.supply} sub="Historical avg" />
        <KpiCard label="Avg Daily Leakage"  value={summary.Avg_Daily_Leakage_MLD}  unit="MLD" color={C.leak}
          sub={summary.Avg_Leakage_Percentage?`${summary.Avg_Leakage_Percentage}% of supply`:""} />
        <KpiCard label="Worst Leakage Zone" value={summary.Highest_Leakage_Ward}          color={C.warn} sub={`Zone ${summary.Highest_Leakage_Ward_No}`} />
        <KpiCard label="Model R²"           value={summary.Model_Accuracy?.City_Supply_R2} color={C.cons} sub="27 Zones · Gradient Boosting" />
      </div>

      {error && (
        <div style={{ background:"rgba(255,77,109,0.1)", border:"1px solid rgba(255,77,109,0.35)",
          color:C.leak, padding:"12px 18px", borderRadius:8, fontSize:13, marginBottom:16 }}>
          ⚠ {error}
        </div>
      )}

      {/* Controls */}
      <div style={{ background:C.surface, border:"1px solid rgba(0,212,255,0.12)",
        borderRadius:8, padding:"14px 18px", marginBottom:20,
        display:"flex", gap:12, alignItems:"flex-end", flexWrap:"wrap" }}>
        <div>
          <div style={{ color:C.muted, fontSize:10, letterSpacing:2, marginBottom:6 }}>
            FORECAST HORIZON
          </div>
          <select value={days} onChange={e=>setDays(Number(e.target.value))}
            style={{ background:C.surface2, color:"white",
              border:"1px solid rgba(0,212,255,0.2)", borderRadius:5,
              padding:"9px 14px", fontSize:13, fontFamily:"inherit" }}>
            {HORIZON_OPTIONS.map(o=>(
              <option key={o.days} value={o.days}>{o.label}</option>
            ))}
          </select>
        </div>
        <button onClick={predict} disabled={loading||scanning}
          style={{ background:"rgba(0,194,255,0.12)", border:"1px solid rgba(0,194,255,0.4)",
            color:C.supply, padding:"10px 26px", borderRadius:5, fontWeight:700,
            fontSize:13, cursor:(loading||scanning)?"not-allowed":"pointer",
            opacity:(loading||scanning)?0.6:1, fontFamily:"inherit" }}>
          {loading?"⏳ Predicting...":scanning?"🔍 Scanning wards...":"▶ PREDICT"}
        </button>

        {scanning && (
          <div style={{ display:"flex", alignItems:"center", gap:8, color:C.warn, fontSize:12 }}>
            <span style={{ display:"inline-block", animation:"spin 1s linear infinite" }}>⚙️</span>
            Scanning all 27 zones for leakage alerts...
          </div>
        )}

        {data.length>0 && !loading && !scanning && (
          <div style={{ color:C.muted, fontSize:11, paddingBottom:2 }}>
            ✅ {data.length} days · {data[0]?.Date} → {data[data.length-1]?.Date}
          </div>
        )}
      </div>

      {data.length>0 && (
        <>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
            <KpiCard label="Avg Predicted Supply"      value={avgOf("Predicted_Supply_MLD")}      unit="MLD" color={C.supply} />
            <KpiCard label="Avg Predicted Consumption" value={avgOf("Predicted_Consumption_MLD")} unit="MLD" color={C.cons} />
            <KpiCard label="Avg Predicted Leakage"     value={avgOf("Predicted_Leakage_MLD")}     unit="MLD" color={C.leak} />
            <KpiCard label="Avg Leakage %"             value={avgOf("Leakage_Percentage")}          unit="%"   color={C.warn} />
          </div>

          <h3 style={{ marginBottom:12, color:"#ccd6f6", fontSize:14 }}>
            Supply & Consumption Forecast
          </h3>
          <div style={{ background:C.surface, borderRadius:10,
            padding:"clamp(12px,3vw,20px)", marginBottom:16,
            border:"1px solid rgba(0,212,255,0.1)" }}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartSample}>
                <defs>
                  <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.supply} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={C.supply} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.cons} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={C.cons} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="Date" tick={{fill:C.muted,fontSize:10}} tickLine={false}
                  interval={Math.floor(chartSample.length/8)}/>
                <YAxis tick={{fill:C.muted,fontSize:10}} tickLine={false} unit=" MLD" width={60}/>
                <Tooltip content={<Tip/>}/>
                <Legend wrapperStyle={{color:C.muted,fontSize:12}}/>
                <Area type="monotone" dataKey="Predicted_Supply_MLD"
                  stroke={C.supply} fill="url(#gS)" strokeWidth={2} name="Supply" dot={false}/>
                <Area type="monotone" dataKey="Predicted_Consumption_MLD"
                  stroke={C.cons} fill="url(#gC)" strokeWidth={2} name="Consumption" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <h3 style={{ marginBottom:12, color:"#ccd6f6", fontSize:14 }}>Leakage Forecast</h3>
          <div style={{ background:C.surface, borderRadius:10,
            padding:"clamp(12px,3vw,20px)", marginBottom:16,
            border:"1px solid rgba(0,212,255,0.1)" }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartSample}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)"/>
                <XAxis dataKey="Date" tick={{fill:C.muted,fontSize:10}} tickLine={false}
                  interval={Math.floor(chartSample.length/8)}/>
                <YAxis tick={{fill:C.muted,fontSize:10}} tickLine={false} unit=" MLD" width={60}/>
                <Tooltip content={<Tip/>}/>
                <Bar dataKey="Predicted_Leakage_MLD" name="Leakage" radius={[3,3,0,0]}>
                  {chartSample.map((r,i)=>(
                    <Cell key={i} fill={
                      r.Leakage_Percentage>=20?"#ff2d55":
                      r.Leakage_Percentage>=15?C.leak:
                      r.Leakage_Percentage>=10?C.warn:C.cons}/>
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h3 style={{ marginBottom:12, color:"#ccd6f6", fontSize:14 }}>Detailed Predictions</h3>
          <div style={{ overflowX:"auto", background:C.surface, borderRadius:8,
            border:"1px solid rgba(0,212,255,0.1)", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:600 }}>
              <thead>
                <tr style={{ borderBottom:"1px solid rgba(0,212,255,0.2)" }}>
                  {["Date","Supply MLD","95% CI","Consumption MLD","Leakage MLD","Leakage %","Status"].map(h=>(
                    <th key={h} style={{ padding:"10px 12px", textAlign:"left",
                      color:C.supply, fontFamily:"monospace", fontSize:10, letterSpacing:1 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row,i)=>{
                  const lv = row.Leakage_Percentage>=20?"CRITICAL":
                    row.Leakage_Percentage>=15?"HIGH":
                    row.Leakage_Percentage>=10?"MODERATE":"NORMAL";
                  const lc = lv==="CRITICAL"?"#ff2d55":lv==="HIGH"?C.leak:lv==="MODERATE"?C.warn:C.cons;
                  return (
                    <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)",
                      background:i%2?C.surface2:"transparent" }}>
                      <td style={{ padding:"9px 12px", fontFamily:"monospace", color:C.muted }}>{row.Date}</td>
                      <td style={{ padding:"9px 12px", color:C.supply, fontWeight:600 }}>{row.Predicted_Supply_MLD}</td>
                      <td style={{ padding:"9px 12px", color:C.muted, fontSize:10 }}>{row.Supply_Lower}–{row.Supply_Upper}</td>
                      <td style={{ padding:"9px 12px", color:C.cons, fontWeight:600 }}>{row.Predicted_Consumption_MLD}</td>
                      <td style={{ padding:"9px 12px", color:C.leak, fontWeight:600 }}>{row.Predicted_Leakage_MLD}</td>
                      <td style={{ padding:"9px 12px" }}>
                        <span style={{ background:`${lc}18`, color:lc, padding:"2px 8px",
                          borderRadius:3, fontFamily:"monospace", border:`1px solid ${lc}44` }}>
                          {row.Leakage_Percentage}%
                        </span>
                      </td>
                      <td style={{ padding:"9px 12px", fontSize:10, color:lc, fontWeight:700 }}>{lv}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data.length===0 && !loading && (
        <div style={{ textAlign:"center", color:C.muted, padding:"60px 20px", fontSize:14 }}>
          Select a forecast horizon and click PREDICT
        </div>
      )}

      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}
