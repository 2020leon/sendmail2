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
  if (addresses.length === 0)
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
      socket.on('error', reject);
    });
  } finally {
    socket.unpipe(client);
    client.unpipe(socket);
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
  try {
    client.setEncoding('utf-8');
    await waitSending(socket, client);
  } catch (err) {
    if (err instanceof UnsafeError) {
      // STARTTLS
      const tlsSocket = tls.connect({ socket });
      const newClient = new SMTPClient({
        ...clientOpts,
        ...{ preGreet: true },
      });
      try {
        newClient.setEncoding('utf-8');
        await waitSending(tlsSocket, newClient);
      } finally {
        tlsSocket.end();
        newClient.end();
      }
    } else throw err;
  } finally {
    client.end();
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
  await exchanges.reduce(async (prev, exchange) => {
    try {
      await prev;
    } catch (err) {
      let socket: Awaited<ReturnType<typeof createConnection>>;
      try {
        socket = await createConnection(exchange);
      } catch {
        throw err;
      }
      try {
        socket.setEncoding('utf-8');
        await sendToSocket(senderAddress, recipient, socket, body);
      } finally {
        socket.end();
      }
    }
  }, Promise.reject<void>(new SendmailError(`can not connect to any SMTP server of ${domain}`)));
};

export default sendToSMTP;
