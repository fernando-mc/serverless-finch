'use strict';

const configureInquirerStub = require('@serverless/test/configure-inquirer-stub');
const inquirer = require('@serverless/utils/inquirer');
const chai = require('chai');
const sinon = require('sinon');

const runServerless = require('../test/run-serverless');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const { expect } = require('chai');

describe('client deploy', () => {
  let createBucketStub;
  let deleteObjectsStub;
  let putBucketCorsStub;
  let putBucketPolicyStub;
  let putBucketTaggingStub;
  let putBucketWebsiteStub;
  let putObjectStub;

  beforeEach(() => {
    createBucketStub = sinon.stub();
    deleteObjectsStub = sinon.stub();
    putBucketCorsStub = sinon.stub();
    putBucketPolicyStub = sinon.stub();
    putBucketTaggingStub = sinon.stub();
    putBucketWebsiteStub = sinon.stub();
    putObjectStub = sinon.stub();

    configureInquirerStub(inquirer, { confirm: { isConfirmed: true } });
  });

  it('should create the bucket', async () => {
    await deploy('basic');

    expect(createBucketStub).to.be.calledOnce;
    expect(createBucketStub).to.be.calledWithExactly({
      Bucket: 'my-website-bucket'
    });
  });

  it('should set bucket website configuration', async () => {
    await deploy('basic');

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
    await deploy('basic');

    expect(putBucketPolicyStub).to.be.calledOnce;
    expect(putBucketPolicyStub).to.be.calledWithExactly({
      Bucket: 'my-website-bucket',
      Policy:
        '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"*"},"Action":"s3:GetObject","Resource":"arn:aws:s3:::my-website-bucket/*"}]}'
    });
  });

  it('should set bucket cors policy', async () => {
    await deploy('basic');

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
    await deploy('basic');

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

  it('should not create the bucket if bucket already exists', async () => {
    await deploy('existing-bucket');

    expect(createBucketStub).not.to.be.called;
  });

  it('should still set the bucket config & policies if bucket already exists', async () => {
    await deploy('existing-bucket');

    expect(putBucketCorsStub).to.be.called;
    expect(putBucketPolicyStub).to.be.called;
    expect(putBucketWebsiteStub).to.be.called;
  });

  it('delete objects in the bucket if it already exists', async () => {
    await deploy('existing-bucket');

    expect(deleteObjectsStub).to.be.calledOnce;
    expect(deleteObjectsStub).to.be.calledWithExactly({
      Bucket: 'existing-bucket',
      Delete: { Objects: [{ Key: 'existing-file-1' }, { Key: 'existing-file-2' }] }
    });
  });

  it('should upload files according to custom doc config', async () => {
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

  it('should use custom cors configuration', async () => {
    await deploy('custom-cors');

    expect(putBucketCorsStub).to.be.calledOnce;
    expect(putBucketCorsStub).to.be.calledWithExactly({
      Bucket: 'my-website-bucket',
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedMethods: ['GET'],
            AllowedOrigins: ['https://example.com'],
            AllowedHeaders: ['*'],
            MaxAgeSeconds: 0
          }
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

  describe('command line options', () => {
    it('--no-delete-contents should skip deleting existing objects', async () => {
      await deploy('existing-bucket', { 'delete-contents': false });
      expect(deleteObjectsStub).not.to.be.called;
    });

    it('--no-config-change should skip bucket website configuration', async () => {
      await deploy('existing-bucket', { 'config-change': false });
      expect(putBucketWebsiteStub).not.to.be.called;
    });

    it('--no-policy-change should skip bucket policy configuration', async () => {
      await deploy('existing-bucket', { 'policy-change': false });
      expect(putBucketPolicyStub).not.to.be.called;
    });

    it('--no-cors-change should skip bucket CORS configuration', async () => {
      await deploy('existing-bucket', { 'cors-change': false });
      expect(putBucketCorsStub).not.to.be.called;
    });

    it('--no-confirm should skip user confirmation', async () => {
      configureInquirerStub(inquirer, { confirm: { isConfirmed: false } });

      await deploy('basic', { confirm: false });
      expect(putObjectStub).to.be.called;
    });
  });

  function deploy(fixture, options) {
    return runServerless({
      fixture,
      command: 'client deploy',
      options,
      awsRequestStubMap: {
        S3: {
          createBucket: createBucketStub,
          deleteObjects: deleteObjectsStub,
          listBuckets: {
            Buckets: [{ Name: 'existing-bucket' }]
          },
          listObjectsV2: {
            Contents: [{ Key: 'existing-file-1' }, { Key: 'existing-file-2' }]
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

describe('client remove', () => {
  let deleteBucketStub;
  let deleteObjectsStub;
  let listBucketsStub;
  let listObjectsV2Stub;

  beforeEach(() => {
    deleteBucketStub = sinon.stub();
    deleteObjectsStub = sinon.stub();
    listBucketsStub = sinon.stub().returns({
      Buckets: [{ Name: 'my-website-bucket' }]
    });
    listObjectsV2Stub = sinon.stub().returns({
      Contents: [
        { Key: 'existing-file-1' },
        { Key: 'existing-file-2' },
        { Key: 'some-prefix/another-file' }
      ]
    });

    configureInquirerStub(inquirer, { confirm: { isConfirmed: true } });
  });

  it('should not delete without user confirmation', async () => {
    configureInquirerStub(inquirer, { confirm: { isConfirmed: false } });

    await delete 'basic';

    expect(deleteObjectsStub).not.to.be.called;
    expect(deleteBucketStub).not.to.be.called;
  });

  it('should delete the objects', async () => {
    await remove('basic');

    expect(deleteObjectsStub).to.be.calledOnce;
    expect(deleteObjectsStub).to.be.calledWithExactly({
      Bucket: 'my-website-bucket',
      Delete: {
        Objects: [
          { Key: 'existing-file-1' },
          { Key: 'existing-file-2' },
          { Key: 'some-prefix/another-file' }
        ]
      }
    });
  });

  it('should delete the bucket', async () => {
    await remove('basic');

    expect(deleteBucketStub).to.be.calledOnce;
    expect(deleteBucketStub).to.be.calledWithExactly({
      Bucket: 'my-website-bucket'
    });
  });

  it('should not delete the bucket if manageResources is set to false', async () => {
    await remove('disable-manage-resources');

    expect(deleteBucketStub).not.to.be.called;
  });

  describe('with keyPrefix configured', () => {
    it('should only delete objects under prefix', async () => {
      await remove('key-prefix');

      expect(deleteObjectsStub).to.be.calledOnce;
      expect(deleteObjectsStub).to.be.calledWithExactly({
        Bucket: 'my-website-bucket',
        Delete: { Objects: [{ Key: 'some-prefix/another-file' }] }
      });
    });

    it('should not delete the bucket if objects exist outside prefix', async () => {
      await remove('key-prefix');

      expect(deleteBucketStub).not.to.be.called;
    });

    it('should delete the bucket if no objects exist outside prefix', async () => {
      listObjectsV2Stub.returns({ Contents: [{ Key: 'some-prefix/another-file' }] });

      await remove('key-prefix');

      expect(deleteBucketStub).to.be.calledOnce;
    });
  });

  describe('command line options', () => {
    it('--no-confirm should skip user confirmation', async () => {
      configureInquirerStub(inquirer, { confirm: { isConfirmed: false } });

      await remove('basic', { confirm: false });
      expect(deleteBucketStub).to.be.called;
    });
  });

  function remove(fixture, options) {
    return runServerless({
      fixture,
      command: 'client remove',
      options,
      awsRequestStubMap: {
        S3: {
          deleteBucket: deleteBucketStub,
          deleteObjects: deleteObjectsStub,
          listBuckets: listBucketsStub,
          listObjectsV2: listObjectsV2Stub
        }
      }
    });
  }
});
