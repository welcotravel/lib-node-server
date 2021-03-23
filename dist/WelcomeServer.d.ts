/// <reference types="node" />
import http from 'http';
import { TraceTags } from "rsyslog-cee/src/Logger";
export declare type HttpListener = (oRequest: http.IncomingMessage, oResponse: http.ServerResponse) => Promise<void>;
export declare type AfterConfig = (oConfig: any, oTraceTags: TraceTags) => Promise<void>;
export default class WelcomeServer<AppConfig> {
    private sConfigPath;
    private sConfigPrefix;
    private aConfigPaths;
    private sPortConfigPath;
    private iPort;
    private bInitOnce;
    private oLogger;
    private oHTTPServer;
    private oHttpListener;
    private fAfterConfig;
    private oConfig;
    private loadConfigFile;
    private loadConfigConsul;
    private updateConfig;
    constructor(sName: string, oHttpListener: HttpListener);
    initWithConsulConfig(sConfigPrefix: string, aConfigPaths: string[], sPortConfigPath: string, fAfterConfig: AfterConfig): Promise<void>;
    initWithJsonConfig(sConfigPath: string, sPortConfigPath: string, fAfterConfig: AfterConfig): Promise<void>;
}
