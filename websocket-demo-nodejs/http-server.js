/**
 * 主业务类，监听 HTTP 请求 
 */

import express from 'express';
import bodyParser from 'body-parser';
import moment from 'moment';
import http from 'http';

import * as ddbHelper from './libs/ddbHelper.js';
import * as apiGatewayHelper from './libs/apiGatewayHelper.js';

const app = express();
const port = 8080;

let jsonParser = bodyParser.json({ extended: false }); // 解析json类型


// DynamoDB 表名
const TABLE_NAME = "websocket-demo";

// 路由地址，提供健康检查地址
app.get("/", (req, res) => {
     res.send("index");
});



// 路由地址，连接时触发，写入 connectionId 到 DynamoDB
/**
   HTTP Proxy Integration
   Read "x-integration-connection-id" from Header
 */
app.post("/connect", jsonParser, (req, res) => {
     const connectionId = req.headers["x-integration-connection-id"];
     console.log("[" + connectionId + "] connected.");
     ddbHelper.putConnectionId(TABLE_NAME, connectionId);
     console.log("wrote [" + connectionId + "] to DynamoDB.");
     res.sendStatus(200);
});

// 路由地址，断开时触发，从 DynamoDB 中移除 connectionId
/**
   传入格式：
   {
    "connectionId": "$context.connectionId",
    "payload": $input.body
   }
 */
app.delete("/disconnect", jsonParser, (req, res) => {
     const connectionId = req.body.connectionId;
     console.log("[" + connectionId + "] disconnected.");
     ddbHelper.deleteConnectionId(TABLE_NAME, connectionId);
     console.log("removed [" + connectionId + "] from DynamoDB.");
     res.sendStatus(200);
});

// 路由地址，向当前所有保持 Websocket 连接的客户端发送消息
/**
   传入格式：
   {
    "connectionId": "$context.connectionId",
    "payload": $input.body
   }
 */
app.post("/sendmessage", jsonParser, async (req, res) => {
     console.log("/sendmessage:");
     console.log(req.body);
     var message = req.body.payload.message;
     var items = await ddbHelper.scanConnectionIds(TABLE_NAME);

     items.forEach((item) => {
          var connectionId = item.ConnectionId.S;
          console.log("sending message to: [" + connectionId + "]...");
          apiGatewayHelper.postMessage(connectionId, message + " - " + _getTime());
     });

     res.sendStatus(200);
});

// 默认路由
app.post("/default", jsonParser, async (req, res) => {
     console.log("/default:");
     console.log(req.body);
     res.sendStatus(200);
});


// 启动 HTTP 监听服务
const server = http.createServer(app);
server.listen(port, () => {
     console.log(_getTime() + " 服务器已开启，端口号：" + port);
});



// 返回当前格式化日期字符串
function _getTime() {
     var timeFormat = 'YYYY-MM-DD HH:mm:ss';
     var time = moment(Date.now()).format(timeFormat);
     return time;
}