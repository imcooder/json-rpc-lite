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
const RAL = require('yog-ral').RAL;
const ralP = require('yog-ral').RALPromise;
const validate = require('jsonschema').validate;
const logger = require('log4js').getLogger('connect', __filename);
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
    functions: functions,
    handlePOST: function(req, res) {
        let logid = req.get('saiyalogid') || 'undefined';
        var buffer = '';
        var body = req.body;
        let id = body.id;
        let module = body.module.toLowerCase();
        let method = body.method.toLowerCase();
        let args = body.args;
        if (!_.has(JSONRPC.functions, module)) {
            res.json(json(ERROR.unknown_module, 'unknown module'));
            logger.warn('logid:%s [rpc]handlePost unknown module:', logid, module);
            return;
        }
        if (!_.has(JSONRPC.functions[module], method)) {
            res.json(json(ERROR.unknown_method, 'unknown method'));
            logger.warn('[rpc]handlePost unknown method:method:' + method, ' in module:' + module);
            return;
        }
        let handler = JSONRPC.functions[module][method];
        if (typeof handler !== 'function') {
            logger.warn('logid:%s [rpc]handlePost bad function', logid);
            res.json(json(ERROR.invalid_method, 'bad function'));
            return;
        }
        logger.debug('logid:%s [rpc]handlePost:request (id %s): %s.%s(%j)',
                     logid, id, module, method, args);
        try {
            handler.call(null, args, {
                logid: logid,
            }, function(error, response) {
                if (error) {
                    logger.error('logid:%s [rpc]handlePost error:', logid, error.stack);
                    res.json(json(ERROR.failed, error.message || 'error'));
                    return;
                }
                res.json(json(ERROR.ok, '', response));
                return;
            });
        } catch(error) {
            logger.error('logid:%s [rpc]handler fatel:%s', logid, error.stack);
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
            saiyalogid: logid,
        };
        options.json = requestJSON;
        let start = now();
        return new Promise(function(resolve, reject) {
            logger.debug('logid:%s [rpc]invoke:%j', logid, options);
            request.post(options, function (err, httpResponse, data) {
                logger.debug('logid:%s [rpc]invoke return:%j', logid, data);
                if (err) {
                    if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
                        logger.error('logid:%s [rpc] timeout opt:%j', logid, options);
                        reject(new Error('timeout'));
                        return;
                    }
                    logger.error('logid:%s [rpc]invoke callback failed opt:[%s] body[%j]',
                                 logid, options, data);
                    reject(err);
                    logger.debug('logid:%s [rpc]using:%d', logid, now() - start);
                    return;
                }
                var jsonObject = data;
                if (!_.has(jsonObject, 'status')) {
                    logger.error('logid:%s [rpc]invoke need status', logid);
                    reject(new Error('need status'));
                    logger.debug('logid:%s [rpc]using:%d', logid, now() - start);
                    return;
                }
                if (jsonObject.status !== 0) {
                    let errMsg = jsonObject.msg || '';
                    logger.error('logid:%s [rpc]invoke status:%d not zero msg:%s',
                                 logid, jsonObject.status, errMsg);
                    reject(new Error(errMsg));
                    logger.debug('logid:%s [rpc]using:%d', logid, now() - start);
                    return;
                }
                resolve(jsonObject.data);
                logger.debug('logid:5s [rpc]using:%d', logid, now() - start);
                return;
            });
        });
    },
    invokeWithRal: function(serverName, module, method, params, logid) {
        let requestJSON = {
            'id': uuid.v4(),
            'module': module,
            'method': method,
            'args': params
        };
        if (!logid) {
            logid = "";
        }
        logger.debug('logid:%s [rpc]request:%j', logid, requestJSON);
        let start = now();
        return  ralP(serverName, {
            data: requestJSON,
            headers: {
                saiyalogid: logid,
            }
        }).then(function(data) {
            logger.debug('logid:%s [rpc]response:%j', logid, data);
            var jsonObject = data;
            if (!_.has(jsonObject, 'status')) {
                logger.error('logid:%s need status', logid);
                logger.debug('logid:%s [rpc]using:%d', logid, now() - start);
                return Promise.reject(new Error('need status'));
            }
            if (jsonObject.status !== 0) {
                let errMsg = jsonObject.msg || '';
                logger.error('logid:%s status:%d not zero msg:%s', logid, jsonObject.status, errMsg);
                logger.debug('logid:%s [rpc]using:%d', logid, now() - start);
                return Promise.reject(new Error(errMsg));
            }
            logger.debug('logid:%s [rpc]using:%d', logid, now() - start);
            return jsonObject.data;
        }).catch(function(error) {
            logger.error('logid:%s error:%s', logid, error.stack);
            if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
                logger.error('logid:%s [rpc] timeout %s.%s', logid, module, method);
                return Promise.reject(new Error('timeout'));
            }
            logger.error('logid:%s [rpc]callback failed %s.%s body[%j]',
                         logid, module, method, requestJSON);
            logger.debug('logid:%s [rpc]using:%d', logid, now() - start);
            return Promise.reject(error);
        });
    },
    loadRouter: function(root) {
        logger.debug('route:%s', root);
        glob.sync(`${root}/**/*_rpc.js`).forEach(function(file) {
            logger.debug('file:%s', file);
            const realRoot = os.platform() === 'win32' ? root.replace(/\\/ig, '/') : root;
            const filePath = file.replace(/\.[^.]*$/, '');
            const fileName = path.basename(filePath).replace(/\.[^.]*$/, '');
            const module = fileName.replace(/_rpc$/, '');
            logger.debug('filePath:%s module:%s', filePath, module);
            const controller = require(filePath);
            const methods = Object.keys(controller);
            logger.debug('methods:%j', methods);
            function applyMethod(name, methodName, methodBody) {
                logger.debug('name:%s methodName:%s', name, methodName);
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
                        logger.error('need function');
                        return;
                    }
                }
                if (!handler) {
                    logger.error('[load-router]: no handler for method:%s', methodName);
                    return;
                }
                if (!_.has(JSONRPC.functions, module)) {
                    JSONRPC.functions[module] = {};
                }
                JSONRPC.functions[module.toLowerCase()][name.toLowerCase()] = handler;
                logger.debug(JSONRPC.functions);
            }
            methods.forEach((method) => {
                const methodName = method;
                if (!methodName.match(/Rpc$/g)) {
                    logger.debug('method %s not api', methodName);
                    return;
                }
                const methodBody = controller[method];
                applyMethod(methodName.replace(/Rpc$/, ''), methodName, methodBody);
            });
        });
    },
    initRal: function(opt) {
        logger.debug('initRal:%j', opt);
        RAL.init(opt);
    }
};

extend(exports, JSONRPC);
