import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";

const NAV_ITEMS = [
  { path:"/dashboard",  label:"🏙 City" },
  { path:"/ward",       label:"🏘 Ward" },
  { path:"/historical", label:"📅 Historical" },
  { path:"/metrics",    label:"📊 Metrics" },
  { path:"/powerbi",    label:"📈 Analytics" },
];

export default function Navbar() {
  const { user, logout }       = useAuth();
  const { unreadCount }        = useNotifications();
  const navigate               = useNavigate();
  const [open, setOpen]        = useState(false);

  const handleLogout = () => { logout(); navigate("/login"); setOpen(false); };

  // Bell colour based on worst level in unread notifications
  const bellColor = unreadCount > 0 ? "#ff4d6d" : "#6a8aaa";
  const bellBg    = unreadCount > 0 ? "rgba(255,77,109,0.12)" : "rgba(255,255,255,0.05)";
  const bellBorder= unreadCount > 0 ? "rgba(255,77,109,0.4)" : "rgba(255,255,255,0.1)";

  const linkStyle = (active) => ({
    color: active ? "#00c2ff" : "#6a8aaa",
    textDecoration:"none", padding:"6px 10px",
    borderRadius:5, fontSize:12, fontWeight:600,
    background: active ? "rgba(0,194,255,0.1)" : "transparent",
    border: active ? "1px solid rgba(0,194,255,0.25)" : "1px solid transparent",
    whiteSpace:"nowrap", transition:"all 0.2s", display:"block",
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing:border-box; }
        .nav-desktop { display:flex; gap:4px; align-items:center; }
        .nav-user    { display:flex; align-items:center; gap:10px; }
        @keyframes bellPulse {
          0%,100% { transform:scale(1) rotate(0deg); }
          20%     { transform:scale(1.15) rotate(-8deg); }
          40%     { transform:scale(1.15) rotate(8deg); }
          60%     { transform:scale(1.1) rotate(-4deg); }
          80%     { transform:scale(1.05) rotate(0deg); }
        }
        @keyframes badgePop {
          0%   { transform:scale(0); }
          70%  { transform:scale(1.2); }
          100% { transform:scale(1); }
        }
        @media (max-width:768px) {
          .nav-desktop { display:none; }
          .hamburger   { display:flex !important; }
          .user-email  { display:none; }
        }
        @media (max-width:480px) {
          .logo-text { display:none; }
          .user-name { display:none; }
        }
      `}</style>

      <nav style={{ background:"rgba(6,12,20,0.98)",
        borderBottom:"1px solid rgba(0,194,255,0.15)",
        backdropFilter:"blur(12px)", position:"sticky", top:0, zIndex:1000,
        padding:"0 16px", fontFamily:"'Syne',sans-serif" }}>

        <div style={{ maxWidth:1400, margin:"0 auto", display:"flex",
          alignItems:"center", justifyContent:"space-between", height:58 }}>

          {/* Logo */}
          <NavLink to="/dashboard" style={{ textDecoration:"none",
            display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <span style={{ fontSize:20 }}>💧</span>
            <span className="logo-text" style={{ color:"#00c2ff",
              fontWeight:800, fontSize:14, letterSpacing:1 }}>PANVEL WATER</span>
          </NavLink>

          {/* Desktop links */}
          <div className="nav-desktop">
            {NAV_ITEMS.map(item => (
              <NavLink key={item.path} to={item.path}
                style={({ isActive }) => linkStyle(isActive)}>
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Right */}
          <div className="nav-user">

            {/* 🔔 Bell — dynamic unread badge */}
            <NavLink to="/alerts" style={{ textDecoration:"none", position:"relative" }}>
              <div style={{ background:bellBg, border:`1px solid ${bellBorder}`,
                borderRadius:6, padding:"5px 10px",
                display:"flex", alignItems:"center", gap:6,
                cursor:"pointer", transition:"all 0.2s",
                animation: unreadCount > 0 ? "bellPulse 0.6s ease" : "none" }}>
                <span style={{ fontSize:17 }}>{unreadCount > 0 ? "🔔" : "🔕"}</span>
                {unreadCount > 0 && (
                  <span style={{
                    background: "#ff4d6d",
                    color:"white", fontSize:10, fontWeight:800,
                    minWidth:18, height:18, borderRadius:9,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontFamily:"monospace", padding:"0 5px",
                    animation:"badgePop 0.4s ease",
                    boxShadow:"0 0 8px rgba(255,77,109,0.6)",
                  }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
            </NavLink>

            {/* User info */}
            <div style={{ textAlign:"right" }}>
              <div className="user-name" style={{ color:"white",
                fontSize:12, fontWeight:700 }}>{user?.name}</div>
              <div className="user-email" style={{ color:"#6a8aaa", fontSize:10 }}>
                {user?.email}
              </div>
            </div>

            {/* Logout */}
            <button onClick={handleLogout} style={{
              background:"rgba(255,77,109,0.1)",
              border:"1px solid rgba(255,77,109,0.3)",
              color:"#ff4d6d", padding:"6px 12px", borderRadius:5,
              cursor:"pointer", fontSize:11, fontWeight:700,
              fontFamily:"inherit", flexShrink:0 }}>Logout</button>

            {/* Hamburger */}
            <button className="hamburger" onClick={() => setOpen(!open)}
              style={{ display:"none", background:"rgba(0,194,255,0.1)",
                border:"1px solid rgba(0,194,255,0.3)", color:"#00c2ff",
                padding:"6px 10px", borderRadius:5, cursor:"pointer",
                fontSize:16, fontFamily:"inherit" }}>
              {open ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div style={{ borderTop:"1px solid rgba(0,194,255,0.1)",
            padding:"12px 16px", display:"flex", flexDirection:"column", gap:6 }}>
            {NAV_ITEMS.map(item => (
              <NavLink key={item.path} to={item.path}
                onClick={() => setOpen(false)}
                style={({ isActive }) => ({ ...linkStyle(isActive), fontSize:14, padding:"10px 14px" })}>
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/alerts" onClick={() => setOpen(false)}
              style={({ isActive }) => ({
                ...linkStyle(isActive), fontSize:14, padding:"10px 14px",
                display:"flex", justifyContent:"space-between", alignItems:"center" })}>
              <span>🔔 Alerts</span>
              {unreadCount > 0 && (
                <span style={{ background:"#ff4d6d", color:"white",
                  fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:10 }}>
                  {unreadCount} unread
                </span>
              )}
            </NavLink>
          </div>
        )}
      </nav>
    </>
  );
}
