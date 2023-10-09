/**
 * ApiGateway 工具类
 * 
 */

import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const client = new ApiGatewayManagementApiClient({
     region: "ap-northeast-1",
     apiVersion: "2018-11-29",
     endpoint: "https://lh5g4wzzs5.execute-api.ap-northeast-1.amazonaws.com/test"
});

// 向一个 Websocket Connection 客户端发送消息
export const postMessage = async (connectionId, message) => {
     const input = {
          Data: message,
          ConnectionId: connectionId,
     };
     const command = new PostToConnectionCommand(input);
     var data;
     try {          
          data = await client.send(command);
     } catch (error){
          data = {
               error: error
          };
          // console.error(error);
     }     
     return data;
}