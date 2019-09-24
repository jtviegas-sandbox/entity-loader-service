#!/bin/sh

__r=0

this_folder="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
if [ -z "$this_folder" ]; then
    this_folder=$(dirname $(readlink -f $0))
fi
echo "this_folder: $this_folder"
parent_folder=$(dirname $this_folder)

AWS_REGION=eu-west-1
AWS_CLI_OUTPUT_FORMAT=text
CONTAINER=localaws
BUCKET="test"
FOLDER="$this_folder/test/resources"
FILE_EXCLUDE="**/trigger"
AWS_S3_URL="http://localhost:5000"
AWS_DB_URL="http://localhost:8000"
ENTITY="item"
ENVIRONMENT="development"
APP="test"
TABLE="${APP}_${ENTITY}_${ENVIRONMENT}"

echo "starting store loader service tests..."

_pwd=`pwd`
cd $this_folder

curl -XGET https://raw.githubusercontent.com/jtviegas/script-utils/master/bash/aws.sh -o "${this_folder}"/aws.sh
. "${this_folder}"/aws.sh

aws_init $AWS_REGION $AWS_CLI_OUTPUT_FORMAT

echo "...starting aws mock container..."
docker run --name $CONTAINER -d -e SERVICES="s3:5000,dynamodb:8000" -e DEFAULT_REGION=$AWS_REGION -p 5000:5000 -p 8000:8000 localstack/localstack

echo "...creating testing buckets..."
createBucket ${BUCKET} ${AWS_S3_URL}
__r=$?

if [ "$__r" -eq "0" ] ; then
  debug "...synch folder $FOLDER with bucket ${BUCKET} ..."
  copyLocalFolderContentsToBucket "${FOLDER}" ${BUCKET} "${FILE_EXCLUDE}" ${AWS_S3_URL}
  __r=$?
fi

if [ "$__r" -eq "0" ] ; then
  echo "...creating store table $TABLE..."
  createTable ${TABLE} ${AWS_DB_URL}
  __r=$?
fi

if [ "$__r" -eq "0" ] ; then
  node_modules/istanbul/lib/cli.js cover node_modules/mocha/bin/_mocha -- -R spec test/test.js
  __r=$?
fi

cd $_pwd

echo "...stopping aws mock container..."
docker stop $CONTAINER && docker rm $CONTAINER
rm "${this_folder}"/aws.sh

echo "...store loader service test done. [$__r]"
exit $__r