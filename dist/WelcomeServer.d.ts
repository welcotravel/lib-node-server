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
    private readonly oHttpListener;
    private fAfterConfig;
    private oConfig;
    private static iRetryCount;
    private loadConfigFile;
    private loadConfigConsul;
    private updateConfig;
    private listen;
    constructor(sName: string, oHttpListener: HttpListener, iPort: number, fAfterConfig: undefined);
    constructor(sName: string, oHttpListener: HttpListener, iPort: number, fAfterConfig: AfterConfig | undefined);
    constructor(sName: string, oHttpListener: HttpListener, sPortConfigPath: string, fAfterConfig: AfterConfig | undefined);
    initWithoutConfig(): Promise<void>;
    initWithConsulConfig(sConfigPrefix: string, aConfigPaths: string[]): Promise<void>;
    initWithJsonConfig(sConfigPath: string): Promise<void>;
}
