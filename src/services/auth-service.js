import { verifyYubicoOTP } from '../lib/yubico.js';
import { createSignedSessionValue } from '../lib/session.js';
import { timingSafeEqual, signHmacSha256 } from '../lib/crypto.js';

const fallbackStrategy = {
    async authenticate(token, env) {
        if (env.FALLBACK_PASSWORD) {
            const tokenHash = await signHmacSha256(token, env.SESSION_SECRET);
            const passHash = await signHmacSha256(env.FALLBACK_PASSWORD, env.SESSION_SECRET);

            if (timingSafeEqual(tokenHash, passHash)) {
                return await createSignedSessionValue(env.SESSION_SECRET, 'static-user');
            }
        }
        return null;
    }
};

const yubikeyStrategy = {
    async authenticate(token, env) {
        if (!env.YUBICO_CLIENT_ID || !env.YUBICO_SECRET_KEY) {
            return null;
        }

        if (token.length === 44) {
            const yubikeyId = token.substring(0, 12).toLowerCase();
            const allowedIds = (env.ALLOWED_YUBIKEY_ID || "").split(',').map(id => id.trim().toLowerCase());

            if (allowedIds.includes(yubikeyId)) {
                const isValid = await verifyYubicoOTP(token, env.YUBICO_CLIENT_ID, env.YUBICO_SECRET_KEY);
                if (isValid) {
                    return await createSignedSessionValue(env.SESSION_SECRET, yubikeyId);
                }
            }
        }
        return null;
    }
};

export class AuthService {
    constructor() {
        this.strategies = [fallbackStrategy, yubikeyStrategy];
    }

    async authenticate(token, env) {
        for (const strategy of this.strategies) {
            const sessionToken = await strategy.authenticate(token, env);
            if (sessionToken) {
                return sessionToken;
            }
        }
        return null;
    }
}
