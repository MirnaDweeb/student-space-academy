import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('egsa_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      try { localStorage.removeItem('egsa_user'); } catch {}
      return null;
    }
  });

  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem('egsa_access_token') || localStorage.getItem('egsa_token')
  );
  const [refreshToken, setRefreshToken] = useState(
    () => localStorage.getItem('egsa_refresh_token')
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(true);

  // Bilingual support (en / ar)
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('egsa_lang') || 'en';
  });

  const setLanguage = useCallback((lang) => {
    const validLang = lang === 'ar' ? 'ar' : 'en';
    setLanguageState(validLang);
    localStorage.setItem('egsa_lang', validLang);
    document.documentElement.dir = validLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = validLang;
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  }, [language, setLanguage]);

  // Sync document direction on mount
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  // Listen for background session events dispatched from api.js
  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
    };

    const handleTokenRefreshed = (e) => {
      const { accessToken: newAccess, refreshToken: newRefresh } = e.detail || {};
      if (newAccess) setAccessToken(newAccess);
      if (newRefresh) setRefreshToken(newRefresh);
    };

    window.addEventListener('egsa_auth_expired', handleAuthExpired);
    window.addEventListener('egsa_token_refreshed', handleTokenRefreshed);

    return () => {
      window.removeEventListener('egsa_auth_expired', handleAuthExpired);
      window.removeEventListener('egsa_token_refreshed', handleTokenRefreshed);
    };
  }, []);

  // Sync profile on startup if token is present
  useEffect(() => {
    let isMounted = true;
    const storedAccess = localStorage.getItem('egsa_access_token') || localStorage.getItem('egsa_token');
    if (!storedAccess) return;

    authService
      .getMe()
      .then((meRes) => {
        if (isMounted && meRes?.success && meRes.data?.user) {
          setUser(meRes.data.user);
          localStorage.setItem('egsa_user', JSON.stringify(meRes.data.user));
        }
      })
      .catch(() => {
        // Handled cleanly by api interceptor
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    try {
      const res = await authService.login({ email, password });
      const { accessToken: access, refreshToken: refresh, token: legacyToken, user: userData } = res.data;

      const effectiveAccess = access || legacyToken;
      setAccessToken(effectiveAccess);
      setRefreshToken(refresh);
      setUser(userData);

      localStorage.setItem('egsa_access_token', effectiveAccess);
      localStorage.setItem('egsa_token', effectiveAccess);
      if (refresh) localStorage.setItem('egsa_refresh_token', refresh);
      localStorage.setItem('egsa_user', JSON.stringify(userData));

      return userData;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (payload) => {
    setIsLoading(true);
    try {
      const res = await authService.register(payload);
      return res;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const currentRefresh = localStorage.getItem('egsa_refresh_token');
    try {
      if (currentRefresh) {
        await authService.logout(currentRefresh);
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
      localStorage.removeItem('egsa_access_token');
      localStorage.removeItem('egsa_token');
      localStorage.removeItem('egsa_refresh_token');
      localStorage.removeItem('egsa_user');
    }
  }, []);

  const verifyEmail = useCallback(async (token) => {
    return authService.verifyEmail(token);
  }, []);

  const resendVerification = useCallback(async (email) => {
    return authService.resendVerification(email);
  }, []);

  const value = {
    user,
    token: accessToken,
    accessToken,
    refreshToken,
    isAuthenticated: !!accessToken && !!user,
    isLoading,
    isInitialized,
    language,
    isRTL: language === 'ar',
    setLanguage,
    toggleLanguage,
    login,
    register,
    logout,
    verifyEmail,
    resendVerification,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

