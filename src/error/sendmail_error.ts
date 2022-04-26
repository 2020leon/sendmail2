export default class SendmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SendmailError';
  }
}
