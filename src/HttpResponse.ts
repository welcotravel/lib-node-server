import http     from "http";
import {Logger} from 'rsyslog-cee';

import HttpError from "./HttpError";

export default class HttpResponse {
    private oResponse: http.ServerResponse;
    private oLogger:   Logger;

    constructor(oResponse: http.ServerResponse, oLogger: Logger) {
        this.oResponse = oResponse;
        this.oLogger   = oLogger;
    }

    error(sAction: string, oError: HttpError) {
        this.oResponse.writeHead(oError.statusCode, {'content-type': "text/plain"});
        this.oResponse.write(oError.message);
        this.oResponse.end();

        this.log(oError.statusCode, undefined, oError);
        this.oLogger.e(sAction, {error: oError});
    }

    success(iStatus: number, oBody?: any, oHeaders?: {[header: string]: any}) {
        this.oResponse.writeHead(iStatus, oHeaders);

        let iSize: number | undefined;

        if (oBody instanceof Buffer) {
            this.oResponse.write(oBody);
            iSize = oBody.byteLength;
        } else if (oBody) {
            this.oResponse.write(oBody);
            if (oBody.length !== undefined && typeof oBody.length === "number") {
                iSize = oBody.length;
            }
        }

        this.oResponse.end();

        this.log(iStatus, oHeaders, undefined, iSize);
    }

    log = (iStatus: number, oHeaders?: {[header: string]: any}, oError?: Error, iSize?: number) => {
        let oContext: {
            '#response': {
                status:   number
                headers?: string,
                size?:    number
            },
            '#error'?: {
                code:    number,
                message: string,
                type:    string
            }
        } = {
            '#response': {
                status: iStatus
            }
        };

        if (oHeaders) {
            oContext['#response'].headers = JSON.stringify(oHeaders)
        }

        if (oError) {
            this.oLogger.setProcessIsError(true);
            oContext['#error'] = {
                code:    iStatus,
                message: oError.message,
                type:    oError.name
            }
        }

        if (iSize !== undefined) {
            oContext['#response'].size = iSize;
        }

        this.oLogger.justAddContext(oContext);
    };
}
