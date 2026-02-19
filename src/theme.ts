import { createTheme, alpha } from '@mui/material/styles'

// Import fonts
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'

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

// Modern color palette
const primaryColor = '#6366f1' // Indigo
const secondaryColor = '#8b5cf6' // Purple
const successColor = '#10b981' // Emerald
const warningColor = '#f59e0b' // Amber
const errorColor = '#ef4444' // Red
const infoColor = '#3b82f6' // Blue

export function createAppTheme(mode: 'light' | 'dark' = 'light') {
    return createTheme({
    palette: {
        mode,
        primary: {
            main: primaryColor,
            light: '#818cf8',
            dark: '#4f46e5',
            lighter: mode === 'dark' ? '#312e81' : '#eef2ff',
            gradient: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            contrastText: '#ffffff',
        },
        secondary: {
            main: secondaryColor,
            light: '#a78bfa',
            dark: '#7c3aed',
            lighter: mode === 'dark' ? '#2e1065' : '#f5f3ff',
            gradient: `linear-gradient(135deg, ${secondaryColor} 0%, #ec4899 100%)`,
            contrastText: '#ffffff',
        },
        error: {
            main: errorColor,
            light: '#f87171',
            dark: '#dc2626',
            lighter: mode === 'dark' ? '#450a0a' : '#fef2f2',
        },
        warning: {
            main: warningColor,
            light: '#fbbf24',
            dark: '#d97706',
            lighter: mode === 'dark' ? '#451a03' : '#fffbeb',
        },
        info: {
            main: infoColor,
            light: '#60a5fa',
            dark: '#2563eb',
            lighter: mode === 'dark' ? '#172554' : '#eff6ff',
        },
        success: {
            main: successColor,
            light: '#34d399',
            dark: '#059669',
            lighter: mode === 'dark' ? '#052e16' : '#ecfdf5',
        },
        background: {
            default: mode === 'dark' ? '#0f172a' : '#f8fafc',
            paper: mode === 'dark' ? '#1e293b' : '#ffffff',
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        },
        text: {
            primary: mode === 'dark' ? '#f1f5f9' : '#1e293b',
            secondary: mode === 'dark' ? '#94a3b8' : '#64748b',
        },
        divider: mode === 'dark' ? '#334155' : '#e2e8f0',
    },
    typography: {
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        h1: {
            fontFamily: '"Poppins", sans-serif',
            fontSize: '2.5rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
        },
        h2: {
            fontFamily: '"Poppins", sans-serif',
            fontSize: '2rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
        },
        h3: {
            fontFamily: '"Poppins", sans-serif',
            fontSize: '1.75rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
        },
        h4: {
            fontFamily: '"Poppins", sans-serif',
            fontSize: '1.5rem',
            fontWeight: 600,
            lineHeight: 1.4,
        },
        h5: {
            fontFamily: '"Poppins", sans-serif',
            fontSize: '1.25rem',
            fontWeight: 600,
            lineHeight: 1.4,
        },
        h6: {
            fontFamily: '"Poppins", sans-serif',
            fontSize: '1rem',
            fontWeight: 600,
            lineHeight: 1.5,
        },
        subtitle1: {
            fontSize: '1rem',
            fontWeight: 500,
            lineHeight: 1.5,
        },
        subtitle2: {
            fontSize: '0.875rem',
            fontWeight: 500,
            lineHeight: 1.5,
        },
        body1: {
            fontSize: '1rem',
            fontWeight: 400,
            lineHeight: 1.6,
        },
        body2: {
            fontSize: '0.875rem',
            fontWeight: 400,
            lineHeight: 1.6,
        },
        button: {
            fontWeight: 600,
            letterSpacing: '0.02em',
        },
    },
    shape: {
        borderRadius: 12,
    },
    shadows: [
        'none',
        '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    ],
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    scrollbarWidth: 'thin',
                    '&::-webkit-scrollbar': {
                        width: '8px',
                        height: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                        background: mode === 'dark' ? '#1e293b' : '#f1f5f9',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        background: mode === 'dark' ? '#475569' : '#cbd5e1',
                        borderRadius: '4px',
                    },
                    '&::-webkit-scrollbar-thumb:hover': {
                        background: mode === 'dark' ? '#64748b' : '#94a3b8',
                    },
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: '10px',
                    padding: '10px 20px',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                        transform: 'translateY(-1px)',
                    },
                    '&:active': {
                        transform: 'translateY(0)',
                    },
                },
                contained: {
                    boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.39)',
                    '&:hover': {
                        boxShadow: '0 6px 20px rgba(99, 102, 241, 0.45)',
                    },
                },
                containedPrimary: {
                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
                    '&:hover': {
                        background: `linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)`,
                    },
                },
                outlined: {
                    borderWidth: '2px',
                    '&:hover': {
                        borderWidth: '2px',
                        backgroundColor: alpha(primaryColor, 0.04),
                    },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: '16px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    border: `1px solid ${mode === 'dark' ? '#334155' : '#f1f5f9'}`,
                    '&:hover': {
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                        transform: 'translateY(-2px)',
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
                elevation1: {
                    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: '10px',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: primaryColor,
                            },
                        },
                        '&.Mui-focused': {
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderWidth: '2px',
                            },
                        },
                    },
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderBottom: `1px solid ${mode === 'dark' ? '#334155' : '#f1f5f9'}`,
                    padding: '16px',
                },
                head: {
                    fontWeight: 600,
                    backgroundColor: mode === 'dark' ? '#0f172a' : '#f8fafc',
                    color: mode === 'dark' ? '#94a3b8' : '#475569',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    transition: 'background-color 0.2s ease',
                    '&:hover': {
                        backgroundColor: mode === 'dark' ? '#1e293b' : '#f8fafc',
                    },
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: '8px',
                    fontWeight: 500,
                },
                filled: {
                    '&.MuiChip-colorSuccess': {
                        backgroundColor: mode === 'dark' ? '#052e16' : '#ecfdf5',
                        color: mode === 'dark' ? '#34d399' : '#059669',
                    },
                    '&.MuiChip-colorError': {
                        backgroundColor: mode === 'dark' ? '#450a0a' : '#fef2f2',
                        color: mode === 'dark' ? '#f87171' : '#dc2626',
                    },
                    '&.MuiChip-colorWarning': {
                        backgroundColor: mode === 'dark' ? '#451a03' : '#fffbeb',
                        color: mode === 'dark' ? '#fbbf24' : '#d97706',
                    },
                    '&.MuiChip-colorInfo': {
                        backgroundColor: mode === 'dark' ? '#172554' : '#eff6ff',
                        color: mode === 'dark' ? '#60a5fa' : '#2563eb',
                    },
                },
            },
        },
        MuiAlert: {
            styleOverrides: {
                root: {
                    borderRadius: '12px',
                },
                standardSuccess: {
                    backgroundColor: mode === 'dark' ? '#052e16' : '#ecfdf5',
                    color: mode === 'dark' ? '#34d399' : '#065f46',
                    '& .MuiAlert-icon': {
                        color: '#10b981',
                    },
                },
                standardError: {
                    backgroundColor: mode === 'dark' ? '#450a0a' : '#fef2f2',
                    color: mode === 'dark' ? '#f87171' : '#991b1b',
                    '& .MuiAlert-icon': {
                        color: '#ef4444',
                    },
                },
                standardWarning: {
                    backgroundColor: mode === 'dark' ? '#451a03' : '#fffbeb',
                    color: mode === 'dark' ? '#fbbf24' : '#92400e',
                    '& .MuiAlert-icon': {
                        color: '#f59e0b',
                    },
                },
                standardInfo: {
                    backgroundColor: mode === 'dark' ? '#172554' : '#eff6ff',
                    color: mode === 'dark' ? '#60a5fa' : '#1e40af',
                    '& .MuiAlert-icon': {
                        color: '#3b82f6',
                    },
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: '16px',
                    boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    borderRight: 'none',
                    boxShadow: '4px 0 24px rgba(0, 0, 0, 0.08)',
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                    backdropFilter: 'blur(8px)',
                    backgroundColor: mode === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: '#1e293b',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    padding: '8px 12px',
                },
                arrow: {
                    color: '#1e293b',
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
                root: {
                    borderRadius: '4px',
                    height: '6px',
                },
            },
        },
        MuiSkeleton: {
            styleOverrides: {
                root: {
                    backgroundColor: mode === 'dark' ? '#334155' : '#f1f5f9',
                },
            },
        },
    },
})
}

export default createAppTheme()
