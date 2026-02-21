import { Box } from '@mui/material'
import { motion } from 'framer-motion'

interface FaceOvalGuideProps {
    detected: boolean
    centered: boolean
    progress: number       // 0-1, fills the arc
    size?: number          // oval width in px
    pulseOnReady?: boolean
}

export default function FaceOvalGuide({
    detected,
    centered,
    progress,
    size = 220,
    pulseOnReady = true,
}: FaceOvalGuideProps) {
    const height = size * 1.3
    const strokeWidth = 3
    const cx = size / 2 + strokeWidth
    const cy = height / 2 + strokeWidth
    const rx = size / 2
    const ry = height / 2
    const svgWidth = size + strokeWidth * 2
    const svgHeight = height + strokeWidth * 2

    // Approximate ellipse circumference (Ramanujan)
    const h = ((rx - ry) ** 2) / ((rx + ry) ** 2)
    const circumference = Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))

    const strokeColor = detected
        ? centered
            ? '#22c55e'     // green
            : '#facc15'     // yellow
        : '#ffffff'          // white

    const glowColor = detected
        ? centered
            ? 'rgba(34, 197, 94, 0.4)'
            : 'rgba(250, 204, 21, 0.25)'
        : 'rgba(255, 255, 255, 0.1)'

    const dashOffset = circumference * (1 - progress)

    return (
        <Box
            sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 2,
            }}
        >
            <motion.div
                animate={
                    pulseOnReady && detected && centered
                        ? { scale: [1, 1.02, 1] }
                        : { scale: 1 }
                }
                transition={
                    pulseOnReady && detected && centered
                        ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
                        : undefined
                }
            >
                <svg
                    width={svgWidth}
                    height={svgHeight}
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    style={{ overflow: 'visible' }}
                >
                    {/* Glow filter */}
                    <defs>
                        <filter id="oval-glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
                        </filter>
                    </defs>

                    {/* Background glow */}
                    <ellipse
                        cx={cx}
                        cy={cy}
                        rx={rx}
                        ry={ry}
                        fill="none"
                        stroke={glowColor}
                        strokeWidth={8}
                        filter="url(#oval-glow)"
                    />

                    {/* Base oval (dashed when no face) */}
                    <ellipse
                        cx={cx}
                        cy={cy}
                        rx={rx}
                        ry={ry}
                        fill="none"
                        stroke={detected ? 'rgba(255,255,255,0.15)' : strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={detected ? 'none' : '8 6'}
                        opacity={detected ? 0.5 : 0.6}
                    />

                    {/* Progress arc */}
                    {progress > 0 && (
                        <ellipse
                            cx={cx}
                            cy={cy}
                            rx={rx}
                            ry={ry}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth={strokeWidth + 1}
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                            style={{
                                transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s ease',
                                transform: `rotate(-90deg)`,
                                transformOrigin: `${cx}px ${cy}px`,
                            }}
                        />
                    )}

                    {/* Corner markers */}
                    {[
                        { x: cx - rx, y: cy - ry * 0.7, angle: 0 },
                        { x: cx + rx, y: cy - ry * 0.7, angle: 90 },
                        { x: cx + rx, y: cy + ry * 0.7, angle: 180 },
                        { x: cx - rx, y: cy + ry * 0.7, angle: 270 },
                    ].map((marker, i) => (
                        <circle
                            key={i}
                            cx={marker.x}
                            cy={marker.y}
                            r={3}
                            fill={strokeColor}
                            opacity={0.6}
                            style={{ transition: 'fill 0.3s ease' }}
                        />
                    ))}
                </svg>
            </motion.div>
        </Box>
    )
}
