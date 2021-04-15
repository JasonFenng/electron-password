const $ = require('jquery');
const _ = require('lodash');
const qs = require('qs');
const path = require('path');
const { ipcRenderer, app } = require('electron');
const log = require('electron-log');

const CONSTANTS = require(path.resolve(__dirname, 'src/common/Constants'));
const { Utils } = require(path.resolve(__dirname, 'src/renderProcess/lib'));

log.silly('RENDER_PROCESS_LOADED');

const isWin = process.platform === 'win32';

const winFormBlock = $('.win-platform');

if (isWin) {
  winFormBlock.show();
} else {
  $('.mac-platform').show();
}

const loading = $('.loading');
const loginForm = $('#login');
const appForm = $('#app');

// get file path
const uploadController = $('#upload-file');
const uploadBtn = $('#upload-file-btn');
const uploadInput = $('#app-deep-link');

uploadController.on('change', function (e) {
  console.log(222);
  const filePath = _.get(e, 'target.files[0].path');
  uploadInput.val(filePath);
  uploadInput.parent('.form-item-input').removeClass('has-error');
});

uploadBtn.on('click', function () {
  uploadController.click();
});

const allVariableMaps = [
  {
    selector: '#app-name',
    variableName: 'appName',
  },
  {
    selector: '#app-deep-link',
    variableName: 'path',
  },
  {
    selector: '#app-type-config',
    variableName: 'keySequence',
  },
  {
    selector: '#app-username',
    variableName: 'username',
  },
  {
    selector: '#app-password',
    variableName: 'password',
  },
];

const selectorVariableMaps = isWin
  ? allVariableMaps
  : [
      {
        selector: '#app-name',
        variableName: 'appName',
      },
      {
        selector: '#app-script-config',
        variableName: 'appleScript',
      },
      {
        selector: '#app-username',
        variableName: 'username',
      },
      {
        selector: '#app-password',
        variableName: 'password',
      },
    ];

const loginInputMaps = [
  {
    selector: '#login-password',
    variableName: 'loginPassword',
  },
];

_.concat(allVariableMaps, loginInputMaps).forEach((item) => {
  $(item.selector).on('input', function (e) {
    $(e.target).parent('.form-item-input').removeClass('has-error');
  });
});

const cancelLoginBtn = $('#login-button-cancel');
cancelLoginBtn.on('click', function (e) {
  ipcRenderer.send(CONSTANTS.EVENT.CANCEL_LOGIN_CLIENT);
});

const cancelModifyApp = $('#app-button-cancel');
cancelModifyApp.on('click', function (e) {
  ipcRenderer.send(CONSTANTS.EVENT.CANCEL_MODIFY_APP);
});

const showLoginForm = () => {
  loading.hide();
  appForm.hide();
  loginForm.show();
  const loginBtn = $('#login-button-submit');
  loginBtn.on('click', function (e) {
    const passwordWrapper = $('#login .form-item-input');
    const loginData = Utils.serializeFormData(
      new FormData($('#login-form')[0]),
    );
    if (!_.get(loginData, 'loginPassword')) {
      passwordWrapper
        .addClass('has-error')
        .find('.error-explain')
        .text('请输入密码');
      return;
    }
    ipcRenderer
      .invoke(CONSTANTS.EVENT.LOGIN_CLIENT, loginData)
      .then(() => {})
      .catch((e) => {
        passwordWrapper
          .addClass('has-error')
          .find('.error-explain')
          .text('密码不正确');
      });
  });
};

const setDefaultValue = (appData) => {
  selectorVariableMaps.forEach((item) => {
    $(item.selector).val(_.get(appData, item.variableName, ''));
  });
};

const validateValue = (appData) => {
  let success = true;
  selectorVariableMaps.forEach((item) => {
    const value = _.get(appData, item.variableName);
    if (!value) {
      $(item.selector).parent('.form-item-input').addClass('has-error');
      success = false;
    }
  });
  return success;
};

const showAppForm = (appData) => {
  loading.hide();
  loginForm.hide();
  appForm.show();
  // set form default value
  setDefaultValue(appData);

  const appBtn = $('#app-button-submit');
  appBtn.on('click', function (e) {
    const data = Utils.serializeFormData(new FormData($('#app-form')[0]));
    _.set(data, 'appName', _.get(appData, 'appName'));
    _.set(data, 'keySequence', $('#app-type-config').val());
    _.set(data, 'appleScript', $('#app-script-config').val());
    if (validateValue(data)) {
      ipcRenderer
        .invoke(CONSTANTS.EVENT.SUBMIT_APP_CONFIG, { ...appData, ...data })
        .then(() => {})
        .catch((e) => {});
    }
  });
};

ipcRenderer.on(CONSTANTS.EVENT.PRE_DATA_READY, (e, page, appData) => {
  log.info(`PRE_DATA_READY:: page: ${page}`);
  if (page === CONSTANTS.PAGE.LOGIN_FORM) {
    showLoginForm();
  }
  if (page === CONSTANTS.PAGE.APP_FORM) {
    showAppForm(appData);
  }
});

ipcRenderer.on(CONSTANTS.EVENT.SHOW_APP_FORM, (e, appData) => {
  showAppForm(appData);
});
