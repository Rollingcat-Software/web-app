import { useCallback, useRef, useState } from 'react';
import type { VerifyOptions, VerifyResult } from '../sdk';
import { useFivucsasAuth } from './FivucsasContext';

export interface UseVerificationReturn {
    verify: (options?: Partial<VerifyOptions>) => Promise<VerifyResult>;
    isVerifying: boolean;
    result: VerifyResult | null;
    error: Error | null;
    reset: () => void;
}

export function useVerification(): UseVerificationReturn {
    const auth = useFivucsasAuth();
    const [isVerifying, setIsVerifying] = useState(false);
    const [result, setResult] = useState<VerifyResult | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(true);

    // Track mount state for safe state updates
    mountedRef.current = true;

    const verify = useCallback(
        async (options?: Partial<VerifyOptions>): Promise<VerifyResult> => {
            setIsVerifying(true);
            setResult(null);
            setError(null);

            try {
                const verifyResult = await auth.verify(options);
                if (mountedRef.current) {
                    setResult(verifyResult);
                    setIsVerifying(false);
                }
                return verifyResult;
            } catch (err) {
                const verifyError = err instanceof Error ? err : new Error(String(err));
                if (mountedRef.current) {
                    setError(verifyError);
                    setIsVerifying(false);
                }
                throw verifyError;
            }
        },
        [auth],
    );

    const reset = useCallback(() => {
        setIsVerifying(false);
        setResult(null);
        setError(null);
    }, []);

    return { verify, isVerifying, result, error, reset };
}
