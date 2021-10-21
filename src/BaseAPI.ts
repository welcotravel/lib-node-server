    import {UriOptions} from "request";

    export type BaseAPIConfig = {
        domain: {
            fabio: string,
            api: string
        },
        api: {
            scope: string,
            id: string,
            secret: string
        }
    }

    type AuthResponse = {
        access_token?: string
    }

    type Params = {
        [param: string]: any
    }

    import request, {RequestPromiseOptions} from 'request-promise-native';

    import {TraceTags}      from 'rsyslog-cee/dist/Logger';

    export default class BaseAPI {
        static CONFIG: BaseAPIConfig;
        static ACCESS_TOKEN: string;

        static setConfig(oConfig: BaseAPIConfig) {
            BaseAPI.CONFIG = oConfig;
        };

        static checkConfig() {
            if (!BaseAPI.CONFIG) {
                throw new Error('Missing API Config');
            }
        };

        protected static _includeAuthHeader (oOptions: UriOptions & RequestPromiseOptions) {
            if (BaseAPI.ACCESS_TOKEN) {
                if (oOptions.headers === undefined) { // Make Typescript Happy
                    oOptions.headers = {};
                }

                oOptions.headers['Authorization'] = 'Bearer ' + BaseAPI.ACCESS_TOKEN;
            }
        }

        protected static async _post (sPath: string, oParams: Params) {
            BaseAPI.checkConfig();

            let oOptions: UriOptions & RequestPromiseOptions = {
                uri:      `http://${BaseAPI.CONFIG.domain.fabio}/${sPath}`,
                method:   'POST',
                headers:  {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Host': BaseAPI.CONFIG.domain.api
                },
                json:     true,
                formData: oParams
            };

            BaseAPI._includeAuthHeader(oOptions);

            return await request(oOptions);
        };

        protected static async _get (sPath: string, oGet?: {[parameters: string]: any}) {
            BaseAPI.checkConfig();

            let oOptions: UriOptions & RequestPromiseOptions = {
                uri:      `http://${BaseAPI.CONFIG.domain.fabio}/${sPath}`,
                method:   'GET',
                headers:  {
                    'Host': BaseAPI.CONFIG.domain.api
                },
                json:     true,
            };

            if (oGet) {
                oOptions.qs = oGet;
            }

            BaseAPI._includeAuthHeader(oOptions);

            return await request(oOptions);
        };

        protected static async _jsonPost(sPath: string, oPost: {[parameters: string]: any}) {
            BaseAPI.checkConfig();

            let oOptions: UriOptions & RequestPromiseOptions = {
                uri:      `http://${BaseAPI.CONFIG.domain.fabio}/${sPath}`,
                method:   'POST',
                headers:  {
                    'Content-Type':   'application/json',
                    'Host': BaseAPI.CONFIG.domain.api
                },
                json: true,
                body: oPost
            };

            BaseAPI._includeAuthHeader(oOptions);

            return await request(oOptions);
        };

        static async auth (oTraceTags: TraceTags) {
            BaseAPI.checkConfig();

            let oPost = Object.assign({
                grant_type:    'client_credentials',
                client_id:     BaseAPI.CONFIG.api.id,
                client_secret: BaseAPI.CONFIG.api.secret,
                scope:         BaseAPI.CONFIG.api.scope
            }, oTraceTags);

            const oResponse = await <AuthResponse> BaseAPI._jsonPost('v3/auth/client', oPost);

            if (oResponse.access_token) {
                BaseAPI.ACCESS_TOKEN = oResponse.access_token;
                return;
            }

            throw new Error('Api.NoToken');
        };
    }