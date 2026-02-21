import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useForecast } from "../context/ForecastContext";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, LabelList,
  PieChart, Pie, RadialBarChart, RadialBar
} from "recharts";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";
const C   = { bg:"#060c14", surface:"#0d1a2b", surface2:"#112035",
              supply:"#00c2ff", cons:"#00ff88", leak:"#ff4d6d",
              warn:"#ffb800", muted:"#6a8aaa", purple:"#a855f7" };

const HORIZON_LABELS = {
  1:"1-Day",7:"7-Day",30:"30-Day",60:"60-Day",
  90:"90-Day",180:"180-Day",365:"1-Year"
};

// ── Helpers ─────────────────────────────────────────────────
const avg   = (arr, key) => arr.length ? arr.reduce((a,r)=>a+(r[key]||0),0)/arr.length : 0;
const round2 = v => Math.round(v * 100) / 100;

function getLevel(pct) {
  if (pct >= 20) return { label:"CRITICAL", color:"#ff2d55" };
  if (pct >= 15) return { label:"HIGH",     color:C.leak };
  if (pct >= 10) return { label:"MODERATE", color:C.warn };
  return           { label:"NORMAL",   color:C.cons };
}

// ── Tooltip ─────────────────────────────────────────────────
const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#0a1628", border:"1px solid rgba(0,194,255,0.3)",
      borderRadius:8, padding:"12px 16px", fontSize:12, minWidth:160 }}>
      <div style={{ color:"white", fontWeight:700, marginBottom:6,
        borderBottom:"1px solid rgba(255,255,255,0.1)", paddingBottom:5 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color:p.color, marginBottom:3,
          display:"flex", justifyContent:"space-between", gap:16 }}>
          <span>{p.name}</span>
          <b>{typeof p.value==="number" ? p.value.toFixed(3) : p.value}</b>
        </div>
      ))}
    </div>
  );
};

// ── Gauge ────────────────────────────────────────────────────
const Gauge = ({ value }) => {
  const pct   = Math.min(value||0, 25);
  const color = pct>15?C.leak:pct>10?C.warn:C.cons;
  const data  = [{ value:pct, fill:color },{ value:25-pct, fill:"rgba(255,255,255,0.04)" }];
  return (
    <div style={{ textAlign:"center" }}>
      <ResponsiveContainer width="100%" height={150}>
        <RadialBarChart cx="50%" cy="75%" innerRadius="55%" outerRadius="85%"
          startAngle={180} endAngle={0} data={data}>
          <RadialBar dataKey="value" cornerRadius={8}
            background={{ fill:"rgba(255,255,255,0.03)" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ marginTop:-42, color, fontSize:"2rem", fontWeight:800, fontFamily:"monospace" }}>
        {(value||0).toFixed(1)}%
      </div>
      <div style={{ color:C.muted, fontSize:10, marginTop:2 }}>Avg Leakage</div>
      <div style={{ marginTop:8 }}>
        <span style={{ background:`${color}18`, color, padding:"3px 12px",
          borderRadius:20, fontSize:11, fontWeight:700,
          border:`1px solid ${color}44` }}>
          {pct>15?"⚠ HIGH":pct>10?"⚡ MODERATE":"✓ NORMAL"}
        </span>
      </div>
    </div>
  );
};

// ── KPI card ─────────────────────────────────────────────────
const KPI = ({ label, value, unit, color, icon, sub }) => (
  <div style={{ background:C.surface, border:`1px solid rgba(0,212,255,0.1)`,
    borderTop:`3px solid ${color}`, borderRadius:10, padding:"16px 18px",
    flex:1, minWidth:140, position:"relative", overflow:"hidden" }}>
    <div style={{ position:"absolute", right:12, top:12, fontSize:22, opacity:0.15 }}>{icon}</div>
    <div style={{ color:C.muted, fontSize:10, letterSpacing:2,
      textTransform:"uppercase", marginBottom:7 }}>{label}</div>
    <div style={{ color, fontSize:"clamp(1.3rem,2.5vw,1.8rem)", fontWeight:800, fontFamily:"monospace", lineHeight:1 }}>
      {value ?? "—"}
      {unit && <span style={{ fontSize:"0.75rem", marginLeft:4, fontWeight:500 }}>{unit}</span>}
    </div>
    {sub && <div style={{ color:C.muted, fontSize:11, marginTop:5 }}>{sub}</div>}
  </div>
);

