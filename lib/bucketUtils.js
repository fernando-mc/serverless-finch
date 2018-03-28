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

module.exports = { bucketExists, listObjectsInBucket };
