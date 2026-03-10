import { signHmacSha256, timingSafeEqual, base64ToBase64Url, base64UrlToBase64 } from './crypto.js';
import { utf8ToBase64, base64ToUtf8 } from './text-base64.js';

const SESSION_DURATION_MS = 3600 * 1000 * 24; // 24-hour session
const SESSION_TOKEN_TYPE = 'session';

export async function createSignedSessionValue(secret, yubikeyId) {
    const expiration = Date.now() + SESSION_DURATION_MS;
    const data = JSON.stringify({ typ: SESSION_TOKEN_TYPE, yubikeyId, exp: expiration });
    const encodedData = base64ToBase64Url(utf8ToBase64(data));
    const signature = base64ToBase64Url(await signHmacSha256(encodedData, secret));
    return `${encodedData}.${signature}`;
}

export async function verifySessionToken(token, secret, allowedYubiKeys) {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedDataUrl, signatureUrl] = parts;

    const expectedSignature = base64ToBase64Url(await signHmacSha256(encodedDataUrl, secret));
    if (!timingSafeEqual(signatureUrl, expectedSignature)) return null;

    try {
        const data = JSON.parse(base64ToUtf8(base64UrlToBase64(encodedDataUrl)));
        if (data.typ !== SESSION_TOKEN_TYPE) return null;
        if (Date.now() > data.exp) return null;

        const allowedIds = (allowedYubiKeys || '').split(',').map(id => id.trim().toLowerCase());
        if (!data.yubikeyId || (!allowedIds.includes(data.yubikeyId.toLowerCase()) && data.yubikeyId !== 'static-user')) {
            return null;
        }

        return { yubikeyId: data.yubikeyId };
    } catch {
        return null;
    }
}
