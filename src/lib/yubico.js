import { timingSafeEqual, base64ToBytes } from './crypto.js';

export async function verifyYubicoOTP(otp, clientId, secretKeyB64) {
    if (!clientId || !secretKeyB64 || !otp) {
        return false;
    }

    const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 40);
    const params = { id: clientId, otp, nonce };
    params['h'] = await generateYubicoSignature(params, secretKeyB64);

    const response = await fetch(`https://api.yubico.com/wsapi/2.0/verify?${new URLSearchParams(params)}`);
    if (!response.ok) return false;

    const responseParams = parseYubicoResponse(await response.text());
    if (responseParams['status'] !== 'OK') return false;
    if (responseParams['nonce'] !== nonce) return false;
    if (responseParams['otp'] !== otp) return false;

    const receivedSignature = responseParams['h'];
    if (!receivedSignature) return false;

    delete responseParams['h'];
    const expectedSignature = await generateYubicoSignature(responseParams, secretKeyB64);

    return timingSafeEqual(receivedSignature, expectedSignature);
}

async function generateYubicoSignature(params, secretKeyB64) {
    const message = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
    const keyBytes = base64ToBytes(secretKeyB64);

    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));

    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

function parseYubicoResponse(text) {
    return Object.fromEntries(
        text.trim().split(/\r?\n/).map(line => {
            const [key, ...rest] = line.split('=');
            return [key.trim(), rest.join('=').trim()];
        })
    );
}
