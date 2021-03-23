/// <reference types="node" />
import http from 'http';
import { TraceTags } from "rsyslog-cee/src/Logger";
export declare type HttpListener = (oRequest: http.IncomingMessage, oResponse: http.ServerResponse) => Promise<void>;
export declare type AfterConfig = (oConfig: any, oTraceTags: TraceTags) => Promise<void>;
export default class WelcomeServer<AppConfig> {
    private sConfigPath;
    private aConfigPaths;
    private sPortConfigPath;
    private bInitOnce;
    private oLogger;
    private oHTTPServer;
    private oHttpListener;
    private fAfterConfig;
    private loadConfigFile;
    private loadConfigConsul;
    private updateConfig;
    private getPort;
    constructor(sName: string, sPortConfigPath: string, oHttpListener: HttpListener, fAfterConfig: AfterConfig);
    initWithConsulConfig(aConfigPaths: string[]): void;
    initWithJsonConfig(sConfigPath: string): void;
}
