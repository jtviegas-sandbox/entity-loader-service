'use strict';

const winston = require('winston');
const store = require('@jtviegas/dyndbstore');
const papa = require('papaparse');
const commons = require('@jtviegas/jscommons').commons;
const bucketWrapper = require('@jtviegas/bucket-wrapper');

const logger = winston.createLogger(commons.getDefaultWinstonConfig());

const imageListingRegex=/^.*\/\d+_\d+\.(png|jpg)/i;
const imageRegex=/^.*\/(\d+)_*/;

const entityLoaderService = function () {

    logger.info("[entityLoaderService]...initializing entityLoaderService module...");

    const CONSTANTS = {
        BUCKET_HOST_URL: 'https://s3.eu-west-1.amazonaws.com'
        , BUCKET_CONTENT_EXCEPTIONS: ["trigger"], region: 'eu-west-1'
        , DATA_DESCRIPTOR_FILE: 'data.spec'
    };
    const CONFIGURATION_SPEC = [ 'region', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'
        , 'DYNDBSTORE_TEST_ENDPOINT', 'BUCKETWRAPPER_TEST_ENDPOINT' ];
    let configuration = commons.mergeConfiguration(CONSTANTS, commons.getEnvironmentVarsSubset(CONFIGURATION_SPEC));

    logger.info("[entityLoaderService]...initialized the entityLoaderService module successfully !");

    const toItem = (index, obj, header) => {
        logger.debug("[entityLoaderService|toItem|in] (%d,%o,%o)", index, obj, header);
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
        logger.debug("[entityLoaderService|toItem|out] => %o", result);
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
        logger.debug("[entityLoaderService|getHeaderSpec|in] (%o)", arr);
        let result = [];
        for(let i = 0; i < arr.length; i++){
            let field = arr[i];
            let components = field.split("|");
            let name = components[0].trim();
            let type = components[1].trim();
            result.push( { name: name, transformer: transformer[type] } );
        }
        logger.debug("[entityLoaderService|getHeaderSpec|out] => %o", result);
        return result;
    }

    const handleDataDescriptorFile = (bucket, folder) => {
        logger.debug("[entityLoaderService|handleDataDescriptorFile|in] (%s,%o)", bucket, folder);

            return new Promise(function(resolve, reject) {
                try {
                    let objkey = folder + '/' + configuration.DATA_DESCRIPTOR_FILE;
                    logger.debug("[entityLoaderService|handleDataDescriptorFile] getting object: %s", objkey);
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
                    logger.error("[entityLoaderService|handleDataDescriptorFile.Promise] %o", e);
                    reject(e);
                }
            });

        logger.debug("[entityLoaderService|handleDataDescriptorFile|out]");
    }

    const listImages = (bucket, folder, data) => {
        logger.debug("[entityLoaderService|listImages|in] (%s, %s, %o)", bucket, folder, data);
        return new Promise(function(resolve, reject) {
            try {
                bucketWrapper.listObjects(bucket, folder , function(e, d) {
                    logger.debug("[entityLoaderService|listImages|bucketWrapper.listObjects|callback|in] (%o, %o)", e, d);
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
                            logger.debug("[entityLoaderService|listImages|bucketWrapper.listObjects|callback|out] => %o", data);
                            resolve(data);
                        }
                        catch(e){
                            logger.error("[entityLoaderService|listImages|bucketWrapper.listObjects|callback|catch] e => %o", e);
                            reject(e);
                        }
                    }
                });
            }
            catch(e){
                logger.error("[entityLoaderService|listImages.Promise] %o", e);
                reject(e);
            }
        });
        logger.debug("[entityLoaderService|listImages|out]");
    }

    const toImage = (bucket, name, v) => {
        let image = {};
        image['name'] = name.split("/")[2];
        image['type'] = v['ContentType'];
        image['href'] = configuration.BUCKET_HOST_URL + '/' + bucket + '/' + name;
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
                            let number = parseInt(match[1], 10);
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

    const loadFolderPromise = (app, environment, bucket, entity) => {
        logger.info("[entityLoaderService|loadFolderPromise|in] (%s,%s,%s,%s)", app, environment, bucket, entity);
        let result = null;

        let table = commons.getTableNameV4(app , entity , environment);
        let folder = entity;

        result = handleDataDescriptorFile(bucket, folder)
            .then( d => listImages(bucket, folder, d) )
            .then( d => retrieveImages(bucket, d) )
            .then( d => resetStore(table, d) )
            .then( d => updateStore(table, d));

        logger.info("[entityLoaderService|loadFolderPromise|out] => %o", result);
        return result;
    }


    const listEntities = (bucket, callback) => {
        logger.debug("[entityLoaderService|listEntities|in] (%s)", bucket);

        try {
            bucketWrapper.listObjects(bucket, "" , function(e, d) {
                logger.debug("[entityLoaderService|listEntities|bucketWrapper.listObjects|callback|in] (%o, %o)", e, d);
                if (e)
                    callback(e);
                else {
                    try {

                        let data = [];
                        for(let i=0; i < d.length; i++){
                            let key = d[i].Key;
                            let entity = key.split("/")[0];
                            if( -1 === data.indexOf(entity) && -1 === CONSTANTS.BUCKET_CONTENT_EXCEPTIONS.indexOf(entity) )
                                data.push(entity);
                        }

                        logger.debug("[entityLoaderService|listEntities|listObjects|callback|out] => %o", data);
                        callback(null,data);
                    }
                    catch(e){
                        logger.error("[entityLoaderService|listEntities|listObjects|callback|catch] e => %o", e);
                        callback(e);
                    }
                }
            });
        }
        catch(e){
            logger.error("[entityLoaderService|listEntities.Promise] %o", e);
            callback(e);
        }

        logger.debug("[entityLoaderService|listEntities|out]");
    }



    const load = (app, environment, bucket, callback) => {
        logger.info("[entityLoaderService|load|in] (%s,%s)", environment, bucket);
        try{
            // so for every first level folder/key in teh bucket we will interpret it as an entity
            // and inside it
            listEntities(bucket, (e,d) => {
                if(e)
                    callback(e);
                else {
                    try {
                        let promise = null;
                        for( let i=0; i < d.length; i++ ){
                            let entity = d[i];
                            let table = commons.getTableNameV4(app , entity , environment);
                            let folder = entity; // for the sake of readability
                            if( ! promise )
                                promise = loadFolderPromise (app, environment, bucket, folder);
                            else
                                promise = promise.then(loadFolderPromise (app, environment, bucket, folder));
                        }
                        promise.then(() => callback(null)).catch(e => callback(e));
                    }
                    catch(e){
                        logger.error("[entityLoaderService|load|listEntities|callback] %o", e);
                        callback(e);
                    }
                }
            });

        }
        catch(e){
            logger.error("[entityLoaderService|load] %o", e);
            callback(e);
        }
        logger.info("[entityLoaderService|load|out]");
    }

    return { load: load }
}();

module.exports = entityLoaderService;
