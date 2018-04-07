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
  configureBucket,
  configureCorsForBucket,
  configurePolicyForBucket
};
