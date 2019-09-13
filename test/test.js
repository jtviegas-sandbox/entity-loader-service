'use strict';

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
    , STORELOADERSERVICE_ENTITIES: ['item','part']
    , STORELOADERSERVICE_ENVIRONMENTS_LIST: 'production,development'
    , STORELOADERSERVICE_ENVIRONMENTS: ['production','development']

    , STORELOADERSERVICE_BUCKETWRAPPER_TEST: {
        aws_s3_endpoint: 'http://localhost:5000'
        , aws_container_name: 's3'
    }

    , DYNDBSTORE_AWS_REGION: 'eu-west-1'
    , DYNDBSTORE_AWS_ACCESS_KEY_ID: process.env.ACCESS_KEY_ID
    , DYNDBSTORE_AWS_ACCESS_KEY: process.env.ACCESS_KEY
    , DYNDBSTORE_AWS_DB_ENDPOINT: 'http://localhost:8000'

    , BUCKETWRAPPER_AWS_REGION: 'eu-west-1'
    , BUCKETWRAPPER_AWS_ACCESS_KEY_ID: process.env.ACCESS_KEY_ID
    , BUCKETWRAPPER_AWS_ACCESS_KEY: process.env.ACCESS_KEY
    , BUCKETWRAPPER_TEST: {
        aws_s3_endpoint: 'http://localhost:5000'
        , aws_container_name: 's3'
    }
    , STORELOADERSERVICE_TEST_ENVIRONMENT: 'development'
    , STORELOADERSERVICE_TEST_RESOURCES: 'test/resources'
    , STORELOADERSERVICE_TEST_BUCKET: 'test-bucket'

};
const fs = require('fs');
const path = require('path');
const winston = require('winston');
const commons = require('@jtviegas/jscommons').commons;
const logger = winston.createLogger(commons.getDefaultWinstonConfig());
const bw = require('@jtviegas/bucket-wrapper')(config);
const index = require('../index')(config);
const chai = require('chai');
const expect = chai.expect;
const store = require('@jtviegas/dyndbstore');

describe('index tests', function() {

    this.timeout(50000);
    let table = commons.getTableNameV1(config.STORELOADERSERVICE_TENANT
        , config.STORELOADERSERVICE_ENTITY
        , config.STORELOADERSERVICE_TEST_ENVIRONMENT, config.STORELOADERSERVICE_ENTITIES
        , config.STORELOADERSERVICE_ENVIRONMENTS);

    before(function(done) {
        try{
            store.init(config );

            let promise = new Promise(function(resolve, reject) {
                store.findTable(table, (e,r) => {
                    if(e)
                        reject(e);
                    else{
                        if(true !== r){
                            store.createTable(table, (e) => {
                                if(e)
                                    reject(e);
                                else
                                    resolve(null);
                            });
                        }
                        else
                            resolve(null);
                    }
                });
            });
            let files = fs.readdirSync(config.STORELOADERSERVICE_TEST_RESOURCES);
            for(let i=0; i < files.length; i++){
                promise = promise.then(() => new Promise(function(resolve, reject) {
                    let file = files[i];
                    let filePath = path.join(config.STORELOADERSERVICE_TEST_RESOURCES, file);
                    let bucketKey = `${config.STORELOADERSERVICE_TEST_ENVIRONMENT}/${file}`
                    let data = fs.readFileSync(filePath);
                    bw.createObject(config.STORELOADERSERVICE_TEST_BUCKET, bucketKey , data, (e,r) => {
                        if(e)
                            reject(e);
                        else
                            resolve(null);
                    });
                }));
            }

            promise.then(() => done(null)) .catch(e => done(e));

        }
        catch(e){
            done(e);
        }

    });

    describe('...bucket event on development with 3 items', function(done) {

        it('should store 3 objects', function(done) {

            index.load(config.STORELOADERSERVICE_TEST_ENVIRONMENT,config.STORELOADERSERVICE_TEST_ENVIRONMENT, config.STORELOADERSERVICE_TEST_BUCKET, (e,d)=>{
                logger.info("e: %o", e);
                if(e)
                    done(e);
                else {
                    try{
                        store.getObjs(table, (e,r) => {
                            if(e)
                                done(e);
                            else {
                                expect(r.length).to.equal(3);
                                done(null);
                            }
                        });
                    }
                    catch(e){
                        done(e);
                    }
                }
            });
        });
    });
});