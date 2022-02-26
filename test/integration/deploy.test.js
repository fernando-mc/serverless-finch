'use strict';

const chai = require('chai');
const log = require('log').get('serverless-finch:test');

const { deleteBucketIfExists, getAccountId } = require('../utils/aws');
const { fetch } = require('../utils/fetch');
const runServerless = require('../run-serverless');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const { expect } = require('chai');

describe('client deploy integration test', () => {
  let clientConfigs;

  before(async () => {
    const accountId = await getAccountId();

    clientConfigs = [
      { bucketName: `serverless-finch-test-1-${accountId}`, region: 'us-east-1' },
      { bucketName: `serverless-finch-test-2-${accountId}`, region: 'us-west-2' }
    ];

    await cleanup(clientConfigs);
  });

  after(async () => {
    await cleanup(clientConfigs);
  });

  it('should deploy site sucessfully to region 1', async () => {
    const { bucketName, region } = clientConfigs[0];
    await deploy('basic', { bucketName, region });

    const response = await fetch(`http://${bucketName}.s3-website-${region}.amazonaws.com/`);
    expect(await response.text()).to.contain('Go Serverless!');
  });

  it('should deploy site sucessfully to region 2', async () => {
    const { bucketName, region } = clientConfigs[1];
    await deploy('basic', { bucketName, region });

    const response = await fetch(`http://${bucketName}.s3-website-${region}.amazonaws.com/`);
    expect(await response.text()).to.contain('Go Serverless!');
  });

  describe('custom headers', () => {
    it('should be applied', async () => {
      const { bucketName, region } = clientConfigs[0];
      await deploy('custom-headers', { bucketName, region });

      const response = await fetch(`http://${bucketName}.s3-website-${region}.amazonaws.com/`);
      expect(response.headers.get('cache-control')).to.equal('max-age=5');
    });
  });

  describe('routing rules redirect', () => {
    it('should cause a 404 request to be redirected to the index', async () => {
      const { bucketName, region } = clientConfigs[0];
      await deploy('routing-rules-redirect', { bucketName, region });

      const response = await fetch(
        `http://${bucketName}.s3-website-${region}.amazonaws.com/bad-request`
      );
      expect(response.redirected).to.be.true;
      expect(await response.text()).to.contain('Go Serverless!');
    });
  });
});

function deploy(fixture, { bucketName, region }) {
  return runServerless({
    envWhitelist: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'],
    fixture,
    configExt: {
      custom: {
        client: { bucketName }
      }
    },
    command: 'client deploy',
    options: { confirm: false, region }
  });
}

async function cleanup(clientConfigs) {
  log.notice('Cleaning up...');
  await Promise.all(clientConfigs.map(({ bucketName }) => deleteBucketIfExists(bucketName)));
}
