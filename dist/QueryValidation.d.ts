/// <reference types="node" />
import { ParsedUrlQuery } from "querystring";
import { Logger } from 'rsyslog-cee';
export default class QueryValidation {
    readonly sFile: string;
    private oValidator?;
    constructor(sFile: string);
    init(): Promise<void>;
    validateRequest<T>(oQuery: ParsedUrlQuery, oLogger: Logger): T;
}
