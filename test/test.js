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

    , APP: 'app'
    , ENTITIES: ['entity1','entity2']
    , ENVIRONMENT: 'development'
    , BUCKET: "app-development-entities"

};

const index = require('../index')(config);


describe('index tests', function() {

    this.timeout(50000);
    let tables = [];
    for( let i=0; i < config.ENTITIES.length; i++ ){
        tables.push(commons.getTableNameV4(config.APP, config.ENTITIES[i], config.ENVIRONMENT))
    }

    before(function(done) {
        try{
            store.init(config);
            done(null);
        }
        catch(e){
            done(e);
        }
    });

    describe('...bucket event on development with 3 items on each entity folder', function(done) {

        it('should store 3 objects in each table', function(done) {

            index.load(config.APP, config.ENVIRONMENT, config.BUCKET, (e,d)=>{
                logger.info("e: %o", e);
                if(e)
                    done(e);
                else {
                    try{
                        for( let i=0; i < tables.length; i++ ) {
                            let table = tables[i];
                            store.getObjs(table, (e, r) => {
                                if (e)
                                    done(e);
                                else {
                                    expect(r.length).to.equal(3);
                                    if( i == (tables.length-1) )
                                        done(null);
                                }
                            });
                        }
                    }
                    catch(e){
                        done(e);
                    }
                }
            });
        });
    });
});