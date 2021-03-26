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

const fsPromises  = fs.promises;

export type HttpListener = (oRequest: http.IncomingMessage, oResponse: http.ServerResponse) => Promise<void>;
export type AfterConfig  = (oConfig: any, oTraceTags: TraceTags) => Promise<void>;

export default class WelcomeServer<AppConfig> {
    private sConfigPath: string     = '';
    private sConfigPrefix: string   = '';
    private aConfigPaths: string[]  = [];
    private sPortConfigPath: string | undefined;

    private iPort: number = 80;
    private bInitOnce: boolean = false;
    private oLogger: Logger;
    private oHTTPServer: any; // cannot be http.Server because it also has the shutdown method
    private readonly oHttpListener: HttpListener;
    private fAfterConfig: AfterConfig | undefined;
    private oConfig: AppConfig | undefined;

    // Check to see that we have access to the config file.  if so, update the config var, else retry
    // When consul-template is down or restarting, the config file will be missing.  This keeps
    // the server up and ready to start while consul-template gets itself together
    private loadConfigFile = async () => {
        fsPromises.access(this.sConfigPath, fs.constants.R_OK)
            .then(() => {
                const oConfig = <AppConfig> require(this.sConfigPath); // Update the global config var

                this.oLogger.d('Server.Config.Ready');
                this.updateConfig(oConfig).catch(oError => {
                    this.oLogger.e('Server.Config.Error', {error: oError});
                });
            })
            .catch(oError => {
                this.oLogger.w('Server.Config.NotAvailable', {error: oError});
                setTimeout(this.loadConfigFile, 1000);
            });
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

            this.oLogger.d('Server.Config.Ready');
            await this.updateConfig(<AppConfig> <unknown> oConfig);
        } catch (oError) {
            this.oLogger.w('Server.Config.NotAvailable', {error: oError});
            setTimeout(this.loadConfigConsul, 1000);
        }
    };

    private updateConfig = async (oConfig: AppConfig) => {
        this.oConfig = oConfig;

        if (this.fAfterConfig) {
            await this.fAfterConfig(this.oConfig, this.oLogger.getTraceTags());
        }

        if (this.sPortConfigPath) {
            this.iPort = Dot.pick(this.sPortConfigPath, oConfig);
        }

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

    };

    constructor(sName: string, oHttpListener: HttpListener, sConfigPath: string, fAfterConfig: AfterConfig);
    constructor(sName: string, oHttpListener: HttpListener, iPort: number, fAfterConfig: AfterConfig);
    constructor(sName: string, oHttpListener: HttpListener, mPortOrConfigPath: string | number, fAfterConfig: AfterConfig) {
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

    async initWithConsulConfig(sConfigPrefix: string, aConfigPaths: string[]) {
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

            oWatch.on('change', this.loadConfigConsul);
        } catch (oError) {
            this.oLogger.e('Server.Config.Error', {error: oError});
        }
    }

    async initWithJsonConfig(sConfigPath: string) {
        this.sConfigPath     = sConfigPath;

        // When our configs are updated a `reload` call is generated by systemd.  This handles that call to reload
        process.on('SIGHUP', async () => {
            this.oLogger.d('Server.Config.SigHUP_Reload');
            delete require.cache[this.sConfigPath];
            await this.loadConfigFile()
        });

        try {
            await this.loadConfigFile();
        } catch(oError) {
            this.oLogger.e('Server.Config.Error', {error: oError});
        }
    }
}