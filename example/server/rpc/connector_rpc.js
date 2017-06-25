/**
 * @file 文件介绍
 * @author imcooder@gmail.com
 */
/* eslint-disable fecs-camelcase */
/*jslint node: true*/
/*jshint esversion:6*/
"use strict";
var _ = require('underscore');
var fs = require('fs');
const validate = require('jsonschema').validate;
//
let kickSchema = {
    "type": "object",
    "properties": {        
        "echo": {
            "type": "string"
        }
    },
    "required": ["echo"]
};
var service = {
    kickRpc: function (input, cb) {
        console.log('[rpc]kick:%j', input);
        let checkParam = validate(input, kickSchema);
        if (!checkParam.valid) {
            let errMsg = checkParam.errors[0].message;
            cb(new Error(errMsg));
            return;
        }
        cb(null, {
            status: 0,
            data: {
                text: input.echo + ' too'
            }
        });
        return;
    },
};
module.exports = service;