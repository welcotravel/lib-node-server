"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class HttpError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = 500;
        this.statusCode = statusCode ? statusCode : 500;
    }
}
exports.default = HttpError;
