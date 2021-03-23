"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require('make-promises-safe');
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const rsyslog_cee_1 = require("rsyslog-cee");
const Consul = require('consul')({ promisify: true });
require('http-shutdown').extend();
const fsPromises = fs_1.default.promises;
class WelcomeServer {
    constructor(sName, oHttpListener) {
        this.sConfigPath = '';
        this.sConfigPrefix = '';
        this.aConfigPaths = [];
        this.sPortConfigPath = '';
        this.bInitOnce = false;
        // Check to see that we have access to the config file.  if so, update the config var, else retry
        // When consul-template is down or restarting, the config file will be missing.  This keeps
        // the server up and ready to start while consul-template gets itself together
        this.loadConfigFile = async () => {
            fsPromises.access(this.sConfigPath, fs_1.default.constants.R_OK)
                .then(() => {
                const oConfig = require(this.sConfigPath); // Update the global config var
                this.oLogger.d('Server.Config.Ready');
                this.updateConfig(oConfig).catch(oError => {
                    this.oLogger.e('Server.Config.Error', { error: oError });
                });
            })
                .catch(oError => {
                this.oLogger.w('Server.Config.NotAvailable', { error: oError });
                setTimeout(this.loadConfigFile, 1000);
            });
        };
        // Check to see that we have access to the config file.  if so, update the config var, else retry
        // When consul-template is down or restarting, the config file will be missing.  This keeps
        // the server up and ready to start while consul-template gets itself together
        this.loadConfigConsul = async () => {
            const oFlatConfig = {};
            const aGets = this.aConfigPaths.map(async (sPath) => {
                const oKey = await Consul.kv.get({ key: this.sConfigPrefix + '/' + sPath });
                if (oKey) {
                    oFlatConfig[sPath] = oKey.Value;
                }
            });
            try {
                await Promise.all(aGets);
                const oConfig = {};
                Object.keys(oFlatConfig).map(sPath => {
                    const aPath = sPath.split('/');
                    const iPath = aPath.length;
                    aPath.reduce((oConfig, sValue, iIndex) => {
                        if (iIndex === iPath - 1) {
                            oConfig[sValue] = oFlatConfig[sPath];
                        }
                        return oConfig[sValue];
                    });
                });
                this.oLogger.d('Server.Config.Ready');
                this.updateConfig(oConfig).catch(oError => {
                    this.oLogger.e('Server.Config.Error', { error: oError });
                });
            }
            catch (e) {
                this.oLogger.w('Server.Config.NotAvailable');
                setTimeout(this.loadConfigConsul, 1000);
            }
        };
        this.updateConfig = async (oConfig) => {
            this.oConfig = oConfig;
            if (this.fAfterConfig) {
                this.fAfterConfig(this.oConfig, this.oLogger.getTraceTags());
            }
            this.iPort = this.getPort(this.oConfig);
            if (!this.bInitOnce) {
                this.bInitOnce = true;
                // Fire up the node server - initialize the http-shutdown plugin which will gracefully shutdown the server after it's done working
                this.oHTTPServer = http_1.default.createServer(this.oHttpListener);
                this.oHTTPServer.withShutdown();
                this.oHTTPServer.listen(this.iPort);
                this.oLogger.d('Server.Started', { port: this.iPort });
                this.oLogger.summary('Init');
            }
            else {
                // we've initialized before, so this must be a restart due to a config change
                this.oLogger.d('Server.Config.Changed');
                this.oHTTPServer.shutdown(() => {
                    this.oHTTPServer.listen(this.iPort);
                    this.oLogger.d('Server.Restarted', { port: this.iPort });
                    this.oLogger.summary('Init');
                });
            }
        };
        this.oHttpListener = oHttpListener;
        this.oLogger = new rsyslog_cee_1.Logger({
            service: `${sName}Server`
        });
    }
    // https://stackoverflow.com/a/22129960/14651
    getPort(oConfig) {
        // @ts-ignore
        return this.sPortConfigPath.split('.').reduce((prev, curr) => prev && prev[curr], oConfig);
    }
    initWithConsulConfig(sConfigPrefix, aConfigPaths, sPortConfigPath, fAfterConfig) {
        this.sConfigPrefix = sConfigPrefix;
        this.aConfigPaths = aConfigPaths;
        this.sPortConfigPath = sPortConfigPath;
        this.fAfterConfig = fAfterConfig;
        // When our configs are updated a `reload` call is generated by systemd.  This handles that call to reload
        process.on('SIGHUP', async () => {
            this.oLogger.d('Server.Config.SigHUP_Reload');
            delete require.cache[this.sConfigPath];
            await this.loadConfigConsul();
        });
        this.loadConfigConsul().catch(oError => {
            this.oLogger.e('Server.Config.Error', { error: oError });
        });
    }
    initWithJsonConfig(sConfigPath, sPortConfigPath, fAfterConfig) {
        this.sConfigPath = sConfigPath;
        this.sPortConfigPath = sPortConfigPath;
        this.fAfterConfig = fAfterConfig;
        // When our configs are updated a `reload` call is generated by systemd.  This handles that call to reload
        process.on('SIGHUP', async () => {
            this.oLogger.d('Server.Config.SigHUP_Reload');
            delete require.cache[this.sConfigPath];
            await this.loadConfigFile();
        });
        this.loadConfigFile().catch(oError => {
            this.oLogger.e('Server.Config.Error', { error: oError });
        });
    }
}
exports.default = WelcomeServer;
