'use strict';

const fs = require('fs');
const path = require('path');

function getFileList(dir, fileList) {
  fileList = fileList || [];

  const members = fs.readdirSync(path.normalize(dir));
  members.forEach(member => {
    const memberPath = path.join(dir, member);

    if (fs.statSync(memberPath).isDirectory()) {
      fileList = getFileList(memberPath, fileList);
    } else {
      fileList.push(memberPath);
    }
  });
  return fileList;
}

module.exports = getFileList;
