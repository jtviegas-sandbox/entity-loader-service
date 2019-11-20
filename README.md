[![Build Status](https://travis-ci.org/jtviegas/store-loader-service.svg?branch=master)](https://travis-ci.org/jtviegas/store-loader-service)
[![Coverage Status](https://coveralls.io/repos/github/jtviegas/store-loader-service/badge.svg?branch=master)](https://coveralls.io/github/jtviegas/store-loader-service?branch=master)

entity loader service
=========

a service that handles entities persistence from a cloud bucket into a store, reacting to the event triggered by the update of the bucket content

## Installation

  `npm install @jtviegas/entity-loader-service`

## Usage

### required environment variables
  - AWS_ACCESS_KEY_ID ( mandatory )
  - AWS_SECRET_ACCESS_KEY ( mandatory )
  - region: aws region ( optional, default = eu-west-1 )
  - DYNDBSTORE_TEST_ENDPOINT ( optional, just for testing purposes )
  - BUCKETWRAPPER_TEST_ENDPOINT ( optional, just for testing purposes )

### code snippet example

    ...
    const service = require('@jtviegas/store-loader-service');
    ...
    service.load(app, environment, bucket, callback);
    
  Check the test folder in source tree.
  
## Tests

    npm test

## Contributing

just help yourself and submit a pull request