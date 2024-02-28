// nodejs 14.x
console.log("Loading event...");

var aws = require("aws-sdk");
var ddb = new aws.DynamoDB({ params: { TableName: "SESNotifications" } });

exports.handler = function (event, context, callback) {
  console.log("Received event:", JSON.stringify(event, null, 2));

  var SnsPublishTime = event.Records[0].Sns.Timestamp;
  var SnsTopicArn = event.Records[0].Sns.TopicArn;
  var SESMessage = event.Records[0].Sns.Message;

  SESMessage = JSON.parse(SESMessage);

  var SESMessageType = SESMessage.eventType;
  var SESMessageId = SESMessage.mail.messageId;
  var SESSubject = SESMessage.mail.commonHeaders.subject;
  var SESDestinationAddress = SESMessage.mail.destination.toString();
  var LambdaReceiveTime = new Date().toString();

  var itemParams = {
    Item : {
      SESMessageId: { S: SESMessageId },
      SnsPublishTime: { S: SnsPublishTime },
      SESMessageType: { S: SESMessageType },
      SESSubject: {S: SESSubject},
      SESDestinationAddress: { S: SESDestinationAddress }
    }
  };

  if (SESMessageType == "Bounce") {
    var SESreportingMTA = SESMessage.bounce.reportingMTA;
    var SESbounceSummary = JSON.stringify(SESMessage.bounce.bouncedRecipients);
    
    Object.assign(itemParams.Item, {
      SESreportingMTA: { S: SESreportingMTA },
      SESbounceSummary: { S: SESbounceSummary },
    });
  } else if (SESMessageType == "Delivery") {
    var SESsmtpResponse = SESMessage.delivery.smtpResponse;
    var SESreportingMTA = SESMessage.delivery.reportingMTA;

    Object.assign(itemParams.Item, {
      SESsmtpResponse: { S: SESsmtpResponse },
      SESreportingMTA: { S: SESreportingMTA }
    });
  } else if (SESMessageType == "Complaint") {
    var SESComplaintFeedbackType = SESMessage.complaint.complaintFeedbackType;
    var SESFeedbackId = SESMessage.complaint.feedbackId;
    Object.assign(itemParams.Item, {
      SESComplaintFeedbackType: { S: SESComplaintFeedbackType },
      SESFeedbackId: { S: SESFeedbackId }
    });
  } else if (SESMessageType == "Click") {
    var SESlink = SESMessage.click.link;
    Object.assign(itemParams.Item, {
      SESLink: { S: SESlink },
    });
  }

  console.log(itemParams);

  // 写入数据到 DynamoDB
  ddb.putItem(itemParams, function (err, data) {
    if (err) {
      callback(err)
    } else {
      console.log(data);
      callback(null,'')
    }
  });
};