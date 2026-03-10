import { AuthService } from '../services/auth-service.js';

const authService = new AuthService();

export async function handleAuth(request, env) {
    try {
        const { token } = await request.json();

        if (typeof token !== 'string' || !token) {
            return new Response('Unauthorized', { status: 401 });
        }

        const sessionToken = await authService.authenticate(token, env);

        if (sessionToken) {
            return new Response(JSON.stringify({ sessionToken }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (e) {
        console.error("Auth Error:", e);
    }

    // Add a 500ms delay before returning the failure to mitigate timing attacks
    await new Promise(resolve => setTimeout(resolve, 500));
    return new Response('Unauthorized', { status: 401 });
}
