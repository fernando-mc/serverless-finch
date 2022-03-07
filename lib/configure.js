'use strict';

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
  const params = {
    Bucket: bucketName,
    WebsiteConfiguration: {}
  };

  if (redirectAllRequestsTo) {
    params.WebsiteConfiguration.RedirectAllRequestsTo = {};
    params.WebsiteConfiguration.RedirectAllRequestsTo.HostName = redirectAllRequestsTo.hostName;

    if (redirectAllRequestsTo.protocol) {
      params.WebsiteConfiguration.RedirectAllRequestsTo.Protocol = redirectAllRequestsTo.protocol;
    }
  } else {
    // AWS's terminology (Suffix/Key) here is weird. The following is how you specify
    // index and error documents for the bucket. See docs:
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putBucketWebsite-property
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
        // Properties can also be an empty string which means "go to the Index document"
        if (r.redirect[p] || r.redirect[p] === '') {
          if (p === 'httpRedirectCode') {
            r.redirect[p] = r.redirect[p].toString();
          }
          // AWS expects the redirect properties to be PascalCase, while our API
          // uses camelCase. Converting here.
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
            // AWS expects the redirect conditions to be PascalCase, while our API
            // uses camelCase. Converting here.
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
function configurePolicyForBucket(aws, bucketName, customPolicy) {
  const policy = customPolicy || {
    Version: '2012-10-17',
    Statement: [
      {
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
 * @param {string[]} [customRules] - Custom rules
 */
function configureCorsForBucket(aws, bucketName, customRules) {
  const params = {
    Bucket: bucketName,
    CORSConfiguration: {
      CORSRules: customRules || require('./resources/cors-rules.json')
    }
  };

  return aws.request('S3', 'putBucketCors', params);
}

/**
 * Configures Tags for given bucket
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to be configured
 */
function configureTagsForBucket(aws, bucketName, tags) {
  const tagData = Object.keys(tags).map(key => {
    return { Key: key, Value: tags[key] };
  });
  const tagSet = { TagSet: tagData };

  const params = {
    Bucket: bucketName,
    Tagging: tagSet
  };

  return aws.request('S3', 'putBucketTagging', params);
}

module.exports = {
  configureBucket,
  configureCorsForBucket,
  configurePolicyForBucket,
  configureTagsForBucket
};
