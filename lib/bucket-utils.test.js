const chai = require('chai');
const sinon = require('sinon');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const { expect } = require('chai');
const { emptyBucket } = require('./bucket-utils');

describe('emptyBucket', () => {
  let aws;
  let awsRequestStub;
  let deleteObjectsStub;
  let listObjectsV2Stub;

  beforeEach(() => {
    awsRequestStub = sinon.stub();
    deleteObjectsStub = awsRequestStub.withArgs('S3', 'deleteObjects').resolves();
    listObjectsV2Stub = awsRequestStub.withArgs('S3', 'listObjectsV2').resolves({ Contents: [] });

    aws = { request: awsRequestStub };
  });

  describe('without keyPrefix', () => {
    it('lists objects and does nothing if there are none', async () => {
      await emptyBucket(aws, 'my-bucket');
      expect(listObjectsV2Stub).to.be.calledOnce;
      expect(listObjectsV2Stub.firstCall.args[2]).to.deep.equal({ Bucket: 'my-bucket' });
      expect(deleteObjectsStub).to.not.be.called;
    });

    it('deletes all objects listed', async () => {
      listObjectsV2Stub.resolves({ Contents: [{ Key: 'file-a' }, { Key: 'file-b' }] });
      await emptyBucket(aws, 'my-bucket');
      expect(deleteObjectsStub).to.be.calledOnce;
      expect(deleteObjectsStub.firstCall.args[2]).to.deep.equal({
        Bucket: 'my-bucket',
        Delete: { Objects: [{ Key: 'file-a' }, { Key: 'file-b' }] }
      });
    });

    it('resolves to `true`', async () => {
      listObjectsV2Stub.resolves({ Contents: [{ Key: 'file-a' }, { Key: 'file-b' }] });
      await expect(emptyBucket(aws, 'my-bucket')).to.eventually.equal(true);
    });

    it('deletes nested objects', async () => {
      listObjectsV2Stub.resolves({ Contents: [{ Key: 'file-a' }, { Key: 'a/b/c/d' }] });
      await emptyBucket(aws, 'my-bucket');
      expect(deleteObjectsStub).to.be.calledOnce;
      expect(deleteObjectsStub.firstCall.args[2]).to.deep.equal({
        Bucket: 'my-bucket',
        Delete: { Objects: [{ Key: 'file-a' }, { Key: 'a/b/c/d' }] }
      });
    });
  });

  describe('with keyPrefix', () => {
    it('only deletes objects with keys that start with keyPrefix', async () => {
      listObjectsV2Stub.resolves({
        Contents: [{ Key: 'file-a' }, { Key: 'd/a/b/x' }, { Key: 'a/b/c/d' }]
      });
      await emptyBucket(aws, 'my-bucket', 'a/b/');
      expect(deleteObjectsStub).to.be.calledOnce;
      expect(deleteObjectsStub.firstCall.args[2]).to.deep.equal({
        Bucket: 'my-bucket',
        Delete: { Objects: [{ Key: 'a/b/c/d' }] }
      });
    });

    it('resolves to `false` if some objects do not start with keyPrefix', async () => {
      listObjectsV2Stub.resolves({
        Contents: [{ Key: 'file-a' }, { Key: 'd/a/b/x' }, { Key: 'a/b/c/d' }]
      });
      await expect(emptyBucket(aws, 'my-bucket', 'a/b')).to.eventually.equal(false);
    });

    it('resolves to `true` if all objects start with keyPrefix', async () => {
      listObjectsV2Stub.resolves({
        Contents: [{ Key: 'foo/1' }, { Key: 'foo/2' }]
      });
      await expect(emptyBucket(aws, 'my-bucket', 'foo')).to.eventually.equal(true);
    });
  });
});
