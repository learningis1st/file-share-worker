import htmlString from './index.html';
import cssString from './style.css';
import jsString from './app.client.js';

export function getRenderedHtml(config = {}) {
    const maxUploadSize = Number(config.MAX_UPLOAD_SIZE ?? 0);
    const nonce = config.nonce ? String(config.nonce) : '';
    const nonceAttr = nonce ? `nonce="${nonce}"` : '';

    const configScript = `<script ${nonceAttr}>window.APP_CONFIG = { MAX_UPLOAD_SIZE: ${maxUploadSize} };</script>`;
    const appScript = `<script ${nonceAttr}>${jsString}</script>`;

    return htmlString
        .replace('/* CSS_INJECT */', () => cssString)
        .replace('<head>', () => `<head>\n    ${configScript}`)
        .replace('<script>/* JS_INJECT */</script>', () => appScript);
}
