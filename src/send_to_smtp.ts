import dns from 'dns';
import net from 'net';
import tls from 'tls';

import SendmailError from './error/sendmail_error';
import UnsafeError from './error/unsafe_error';
import SMTPClient from './smtp_client';

const getMxRecordExchanges = async (domain: string) => {
  const addresses = await new Promise<dns.MxRecord[]>((resolve, reject) =>
    dns.resolveMx(domain, (err, _addresses) =>
      err ? reject(err) : resolve(_addresses),
    ),
  );
  if (!addresses || addresses.length === 0)
    throw new SendmailError(`can not resolve Mx of <${domain}>`);
  return addresses
    .sort((a, b) => a.priority - b.priority)
    .map((address) => address.exchange);
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

const createConnection = (host: string) => {
  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.createConnection(25, host);
    socket.on('error', reject).on('connect', () => {
      socket.removeAllListeners('error');
      resolve(socket);
    });
  });
};

const sendToSocket = async (
  senderAddress: string,
  recipient: string,
  socket: net.Socket,
  body: Buffer,
) => {
  const clientOpts = {
    senderHost: getHost(senderAddress),
    senderAddress,
    recipient,
    body: body.toString('utf-8'),
  };
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
      try {
        await waitSending(tlsSocket, newClient);
      } catch (error) {
        tlsSocket.end();
        newClient.end();
        throw error;
      }
    } else {
      socket.end();
      client.end();
      throw err;
    }
  }
};

/**
 * Send email via SMTP
 * @param senderAddress email address of the sender
 * @param recipient email address of recipient
 * @param body buffer to be sent
 */
const sendToSMTP = async (
  senderAddress: string,
  recipient: string,
  body: Buffer,
) => {
  const domain = getHost(recipient);
  const exchanges = await getMxRecordExchanges(domain);
  // Try to connect to the highest priority mx address and send email. If fail,
  // try to connect to the next address.
  await exchanges.reduce(
    (prev, exchange) =>
      prev.catch(
        (err) =>
          new Promise((resolve, reject) =>
            createConnection(exchange)
              .then((socket) =>
                sendToSocket(senderAddress, recipient, socket, body)
                  .then(resolve)
                  .catch(reject),
              )
              .catch(() => reject(err)),
          ),
      ),
    Promise.reject<void>(
      new SendmailError(`can not connect to any SMTP server of ${domain}`),
    ),
  );
};

export default sendToSMTP;
