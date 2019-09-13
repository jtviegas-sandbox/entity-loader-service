[![Build Status](https://travis-ci.org/jtviegas/store-loader-service.svg?branch=master)](https://travis-ci.org/jtviegas/store-loader-service)
[![Coverage Status](https://coveralls.io/repos/github/jtviegas/store-loader-service/badge.svg?branch=master)](https://coveralls.io/github/jtviegas/store-loader-service?branch=master)
store loader service
=========

a service that handles entities persistence from a cloud bucket into a store, reacting to the event triggered by the update of the bucket content

## Installation

  `npm install @jtviegas/store-loader-service`

## Usage

### required environment variables or configuration properties
  - STORELOADERSERVICE_AWS_DB_ENDPOINT - optional, for testing purposes, will use `aws` account to connect to `DynamoDb`
  - STORELOADERSERVICE_AWS_REGION
  - STORELOADERSERVICE_AWS_ACCESS_KEY_ID
  - STORELOADERSERVICE_AWS_ACCESS_KEY
  - STORELOADERSERVICE_DATA_DESCRIPTOR_FILE
  - STORELOADERSERVICE_BUCKET_HOST_URL
  - STORELOADERSERVICE_TENANT
  - STORELOADERSERVICE_ENTITY
  - STORELOADERSERVICE_ENTITIES_LIST
  - STORELOADERSERVICE_ENVIRONMENTS_LIST

### code snippet example

    ...
    const config = {
        STORELOADERSERVICE_AWS_DB_ENDPOINT: 'http://localhost:8000' 
        , STORELOADERSERVICE_AWS_REGION: 'eu-west-1'
        , STORELOADERSERVICE_AWS_ACCESS_KEY_ID: process.env.ACCESS_KEY_ID
        , STORELOADERSERVICE_AWS_ACCESS_KEY: process.env.ACCESS_KEY
        , STORELOADERSERVICE_DATA_DESCRIPTOR_FILE: 'items.txt'
        , STORELOADERSERVICE_BUCKET_HOST_URL: 'https://s3.eu-west-1.amazonaws.com'
        , STORELOADERSERVICE_TENANT: 'test'
        , STORELOADERSERVICE_ENTITY: 'item'
        , STORELOADERSERVICE_ENTITIES_LIST: 'item,part'
        , STORELOADERSERVICE_ENVIRONMENTS_LIST: 'production,development'
    }
    const service = require('@jtviegas/store-loader-service')(config);
    ...
    service.load(environment,folder, bucket, callback);
    
  Check the test folder in source tree.
  
## Tests

    npm test

## Contributing

just help yourself and submit a pull request