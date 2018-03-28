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

module.exports = deleteBucket;
