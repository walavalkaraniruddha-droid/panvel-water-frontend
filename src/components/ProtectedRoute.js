import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ background: "#060c14", height: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center", color: "#00c2ff",
      fontFamily: "monospace", fontSize: 14 }}>
      Loading...
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}
