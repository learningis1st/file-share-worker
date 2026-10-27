import { getRenderedHtml } from './ui/template.js';
import { handleAuth } from './handlers/auth-handler.js';
import { handleUpload, handleList, handleDownload, handleDelete, handleGeneratePresignedUrl } from './handlers/file-handler.js';
import { Router } from './lib/router.js';

// --- Route Registration ---
const appRouter = new Router();

// Public Routes
appRouter.add('GET', '/', async (req, url, env) => {
    const nonce = crypto.randomUUID().replace(/-/g, '');
    const maxSizeBytes = (env.MAX_UPLOAD_SIZE_MB || 100) * 1024 * 1024;
    const renderedHtml = getRenderedHtml({ MAX_UPLOAD_SIZE: maxSizeBytes, nonce });

    return new Response(renderedHtml, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy': `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;`
        }
    });
}, false);

appRouter.add('POST', '/auth', (req, url, env) => handleAuth(req, env), false);

// Protected Routes
appRouter.add('PUT', '/upload', handleUpload);
appRouter.add('GET', '/list', (req, url, env) => handleList(url, env));
appRouter.add('POST', '/presign', handleGeneratePresignedUrl);
appRouter.add('DELETE', /^\/delete\//, (req, url, env) => handleDelete(url, env));

// Ticket-Protected Route
appRouter.add('GET', /^\/download\//, (req, url, env) => handleDownload(url, env), false);

// --- Worker Entrypoint ---
export default {
    async fetch(request, env) {
        try {
            if (!env.SESSION_SECRET || env.SESSION_SECRET.trim() === '') {
                return new Response('Internal Server Error: SESSION_SECRET is not configured.', { status: 500 });
            }
            return await appRouter.handle(request, env);
        } catch (error) {
            console.error('Internal Error:', error);
            return new Response('Internal Server Error', { status: 500 });
        }
    }
};
