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
    return 'Could not find ' + clientPath + ' folder in your project root.';
  }

  // bucketName must be a string
  const bucketName = options.bucketName;
  if (!is.string(bucketName)) {
    return 'Please specify a bucket name for the client in serverless.yml.';
  }
}

module.exports = validateClient;
