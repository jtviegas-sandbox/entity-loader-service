'use strict';

const winston = require('winston');
const config = require("./config");
const logger = winston.createLogger(config['WINSTON_CONFIG']);
const bw = require('@jtviegas/bucket-wrapper')(config);
const index = require('../index')(config);
const chai = require('chai');
const expect = chai.expect;
const store = require('@jtviegas/dyndbstore');
const fs = require('fs');


describe('index tests', function() {

    this.timeout(50000);

    before(function(done) {
        try{
            store.init({ apiVersion: config.DB_API_VERSION , region: config.DB_API_REGION
                , endpoint: config.DB_ENDPOINT,
                accessKeyId: process.env.DB_API_ACCESS_KEY_ID , secretAccessKey: process.env.DB_API_ACCESS_KEY } );

            new Promise(function(resolve, reject) {
                store.findTable(config.TABLES.dev, (e,r) => {
                    if(e)
                        reject(e);
                    else{
                        if(true !== r){
                            store.createTable(config.TABLES.dev, (e) => {
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
            }).then(
                () =>   new Promise(function(resolve, reject) {
                    let objkey = config.test.bucket_folder + '/' + config.test.filename;
                    logger.debug("creating object: %s", objkey);
                    bw.createObject(config.test.bucket, objkey , config.test.file_binary, (e,r) => {
                            if(e)
                                reject(e);
                            else
                                resolve(null);
                        });
                })
            ).then(
                    () =>   new Promise(function(resolve, reject) {
                        let objkey = config.test.bucket_folder + '/' + config.DATA_DESCRIPTOR_FILE;
                        logger.debug("creating object: %s", objkey);
                        let data = fs.readFileSync('test/resources/' + config.DATA_DESCRIPTOR_FILE);
                        bw.createObject(config.test.bucket, objkey , data, (e,r) => {
                            if(e)
                                reject(e);
                            else
                                resolve(null);
                        });
                    })
            ).then(
                () =>   new Promise(function(resolve, reject) {
                    let objkey = config.test.bucket_folder + '/1_1.png';
                    logger.debug("creating object: %s", objkey);
                    let data = fs.readFileSync('test/resources/1_1.png');
                    bw.createObject(config.test.bucket, objkey , data, (e,r) => {
                        if(e)
                            reject(e);
                        else
                            resolve(null);
                    });
                })
            ).then(
                () =>   new Promise(function(resolve, reject) {
                    let objkey = config.test.bucket_folder + '/1_2.png';
                    logger.debug("creating object: %s", objkey);
                    let data = fs.readFileSync('test/resources/1_2.png');
                    bw.createObject(config.test.bucket, objkey , data, (e,r) => {
                        if(e)
                            reject(e);
                        else
                            resolve(null);
                    });
                })
            ).then(
                () =>   new Promise(function(resolve, reject) {
                    let objkey = config.test.bucket_folder + '/3_1.png';
                    logger.debug("creating object: %s", objkey);
                    let data = fs.readFileSync('test/resources/3_1.png');
                    bw.createObject(config.test.bucket, objkey , data, (e,r) => {
                        if(e)
                            reject(e);
                        else
                            resolve(null);
                    });
                })
            )
                .then(() => done(null))
                .catch(e => done(e));

        }
        catch(e){
            done(e);
        }

    });

    describe('...bucket event on development with 3 items', function(done) {

        it('should store 3 objects', function(done) {

            index.load('dev','development', 'test-items', (e,d)=>{
                logger.info("e: %o", e);
                if(e)
                    done(e);
                else {
                    try{
                        store.getObjs(config.TABLES.dev, (e,r) => {
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