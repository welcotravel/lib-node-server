import fs                        from "fs";

import Ajv, {ValidateFunction}   from 'ajv';
import {ParsedUrlQuery}          from "querystring";
import {Logger}                  from 'rsyslog-cee';

import ValidationError           from './ValidationError'

const fsPromises  = fs.promises;

export default class QueryValidation {
    readonly sFile:      string;

    private oValidator?: ValidateFunction;

    constructor(sFile: string) {
        this.sFile = sFile;
    }

    async init() {
        const oContents    = await fsPromises.readFile(this.sFile);
        const oQuerySchema = JSON.parse(oContents.toString('utf-8'));
        const oAJV         = new Ajv({
            coerceTypes: true,
            useDefaults: true
        });

        this.oValidator    = oAJV.compile(oQuerySchema);
    }

    validateRequest<T>(oQuery: ParsedUrlQuery, oLogger: Logger): T {
        if (!this.oValidator) {
            throw new Error('Validator Not Initialized');
        }

        if (!this.oValidator(oQuery)) {
            oLogger.e('QueryValidation.Error', {errors: this.oValidator.errors});
            let oError = new ValidationError();

            if (this.oValidator.errors) {
                let aErrors: string[] = [];
                this.oValidator.errors.map(oError => {
                    let sMessage = `${oError.message}`;

                    if (oError.dataPath.length > 0) {
                        let sParam = oError.dataPath.replace(/^\./, '');
                        sMessage = `${sParam} ${sMessage}`;
                    }

                    switch(oError.keyword) {
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

        return <T><unknown> oQuery;
    }
}