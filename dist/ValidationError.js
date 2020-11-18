"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const HttpError_1 = __importDefault(require("./HttpError"));
class ValidationError extends HttpError_1.default {
    constructor(message, statusCode) {
        super(message, statusCode ? statusCode : 400);
        this.name = 'ValidationError';
        this.statusCode = 400;
    }
}
exports.default = ValidationError;
