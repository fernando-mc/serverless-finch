const _ = require('lodash');
const BbPromise = require('bluebird');

/**
 * Checks if an S3 bucket exists
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to look for
 *
 * @returns {Promise<boolean>}
 */
function bucketExists(aws, bucketName) {
  return aws.request('S3', 'listBuckets', {}).then(resp => {
    let exists = false;
    resp.Buckets.forEach(bucket => {
      if (bucket.Name === bucketName) {
        exists = true;
      }
    });
    return exists;
  });
}

/**
 * Get a list of all objects in an S3 bucket
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to scan
 */
function listObjectsInBucket(aws, bucketName) {
  let params = {
    Bucket: bucketName
  };
  return aws.request('S3', 'listObjectsV2', params);
}

/**
 * Deletes an S3 bucket
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to be deleted
 */
function deleteBucket(aws, bucketName) {
  const params = {
    Bucket: bucketName
  };
  return aws.request('S3', 'deleteBucket', params);
}

/**
 * Deletes all objects in an S3 bucket
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to be deleted
 */
function emptyBucket(aws, bucketName) {
  return listObjectsInBucket(aws, bucketName).then(resp => {
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

/**
 * Creates S3 bucket with the given name
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to be created
 */
function createBucket(aws, bucketName) {
  const params = {
    Bucket: bucketName
  };

  return aws.request('S3', 'createBucket', params);
}

module.exports = {
  bucketExists,
  createBucket,
  deleteBucket,
  emptyBucket,
  listObjectsInBucket
};
