const logFetch = require('log').get('fetch');
const nodeFetch = require('node-fetch');

let lastRequestId = 0;

async function fetch(url, options) {
  const requestId = ++lastRequestId;
  logFetch.debug('[%d] %s %o', requestId, url, options);

  let response;
  try {
    response = await nodeFetch(url, options);
  } catch (error) {
    logFetch.error('[%d] request error: %o', requestId, error);
    throw error;
  }

  logFetch.debug('[%d] %d %j', requestId, response.status, response.headers.raw());

  response
    .clone()
    .buffer()
    .then(
      buffer => logFetch.debug('[%d] %s', requestId, String(buffer)),
      error => logFetch.error('[%d] response resolution error: %o', requestId, error)
    );
  return response;
}

module.exports = {
  fetch
};
