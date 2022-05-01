import nodemailer from 'nodemailer';

import metadata from './metadata';
import SendmailError from './error/sendmail_error';
import sendToSMTP from './send_to_smtp';

/**
 * Transporter is a `nodemailer.Transport` object.
 * @example
 * const transport = new Transport();
 * const transporter = nodemailer.createTransport(transport);
 * transporter.sendMail({
 *   from: 'no-reply@example.com',
 *   to: 'example@example.com',
 *   subject: 'hello',
 *   text: 'hello world!',
 * });
 */
export default class Transport implements nodemailer.Transport<void> {
  public readonly name = metadata.name;

  public readonly version = metadata.version;

  public send(
    mail: import('nodemailer/lib/mailer/mail-message')<void>,
    callback: (err: Error | null, info?: void) => void,
  ) {
    const envelope = mail.message.getEnvelope();
    const senderAddress = envelope.from;
    if (!senderAddress)
      return callback(new SendmailError('sender address is invalid'));

    return mail.message.build((err, msg) => {
      if (err) return callback(err);
      return Promise.all(
        envelope.to.map((address) => {
          try {
            return sendToSMTP(senderAddress, address, msg);
          } catch (e) {
            return Promise.reject(e);
          }
        }),
      )
        .then(() => callback(null))
        .catch(callback);
    });
  }
}
