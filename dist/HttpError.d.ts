export default class HttpError extends Error {
    name: string;
    statusCode: number;
    constructor(message?: string, statusCode?: number);
}
