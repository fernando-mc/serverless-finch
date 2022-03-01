const chai = require('chai');
const path = require('path');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const { expect } = require('chai');

describe('uploadDirectory', () => {
  let aws;
  let readFileSyncStub;
  let getFileListStub;
  let uploadDirectory;

  beforeEach(() => {
    aws = { request: sinon.stub() };
    readFileSyncStub = sinon.stub().returns('010101');
    getFileListStub = sinon
      .stub()
      .returns(['file.txt', 'nested/file.html', 'other/nested/file.html']);

    uploadDirectory = proxyquire('./upload', {
      fs: { readFileSync: readFileSyncStub },
      './get-file-list': getFileListStub
    });
  });

  it('calls S3 putObject with file contents', async () => {
    await uploadDirectory(aws, 'my-bucket', './');

    expect(aws.request).to.be.calledThrice;
    expect(aws.request).to.be.calledWithExactly('S3', 'putObject', {
      Bucket: 'my-bucket',
      Key: 'file.txt',
      Body: '010101',
      ContentType: 'text/plain'
    });
  });

  describe('headers', () => {
    it('can be specified for all files using ALL_OBJECTS', async () => {
      await uploadDirectory(aws, 'my-bucket', './', {
        ALL_OBJECTS: [{ name: 'globalHeader', value: 'globalHeaderValue' }]
      });

      expect(aws.request).to.be.always.calledWithMatch('S3', 'putObject', {
        Metadata: { globalHeader: 'globalHeaderValue' }
      });
    });

    it('can be specified for a file', async () => {
      await uploadDirectory(aws, 'my-bucket', './', {
        'file.txt': [{ name: 'foo', value: 'bar' }]
      });

      expect(aws.request).to.be.calledWithMatch('S3', 'putObject', {
        Key: 'file.txt',
        Metadata: { foo: 'bar' }
      });

      expect(aws.request).not.to.be.calledWithMatch('S3', 'putObject', {
        Key: 'nested/file.html',
        Metadata: { foo: 'bar' }
      });

      expect(aws.request).not.to.be.calledWithMatch('S3', 'putObject', {
        Key: 'other/nested/file.html',
        Metadata: { foo: 'bar' }
      });
    });

    it('can be specified for a folder', async () => {
      const headers = {};
      headers['nested' + path.sep] = [{ name: 'foo', value: 'bar' }];
      await uploadDirectory(aws, 'my-bucket', './', headers);

      expect(aws.request).not.to.be.calledWithMatch('S3', 'putObject', {
        Key: 'file.txt',
        Metadata: { foo: 'bar' }
      });

      expect(aws.request).to.be.calledWithMatch('S3', 'putObject', {
        Key: 'nested/file.html',
        Metadata: { foo: 'bar' }
      });

      expect(aws.request).not.to.be.calledWithMatch('S3', 'putObject', {
        Key: 'other/nested/file.html',
        Metadata: { foo: 'bar' }
      });
    });

    it('can be specified using a glob', async () => {
      await uploadDirectory(aws, 'my-bucket', './', {
        'other/**/*': [{ name: 'foo', value: 'bar' }]
      });

      expect(aws.request).not.to.be.calledWithMatch('S3', 'putObject', {
        Key: 'file.txt',
        Metadata: { foo: 'bar' }
      });

      expect(aws.request).not.to.be.calledWithMatch('S3', 'putObject', {
        Key: 'nested/file.html',
        Metadata: { foo: 'bar' }
      });

      expect(aws.request).to.be.calledWithMatch('S3', 'putObject', {
        Key: 'other/nested/file.html',
        Metadata: { foo: 'bar' }
      });
    });
  });

  describe('order', () => {
    it('can be specified by listing each file', async () => {
      await uploadDirectory(aws, 'my-bucket', './', {}, [
        'nested/file.html',
        'file.txt',
        'other/nested/file.html'
      ]);

      expect(aws.request.firstCall.args[2]).to.have.property('Key', 'nested/file.html');
      expect(aws.request.secondCall.args[2]).to.have.property('Key', 'file.txt');
      expect(aws.request.thirdCall.args[2]).to.have.property('Key', 'other/nested/file.html');
    });
  });
});
