const awsRequest = require('@serverless/test/aws-request');
const { STS, S3 } = require('aws-sdk');

async function getAccountId() {
  // NOTE: don't use `awsRequest` here because it hangs if no credentials are provided
  const { Account } = await new STS().getCallerIdentity().promise();
  return Account;
}

async function deleteBucketIfExists(Bucket) {
  try {
    await emptyBucket(Bucket);
    await deleteBucket(Bucket);
  } catch (error) {
    if (error.code !== 'NoSuchBucket') {
      throw error;
    }
  }
}

async function deleteBucket(Bucket) {
  await awsRequest(S3, 'deleteBucket', { Bucket });
}

async function emptyBucket(Bucket) {
  const { Contents } = await awsRequest(S3, 'listObjects', { Bucket });

  if (Contents.length) {
    await awsRequest(S3, 'deleteObjects', {
      Bucket,
      Delete: { Objects: Contents.map(({ Key }) => ({ Key })) }
    });
  }
}

module.exports = {
  getAccountId,
  deleteBucketIfExists
};
