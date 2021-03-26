/// <reference types="node" />
import http from 'http';
import { Logger } from 'rsyslog-cee';
import { TraceTags } from "rsyslog-cee/src/Logger";
export declare type HttpListener = (oRequest: http.IncomingMessage, oResponse: http.ServerResponse) => Promise<void>;
export declare type AfterConfig = (oConfig: any, oTraceTags: TraceTags) => Promise<void>;
export default class WelcomeServer<AppConfig> {
    oLogger: Logger;
    private sConfigPath;
    private sConfigPrefix;
    private aConfigPaths;
    private sPortConfigPath;
    private oConsul;
    private iPort;
    private bInitOnce;
    private oHTTPServer;
    private readonly oHttpListener;
    private fAfterConfig;
    private oConfig;
    private static iRetryCount;
    private loadConfigFile;
    private loadConfigConsul;
    private updateConfig;
    listen: () => Promise<void>;
    constructor(sName: string, oHttpListener: HttpListener, iPort: number);
    constructor(sName: string, oHttpListener: HttpListener, iPort: number, fAfterConfig: AfterConfig | undefined);
    constructor(sName: string, oHttpListener: HttpListener, sPortConfigPath: string, fAfterConfig: AfterConfig | undefined);
    loadConsulConfig(sConfigPrefix: string, aConfigPaths: string[]): Promise<AppConfig | undefined>;
    loadJsonConfig(sConfigPath: string): Promise<AppConfig | undefined>;
}
