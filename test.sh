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
CONTAINER=dynamodb4test
BUCKET="test-bucket"
BUCKET_FOLDER="development"
AWS_CONTAINER="http://localhost:5000"
CONTAINER2=s3

echo "starting store loader tests..."

_pwd=`pwd`
cd $this_folder

curl -XGET https://raw.githubusercontent.com/jtviegas/script-utils/master/bash/aws.sh -o "${this_folder}"/aws.sh
. "${this_folder}"/aws.sh

aws_init $AWS_REGION $AWS_CLI_OUTPUT_FORMAT

echo "...starting aws mock container..."
docker run --name $CONTAINER2 -d -e SERVICES=s3:5000 -e DEFAULT_REGION=$AWS_REGION -p 5000:5000 localstack/localstack

echo "...creating testing buckets..."
createBucket ${BUCKET} ${AWS_CONTAINER}
__r=$?
# shellcheck disable=SC2154
if [ ! "$__r" -eq "0" ] ; then cd "${_pwd}" && exit 1; fi

debug "...adding folder $BUCKET_FOLDER to bucket ${BUCKET} ..."
createFolderInBucket ${BUCKET} ${BUCKET_FOLDER} ${AWS_CONTAINER}
__r=$?
if [ ! "$__r" -eq "0" ] ; then cd "${_pwd}" && exit 1; fi
info "...added folder $BUCKET_FOLDER to bucket $BUCKET..."

echo "...starting db container..."
docker run -d -p 8000:8000 --name $CONTAINER amazon/dynamodb-local

node_modules/istanbul/lib/cli.js cover node_modules/mocha/bin/_mocha -- -R spec test/test.js
__r=$?

cd $_pwd
echo "...stopping db container..."
docker stop $CONTAINER && docker rm $CONTAINER

echo "...stopping aws mock container..."
docker stop $CONTAINER2 && docker rm $CONTAINER2
rm "${this_folder}"/aws.sh

echo "...api test done. [$__r]"
exit $__r
