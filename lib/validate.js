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
    throw `Could not find '${clientPath}' folder in your project root`;
  }

  // bucketName must be a string
  if (!is.string(options.bucketName)) {
    throw 'Please specify a bucket name for the client in serverless.yml';
  }

  // check header options
  if (options.objectHeaders) {
    if (!is.object(options.objectHeaders)) {
      throw 'objectHeaders must be an object';
    }

    Object.keys(options.objectHeaders).forEach(p => {
      if (!is.array(options.objectHeaders[p])) {
        throw 'Each member of objectHeaders must be an array';
      }

      options.objectHeaders[p].forEach(h => {
        if (!(is.existy(h.name) && is.string(h.name))) {
          throw `Each object header must have a (string) 'name' attribute`;
        }

        if (!(is.existy(h.value) && is.string(h.value))) {
          throw `Each object header must have a (string) 'value' attribute`;
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
      throw 'indexDocument cannot be specified with redirectAllRequestsTo';
    }

    if (is.inArray('errorDocument', clientConfigOptions)) {
      throw 'errorDocument cannot be specified with redirectAllRequestsTo';
    }

    if (is.inArray('routingRules', clientConfigOptions)) {
      throw 'routingRules cannot be specified with redirectAllRequestsTo';
    }

    if (!is.existy(options.redirectAllRequestsTo.hostName)) {
      throw 'redirectAllRequestsTo.hostName is required if redirectAllRequestsTo is specified';
    }
    if (!is.string(options.redirectAllRequestsTo.hostName)) {
      throw 'redirectAllRequestsTo.hostName must be a string';
    }

    if (options.redirectAllRequestsTo.protocol) {
      if (!is.string(options.redirectAllRequestsTo.protocol)) {
        throw 'redirectAllRequestsTo.protocol must be a string';
      }
      if (!is.inArray(options.redirectAllRequestsTo.protocol.toLowerCase(), ['http', 'https'])) {
        throw 'redirectAllRequestsTo.protocol must be either http or https';
      }
    }
  }

  if (options.routingRules) {
    if (!is.array(options.routingRules)) {
      throw 'routingRules must be a list';
    }

    options.routingRules.forEach(r => {
      if (!is.existy(r.redirect)) {
        throw 'redirect must be specified for each member of routingRules';
      }

      if (is.existy(r.redirect.replaceKeyPrefixWith) && is.existy(r.redirect.replaceKeyWith)) {
        throw 'replaceKeyPrefixWith and replaceKeyWith cannot both be specified for a member of member of routingRules';
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
              throw 'redirect.httpRedirectCode must be an integer for each member of routingRules';
            }
          } else {
            if (!is.string(r.redirect[p])) {
              throw `redirect.${p} must be a string for each member of routingRules`;
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
          throw 'condition.httpErrorCodeReturnedEquals or condition.keyPrefixEquals must be defined for each member of routingRules';
        }

        const conditionProps = ['httpErrorCodeReturnedEquals', 'keyPrefixEquals'];
        conditionProps.forEach(p => {
          if (r.condition[p]) {
            if (p === 'httpErrorCodeReturnedEquals') {
              if (!is.integer(r.condition[p])) {
                throw 'httpErrorCodeReturnedEquals must be an integer';
              }
            } else {
              if (!is.string(r.condition[p])) {
                throw `${p} must be a string`;
              }
            }
          }
        });
      }
    });
  }
}

module.exports = validateClient;
