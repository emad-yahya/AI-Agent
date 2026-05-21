// frontend/src/auth/AuthGate.tsx
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { LoginPage } from '../components/LoginPage';

export function AuthGate({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
        );
    }

    if (!user) return <LoginPage />;

    return <>{children}</>;
}
