/**
 * Render smoke for the public `/author-trial` gate.
 *
 * No camera and no network: with no stored access code the page renders the
 * access-code gate only. The loop itself is covered headlessly in
 * `features/author-trial/__tests__/trialLoop.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/i18n'
import AuthorTrialPage from '../AuthorTrialPage'

describe('AuthorTrialPage', () => {
    it('renders the access-code gate before any trial traffic', () => {
        render(<AuthorTrialPage />)

        expect(screen.getByRole('heading', { name: /Paper B · Author trial/i })).toBeInTheDocument()
        expect(screen.getByLabelText('Access code')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Open the trial' })).toBeDisabled()
        expect(screen.getByText(/Pseudonymous participant codes only/i)).toBeInTheDocument()
    })
})