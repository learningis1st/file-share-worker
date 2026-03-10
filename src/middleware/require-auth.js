import { verifySessionToken } from '../lib/session.js';

export async function requireAuth(request, env) {
    let token = null;
    const authHeader = request.headers.get('Authorization');

    if (authHeader) {
        token = authHeader.replace('Bearer ', '');
    }

    if (!token) {
        return null;
    }

    return await verifySessionToken(token, env.SESSION_SECRET, env.ALLOWED_YUBIKEY_ID);
}
