# json-rpc-lite
very simple jsonrpc base on express

[![NPM version][npm-image]][npm-url]
[![npm download][download-image]][download-url]
[![David deps][david-image]][david-url]

[npm-image]: https://img.shields.io/npm/v/json-rpc-lite.svg
[npm-url]: https://npmjs.com/package/json-rpc-lite
[download-image]: https://img.shields.io/npm/dm/json-rpc-lite.svg
[download-url]: https://npmjs.com/package/json-rpc-lite
[david-image]: https://img.shields.io/david/json-rpc-lite.svg
[david-url]: https://david-dm.org/imcooder/json-rpc-lite

## Install

```
npm i json-rpc-lite -S
```

## Usage


### server
#### 加载处理模块
const JSONRPC = require('json-rpc-lite');

JSONRPC.loadRouter(path.join(__dirname, 'rpc/'));
// 自动加载目录中 xxx_rpc.js文件 xxx为模块名
文件中 函数名为yyyRpc，其中yyy为导出的模块方法，非此格式函数 无法rpc调用
example：connector_rpc.js
```js
var service = module.exports = {
    init: function () {
        logger.debug('[connector_prc]init');
    },
    kickRpc: function (input, cb) {
        logger.debug('[rpc]kick:%j', input);
        let checkParam = validate(input, jsonSchemaData.kick_rpc);
        if (!checkParam.valid) {
            let errMsg = checkParam.errors[0].message;
            cb(new Error(errMsg));
            return;
        }
        cb(null, {});        
        return;
    }
}
```
input: argument
cb: callback(error, returnValue)

### route
baseon express
```js
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
var service = module.exports = {
    invokeAction: {
        method: ['POST'],
        handler: function (req, res) {
            logger.debug('[rpc]invoke:%j', req.body);
            var checkParam = validate(req.body, inputSchema);
            if (!checkParam.valid) {
                let errMsg = checkParam.errors[0].message;
                logger.error('[rpc]invoke param error:%s', errMsg);
                res.json(commonUtil.json(-1, errMsg));
                return;
            }
            try {
                JSONRPC.handlePOST(req, res);
            } catch (error) {
                logger.error('[rpc]call fatal:', error);
                res.json({
                    status: -1,
                    msg: 'fatal error'
                });
            }
            return;
        }
    }
};
```


### client
```js
jsonrpcClientPool.invokeWithHost(commonUtil.makeRpcUrl(connectorHost), 'connector', 'kick', {
                header: {
                    uid: uid,
                    logid: logid
                },
                body: {
                    uids: [uid],
                    reason: 'multi_login'
                }
            }).then(function(resp) {
                logger.debug('logid:%s [rpc]kick remote success:%j', logid, resp);
                return Promise.resolve();
            }).catch(function(error) {
                logger.error('logid:%s [rpc]kick remote failed:', logid, error.stack);
                return Promise.resolve();
            });
```

See [example](example/).

## License

The [MIT License](LICENSE)
