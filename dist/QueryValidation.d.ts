/// <reference types="node" />
import { AnySchema } from 'ajv';
import { Logger } from 'rsyslog-cee';
import type { URLSearchParams } from 'node:url';
export default class QueryValidation {
    readonly oSchema: AnySchema;
    private oValidator?;
    constructor(oSchema: AnySchema);
    init(): Promise<void>;
    validateRequest<T>(oQuery: URLSearchParams, oLogger: Logger): T;
}
