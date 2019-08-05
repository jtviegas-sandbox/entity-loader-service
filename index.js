'use strict';

const winston = require('winston');
const store = require('@jtviegas/dyndbstore');
const aws = require('aws-sdk');
const s3 = new aws.S3();
const papa = require('papaparse');

const DATE_PATTERN = /(\d{4})(\d{2})(\d{2})/;
const imageListingRegex=/^(production|development)\/\d+_\d+\.(png|jpg)/i;
const imageRegex=/^(production|development)\/(\d+)_*/;

const storeLoaderService = (config) => {

    if (!config)
        throw new Error('!!! must provide config to initialize module !!!');

    const logger = winston.createLogger(config['WINSTON_CONFIG']);
    logger.info("...initializing storeLoaderService module...");

    let storeConfig = { apiVersion: config.DB_API_VERSION , region: config.DB_API_REGION
        , accessKeyId: config.DB_API_ACCESS_KEY_ID , secretAccessKey: config.DB_API_ACCESS_KEY };

    if( config.DB_ENDPOINT )
        storeConfig['endpoint'] = config.DB_ENDPOINT;

    store.init( storeConfig );
    logger.info("...initialized the storeLoaderService successfully !");

    const toItem = (o, index) => {
        logger.debug("[toItem|in] (%s,%s)", JSON.stringify(o), index);
        if(!Array.isArray(o))
            throw Error("items conveyor is not an array: ", o);

        if( config.ITEM_PROPERTIES_NUMBER > o.length )
            throw Error("item conveyor has wrong number of properties: ", o);

        let result = {};
        result['id'] = config.ID_SEED + index;
        result['number'] = parseInt(o[0], 10);
        result['family'] = o[1];
        result['category'] = o[2];
        result['subcategory'] = o[3];
        result['name'] = o[4];
        result['price'] = parseFloat(o[5]);
        result['notes'] = o[6];
        result['images'] = [];
        let dateAsString = null;
        try{
            dateAsString = o[7];
            let dt = new Date(dateAsString.replace(DATE_PATTERN,'$1-$2-$3'));
            result['ts'] = dt.getTime();
        }
        catch(e){
            logger.error("[toItem] could not parse the date: ", dateAsString, " err:", e)
            result['ts'] = Date.now();
        }

        logger.debug("[toItem|out] => %s", JSON.stringify(result));
        return result;
    };

    const handleDataDescriptorContents = (contents, data) => {
        logger.debug("[handleDataDescriptorContents|in] (%s)", JSON.stringify(data));

        data.data = {};
        let config = { delimiter: ',', newline: '\n', quoteChar: '"', comments: true, skipEmptyLines: true };
        let buff = Buffer.from(contents.Body);
        let parsed = papa.parse(buff.toString(), config);
        if(parsed.data && Array.isArray(parsed.data) && 0 < parsed.data.length ){
            for(let i = 0; i < parsed.data.length; i++){
                let obj = parsed.data[i];
                let item = toItem(obj, i);
                data.data[item.id] = item;
            }
        }
        logger.debug("[handleDataDescriptorContents|out] %o", data);
        return data;
    }


    const handleDataDescriptorFile = async (bucket, folder, data) => {
        logger.debug("[handleDataDescriptorFile|in] (%s,%s)", bucket, folder);
        let params = {
            Bucket: bucket,
            Key:  folder + '/' + config.DATA_DESCRIPTOR_FILE
        };
        let contents = await s3.getObject(params);
        let result = {}
        handleDataDescriptorContents(contents, result);
        logger.debug("[handleDataDescriptorFile|out] data => %o", result);
        return result;
    }

    const listImages = (bucket, folder, data) => {
        logger.debug("[listImages|in] (%s, %s, %o)", bucket, folder, data);
        return new Promise(function(resolve, reject) {
            s3.listObjectsV2({ Bucket: bucket, Prefix: folder + '/' }, function(e, d) {
                logger.debug("[s3.listObjectsV2|in] (%s, %s, %o)", bucket, folder, data);
                if (e) {
                    logger.error("[s3.listObjectsV2|out] e => %o", e);
                    reject(e);
                }
                else {
                    try {
                        data.etags = {};
                        for(let i=0; i < d.Contents.length; i++){
                            let obj = d.Contents[i];
                            let match = obj.Key.match(imageListingRegex);
                            if( null !== match )
                                data.etags[obj.ETag] = obj.Key;
                        }
                        logger.debug("[s3.listObjectsV2|out] => %o", data);
                        resolve(data);
                    }
                    catch(e){
                        logger.error("[s3.listObjectsV2|out] e => %o", e);
                        reject(e);
                    }
                }
            });
        });
        logger.debug("[listImages|out]");
    }

    const toImage = (bucket, name, v) => {
        let image = {};
        image['name'] = name;
        image['type'] = v['ContentType'];
        image['href'] = config.S3_AMAZON_URL + '/' + bucket + '/' + name;
        return image;
    };

    const retrieveImages = (bucket, data) => {
        logger.debug("[retrieveImages|in] (%s, %o)", bucket, data);

        let promises = [];
        for (let key in data.etags) {
            if (data.etags.hasOwnProperty(key))
                promises.push(s3.getObject({ Bucket: bucket, Key: data.etags[key] }).promise());
        }

        return new Promise(function(resolve, reject) {
            Promise.all(promises).then(d => {
                logger.debug("[retrieveImages.Promise.all.then|in] d.size => %d", d.length);
                try{
                    for(let i=0; i < d.length; i++){
                        let o = d[i];
                        let filename = data.etags[o.ETag];
                        let match = filename.match(imageRegex);
                        if( null !== match && Array.isArray(match) && 1 < match.length ){
                            let number = parseInt(match[2], 10);
                            if( ! data.data[number] )
                                throw Error('wrong number on image: ' + filename );
                            let image = toImage(bucket, filename,o);
                            data.data[number]['images'].push(image);
                            logger.info("[retrieveImages.Promise.all.then] image %s for number %d", filename, number);
                        }
                    }
                    logger.info("[retrieveImages.Promise.all.then] data.data: %o", data.data);
                    resolve(data);
                }
                catch(e){
                    logger.error("[retrieveImages.Promise.all.then] %o", e);
                    reject(e);
                }

            }).catch((e) => reject(e));
        });
        logger.debug("[retrieveImages|in] => promises.length: %d", promises.length);
    }

    const updateStore = (bucket, stage, data) => {
        logger.debug("[updateStore|in] (%s, %o)", bucket, data);
        return new Promise(function(resolve, reject) {

            store.findObjIds(config.TABLE, (e,r) => {
                if(e){
                    logger.error("[updateStore.store.findObjIds] trouble finding ids : %o", e);
                    reject(e);
                }
                else {
                    store.delObjs(config.TABLE, r, (e) => {
                        if(e){
                            logger.error("[updateStore.store.delObjs] trouble deleting entities : %o", e);
                            reject(e);
                        }
                        else {
                            store.putObjs(config.TABLE, data.data, (e) => {
                                if(e){
                                    logger.error("[updateStore.store.putObjs] trouble putting entities : %o", e);
                                    reject(e);
                                }
                                else{
                                    logger.info("[updateStore.store.putObjs] saved entities successfully");
                                    resolve();
                                }
                            } );
                        }
                    });
                }
            });

        });
        logger.debug("[updateStore|out]");
    }


    const load = (stage, folder, bucket, callback) => {
        logger.info("[load|in] (%s,%s)", stage, bucket);

        try{
            let data = {}
            let promise = handleDataDescriptorFile(bucket, folder, data);
            promise.catch(e => callback(e));
            promise = promise.then( listImages(bucket, folder, data) );
            promise.catch(e => callback(e));
            promise = promise.then( d => retrieveImages(bucket, d) );
            promise.catch(e => callback(e));
            promise = promise.then( d => updateStore(bucket, stage, d) );
            promise.catch(e => callback(e));
            promise.then(callback(null));
        }
        catch(e){
            logger.error("[load] %o", e);
            callback(e);
        }

        logger.info("[load|out]");
    }

    return { load: load }
}

module.exports = storeLoaderService;
