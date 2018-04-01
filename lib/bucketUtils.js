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

/**
 * Sets website configuration parameters for given bucket
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to be configured
 * @param {string} indexDocument - Path to index document
 * @param {string} errorDocument - Path to error document
 */
function configureBucket(aws, bucketName, indexDocument, errorDocument) {
  const params = {
    Bucket: bucketName,
    WebsiteConfiguration: {
      IndexDocument: { Suffix: indexDocument },
      ErrorDocument: { Key: errorDocument }
    }
  };

  return aws.request('S3', 'putBucketWebsite', params);
}

/**
 * Configures policy for given bucket
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to be configured
 */
function configurePolicyForBucket(aws, bucketName) {
  const policy = {
    Version: '2008-10-17',
    Id: 'Policy1392681112290',
    Statement: [
      {
        Sid: 'Stmt1392681101677',
        Effect: 'Allow',
        Principal: {
          AWS: '*'
        },
        Action: 's3:GetObject',
        Resource: `arn:aws:s3:::${bucketName}/*`
      }
    ]
  };

  const params = {
    Bucket: bucketName,
    Policy: JSON.stringify(policy)
  };

  return aws.request('S3', 'putBucketPolicy', params);
}

/**
 * Configures CORS policy for given bucket
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to be configured
 */
function configureCorsForBucket(aws, bucketName) {
  const params = {
    Bucket: bucketName,
    CORSConfiguration: require('./resources/CORSPolicy')
  };

  return aws.request('S3', 'putBucketCors', params);
}

module.exports = {
  bucketExists,
  createBucket,
  configureBucket,
  configureCorsForBucket,
  configurePolicyForBucket,
  deleteBucket,
  emptyBucket,
  listObjectsInBucket
};
