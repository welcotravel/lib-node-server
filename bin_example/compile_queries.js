#!/usr/bin/env node

const {QuerySchemaCompiler} = require('lib-node-server');

const sDefinitionPath = `${__dirname}/../src/@types/maps.welco.me/Queries.d.ts`;
const aPaths = [
    `${__dirname}/../src/schemas/city.json`,
    `${__dirname}/../src/schemas/world.json`,
    `${__dirname}/../src/schemas/tile.json`
];

QuerySchemaCompiler.compile(sDefinitionPath, aPaths);