#!/usr/bin/env bash

NAME=$(node -p "require('./package.json').name")
VERSION=$(node -p "require('./package.json').version")
printf "export const name = '%s';\nexport const version = '%s';\n" "$NAME" "$VERSION" >| src/metadata.ts
git add src/metadata.ts
