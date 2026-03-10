class ApiClient {
    constructor() {
        this.tokenKey = 'r2_session_token';
    }
    getToken() { return localStorage.getItem(this.tokenKey); }
    setToken(token) { localStorage.setItem(this.tokenKey, token); }
    clearToken() { localStorage.removeItem(this.tokenKey); }
    isAuthenticated() { return !!this.getToken(); }

    async request(endpoint, options = {}) {
        const headers = new Headers(options.headers || {});
        if (this.getToken() && !headers.has('Authorization')) {
            headers.set('Authorization', 'Bearer ' + this.getToken());
        }
        options.headers = headers;

        const response = await fetch(endpoint, options);
        if (response.status === 401) {
            throw new Error('UNAUTHORIZED');
        }
        return response;
    }
}

class FileService {
    constructor(apiClient) { this.api = apiClient; }

    async authenticate(tokenInput) {
        const res = await fetch('/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenInput })
        });
        if (!res.ok) throw new Error('Authentication failed');
        const data = await res.json();
        this.api.setToken(data.sessionToken);
    }

    async listFiles(prefix = '', cursor = null) {
        let url = '/list?prefix=' + encodeURIComponent(prefix);
        if (cursor) {
            url += '&cursor=' + encodeURIComponent(cursor);
        }
        const res = await this.api.request(url);
        if (!res.ok) throw new Error('Failed to load files');
        return await res.json();
    }

    async upload(file, prefix = '') {
        const fullName = prefix + file.name;
        const res = await this.api.request('/upload?name=' + encodeURIComponent(fullName), {
            method: 'PUT',
            body: file
        });
        if (!res.ok) {
            if (res.status === 409) throw new Error('File already exists');
            if (res.status === 413) throw new Error('File exceeds size limit');
            throw new Error('Upload failed');
        }
    }

    async createFolder(folderName, prefix = '') {
        const fullName = prefix + folderName + '/';
        const res = await this.api.request('/upload?name=' + encodeURIComponent(fullName), {
            method: 'PUT',
            body: '' // Cloudflare R2 will create a 0-byte object representing a folder
        });
        if (!res.ok) {
            if (res.status === 409) throw new Error('Folder already exists');
            throw new Error('Failed to create folder');
        }
    }

    async delete(filename, cursor = null) {
        let nextCursor = cursor;

        while (true) {
            let deleteUrl = '/delete/' + encodeURIComponent(filename);
            if (nextCursor) {
                deleteUrl += '?cursor=' + encodeURIComponent(nextCursor);
            }

            const res = await this.api.request(deleteUrl, { method: 'DELETE' });

            if (!res.ok && res.status !== 206) throw new Error('Failed to delete file');
            if (res.status !== 206) return;

            const data = await res.json();
            if (!(data?.truncated && data?.cursor)) return;

            nextCursor = data.cursor;
        }
    }

    async getPresignedUrl(filename) {
        const res = await this.api.request('/presign?name=' + encodeURIComponent(filename), {
            method: 'POST'
        });
        if (!res.ok) throw new Error('Failed to retrieve presigned URL');
        const data = await res.json();
        return data.signature;
    }
}

class FileIconHelper {
    static getFileIconSvg(filename) {
        const ext = filename.split('.').pop().toLowerCase();

        // Image
        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
            return `<svg class="file-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
        }
        // Video
        if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext)) {
            return `<svg class="file-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`;
        }
        // Audio
        if (['mp3', 'wav', 'flac', 'm4a', 'aac'].includes(ext)) {
            return `<svg class="file-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
        }
        // PDF
        if (['pdf'].includes(ext)) {
            return `<svg class="file-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
        }
        // Archive
        if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
            return `<svg class="file-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"></path><path d="M1 3h22v5H1z"></path><path d="M10 12v-2"></path></svg>`;
        }
        // Code / Document / Spreadsheet
        if (['js', 'html', 'css', 'json', 'py', 'txt', 'md', 'csv', 'ts', 'jsx', 'tsx'].includes(ext)) {
            return `<svg class="file-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><polyline points="16 13 8 13"></polyline><polyline points="16 17 8 17"></polyline><polyline points="10 9 9 9 8 9"></polyline></svg>`;
        }

        // Generic Default File
        return `<svg class="file-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`;
    }
}

