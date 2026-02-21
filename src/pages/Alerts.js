import { useEffect, useState } from "react";
import { useNotifications } from "../context/NotificationContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid,
         Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";
const C   = { bg:"#060c14", surface:"#0d1a2b", surface2:"#112035",
              supply:"#00c2ff", cons:"#00ff88", leak:"#ff4d6d",
              warn:"#ffb800", muted:"#6a8aaa", purple:"#a855f7" };

const LEVEL_CFG = {
  CRITICAL: { color:"#ff2d55", bg:"rgba(255,45,85,0.12)",  border:"rgba(255,45,85,0.4)",  icon:"🚨" },
  HIGH:     { color:"#ff4d6d", bg:"rgba(255,77,109,0.1)",  border:"rgba(255,77,109,0.35)",icon:"⚠️" },
  MODERATE: { color:"#ffb800", bg:"rgba(255,184,0,0.1)",   border:"rgba(255,184,0,0.35)", icon:"⚡" },
  SUCCESS:  { color:"#00ff88", bg:"rgba(0,255,136,0.08)",  border:"rgba(0,255,136,0.25)", icon:"✅" },
  INFO:     { color:"#00c2ff", bg:"rgba(0,194,255,0.08)",  border:"rgba(0,194,255,0.25)", icon:"ℹ️" },
};

