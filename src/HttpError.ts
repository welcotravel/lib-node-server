
export default class HttpError extends Error {
    name:       string = 'HttpError';
    statusCode: number = 500;

    constructor(message?: string, statusCode?: number) {
        super(message);
        this.statusCode = statusCode ? statusCode : 500;
    }
}