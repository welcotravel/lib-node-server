"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class HttpResponse {
    constructor(oResponse, oLogger) {
        this.log = (iStatus, oHeaders, oError, iSize) => {
            let oContext = {
                '#response': {
                    status: iStatus
                }
            };
            if (oHeaders) {
                oContext['#response'].headers = JSON.stringify(oHeaders);
            }
            if (oError) {
                this.oLogger.setProcessIsError(true);
                oContext['#error'] = {
                    code: iStatus,
                    message: oError.message,
                    type: oError.name
                };
            }
            if (iSize !== undefined) {
                oContext['#response'].size = iSize;
            }
            this.oLogger.justAddContext(oContext);
        };
        this.oResponse = oResponse;
        this.oLogger = oLogger;
    }
    error(sAction, oError) {
        this.oResponse.writeHead(oError.statusCode, { 'content-type': "text/plain" });
        this.oResponse.write(oError.message);
        this.oResponse.end();
        this.log(oError.statusCode, undefined, oError);
        this.oLogger.e(sAction, { error: oError });
    }
    success(iStatus, oBody, oHeaders) {
        this.oResponse.writeHead(iStatus, oHeaders);
        let iSize;
        if (oBody instanceof Buffer) {
            this.oResponse.write(oBody);
            iSize = oBody.byteLength;
        }
        else if (oBody) {
            this.oResponse.write(oBody);
            if (oBody.length !== undefined && typeof oBody.length === "number") {
                iSize = oBody.length;
            }
        }
        this.oResponse.end();
        this.log(iStatus, oHeaders, undefined, iSize);
    }
}
exports.default = HttpResponse;
