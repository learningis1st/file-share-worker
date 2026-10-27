const CHUNK_SIZE = 8192;

export function uint8ArrayToBinary(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
    }
    return binary;
}

export function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    return btoa(uint8ArrayToBinary(bytes));
}

export function base64ToUtf8(b64) {
    const binString = atob(b64);
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
        bytes[i] = binString.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}
