/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0
 * Uses only Node.js crypto — zero external dependencies.
 */
import { randomBytes, createHash } from 'crypto';

/**
 * Generates a cryptographically random code_verifier (43–128 chars, base64url).
 */
export function generateCodeVerifier(): string {
    // 96 random bytes → 128 base64url characters
    return randomBytes(96).toString('base64url');
}

/**
 * Generates the S256 code_challenge from a code_verifier.
 */
export function generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Generates a random state parameter to prevent CSRF.
 */
export function generateState(): string {
    return randomBytes(32).toString('hex');
}

export interface PKCEPair {
    codeVerifier: string;
    codeChallenge: string;
    state: string;
}

/**
 * Convenience: generate a complete PKCE pair + state in one call.
 */
export function generatePKCE(): PKCEPair {
    const codeVerifier = generateCodeVerifier();
    return {
        codeVerifier,
        codeChallenge: generateCodeChallenge(codeVerifier),
        state: generateState(),
    };
}
