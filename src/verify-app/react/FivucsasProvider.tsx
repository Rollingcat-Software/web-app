import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { FivucsasAuth } from '../sdk';
import type { FivucsasTheme } from '../sdk';
import { FivucsasContext } from './FivucsasContext';

export interface FivucsasProviderProps {
    clientId: string;
    baseUrl?: string;
    apiBaseUrl?: string;
    locale?: 'en' | 'tr';
    theme?: FivucsasTheme;
    children: ReactNode;
}

export function FivucsasProvider({
    clientId,
    baseUrl,
    apiBaseUrl,
    locale,
    theme,
    children,
}: FivucsasProviderProps) {
    const authRef = useRef<FivucsasAuth | null>(null);

    const auth = useMemo(() => {
        // Destroy previous instance if config changed
        authRef.current?.destroy();
        const instance = new FivucsasAuth({ clientId, baseUrl, apiBaseUrl, locale, theme });
        authRef.current = instance;
        return instance;
    }, [clientId, baseUrl, apiBaseUrl, locale, theme]);

    useEffect(() => {
        return () => {
            authRef.current?.destroy();
            authRef.current = null;
        };
    }, []);

    const value = useMemo(() => ({ auth }), [auth]);

    return (
        <FivucsasContext.Provider value={value}>
            {children}
        </FivucsasContext.Provider>
    );
}
