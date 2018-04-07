/**
 * Sets website configuration parameters for given bucket
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to be configured
 * @param {string} indexDocument - Path to index document
 * @param {string} errorDocument - Path to error document
 * @param {Object} redirectAllRequestsTo - Configuration information for redirecting all requests
 * @param {Object[]} routingRules - Rules for routing site traffic
 */
function configureBucket(
  aws,
  bucketName,
  indexDocument,
  errorDocument,
  redirectAllRequestsTo,
  routingRules
) {
  let params = {
    Bucket: bucketName,
    WebsiteConfiguration: {}
  };

  if (redirectAllRequestsTo) {
    params.WebsiteConfiguration.RedirectAllRequestsTo = {};

    let hostName = redirectAllRequestsTo.hostName;

    params.WebsiteConfiguration.RedirectAllRequestsTo.HostName = redirectAllRequestsTo.hostName;

    if (redirectAllRequestsTo.protocol) {
      params.WebsiteConfiguration.RedirectAllRequestsTo.Protocol = redirectAllRequestsTo.protocol;
    }
  } else {
    params.WebsiteConfiguration.IndexDocument = { Suffix: indexDocument };
    params.WebsiteConfiguration.ErrorDocument = { Key: errorDocument };
  }

  if (routingRules) {
    params.WebsiteConfiguration.RoutingRules = [];

    routingRules.forEach(r => {
      const routingRule = {
        Redirect: {}
      };
      const redirectProps = [
        'hostName',
        'httpRedirectCode',
        'protocol',
        'replaceKeyPrefixWith',
        'replaceKeyWith'
      ];
      redirectProps.forEach(p => {
        if (r.redirect[p]) {
          if (p === 'httpRedirectCode') {
            r.redirect[p] = r.redirect[p].toString();
          }
          routingRule.Redirect[p.charAt(0).toUpperCase() + p.slice(1)] = r.redirect[p];
        }
      });

      if (r.condition) {
        routingRule.Condition = {};

        const conditionProps = ['httpErrorCodeReturnedEquals', 'keyPrefixEquals'];
        conditionProps.forEach(p => {
          if (r.condition[p]) {
            if (p === 'httpErrorCodeReturnedEquals') {
              r.condition[p] = r.condition[p].toString();
            }
            routingRule.Condition[p.charAt(0).toUpperCase() + p.slice(1)] = r.condition[p];
          }
        });
      }

      params.WebsiteConfiguration.RoutingRules.push(routingRule);
    });
  }

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
