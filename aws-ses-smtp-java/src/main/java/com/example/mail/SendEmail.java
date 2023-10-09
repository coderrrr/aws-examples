package com.example.mail;

import javax.mail.Session;
import javax.mail.Transport;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;

import com.Constants;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Properties;

public class SendEmail {
	private void sendEmailBySmtp(MessageVo messageVo) throws Exception {
		// 邮件参数配置
		Properties props = System.getProperties();
		props.put("mail.transport.protocol", "smtp");
		props.put("mail.smtp.port", "587");
		props.put("mail.smtp.starttls.enable", "true");
		props.put("mail.smtp.auth", "true");
		Session session = Session.getDefaultInstance(props);
		MimeMessage msg = new MimeMessage(session);
		String smtpUserName = Constants.AWS_SMTP_USER_NAME; // 带有权限的 AWS 帐号
		String smtpUserPassword = Constants.AWS_SMTP_USER_PASSWORD; // 带有权限的 AWS 密码
		msg.setFrom(new InternetAddress("coderrr@hotmail.com")); // 发送的 email 帐号
		msg.setRecipient(javax.mail.Message.RecipientType.TO, new InternetAddress(messageVo.getToMailAddress()));
		msg.setSubject(messageVo.getSubject());
		msg.setContent(messageVo.getContent(), "text/html;charset=UTF-8");


		/******************************** 配置邮件发送监控 Begin ********************************/

		// 通过加约定的Header来指定本次发送所使用的SES配置集名称
		msg.addHeader("X-SES-CONFIGURATION-SET", "configuration-set-1");

		// 对应 CloudWatch MESSAGE_TAG 的维度名称（Group），这里取邮件的Group信息做为维度显示
		msg.addHeader("X-SES-MESSAGE-TAGS", "Group=" + messageVo.getGroup());

		/******************************** 配置邮件发送监控 End ********************************/


		Transport transport = session.getTransport();
		try {
			transport.connect("email-smtp." + "ap-southeast-1" + ".amazonaws.com", smtpUserName, smtpUserPassword);
			transport.sendMessage(msg, msg.getAllRecipients());
			System.out.println("Successfully sent to " + messageVo.getToMailAddress());
		} catch (Exception ex) {
			ex.printStackTrace();
			throw new RuntimeException();
		} finally {
			transport.close();
		}
	}

	public static void main(String[] args) {
		try {
			SendEmail sendEmail = new SendEmail();

			/******************************** 向【邮箱 1】 发送【促销】邮件 ********************************/
			MessageVo messageVo = new MessageVo();
			messageVo.setToMailAddress("coderrr@hotmail.com");

			// 分组名（促销）
			messageVo.setGroup("Activity");
			// 标题
			messageVo.setSubject("【促销通知】");
			// 正文
			String content = "<h1>五一节 全场9折！</h1>";
			content += "<p><a href=\"https://github.com\">Click Me.</a></p>";
			content += getTimePostfix();
			messageVo.setContent(content);

			sendEmail.sendEmailBySmtp(messageVo);

			Thread.sleep(1000);

			/******************************** 向【邮箱 2】 发送【催费】邮件 ********************************/
			messageVo = new MessageVo();
			messageVo.setToMailAddress("coderrr.cn@hotmail.com");

			// 分组名（通知）
			messageVo.setGroup("Notification");
			// 标题
			messageVo.setSubject("【欠费通知】");
			//正文
			content = "<h1>账号即将欠费！</h1>";
			content += "<p><a href=\"https://github.com\">Click Me.</a></p>";
			content += getTimePostfix();
			messageVo.setContent(content);

			sendEmail.sendEmailBySmtp(messageVo);
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	// 生成时间后缀
	private static String getTimePostfix(){
		Calendar cal = Calendar.getInstance();
		Date now = cal.getTime();
		SimpleDateFormat format = new SimpleDateFormat("yyyy年MM月dd日 hh:mm:ss");
		String strDate = format.format(now);
		return strDate;
	}
}
