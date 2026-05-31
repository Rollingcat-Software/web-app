/**
 * StepProgress — shared step/layer indicator used by both verify.fivucsas
 * (LoginMfaFlow) and the dashboard login (LoginPage). Locks the contract the
 * dashboard relies on: hidden for single-step flows, visible + clamped for
 * multi-step ones.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@/i18n'
import StepProgress from '../StepProgress'

describe('StepProgress', () => {
    it('renders nothing for a single-step (or zero) flow', () => {
        const { container } = render(<StepProgress current={1} total={1} />)
        expect(container).toBeEmptyDOMElement()

        const { container: zero } = render(<StepProgress current={1} total={0} />)
        expect(zero).toBeEmptyDOMElement()
    })

    it('shows the step counter for a multi-step flow', () => {
        render(<StepProgress current={1} total={3} />)
        // The wrapper exposes the labeled progressbar (MUI LinearProgress also
        // has role=progressbar, so query the wrapper by its aria-label).
        const bar = screen.getByLabelText('Step 1 of 3')
        expect(bar).toHaveAttribute('aria-valuemax', '3')
        expect(bar).toHaveAttribute('aria-valuenow', '1')
        expect(screen.getByText(/Step 1 of 3/i)).toBeInTheDocument()
    })

    it('clamps an out-of-range current step to the total', () => {
        render(<StepProgress current={9} total={3} />)
        const bar = screen.getByLabelText('Step 3 of 3')
        expect(bar).toHaveAttribute('aria-valuenow', '3')
        expect(screen.getByText(/Step 3 of 3/i)).toBeInTheDocument()
    })
})
