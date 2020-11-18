#!/usr/bin/env node

//const CONFIG  = require('/etc/welco/config.maps.json');
const consul                    = require('consul')({promisify: true});
const {APIDefinitionDownloader} = require('lib-node-server');

const sDefinitionPath = `${__dirname}/../src/@types/maps.welco.me/API.d.ts`;

const oPaths = {
    '/v3/services/places/{id}'                             : 'get',
    '/v3/services/cities/{ids-or-keys}'                    : 'get',
    '/v3/services/tips/{id}'                               : 'get'
};

(async () => {
    /*
        const oConfig = {
            api_domain:     CONFIG.uri.api,
            service_id:     CONFIG.api.docs.client_id,
            service_secret: CONFIG.api.docs.client_secret
        }
    */

    const oDomain        = await consul.kv.get({key: 'icons/uri/domain'});
    const oServiceId     = await consul.kv.get({key: 'icons/api/service/id'});
    const oServiceSecret = await consul.kv.get({key: 'icons/api/service/secret'});

    const oConfig = {
        api_domain:     oDomain.Value,
        service_id:     oServiceId.Value,
        service_secret: oServiceSecret.Value
    }

    APIDefinitionDownloader.download(oConfig, sDefinitionPath, oPaths);
})().catch(oError => {
    console.error(oError);
});