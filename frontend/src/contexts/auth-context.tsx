"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { refreshSession, setAccessToken, setSessionExpiredHandler } from "@/lib/api";
import { loginUser, logoutUser, registerUser, type RegisterRequest } from "@/lib/auth-api";
import type { User } from "@/lib/types";

/**
 * Session model: the access token is kept in memory (lib/api), the refresh
 * token in an httpOnly cookie. A non-sensitive localStorage flag only records
 * "this browser has signed in before" so anonymous visitors skip the refresh
 * round-trip.
 */
const SESSION_HINT = "rff_has_session";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterRequest) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function setHint(on: boolean) {
  try {
    if (on) localStorage.setItem(SESSION_HINT, "1");
    else localStorage.removeItem(SESSION_HINT);
  } catch {
    /* storage unavailable */
  }
}

function hasHint() {
  try {
    return localStorage.getItem(SESSION_HINT) === "1";
  } catch {
    return true; // can't tell — attempt refresh
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clear = useCallback(() => {
    setAccessToken(null);
    setUserState(null);
    setHint(false);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(clear);
    let cancelled = false;
    (async () => {
      if (hasHint()) {
        const session = await refreshSession();
        if (cancelled) return;
        if (session) setUserState(session.user);
        else setHint(false);
      }
      if (!cancelled) setIsLoading(false);
    })();
    return () => {
      cancelled = true;
      setSessionExpiredHandler(null);
    };
  }, [clear]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await loginUser({ email, password });
    setAccessToken(res.data!.accessToken);
    setUserState(res.data!.user);
    setHint(true);
    return res.data!.user;
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const res = await registerUser(data);
    setAccessToken(res.data!.accessToken);
    setUserState(res.data!.user);
    setHint(true);
    return res.data!.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      /* the cookie is cleared server-side when reachable; always clear locally */
    }
    clear();
  }, [clear]);

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: !!user, login, register, logout, setUser: setUserState }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
