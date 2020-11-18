/// <reference types="node" />
import http from "http";
import { Logger } from 'rsyslog-cee';
import HttpError from "./HttpError";
export default class HttpResponse {
    private oResponse;
    private oLogger;
    constructor(oResponse: http.ServerResponse, oLogger: Logger);
    error(sAction: string, oError: HttpError): void;
    success(iStatus: number, oBody?: any, oHeaders?: {
        [header: string]: any;
    }): void;
    log: (iStatus: number, oHeaders?: {
        [header: string]: any;
    } | undefined, oError?: Error | undefined, iSize?: number | undefined) => void;
}
