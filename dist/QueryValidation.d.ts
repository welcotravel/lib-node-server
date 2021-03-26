/// <reference types="node" />
import { AnySchema } from 'ajv';
import { ParsedUrlQuery } from "querystring";
import { Logger } from 'rsyslog-cee';
export default class QueryValidation {
    readonly oSchema: AnySchema;
    private oValidator?;
    constructor(oSchema: AnySchema);
    init(): Promise<void>;
    validateRequest<T>(oQuery: ParsedUrlQuery, oLogger: Logger): T;
}