class UIManager {
    constructor() {
        this.els = {
            authView: document.getElementById('authView'),
            dashboardView: document.getElementById('dashboardView'),
            logoutBtn: document.getElementById('logoutBtn'),
            authInput: document.getElementById('authInput'),
            loginBtn: document.getElementById('loginBtn'),
            authFeedback: document.getElementById('authFeedback'),
            dropZone: document.getElementById('dropZone'),
            fileInput: document.getElementById('fileInput'),
            selectedFileInfo: document.getElementById('selectedFileInfo'),
            uploadBtn: document.getElementById('uploadBtn'),
            uploadFeedback: document.getElementById('uploadFeedback'),
            fileList: document.getElementById('fileList'),
            filesFeedback: document.getElementById('filesFeedback'),
            refreshBtn: document.getElementById('refreshBtn'),
            newFolderBtn: document.getElementById('newFolderBtn')
        };
    }

    setView(isLoggedIn) {
        if (isLoggedIn) {
            this.els.authView.classList.add('hidden');
            this.els.dashboardView.classList.remove('hidden');
            this.els.logoutBtn.classList.remove('hidden');
        } else {
            this.els.authView.classList.remove('hidden');
            this.els.dashboardView.classList.add('hidden');
            this.els.logoutBtn.classList.add('hidden');
            this.els.authInput.value = '';
            this.clearFeedback();
        }
    }

    setFeedback(elementId, message, type = 'text') {
        const el = this.els[elementId];
        el.innerHTML = message;
        el.className = 'feedback mt-2 text-center ' + type;
    }

    clearFeedback() {
        this.setFeedback('authFeedback', '');
        this.setFeedback('uploadFeedback', '');
        this.setFeedback('filesFeedback', '');
    }

