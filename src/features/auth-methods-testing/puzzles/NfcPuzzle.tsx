/**
 * NfcPuzzle — wraps the production `NfcStep` and runs the captured card serial
 * against the REAL `/nfc/verify` endpoint with the signed-in admin's JWT.
 *
 * The underlying step component already surfaces real `NFC_NOT_AVAILABLE`
 * conditions (browsers without `NDEFReader`, framed contexts) per
 * `NfcStep.isNfcSupported` / `NfcStep.isFramed`. We add no second mock layer
 * on top of that; the puzzle is a real round-trip exerciser.
 *
 * USER-BUG-5 (this fix): the previous wrapper resolved success after a
 * `setTimeout(onSuccess, 500)` regardless of whether the scanned serial was
 * known to the backend. We now only succeed when the server confirms the card
 * is enrolled (returns `verified=true` or a matching `userId`).
 */
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NfcStep from '@features/auth/components/steps/NfcStep'
import type { AuthMethodProps } from '../authMethodRegistry'
import { useAuthMethodPuzzleApi } from './useAuthMethodPuzzleApi'

export default function NfcPuzzle({ onSuccess, onError, onClose }: AuthMethodProps) {
    const { t } = useTranslation()
    const api = useAuthMethodPuzzleApi()
    const [loading, setLoading] = useState(false)
    const [stepError, setStepError] = useState<string | undefined>(undefined)

    const handleSubmit = useCallback(
        async (cardSerial: string) => {
            setLoading(true)
            setStepError(undefined)
            const result = await api.submitNfc(cardSerial, t)
            setLoading(false)
            if (result.kind === 'success') {
                onSuccess()
            } else {
                setStepError(result.message)
                onError(result.message)
            }
        },
        [api, t, onSuccess, onError],
    )

    return (
        <NfcStep
            onSubmit={handleSubmit}
            loading={loading}
            error={stepError}
            onBack={onClose}
        />
    )
}
