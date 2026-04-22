import { createTheme, alpha, type Shadows } from '@mui/material/styles'

// Fonts — latin + latin-ext only (Turkish needs latin-ext for ğ, ş, ı, ö, ü, ç)
import '@fontsource/inter/latin-300.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-ext-300.css'
import '@fontsource/inter/latin-ext-400.css'
import '@fontsource/inter/latin-ext-500.css'
import '@fontsource/inter/latin-ext-600.css'
import '@fontsource/inter/latin-ext-700.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/poppins/latin-ext-500.css'
import '@fontsource/poppins/latin-ext-600.css'
import '@fontsource/poppins/latin-ext-700.css'

declare module '@mui/material/styles' {
    interface PaletteColor {
        lighter?: string
        gradient?: string
    }
    interface SimplePaletteColorOptions {
        lighter?: string
        gradient?: string
    }
    interface TypeBackground {
        gradient?: string
    }
}

/* ─────────────────────────────────────────────────────────────
 * Design tokens
 * ───────────────────────────────────────────────────────────── */

// Primary identity — violet / indigo blend (kept compatible with prior #6366f1 primary)
const BRAND = {
    violet:    '#6366f1', // primary anchor (same as before, so existing gradient-keyed UI stays coherent)
    violetUp:  '#818cf8',
    violetDn:  '#4f46e5',
    iris:      '#8b5cf6', // secondary — purple
    irisUp:    '#a78bfa',
    irisDn:    '#7c3aed',
    fuchsia:   '#ec4899',
    // Semantic
    emerald:   '#10b981',
    amber:     '#f59e0b',
    red:       '#ef4444',
    sky:       '#3b82f6',
}

// Ink scale — neutrals for text, surfaces, borders
const INK = {
    light: {
        0:   '#ffffff',
        50:  '#f8fafc',   // app background
        75:  '#f1f5f9',
        100: '#e2e8f0',
        200: '#cbd5e1',
        300: '#94a3b8',
        500: '#64748b',
        700: '#334155',
        900: '#0f172a',
    },
    dark: {
        0:   '#05070d',  // deepest bg
        25:  '#0a0d18',
        50:  '#0f1220',  // app background (dark)
        75:  '#141828',
        100: '#1a1f33',  // card surface (dark)
        200: '#242941',
        300: '#2e3452',
        500: '#505875',
        700: '#8f96ae',
        900: '#e6e8f3',  // primary text (dark)
    },
}

