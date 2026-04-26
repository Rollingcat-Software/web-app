/**
 * Backwards-compatible facade.
 *
 * The hook lives in `./AuthContext` and the provider in `./AuthProvider`,
 * split so react-refresh can detect each file as either component-only
 * or hook-only. Existing callers that imported `{ useAuth, AuthProvider }`
 * from `useAuth` continue to work via the re-exports below.
 */

export { useAuth } from './AuthContext'
export { AuthProvider } from './AuthProvider'
