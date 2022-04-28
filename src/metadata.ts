import fs from 'fs';
import path from 'path';

const { name, version }: { name: string; version: string } = JSON.parse(
  fs.readFileSync(path.join(path.dirname(__dirname), 'package.json'), 'utf-8'),
);

export default { name, version };
