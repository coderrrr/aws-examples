/**
 * DynamoDB 工具类
 */

import moment from 'moment';

import { PutItemCommand } from "@aws-sdk/client-dynamodb";
import { DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { ddbClient } from "./ddbClient.js";

// 向表中添加一条 connectionId 的记录
export const putConnectionId = async (tableName, connectionId) => {
     const params = {
          TableName: tableName,
          Item: {
               ConnectionId: { S: connectionId },
               ConnectTime: { S: _getTime() },
          }
     };
     try {
          const data = await ddbClient.send(new PutItemCommand(params));
          return data;
     } catch (err) {
          console.error(err);
     }
}

// 从表中删除 connectionId 的记录（可多条）
export const deleteConnectionId = async (tableName, connectionId) => {
     const params = {
          // Specify which items in the results are returned.
          FilterExpression: "ConnectionId = :ConnectionId",
          // Define the expression attribute value, which are substitutes for the values you want to compare.
          ExpressionAttributeValues: {
               ":ConnectionId": { S: connectionId }
          },
          // Set the projection expression, which the the attributes that you want.
          ProjectionExpression: "ConnectionId, ConnectTime",
          TableName: tableName,
     };

     try {
          const data = await ddbClient.send(new ScanCommand(params));
          data.Items.forEach(function (element) {
               const data = ddbClient.send(new DeleteItemCommand({
                    TableName: "websocket-demo",
                    Key: element
               }));
          });
          return data;
     } catch (err) {
          console.error(err);
     }
}

// 扫描 Connection 记录
export const scanConnectionIds = async (tableName) => {
     const params = {
          TableName: tableName,
     };
     try {
          const data = await ddbClient.send(new ScanCommand(params));
          return data.Items;
     } catch (err) {
          console.error(err);
     }
}

// 返回当前格式化日期字符串
export const _getTime = () => {
     var timeFormat = 'YYYY-MM-DD HH:mm:ss';
     var time = moment(Date.now()).format(timeFormat);
     return time;
}