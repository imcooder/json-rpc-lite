/**
 * @file 文件介绍
 * @author imcooder@gmail.com
 */
/* eslint-disable fecs-camelcase */
/*jshint esversion: 6 */
/* jshint node:true */
"use strict";

const JSONRPC = require('../../index');
const BackendService = require('backend-server-framework');
const _ = require('underscore');
const path = require('path');

JSONRPC.loadRouter(path.join(__dirname, './'));
let httpServer = BackendService.createServer({
    port: 8011,
    timeout: 5000,
    router: [{
        router: '/api',
        path: path.join(__dirname, './')
    }]
});
httpServer.start().then(() => {
    console.log('backend-service ready');
}).catch((error) => {
    console.error(error);
    process.exit(-1);
});