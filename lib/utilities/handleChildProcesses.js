'use strict';

const { spawn } = require('child_process');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function handleChildProcesses(serverless, commands) {
	for(const command of commands){
		serverless.cli.log(`Executing : ${command}`)
		const { stdout, stderr } = await exec(command);
  		if (stderr) {
  			serverless.cli.log(`error: ${stderr}`)
  		}
  		serverless.cli.log(`${stdout}`)
	}
	return true
}

module.exports = handleChildProcesses;













