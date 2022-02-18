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
const HttpTerminator = require("lil-http-terminator");
;
const ConsulLib = require('consul');
const CONSUL_CONFIG = {
    promisify: true,
    host: '127.0.0.1'
};
if (process.env.CONSUL_HOST) {
    CONSUL_CONFIG.host = process.env.CONSUL_HOST;
}
class WelcomeServer {
    constructor(sName, oHttpListener, mPortOrConfigPath, fAfterConfig = undefined) {
        this.sConfigPath = '';
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
                await this.updateConfig(oConfig);
                this.oLogger.d('Server.Config.Ready', { source: 'file' });
            }
            catch (oError) {
                this.oLogger.e('Server.Config.Error', { source: 'file', error: oError });
            }
        };
        this.loadConfigConsul = async () => {
            const oFlatConfig = {};
            const aGets = this.aConfigPaths.map(async (sPath) => {
                const sSlashed = sPath.replace(/\./g, '/');
                const oKey = await this.oConsul.kv.get({ key: sSlashed });
                if (oKey) {
                    oFlatConfig[sPath] = oKey.Value;
                }
            });
            try {
                await Promise.all(aGets);
                const oConfig = dot_object_1.default.object(oFlatConfig);
                await this.updateConfig(oConfig);
                this.oLogger.d('Server.Config.Ready', { source: 'consul' });
            }
            catch (oError) {
                this.oLogger.w('Server.Config.NotAvailable', { source: 'consul', error: oError });
                setTimeout(this.loadConfigConsul, 1000);
            }
        };
        this.updateConfig = async (oConfig) => {
            this.oConfig = oConfig;
            if (this.sPortConfigPath) {
                this.iPort = dot_object_1.default.pick(this.sPortConfigPath, oConfig);
            }
            if (this.fAfterConfig) {
                await this.fAfterConfig(this.oConfig, this.oLogger.getTraceTags());
            }
        };
        this.bTerminating = false;
        this.shutdown = async () => {
            if (this.bTerminating) {
                return false;
            }
            this.bTerminating = true;
            const { bSuccess, sCode, sMessage, oError } = await this.oTerminator.terminate();
            if (!bSuccess) {
                switch (sCode) {
                    case "TIMED_OUT":
                        this.oLogger.w('Server.Config.Changed', { state: sCode });
                        break;
                    case "SERVER_ERROR":
                    case "INTERNAL_ERROR":
                        this.oLogger.e('Server.Config.Changed', { state: sCode, error: sMessage });
                        break;
                }
            }
            this.bTerminating = false;
            return true;
        };
        this.restart = async () => {
            const bReady = await this.shutdown();
            if (this.oHTTPServer && bReady) {
                try {
                    this.oHTTPServer.listen(this.iPort);
                    this.oLogger.d('Server.Restarted', { port: this.iPort });
                    this.oLogger.summary('Init');
                }
                catch (e) {
                    // @ts-ignore
                    this.oLogger.e('Server.Restart', { error: e.message });
                }
            }
        };
        this.listen = async () => {
            if (!this.bInitOnce) {
                this.bInitOnce = true;
                // Fire up the node server - initialize the http-shutdown plugin which will gracefully shutdown the server after it's done working
                this.oHTTPServer = http_1.default.createServer(this.oHttpListener);
                this.oHTTPServer.listen(this.iPort);
                this.oTerminator = HttpTerminator({
                    server: this.oHTTPServer,
                    gracefulTerminationTimeout: 1000, // optional, how much time we give "keep-alive" connections to close before destryong them
                });
                this.oLogger.d('Server.Started', { port: this.iPort });
                this.oLogger.summary('Init');
            }
            else {
                // we've initialized before, so this must be a restart due to a config change
                this.oLogger.d('Server.Config.Changed');
                this.restart();
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
    async loadConsulConfig(aConfigPaths) {
        this.aConfigPaths = aConfigPaths;
        this.oConsul = ConsulLib(CONSUL_CONFIG);
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
                });
            }
        }
        catch (oError) {
            this.oLogger.e('Server.Config.Error', { error: oError });
        }
        return this.oConfig;
    }
    async loadJsonConfig(sConfigPath) {
        this.sConfigPath = sConfigPath;
        process.on("SIGTERM", this.shutdown);
        process.on("SIGINT", this.shutdown);
        // When our configs are updated a `reload` call is generated by systemd.  This handles that call to reload
        process.on('SIGHUP', async () => {
            this.oLogger.d('Server.Config.SigHUP_Reload');
            delete require.cache[this.sConfigPath];
            await this.loadConfigFile();
            this.listen();
        });
        try {
            await this.loadConfigFile();
        }
        catch (oError) {
            this.oLogger.e('Server.Config.Error', { error: oError });
        }
        return this.oConfig;
    }
}
exports.default = WelcomeServer;
WelcomeServer.iRetryCount = 0;
