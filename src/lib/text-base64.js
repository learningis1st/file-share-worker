export function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    const binString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    return btoa(binString);
}

export function base64ToUtf8(b64) {
    const binString = atob(b64);
    const bytes = Uint8Array.from(binString, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}
