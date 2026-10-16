import nodemailer from 'nodemailer';
import type { AppConfig } from '../config.js';
import type { OtpMailer } from '../modules/auth/identity-types.js';

export function smtpMailer(config: NonNullable<AppConfig['smtp']>): OtpMailer {
  const transport=nodemailer.createTransport({host:config.host,port:config.port,secure:config.secure,
    requireTLS:!config.secure,auth:config.user?{user:config.user,pass:config.password}:undefined,
    connectionTimeout:5000,greetingTimeout:5000,socketTimeout:10000,logger:false,debug:false});
  return {
    async sendCode(email,code){
      const result=await transport.sendMail({from:config.from,to:email,subject:'Your PadiCheck verification code',
        text:`Your PadiCheck verification code is ${code}. It expires in 10 minutes. If you did not request it, ignore this message.`});
      if(!result.accepted?.length||result.rejected?.length)throw new Error('Email was not accepted');
    },
    async verify(){await transport.verify();},
    close:()=>transport.close(),
  };
}
