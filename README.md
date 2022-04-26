# Sendmail2

Sendmail2 - Send Mail to Somewhere You Want

Sendmail2 is a package with [nodemailer][nodemailer-npm](^6.6.1) as a peer
dependency. It tries to send emails without `sendmail` command.

## Installation

You can install Sendmail2 using `npm`.

```sh
npm i sendmail2
```

## Usage

```typescript
import sendmail2 from 'sendmail2';
import nodemailer from 'nodemailer';

const transport = new sendmail2.Transport();
const transporter = nodemailer.createTransport(transport);
transporter.sendMail({
  from: 'foo@example.com',
  to: 'bar@example.com',
  subject: 'Sendmail2',
  text: 'Send mail 2 u!',
});
```

## Inspiration

The package is inspired by [sendmail][sendmail-npm].

## Contributing

Contributing is welcome!

## License

MIT

[nodemailer-npm]: https://www.npmjs.com/package/nodemailer
[sendmail-npm]: https://www.npmjs.com/package/sendmail
