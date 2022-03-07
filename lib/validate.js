'use strict';

const fs = require('fs');
const is = require('is_js');
const path = require('path');

/**
 * Validates the configuration parameters that will be used for deployment
 * @param {Object} serverless - Instance of the Serverless class
 * @param {Object} options - Command line options passed to serverless client
 */
function validateClient(serverless, options) {
  const validationErrors = [];

  // path to website files must exist
  const distributionFolder = options.distributionFolder || path.join('client/dist');
  const clientPath = path.join(serverless.config.servicePath, distributionFolder);
  if (!serverless.utils.dirExistsSync(clientPath)) {
    validationErrors.push(`Could not find '${clientPath}' folder in your project root`);
  }

  // bucketName must be a string
  if (!is.string(options.bucketName)) {
    validationErrors.push('Please specify a bucket name for the client in serverless.yml');
  }

  // check header options
  if (options.objectHeaders) {
    if (!is.object(options.objectHeaders)) {
      validationErrors.push('objectHeaders must be an object');
    }

    Object.keys(options.objectHeaders).forEach(p => {
      if (!is.array(options.objectHeaders[p])) {
        validationErrors.push('Each member of objectHeaders must be an array');
      }

      options.objectHeaders[p].forEach(h => {
        if (!(is.existy(h.name) && is.string(h.name))) {
          validationErrors.push(`Each object header must have a (string) 'name' attribute`);
        }

        if (!(is.existy(h.value) && is.string(h.value))) {
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
    if (is.inArray('indexDocument', clientConfigOptions)) {
      validationErrors.push('indexDocument cannot be specified with redirectAllRequestsTo');
    }

    if (is.inArray('errorDocument', clientConfigOptions)) {
      validationErrors.push('errorDocument cannot be specified with redirectAllRequestsTo');
    }

    if (is.inArray('routingRules', clientConfigOptions)) {
      validationErrors.push('routingRules cannot be specified with redirectAllRequestsTo');
    }

    if (!is.existy(options.redirectAllRequestsTo.hostName)) {
      validationErrors.push(
        'redirectAllRequestsTo.hostName is required if redirectAllRequestsTo is specified'
      );
    }
    if (!is.string(options.redirectAllRequestsTo.hostName)) {
      validationErrors.push('redirectAllRequestsTo.hostName must be a string');
    }

    if (options.redirectAllRequestsTo.protocol) {
      if (!is.string(options.redirectAllRequestsTo.protocol)) {
        validationErrors.push('redirectAllRequestsTo.protocol must be a string');
      }
      if (!is.inArray(options.redirectAllRequestsTo.protocol.toLowerCase(), ['http', 'https'])) {
        validationErrors.push('redirectAllRequestsTo.protocol must be either http or https');
      }
    }
  }

  if (options.routingRules) {
    if (!is.array(options.routingRules)) {
      validationErrors.push('routingRules must be a list');
    }

    options.routingRules.forEach(r => {
      if (!is.existy(r.redirect)) {
        validationErrors.push('redirect must be specified for each member of routingRules');
      }

      if (is.existy(r.redirect.replaceKeyPrefixWith) && is.existy(r.redirect.replaceKeyWith)) {
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
            if (!is.integer(r.redirect[p])) {
              validationErrors.push(
                'redirect.httpRedirectCode must be an integer for each member of routingRules'
              );
            }
          } else {
            if (!is.string(r.redirect[p])) {
              validationErrors.push(
                `redirect.${p} must be a string for each member of routingRules`
              );
            }
          }
        }
      });

      if (r.condition) {
        if (
          !(
            is.existy(r.condition.httpErrorCodeReturnedEquals) ||
            is.existy(r.condition.keyPrefixEquals)
          )
        ) {
          validationErrors.push(
            'condition.httpErrorCodeReturnedEquals or condition.keyPrefixEquals must be defined for each member of routingRules'
          );
        }

        const conditionProps = ['httpErrorCodeReturnedEquals', 'keyPrefixEquals'];
        conditionProps.forEach(p => {
          if (r.condition[p]) {
            if (p === 'httpErrorCodeReturnedEquals') {
              if (!is.integer(r.condition[p])) {
                validationErrors.push('httpErrorCodeReturnedEquals must be an integer');
              }
            } else {
              if (!is.string(r.condition[p])) {
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

module.exports = validateClient;
