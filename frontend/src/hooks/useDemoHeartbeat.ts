// frontend/src/hooks/useDemoHeartbeat.ts
// Pings POST /auth/demo-heartbeat every 30s while a demo session is active,
// so the backend can derive accurate session duration without needing a
// reliable logout signal. Also fires once immediately on mount, on tab
// visibility change, and on beforeunload (via sendBeacon when available).
import { useEffect } from 'react';
import { api, BASE_URL } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const HEARTBEAT_MS = 30_000;

export function useDemoHeartbeat() {
    const { isDemo, demoSessionId } = useAuth();

    useEffect(() => {
        if (!isDemo || !demoSessionId) return;

        let cancelled = false;
        const beat = () => {
            if (cancelled) return;
            void api.demoHeartbeat(demoSessionId);
        };
        beat();
        const id = window.setInterval(beat, HEARTBEAT_MS);

        const onVis = () => {
            if (document.visibilityState === 'visible') beat();
        };
        document.addEventListener('visibilitychange', onVis);

        const onUnload = () => {
            // sendBeacon is fire-and-forget and survives page navigation.
            try {
                const body = new Blob(
                    [JSON.stringify({ sessionId: demoSessionId })],
                    { type: 'application/json' },
                );
                navigator.sendBeacon(`${BASE_URL}/auth/demo-heartbeat`, body);
            } catch {
                /* noop */
            }
        };
        window.addEventListener('beforeunload', onUnload);

        return () => {
            cancelled = true;
            window.clearInterval(id);
            document.removeEventListener('visibilitychange', onVis);
            window.removeEventListener('beforeunload', onUnload);
        };
    }, [isDemo, demoSessionId]);
}
