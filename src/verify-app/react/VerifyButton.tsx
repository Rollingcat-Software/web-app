import { useCallback } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import type { VerifyResult } from '../sdk';
import { useVerification } from './useVerification';

export interface VerifyButtonProps {
    flow?: string;
    userId?: string;
    methods?: string[];
    container?: string | HTMLElement;
    variant?: 'contained' | 'outlined' | 'text';
    size?: 'small' | 'medium' | 'large';
    label?: string;
    onComplete?: (result: VerifyResult) => void;
    onError?: (error: Error) => void;
    onCancel?: () => void;
    disabled?: boolean;
}

export function VerifyButton({
    flow,
    userId,
    methods,
    container,
    variant = 'contained',
    size = 'medium',
    label = 'Verify Identity',
    onComplete,
    onError,
    onCancel,
    disabled = false,
}: VerifyButtonProps) {
    const { verify, isVerifying } = useVerification();

    const handleClick = useCallback(async () => {
        try {
            const result = await verify({
                flow,
                userId,
                methods,
                container,
                onCancel,
            });
            onComplete?.(result);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            // Only call onError for non-cancellation errors
            if (!error.message.includes('cancelled')) {
                onError?.(error);
            }
        }
    }, [verify, flow, userId, methods, container, onCancel, onComplete, onError]);

    return (
        <Button
            variant={variant}
            size={size}
            disabled={disabled || isVerifying}
            onClick={handleClick}
            startIcon={isVerifying ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
            {isVerifying ? 'Verifying...' : label}
        </Button>
    );
}
