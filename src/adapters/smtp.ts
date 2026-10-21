import nodemailer from 'nodemailer';
import type { AppConfig } from '../config.js';
import type { OtpMailer } from '../modules/auth/identity-types.js';
import { logger as rootLogger } from '../logger.js';
import { otpEmail } from '../modules/auth/otp-email.js';

const logger = rootLogger.child({ component: 'smtp' });

export function smtpMailer(config: NonNullable<AppConfig['smtp']>): OtpMailer {
  const transport=nodemailer.createTransport({pool:true,maxConnections:2,maxMessages:100,
    host:config.host,port:config.port,secure:config.secure,
    requireTLS:!config.secure,auth:config.user?{user:config.user,pass:config.password}:undefined,
    connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000,logger:false,debug:false});
  return {
    async sendCode(email,code){
      try {
        const result=await transport.sendMail({from:config.from,to:email,...otpEmail(code)});
        if(!result.accepted?.length||result.rejected?.length)throw new Error('Email was not accepted');
      } catch (error) {
        // Provider responses can contain recipients or credentials. Emit only
        // allowlisted protocol metadata, never the raw response/message.
        const failure=error as {code?:string;responseCode?:number;command?:string;response?:string};
        const response=failure.response??'';
        const reason=/not.*verif|unverified|verify.*domain|verified.*domain/i.test(response)?'sender_verification':
          /sandbox|test.*recipient|testing.*email|own.*email/i.test(response)?'sandbox_recipient_restriction':
          /quota|rate.?limit|too many/i.test(response)?'provider_limit':
          /sender|from address/i.test(response)?'sender_rejected':'unspecified';
        logger.warn({ failure_code: ['EAUTH','ECONNECTION','ETIMEDOUT','ESOCKET','EENVELOPE','EMESSAGE'].includes(failure.code??'')?failure.code:'unknown',
          smtp_status: Number.isInteger(failure.responseCode)?failure.responseCode:undefined,
          smtp_command: ['CONN','AUTH PLAIN','AUTH LOGIN','STARTTLS','MAIL FROM','RCPT TO','DATA'].includes(failure.command??'')?failure.command:undefined,
          reason }, 'Verification email delivery failed');
        throw new Error('Email delivery failed');
      }
    },
    async verify(){await transport.verify();},
    close:()=>transport.close(),
  };
}
