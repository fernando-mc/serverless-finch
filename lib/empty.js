const _ = require('lodash');
const BbPromise = require('bluebird');

const utils = require('./bucketUtils');

/**
 * Deletes all objects in an S3 bucket
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to be deleted
 */
function emptyBucket(aws, bucketName) {
  return utils.listObjectsInBucket(aws, bucketName).then(resp => {
    const contents = resp.Contents;

    if (!contents[0]) {
      return BbPromise.resolve();
    } else {
      const objects = _.map(contents, function(content) {
        return _.pick(content, 'Key');
      });

      const params = {
        Bucket: bucketName,
        Delete: { Objects: objects }
      };

      return aws.request('S3', 'deleteObjects', params);
    }
  });
}

module.exports = emptyBucket;
