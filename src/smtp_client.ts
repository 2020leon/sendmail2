import stream from 'stream';

import SendmailError from './error/sendmail_error';
import UnsafeError from './error/unsafe_error';

interface CmdMsg {
  cmd: string;
  msg?: string;
}

/* global BufferEncoding */

/**
 * SMTP clients are `Transform` streams that handle responses from a SMTP server
 * and send requests to the server.
 */
export default class SMTPClient extends stream.Transform {
  private strBuf = '';

  private canBeTLS = false;

  private readonly senderHost: string;

  private readonly list250: CmdMsg[];

  private readonly body: string;

  private readonly isTLS: boolean;

  constructor(
    options: stream.TransformOptions & {
      objectMode?: false;
      senderHost: string;
      senderAddress: string;
      recipient: string;
      body: string;
      // send EHLO command to server right after a client created
      preGreet?: boolean;
    },
  ) {
    // objectMode should be false to make sure `chunk` be Buffer or string
    super({ ...options, objectMode: false });
    this.senderHost = options.senderHost;
    this.list250 = [
      {
        cmd: 'MAIL',
        msg: `FROM: <${options.senderAddress}>`,
      },
      {
        cmd: 'RCPT',
        msg: `TO: <${options.recipient}>`,
      },
      { cmd: 'DATA' },
      { cmd: 'QUIT' },
    ];
    this.body = options.body;
    this.isTLS = options.preGreet ?? false;
    if (options.preGreet)
      this.pushResponse({ cmd: 'EHLO', msg: options.senderHost });
  }

  public override _transform(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: stream.TransformCallback,
  ): void {
    const _chunk = typeof chunk === 'string' ? chunk : chunk.toString();
    const lineBuf = (this.strBuf + _chunk).split('\r\n');
    this.strBuf = lineBuf.pop() ?? '';

    let code = '';
    let msg = '';

    return callback(
      lineBuf.reduce<Error | null | undefined>((result, line) => {
        // if result is error or null, break the loop
        if (result || result === null) return result;
        const _code = line.slice(0, 3);
        const _msg = line.slice(4);
        if (code !== '' || msg !== '') {
          if (code !== _code)
            return new SendmailError(`invalid smtp server message: ${line}`);
          msg += `\r\n${_msg}`;
        } else {
          code = _code;
          msg = _msg;
        }
        if (line[3] !== ' ') {
          if (line[3] !== '-')
            return new SendmailError('invalid smtp server message');
        } else {
          const response = this.response(code, `${msg}\r\n`);
          if (response instanceof SendmailError || response === null)
            return response;
          this.pushResponse(response);
          msg = '';
          code = '';
        }
        return result;
      }, undefined),
    );
  }

  public override _flush(callback: stream.TransformCallback): void {
    return callback(
      this.strBuf === ''
        ? null
        : new SendmailError('still some string in buffer'),
    );
  }

  private response(code: string, msg: string): CmdMsg | null | SendmailError {
    switch (Number(code)) {
      case 220: // Service ready
        if (!this.isTLS && this.canBeTLS)
          return new UnsafeError('STARTTLS is available');
        return {
          cmd: /\besmtp\b/i.test(msg) ? 'EHLO' : 'HELO',
          msg: this.senderHost,
        };
      case 221: // Goodbye
        return null;
      case 250: // Requested mail action okay, completed
        if (!this.isTLS && /\bSTARTTLS\b/i.test(msg)) {
          this.canBeTLS = true;
          return { cmd: 'STARTTLS' };
        }
        return this.list250.shift() ?? { cmd: 'QUIT' };
      case 251: // User not local; will forward to <forward-path>
        return this.list250.shift() ?? { cmd: 'QUIT' };
      case 354: // Start mail input
        return { cmd: `${this.body}.` };
      default:
        return new SendmailError(`get code ${code} and response ${msg}`);
    }
  }

  private pushResponse({ cmd, msg }: CmdMsg): boolean {
    return this.push(`${cmd}${msg === undefined ? '' : ` ${msg}`}\r\n`);
  }
}
