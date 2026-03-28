/**
 * Hook that observes the body height and sends resize events to the parent.
 * This allows the parent iframe to auto-size based on content height.
 */

import { useEffect, useRef } from 'react'
import { sendResize } from './postMessageBridge'

export function useResizeObserver(): void {
    const lastHeight = useRef(0)

    useEffect(() => {
        // Only observe if we are embedded
        if (window.parent === window) return

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const height = Math.ceil(entry.contentRect.height)
                if (height !== lastHeight.current) {
                    lastHeight.current = height
                    sendResize(height)
                }
            }
        })

        observer.observe(document.body)

        return () => observer.disconnect()
    }, [])
}
