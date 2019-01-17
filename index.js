/**
 * @author imcooder@gmail.com
 */
/* jshint esversion: 6 */
/* jshint node:true */
"use strict";

const glob = require('glob');
const os = require('os');
const path = require('path');
const _ = require('underscore');
const uuid = require('node-uuid');
const request = require('request');
const validate = require('jsonschema').validate;
var ERROR = {
    ok: 0,
    failed: -1,
    invalid_arg: -2,
    invalid_module: -3,
    invalid_method: -4,
    unknown_method: -5,
    unknown_module: -6
};
var extend = function(a, b) {
    var prop;
    for(prop in b) {
        if(b.hasOwnProperty(prop)) {
            a[prop] = b[prop];
        }
    }
    return a;
};
function json(status, msg, data) {
    var ret = {};
    ret.status = status;
    if (msg !== undefined) {
        ret.msg = msg;
    }
    if (data !== undefined) {
        ret.data = data;
    }
    return ret;
}
function trimUrl(url) {
    return os.platform() === 'win32' ? url.replace(/\\/ig, '/') : url;
}
function now() {
    return (new Date()).valueOf();
}
var functions = {};

var JSONRPC = {
    RALPromise: null,
    functions: functions,
    handlePOST: function(req, res) {
        let logid = req.get('saiyalogid') || '';
        var buffer = '';
        var body = req.body;
        let id = body.id;
        let module = body.module.toLowerCase();
        let method = body.method.toLowerCase();
        let args = body.args;
        if (!_.has(JSONRPC.functions, module)) {
            res.json(json(ERROR.unknown_module, 'unknown module'));
            return;
        }
        if (!_.has(JSONRPC.functions[module], method)) {
            res.json(json(ERROR.unknown_method, 'unknown method'));
            return;
        }
        let handler = JSONRPC.functions[module][method];
        if (typeof handler !== 'function') {
            res.json(json(ERROR.invalid_method, 'bad function'));
            return;
        }
        try {
            handler.call(null, args, {
                logid: logid,
            }, (error, response) => {
                if (error) {
                    res.json(json(ERROR.failed, error.message || 'error'));
                    return;
                }
                res.json(json(ERROR.ok, '', response));
                return;
            }, req, res);
        } catch(error) {
            res.json(json(ERROR.failed, error.message || 'error'));
            return;
        }
        return;
    },
    invokeWithHost: function(url, module, method, args, logid) {
        let requestJSON = {
            'id': uuid.v4(),
            'module': module,
            'method': method,
            'args': args
        };
        if (!logid) {
            logid = '';
        }
        var timeout = 5000;
        var options = {
            url: url,
            timeout: timeout,
            headers: {
                saiyalogid: logid,
            },
        };
        options.json = requestJSON;
        return new Promise(function(resolve, reject) {
            request.post(options, function (err, httpResponse, data) {
                if (err) {
                    if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
                        reject(new Error('timeout'));
                        return;
                    }
                    reject(err);
                    return;
                }
                var jsonObject = data;
                if (!_.has(jsonObject, 'status')) {
                    reject(new Error('need status'));
                    return;
                }
                if (jsonObject.status !== 0) {
                    let errMsg = jsonObject.msg || '';
                    reject(new Error(errMsg));
                    return;
                }
                resolve(jsonObject.data);
                return;
            });
        });
    },
    invokeWithRal: function(serverName, module, method, params, logid) {
        if (!this.RALPromise) {
            return Promise.reject(new Error('RALPromise is empty'));
        }
        let requestJSON = {
            'id': uuid.v4(),
            'module': module,
            'method': method,
            'args': params
        };
        if (!logid) {
            logid = "";
        }
        return  this.RALPromise(serverName, {
            data: requestJSON,
            headers: {
                saiyalogid: logid,
            }
        }).then(function(data) {
            var jsonObject = data;
            if (!_.has(jsonObject, 'status')) {
                return Promise.reject(new Error('need status'));
            }
            if (jsonObject.status !== 0) {
                let errMsg = jsonObject.msg || '';
                return Promise.reject(new Error(errMsg));
            }
            return jsonObject.data;
        }).catch(function(error) {
            if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
                return Promise.reject(new Error('timeout'));
            }
            return Promise.reject(error);
        });
    },
    invokeWithRalV2: function(serverName, opt, module, method, params, logid) {
        if (!this.RALPromise) {
            return Promise.reject(new Error('RALPromise is empty'));
        }
        let requestJSON = {
            'id': uuid.v4(),
            'module': module,
            'method': method,
            'args': params
        };
        if (!logid) {
            logid = "";
        }
        let tmpConf = _.pick(opt, ['debug_server', 'timeout']);
        let conf = {
            data: requestJSON,
            headers: {
                saiyalogid: logid,
            }
        };
        if (tmpConf) {
            conf = _.extend(conf, tmpConf);
        }
        return  this.RALPromise(serverName, conf).then(function(data) {
            var jsonObject = data;
            if (!_.has(jsonObject, 'status')) {
                return Promise.reject(new Error('need status'));
            }
            if (jsonObject.status !== 0) {
                let errMsg = jsonObject.msg || '';
                return Promise.reject(new Error(errMsg));
            }
            return jsonObject.data;
        }).catch(function(error) {
            if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
                return Promise.reject(new Error('timeout'));
            }
            return Promise.reject(error);
        });
    },
    loadRouter: function(root) {
        glob.sync(`${root}/**/*_rpc.js`).forEach(function(file) {
            const realRoot = os.platform() === 'win32' ? root.replace(/\\/ig, '/') : root;
            const filePath = file.replace(/\.[^.]*$/, '');
            const fileName = path.basename(filePath).replace(/\.[^.]*$/, '');
            const module = fileName.replace(/_rpc$/, '');
            const controller = require(filePath);
            const methods = Object.keys(controller);
            function applyMethod(name, methodName, methodBody) {
                let body = methodBody;
                let handler = null;
                switch (typeof body) {
                case 'function':
                    {
                        handler = body;
                    }
                    break;
                default:
                    {
                        console.error('need function');
                        return;
                    }
                }
                if (!handler) {
                    console.error('[load-router]: no handler for method:%s', methodName);
                    return;
                }
                if (!_.has(JSONRPC.functions, module)) {
                    JSONRPC.functions[module] = {};
                }
                JSONRPC.functions[module.toLowerCase()][name.toLowerCase()] = handler;
            }
            methods.forEach((method) => {
                const methodName = method;
                if (!methodName.match(/Rpc$/g)) {
                    return;
                }
                const methodBody = controller[method];
                applyMethod(methodName.replace(/Rpc$/, ''), methodName, methodBody);
            });
        });
    },
    initRal: function(ral) {
        this.RALPromise = ral.RALPromise;
    }
};

extend(exports, JSONRPC);
