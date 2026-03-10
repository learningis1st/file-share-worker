export async function signHmacSha256(data, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export function timingSafeEqual(a, b) {
    const maxLen = Math.max(a.length, b.length);
    let mismatch = a.length ^ b.length;
    for (let i = 0; i < maxLen; i++) {
        const ac = i < a.length ? a.charCodeAt(i) : 0;
        const bc = i < b.length ? b.charCodeAt(i) : 0;
        mismatch |= ac ^ bc;
    }
    return mismatch === 0;
}

export function base64ToBase64Url(base64) {
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBase64(base64url) {
    const padded = base64url.padEnd(base64url.length + (4 - base64url.length % 4) % 4, '=');
    return padded.replace(/-/g, '+').replace(/_/g, '/');
}

export function base64ToBytes(base64) {
    const binary = atob(base64);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}
