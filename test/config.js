'use strict';

const winston = require('winston');

const config_module = function(){

    let config = {
        ENV_SCOPE: ['pro', 'dev']
        , WINSTON_CONFIG: {
            level: 'debug',
            format: winston.format.combine(
                winston.format.splat(),
                winston.format.timestamp(),
                winston.format.printf(info => {
                    return `${info.timestamp} ${info.level}: ${info.message}`;
                })
            ),
            transports: [new winston.transports.Console()]
        }
        , BUCKET_FOLDER_PROD: 'production'
        , BUCKET_FOLDER_DEV: 'development'
        , BUCKET_FOLDERS: ['production', 'development']
        ,TENANT: 'test'
        , ENTITIES: 'items'
        , DB_API_ACCESS_KEY_ID: 'xpto'
        , DB_API_ACCESS_KEY: 'xpto'
        , DATA_DESCRIPTOR_FILE: 'items.txt'
        , DB_ENDPOINT: 'http://localhost:8000'
        , DB_API_REGION: 'eu-west-1'
        , DB_API_VERSION: '2012-08-10'
        , S3_REGION: 'eu-west-1'
        , TABLES: {
            pro: 'test_items_pro'
            , dev: 'test_items_dev'
        }
        , S3_AMAZON_URL: 'https://s3.eu-west-1.amazonaws.com'
        , AWS_REGION: 'eu-west-1'
        , AWS_API_VERSION: '2006-03-01'
        , test: {
            aws_s3_endpoint: 'http://localhost:5000'
            , bucket: 'test-items'
            , bucket_folder: 'development'
            , aws_container_name: 's3'
            , filename: 'a.txt'
            , file_binary: 'dljkfhlkjfhvjlqebdsajkvCBDSKLJavbakjsdbvjkadsbvkjabsdvjklabsdjklvbkajdsbvkjlabsjkvbaksdjlbvlkj'
            , DATA_DESCRIPTOR_FILE: 'items.txt'
        }
    };

    console.log(config);
    return config;
    
}();

module.exports = config_module;
