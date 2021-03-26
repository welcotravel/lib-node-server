require('make-promises-safe');

import fs          from 'fs';
import http        from 'http';
import Dot         from 'dot-object';

import {Logger}    from 'rsyslog-cee';
import {TraceTags} from "rsyslog-cee/src/Logger";

require('http-shutdown').extend();

const ConsulLib = require('consul');
const oConsulConfig = {
    promisify: true,
    host: '127.0.0.1'
};

if (process.env.CONSUL_HOST) {
    oConsulConfig.host = process.env.CONSUL_HOST;
}

const Consul = ConsulLib(oConsulConfig)

export type HttpListener = (oRequest: http.IncomingMessage, oResponse: http.ServerResponse) => Promise<void>;
export type AfterConfig  = (oConfig: any, oTraceTags: TraceTags) => Promise<void>;

export default class WelcomeServer<AppConfig> {
    public oLogger: Logger;

    private sConfigPath: string     = '';
    private sConfigPrefix: string   = '';
    private aConfigPaths: string[]  = [];
    private sPortConfigPath: string | undefined;

    private iPort: number = 80;
    private bInitOnce: boolean = false;
    private oHTTPServer: any; // cannot be http.Server because it also has the shutdown method
    private readonly oHttpListener: HttpListener;
    private fAfterConfig: AfterConfig | undefined;
    private oConfig: AppConfig | undefined;

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
            this.updateConfig(oConfig);

            this.oLogger.d('Server.Config.Ready', {source: 'file'});
        } catch (oError) {
            this.oLogger.e('Server.Config.Error', {source: 'file', error: oError});
        }
    };

    private loadConfigConsul = async () => {
        const oFlatConfig: {[key: string]: string} = {};
        const aGets = this.aConfigPaths.map(async (sPath) => {
            const sSlashed = this.sConfigPrefix + '/' + sPath.replace(/\./g, '/');
            const oKey     = await Consul.kv.get({key: sSlashed});
            if (oKey) {
                oFlatConfig[sPath] = oKey.Value;
            }
        });

        try {
            await Promise.all(aGets);
            const oConfig = Dot.object(oFlatConfig);
            this.updateConfig(<AppConfig> <unknown> oConfig);

            this.oLogger.d('Server.Config.Ready', {source: 'consul'});
        } catch (oError) {
            this.oLogger.w('Server.Config.NotAvailable', {source: 'consul', error: oError});
            setTimeout(this.loadConfigConsul, 1000);
        }
    };

    private updateConfig = (oConfig: AppConfig) => {
        this.oConfig = oConfig;

        if (this.sPortConfigPath) {
            this.iPort = Dot.pick(this.sPortConfigPath, oConfig);
        }
    };

    public listen = async () => {
        if (!this.bInitOnce) {
            this.bInitOnce = true;

            // Fire up the node server - initialize the http-shutdown plugin which will gracefully shutdown the server after it's done working
            this.oHTTPServer = http.createServer(this.oHttpListener);
            this.oHTTPServer.withShutdown();
            this.oHTTPServer.listen(this.iPort);

            this.oLogger.d('Server.Started', {port: this.iPort});
            this.oLogger.summary('Init');
        } else {
            // we've initialized before, so this must be a restart due to a config change
            this.oLogger.d('Server.Config.Changed');
            this.oHTTPServer.shutdown(() => {
                this.oHTTPServer.listen(this.iPort);
                this.oLogger.d('Server.Restarted', {port: this.iPort});
                this.oLogger.summary('Init');
            });
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

    async loadConsulConfig(sConfigPrefix: string, aConfigPaths: string[]): Promise<AppConfig | undefined> {
        this.sConfigPrefix   = sConfigPrefix;
        this.aConfigPaths    = aConfigPaths;

        try {
            await this.loadConfigConsul();

            const oWatch = Consul.watch({
                method: Consul.kv.get,
                options: {
                    key: this.sConfigPrefix
                }
            });

            oWatch.on('change', async () => {
                await this.loadConfigConsul();
                this.listen();
            });
        } catch (oError) {
            this.oLogger.e('Server.Config.Error', {error: oError});
        }

        return this.oConfig;
    }

    async loadJsonConfig(sConfigPath: string): Promise<AppConfig | undefined> {
        this.sConfigPath     = sConfigPath;

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