const Serverless = require('serverless');
var FinchClient = require('../index');
var assert = require('assert');
var request = require('request');

describe('Client', () => {
  let serverless;
  let serverlessFinch;

  beforeEach(() => {
    serverless = new Serverless();
    pluginInstance = new FinchClient(serverless);
    pluginInstance.serverless.service.service = 'new-service';
    pluginInstance.serverless.provider = 'aws';
  });

  describe('#constructor()', () => {
    it('should set the provider variable to "aws"', () =>
        assert.deepEqual(pluginInstance.provider, 'aws')
    );
  });
})
