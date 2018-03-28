function createBucket(client) {
  if (client.bucketExists) return BbPromise.resolve();
  client.serverless.cli.log(`Creating bucket ${client.bucketName}...`);

  let params = {
    Bucket: client.bucketName
  };

  return client.aws.request('S3', 'createBucket', params);
}

function configureBucket(client) {
  client.serverless.cli.log(`Configuring website bucket ${client.bucketName}...`);

  const indexDoc = client.serverless.service.custom.client.indexDocument || 'index.html';
  const errorDoc = client.serverless.service.custom.client.errorDocument || 'error.html';

  let params = {
    Bucket: client.bucketName,
    WebsiteConfiguration: {
      IndexDocument: { Suffix: indexDoc },
      ErrorDocument: { Key: errorDoc }
    }
  };

  return client.aws.request('S3', 'putBucketWebsite', params);
}

function configurePolicyForBucket(client) {
  client.serverless.cli.log(`Configuring policy for bucket ${client.bucketName}...`);

  let policy = {
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
        Resource: 'arn:aws:s3:::' + client.bucketName + '/*'
      }
    ]
  };

  let params = {
    Bucket: client.bucketName,
    Policy: JSON.stringify(policy)
  };

  return client.aws.request('S3', 'putBucketPolicy', params);
}

function configureCorsForBucket(client) {
  client.serverless.cli.log(`Configuring CORS policy for bucket ${client.bucketName}...`);

  let putPostDeleteRule = {
    AllowedMethods: ['PUT', 'POST', 'DELETE'],
    AllowedOrigins: ['https://*.amazonaws.com'],
    AllowedHeaders: ['*'],
    MaxAgeSeconds: 0
  };

  let getRule = {
    AllowedMethods: ['GET'],
    AllowedOrigins: ['*'],
    AllowedHeaders: ['*'],
    MaxAgeSeconds: 0
  };

  let params = {
    Bucket: client.bucketName,
    CORSConfiguration: {
      CORSRules: [putPostDeleteRule, getRule]
    }
  };

  return client.aws.request('S3', 'putBucketCors', params);
}

module.exports = {
  createBucket,
  configureBucket,
  configureCorsForBucket,
  configurePolicyForBucket
};
