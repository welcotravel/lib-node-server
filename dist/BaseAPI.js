"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const request_promise_native_1 = __importDefault(require("request-promise-native"));
class BaseAPI {
    static setConfig(oConfig) {
        BaseAPI.CONFIG = oConfig;
    }
    ;
    static checkConfig() {
        if (!BaseAPI.CONFIG) {
            throw new Error('Missing API Config');
        }
    }
    ;
    static _includeAuthHeader(oOptions) {
        if (BaseAPI.ACCESS_TOKEN) {
            if (oOptions.headers === undefined) { // Make Typescript Happy
                oOptions.headers = {};
            }
            oOptions.headers['Authorization'] = 'Bearer ' + BaseAPI.ACCESS_TOKEN;
        }
    }
    static async _post(sPath, oParams) {
        BaseAPI.checkConfig();
        let oOptions = {
            uri: `http://${BaseAPI.CONFIG.domain.fabio}/${sPath}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Host': BaseAPI.CONFIG.domain.api
            },
            json: true,
            formData: oParams
        };
        BaseAPI._includeAuthHeader(oOptions);
        return await (0, request_promise_native_1.default)(oOptions);
    }
    ;
    static async _get(sPath, oGet) {
        BaseAPI.checkConfig();
        let oOptions = {
            uri: `http://${BaseAPI.CONFIG.domain.fabio}/${sPath}`,
            method: 'GET',
            headers: {
                'Host': BaseAPI.CONFIG.domain.api
            },
            json: true,
        };
        if (oGet) {
            oOptions.qs = oGet;
        }
        BaseAPI._includeAuthHeader(oOptions);
        return await (0, request_promise_native_1.default)(oOptions);
    }
    ;
    static async _jsonPost(sPath, oPost) {
        BaseAPI.checkConfig();
        let oOptions = {
            uri: `http://${BaseAPI.CONFIG.domain.fabio}/${sPath}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Host': BaseAPI.CONFIG.domain.api
            },
            json: true,
            body: oPost
        };
        BaseAPI._includeAuthHeader(oOptions);
        return await (0, request_promise_native_1.default)(oOptions);
    }
    ;
    static async auth(oTraceTags) {
        BaseAPI.checkConfig();
        let oPost = Object.assign({
            grant_type: 'client_credentials',
            client_id: BaseAPI.CONFIG.api.id,
            client_secret: BaseAPI.CONFIG.api.secret,
            scope: 'services'
        }, oTraceTags);
        const oResponse = await BaseAPI._jsonPost('v3/auth/client', oPost);
        if (oResponse.access_token) {
            BaseAPI.ACCESS_TOKEN = oResponse.access_token;
            return;
        }
        throw new Error('Api.NoToken');
    }
    ;
}
exports.default = BaseAPI;
