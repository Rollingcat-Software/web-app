/**
 * FaceEnrollmentDialog — enroll submit path: client-side embedding vs legacy image.
 *
 * Audit item H2: extend the client-side-embedding FACE path to ENROLLMENT. Behind
 * the `VITE_CLIENT_SIDE_EMBEDDING` flag (mirrors the server flag
 * `app.auth.client-side-embedding`), the enroll dialog computes the Facenet512
 * embedding for the best frontal capture (index 0) in the browser and submits ONLY
 * the vector via `enrollFaceEmbedding` — the raw image never leaves the device.
 *
 * Contract verified here (deterministic — embedder + flag + service are mocked):
 *   - Flag OFF → enrollFace(userId, images, tenantId, clientEmbeddings, optimize),
 *     never enrollFaceEmbedding, never embedCapturedFace (byte-identical legacy).
 *   - Flag ON + embedding returns a 512-array → embedCapturedFace(firstImage,
 *     firstLandmarks) then enrollFaceEmbedding(userId, embedding, tenantId), never
 *     enrollFace.
 *   - Flag ON + embedding null → showSnackbar(prep-failed), NEVER enrollFaceEmbedding,
 *     NEVER enrollFace (no image fallback — GPU-less enforcement), NO onEnrolled.
 *
 * FaceEnrollmentFlow is mocked to a single button that hands a captured image +
 * landmarks up to onComplete, so this suite asserts ONLY the dialog's submit routing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '../../../../../../../i18n'

// Inert biometric engine (transitive imports may pull it at module load).
vi.mock('@/lib/biometric-engine/core/BiometricEngine', () => ({
    BiometricEngine: {
        getInstance: () => ({
            initialize: () => Promise.resolve(),
        }),
    },
}))

// The captured frame + 478-pt mesh the (mocked) FaceEnrollmentFlow hands up.
const CAPTURED_IMAGE = 'data:image/jpeg;base64,AAAA'
const CAPTURED_LANDMARKS = [
    { x: 0.38, y: 0.42, z: 0 },
    { x: 0.62, y: 0.42, z: 0 },
    { x: 0.5, y: 0.6, z: 0 },
]

// Mock FaceEnrollmentFlow down to a single button so we drive ONLY the dialog's
// onComplete routing — no camera / detection in jsdom. It hands up the image, a
// per-capture clientEmbeddings array, and the per-capture landmarks (mirrors the
// real flow's 3-arg onComplete).
vi.mock('../../../../FaceEnrollmentFlow', () => ({
    __esModule: true,
    default: ({
        onComplete,
    }: {
        onComplete: (
            images: string[],
            clientEmbeddings?: (number[] | null)[],
            captureLandmarks?: (unknown[] | null)[],
        ) => void
    }) => (
        <button
            type="button"
            onClick={() => onComplete([CAPTURED_IMAGE], [null], [CAPTURED_LANDMARKS])}
        >
            enroll-complete
        </button>
    ),
}))

// Injectable flag + embed function so the test is deterministic (no ONNX).
const flagState = { enabled: false }
const fakeEmbedding = Array.from({ length: 512 }, (_, i) => (i % 7) / 7)
const embedCapturedFaceMock = vi.fn(async () => fakeEmbedding as number[] | null)

vi.mock('@features/biometrics/embedding/clientEmbeddingFlag', () => ({
    isClientSideEmbeddingEnabled: () => flagState.enabled,
}))
vi.mock('@features/biometrics/embedding/embedCapturedFace', () => ({
    embedCapturedFace: (...args: unknown[]) => embedCapturedFaceMock(...(args as [])),
}))

// Mock the biometric service so we assert which enroll method is called.
const enrollFace = vi.fn().mockResolvedValue({ success: true })
const enrollFaceEmbedding = vi.fn().mockResolvedValue({ success: true })
vi.mock('@core/services/BiometricService', () => ({
    getBiometricService: () => ({ enrollFace, enrollFaceEmbedding }),
}))

// Mock the DI container — the dialog resolves an httpClient to PUT the
// enrollment-complete call after a successful enroll.
const httpPut = vi.fn().mockResolvedValue({})
vi.mock('@core/di/container', () => ({
    container: { get: () => ({ put: httpPut }) },
}))

import FaceEnrollmentDialog from '../FaceEnrollmentDialog'

const USER_ID = 'user-1'
const TENANT_ID = 'tenant-marmara-uuid'

function renderDialog() {
    const onClose = vi.fn()
    const onEnrolled = vi.fn()
    const showSnackbar = vi.fn()
    const setActionLoading = vi.fn()
    const createEnrollment = vi.fn().mockResolvedValue({})
    render(
        <FaceEnrollmentDialog
            open
            userId={USER_ID}
            tenantId={TENANT_ID}
            onClose={onClose}
            onEnrolled={onEnrolled}
            showSnackbar={showSnackbar}
            setActionLoading={setActionLoading}
            createEnrollment={createEnrollment}
        />,
    )
    return { onClose, onEnrolled, showSnackbar, setActionLoading, createEnrollment }
}

describe('FaceEnrollmentDialog — enroll submit: client embedding vs legacy image', () => {
    beforeEach(() => {
        flagState.enabled = false
        embedCapturedFaceMock.mockClear()
        embedCapturedFaceMock.mockResolvedValue(fakeEmbedding)
        enrollFace.mockClear()
        enrollFaceEmbedding.mockClear()
        httpPut.mockClear()
    })

    it('flag OFF (default): calls enrollFace with images, never enrollFaceEmbedding/embedCapturedFace', async () => {
        flagState.enabled = false
        const { onEnrolled } = renderDialog()

        await userEvent.click(screen.getByRole('button', { name: 'enroll-complete' }))

        await waitFor(() => expect(enrollFace).toHaveBeenCalledTimes(1))
        expect(enrollFace).toHaveBeenCalledWith(
            USER_ID,
            [CAPTURED_IMAGE],
            TENANT_ID,
            [null],
            false,
        )
        expect(enrollFaceEmbedding).not.toHaveBeenCalled()
        expect(embedCapturedFaceMock).not.toHaveBeenCalled()
        await waitFor(() => expect(onEnrolled).toHaveBeenCalledTimes(1))
    })

    it('flag ON + embedding returns 512-array: embeds first image+landmarks then enrollFaceEmbedding, never enrollFace', async () => {
        flagState.enabled = true
        const { onEnrolled } = renderDialog()

        await userEvent.click(screen.getByRole('button', { name: 'enroll-complete' }))

        await waitFor(() => expect(enrollFaceEmbedding).toHaveBeenCalledTimes(1))
        expect(embedCapturedFaceMock).toHaveBeenCalledWith(CAPTURED_IMAGE, CAPTURED_LANDMARKS)
        expect(enrollFaceEmbedding).toHaveBeenCalledWith(USER_ID, fakeEmbedding, TENANT_ID)
        expect(enrollFace).not.toHaveBeenCalled()
        await waitFor(() => expect(onEnrolled).toHaveBeenCalledTimes(1))
    })

    it('flag ON + embedding null: shows prep-failed snackbar, no enroll call, no onEnrolled (no image fallback)', async () => {
        flagState.enabled = true
        embedCapturedFaceMock.mockResolvedValue(null)
        const { onEnrolled, showSnackbar } = renderDialog()

        await userEvent.click(screen.getByRole('button', { name: 'enroll-complete' }))

        await waitFor(() => expect(showSnackbar).toHaveBeenCalledTimes(1))
        expect(showSnackbar).toHaveBeenCalledWith(
            'Couldn\'t prepare on-device face enrollment. Please check your connection and try again.',
            'error',
        )
        expect(enrollFaceEmbedding).not.toHaveBeenCalled()
        expect(enrollFace).not.toHaveBeenCalled()
        expect(onEnrolled).not.toHaveBeenCalled()
    })
})
