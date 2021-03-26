"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require('make-promises-safe');
const fs_1 = __importDefault(require("fs"));
const http_1 = __importDefault(require("http"));
const dot_object_1 = __importDefault(require("dot-object"));
const rsyslog_cee_1 = require("rsyslog-cee");
require('http-shutdown').extend();
const ConsulLib = require('consul');
const oConsulConfig = {
    promisify: true,
    host: '127.0.0.1'
};
if (process.env.CONSUL_HOST) {
    oConsulConfig.host = process.env.CONSUL_HOST;
}
const Consul = ConsulLib(oConsulConfig);
class WelcomeServer {
    constructor(sName, oHttpListener, mPortOrConfigPath, fAfterConfig) {
        this.sConfigPath = '';
        this.sConfigPrefix = '';
        this.aConfigPaths = [];
        this.iPort = 80;
        this.bInitOnce = false;
        // Check to see that we have access to the config file.  if so, update the config var, else retry
        // When consul-template is down or restarting, the config file will be missing.  This keeps
        // the server up and ready to start while consul-template gets itself together
        this.loadConfigFile = async () => {
            try {
                await fs_1.default.promises.access(this.sConfigPath, fs_1.default.constants.R_OK);
            }
            catch (oError) {
                this.oLogger.w('Server.Config.NotAvailable', { source: 'file', error: oError });
                WelcomeServer.iRetryCount++;
                if (WelcomeServer.iRetryCount < 10) {
                    setTimeout(this.loadConfigFile, 1000);
                    return;
                }
                throw oError;
            }
            try {
                const oConfig = require(this.sConfigPath); // Update the global config var
                this.oLogger.d('Server.Config.Ready', { source: 'file' });
                await this.updateConfig(oConfig);
            }
            catch (oError) {
                this.oLogger.e('Server.Config.Error', { source: 'file', error: oError });
            }
        };
        this.loadConfigConsul = async () => {
            const oFlatConfig = {};
            const aGets = this.aConfigPaths.map(async (sPath) => {
                const sSlashed = this.sConfigPrefix + '/' + sPath.replace(/\./g, '/');
                const oKey = await Consul.kv.get({ key: sSlashed });
                if (oKey) {
                    oFlatConfig[sPath] = oKey.Value;
                }
            });
            try {
                await Promise.all(aGets);
                const oConfig = dot_object_1.default.object(oFlatConfig);
                this.oLogger.d('Server.Config.Ready', { source: 'consul' });
                await this.updateConfig(oConfig);
            }
            catch (oError) {
                this.oLogger.w('Server.Config.NotAvailable', { source: 'consul', error: oError });
                setTimeout(this.loadConfigConsul, 1000);
            }
        };
        this.updateConfig = async (oConfig) => {
            this.oConfig = oConfig;
            if (this.fAfterConfig) {
                await this.fAfterConfig(this.oConfig, this.oLogger.getTraceTags());
            }
            if (this.sPortConfigPath) {
                this.iPort = dot_object_1.default.pick(this.sPortConfigPath, oConfig);
            }
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
        this.fAfterConfig = fAfterConfig;
        if (typeof mPortOrConfigPath === 'string') {
            this.sPortConfigPath = mPortOrConfigPath;
        }
        else {
            this.iPort = mPortOrConfigPath;
        }
        this.oLogger = new rsyslog_cee_1.Logger({
            service: `${sName}Server`
        });
    }
    async initWithConsulConfig(sConfigPrefix, aConfigPaths) {
        this.sConfigPrefix = sConfigPrefix;
        this.aConfigPaths = aConfigPaths;
        try {
            await this.loadConfigConsul();
            const oWatch = Consul.watch({
                method: Consul.kv.get,
                options: {
                    key: this.sConfigPrefix
                }
            });
            oWatch.on('change', this.loadConfigConsul);
        }
        catch (oError) {
            this.oLogger.e('Server.Config.Error', { error: oError });
        }
    }
    async initWithJsonConfig(sConfigPath) {
        this.sConfigPath = sConfigPath;
        // When our configs are updated a `reload` call is generated by systemd.  This handles that call to reload
        process.on('SIGHUP', async () => {
            this.oLogger.d('Server.Config.SigHUP_Reload');
            delete require.cache[this.sConfigPath];
            await this.loadConfigFile();
        });
        try {
            await this.loadConfigFile();
        }
        catch (oError) {
            this.oLogger.e('Server.Config.Error', { error: oError });
        }
    }
}
exports.default = WelcomeServer;
WelcomeServer.iRetryCount = 0;