// ── Section header ────────────────────────────────────────────
const SH = ({ icon, title, sub, badge }) => (
  <div style={{ marginBottom:12 }}>
    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
      <h3 style={{ margin:0, fontSize:13, fontWeight:700, color:"#ccd6f6" }}>
        {icon} {title}
      </h3>
      {badge && (
        <span style={{ background:"rgba(0,194,255,0.12)",
          border:"1px solid rgba(0,194,255,0.3)", color:C.supply,
          fontSize:10, padding:"2px 10px", borderRadius:12, fontWeight:700 }}>
          {badge}
        </span>
      )}
    </div>
    {sub && <p style={{ margin:"4px 0 0", fontSize:11, color:C.muted }}>{sub}</p>}
  </div>
);

// ── Pie label ────────────────────────────────────────────────
const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
  const R = Math.PI/180;
  const r = innerRadius+(outerRadius-innerRadius)*0.5;
  const x = cx+r*Math.cos(-midAngle*R);
  const y = cy+r*Math.sin(-midAngle*R);
  return <text x={x} y={y} fill="white" textAnchor="middle"
    dominantBaseline="central" fontSize={11} fontWeight={700}>{value.toFixed(1)}%</text>;
};

// ════════════════════════════════════════════════════════════
export default function AnalyticsDashboard() {
  const { user }      = useAuth();
  const { cityForecast, forecastDays, forecastedAt } = useForecast();

  const [defaultData, setDefaultData] = useState([]);  // 30-day default
  const [hist, setHist]               = useState([]);
  const [metrics, setMetrics]         = useState([]);
  const [summary, setSummary]         = useState({});
  const [loading, setLoading]         = useState(true);

  // Load default 30-day + historical + metrics on mount
  useEffect(() => {
    if (!user?.token) return;
    axios.defaults.headers.common["Authorization"] = `Bearer ${user.token}`;
    Promise.all([
      axios.get(`${API}/predict/city/30`),
      axios.get(`${API}/historical/city`),
      axios.get(`${API}/metrics`),
      axios.get(`${API}/summary`),
    ]).then(([c, h, m, s]) => {
      setDefaultData(c.data);
      setHist(h.data);
      setMetrics(m.data);
      setSummary(s.data);
    }).finally(() => setLoading(false));
  }, [user]);

  // Use cityForecast from Dashboard if available, else default 30-day
  const activeData = (cityForecast && cityForecast.length > 0) ? cityForecast : defaultData;
  const activeDays = forecastDays || 30;
  const horizonLabel = HORIZON_LABELS[activeDays] || `${activeDays}-Day`;
  const isLive = cityForecast && cityForecast.length > 0;

  // ── Derived values ────────────────────────────────────────
  const avgSupply  = round2(avg(activeData, "Predicted_Supply_MLD"));
  const avgCons    = round2(avg(activeData, "Predicted_Consumption_MLD"));
  const avgLeak    = round2(avg(activeData, "Predicted_Leakage_MLD"));
  const avgLeakPct = round2(avg(activeData, "Leakage_Percentage"));

  // Sample for chart clarity
  const sample = activeDays <= 30  ? activeData
    : activeDays <= 90  ? activeData.filter((_,i)=>i%3===0)
    : activeDays <= 180 ? activeData.filter((_,i)=>i%7===0)
    : activeData.filter((_,i)=>i%14===0);

  const chartData = sample.map(r => ({
    date:        r.Date.slice(5),
    Supply:      r.Predicted_Supply_MLD,
    Consumption: r.Predicted_Consumption_MLD,
    Leakage:     r.Predicted_Leakage_MLD,
    "Leakage%":  r.Leakage_Percentage,
  }));

  // Monthly aggregates from historical
  const monthMap = {};
  hist.forEach(r => {
    const m = r.Date.slice(0,7);
    if (!monthMap[m]) monthMap[m] = { supply:[],cons:[],leak:[] };
    monthMap[m].supply.push(r.Water_Supplied_MLD||0);
    monthMap[m].cons.push(r.Water_Consumed_MLD||0);
    monthMap[m].leak.push(r.Leakage_MLD||0);
  });
  const monthlyData = Object.entries(monthMap).map(([m,v])=>({
    month: m.slice(2),
    Supply:      round2(v.supply.reduce((a,b)=>a+b,0)/v.supply.length),
    Consumption: round2(v.cons.reduce((a,b)=>a+b,0)/v.cons.length),
    Leakage:     round2(v.leak.reduce((a,b)=>a+b,0)/v.leak.length),
  }));

  // Pie
  const pieData = avgSupply > 0 ? [
    { name:"Consumed", value:round2((avgCons/avgSupply)*100), fill:C.cons },
    { name:"Leakage",  value:round2((avgLeak/avgSupply)*100), fill:C.leak },
  ] : [];

  // Ward R² bars
  const wardR2 = metrics.map(m=>({
    ward: m.Ward_Name.replace("New Panvel","N.Panvel"),
    r2:   parseFloat(m.Supply_R2.toFixed(4)),
    fill: m.Supply_R2>0.999?C.cons:m.Supply_R2>0.995?C.supply:C.warn,
  }));

  // Alert counts from forecast
  const alertCounts = {
    CRITICAL: activeData.filter(d=>d.Leakage_Percentage>=20).length,
    HIGH:     activeData.filter(d=>d.Leakage_Percentage>=15&&d.Leakage_Percentage<20).length,
    MODERATE: activeData.filter(d=>d.Leakage_Percentage>=10&&d.Leakage_Percentage<15).length,
    NORMAL:   activeData.filter(d=>d.Leakage_Percentage<10).length,
  };

  // Best/worst days
  const peakLeakDay  = activeData.length ? activeData.reduce((a,b)=>a.Leakage_Percentage>b.Leakage_Percentage?a:b) : null;
  const lowestLeak   = activeData.length ? activeData.reduce((a,b)=>a.Leakage_Percentage<b.Leakage_Percentage?a:b) : null;

  const acc = summary.Model_Accuracy || {};

  if (loading) return (
    <div style={{ background:C.bg, minHeight:"100vh", display:"flex",
      alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>💧</div>
        <div style={{ color:C.supply, fontFamily:"monospace", fontSize:14 }}>
          Loading Analytics Dashboard...
        </div>
      </div>
    </div>
  );

  return (
    <>
    <style>{`* { box-sizing: border-box; } .recharts-legend-wrapper { font-size: 11px; }`}</style>
    <div style={{ background:C.bg, minHeight:"100vh", padding:"clamp(16px,3vw,24px)",
      color:"white", fontFamily:"'Syne',sans-serif" }}>

      {/* ── Dynamic header ───────────────────────────────── */}
      <div style={{ marginBottom:20, display:"flex",
        justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ margin:"0 0 4px", fontSize:"clamp(1.1rem,3vw,1.4rem)", fontWeight:800,
            display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            📊 Analytics Dashboard
            <span style={{ background: isLive?"rgba(0,255,136,0.15)":"rgba(0,194,255,0.1)",
              border:`1px solid ${isLive?"rgba(0,255,136,0.4)":"rgba(0,194,255,0.3)"}`,
              color: isLive?C.cons:C.supply,
              fontSize:12, padding:"3px 12px", borderRadius:20, fontWeight:700 }}>
              {isLive ? `🟢 LIVE · ${horizonLabel} Forecast` : "📋 Default · 30-Day Forecast"}
            </span>
          </h2>
          <p style={{ color:C.muted, fontSize:12, margin:0 }}>
            {isLive
              ? `Updated from City Forecast · ${activeDays} days · ${activeData[0]?.Date} → ${activeData[activeData.length-1]?.Date} · ${forecastedAt?.toLocaleTimeString()}`
              : "Go to City Forecast → select horizon → click PREDICT to update this dashboard live"}
          </p>
        </div>
        <div style={{ background:C.surface, border:"1px solid rgba(0,194,255,0.15)",
          borderRadius:8, padding:"8px 14px", fontSize:11, color:C.supply,
          display:"flex", alignItems:"center", gap:8 }}>
          <span>🤖</span>
          <span>GBR · R² = {acc.City_Supply_R2?.toFixed(4)}</span>
        </div>
      </div>

      {/* ── Live hint banner (shown only when no live forecast yet) ── */}
      {!isLive && (
        <div style={{ background:"rgba(0,194,255,0.06)", border:"1px solid rgba(0,194,255,0.2)",
          borderRadius:8, padding:"12px 18px", marginBottom:20,
          display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          <span style={{ fontSize:20 }}>💡</span>
          <div>
            <div style={{ color:C.supply, fontWeight:700, fontSize:12 }}>
              This dashboard updates dynamically!
            </div>
            <div style={{ color:C.muted, fontSize:11, marginTop:2 }}>
              Go to <b style={{ color:"white" }}>🏙 City Forecast</b> → choose any horizon
              (7 Days, 60 Days, 1 Year...) → click <b style={{ color:"white" }}>▶ PREDICT</b>
              → come back here to see all charts update automatically.
            </div>
          </div>
        </div>
      )}

      {/* ── Forecast summary alert strip ─────────────────── */}
      {isLive && (alertCounts.CRITICAL + alertCounts.HIGH) > 0 && (
        <div style={{ background:"rgba(255,77,109,0.08)", border:"1px solid rgba(255,77,109,0.25)",
          borderRadius:8, padding:"12px 18px", marginBottom:20,
          display:"flex", gap:16, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:20 }}>🚨</span>
          <div style={{ flex:1 }}>
            <div style={{ color:C.leak, fontWeight:700, fontSize:12 }}>
              Leakage Alert — {horizonLabel} Forecast
            </div>
            <div style={{ color:C.muted, fontSize:11, marginTop:2 }}>
              {alertCounts.CRITICAL>0 && <span style={{ color:"#ff2d55", marginRight:12 }}>🚨 {alertCounts.CRITICAL} CRITICAL days (≥20%)</span>}
              {alertCounts.HIGH>0 && <span style={{ color:C.leak, marginRight:12 }}>⚠️ {alertCounts.HIGH} HIGH days (≥15%)</span>}
              {alertCounts.MODERATE>0 && <span style={{ color:C.warn }}>⚡ {alertCounts.MODERATE} MODERATE days (≥10%)</span>}
            </div>
          </div>
          {peakLeakDay && (
            <div style={{ textAlign:"right" }}>
              <div style={{ color:C.muted, fontSize:10 }}>Peak day</div>
              <div style={{ color:"#ff2d55", fontWeight:700, fontFamily:"monospace", fontSize:12 }}>
                {peakLeakDay.Date} · {peakLeakDay.Leakage_Percentage}%
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── KPI Row ───────────────────────────────────────── */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
        <KPI label={`${horizonLabel} Avg Supply`}      value={avgSupply}   unit="MLD" color={C.supply} icon="🏗" sub={`${activeData.length} days forecast`} />
        <KPI label={`${horizonLabel} Avg Consumption`} value={avgCons}     unit="MLD" color={C.cons}   icon="🏠" sub="Predicted usage" />
        <KPI label={`${horizonLabel} Avg Leakage`}     value={avgLeak}     unit="MLD" color={C.leak}   icon="💧" sub="Water loss/day" />
        <KPI label="Avg Leakage Rate"                  value={`${avgLeakPct}%`}       color={C.warn}   icon="📉" sub="Of total supply" />
        <KPI label="Historical Avg Supply"             value={summary.Avg_Daily_Supply_MLD} unit="MLD" color={C.supply} icon="📅" sub="Sep 2025–Feb 2026" />
        <KPI label="Model R²"                          value={acc.City_Supply_R2?.toFixed(4)} color={C.cons} icon="🤖" sub="Gradient Boosting" />
      </div>

      {/* ── Forecast period insight cards ─────────────────── */}
      {isLive && peakLeakDay && lowestLeak && (
        <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
          {[
            { label:"📅 Forecast Period", value:`${activeData[0]?.Date} → ${activeData[activeData.length-1]?.Date}`,
              color:C.supply, sub:`${activeDays} days total` },
            { label:"🔴 Peak Leakage Day", value:peakLeakDay.Date,
              color:"#ff2d55", sub:`${peakLeakDay.Leakage_Percentage}% — ${peakLeakDay.Predicted_Leakage_MLD} MLD` },
            { label:"✅ Best Day",         value:lowestLeak.Date,
              color:C.cons, sub:`${lowestLeak.Leakage_Percentage}% — ${lowestLeak.Predicted_Leakage_MLD} MLD` },
            { label:"⚡ Alert Days",       value:`${alertCounts.CRITICAL+alertCounts.HIGH+alertCounts.MODERATE}`,
              color:alertCounts.CRITICAL>0?"#ff2d55":alertCounts.HIGH>0?C.leak:C.warn,
              sub:`of ${activeDays} total days` },
          ].map(k => (
            <div key={k.label} style={{ background:C.surface, border:`1px solid rgba(0,212,255,0.1)`,
              borderLeft:`3px solid ${k.color}`, borderRadius:8,
              padding:"12px 16px", flex:1, minWidth:180 }}>
              <div style={{ color:C.muted, fontSize:10, letterSpacing:1,
                textTransform:"uppercase", marginBottom:5 }}>{k.label}</div>
              <div style={{ color:k.color, fontWeight:700, fontSize:13,
                fontFamily:"monospace" }}>{k.value}</div>
              <div style={{ color:C.muted, fontSize:11, marginTop:3 }}>{k.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Row 1: Area chart + Gauge + Pie ──────────────── */}
      <div style={{ display:"grid",
        gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))",
        gap:16, marginBottom:16 }}>

        {/* Area chart */}
        <div style={{ background:C.surface, borderRadius:10, padding:20,
          border:"1px solid rgba(0,212,255,0.1)", gridColumn:"span 2" }}>
          <SH icon="📈"
            title={`${horizonLabel} Supply & Consumption Forecast`}
            badge={isLive ? "LIVE" : "DEFAULT"}
            sub={activeData.length > 30 ? `Sampled every ${activeDays<=90?3:activeDays<=180?7:14} days for clarity` : "Daily values"} />
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top:10, right:10, bottom:0, left:0 }}>
              <defs>
                <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.supply} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.supply} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.cons} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={C.cons} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill:C.muted, fontSize:10 }} tickLine={false}
                interval={Math.floor(chartData.length/8)} />
              <YAxis tick={{ fill:C.muted, fontSize:10 }} tickLine={false} unit=" MLD" />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ color:C.muted, fontSize:11 }} />
              <Area type="monotone" dataKey="Supply" stroke={C.supply}
                fill="url(#gS)" strokeWidth={2.5} dot={false} activeDot={{ r:5 }} />
              <Area type="monotone" dataKey="Consumption" stroke={C.cons}
                fill="url(#gC)" strokeWidth={2.5} dot={false} activeDot={{ r:5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Gauge */}
        <div style={{ background:C.surface, borderRadius:10, padding:20,
          border:"1px solid rgba(0,212,255,0.1)", display:"flex",
          flexDirection:"column", justifyContent:"center" }}>
          <SH icon="💧" title="Leakage Rate" badge={horizonLabel} />
          <Gauge value={avgLeakPct} />
          <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:5 }}>
            {[
              { label:"Target",  value:"< 10%",                 color:C.cons },
              { label:"Current", value:`${avgLeakPct}%`,         color:C.warn },
              { label:"Status",  value:getLevel(avgLeakPct).label, color:getLevel(avgLeakPct).color },
            ].map(r => (
              <div key={r.label} style={{ display:"flex", justifyContent:"space-between",
                fontSize:12, borderBottom:"1px solid rgba(255,255,255,0.05)", paddingBottom:4 }}>
                <span style={{ color:C.muted }}>{r.label}</span>
                <span style={{ color:r.color, fontWeight:700 }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pie */}
        <div style={{ background:C.surface, borderRadius:10, padding:20,
          border:"1px solid rgba(0,212,255,0.1)" }}>
          <SH icon="🥧" title="Water Distribution" badge={horizonLabel}
            sub="% of total predicted supply" />
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={65}
                dataKey="value" labelLine={false} label={PieLabel}>
                {pieData.map((entry,i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip formatter={(v)=>`${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display:"flex", justifyContent:"center", gap:20, marginTop:4 }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:d.fill }} />
                <span style={{ color:C.muted, fontSize:11 }}>
                  {d.name} <b style={{ color:"white" }}>{d.value}%</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: Leakage bars + Historical ─────────────── */}
      <div style={{ display:"grid",
        gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",
        gap:16, marginBottom:16 }}>

        {/* Leakage bar */}
        <div style={{ background:C.surface, borderRadius:10, padding:20,
          border:"1px solid rgba(0,212,255,0.1)" }}>
          <SH icon="🔴"
            title={`${horizonLabel} Leakage Forecast`}
            badge={isLive?"LIVE":"DEFAULT"}
            sub="Values shown above bars in MLD" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top:20, right:10, bottom:0, left:0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill:C.muted, fontSize:9 }} tickLine={false}
                interval={Math.floor(chartData.length/8)} />
              <YAxis tick={{ fill:C.muted, fontSize:10 }} tickLine={false} unit=" MLD" />
              <Tooltip content={<Tip />} />
              <Bar dataKey="Leakage" name="Leakage MLD" radius={[4,4,0,0]}>
                <LabelList dataKey="Leakage" position="top"
                  formatter={v=>v.toFixed(1)}
                  style={{ fill:"white", fontSize:9, fontFamily:"monospace" }} />
                {chartData.map((entry,i) => (
                  <Cell key={i}
                    fill={entry["Leakage%"]>=20?"#ff2d55":entry["Leakage%"]>=15?C.leak:entry["Leakage%"]>=10?C.warn:C.cons} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Historical monthly */}
        <div style={{ background:C.surface, borderRadius:10, padding:20,
          border:"1px solid rgba(0,212,255,0.1)" }}>
          <SH icon="📅" title="Historical Monthly Averages"
            sub="Sep 2025 – Feb 2026 · Actual recorded data" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} margin={{ top:20, right:10, bottom:0, left:0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill:C.muted, fontSize:11 }} tickLine={false} />
              <YAxis tick={{ fill:C.muted, fontSize:10 }} tickLine={false} unit=" MLD" />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ color:C.muted, fontSize:11 }} />
              <Bar dataKey="Supply"      fill={C.supply} radius={[3,3,0,0]} name="Supply">
                <LabelList dataKey="Supply" position="top"
                  formatter={v=>v.toFixed(0)}
                  style={{ fill:C.supply, fontSize:9, fontFamily:"monospace" }} />
              </Bar>
              <Bar dataKey="Consumption" fill={C.cons}   radius={[3,3,0,0]} name="Consumption" />
              <Bar dataKey="Leakage"     fill={C.leak}   radius={[3,3,0,0]} name="Leakage" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 3: Leakage % line + Ward R² ──────────────── */}
      <div style={{ display:"grid",
        gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",
        gap:16, marginBottom:16 }}>

        {/* Leakage % trend line */}
        <div style={{ background:C.surface, borderRadius:10, padding:20,
          border:"1px solid rgba(0,212,255,0.1)" }}>
          <SH icon="📉"
            title={`Leakage % Trend · ${horizonLabel}`}
            badge={isLive?"LIVE":"DEFAULT"}
            sub="How leakage rate changes over forecast period" />
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top:15, right:10, bottom:0, left:0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill:C.muted, fontSize:10 }} tickLine={false}
                interval={Math.floor(chartData.length/8)} />
              <YAxis tick={{ fill:C.muted, fontSize:10 }} tickLine={false} unit="%" />
              <Tooltip content={<Tip />} />
              <Line type="monotone" dataKey="Leakage%" stroke={C.warn}
                strokeWidth={2.5} dot={chartData.length<=30?{ fill:C.warn, r:3 }:false}
                activeDot={{ r:5 }} name="Leakage%">
                {chartData.length <= 30 && (
                  <LabelList dataKey="Leakage%" position="top"
                    formatter={v=>`${v.toFixed(1)}%`}
                    style={{ fill:C.warn, fontSize:9, fontFamily:"monospace" }} />
                )}
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Ward R² */}
        <div style={{ background:C.surface, borderRadius:10, padding:20,
          border:"1px solid rgba(0,212,255,0.1)" }}>
          <SH icon="🎯" title="Ward Model Accuracy (Supply R²)"
            sub="All 20 wards · Green = excellent (>0.999)" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={wardR2} layout="vertical"
              margin={{ top:0, right:55, bottom:0, left:70 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" domain={[0.95,1]}
                tick={{ fill:C.muted, fontSize:9 }} tickLine={false} />
              <YAxis type="category" dataKey="ward"
                tick={{ fill:C.muted, fontSize:9 }} tickLine={false} width={70} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="r2" name="R²" radius={[0,4,4,0]}>
                <LabelList dataKey="r2" position="right"
                  formatter={v=>v.toFixed(4)}
                  style={{ fill:"white", fontSize:9, fontFamily:"monospace" }} />
                {wardR2.map((entry,i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Full metrics table ───────────────────────────── */}
      <div style={{ background:C.surface, borderRadius:10, padding:20,
        border:"1px solid rgba(0,212,255,0.1)", marginBottom:16 }}>
        <SH icon="📋" title="Complete Model Performance — All 20 Wards"
          sub={`Supply R² > 0.997 for all wards · Showing accuracy metrics · ${horizonLabel} context`} />
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:580 }}>
            <thead>
              <tr style={{ borderBottom:"2px solid rgba(0,212,255,0.2)" }}>
                {["#","Ward Name","Supply R²","Consumption R²","Leakage R²","MAE (MLD)","Grade"].map(h => (
                  <th key={h} style={{ padding:"10px 12px", textAlign:"left",
                    color:C.supply, fontFamily:"monospace", fontSize:10,
                    letterSpacing:1, fontWeight:700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((row,i) => {
                const grade = row.Supply_R2>0.999?"A+":row.Supply_R2>0.998?"A":row.Supply_R2>0.997?"B+":"B";
                const gc = grade==="A+"?C.cons:grade==="A"?C.supply:C.warn;
                return (
                  <tr key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.05)",
                    background: i%2?C.surface2:"transparent" }}>
                    <td style={{ padding:"9px 12px", color:C.muted, fontFamily:"monospace" }}>{row.Ward_No}</td>
                    <td style={{ padding:"9px 12px", fontWeight:600 }}>{row.Ward_Name}</td>
                    <td style={{ padding:"9px 12px", fontFamily:"monospace", fontWeight:700,
                      color:row.Supply_R2>0.999?C.cons:row.Supply_R2>0.997?C.supply:C.warn }}>
                      {row.Supply_R2?.toFixed(4)}</td>
                    <td style={{ padding:"9px 12px", fontFamily:"monospace", fontWeight:700,
                      color:row.Consumption_R2>0.999?C.cons:C.supply }}>
                      {row.Consumption_R2?.toFixed(4)}</td>
                    <td style={{ padding:"9px 12px", fontFamily:"monospace", fontWeight:700,
                      color:row.Leakage_R2>0.97?C.cons:row.Leakage_R2>0.95?C.warn:C.leak }}>
                      {row.Leakage_R2?.toFixed(4)}</td>
                    <td style={{ padding:"9px 12px", fontFamily:"monospace", color:C.muted }}>
                      {row.Supply_MAE?.toFixed(5)}</td>
                    <td style={{ padding:"9px 12px" }}>
                      <span style={{ background:`${gc}22`, border:`1px solid ${gc}55`,
                        color:gc, padding:"2px 10px", borderRadius:4,
                        fontWeight:800, fontSize:11 }}>{grade}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Methodology ──────────────────────────────────── */}
      <div style={{ background:C.surface, border:"1px solid rgba(0,194,255,0.12)",
        borderRadius:10, padding:"clamp(16px,3vw,20px)" }}>
        <div style={{ color:C.supply, fontWeight:700, fontSize:13, marginBottom:12 }}>
          🔬 Model Methodology Summary
        </div>
        <div style={{ display:"grid",
          gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:12 }}>
          {[
            { label:"Algorithm",        value:"Gradient Boosting Regressor",          color:C.supply },
            { label:"Key Innovation",   value:"Predict daily diff → rolling chain",   color:C.cons },
            { label:"Extended Forecast",value:`Up to 365 days · ${horizonLabel} selected`, color:C.warn },
            { label:"Features",         value:"21 per model (lags + cyclical)",        color:C.purple },
            { label:"Models Trained",   value:"63 (3 city + 60 ward)",               color:C.supply },
            { label:"Data Period",      value:"Sep 2025 – Feb 2026 (181 days)",       color:C.cons },
            { label:"Train/Test Split", value:"80% train / 20% test (chronological)", color:C.warn },
            { label:"Best City R²",     value:acc.City_Supply_R2?.toFixed(6),         color:C.cons },
          ].map(item => (
            <div key={item.label} style={{ background:C.surface2, borderRadius:6,
              padding:"10px 14px", borderLeft:`3px solid ${item.color}` }}>
              <div style={{ color:C.muted, fontSize:10, letterSpacing:1, marginBottom:3 }}>
                {item.label}
              </div>
              <div style={{ color:"white", fontSize:12, fontWeight:600 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
