import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import PuzzleRunnerModal from '../PuzzleRunnerModal'
import { PUZZLE_REGISTRY, BiometricPuzzleId } from '../puzzleRegistry'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
}))

// Replace FaceCaptureStep with a lightweight stand-in so the modal test
// doesn't pull the camera / ML bundle.
vi.mock('@features/auth/components/steps/FaceCaptureStep', () => ({
    default: ({ onSubmit }: { onSubmit: (img: string) => void }) => (
        <button
            type="button"
            data-testid="mock-face-submit"
            onClick={() => onSubmit('face-mock-image')}
        >
            face-step
        </button>
    ),
}))

describe('PuzzleRunnerModal', () => {
    it('mounts FacePuzzle for a face puzzle (e.g. FACE_BLINK)', () => {
        const puzzle = PUZZLE_REGISTRY[BiometricPuzzleId.FACE_BLINK]
        render(<PuzzleRunnerModal open={true} puzzle={puzzle} onClose={vi.fn()} />)
        expect(screen.getByTestId('mock-face-submit')).toBeInTheDocument()
    })

    it('mounts the HandGesturePlaceholder for a hand puzzle (e.g. HAND_WAVE)', () => {
        const puzzle = PUZZLE_REGISTRY[BiometricPuzzleId.HAND_WAVE]
        render(<PuzzleRunnerModal open={true} puzzle={puzzle} onClose={vi.fn()} />)
        expect(screen.getByText(`${puzzle.i18nKey}.title`)).toBeInTheDocument()
    })

    it('fires onClose when the close button is clicked', () => {
        const puzzle = PUZZLE_REGISTRY[BiometricPuzzleId.FACE_BLINK]
        const onClose = vi.fn()
        render(<PuzzleRunnerModal open={true} puzzle={puzzle} onClose={onClose} />)
        const closeButton = screen.getByRole('button', { name: /close/i })
        act(() => {
            fireEvent.click(closeButton)
        })
        expect(onClose).toHaveBeenCalled()
    })
})
