import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext(null);
const API = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  // On app start — check if token already saved in localStorage
  useEffect(() => {
    const token = localStorage.getItem("wt_token");
    const name  = localStorage.getItem("wt_name");
    const email = localStorage.getItem("wt_email");
    if (token && name) {
      setUser({ token, name, email });
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    const { token, name } = res.data;
    localStorage.setItem("wt_token", token);
    localStorage.setItem("wt_name",  name);
    localStorage.setItem("wt_email", email);
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUser({ token, name, email });
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await axios.post(`${API}/auth/register`, { name, email, password });
    const { token } = res.data;
    localStorage.setItem("wt_token", token);
    localStorage.setItem("wt_name",  name);
    localStorage.setItem("wt_email", email);
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUser({ token, name, email });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("wt_token");
    localStorage.removeItem("wt_name");
    localStorage.removeItem("wt_email");
    delete axios.defaults.headers.common["Authorization"];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
