import SendmailError from './sendmail_error';

export default class UnsafeError extends SendmailError {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeError';
  }
}
