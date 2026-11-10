/**
 * Smoke test: the public benchmark page renders without an account, shows the device
 * line, counts down, and the cancel button stops the automatic start.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import i18n from '@/i18n'

const submitRun = vi.fn()
vi.mock('@core/di/container', () => ({
    getService: () => ({ submitRun, exportRuns: vi.fn() }),
}))
vi.mock('@features/auth/hooks/AuthContext', () => ({
    useAuth: () => ({ user: null }),
}))

import DevbenchPage from '@/pages/DevbenchPage'

describe('DevbenchPage', { timeout: 20000 }, () => {
    beforeEach(async () => {
        vi.useFakeTimers()
        await i18n.changeLanguage('en')
    })
    afterEach(() => {
        vi.useRealTimers()
    })

    it('render_WhenOpened_ShouldCountDownAndAllowCancel', async () => {
        render(<DevbenchPage />)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
        })

        expect(screen.getByRole('heading', { level: 1, name: 'Face model speed test' })).toBeTruthy()
        expect(screen.getByText(/^Your device:/)).toBeTruthy()
        expect(screen.getByText('The test starts in 5 seconds')).toBeTruthy()

        await act(async () => {
            await vi.advanceTimersByTimeAsync(2000)
        })
        expect(screen.getByText('The test starts in 3 seconds')).toBeTruthy()

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000)
        })
        expect(screen.getByText('Press "Start now" when you are ready.')).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Start now' })).toBeTruthy()
        expect(submitRun).not.toHaveBeenCalled()
    })

    it('render_WhenTypingName_ShouldStopCountdown', async () => {
        render(<DevbenchPage />)
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0)
        })
        fireEvent.change(screen.getByLabelText('Your name (optional)'), { target: { value: 'Ayse' } })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(6000)
        })
        expect(screen.getByText('Press "Start now" when you are ready.')).toBeTruthy()
        expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    })
})
