/**
 * @file 文件介绍
 * @author imcooder@gmail.com
 */
/* eslint-disable fecs-camelcase */
/* jshint esversion: 6 */
/* jshint node:true */
const JSONRPC = require('../../index');

JSONRPC.invokeWithHost('http://127.0.0.1:8011/api/rpc/invoke', 'connector', 'kick', {
    echo: "hello",
}).then(function (res) {
    console.log('kick success:', res);
    return Promise.resolve();
}).catch(function (error) {
    console.error('kick failed:', error.stack);
    return Promise.resolve();
});