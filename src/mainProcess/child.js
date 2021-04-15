const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const { exec } = require('child_process');
const applescript = require('applescript');
const CONSTANTS = require('../common/Constants');

const vbsHeader = (programPath) => {
  return `dim program
program="${programPath}"
set Wshell=CreateObject("Wscript.Shell")
set oexec=Wshell.Exec(program)
WScript.Sleep 2000
`;
};

const vbsShortcut = (key) => {
  return `
WScript.Sleep 500
Wshell.SendKeys "{${key}}"`;
};

const vbsInput = (val) => {
  return `
WScript.Sleep 800
Wshell.SendKeys "${val}"`;
};

const createVbs = (appData) => {
  const regex = /{([^{}]+)}/gm;
  // `{USERNAME}{TAB}{PASSWORD}{ENTER}`;
  const str =
    typeof _.get(appData, 'keySequence') === 'string' ? _.get(appData, 'keySequence') : '';
  let m;
  let vbScript = '';
  while ((m = regex.exec(str)) !== null) {
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }
    const key = _.get(m, [1]);
    switch (key) {
      case 'TAB':
      case 'ENTER':
        vbScript += vbsShortcut(key);
        break;
      case 'USERNAME':
        vbScript += vbsInput(_.get(appData, 'username'));
        break;
      case 'PASSWORD':
        vbScript += vbsInput(_.get(appData, 'password'));
        break;
      default:
        process.send({
          event: 'ERROR',
          data: {
            status: 'INVALID_SCRIPT_TYPE',
            message: `[INVALID_SCRIPT_TYPE] key: ${key}`,
          },
        });
        break;
    }
  }
  return vbsHeader(_.get(appData, 'path')) + vbScript;
};

const createAppleScript = (appData) => {
  const username = _.get(appData, 'username');
  const password = _.get(appData, 'password');
  const appleScript = _.get(appData, 'appleScript');

  if (typeof appleScript !== 'string') {
    process.send({
      event: 'ERROR',
      data: {
        status: 'INVALID_APPLESCRIPT',
        message: `[INVALID_SCRIPT_TYPE] key: ${key}`,
      },
    });
    return '';
  }

  return appleScript
    .replace('{USERNAME}', username)
    .replace('{PASSWORD}', password);
};

const execScriptHandler = (message) => {
  const vbsPath = _.get(message, 'data.vbsPath');
  const app = _.get(message, 'data.app');
  if (
    !vbsPath ||
    typeof app !== 'object' ||
    !['win32', 'darwin'].includes(process.platform)
  ) {
    process.send({
      event: 'ERROR',
      data: {
        status: !vbsPath
          ? 'INVALID_CACHE_DIR'
          : typeof app !== 'object'
          ? 'INVALID_APP_DATA'
          : 'INCOMPATIBLE_PLATFORM',
      },
    });
    return;
  }
  if (process.platform === 'win32') {
    const vbsScript = createVbs(app);
    fs.writeFileSync(vbsPath, vbsScript);
    const subProcess = exec(`wscript ${vbsPath}`, (error, stdout, stderr) => {
      if (error) {
        process.send({
          event: 'EXEC_SCRIPT_ERROR',
          data: {
            message: error,
          },
        });
      }
    });
  } else {
    const appleScript = createAppleScript(app);
    if (appleScript) {
      applescript.execString(appleScript, (err, rtn) => {
        if (err) {
          process.send({
            event: 'EXEC_SCRIPT_ERROR',
            data: {
              message: err,
            },
          });
        }
      });
    }
  }
};

process.on('message', (message) => {
  const type = _.get(message, 'event');
  if (type === CONSTANTS.PROCESS_EVENT.EXEC_SCRIPT) {
    execScriptHandler(message);
  }
});
