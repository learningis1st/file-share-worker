export class StorageService {
    constructor(r2Bucket) {
        this.bucket = r2Bucket;
    }

    async fileExists(filename) {
        const head = await this.bucket.head(filename);
        return head !== null;
    }

    async upload(filename, stream, options = {}) {
        return await this.bucket.put(filename, stream, options);
    }

    async get(filename) {
        return await this.bucket.get(filename);
    }

    async list(options) {
        return await this.bucket.list(options);
    }

    async delete(keysOrKey) {
        return await this.bucket.delete(keysOrKey);
    }
}
