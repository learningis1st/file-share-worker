import { signHmacSha256, timingSafeEqual, base64ToBase64Url, base64UrlToBase64 } from './crypto.js';
import { utf8ToBase64, base64ToUtf8 } from './text-base64.js';

const PRESIGNED_URL_DURATION_MS = 30 * 1000; // 30-second validity for downloads
const PRESIGNED_TOKEN_TYPE = 'presigned';

export async function createPresignedUrl(secret, filename) {
    const expiration = Date.now() + PRESIGNED_URL_DURATION_MS;
    const data = JSON.stringify({ typ: PRESIGNED_TOKEN_TYPE, filename, exp: expiration });
    const encodedData = base64ToBase64Url(utf8ToBase64(data));
    const signature = base64ToBase64Url(await signHmacSha256(encodedData, secret));
    return `${encodedData}.${signature}`;
}

export async function verifyPresignedUrl(signature, secret, expectedFilename) {
    const parts = signature.split('.');
    if (parts.length !== 2) return false;
    const [encodedDataUrl, signatureUrl] = parts;

    const expectedSignature = base64ToBase64Url(await signHmacSha256(encodedDataUrl, secret));
    if (!timingSafeEqual(signatureUrl, expectedSignature)) return false;

    try {
        const data = JSON.parse(base64ToUtf8(base64UrlToBase64(encodedDataUrl)));
        if (data.typ !== PRESIGNED_TOKEN_TYPE) return false;
        if (Date.now() > data.exp) return false;
        if (data.filename !== expectedFilename) return false;
        return true;
    } catch {
        return false;
    }
}
