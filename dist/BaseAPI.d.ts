import { UriOptions } from "request";
export declare type BaseAPIConfig = {
    domain: {
        fabio: string;
        api: string;
    };
    api: {
        scope: string;
        id: string;
        secret: string;
    };
};
declare type Params = {
    [param: string]: any;
};
import { RequestPromiseOptions } from 'request-promise-native';
import { TraceTags } from 'rsyslog-cee/dist/Logger';
export default class BaseAPI {
    static CONFIG: BaseAPIConfig;
    static ACCESS_TOKEN: string;
    static setConfig(oConfig: BaseAPIConfig): void;
    static checkConfig(): void;
    protected static _includeAuthHeader(oOptions: UriOptions & RequestPromiseOptions): void;
    protected static _post(sPath: string, oParams: Params): Promise<any>;
    protected static _get(sPath: string, oGet?: {
        [parameters: string]: any;
    }): Promise<any>;
    protected static _jsonPost(sPath: string, oPost: {
        [parameters: string]: any;
    }): Promise<any>;
    static auth(oTraceTags: TraceTags): Promise<void>;
}
export {};
