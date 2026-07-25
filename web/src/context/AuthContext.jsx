import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "../lib/api";
import { getSocket, reconnectSocket } from "../lib/socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const { user: me } = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMe();
    getSocket().connect();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const { token, user: loggedInUser } = await api.login({ username, password });
    setToken(token);
    setUser(loggedInUser);
    reconnectSocket();
    return loggedInUser;
  }, []);

  const register = useCallback(async (username, email, password) => {
    const { token, user: newUser } = await api.register({ username, email, password });
    setToken(token);
    setUser(newUser);
    reconnectSocket();
    return newUser;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    reconnectSocket();
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
