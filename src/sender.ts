import MailComposer from 'nodemailer/lib/mail-composer';

import SendmailError from './error/sendmail_error';
import sendToSMTP from './send_to_smtp';

export default class Sender {
  public send(options: import('nodemailer/lib/mailer').Options) {
    const mail = new MailComposer(options);
    const compiled = mail.compile();
    const envelope = compiled.getEnvelope();
    const senderAddress = envelope.from;
    if (!senderAddress) throw new SendmailError('sender address is invalid');
    return new Promise<void>((resolve, reject) => {
      compiled.build((err, msg) => {
        if (err) return reject(err);
        return Promise.all(
          envelope.to.map((address) => {
            try {
              return sendToSMTP(senderAddress, address, msg);
            } catch (e) {
              return Promise.reject(e);
            }
          }),
        )
          .then(() => resolve())
          .catch(reject);
      });
    });
  }
}
