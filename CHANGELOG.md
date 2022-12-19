# Changelog

## 0.2.1 (2022-12-19)

### Bug Fixes

- fix redundant leading space of body

## 0.2.0 (2022-09-18)

### Features

- remove default export in index.ts

### Bug Fixes

- correct error message

## 0.1.3 (2022-07-27)

### Bug Fixes

- pass second argument to callback if success
  - avoid "TypeError: Cannot set properties of undefined"
- use literal name and version in metadata
  - make sure the package always gets the correct name and version no matter it
    is packed or not

## 0.1.2 (2022-05-21)

### Bug Fixes

- try lower priority host if sending fail

## 0.1.1 (2022-05-19)

### Bug Fixes

- specify node engine version
- rename license file

## 0.1.0 (2022-05-01)

### Features

- add new class to send mail (`Sender`)

## 0.0.1 (2022-04-30)

### Bug Fixes

- close socket after error occurred
- throw error if response code is not handled
