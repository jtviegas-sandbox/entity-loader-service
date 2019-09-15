'use strict';

const winston = require('winston');
const store = require('@jtviegas/dyndbstore');
const papa = require('papaparse');
const commons = require('@jtviegas/jscommons').commons;

const imageListingRegex=/^(production|development)\/\d+_\d+\.(png|jpg)/i;
const imageRegex=/^(production|development)\/(\d+)_*/;

const storeLoaderService = (config) => {

    if (!config)
        throw new Error('!!! must provide config to initialize module !!!');

    const CONFIGURATION_SPEC = {
        DYNDBSTORE_AWS_REGION: 'STORELOADERSERVICE_AWS_REGION'
        , DYNDBSTORE_AWS_ACCESS_KEY_ID: 'STORELOADERSERVICE_AWS_ACCESS_KEY_ID'
        , DYNDBSTORE_AWS_ACCESS_KEY: 'STORELOADERSERVICE_AWS_ACCESS_KEY'

        , DYNDBSTORE_AWS_DB_ENDPOINT: 'STORELOADERSERVICE_AWS_DB_ENDPOINT'
        , BUCKETWRAPPER_AWS_REGION: 'STORELOADERSERVICE_AWS_REGION'
        , BUCKETWRAPPER_AWS_ACCESS_KEY_ID: 'STORELOADERSERVICE_AWS_ACCESS_KEY_ID'
        , BUCKETWRAPPER_AWS_ACCESS_KEY: 'STORELOADERSERVICE_AWS_ACCESS_KEY'
        , STORELOADERSERVICE_DATA_DESCRIPTOR_FILE: 'STORELOADERSERVICE_DATA_DESCRIPTOR_FILE'
        , STORELOADERSERVICE_BUCKET_HOST_URL: 'STORELOADERSERVICE_BUCKET_HOST_URL'
        , STORELOADERSERVICE_TENANT: 'STORELOADERSERVICE_TENANT'
        , STORELOADERSERVICE_ENTITY: 'STORELOADERSERVICE_ENTITY'
        , STORELOADERSERVICE_ENTITIES_LIST: 'STORELOADERSERVICE_ENTITIES_LIST'
        , STORELOADERSERVICE_ENVIRONMENTS_LIST: 'STORELOADERSERVICE_ENVIRONMENTS_LIST'

        , BUCKETWRAPPER_TEST: 'STORELOADERSERVICE_BUCKETWRAPPER_TEST'
    };

    const logger = winston.createLogger(commons.getDefaultWinstonConfig());
    logger.info("...initializing storeLoaderService module...");
    let configuration = commons.getConfiguration(CONFIGURATION_SPEC, config, commons.handleListVariables);

    const bucketWrapper = require('@jtviegas/bucket-wrapper')(configuration);
    store.init( configuration );
    logger.info("...initialized the storeLoaderService module successfully !");

    const toItem = (index, obj, header) => {
        logger.debug("[toItem|in] (%d,%o,%o)", index, obj, header);
        if(!Array.isArray(obj))
            throw Error("entity fields conveyor is not an array");
        if(0 >= Object.keys(header).length)
            throw Error("header is not a dictionary");

        if( header.length != obj.length )
            throw Error(`header length is different than entry (line: ${index})`);

        let result = {};
        result['id'] = index;
        for(let i=0; i < obj.length; i++){
            let _header = header[i];
            let _value = obj[i];
            result[_header.name] = _header.transformer(_value);
        }
        result['images'] = [];
        logger.debug("[toItem|out] => %o", result);
        return result;
    };

    const transformer = {
        n : (v) => {
            return parseInt(v);
        }
        , t : (v) => {
            return v.trim();
        }
        , d : (v) => {
            let DATE_PATTERN = /(\d{4})(\d{2})(\d{2})/
            let dt = new Date(v.replace(DATE_PATTERN,'$1-$2-$3'));
            return dt.getTime();
        }
        , f : (v) => {
            return parseFloat(v);
        }
    }

    const getHeaderSpec = (arr) => {
        logger.debug("[getHeaderSpec|in] (%o)", arr);
        let result = [];
        for(let i = 0; i < arr.length; i++){
            let field = arr[i];
            let components = field.split("|");
            let name = components[0].trim();
            let type = components[1].trim();
            result.push( { name: name, transformer: transformer[type] } );
        }
        logger.debug("[getHeaderSpec|out] => %o", result);
        return result;
    }

    const handleDataDescriptorFile = (bucket, folder) => {
        logger.debug("[handleDataDescriptorFile|in] (%s,%s)", bucket, folder);

        return new Promise(function(resolve, reject) {

            try {
                let objkey = folder + '/' + configuration.STORELOADERSERVICE_DATA_DESCRIPTOR_FILE;
                logger.debug("getting object: %s", objkey);
                bucketWrapper.getObject(bucket, objkey, (e,o) => {
                    if(e)
                        reject(e);
                    else {
                        try{
                            let data = { data: {}}
                            let config = { delimiter: ',', newline: '\n', quoteChar: '"', comments: true, skipEmptyLines: true };
                            let buff = Buffer.from(o.Body);
                            let parsed = papa.parse(buff.toString(), config);
                            if(parsed.data && Array.isArray(parsed.data) && 0 < parsed.data.length ){
                                let header = getHeaderSpec(parsed.data[0]);
                                for(let i = 1; i < parsed.data.length; i++){
                                    let obj = parsed.data[i];
                                    let item = toItem(i, obj, header);
                                    data.data[item.number] = item;
                                }
                            }
                            resolve(data);
                        }
                        catch(e){
                            reject(e);
                        }
                    }
                });
            }
            catch(e){
                logger.error("[handleDataDescriptorFile.Promise] %o", e);
                reject(e);
            }
        });
        logger.debug("[handleDataDescriptorFile|out]");
    }

    const listImages = (bucket, folder, data) => {
        logger.debug("[listImages|in] (%s, %s, %o)", bucket, folder, data);
        return new Promise(function(resolve, reject) {
            try {
                bucketWrapper.listObjects(bucket, folder , function(e, d) {
                    logger.debug("[bucketWrapper.listObjects|callback|in] (%o, %o)", e, d);
                    if (e)
                        reject(e);
                    else {
                        try {
                            data.etags = {};
                            for(let i=0; i < d.length; i++){
                                let obj = d[i];
                                let match = obj.Key.match(imageListingRegex);
                                if( null !== match )
                                    data.etags[obj.ETag] = obj.Key;
                            }
                            logger.debug("[bucketWrapper.listObjects|callback|out] => %o", data);
                            resolve(data);
                        }
                        catch(e){
                            logger.error("[bucketWrapper.listObjects|callback|catch] e => %o", e);
                            reject(e);
                        }
                    }
                });
            }
            catch(e){
                logger.error("[listImages.Promise] %o", e);
                reject(e);
            }
        });
        logger.debug("[listImages|out]");
    }

    const toImage = (bucket, name, v) => {
        let image = {};
        image['name'] = name.split("/")[1];
        image['type'] = v['ContentType'];
        image['href'] = configuration.STORELOADERSERVICE_BUCKET_HOST_URL + '/' + bucket + '/' + name;
        return image;
    };

    const retrieveImages = (bucket, data) => {
        logger.debug("[retrieveImages|in] (%s, %o)", bucket, data);

        let promises = [];
        for (let key in data.etags) {
            if (data.etags.hasOwnProperty(key)) {
                promises.push(new Promise(function (resolve, reject) {
                    bucketWrapper.getObject(bucket, data.etags[key], (e, r) => {
                        if (e)
                            reject(e);
                        else
                            resolve(r);
                    });
                }));
            }
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

    const updateStore = (table, data) => {
        logger.debug("[updateStore|in] (%s, %o)", table, data);
        return new Promise(function(resolve, reject) {
            try {
                store.putObjs(table, Object.values(data.data), (e) => {
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
            catch(e){
                logger.error("[updateStore.Promise] %o", e);
                reject(e);
            }
        });
        logger.debug("[updateStore|out]");
    }

    const resetStore = (table, data) => {
        logger.debug("[resetStore|in] (%s, %o)", table, data);
        return new Promise(function(resolve, reject) {
            try {
                store.findObjIds(table, (e,r) => {
                    if(e){
                        logger.error("[resetStore.store.findObjIds] trouble finding ids : %o", e);
                        reject(e);
                    }
                    else {
                        if( 0 < r.length ){
                            store.delObjs(table, r, (e) => {
                                if(e){
                                    logger.error("[resetStore.store.delObjs] trouble deleting entities : %o", e);
                                    reject(e);
                                }
                                else
                                    resolve(data);
                            });
                        }
                        else
                            resolve(data);
                    }
                });
            }
            catch(e){
                logger.error("[resetStore.Promise] %o", e);
                reject(e);
            }
        });
        logger.debug("[resetStore|out]");
    }


    const load = (environment, bucket, callback) => {
        logger.info("[load|in] (%s,%s)", environment, bucket);

        try{
            let folder = environment;
            let table = commons.getTableNameV1(
                configuration.STORELOADERSERVICE_TENANT
                , configuration.STORELOADERSERVICE_ENTITY
                , environment
                , configuration.STORELOADERSERVICE_ENTITIES
                , configuration.STORELOADERSERVICE_ENVIRONMENTS
            );

            handleDataDescriptorFile(bucket, folder)
                .then( d => listImages(bucket, folder, d) )
                .then( d => retrieveImages(bucket, d) )
                .then( d => resetStore(table, d) )
                .then( d => updateStore(table, d))
                .then(() => callback(null))
                .catch(e => callback(e));
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