    setLoading(elementId, isLoading, originalText) {
        const btn = this.els[elementId];
        if (isLoading) {
            btn.disabled = true;
            btn.innerHTML = '<div class="loader" style="width:20px;height:20px;border-width:2px;"></div>';
        } else {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    updateSelectedFile(file) {
        if (file) {
            this.els.selectedFileInfo.textContent = 'Selected: ' + file.name;
            this.els.selectedFileInfo.classList.remove('hidden');
            this.els.uploadBtn.disabled = false;
        } else {
            this.els.selectedFileInfo.textContent = '';
            this.els.selectedFileInfo.classList.add('hidden');
            this.els.uploadBtn.disabled = true;
            this.els.fileInput.value = '';
        }
    }

    renderFileList(files, directories, currentPrefix, getFileIconSvg, onDownload, onDelete, onNavigate, onNavigateUp, onPreview) {
        this.els.fileList.innerHTML = '';

        if (currentPrefix) {
            const upLi = document.createElement('li');
            upLi.className = 'file-item';
            upLi.style.cursor = 'pointer';
            upLi.style.background = 'rgba(0, 81, 195, 0.04)';
            upLi.innerHTML = `
                <span class="file-name" style="display: flex; align-items: center; color: var(--primary);">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    <strong>Go Back</strong>
                </span>
                <span class="text-muted" style="font-size: 0.85rem;">/${currentPrefix}</span>
            `;
            upLi.onclick = onNavigateUp;
            this.els.fileList.appendChild(upLi);
        }

        if ((!files || files.length === 0) && (!directories || directories.length === 0)) {
            this.els.fileList.insertAdjacentHTML('beforeend', '<li class="text-center text-muted mt-2">No files here.</li>');
            return;
        }

        if (directories) {
            directories.forEach(dir => {
                const li = document.createElement('li');
                li.className = 'file-item';
                li.style.cursor = 'pointer';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'file-name';

                const displayDir = dir.substring(currentPrefix.length).replace(/\/$/, '');
                nameSpan.innerHTML = `<svg class="file-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
                nameSpan.appendChild(document.createTextNode(displayDir));

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'file-actions';

                // Create a placeholder download button for alignment (folders don't have a download action)
                const downBtn = document.createElement('button');
                downBtn.className = 'btn-small btn-outline btn-icon';
                downBtn.style.visibility = 'hidden';
                downBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
                downBtn.onclick = (e) => { e.stopPropagation(); }; // Prevent clicks just in case

                const delBtn = document.createElement('button');
                delBtn.className = 'btn-small btn-danger btn-icon';
                delBtn.title = 'Delete Folder';
                delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
                delBtn.onclick = (e) => { e.stopPropagation(); onDelete(dir); };

                // Append both buttons to match the file item structure
                actionsDiv.appendChild(downBtn);
                actionsDiv.appendChild(delBtn);

                li.onclick = () => onNavigate(dir);
                li.appendChild(nameSpan);
                li.appendChild(actionsDiv);
                this.els.fileList.appendChild(li);
            });
        }

        if (files) {
            files.forEach(filename => {
                if (filename === currentPrefix) return;

                const li = document.createElement('li');
                li.className = 'file-item';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'file-name clickable';
                nameSpan.style.cursor = 'pointer';
                nameSpan.onclick = () => onPreview(filename);
                const displayName = filename.substring(currentPrefix.length);
                nameSpan.innerHTML = getFileIconSvg(filename);
                nameSpan.appendChild(document.createTextNode(displayName));

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'file-actions';

                const downBtn = document.createElement('button');
                downBtn.className = 'btn-small btn-outline btn-icon';
                downBtn.title = 'Download';
                downBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
                downBtn.onclick = (e) => { e.stopPropagation(); onDownload(filename); };

                const delBtn = document.createElement('button');
                delBtn.className = 'btn-small btn-danger btn-icon';
                delBtn.title = 'Delete';
                delBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
                delBtn.onclick = (e) => { e.stopPropagation(); onDelete(filename); };

                actionsDiv.appendChild(downBtn);
                actionsDiv.appendChild(delBtn);
                li.appendChild(nameSpan);
                li.appendChild(actionsDiv);
                this.els.fileList.appendChild(li);
            });
        }
    }
}

class AppController {
    constructor(api, driveService, ui) {
        this.api = api;
        this.drive = driveService;
        this.ui = ui;
        this.selectedFile = null;
        this.currentPrefix = '';
        this.initEventListeners();
        this.checkAuthOnLoad();
    }

    initEventListeners() {
        this.ui.els.loginBtn.onclick = () => this.handleLogin();
        this.ui.els.authInput.onkeypress = (e) => { if (e.key === 'Enter') this.handleLogin(); };
        this.ui.els.logoutBtn.onclick = () => this.logout();
        this.ui.els.refreshBtn.onclick = () => this.loadFiles();
        this.ui.els.newFolderBtn.onclick = () => this.handleNewFolder();

        const dz = this.ui.els.dropZone;
        const fi = this.ui.els.fileInput;

        dz.onclick = () => fi.click();
        dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('dragover'); };
        dz.ondragleave = () => dz.classList.remove('dragover');
        dz.ondrop = (e) => {
            e.preventDefault();
            dz.classList.remove('dragover');
            if (e.dataTransfer.files.length) this.handleFileSelect(e.dataTransfer.files[0]);
        };
        fi.onchange = (e) => {
            if (e.target.files.length) this.handleFileSelect(e.target.files[0]);
        };

        this.ui.els.uploadBtn.onclick = () => this.handleUpload();
    }

    handleError(error, contextFeedbackId) {
        if (error.message === 'UNAUTHORIZED') {
            alert('Session expired. Please log in again.');
            this.logout();
        } else {
            this.ui.setFeedback(contextFeedbackId, error.message, 'error');
        }
    }

    checkAuthOnLoad() {
        if (this.api.isAuthenticated()) {
            this.ui.setView(true);
            this.loadFiles();
        } else {
            this.ui.setView(false);
        }
    }

    logout() {
        this.api.clearToken();
        this.currentPrefix = '';
        this.ui.setView(false);
    }

    async handleLogin() {
        const token = this.ui.els.authInput.value.trim();
        if (!token) return;

        this.ui.setLoading('loginBtn', true);
        this.ui.clearFeedback();

        try {
            await this.drive.authenticate(token);
            this.ui.setView(true);
            this.loadFiles();
        } catch (e) {
            this.ui.setFeedback('authFeedback', 'Authentication failed. Please check credentials.', 'error');
        } finally {
            this.ui.setLoading('loginBtn', false, 'Authenticate');
        }
    }

    async handleNewFolder() {
        const folderName = prompt('Enter new folder name:');
        if (!folderName) return;

        const cleanName = folderName.trim().replace(/\//g, '');
        if (!cleanName) return;

        this.ui.setFeedback('filesFeedback', '<div class="loader"></div>', 'text');

        try {
            await this.drive.createFolder(cleanName, this.currentPrefix);
            this.loadFiles();
        } catch (e) {
            this.handleError(e, 'filesFeedback');
        }
    }

    handleFileSelect(file) {
        this.selectedFile = file;
        this.ui.updateSelectedFile(file);
        this.ui.setFeedback('uploadFeedback', '');
    }

    async handleUpload() {
        if (!this.selectedFile) return;

        const MAX_SIZE = window.APP_CONFIG?.MAX_UPLOAD_SIZE || (100 * 1024 * 1024);

        if (this.selectedFile.size > MAX_SIZE) {
            const maxMb = MAX_SIZE / (1024 * 1024);
            this.ui.setFeedback('uploadFeedback', `File exceeds the ${maxMb}MB size limit.`, 'error');
            return;
        }

        this.ui.setLoading('uploadBtn', true);
        this.ui.setFeedback('uploadFeedback', 'Uploading...', 'text');

        try {
            await this.drive.upload(this.selectedFile, this.currentPrefix);
            this.ui.setFeedback('uploadFeedback', 'File uploaded successfully!', 'success');
            this.handleFileSelect(null);
            this.loadFiles();
        } catch (e) {
            this.handleError(e, 'uploadFeedback');
        } finally {
            this.ui.setLoading('uploadBtn', false, 'Upload File');
            this.ui.updateSelectedFile(this.selectedFile);
        }
    }

    async loadFiles() {
        this.ui.setFeedback('filesFeedback', '<div class="loader"></div>', 'text');
        this.ui.els.fileList.innerHTML = '';

        try {
            let allFiles = [];
            let allDirectories = [];
            let hasMore = true;
            let currentCursor = null;

            while (hasMore) {
                const data = await this.drive.listFiles(this.currentPrefix, currentCursor);

                if (data.files) allFiles.push(...data.files);
                if (data.directories) allDirectories.push(...data.directories);

                hasMore = data.truncated;
                currentCursor = data.cursor;
            }

            this.ui.clearFeedback();
            this.ui.renderFileList(
                allFiles,
                allDirectories,
                this.currentPrefix,
                (filename) => FileIconHelper.getFileIconSvg(filename),
                (filename) => this.handleDownload(filename),
                (filename) => this.handleDelete(filename),
                (dir) => this.navigateTo(dir),
                () => this.navigateUp(),
                (filename) => this.handlePreview(filename)
            );
        } catch (e) {
            this.handleError(e, 'filesFeedback');
        }
    }

    navigateTo(dir) {
        this.currentPrefix = dir;
        this.loadFiles();
    }

    navigateUp() {
        const parts = this.currentPrefix.split('/').filter(Boolean);
        parts.pop();
        this.currentPrefix = parts.length > 0 ? parts.join('/') + '/' : '';
        this.loadFiles();
    }

    async handleDownload(filename) {
        try {
            const signature = await this.drive.getPresignedUrl(filename);
            const pathSegments = filename.split('/').map(encodeURIComponent).join('/');
            const url = '/download/' + pathSegments + '?signature=' + encodeURIComponent(signature);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename.split('/').pop();
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            this.handleError(e, 'filesFeedback');
        }
    }

    async handleDelete(filename) {
        const isFolder = filename.endsWith('/');
        const displayName = filename.replace(/\/$/, '');
        const message = isFolder
            ? `Permanently delete folder "${displayName}" and all its contents?`
            : `Permanently delete "${filename}"?`;

        if (!confirm(message)) return;

        try {
            await this.drive.delete(filename);
            this.loadFiles();
        } catch (e) {
            this.handleError(e, 'filesFeedback');
        }
    }

    async handlePreview(filename) {
        try {
            const signature = await this.drive.getPresignedUrl(filename);

            const pathSegments = filename.split('/').map(encodeURIComponent).join('/');
            const url = '/download/' + pathSegments + '?signature=' + encodeURIComponent(signature) + '&inline=true';

            window.open(url, '_blank');
        } catch (e) {
            this.handleError(e, 'filesFeedback');
        }
    }
}

const apiClient = new ApiClient();
const driveService = new FileService(apiClient);
const uiManager = new UIManager();
const app = new AppController(apiClient, driveService, uiManager);
