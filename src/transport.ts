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

  public async send(
    mail: import('nodemailer/lib/mailer/mail-message'),
    callback: (
      err: Error | null,
      info?: { envelope: MimeNode.Envelope; messageId: string },
    ) => void,
  ) {
    try {
      const envelope = mail.message.getEnvelope();
      const messageId = mail.message.messageId();
      const senderAddress = envelope.from;
      if (!senderAddress) throw new SendmailError('sender address is invalid');
      const body = await new Promise<Buffer>((resolve, reject) =>
        mail.message.build((err, msg) => (err ? reject(err) : resolve(msg))),
      );
      await Promise.all(
        envelope.to.map((address) => sendToSMTP(senderAddress, address, body)),
      );
      return callback(null, { envelope, messageId });
    } catch (e) {
      const err = e as Error;
      return callback(err);
    }
  }
}
