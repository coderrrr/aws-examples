// nodejs 16.x
var aws = require("aws-sdk");
var ddb = new aws.DynamoDB({ params: { TableName: "SES-Event" } });

exports.handler = function (event, context, callback) {
  console.log("Received event:", JSON.stringify(event, null, 2));

  var SnsPublishTime = event.Records[0].Sns.Timestamp;

  var time = new Date(SnsPublishTime).toLocaleString('en-US', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  });
  
  const shanghaiTime = new Date(time);
  
  var formattedTime = shanghaiTime.getFullYear() + "-"
        + (shanghaiTime.getMonth() + 1 < 10 ? '0' + (shanghaiTime.getMonth() + 1) : (shanghaiTime.getMonth() + 1)) + "-"
        + (shanghaiTime.getDate() < 10 ? '0' + shanghaiTime.getDate() : shanghaiTime.getDate()) + " "
        + (shanghaiTime.getHours() < 10 ? '0' + shanghaiTime.getHours() : shanghaiTime.getHours()) + ":"
        + (shanghaiTime.getMinutes() < 10 ? '0' + shanghaiTime.getMinutes() : shanghaiTime.getMinutes()) + ":"
        + (shanghaiTime.getSeconds() < 10 ? '0' + shanghaiTime.getSeconds() : shanghaiTime.getSeconds());
  
  var SESMessage = event.Records[0].Sns.Message;

  SESMessage = JSON.parse(SESMessage);

  var eventType = SESMessage.eventType;
  var messageId = SESMessage.mail.messageId;
  var subject = SESMessage.mail.commonHeaders.subject;
  var from = SESMessage.mail.source;   
  var to = SESMessage.mail.destination.toString();

  var itemParams = {
    Item: {
      MessageId: { S: messageId },
      From: { S: from },
      To: { S: to },
      Subject: { S: subject },
      Type: { S: eventType },
      Time: { S: formattedTime }
    }
  };

  if (eventType == "Send") { // 发送
    Object.assign(itemParams.Item, {
     
    });
  } else if (eventType == "Delivery") { // 送达
    var smtpResponse = SESMessage.delivery.smtpResponse;
    Object.assign(itemParams.Item, {

    });
  } else if (eventType == "Failure") { // 失败
    var errorMessage = SESMessage.failure.errorMessage;
    Object.assign(itemParams.Item, {
      ErrorMessage: { S: errorMessage }
    });
  } else if (eventType == "Reject") { // 拒收
    var reason = SESMessage.reject.reason;
    Object.assign(itemParams.Item, {
      RejectReason: { S: reason }
    });
  } else if (eventType == "Complaint") { // 投诉
    var complaintFeedbackType = SESMessage.complaint.complaintFeedbackType;
    Object.assign(itemParams.Item, {
      ComplaintFeedbackType: { S: complaintFeedbackType }
    });
  } else if (eventType == "Bounce") { // 退订
    var bounceSummary = JSON.stringify(SESMessage.bounce.bouncedRecipients);
    Object.assign(itemParams.Item, {
      BounceSummary: { S: bounceSummary },
    });
  } else if (eventType == "Open") { // 打开邮件
    Object.assign(itemParams.Item, {

    });
  } else if (eventType == "Click") { // 点击链接
    var link = SESMessage.click.link;
    Object.assign(itemParams.Item, {
      OpenLink: { S: link }
    });
  }

  // console.log(itemParams);

  // 写入数据到 DynamoDB
  ddb.putItem(itemParams, function (err, data) {
    if (err) {
      callback(err)
    } else {
      console.log(data);
      callback(null, '')
    }
  });
};