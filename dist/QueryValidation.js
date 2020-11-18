"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const ajv_1 = __importDefault(require("ajv"));
const ValidationError_1 = __importDefault(require("./ValidationError"));
const fsPromises = fs_1.default.promises;
class QueryValidation {
    constructor(sFile) {
        this.sFile = sFile;
    }
    async init() {
        const oContents = await fsPromises.readFile(this.sFile);
        const oQuerySchema = JSON.parse(oContents.toString('utf-8'));
        const oAJV = new ajv_1.default({
            coerceTypes: true,
            useDefaults: true
        });
        this.oValidator = oAJV.compile(oQuerySchema);
    }
    validateRequest(oQuery, oLogger) {
        if (!this.oValidator) {
            throw new Error('Validator Not Initialized');
        }
        if (!this.oValidator(oQuery)) {
            oLogger.e('QueryValidation.Error', { errors: this.oValidator.errors });
            let oError = new ValidationError_1.default();
            if (this.oValidator.errors) {
                let aErrors = [];
                this.oValidator.errors.map(oError => {
                    let sMessage = `${oError.message}`;
                    if (oError.dataPath.length > 0) {
                        let sParam = oError.dataPath.replace(/^\./, '');
                        sMessage = `${sParam} ${sMessage}`;
                    }
                    switch (oError.keyword) {
                        case 'enum':
                            if ('allowedValues' in oError.params) {
                                sMessage += `: ( ${oError.params.allowedValues.join(', ')} )`;
                            }
                            break;
                        case 'required':
                            sMessage = `Query ${sMessage}`;
                            break;
                        case 'additionalProperties':
                            sMessage = `Query ${sMessage}`;
                            if ('additionalProperty' in oError.params) {
                                sMessage += `: ( ${oError.params.additionalProperty} )`;
                            }
                            break;
                        default:
                        case 'pattern':
                            break;
                    }
                    sMessage += '.';
                    aErrors.push(sMessage);
                });
                oError.message = aErrors.join('\n');
            }
            throw oError;
        }
        return oQuery;
    }
}
exports.default = QueryValidation;
