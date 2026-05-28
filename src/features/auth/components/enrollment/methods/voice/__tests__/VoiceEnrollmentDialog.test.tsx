import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VoiceEnrollmentDialog from '../VoiceEnrollmentDialog'

// i18n passthrough: return the key (interpolating {{reason}} when present) so
// assertions can target the i18n key directly, matching the repo convention.
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, params?: Record<string, unknown>) =>
            params && 'reason' in params ? `${key}: ${params.reason}` : key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
}))

// Stub the inner capture flow so we can trigger onSuccess('enroll') on demand
// without driving the real MediaRecorder pipeline.
vi.mock('@features/auth/components/VoiceEnrollmentFlow', () => ({
    default: ({ onSuccess }: { onSuccess: (a: 'enroll' | 'verify' | 'search') => void }) => (
        <button type="button" onClick={() => onSuccess('enroll')}>
            trigger-enroll
        </button>
    ),
}))

// container.get(TYPES.HttpClient).put — controlled per-test via mockPut.
const mockPut = vi.fn()
vi.mock('@core/di/container', () => ({
    container: {
        get: () => ({ put: mockPut }),
    },
}))

describe('VoiceEnrollmentDialog', () => {
    const baseProps = {
        open: true,
        userId: 'user-123',
        tenantId: 'tenant-1',
        apiBaseUrl: 'http://localhost:8080/api/v1',
        token: 'tok',
        onClose: vi.fn(),
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mockPut.mockResolvedValue({ data: {} })
    })

    it('shows the success snackbar when enrollment record creation succeeds', async () => {
        const onEnrolled = vi.fn()
        const showSnackbar = vi.fn()
        const createEnrollment = vi.fn().mockResolvedValue({})

        render(
            <VoiceEnrollmentDialog
                {...baseProps}
                onEnrolled={onEnrolled}
                showSnackbar={showSnackbar}
                createEnrollment={createEnrollment}
            />,
        )

        fireEvent.click(screen.getByText('trigger-enroll'))

        await waitFor(() => {
            expect(showSnackbar).toHaveBeenCalledWith('enrollmentPage.voiceEnrolled', 'success')
        })
        expect(onEnrolled).toHaveBeenCalledTimes(1)
    })

    it('surfaces a localized error (never swallows) when record creation fails', async () => {
        const onEnrolled = vi.fn()
        const showSnackbar = vi.fn()
        // createEnrollment rejects — previously this was silently swallowed.
        const createEnrollment = vi.fn().mockRejectedValue({
            response: { status: 500, data: {} },
        })

        render(
            <VoiceEnrollmentDialog
                {...baseProps}
                onEnrolled={onEnrolled}
                showSnackbar={showSnackbar}
                createEnrollment={createEnrollment}
            />,
        )

        fireEvent.click(screen.getByText('trigger-enroll'))

        await waitFor(() => {
            expect(showSnackbar).toHaveBeenCalled()
        })
        const [message, severity] = showSnackbar.mock.calls[0]
        expect(severity).toBe('error')
        // Uses the dedicated i18n key + formatApiError(err, t) for the reason.
        expect(message).toContain('enrollmentPage.voiceEnrollRecordFailed')
        // Must NOT leak a raw error string.
        expect(message).not.toContain('500')
        // The biometric capture itself succeeded, so we still refresh the list.
        expect(onEnrolled).toHaveBeenCalledTimes(1)
    })
})
