import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider }         from "./context/AuthContext";
import { ForecastProvider }     from "./context/ForecastContext";
import { NotificationProvider } from "./context/NotificationContext";
import ProtectedRoute           from "./components/ProtectedRoute";
import Navbar                   from "./components/Navbar";
import ToastNotification        from "./components/ToastNotification";

import Login        from "./pages/Login";
import Register     from "./pages/Register";
import Dashboard    from "./pages/Dashboard";
import WardForecast from "./pages/WardForecast";
import Historical   from "./pages/Historical";
import Metrics      from "./pages/Metrics";
import PowerBI      from "./pages/PowerBI";
import Alerts       from "./pages/Alerts";

function AppLayout({ children }) {
  return (
    <>
      <Navbar />
      <ToastNotification />
      <main>{children}</main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ForecastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login"    element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/dashboard" element={
                <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
              } />
              <Route path="/ward" element={
                <ProtectedRoute><AppLayout><WardForecast /></AppLayout></ProtectedRoute>
              } />
              <Route path="/historical" element={
                <ProtectedRoute><AppLayout><Historical /></AppLayout></ProtectedRoute>
              } />
              <Route path="/metrics" element={
                <ProtectedRoute><AppLayout><Metrics /></AppLayout></ProtectedRoute>
              } />
              <Route path="/powerbi" element={
                <ProtectedRoute><AppLayout><PowerBI /></AppLayout></ProtectedRoute>
              } />
              <Route path="/alerts" element={
                <ProtectedRoute><AppLayout><Alerts /></AppLayout></ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </ForecastProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
