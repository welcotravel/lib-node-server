import HttpError from "./HttpError";
export default class ValidationError extends HttpError {
    name: string;
    statusCode: number;
    constructor(message?: string, statusCode?: number);
}
