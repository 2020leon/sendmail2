import MailComposer from 'nodemailer/lib/mail-composer';

import SendmailError from './error/sendmail_error';
import sendToSMTP from './send_to_smtp';

export default class Sender {
  public async send(options: import('nodemailer/lib/mailer').Options) {
    const mail = new MailComposer(options);
    const compiled = mail.compile();
    const envelope = compiled.getEnvelope();
    const senderAddress = envelope.from;
    if (!senderAddress) throw new SendmailError('sender address is invalid');
    const body = await new Promise<Buffer>((resolve, reject) =>
      compiled.build((err, msg) => (err ? reject(err) : resolve(msg))),
    );
    await Promise.all(
      envelope.to.map((address) => sendToSMTP(senderAddress, address, body)),
    );
  }
}