export function createAppTheme(mode: 'light' | 'dark' = 'light') {
    const isDark = mode === 'dark'
    const ink = isDark ? INK.dark : INK.light

    // Surfaces
    const bgDefault  = ink[50]
    const bgPaper    = isDark ? ink[100] : '#ffffff'
    const textPrimary   = isDark ? ink[900] : INK.light[900]
    const textSecondary = isDark ? INK.dark[700] : INK.light[500]
    const textDisabled  = isDark ? INK.dark[500] : INK.light[300]
    const divider       = isDark ? INK.dark[200] : INK.light[100]
    const borderSoft    = isDark ? INK.dark[200] : INK.light[75]

    return createTheme({
        palette: {
            mode,
            primary: {
                main:    BRAND.violet,
                light:   BRAND.violetUp,
                dark:    BRAND.violetDn,
                lighter: isDark ? '#2c2f5e' : '#eef2ff',
                gradient: `linear-gradient(135deg, ${BRAND.violet} 0%, ${BRAND.iris} 100%)`,
                contrastText: '#ffffff',
            },
            secondary: {
                main:    BRAND.iris,
                light:   BRAND.irisUp,
                dark:    BRAND.irisDn,
                lighter: isDark ? '#2e1065' : '#f5f3ff',
                gradient: `linear-gradient(135deg, ${BRAND.iris} 0%, ${BRAND.fuchsia} 100%)`,
                contrastText: '#ffffff',
            },
            error: {
                main:    BRAND.red,
                light:   '#f87171',
                dark:    '#dc2626',
                lighter: isDark ? '#3b0e0e' : '#fef2f2',
            },
            warning: {
                main:    BRAND.amber,
                light:   '#fbbf24',
                dark:    '#d97706',
                lighter: isDark ? '#3a1a05' : '#fffbeb',
            },
            info: {
                main:    BRAND.sky,
                light:   '#60a5fa',
                dark:    '#2563eb',
                lighter: isDark ? '#0e2251' : '#eff6ff',
            },
            success: {
                main:    BRAND.emerald,
                light:   '#34d399',
                dark:    '#059669',
                lighter: isDark ? '#052e16' : '#ecfdf5',
            },
            background: {
                default:  bgDefault,
                paper:    bgPaper,
                gradient: isDark
                    ? 'linear-gradient(160deg, #0f1220 0%, #1a1f33 100%)'
                    : 'linear-gradient(160deg, #f8fafc 0%, #eef2ff 100%)',
            },
            text: {
                primary:   textPrimary,
                secondary: textSecondary,
                disabled:  textDisabled,
            },
            divider,
            grey: {
                50:  '#f8fafc',
                100: '#f1f5f9',
                200: '#e2e8f0',
                300: '#cbd5e1',
                400: '#94a3b8',
                500: '#64748b',
                600: '#475569',
                700: '#334155',
                800: '#1e293b',
                900: '#0f172a',
            },
        },

        typography: {
            fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            h1: {
                fontFamily: '"Poppins", "Inter", sans-serif',
                fontSize: '2.5rem',
                fontWeight: 700,
                letterSpacing: '-0.032em',
                lineHeight: 1.1,
            },
            h2: {
                fontFamily: '"Poppins", "Inter", sans-serif',
                fontSize: '2rem',
                fontWeight: 700,
                letterSpacing: '-0.028em',
                lineHeight: 1.2,
            },
            h3: {
                fontFamily: '"Poppins", "Inter", sans-serif',
                fontSize: '1.625rem',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
            },
            h4: {
                fontFamily: '"Poppins", "Inter", sans-serif',
                fontSize: '1.375rem',
                fontWeight: 600,
                letterSpacing: '-0.016em',
                lineHeight: 1.3,
            },
            h5: {
                fontFamily: '"Poppins", "Inter", sans-serif',
                fontSize: '1.125rem',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                lineHeight: 1.4,
            },
            h6: {
                fontFamily: '"Poppins", "Inter", sans-serif',
                fontSize: '1rem',
                fontWeight: 600,
                letterSpacing: '-0.005em',
                lineHeight: 1.5,
            },
            subtitle1: { fontSize: '1rem',     fontWeight: 500, lineHeight: 1.5 },
            subtitle2: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5, letterSpacing: '0.002em' },
            body1:     { fontSize: '0.9375rem', fontWeight: 400, lineHeight: 1.6 },
            body2:     { fontSize: '0.875rem',  fontWeight: 400, lineHeight: 1.6 },
            button:    { fontWeight: 600, letterSpacing: '0.012em', textTransform: 'none' },
            caption:   { fontSize: '0.75rem',   fontWeight: 500, lineHeight: 1.5, letterSpacing: '0.01em' },
            overline:  { fontSize: '0.6875rem', fontWeight: 600, lineHeight: 1.5, letterSpacing: '0.08em', textTransform: 'uppercase' },
        },

        shape: {
            borderRadius: 12,
        },

        /* Elevation system: layered, calibrated for both light and dark.
         * MUI expects 25 shadow slots (indices 0-24); we use a graduated ramp
         * in the first 8 then plateau. */
        shadows: (() => {
            const light = [
                'none',
                '0 1px 2px 0 rgba(15,23,42,0.04)',
                '0 1px 3px 0 rgba(15,23,42,0.08), 0 1px 2px -1px rgba(15,23,42,0.06)',
                '0 4px 8px -2px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.06)',
                '0 8px 16px -4px rgba(15,23,42,0.10), 0 4px 8px -4px rgba(15,23,42,0.06)',
                '0 16px 32px -8px rgba(15,23,42,0.14), 0 8px 16px -6px rgba(15,23,42,0.08)',
                '0 24px 48px -12px rgba(15,23,42,0.18), 0 12px 24px -8px rgba(15,23,42,0.10)',
                '0 32px 64px -16px rgba(15,23,42,0.22)',
            ]
            const dark = [
                'none',
                '0 1px 2px 0 rgba(0,0,0,0.35)',
                '0 1px 3px 0 rgba(0,0,0,0.45), 0 1px 2px -1px rgba(0,0,0,0.35)',
                '0 4px 10px -2px rgba(0,0,0,0.55), 0 2px 4px -2px rgba(0,0,0,0.40)',
                '0 8px 20px -4px rgba(0,0,0,0.65), 0 4px 10px -4px rgba(0,0,0,0.45)',
                '0 16px 36px -8px rgba(0,0,0,0.70), 0 8px 18px -6px rgba(0,0,0,0.55)',
                '0 24px 50px -12px rgba(0,0,0,0.75), 0 12px 26px -8px rgba(0,0,0,0.60)',
                '0 32px 64px -16px rgba(0,0,0,0.80)',
            ]
            const ramp = isDark ? dark : light
            const plateau = ramp[7]
            return [...ramp, ...Array(17).fill(plateau)] as Shadows
        })(),

        components: {
            MuiCssBaseline: {
                styleOverrides: {
                    ':root': {
                        '--app-radius-sm': '8px',
                        '--app-radius-md': '12px',
                        '--app-radius-lg': '18px',
                        '--app-radius-xl': '24px',
                    },
                    body: {
                        scrollbarWidth: 'thin',
                        scrollbarColor: isDark ? '#2e3452 #0f1220' : '#cbd5e1 #f1f5f9',
                        WebkitFontSmoothing: 'antialiased',
                        MozOsxFontSmoothing: 'grayscale',
                        textRendering: 'optimizeLegibility',
                        fontFeatureSettings: "'ss01', 'ss02', 'cv01', 'cv09'",
                        '&::-webkit-scrollbar': { width: '10px', height: '10px' },
                        '&::-webkit-scrollbar-track': { background: 'transparent' },
                        '&::-webkit-scrollbar-thumb': {
                            background: isDark ? '#2e3452' : '#cbd5e1',
                            borderRadius: '10px',
                            border: `2px solid ${isDark ? INK.dark[50] : INK.light[75]}`,
                        },
                        '&::-webkit-scrollbar-thumb:hover': {
                            background: isDark ? '#3f4668' : '#94a3b8',
                        },
                    },
                    '*:focus-visible': {
                        outline: `2px solid ${alpha(BRAND.violet, 0.6)}`,
                        outlineOffset: '2px',
                        borderRadius: '4px',
                    },
                    '::selection': {
                        backgroundColor: alpha(BRAND.violet, 0.35),
                        color: '#ffffff',
                    },
                },
            },

            MuiButton: {
                defaultProps: {
                    disableElevation: true,
                },
                styleOverrides: {
                    root: {
                        textTransform: 'none',
                        fontWeight: 600,
                        borderRadius: '10px',
                        padding: '9px 18px',
                        transition: 'transform .15s cubic-bezier(.2,.8,.2,1), box-shadow .18s, background-color .18s, border-color .18s',
                        '&:hover': { transform: 'translateY(-1px)' },
                        '&:active':  { transform: 'translateY(0)' },
                        '&:focus-visible': {
                            outline: `2px solid ${alpha(BRAND.violet, 0.5)}`,
                            outlineOffset: '2px',
                        },
                    },
                    sizeSmall:  { padding: '6px 14px', fontSize: '0.8125rem' },
                    sizeLarge:  { padding: '12px 22px', fontSize: '0.9375rem' },
                    contained: {
                        boxShadow: `0 8px 20px -8px ${alpha(BRAND.violet, 0.55)}, inset 0 1px 0 rgba(255,255,255,0.12)`,
                        '&:hover': {
                            boxShadow: `0 12px 28px -10px ${alpha(BRAND.violet, 0.65)}, inset 0 1px 0 rgba(255,255,255,0.18)`,
                        },
                    },
                    containedPrimary: {
                        background: `linear-gradient(135deg, ${BRAND.violet} 0%, ${BRAND.iris} 100%)`,
                        '&:hover': {
                            background: `linear-gradient(135deg, ${BRAND.violetDn} 0%, ${BRAND.irisDn} 100%)`,
                        },
                    },
                    containedSecondary: {
                        background: `linear-gradient(135deg, ${BRAND.iris} 0%, ${BRAND.fuchsia} 100%)`,
                    },
                    outlined: {
                        borderWidth: '1.5px',
                        '&:hover': {
                            borderWidth: '1.5px',
                            backgroundColor: alpha(BRAND.violet, isDark ? 0.12 : 0.06),
                        },
                    },
                    text: {
                        '&:hover': {
                            backgroundColor: alpha(BRAND.violet, isDark ? 0.10 : 0.05),
                        },
                    },
                },
            },

            MuiIconButton: {
                styleOverrides: {
                    root: {
                        borderRadius: '10px',
                        transition: 'background-color .18s, color .18s, transform .15s',
                        '&:hover': {
                            backgroundColor: alpha(BRAND.violet, isDark ? 0.12 : 0.06),
                        },
                    },
                },
            },

            MuiCard: {
                styleOverrides: {
                    root: {
                        borderRadius: '16px',
                        backgroundImage: 'none',
                        backgroundColor: bgPaper,
                        border: `1px solid ${borderSoft}`,
                        boxShadow: isDark
                            ? '0 2px 4px 0 rgba(0,0,0,0.25)'
                            : '0 1px 3px 0 rgba(15,23,42,0.05), 0 1px 2px -1px rgba(15,23,42,0.04)',
                        transition: 'transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .3s, border-color .25s',
                        '&:hover': {
                            borderColor: isDark ? INK.dark[300] : INK.light[100],
                            boxShadow: isDark
                                ? '0 16px 36px -12px rgba(0,0,0,0.6)'
                                : '0 12px 28px -12px rgba(15,23,42,0.15), 0 6px 14px -10px rgba(15,23,42,0.1)',
                        },
                    },
                },
            },

            MuiPaper: {
                defaultProps: { elevation: 0 },
                styleOverrides: {
                    root: { backgroundImage: 'none' },
                    outlined: {
                        borderColor: borderSoft,
                    },
                    elevation1: {
                        boxShadow: isDark
                            ? '0 1px 3px 0 rgba(0,0,0,0.5), 0 1px 2px -1px rgba(0,0,0,0.35)'
                            : '0 1px 3px 0 rgba(15,23,42,0.08), 0 1px 2px -1px rgba(15,23,42,0.06)',
                    },
                },
            },

            MuiTextField: {
                defaultProps: { variant: 'outlined' },
                styleOverrides: {
                    root: {
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '10px',
                            transition: 'box-shadow .2s, border-color .2s, background-color .2s',
                            backgroundColor: isDark ? alpha(INK.dark[75], 0.6) : '#ffffff',
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: isDark ? INK.dark[300] : INK.light[100],
                            },
                            '&:hover:not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': {
                                borderColor: isDark ? INK.dark[500] : INK.light[200],
                            },
                            '&.Mui-focused': {
                                boxShadow: `0 0 0 3px ${alpha(BRAND.violet, 0.2)}`,
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderWidth: '1.5px',
                                    borderColor: BRAND.violet,
                                },
                            },
                            '&.Mui-error.Mui-focused': {
                                boxShadow: `0 0 0 3px ${alpha(BRAND.red, 0.2)}`,
                            },
                        },
                    },
                },
            },

            MuiSelect: {
                styleOverrides: {
                    outlined: { borderRadius: '10px' },
                },
            },

            MuiTableCell: {
                styleOverrides: {
                    root: {
                        borderBottom: `1px solid ${borderSoft}`,
                        padding: '14px 16px',
                    },
                    head: {
                        fontWeight: 600,
                        backgroundColor: isDark ? alpha(INK.dark[75], 0.6) : INK.light[50],
                        color: isDark ? INK.dark[700] : INK.light[500],
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                    },
                },
            },

            MuiTableRow: {
                styleOverrides: {
                    root: {
                        transition: 'background-color .18s ease',
                        '&:hover': {
                            backgroundColor: isDark ? alpha(INK.dark[75], 0.55) : INK.light[50],
                        },
                    },
                },
            },

            MuiChip: {
                styleOverrides: {
                    root: {
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        height: 26,
                    },
                    filled: {
                        '&.MuiChip-colorSuccess': {
                            backgroundColor: isDark ? '#052e16' : '#ecfdf5',
                            color: isDark ? '#34d399' : '#059669',
                        },
                        '&.MuiChip-colorError': {
                            backgroundColor: isDark ? '#3b0e0e' : '#fef2f2',
                            color: isDark ? '#f87171' : '#dc2626',
                        },
                        '&.MuiChip-colorWarning': {
                            backgroundColor: isDark ? '#3a1a05' : '#fffbeb',
                            color: isDark ? '#fbbf24' : '#d97706',
                        },
                        '&.MuiChip-colorInfo': {
                            backgroundColor: isDark ? '#0e2251' : '#eff6ff',
                            color: isDark ? '#60a5fa' : '#2563eb',
                        },
                    },
                    outlined: {
                        borderWidth: '1.25px',
                    },
                },
            },

            MuiAlert: {
                styleOverrides: {
                    root: { borderRadius: '12px', border: '1px solid', fontSize: '0.875rem' },
                    standardSuccess: {
                        backgroundColor: isDark ? alpha('#10b981', 0.12) : '#ecfdf5',
                        borderColor: isDark ? alpha('#10b981', 0.3) : '#a7f3d0',
                        color: isDark ? '#34d399' : '#065f46',
                        '& .MuiAlert-icon': { color: '#10b981' },
                    },
                    standardError: {
                        backgroundColor: isDark ? alpha('#ef4444', 0.12) : '#fef2f2',
                        borderColor: isDark ? alpha('#ef4444', 0.3) : '#fecaca',
                        color: isDark ? '#f87171' : '#991b1b',
                        '& .MuiAlert-icon': { color: '#ef4444' },
                    },
                    standardWarning: {
                        backgroundColor: isDark ? alpha('#f59e0b', 0.12) : '#fffbeb',
                        borderColor: isDark ? alpha('#f59e0b', 0.3) : '#fde68a',
                        color: isDark ? '#fbbf24' : '#92400e',
                        '& .MuiAlert-icon': { color: '#f59e0b' },
                    },
                    standardInfo: {
                        backgroundColor: isDark ? alpha('#3b82f6', 0.12) : '#eff6ff',
                        borderColor: isDark ? alpha('#3b82f6', 0.3) : '#bfdbfe',
                        color: isDark ? '#60a5fa' : '#1e40af',
                        '& .MuiAlert-icon': { color: '#3b82f6' },
                    },
                },
            },

            MuiDialog: {
                styleOverrides: {
                    paper: {
                        borderRadius: '18px',
                        backgroundImage: 'none',
                        border: `1px solid ${borderSoft}`,
                        boxShadow: isDark
                            ? '0 32px 64px -16px rgba(0,0,0,0.8)'
                            : '0 32px 64px -16px rgba(15,23,42,0.25)',
                    },
                },
            },

            MuiDrawer: {
                styleOverrides: {
                    paper: {
                        borderRight: `1px solid ${borderSoft}`,
                        backgroundImage: 'none',
                        backgroundColor: bgPaper,
                        boxShadow: 'none',
                    },
                },
            },

            MuiAppBar: {
                defaultProps: { elevation: 0 },
                styleOverrides: {
                    root: {
                        boxShadow: 'none',
                        borderBottom: `1px solid ${borderSoft}`,
                        backdropFilter: 'saturate(1.4) blur(12px)',
                        WebkitBackdropFilter: 'saturate(1.4) blur(12px)',
                        backgroundColor: isDark ? alpha(bgPaper, 0.8) : 'rgba(255,255,255,0.8)',
                        backgroundImage: 'none',
                    },
                },
            },

            MuiTooltip: {
                styleOverrides: {
                    tooltip: {
                        backgroundColor: isDark ? INK.dark[200] : INK.light[900],
                        color: '#ffffff',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        padding: '6px 10px',
                        boxShadow: '0 8px 20px -8px rgba(0,0,0,0.3)',
                    },
                    arrow: {
                        color: isDark ? INK.dark[200] : INK.light[900],
                    },
                },
            },

            MuiAvatar: {
                styleOverrides: {
                    root: {
                        fontWeight: 600,
                    },
                },
            },

            MuiLinearProgress: {
                styleOverrides: {
                    root: { borderRadius: '999px', height: '6px', backgroundColor: isDark ? INK.dark[200] : INK.light[100] },
                    bar:  { borderRadius: '999px' },
                },
            },

            MuiCircularProgress: {
                styleOverrides: {
                    root: { color: BRAND.violet },
                },
            },

            MuiSkeleton: {
                styleOverrides: {
                    root: {
                        backgroundColor: isDark ? alpha(INK.dark[200], 0.8) : INK.light[75],
                    },
                },
            },

            MuiListItemButton: {
                styleOverrides: {
                    root: {
                        borderRadius: '10px',
                        transition: 'background-color .18s, color .18s',
                    },
                },
            },

            MuiDivider: {
                styleOverrides: {
                    root: { borderColor: divider },
                },
            },

            MuiMenu: {
                styleOverrides: {
                    paper: {
                        borderRadius: '12px',
                        border: `1px solid ${borderSoft}`,
                        backgroundImage: 'none',
                        boxShadow: isDark
                            ? '0 16px 36px -12px rgba(0,0,0,0.7)'
                            : '0 16px 36px -12px rgba(15,23,42,0.2), 0 6px 14px -10px rgba(15,23,42,0.1)',
                        marginTop: 6,
                        minWidth: 200,
                    },
                },
            },

            MuiMenuItem: {
                styleOverrides: {
                    root: {
                        borderRadius: '8px',
                        margin: '2px 6px',
                        padding: '8px 12px',
                        fontSize: '0.875rem',
                        '&:hover': {
                            backgroundColor: alpha(BRAND.violet, isDark ? 0.12 : 0.06),
                        },
                        '&.Mui-selected': {
                            backgroundColor: alpha(BRAND.violet, isDark ? 0.18 : 0.1),
                            '&:hover': {
                                backgroundColor: alpha(BRAND.violet, isDark ? 0.22 : 0.14),
                            },
                        },
                    },
                },
            },

            MuiTabs: {
                styleOverrides: {
                    indicator: {
                        height: 3,
                        borderRadius: '3px 3px 0 0',
                    },
                },
            },

            MuiTab: {
                styleOverrides: {
                    root: {
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        letterSpacing: '0.01em',
                        minHeight: 44,
                    },
                },
            },
        },
    })
}

export default createAppTheme()
