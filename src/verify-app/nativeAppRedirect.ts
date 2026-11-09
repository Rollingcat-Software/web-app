/**
 * True when an OAuth redirect URI hands control to a native app through a
 * private-use URI scheme (RFC 8252 section 7.1, for example `fivucsas://callback`)
 * rather than to a web page. Browsers may refuse a scripted navigation to such a
 * scheme, and its URL origin is the opaque string "null".
 */
export function isNativeAppRedirect(uri: string): boolean {
    try {
        const protocol = new URL(uri).protocol
        return protocol !== 'https:' && protocol !== 'http:'
    } catch {
        return false
    }
}
