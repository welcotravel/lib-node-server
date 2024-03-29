import Ajv, {
    AnySchema,
    ValidateFunction
}                                from 'ajv';
import {ParsedUrlQuery}          from "querystring";
import {Logger}                  from 'rsyslog-cee';

import ValidationError           from './ValidationError'

export default class QueryValidation {
    readonly oSchema: AnySchema;

    private oValidator?: ValidateFunction;

    constructor(oSchema: AnySchema) {
        this.oSchema = oSchema;
    }

    async init() {
        const oOptions = {
            coerceTypes: true,
            useDefaults: true
        };
        const oAJV      = new Ajv(oOptions);
        this.oValidator = oAJV.compile(this.oSchema);
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