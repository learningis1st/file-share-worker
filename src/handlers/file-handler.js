import { createPresignedUrl, verifyPresignedUrl } from '../lib/session.js';
import { StorageService } from '../services/storage-service.js';

export async function handleUpload(request, url, env) {
    const filename = url.searchParams.get('name');

    if (!filename) {
        return new Response('Bad Request: Missing filename', { status: 400 });
    }

    const storage = new StorageService(env.FILES);

    const MAX_SIZE = (env.MAX_UPLOAD_SIZE_MB || 100) * 1024 * 1024;
    const contentLength = request.headers.get('content-length');

    if (!contentLength) {
        if (request.body) request.body.cancel();
        return new Response('Length Required: Chunked encoding is not permitted.', { status: 411 });
    }

    const parsedLength = parseInt(contentLength, 10);
    if (isNaN(parsedLength) || parsedLength > MAX_SIZE) {
        if (request.body) request.body.cancel();
        return new Response('Payload Too Large', { status: 413 });
    }

    const contentType = request.headers.get('content-type') || 'application/octet-stream';
    const result = await storage.upload(filename, request.body, {
        onlyIf: { etagDoesNotMatch: '*' },
        httpMetadata: { contentType }
    });

    if (result === null) {
        return new Response('Conflict: File already exists. Rename and try again.', { status: 409 });
    }

    return new Response('Success');
}

export async function handleList(url, env) {
    const prefix = url.searchParams.get('prefix') || '';
    const cursor = url.searchParams.get('cursor');
    const options = { delimiter: '/' };

    if (prefix) {
        options.prefix = prefix;
    }

    if (cursor) {
        options.cursor = cursor;
    }

    const storage = new StorageService(env.FILES);
    const listed = await storage.list(options);
    const filenames = listed.objects.map(obj => obj.key);

    return new Response(JSON.stringify({
        files: filenames,
        directories: listed.delimitedPrefixes || [],
        truncated: listed.truncated,
        cursor: listed.cursor
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function handleDelete(url, env) {
    const key = url.pathname.substring(8); // Remove '/delete/' prefix
    let decodedKey;

    try {
        decodedKey = decodeURIComponent(key);
    } catch (e) {
        return new Response('Bad Request: Malformed URL', { status: 400 });
    }

    const storage = new StorageService(env.FILES);

    try {
        if (decodedKey.endsWith('/')) {
            const cursor = url.searchParams.get('cursor');
            const listOptions = { prefix: decodedKey };
            if (cursor) listOptions.cursor = cursor;

            const listed = await storage.list(listOptions);
            const keysToDelete = listed.objects.map(obj => obj.key);

            if (keysToDelete.length > 0) {
                await storage.delete(keysToDelete);
            }

            if (listed.truncated) {
                return new Response(JSON.stringify({ truncated: true, cursor: listed.cursor }), {
                    status: 206,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            return new Response('Success');
        } else {
            const fileExists = await storage.fileExists(decodedKey);
            if (!fileExists) {
                return new Response('Not Found', { status: 404 });
            }

            await storage.delete([decodedKey]);
            return new Response('Success');
        }
    } catch (e) {
        console.error('Delete error:', e);
        return new Response('Internal Server Error', { status: 500 });
    }
}

export async function handleGeneratePresignedUrl(request, url, env) {
    const filename = url.searchParams.get('name');
    if (!filename) {
        return new Response('Bad Request: Missing filename', { status: 400 });
    }

    const signature = await createPresignedUrl(env.SESSION_SECRET, filename);
    return new Response(JSON.stringify({ signature }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

export async function handleDownload(url, env) {
    let fullPath;
    try {
        fullPath = decodeURIComponent(url.pathname.substring(10)); // Remove '/download/' prefix
    } catch (e) {
        return new Response('Bad Request: Malformed URL', { status: 400 });
    }

    const signature = url.searchParams.get('signature');
    if (!signature) {
        return new Response('Unauthorized: Missing signature', { status: 401 });
    }

    const isValid = await verifyPresignedUrl(signature, env.SESSION_SECRET, fullPath);
    if (!isValid) {
        return new Response('Unauthorized: Invalid or expired signature', { status: 401 });
    }

    const storage = new StorageService(env.FILES);
    const object = await storage.get(fullPath);

    if (object === null) {
        return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    const downloadName = fullPath.split('/').pop();
    const isInline = url.searchParams.get('inline') === 'true';

    const currentType = headers.get('Content-Type');
    if (isInline && (!currentType || currentType === 'application/octet-stream')) {
        const ext = (downloadName?.split('.').pop() || '').toLowerCase();

        const mimeTypes = {
            // Documents & Text
            pdf: 'application/pdf',
            txt: 'text/plain',
            html: 'text/html',
            css: 'text/css',
            js: 'text/javascript',
            json: 'application/json',
            md: 'text/markdown',
            csv: 'text/csv',
            xml: 'application/xml',

            // Media
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            svg: 'image/svg+xml',
            webp: 'image/webp',
            mp4: 'video/mp4',
            webm: 'video/webm',
            mp3: 'audio/mpeg',
            wav: 'audio/wav',

            // Configuration & Code
            yaml: 'text/plain',
            yml: 'text/plain',
            toml: 'text/plain',
            ini: 'text/plain',
            conf: 'text/plain',
            env: 'text/plain',
            sh: 'text/plain',
            bat: 'text/plain',

            // Archives
            zip: 'application/zip',
            rar: 'application/vnd.rar',
            tar: 'application/x-tar',
            gz: 'application/gzip',
            '7z': 'application/x-7z-compressed'
        };

        if (mimeTypes[ext]) headers.set('Content-Type', mimeTypes[ext]);
    }

    const disposition = isInline ? 'inline' : 'attachment';

    const safeFilename = downloadName.replace(/"/g, '\\"');
    headers.set('Content-Disposition', `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);

    if (isInline) {
        headers.set('Content-Security-Policy', "default-src 'none'; sandbox;");
        headers.set('X-Content-Type-Options', 'nosniff');
    }

    return new Response(object.body, { headers });
}
