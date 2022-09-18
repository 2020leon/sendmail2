import nodemailer from 'nodemailer';
import MimeNode from 'nodemailer/lib/mime-node';

import * as metadata from './metadata';
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
export default class Transport
  implements
    nodemailer.Transport<
      { envelope: MimeNode.Envelope; messageId: string } | undefined
    >
{
  public readonly name = metadata.name;

  public readonly version = metadata.version;

  public send(
    mail: import('nodemailer/lib/mailer/mail-message'),
    callback: (
      err: Error | null,
      info?: { envelope: MimeNode.Envelope; messageId: string },
    ) => void,
  ) {
    const envelope = mail.message.getEnvelope();
    const messageId = mail.message.messageId();
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
        .then(() => callback(null, { envelope, messageId }))
        .catch(callback);
    });
  }
}
