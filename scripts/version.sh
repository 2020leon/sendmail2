#!/usr/bin/env bash

echo "export default { name: '$(node -p "require('./package.json').name")', version: '$(node -p "require('./package.json').version")' };" >| src/metadata.ts
git add src/metadata.ts
