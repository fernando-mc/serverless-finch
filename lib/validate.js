'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Validates the configuration parameters that will be used for deployment
 * @param {Object} serverless - Instance of the Serverless class
 * @param {Object} options - Command line options passed to serverless client
 */
function validateClient(serverless, options) {
  const validationErrors = [];

  if (!isObject(options)) {
    validationErrors.push('Options must be an object defined under `custom.client`');
    throw validationErrors;
  }

  // path to website files must exist
  const distributionFolder = options.distributionFolder || path.join('client/dist');
  const clientPath = path.join(serverless.config.servicePath, distributionFolder);
  if (!serverless.utils.dirExistsSync(clientPath)) {
    validationErrors.push(`Could not find '${clientPath}' folder in your project root`);
  }

  // bucketName must be a string
  if (typeof options.bucketName !== 'string') {
    validationErrors.push('Please specify a bucket name for the client in serverless.yml');
  }

  // check header options
  if (options.objectHeaders) {
    if (!isObject(options.objectHeaders)) {
      validationErrors.push('objectHeaders must be an object');
    }

    Object.keys(options.objectHeaders).forEach(p => {
      if (!Array.isArray(options.objectHeaders[p])) {
        validationErrors.push('Each member of objectHeaders must be an array');
      }

      options.objectHeaders[p].forEach(h => {
        if (typeof h.name !== 'string') {
          validationErrors.push(`Each object header must have a (string) 'name' attribute`);
        }

        if (typeof h.value !== 'string') {
          validationErrors.push(`Each object header must have a (string) 'value' attribute`);
        }
      });
    });
  }

  // check that custom bucket policy is valid json
  if (options.bucketPolicyFile) {
    try {
      JSON.parse(fs.readFileSync(options.bucketPolicyFile));
    } catch (e) {
      validationErrors.push(
        `Failed to read and/or parse specified policy. Make sure it is valid JSON.`
      );
    }
  }

  // check that custom CORS is valid json
  if (options.corsFile) {
    try {
      JSON.parse(fs.readFileSync(options.corsFile));
    } catch (e) {
      validationErrors.push(
        `Failed to read and/or parse specified CORS configuration. Make sure it is valid JSON.`
      );
    }
  }

  // check website configuration options

  // if redirectAllRequestsTo specified, no other website options can be specified
  // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-s3-websiteconfiguration.html
  if (options.redirectAllRequestsTo) {
    const clientConfigOptions = Object.keys(options);
    if (clientConfigOptions.includes('indexDocument')) {
      validationErrors.push('indexDocument cannot be specified with redirectAllRequestsTo');
    }

    if (clientConfigOptions.includes('errorDocument')) {
      validationErrors.push('errorDocument cannot be specified with redirectAllRequestsTo');
    }

    if (clientConfigOptions.includes('routingRules')) {
      validationErrors.push('routingRules cannot be specified with redirectAllRequestsTo');
    }

    if (!options.redirectAllRequestsTo.hostName) {
      validationErrors.push(
        'redirectAllRequestsTo.hostName is required if redirectAllRequestsTo is specified'
      );
    }
    if (typeof options.redirectAllRequestsTo.hostName !== 'string') {
      validationErrors.push('redirectAllRequestsTo.hostName must be a string');
    }

    if (options.redirectAllRequestsTo.protocol) {
      if (typeof options.redirectAllRequestsTo.protocol !== 'string') {
        validationErrors.push('redirectAllRequestsTo.protocol must be a string');
      }
      if (!['http', 'https'].includes(options.redirectAllRequestsTo.protocol.toLowerCase())) {
        validationErrors.push('redirectAllRequestsTo.protocol must be either http or https');
      }
    }
  }

  if (options.routingRules) {
    if (!Array.isArray(options.routingRules)) {
      validationErrors.push('routingRules must be a list');
    }

    options.routingRules.forEach(r => {
      if (!r.redirect) {
        validationErrors.push('redirect must be specified for each member of routingRules');
      }

      if (r.redirect.replaceKeyPrefixWith && r.redirect.replaceKeyWith) {
        validationErrors.push(
          'replaceKeyPrefixWith and replaceKeyWith cannot both be specified for a member of member of routingRules'
        );
      }

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
            if (!Number.isInteger(r.redirect[p])) {
              validationErrors.push(
                'redirect.httpRedirectCode must be an integer for each member of routingRules'
              );
            }
          } else {
            if (typeof r.redirect[p] !== 'string') {
              validationErrors.push(
                `redirect.${p} must be a string for each member of routingRules`
              );
            }
          }
        }
      });

      if (r.condition) {
        if (!r.condition.httpErrorCodeReturnedEquals && !r.condition.keyPrefixEquals) {
          validationErrors.push(
            'condition.httpErrorCodeReturnedEquals or condition.keyPrefixEquals must be defined for each member of routingRules'
          );
        }

        const conditionProps = ['httpErrorCodeReturnedEquals', 'keyPrefixEquals'];
        conditionProps.forEach(p => {
          if (r.condition[p]) {
            if (p === 'httpErrorCodeReturnedEquals') {
              if (!Number.isInteger(r.condition[p])) {
                validationErrors.push('httpErrorCodeReturnedEquals must be an integer');
              }
            } else {
              if (typeof r.condition[p] !== 'string') {
                validationErrors.push(`${p} must be a string`);
              }
            }
          }
        });
      }
    });
  }

  if (validationErrors.length > 0) {
    throw validationErrors;
  }
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

module.exports = validateClient;
