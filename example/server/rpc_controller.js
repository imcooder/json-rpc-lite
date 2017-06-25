/**
 * @file 文件介绍
 * @author imcooder@gmail.com
 */
/* eslint-disable fecs-camelcase */
/* jshint node:true*/
/*jshint esversion:6*/
"use strict";
var _ = require('underscore');
var fs = require('fs');
const jsonrpc = require('../../index');
var validate = require('jsonschema').validate;
//
//
var inputSchema = {
    "type": "object",
    "properties": {
        "id": {
            "type": "string"
        },
        "module": {
            "type": "string"
        },
        "method": {
            "type": "string"
        },
        "args": {
            "type": "object",
        }
    },
    "required": ["id", "module", "method", "args"]
};
var Service = {
    invokeAction: {
        method: ['POST'],
        handler: function (req, res) {
            console.log('[rpc]invoke:%j', req.body);
            var checkParam = validate(req.body, inputSchema);
            if (!checkParam.valid) {
                let errMsg = checkParam.errors[0].message;
                console.error('[rpc]invoke param error:%s', errMsg);
                res.json({
                    status: -1,
                    msg: errMsg
                });
                return;
            }
            try {
                jsonrpc.handlePOST(req, res);
            } catch (error) {
                console.error('[rpc]call fatal:', error);
                res.json({
                    status: -1,
                    msg: 'fatal error'
                });
            }
            return;
        }
    }
};

module.exports = Service;