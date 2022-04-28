import dns from 'dns';
import net from 'net';
import tls from 'tls';

import nodemailer from 'nodemailer';

import metadata from './metadata';
import SendmailError from './error/sendmail_error';
import UnsafeError from './error/unsafe_error';
import SMTPClient from './smtp_client';

const createMxConnection = async (domain: string) => {
  const addresses = await new Promise<dns.MxRecord[]>((resolve, reject) =>
    dns.resolveMx(domain, (err, _addresses) =>
      err ? reject(err) : resolve(_addresses),
    ),
  );
  if (!addresses || addresses.length === 0)
    throw new SendmailError(`can not resolve Mx of <${domain}>`);
  addresses.sort((a, b) => a.priority - b.priority);
  // try to connect to the highest priority mx address
  // if fail, try to connect to the next address
  return addresses.reduce(
    (prev, address) =>
      prev.catch(
        (err) =>
          new Promise((resolve, reject) => {
            const socket = net.createConnection(25, address.exchange);
            socket
              .on('error', () => reject(err))
              .on('connect', () => {
                socket.removeAllListeners('error');
                resolve(socket);
              });
          }),
      ),
    Promise.reject<net.Socket>(
      new SendmailError(`can not connect to any SMTP server of ${domain}`),
    ),
  );
};

const waitSending = async (
  socket: net.Socket | tls.TLSSocket,
  client: SMTPClient,
) => {
  socket.pipe(client);
  client.pipe(socket);
  try {
    await new Promise<void>((resolve, reject) => {
      client.on('error', reject).on('end', resolve);
      socket.on('error', reject).on('end', client.end);
    });
  } catch (err) {
    socket.unpipe(client);
    client.unpipe(socket);
    throw err;
  }
};

const sendToSMTP = async (
  senderHost: string,
  senderAddress: string,
  domain: string,
  recipient: string,
  body: Buffer,
) => {
  const clientOpts = {
    senderHost,
    senderAddress,
    recipient,
    body: body.toString('utf-8'),
  };
  const socket = await createMxConnection(domain);
  const client = new SMTPClient(clientOpts);
  socket.setEncoding('utf-8');
  client.setEncoding('utf-8');
  try {
    await waitSending(socket, client);
  } catch (err) {
    if (err instanceof UnsafeError) {
      // STARTTLS
      const tlsSocket = tls.connect({ socket });
      const newClient = new SMTPClient({
        ...clientOpts,
        ...{ preGreet: true },
      });
      newClient.setEncoding('utf-8');
      await waitSending(tlsSocket, newClient);
    } else {
      throw err;
    }
  }
};

/**
 * Get host of an email address
 * @param address an email address
 * @returns the host of the email address
 * @throws `Error('invalid email address')`
 * @example
 * getHost('example@example.com'); // 'example.com'
 */
const getHost = (address: string) => {
  // keep regexp simple
  const arr = /^[^\s@]+@((?:[^\s@.,]+\.)+[^\s@.,]{2,})$/.exec(address);
  if (arr === null) throw new SendmailError('invalid email address');
  return arr[1];
};

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
            return sendToSMTP(
              getHost(senderAddress),
              senderAddress,
              getHost(address),
              address,
              msg,
            );
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
