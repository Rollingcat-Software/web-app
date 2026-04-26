import { createContext, useContext } from 'react';
import type { FivucsasAuth } from '../sdk';

interface FivucsasContextValue {
    auth: FivucsasAuth;
}

export const FivucsasContext = createContext<FivucsasContextValue | null>(null);

export function useFivucsasAuth(): FivucsasAuth {
    const ctx = useContext(FivucsasContext);
    if (!ctx) {
        throw new Error('useFivucsasAuth must be used within a <FivucsasProvider>');
    }
    return ctx.auth;
}

export type { FivucsasContextValue };
