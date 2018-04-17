const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const is = require('is_js');

/**
 * Validates the configuration parameters that will be used for deployment
 * @param {Object} serverless - Instance of the Serverless class
 * @param {Object} options - Command line options passed to serverless client
 *
 * @returns {string} Validation error message (undefined if valid)
 */
function validateClient(serverless, options) {
  // path to website files must exist
  const distributionFolder = options.distributionFolder || path.join('client/dist');
  const clientPath = path.join(serverless.config.servicePath, distributionFolder);
  if (!serverless.utils.dirExistsSync(clientPath)) {
    return `Could not find '${clientPath}' folder in your project root`;
  }

  // bucketName must be a string
  if (!is.string(options.bucketName)) {
    return 'Please specify a bucket name for the client in serverless.yml';
  }

  // check header options
  if (options.objectHeaders) {
    if (!is.object(options.objectHeaders)) {
      return 'objectHeaders must be an object';
    }

    Object.keys(options.objectHeaders).forEach(p => {
      if (!is.array(options.objectHeaders[p])) {
        return 'Each member of objectHeaders must be an array';
      }

      Object.keys(options.objectHeaders[p]).forEach(h => {
        if (
          !is.existy(options.objectHeaders[p][h].name) ||
          !is.string(options.objectHeaders[p][h].name)
        ) {
          return `Each object header must have a (string) 'name' attribute`;
        }

        if (
          !is.existy(options.objectHeaders[p][h].value) ||
          !is.string(options.objectHeaders[p][h].value)
        ) {
          return `Each object header must have a (string) 'value' attribute`;
        }
      });
    });
  }

  // check website configuration options

  // if redirectAllRequestsTo specified, no other website options can be specified
  // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-s3-websiteconfiguration.html
  if (options.redirectAllRequestsTo) {
    const clientConfigOptions = Object.keys(options);
    if (is.inArray('indexDocument', clientConfigOptions)) {
      return 'indexDocument cannot be specified with redirectAllRequestsTo';
    }

    if (is.inArray('errorDocument', clientConfigOptions)) {
      return 'errorDocument cannot be specified with redirectAllRequestsTo';
    }

    if (is.inArray('routingRules', clientConfigOptions)) {
      return 'routingRules cannot be specified with redirectAllRequestsTo';
    }

    if (!is.existy(options.redirectAllRequestsTo.hostName)) {
      return 'redirectAllRequestsTo.hostName is required if redirectAllRequestsTo is specified';
    }
    if (!is.string(options.redirectAllRequestsTo.hostName)) {
      return 'redirectAllRequestsTo.hostName must be a string';
    }

    if (options.redirectAllRequestsTo.protocol) {
      if (!is.string(options.redirectAllRequestsTo.protocol)) {
        return 'redirectAllRequestsTo.protocol must be a string';
      }
      if (!is.inArray(options.redirectAllRequestsTo.protocol.toLowerCase(), ['http', 'https'])) {
        return 'redirectAllRequestsTo.protocol must be either http or https';
      }
    }
  }

  if (options.routingRules) {
    if (!is.array(options.routingRules)) {
      return 'routingRules must be a list';
    }

    options.routingRules.forEach(r => {
      if (!is.existy(r.redirect)) {
        return 'redirect must be specified for each member of routingRules';
      }

      if (is.existy(r.redirect.replaceKeyPrefixWith) && is.existy(r.redirect.replaceKeyWith)) {
        return 'replaceKeyPrefixWith and replaceKeyWith cannot both be specified for a member of member of routingRules';
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
              return 'redirect.httpRedirectCode must be an integer for each member of routingRules';
            }
          } else {
            if (!is.string(r.redirect[p])) {
              return `redirect.${p} must be a string for each member of routingRules`;
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
          return 'condition.httpErrorCodeReturnedEquals or condition.keyPrefixEquals must be defined for each member of routingRules';
        }

        const conditionProps = ['httpErrorCodeReturnedEquals', 'keyPrefixEquals'];
        conditionProps.forEach(p => {
          if (r.condition[p]) {
            if (p === 'httpErrorCodeReturnedEquals') {
              if (!is.integer(r.condition[p])) {
                return 'httpErrorCodeReturnedEquals must be an integer';
              }
            } else {
              if (!is.string(r.condition[p])) {
                return `${p} must be a string`;
              }
            }
          }
        });
      }
    });
  }
}

module.exports = validateClient;
