// frontend/src/auth/AuthContext.tsx
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { api, type PublicUser, setAuthToken } from '../api/client';

interface AuthState {
    user: PublicUser | null;
    token: string | null;
    loading: boolean;
    isDemo: boolean;
    login: (email: string, password: string) => Promise<void>;
    loginDemo: () => Promise<void>;
    logout: () => void;
    refresh: () => Promise<void>;
}

const TOKEN_KEY = 'ai-vis-tracker:jwt/v1';

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<PublicUser | null>(null);
    const [token, setToken] = useState<string | null>(() => {
        try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
    });
    const [loading, setLoading] = useState(true);

    // Push token into the shared axios client so every API call carries it.
    useEffect(() => { setAuthToken(token); }, [token]);

    const refresh = useCallback(async () => {
        if (!token) { setUser(null); return; }
        try {
            const me = await api.me();
            setUser(me);
        } catch {
            // Stale or revoked token: drop it and force re-login.
            try { localStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
            setToken(null);
            setUser(null);
        }
    }, [token]);

    useEffect(() => {
        (async () => {
            setLoading(true);
            await refresh();
            setLoading(false);
        })();
    }, [refresh]);

    const login = useCallback(async (email: string, password: string) => {
        const { token: t, user: u } = await api.login(email, password);
        try { localStorage.setItem(TOKEN_KEY, t); } catch { /* noop */ }
        setToken(t);
        setUser(u);
    }, []);

    const loginDemo = useCallback(async () => {
        const { token: t, user: u } = await api.loginDemo();
        try { localStorage.setItem(TOKEN_KEY, t); } catch { /* noop */ }
        setToken(t);
        setUser(u);
    }, []);

    const logout = useCallback(() => {
        try { localStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
        setToken(null);
        setUser(null);
    }, []);

    const isDemo = user?.role === 'demo';

    const value = useMemo<AuthState>(
        () => ({ user, token, loading, isDemo, login, loginDemo, logout, refresh }),
        [user, token, loading, isDemo, login, loginDemo, logout, refresh],
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
    const v = useContext(Ctx);
    if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
    return v;
}
