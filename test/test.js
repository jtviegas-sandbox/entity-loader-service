'use strict';

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const commons = require('@jtviegas/jscommons').commons;
const logger = winston.createLogger(commons.getDefaultWinstonConfig());
const chai = require('chai');
const expect = chai.expect;
const store = require('@jtviegas/dyndbstore');

const config = {

    STORELOADERSERVICE_AWS_REGION: 'eu-west-1'
    , STORELOADERSERVICE_AWS_ACCESS_KEY_ID: process.env.ACCESS_KEY_ID
    , STORELOADERSERVICE_AWS_ACCESS_KEY: process.env.ACCESS_KEY
    , STORELOADERSERVICE_DATA_DESCRIPTOR_FILE: 'data.spec'

    , STORELOADERSERVICE_TEST: {
        bucket_endpoint: 'http://localhost:5000'
        , store_endpoint: 'http://localhost:8000'
    }

    , DYNDBSTORE_AWS_REGION: 'eu-west-1'
    , DYNDBSTORE_AWS_ACCESS_KEY_ID: process.env.ACCESS_KEY_ID
    , DYNDBSTORE_AWS_ACCESS_KEY: process.env.ACCESS_KEY
    , DYNDBSTORE_AWS_DB_ENDPOINT: 'http://localhost:8000'

    , APP: 'test'
    , ENTITY: 'item'
    , ENVIRONMENT: 'development'
    , BUCKET: 'test'

};

const index = require('../index')(config);


describe('index tests', function() {

    this.timeout(50000);
    before(function(done) {
        try{
            store.init(config);
            done(null);
        }
        catch(e){
            done(e);
        }
    });

    describe('...bucket event on development with 3 items', function(done) {

        it('should store 3 objects', function(done) {

            index.load(config.APP, config.ENTITY, config.ENVIRONMENT, config.BUCKET, (e,d)=>{
                logger.info("e: %o", e);
                if(e)
                    done(e);
                else {
                    try{
                        let table = commons.getTableNameV4(config.APP, config.ENTITY, config.ENVIRONMENT);
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