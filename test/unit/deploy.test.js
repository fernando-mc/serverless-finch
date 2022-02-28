'use strict';

const configureInquirerStub = require('@serverless/test/configure-inquirer-stub');
const inquirer = require('@serverless/utils/inquirer');
const chai = require('chai');
const sinon = require('sinon');

const runServerless = require('../run-serverless');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const { expect } = require('chai');

describe('client deploy', () => {
  let createBucketStub;
  let putBucketCorsStub;
  let putBucketPolicyStub;
  let putBucketTaggingStub;
  let putBucketWebsiteStub;
  let putObjectStub;

  describe('basic config', () => {
    before(async () => {
      configureInquirerStub(inquirer, { confirm: { isConfirmed: true } });

      await deploy('basic');
    });

    it('should create the bucket', async () => {
      expect(createBucketStub).to.be.calledOnce;
      expect(createBucketStub).to.be.calledWithExactly({
        Bucket: 'my-website-bucket'
      });
    });

    it('should set bucket website configuration', async () => {
      expect(putBucketWebsiteStub).to.be.calledOnce;
      expect(putBucketWebsiteStub).to.be.calledWithExactly({
        Bucket: 'my-website-bucket',
        WebsiteConfiguration: {
          IndexDocument: { Suffix: 'index.html' },
          ErrorDocument: { Key: 'error.html' }
        }
      });
    });

    it('should set bucket policy', async () => {
      expect(putBucketPolicyStub).to.be.calledOnce;
      expect(putBucketPolicyStub).to.be.calledWithExactly({
        Bucket: 'my-website-bucket',
        Policy:
          '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"*"},"Action":"s3:GetObject","Resource":"arn:aws:s3:::my-website-bucket/*"}]}'
      });
    });

    it('should set bucket cors policy', async () => {
      expect(putBucketCorsStub).to.be.calledOnce;
      expect(putBucketCorsStub).to.be.calledWithExactly({
        Bucket: 'my-website-bucket',
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedMethods: ['PUT', 'POST', 'DELETE'],
              AllowedOrigins: ['https://*.amazonaws.com'],
              AllowedHeaders: ['*'],
              MaxAgeSeconds: 0
            },
            {
              AllowedMethods: ['GET'],
              AllowedOrigins: ['*'],
              AllowedHeaders: ['*'],
              MaxAgeSeconds: 0
            }
          ]
        }
      });
    });

    it('should upload files', async () => {
      expect(putObjectStub).to.be.calledTwice;
      expect(putObjectStub).to.be.calledWithMatch({
        Bucket: 'my-website-bucket',
        Key: 'index.html',
        ContentType: 'text/html'
      });
      expect(putObjectStub).to.be.calledWithMatch({
        Bucket: 'my-website-bucket',
        Key: 'error.html',
        ContentType: 'text/html'
      });
    });
  });

  it('should not create the bucket if it already exists', async () => {
    configureInquirerStub(inquirer, { confirm: { isConfirmed: true } });

    await deploy('existing-bucket');

    expect(createBucketStub).not.to.be.called;
  });

  it('should upload files according to custom doc config', async () => {
    configureInquirerStub(inquirer, { confirm: { isConfirmed: true } });

    await deploy('custom-docs');

    expect(putObjectStub).to.be.calledTwice;
    expect(putObjectStub).to.be.calledWithMatch({
      Bucket: 'my-website-bucket',
      Key: 'home.html',
      ContentType: 'text/html'
    });
    expect(putObjectStub).to.be.calledWithMatch({
      Bucket: 'my-website-bucket',
      Key: '404.html',
      ContentType: 'text/html'
    });
  });

  it('should upload file with custom headers', async () => {
    configureInquirerStub(inquirer, { confirm: { isConfirmed: true } });

    await deploy('custom-headers');

    expect(putObjectStub).to.be.calledTwice;
    expect(putObjectStub).to.be.calledWithMatch({
      Bucket: 'my-website-bucket',
      Key: 'index.html',
      ContentType: 'text/html',
      CacheControl: 'max-age=5'
    });
  });

  it('should set custom routing rules', async () => {
    configureInquirerStub(inquirer, { confirm: { isConfirmed: true } });

    await deploy('routing-rules-redirect');

    expect(putBucketWebsiteStub).to.be.calledOnce;
    expect(putBucketWebsiteStub).to.be.calledWithMatch({
      Bucket: 'my-website-bucket',
      WebsiteConfiguration: {
        RoutingRules: [
          {
            Redirect: { ReplaceKeyWith: '' },
            Condition: { HttpErrorCodeReturnedEquals: '404' }
          }
        ]
      }
    });
  });

  it('should set bucket tags', async () => {
    configureInquirerStub(inquirer, { confirm: { isConfirmed: true } });

    await deploy('tags');

    expect(putBucketTaggingStub).to.be.calledOnce;
    expect(putBucketTaggingStub).to.be.calledWithExactly({
      Bucket: 'my-website-bucket',
      Tagging: {
        TagSet: [
          { Key: 'tagKey', Value: 'tagvalue' },
          { Key: 'tagKey2', Value: 'tagValue2' }
        ]
      }
    });
  });

  it('should not deploy without user confirmation', async () => {
    configureInquirerStub(inquirer, { confirm: { isConfirmed: false } });

    await deploy('basic');

    expect(putBucketCorsStub).not.to.be.called;
    expect(putBucketPolicyStub).not.to.be.called;
    expect(putBucketWebsiteStub).not.to.be.called;
    expect(putObjectStub).not.to.be.called;
  });

  it('should deploy without user confirmation if `confirm` option is set to false', async () => {
    configureInquirerStub(inquirer, { confirm: { isConfirmed: false } });

    await deploy('basic', { confirm: false });
    expect(putBucketCorsStub).to.be.called;
    expect(putBucketPolicyStub).to.be.called;
    expect(putBucketWebsiteStub).to.be.called;
    expect(putObjectStub).to.be.called;
  });

  function deploy(fixture, options) {
    createBucketStub = sinon.stub();
    putBucketCorsStub = sinon.stub();
    putBucketPolicyStub = sinon.stub();
    putBucketTaggingStub = sinon.stub();
    putBucketWebsiteStub = sinon.stub();
    putObjectStub = sinon.stub();

    return runServerless({
      fixture,
      command: 'client deploy',
      options,
      awsRequestStubMap: {
        S3: {
          createBucket: createBucketStub,
          listBuckets: {
            Buckets: [{ Name: 'existing-bucket' }]
          },
          listObjectsV2: {
            Contents: []
          },
          putBucketCors: putBucketCorsStub,
          putBucketPolicy: putBucketPolicyStub,
          putBucketTagging: putBucketTaggingStub,
          putBucketWebsite: putBucketWebsiteStub,
          putObject: putObjectStub
        }
      }
    });
  }
});
