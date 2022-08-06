# Sendmail2

Sendmail2 - Send Mail to Somewhere You Want

Sendmail2 is a package that you can create a transport of
[nodemailer][nodemailer-npm](^6.6.1) or send emails directly.

## Installation

You can install Sendmail2 using `npm`, `yarn`, or `pnpm`.

```sh
# npm
npm i sendmail2
# yarn
yarn add sendmail2
# pnpm
pnpm add sendmail2
```

## Usage

- Create a transport of nodemailer

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

- Send an email directly

```typescript
import sendmail2 from 'sendmail2';

const sender = new sendmail2.Sender();
sender.send({
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

## Links

[GitHub](https://github.com/2020leon/sendmail2),
[npm](https://www.npmjs.com/package/sendmail2),
[yarn](https://yarnpkg.com/package/sendmail2)

[nodemailer-npm]: https://www.npmjs.com/package/nodemailer
[sendmail-npm]: https://www.npmjs.com/package/sendmail
