require('make-promises-safe');

import fs          from 'fs';
import http        from 'http';
import Dot         from 'dot-object';

import {Logger}    from 'rsyslog-cee';
import {TraceTags} from "rsyslog-cee/src/Logger";

const HttpTerminator = require("lil-http-terminator");;

const ConsulLib = require('consul');
const CONSUL_CONFIG = {
    promisify: true,
    host: '127.0.0.1'
};

if (process.env.CONSUL_HOST) {
    CONSUL_CONFIG.host = process.env.CONSUL_HOST;
}

export type HttpListener = (oRequest: http.IncomingMessage, oResponse: http.ServerResponse) => Promise<void>;
export type AfterConfig  = (oConfig: any, oTraceTags: TraceTags) => Promise<void>;

export default class WelcomeServer<AppConfig> {
    public oLogger: Logger;

    private sConfigPath: string     = '';
    private aConfigPaths: string[]  = [];
    private sPortConfigPath: string | undefined;

    private oConsul: any;
    private iPort: number = 80;
    private bInitOnce: boolean = false;
    private oHTTPServer: http.Server | undefined;
    private readonly oHttpListener: HttpListener;
    private fAfterConfig: AfterConfig | undefined;
    private oConfig: AppConfig | undefined;
    private oTerminator: any;

    private static iRetryCount = 0;

    // Check to see that we have access to the config file.  if so, update the config var, else retry
    // When consul-template is down or restarting, the config file will be missing.  This keeps
    // the server up and ready to start while consul-template gets itself together
    private loadConfigFile = async () => {
        try {
            await fs.promises.access(this.sConfigPath, fs.constants.R_OK);
        } catch (oError) {
            this.oLogger.w('Server.Config.NotAvailable', {source: 'file', error: oError});
            WelcomeServer.iRetryCount++;

            if (WelcomeServer.iRetryCount < 10) {
                setTimeout(this.loadConfigFile, 1000);
                return;
            }

            throw oError;
        }

        try {
            const oConfig = <AppConfig> require(this.sConfigPath); // Update the global config var
            await this.updateConfig(oConfig);

            this.oLogger.d('Server.Config.Ready', {source: 'file'});
        } catch (oError) {
            this.oLogger.e('Server.Config.Error', {source: 'file', error: oError});
        }
    };

    private loadConfigConsul = async () => {
        const oFlatConfig: {[key: string]: string} = {};
        const aGets = this.aConfigPaths.map(async (sPath) => {
            const sSlashed = sPath.replace(/\./g, '/');
            const oKey     = await this.oConsul.kv.get({key: sSlashed});
            if (oKey) {
                oFlatConfig[sPath] = oKey.Value;
            }
        });

        try {
            await Promise.all(aGets);
            const oConfig = Dot.object(oFlatConfig);
            await this.updateConfig(<AppConfig> <unknown> oConfig);

            this.oLogger.d('Server.Config.Ready', {source: 'consul'});
        } catch (oError) {
            this.oLogger.w('Server.Config.NotAvailable', {source: 'consul', error: oError});
            setTimeout(this.loadConfigConsul, 1000);
        }
    };

    private updateConfig = async (oConfig: AppConfig) => {
        this.oConfig = oConfig;

        if (this.sPortConfigPath) {
            this.iPort = Dot.pick(this.sPortConfigPath, oConfig);
        }

        if (this.fAfterConfig) {
            await this.fAfterConfig(this.oConfig, this.oLogger.getTraceTags());
        }
    };

    private bTerminating: boolean = false;

    private shutdown = async(): Promise<boolean> => {
        if (this.bTerminating) {
            return false;
        }

        this.bTerminating = true;

        const { bSuccess, sCode, sMessage, oError } = await this.oTerminator.terminate();
        if (!bSuccess) {
            switch(sCode) {
                case "TIMED_OUT":
                    this.oLogger.w('Server.Config.Changed', {state: sCode});
                    break;

                case "SERVER_ERROR":
                case "INTERNAL_ERROR":
                    this.oLogger.e('Server.Config.Changed', {state: sCode, error: sMessage});
                    break;
            }
        }

        this.bTerminating = false;

        return true;
    };

    private restart = async() => {
        const bReady = await this.shutdown();

        if (this.oHTTPServer && bReady) {
            this.oHTTPServer.listen(this.iPort);
            this.oLogger.d('Server.Restarted', {port: this.iPort});
            this.oLogger.summary('Init');
        }
    };

    public listen = async () => {
        if (!this.bInitOnce) {
            this.bInitOnce = true;

            // Fire up the node server - initialize the http-shutdown plugin which will gracefully shutdown the server after it's done working
            this.oHTTPServer = http.createServer(this.oHttpListener);
            this.oHTTPServer.listen(this.iPort);

            this.oTerminator = HttpTerminator({
                server:                     this.oHTTPServer,
                gracefulTerminationTimeout: 1000,   // optional, how much time we give "keep-alive" connections to close before destryong them
            });

            this.oLogger.d('Server.Started', {port: this.iPort});
            this.oLogger.summary('Init');
        } else {
            // we've initialized before, so this must be a restart due to a config change
            this.oLogger.d('Server.Config.Changed');

            this.restart();
        }
    }

    constructor(sName: string, oHttpListener: HttpListener, iPort: number); // No Config
    constructor(sName: string, oHttpListener: HttpListener, iPort: number, fAfterConfig: AfterConfig | undefined); // With Port
    constructor(sName: string, oHttpListener: HttpListener, sPortConfigPath: string, fAfterConfig: AfterConfig | undefined); // With Config Path
    constructor(sName: string, oHttpListener: HttpListener, mPortOrConfigPath: string | number, fAfterConfig: AfterConfig | undefined = undefined) {
        this.oHttpListener   = oHttpListener;
        this.fAfterConfig    = fAfterConfig;

        if (typeof mPortOrConfigPath === 'string') {
            this.sPortConfigPath = mPortOrConfigPath;
        } else {
            this.iPort = mPortOrConfigPath;
        }

        this.oLogger = new Logger({
            service: `${sName}Server`
        });
    }

    async loadConsulConfig(aConfigPaths: string[]): Promise<AppConfig | undefined> {
        this.aConfigPaths    = aConfigPaths;
        this.oConsul         = ConsulLib(CONSUL_CONFIG);

        try {
            await this.loadConfigConsul();

            if (this.aConfigPaths.length) {
                this.aConfigPaths.forEach(sPath => {
                    const oWatch = this.oConsul.watch({
                        method: this.oConsul.kv.get,
                        options: {
                            key: sPath
                        }
                    });

                    oWatch.on('change', async () => {
                        await this.loadConfigConsul();
                        this.listen();
                    });
                })
            }
        } catch (oError) {
            this.oLogger.e('Server.Config.Error', {error: oError});
        }

        return this.oConfig;
    }

    async loadJsonConfig(sConfigPath: string): Promise<AppConfig | undefined> {
        this.sConfigPath = sConfigPath;

        process.on("SIGTERM", this.shutdown);
        process.on("SIGINT",  this.shutdown);

        // When our configs are updated a `reload` call is generated by systemd.  This handles that call to reload
        process.on('SIGHUP', async () => {
            this.oLogger.d('Server.Config.SigHUP_Reload');
            delete require.cache[this.sConfigPath];
            await this.loadConfigFile()
            this.listen();
        });

        try {
            await this.loadConfigFile();
        } catch(oError) {
            this.oLogger.e('Server.Config.Error', {error: oError});
        }

        return this.oConfig;
    }
}