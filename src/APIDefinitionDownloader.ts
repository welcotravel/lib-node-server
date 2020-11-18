import fs      from 'fs';
import request from 'request-promise-native';
import openAPI from 'swagger-parser';

import {compile, JSONSchema} from 'json-schema-to-typescript';

const fsPromises  = fs.promises;

export type APIDefinitionDownloaderConfig = {
    api_domain:     string
    service_id:     string
    service_secret: string
}

export type APIDefinitionDownloaderPaths = {
    [path: string]: string
}

type APIDocsResponse = {
    properties: JSONSchema
}

export default class APIDefinitionDownloader {
    // NOTE: Not using API.js because it's not guaranteed that it's been compiled correctly.  This script needs to run on its own
    public static async download(oConfig: APIDefinitionDownloaderConfig, sDefinitionPath: string, oPaths: APIDefinitionDownloaderPaths) {
        const sResponse = await request({
            uri:      `https://api.${oConfig.api_domain}/v3/auth/client`,
            method:   'POST',
            headers:  {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            formData: {
                grant_type:    'client_credentials',
                client_id:     oConfig.service_id,
                client_secret: oConfig.service_secret,
                scope:         'services'
            }
        });

        const oAuth = JSON.parse(sResponse);

        if (!oAuth.access_token) {
            throw new Error('No AuthToken');
        }

        const sDocs = await request({
            uri:      `https://api.${oConfig.api_domain}/v3/services/docs`,
            method:   'GET',
            headers:  {
                Authorization: `Bearer ${oAuth.access_token}`
            }
        });

        try {
            const oJSONDocs  = JSON.parse(sDocs);
            // @ts-ignore
            const oDocs      = await openAPI.dereference(oJSONDocs);

            const fParse = async (sPath: string) => {
                if (!oDocs.paths[sPath]) {
                    console.error('Not Found:', sPath);
                    return;
                }

                const sMethod = oPaths[sPath];
                if (!oDocs.paths[sPath]) {
                    console.error('Not Found', sPath, sMethod);
                    return;
                }

                const oEndpoint = oDocs.paths[sPath][sMethod];

                /* If you need query parameters, here is how to get them
                let oParameters = {};

                const aParameters = Object.keys(oEndpoint.parameters);
                aParameters.filter(sParameter => oEndpoint.parameters[sParameter].in === 'query').map(sParameter => {
                    oParameters[oEndpoint.parameters[sParameter].name] = oEndpoint.parameters[sParameter].schema;
                });
                */

                let oResponse: JSONSchema = {};
                let aRequired: string | any[] = [];

                if (!oEndpoint.responses || !oEndpoint.responses['200']) {
                    console.error('Endpoint has no Success Response Documentation!', sPath, sMethod);
                    return;
                }

                // Assuming `allOf` is always there won't work for everything, but for the Welcome API, it likely does.  There _may_ be one or two non-standard endpoints where it doesn't
                oEndpoint.responses['200'].content['application/json'].schema.allOf.map((oObject: APIDocsResponse) => {
                    if (!oObject.properties) {
                        return;
                    }

                    if (oObject.properties._server) {
                        return;
                    }

                    const aProperties = Object.keys(oObject.properties);

                    aProperties.map(sKey => {
                        if (['counts', 'sorts'].includes(sKey)) {
                            return;
                        }

                        if (!oObject.properties[sKey].properties['{id}']) {
                            const oProperties = oObject.properties[sKey].properties;

                            Object.keys(oProperties).map(sField => {
                                oResponse[sField] = oProperties[sField];
                            });

                            if (oObject.properties[sKey].required) {
                                aRequired = [...aRequired, ...oObject.properties[sKey].required];
                            }
                            return;
                        }

                        const oProperties = oObject.properties[sKey].properties['{id}'].properties;

                        Object.keys(oProperties).map(sField => {
                            oResponse[sField] = oProperties[sField];
                        });

                        if (oObject.properties[sKey].properties['{id}'].required) {
                            aRequired = [...aRequired, ...oObject.properties[sKey].properties['{id}'].required];
                        }
                    });
                });

                const sName = sPath.replace(/^\/|\/$/g, '')  // Kill Start / End Slashes
                                   .split('/')      // Split Path into Parts
                                   .map(sPart => sPart.replace(/[^a-zA-Z0-9]/g, '')     // Replace NonAlphaNumeric
                                                               .replace(/\b\w/g, l => l.toUpperCase()) // UpperCase First Letter
                                   )
                                   .join('');

                const oSchema:JSONSchema  = {
                    type:                 'object',
                    additionalProperties: false,
                    properties:           oResponse
                };

                if (aRequired.length) {
                    oSchema.required = aRequired;
                }

                return await compile(oSchema, sName);
            };

            const aSchemas = await Promise.all(
                Object.keys(oPaths).map(fParse)
            );

            await fsPromises.writeFile(sDefinitionPath, aSchemas.join("\n\n"));
            console.log('Wrote', sDefinitionPath);
        } catch(oError) {
            console.error(oError);
        }
    }
}