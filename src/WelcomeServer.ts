require('make-promises-safe');

import fs          from 'fs';
import http        from 'http';

import {Logger}    from 'rsyslog-cee';
import {TraceTags} from "rsyslog-cee/src/Logger";

const Consul = require('consul')({promisify: true});

require('http-shutdown').extend();

const fsPromises  = fs.promises;

export type HttpListener = (oRequest: http.IncomingMessage, oResponse: http.ServerResponse) => Promise<void>;
export type AfterConfig  = (oConfig: any, oTraceTags: TraceTags) => Promise<void>;

export default class WelcomeServer<AppConfig> {
    private sConfigPath: string     = '';
    private sConfigPrefix: string   = '';
    private aConfigPaths: string[]  = [];
    private sPortConfigPath: string = '';

    private iPort: number | undefined;
    private bInitOnce: boolean = false;
    private oLogger: Logger;
    private oHTTPServer: any; // cannot be http.Server because it also has the shutdown method
    private oHttpListener: HttpListener;
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

    // Check to see that we have access to the config file.  if so, update the config var, else retry
    // When consul-template is down or restarting, the config file will be missing.  This keeps
    // the server up and ready to start while consul-template gets itself together
    private loadConfigConsul = async () => {
        const oFlatConfig: {[key: string]: string} = {};
        const aGets = this.aConfigPaths.map(async (sPath) => {
            const oKey = await Consul.kv.get({key: this.sConfigPrefix + '/' + sPath});
            if (oKey) {
                oFlatConfig[sPath] = oKey.Value;
            }
        });

        try {
            await Promise.all(aGets);

            const oConfig: {[key: string]: string} = {};
            Object.keys(oFlatConfig).map(sPath => {
                const aPath = sPath.split('/');
                const iPath = aPath.length;
                aPath.reduce( (oConfig: any, sValue: string, iIndex: number) => {
                    if (iIndex === iPath - 1) {
                        oConfig[sValue] = oFlatConfig[sPath]
                    }

                    return oConfig[sValue];
                });
            });

            this.oLogger.d('Server.Config.Ready');
            this.updateConfig(<AppConfig> <unknown> oConfig).catch(oError => {
                this.oLogger.e('Server.Config.Error', {error: oError});
            });
        } catch (e) {
            this.oLogger.w('Server.Config.NotAvailable');
            setTimeout(this.loadConfigConsul, 1000);
        }
    };

    private updateConfig = async (oConfig: AppConfig) => {
        this.oConfig = oConfig;

        if (this.fAfterConfig) {
            this.fAfterConfig(this.oConfig, this.oLogger.getTraceTags());
        }

        this.iPort = this.getPort(this.oConfig);

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

    // https://stackoverflow.com/a/22129960/14651
    private getPort(oConfig: AppConfig): any {
        // @ts-ignore
        return this.sPortConfigPath.split('.').reduce((prev, curr) => prev && prev[curr], oConfig)
    }

    constructor(sName: string, oHttpListener: HttpListener) {
        this.oHttpListener   = oHttpListener;

        this.oLogger = new Logger({
            service: `${sName}Server`
        });
    }

    initWithConsulConfig(sConfigPrefix: string, aConfigPaths: string[], sPortConfigPath: string, fAfterConfig: AfterConfig) {
        this.sConfigPrefix   = sConfigPrefix;
        this.aConfigPaths    = aConfigPaths;
        this.sPortConfigPath = sPortConfigPath;
        this.fAfterConfig    = fAfterConfig;

        // When our configs are updated a `reload` call is generated by systemd.  This handles that call to reload
        process.on('SIGHUP', async () => {
            this.oLogger.d('Server.Config.SigHUP_Reload');
            delete require.cache[this.sConfigPath];
            await this.loadConfigConsul()
        });

        this.loadConfigConsul().catch(oError => {
            this.oLogger.e('Server.Config.Error', {error: oError});
        });
    }

    initWithJsonConfig(sConfigPath: string, sPortConfigPath: string, fAfterConfig: AfterConfig) {
        this.sConfigPath     = sConfigPath;
        this.sPortConfigPath = sPortConfigPath;
        this.fAfterConfig    = fAfterConfig;

        // When our configs are updated a `reload` call is generated by systemd.  This handles that call to reload
        process.on('SIGHUP', async () => {
            this.oLogger.d('Server.Config.SigHUP_Reload');
            delete require.cache[this.sConfigPath];
            await this.loadConfigFile()
        });

        this.loadConfigFile().catch(oError => {
            this.oLogger.e('Server.Config.Error', {error: oError});
        });
    }
}