function timeAgo(date) {
  const s = Math.floor((new Date() - new Date(date)) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

function NotifCard({ notif, isNew }) {
  const cfg = LEVEL_CFG[notif.level] || LEVEL_CFG.INFO;
  return (
    <div style={{ background: cfg.bg,
      border: `1px solid ${isNew ? cfg.color+"66" : cfg.border}`,
      borderLeft: `4px solid ${cfg.color}`,
      borderRadius: 8, padding: "13px 16px",
      opacity: notif.read ? 0.75 : 1,
      transition: "all 0.3s",
      position: "relative",
    }}>
      {/* Unread dot */}
      {!notif.read && (
        <div style={{ position:"absolute", top:10, right:12,
          width:8, height:8, borderRadius:"50%",
          background: cfg.color,
          boxShadow:`0 0 6px ${cfg.color}`,
          animation:"blinkDot 1.5s infinite" }} />
      )}

      <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
        <span style={{ fontSize:18, flexShrink:0 }}>{cfg.icon}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8,
            marginBottom:4, flexWrap:"wrap" }}>
            <span style={{ color:cfg.color, fontWeight:800,
              fontSize:11, letterSpacing:1 }}>{notif.level}</span>
            {notif.wardNo && (
              <span style={{ background:`${cfg.color}22`,
                border:`1px solid ${cfg.color}44`,
                color:cfg.color, fontSize:10, padding:"1px 8px",
                borderRadius:20, fontWeight:700 }}>
                Ward {notif.wardNo}
              </span>
            )}
            {notif.days && (
              <span style={{ background:"rgba(255,255,255,0.06)",
                color:C.muted, fontSize:10, padding:"1px 8px",
                borderRadius:20 }}>
                {notif.days}d forecast
              </span>
            )}
            <span style={{ color:C.muted, fontSize:10, marginLeft:"auto" }}>
              {timeAgo(notif.timestamp)}
            </span>
          </div>
          <div style={{ color:"white", fontSize:13,
            fontWeight:600, marginBottom:3 }}>
            {notif.wardName}
          </div>
          <div style={{ color:"#ccd6f6", fontSize:12, lineHeight:1.5 }}>
            {notif.message}
          </div>
          {notif.detail && (
            <div style={{ color:C.muted, fontSize:11, marginTop:4 }}>
              {notif.detail}
            </div>
          )}
          {notif.avgPct && (
            <div style={{ display:"flex", gap:16, marginTop:8, flexWrap:"wrap" }}>
              {[
                { label:"Avg Leakage", value:`${notif.avgPct.toFixed(1)}%`, color:cfg.color },
                { label:"Peak",        value:`${notif.maxPct?.toFixed(1)}%`, color:"#ff2d55" },
                { label:"Peak Date",   value:notif.peakDate, color:C.muted },
                { label:"Days > threshold", value:`${notif.daysExc}/${notif.days}`, color:C.warn },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ color:C.muted, fontSize:9, letterSpacing:1 }}>{s.label}</div>
                  <div style={{ color:s.color, fontWeight:700,
                    fontFamily:"monospace", fontSize:12 }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Alerts() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const [filter, setFilter]     = useState("ALL");
  const [wardChart, setWardChart] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);

  // Mark all as read as soon as user opens this page
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  // Load current ward leakage chart from API
  useEffect(() => {
    if (!user?.token) return;
    setChartLoading(true);
    axios.defaults.headers.common["Authorization"] = `Bearer ${user.token}`;
    axios.get(`${API}/alerts/scan?threshold=10&days=30`)
      .then(r => {
        setWardChart(r.data.map(w => ({
          name:  w.Ward_Name.replace("New Panvel","N.Panvel"),
          value: parseFloat(w.Avg_Leakage_Pct.toFixed(2)),
          level: w.Level,
          fill:  w.Level==="CRITICAL"?"#ff2d55":w.Level==="HIGH"?"#ff4d6d":
                 w.Level==="MODERATE"?"#ffb800":"#00ff88",
        })))
      })
      .finally(() => setChartLoading(false));
  }, [user]);

  const counts = {
    CRITICAL: notifications.filter(n=>n.level==="CRITICAL").length,
    HIGH:     notifications.filter(n=>n.level==="HIGH").length,
    MODERATE: notifications.filter(n=>n.level==="MODERATE").length,
    SUCCESS:  notifications.filter(n=>n.level==="SUCCESS").length,
    INFO:     notifications.filter(n=>n.level==="INFO").length,
  };

  const filtered = notifications.filter(n => {
    if (filter==="ALL") return true;
    return n.level === filter;
  });

  const newCount = notifications.filter(n=>!n.read).length; // will be 0 after markAllRead

  return (
    <div style={{ background:C.bg, minHeight:"100vh",
      padding:"clamp(16px,3vw,28px)", color:"white",
      fontFamily:"'Syne',sans-serif" }}>
      <style>{`
        * { box-sizing:border-box; }
        @keyframes blinkDot {
          0%,100% { opacity:1; } 50% { opacity:0.3; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", flexWrap:"wrap", gap:12, marginBottom:20 }}>
        <div>
          <h2 style={{ margin:"0 0 4px", fontSize:"clamp(1.1rem,3vw,1.4rem)",
            fontWeight:800, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            🔔 Alert Notifications
            {notifications.length > 0 && (
              <span style={{ background:"rgba(255,77,109,0.15)",
                border:"1px solid rgba(255,77,109,0.4)", color:C.leak,
                fontSize:12, padding:"2px 12px", borderRadius:20, fontWeight:700 }}>
                {notifications.length} total
              </span>
            )}
            <span style={{ background:"rgba(0,255,136,0.1)",
              border:"1px solid rgba(0,255,136,0.3)", color:C.cons,
              fontSize:11, padding:"2px 10px", borderRadius:20, fontWeight:700 }}>
              ✓ All read
            </span>
          </h2>
          <p style={{ color:C.muted, fontSize:12, margin:0 }}>
            Notifications fire dynamically per ward as each forecast scan completes ·
            Bell resets to 0 when you open this page
          </p>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {notifications.length > 0 && (
            <button onClick={clearAll}
              style={{ background:"rgba(255,77,109,0.1)",
                border:"1px solid rgba(255,77,109,0.3)",
                color:C.leak, padding:"8px 14px", borderRadius:5,
                cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit" }}>
              🗑 Clear All
            </button>
          )}
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:20 }}>
        {[
          { key:"ALL",      label:"All",       count:notifications.length, color:C.supply },
          { key:"CRITICAL", label:"Critical",  count:counts.CRITICAL,      color:"#ff2d55" },
          { key:"HIGH",     label:"High",      count:counts.HIGH,          color:C.leak },
          { key:"MODERATE", label:"Moderate",  count:counts.MODERATE,      color:C.warn },
          { key:"SUCCESS",  label:"All Clear", count:counts.SUCCESS,        color:C.cons },
          { key:"INFO",     label:"Info",      count:counts.INFO,           color:C.supply },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ background: filter===f.key ? `${f.color}18`:"rgba(255,255,255,0.04)",
              border:`1px solid ${filter===f.key ? f.color+"55":"rgba(255,255,255,0.1)"}`,
              color: filter===f.key ? f.color : C.muted,
              padding:"6px 14px", borderRadius:20, cursor:"pointer",
              fontSize:12, fontWeight:700, fontFamily:"inherit",
              display:"flex", alignItems:"center", gap:6, transition:"all 0.2s" }}>
            {f.label}
            <span style={{ background:`${f.color}22`, color:f.color,
              fontSize:10, fontWeight:800, padding:"1px 7px",
              borderRadius:10 }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Ward leakage bar chart */}
      {!chartLoading && wardChart.length > 0 && (
        <div style={{ background:C.surface, borderRadius:10,
          padding:"clamp(12px,3vw,20px)", marginBottom:20,
          border:"1px solid rgba(0,212,255,0.1)" }}>
          <div style={{ marginBottom:10 }}>
            <h3 style={{ margin:"0 0 4px", fontSize:13, color:"#ccd6f6" }}>
              📊 Current Ward Leakage — 30-Day Avg (Live from API)
            </h3>
            <p style={{ margin:0, color:C.muted, fontSize:11 }}>
              Threshold lines at 10% / 15% / 20%
            </p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={wardChart} margin={{ top:10, right:20, bottom:50, left:0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false}/>
              <XAxis dataKey="name" tick={{ fill:C.muted, fontSize:9 }}
                tickLine={false} angle={-35} textAnchor="end" interval={0}/>
              <YAxis tick={{ fill:C.muted, fontSize:10 }} tickLine={false} unit="%"/>
              <Tooltip
                contentStyle={{ background:C.surface2,
                  border:"1px solid rgba(0,212,255,0.2)",
                  borderRadius:8, fontSize:12 }}
                formatter={v=>[`${v}%`,"Avg Leakage"]}
                labelStyle={{ color:"white" }}/>
              <ReferenceLine y={10} stroke={C.warn}    strokeDasharray="4 4"
                label={{ value:"10%", fill:C.warn, fontSize:10, position:"right" }}/>
              <ReferenceLine y={15} stroke={C.leak}    strokeDasharray="4 4"
                label={{ value:"15%", fill:C.leak, fontSize:10, position:"right" }}/>
              <ReferenceLine y={20} stroke="#ff2d55"   strokeDasharray="4 4"
                label={{ value:"20%", fill:"#ff2d55", fontSize:10, position:"right" }}/>
              <Bar dataKey="value" radius={[4,4,0,0]} name="Leakage %">
                {wardChart.map((e,i)=><Cell key={i} fill={e.fill}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Notification list */}
      {notifications.length === 0 ? (
        <div style={{ background:"rgba(0,194,255,0.06)",
          border:"1px solid rgba(0,194,255,0.15)",
          borderRadius:10, padding:"48px 24px", textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔕</div>
          <div style={{ color:C.supply, fontWeight:700, fontSize:15 }}>
            No notifications yet
          </div>
          <div style={{ color:C.muted, fontSize:12, marginTop:8, lineHeight:1.7 }}>
            Go to <b style={{ color:"white" }}>🏙 City Forecast</b> or <b style={{ color:"white" }}>🏘 Ward</b> →
            select any horizon → click <b style={{ color:"white" }}>▶ PREDICT</b><br/>
            Alerts will appear here automatically, one per ward as each scan completes.
          </div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ color:C.muted, fontSize:11, marginBottom:4 }}>
            Showing {filtered.length} of {notifications.length} notifications
            {filter !== "ALL" && ` · filtered: ${filter}`}
          </div>
          {filtered.map((n, i) => (
            <NotifCard key={n.id} notif={n} isNew={i < 5 && !n.read} />
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign:"center", color:C.muted, padding:40, fontSize:13 }}>
              No {filter.toLowerCase()} notifications
            </div>
          )}
        </div>
      )}
    </div>
  );
}
