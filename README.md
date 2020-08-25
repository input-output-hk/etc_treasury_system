# ETC Treasury

Prototype implementation of a proto-Ethereum Classic Treasury System (p-ECTS). The purpose of this codebase is only to start-up discussions on it's interface and intended behaviour, **this codebase should not be used on any productive environment** until further testing and security analysis are done on it.

## Requirements

- Install local dependencies: `npm install`
- Install test node: `npm install -g ganache-cli`

## Tests

**Test node**

A test node is required to be running before starting the tests:
```sh
ganache-cli
```

**Running the tests**

```sh
npm run test
```

**Running tests With coverage**

```sh
npm run coverage
```

You can browse *./coverage/index.html* for a more in depth report.


## Linter

```sh
npm run ethlint # solidity
npm run eslint # js
```