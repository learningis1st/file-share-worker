import { requireAuth } from '../middleware/require-auth.js';

export class Router {
    constructor() {
        this.routes = [];
    }

    add(method, pathPattern, handler, requiresAuth = true) {
        this.routes.push({ method, pathPattern, handler, requiresAuth });
    }

    async handle(request, env) {
        const url = new URL(request.url);
        const method = request.method;

        let sessionData = null;
        let authChecked = false;

        for (const route of this.routes) {
            const match = route.pathPattern instanceof RegExp
                ? route.pathPattern.test(url.pathname)
                : route.pathPattern === url.pathname;

            if (match && route.method === method) {
                if (route.requiresAuth) {
                    if (!authChecked) {
                        sessionData = await requireAuth(request, env);
                        authChecked = true;
                    }
                    if (!sessionData) {
                        return new Response('Unauthorized', { status: 401 });
                    }
                }

                return await route.handler(request, url, env);
            }
        }

        return new Response('Not Found', { status: 404 });
    }
}
