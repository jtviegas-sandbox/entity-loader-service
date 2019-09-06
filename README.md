[![Build Status](https://travis-ci.org/jtviegas/store-loader-service.svg?branch=master)](https://travis-ci.org/jtviegas/store-loader-service)
[![Coverage Status](https://coveralls.io/repos/github/jtviegas/store-loader-service/badge.svg?branch=master)](https://coveralls.io/github/jtviegas/store-loader-service?branch=master)
store loader service
=========

...that is it, a service that handles entities persistence from an cloud bucket into a store

## Installation

  `npm install @jtviegas/store-loader-service`

## Usage

    const service = require('@jtviegas/store-loader-service')(config);
    ...
    if( null === env  || null === bucket || null === folder )
        throw new ServerError("event must provide 'env', 'folder' and 'bucket'", 400);
    
    service.load(env, folder, bucket, callback);
    
  Check the test folder in source tree.
## Tests

  `npm test`

## Contributing

In lieu of a formal style guide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code.
