import htmlString from './index.html';
import cssString from './style.css';
import jsString from './app.client.js';

export const HTML_CONTENT = htmlString
    .replace('/* CSS_INJECT */', cssString)
    .replace('/* JS_INJECT */', jsString);

export function getRenderedHtml(config = {}) {
    const maxUploadSize = Number(config.MAX_UPLOAD_SIZE ?? 0);

    return HTML_CONTENT.replace(
        '<head>',
        `<head>\n    <script>window.APP_CONFIG = { MAX_UPLOAD_SIZE: ${maxUploadSize} };</script>`
    );
}
