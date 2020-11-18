import HttpError from "./HttpError";

export default class ValidationError extends HttpError {
    name:       string = 'ValidationError';
    statusCode: number = 400;

    constructor(message?: string, statusCode?: number) {
        super(message, statusCode ? statusCode : 400);
    }
}
