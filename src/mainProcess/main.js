const {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  clipboard,
  Menu,
  Tray,
} = require('electron');
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const _ = require('lodash');
const qs = require('qs');
const log = require('electron-log');
const rimraf = require('rimraf');
const CONSTANTS = require('../common/Constants');
const {
  Auth,
  db,
  DeeplinkUrlEmitter,
  Context,
  VBS_PATH,
  DB_PATH,
} = require('./lib');

const openSync = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.open(filePath, 'r', (err, fd) => {
      if (err) {
        resolve([err]);
      } else {
        resolve([null, fd]);
      }
    });
  });
};

const gotTheLock = app.requestSingleInstanceLock();
log.silly(`[SINGLE_INSTANCE] lock: ${gotTheLock}`);
if (gotTheLock) {
  app.on('second-instance', (e, argv) => {
    // Someone tried to run a second instance, we should focus our window.
    // Protocol handler for win32
    // argv: An array of the second instance’s (command line / deep linked) arguments
    log.silly('SECOND_INSTANCE');
    if (process.platform === 'win32') {
      // Keep only command line / deep linked arguments
      DeeplinkUrlEmitter.invoke(getArgsFromBootParams(argv.slice(1)));
    }

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
} else {
  app.quit();
  app.quit();
  return;
}

const auth = new Auth();
const context = new Context();
let mainWindow = null;
let childProcess = null;
let appTray = null;

const template = [
  {
    label: CONSTANTS.APP_NAME_ZH_CN,
    submenu: [{ role: 'quit' }],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

if (process.platform === 'win32') {
  app.setUserTasks([]);
}

const clearUserData = async () => {
  if (process.platform === 'darwin') {
    const appDir = path.resolve(app.getAppPath(), '../');
    let err = null,
      stats = null;
    try {
      stats = fs.statSync(appDir);
    } catch (e) {
      err = e;
      log.error(`READ_DIR_ERROR:: e: ${e}`);
    }

    if (err) return null;
    if (stats instanceof fs.Stats && !stats.isDirectory()) {
      log.warn(`OPENED_MARK_FAILED:: ${appDir} is not directory`);
      return null;
    }
    const openedMark = path.resolve(appDir, './.opened');
    const [openError] = await openSync(openedMark);
    if (openError) {
      try {
        await rimraf.sync(DB_PATH);
        await fs.writeFileSync(openedMark, '');
      } catch (e) {
        log.error(`OPENED_OPERATE_FAILED:: ${e}`);
      }
    }
  }
  return null;
};

const createMainWindow = (page, appData) => {
  log.silly(`[CREATE_MAIN_WINDOW] appTray: ${appTray}`);
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: CONSTANTS.APP_NAME_ZH_CN,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: false,
    },
  });
  const filePath = path.resolve(__dirname, '../../index.html');
  const queryString = `${qs.stringify({ page, ...appData })}`;
  log.silly(`[CREATE_MAIN_WINDOW] params: ${queryString}`);
  mainWindow.loadFile(filePath).then(() => {
    clearUserData()
      .then(() => {
        mainWindow.webContents.send(
          CONSTANTS.EVENT.PRE_DATA_READY,
          page,
          appData,
        );
      })
      .catch((e) => {
        log.error(`UNHANDLER:: e: ${e}`);
      });
  });

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function () {
    log.silly('[WINDOW_CLOSED]');
    mainWindow = null;
  });

  if (process.platform === 'win32') {
    Menu.setApplicationMenu(null);
    //设置托盘图标和菜单
    const trayMenuTemplate = [
      {
        label: '打开',
        click: () => {
          win32ShowMainWindow();
        },
      },
      {
        label: '退出',
        click: () => {
          app.quit();
          app.quit(); //因为程序设定关闭为最小化，所以调用两次关闭，防止最大化时一次不能关闭的情况
        },
      },
    ];
    if (!appTray) {
      //系统托盘图标
      const icon = path.resolve(__dirname, '../assets/images/icon.ico');
      appTray = new Tray(icon);
    }

    //图标的上下文菜单
    const contextMenu = Menu.buildFromTemplate(trayMenuTemplate);
    //设置此托盘图标的悬停提示内容
    appTray.setToolTip(CONSTANTS.APP_NAME_ZH_CN);
    //设置此图标的上下文菜单
    appTray.setContextMenu(contextMenu);
    // 点击后展示主窗口
    appTray.on('click', function () {
      win32ShowMainWindow();
    });
    //右键
    appTray.on('right-click', () => {
      appTray.popUpContextMenu(trayMenuTemplate);
    });
  }
};

const closeMainWindow = () => {
  if (mainWindow) mainWindow.close();
};

const win32ShowMainWindow = () => {
  if (!auth.logged) {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow(CONSTANTS.PAGE.LOGIN_FORM);
    }
  } else {
    showNotify({
      title: '已登录',
      body: '您已成功登录，请勿重复操作',
    });
  }
};

const showNotify = (option) => {
  if (Notification.isSupported()) {
    const notify = new Notification(option);
    notify.on('click', () => {
      notify.close();
    });
    notify.show();
  }
};

const checkProcessParams = (params) => {
  const param = _.pick(params, [
    'action',
    'userId',
    'appId',
    'appName',
    'keySequence',
    'appleScript',
  ]);
  log.silly(
    `[CHECK_PARAMS] ACTION: ${param.action}, appId: ${param.appId}, userId: ${param.userId}`,
  );
  if (param.action === undefined) {
    param.action = CONSTANTS.ACTION.INITIAL;
    log.silly(`[CHECK_PARAMS::MODIFIED_ACTION] ACTION: ${param.action}`);
    return [null, param];
  }
  if (
    [CONSTANTS.ACTION.LOGIN_APP, CONSTANTS.ACTION.MODIFY_PW].includes(
      param.action,
    )
  ) {
    let invalidParams = !param.userId || !param.appId;
    if (process.platform === 'darwin' && !param.appleScript) {
      invalidParams = true;
    }
    if (process.platform === 'win32' && !param.keySequence) {
      invalidParams = true;
    }
    if (invalidParams) {
      log.error(
        `[CHECK_PARAMS::INVALID_USER_ID_OR_APP_ID] userId: ${
          param.userId
        }, appId: ${param.appId}, platform: ${
          process.platform
        }, appleScript: ${!!param.appleScript}, keySequence: ${!!param.keySequence}`,
      );
      showNotify({
        title: '参数错误',
        body: '请确保应用数据正确后重试',
      });
      return ['INVALID_USER_ID_OR_APP_ID', param];
    }
    return [null, param];
  }
  log.error(`[CHECK_PARAMS::INVALID_ACTION] ACTION: ${param.action}`);
  return ['INVALID_ACTION', param];
};

const getArgsFromBootParams = (args) => {
  let res = Array.isArray(args)
    ? args.find(
        (i) => typeof i === 'string' && i.startsWith(CONSTANTS.APP_NAME),
      )
    : '';
  return typeof res === 'string' ? res : '';
};

const execScript = (app) => {
  clipboard.writeText(
    `username: ${_.get(app, 'username')}, password: ${_.get(app, 'password')}`,
  );
  if (!childProcess || childProcess.killed) {
    childProcess = fork(path.resolve(__dirname, './child.js'));
  }
  childProcess.send({
    event: CONSTANTS.PROCESS_EVENT.EXEC_SCRIPT,
    data: {
      vbsPath: VBS_PATH,
      app,
    },
  });
  childProcess.on('message', (message) => {
    if (_.get(message, 'event') === 'ERROR') {
      log.error(
        `[CHILD_PROCESS] ${_.get(message, 'data.status')} ${
          _.get(message, 'data.message') || ''
        }`,
      );
      showNotify({
        title: '唤起应用失败',
        body: '无法唤起对应应用，请稍后重试',
      });
      childProcess.kill('SIGINT');
    }
  });
};

const findAndUpdateApp = (param) => {
  /**
   * param: {userId: string, appId: string, appName: string, appleScript?: string, keySequence?: string}
   * return: {userId: string, appId: string, appName: string, appPath?: string, appleScript?: string, keySequence?:
   * string}
   * */
  const { userId, appId } = param;
  const [findError, app] = db.find(auth.cipher, { userId, appId });
  if (!findError) {
    let hasChange = false;
    ['userId', 'appId', 'appName', 'appleScript', 'keySequence'].forEach(
      (key) => {
        if (param[key] && _.get(app, key) !== param[key]) {
          hasChange = true;
          _.set(app, key, param[key]);
        }
      },
    );
    if (hasChange) {
      try {
        db.update(auth.cipher, app.id, {
          ...app,
        });
      } catch (e) {
        log.warn(`[${e.status}] ${e}`);
      }
    }
    return [null, app];
  }
  return [findError, param];
};

const handleModifyApp = () => {
  const [findError, appData] = findAndUpdateApp({
    userId: context.userId,
    appId: context.appId,
    appName: context.appName,
    appleScript: context.appleScript,
    keySequence: context.keySequence,
  });
  if (_.get(findError, 'status') === '11404' || !findError) {
    if (mainWindow) {
      mainWindow.webContents.send(CONSTANTS.EVENT.SHOW_APP_FORM, appData);
    } else {
      createMainWindow(CONSTANTS.PAGE.APP_FORM, appData);
    }
  } else {
    log.error('[OPERATE_FAILED] HAN,LOG,MOD');
    showNotify({
      title: '操作失败',
      body: '操作失败，无法执行相关操作',
    });
  }
};

const handleLoginApp = (flag) => {
  const [findError, appData] = findAndUpdateApp({
    userId: context.userId,
    appId: context.appId,
    appName: context.appName,
    appleScript: context.appleScript,
    keySequence: context.keySequence,
  });
  if (!findError) {
    execScript(appData);
    showNotify({
      title: '尝试唤起应用',
      body: '若对应应用无法唤起，请稍后重试或直接使用剪贴板中的信息',
    });
    if (flag === 'FIND_THEN_CLOSE') {
      closeMainWindow();
    }
    return;
  }
  if (_.get(findError, 'status') === '11404') {
    if (mainWindow) {
      mainWindow.webContents.send(CONSTANTS.EVENT.SHOW_APP_FORM, appData);
    } else {
      createMainWindow(CONSTANTS.PAGE.APP_FORM, appData);
    }
  } else {
    log.error('[OPERATE_FAILED] HAN,LOG,APP');
    showNotify({
      title: '操作失败',
      body: '操作失败，无法执行相关操作',
    });
  }
};

const prepare = (queryParams, ...args) => {
  log.silly(`[PREPARE] appIsReady: ${app.isReady()}`);
  if (!app.isReady()) {
    return;
  }
  const [err, params] = checkProcessParams(queryParams);
  if (err) {
    log.error(`[PREPARE::ERROR] ${err}`);
    return;
  } else {
    context.config(params);
    log.silly(
      `[PREPARE] logged: ${auth.logged}, ACTION: ${context.action}, appId: ${context.appId}, userId: ${context.userId}, appName: ${context.appName}`,
    );
  }

  if (!auth.logged) {
    createMainWindow(CONSTANTS.PAGE.LOGIN_FORM);
  } else {
    switch (context.action) {
      case CONSTANTS.ACTION.MODIFY_PW:
        handleModifyApp();
        break;
      case CONSTANTS.ACTION.LOGIN_APP:
        handleLoginApp();
        break;
      default:
        showNotify({
          title: '已登录',
          body: '您已成功登录，请勿重复操作',
        });
        break;
    }
  }
};

DeeplinkUrlEmitter.addEventListener(prepare);

app.on('ready', (e) => {
  log.info(`APP_READY::platform: ${process.platform}`);
  // get deeplinkingUrl on win32
  if (process.platform === 'win32') {
    app.setUserTasks([]);
    DeeplinkUrlEmitter.invoke(getArgsFromBootParams(process.argv.slice(1)));
  } else {
    DeeplinkUrlEmitter.invoke();
  }
  app.on('activate', function () {
    // 此方法仅适用于macos
    const windowCount = BrowserWindow.getAllWindows().length;
    log.silly(`[ACTIVE] active window: ${windowCount}`);
    if (windowCount === 0) {
      if (!auth.logged) {
        createMainWindow(CONSTANTS.PAGE.LOGIN_FORM);
      } else {
        showNotify({
          title: '已登录',
          body: '您已成功登录，请勿重复操作',
        });
      }
    }
  });
});

app.on('will-finish-launching', function () {
  log.silly('WILL_FINISH_LAUNCHING');
  // get deeplinkingUrl on macOS
  app.on('open-url', function (event, link) {
    log.silly('OPEN_URL');
    event.preventDefault();
    DeeplinkUrlEmitter.invoke(link);
  });
});

app.on('window-all-closed', function () {
  log.silly('WINDOWS_ALL_CLOSE');
  return false;
});

app.on('will-quit', function () {
  DeeplinkUrlEmitter.clear();
  auth.clear();
  context.clear();
  fs.writeFileSync(path.resolve(VBS_PATH), '');
  log.silly('APP_QUIT');
  log.silly('--------');
});

if (!app.isDefaultProtocolClient(CONSTANTS.APP_NAME)) {
  // Define custom protocol handler. Deep linking works on packaged versions of the application!
  app.setAsDefaultProtocolClient(CONSTANTS.APP_NAME);
}

ipcMain.handle(CONSTANTS.EVENT.LOGIN_CLIENT, async (e, loginData) => {
  log.silly('[HANDLER0]');
  const password = _.get(loginData, 'loginPassword');
  const [hasInitDb] = await Auth.hasInitDb();
  const [error, data] = await auth.verify(password);
  if (error) {
    log.error(`[HANDLER0::ERROR] ${error.status}, ${error.e}`);
    showNotify({
      title: '登录失败',
      body: '密码不正确',
    });
    return Promise.reject(error);
  }
  auth.logged = true;
  showNotify({
    title: !hasInitDb ? '初始化成功' : '登录成功',
    body: !hasInitDb ? '已成功初始化玉符客户端' : '您已成功登录玉符客户端',
  });

  switch (context.action) {
    case CONSTANTS.ACTION.MODIFY_PW:
      handleModifyApp();
      return Promise.resolve();
    case CONSTANTS.ACTION.LOGIN_APP:
      handleLoginApp('FIND_THEN_CLOSE');
      return Promise.resolve();
    default:
      closeMainWindow();
      return Promise.resolve();
  }
});
ipcMain.handle(CONSTANTS.EVENT.SUBMIT_APP_CONFIG, async (e, data) => {
  log.silly('[HANDLER1]');
  let err = null;
  let app = _.cloneDeep(data);
  if (_.get(data, 'id')) {
    [err, app] = db.update(auth.cipher, _.get(data, 'id'), data);
  } else {
    [err, app] = db.create(auth.cipher, data);
  }
  if (err) {
    log.error(`[HANDLER1::ERROR] ${err.status}, ${err.e}`);
    showNotify({
      title: '应用配置错误',
      body: '更新应用信息失败，请稍后重试',
    });
    return Promise.reject(err);
  }
  const isLoginAppAction = context.action === CONSTANTS.ACTION.LOGIN_APP;
  if (isLoginAppAction) {
    showNotify({
      title: '尝试唤起应用',
      body: '若对应应用无法唤起，请稍后重试或直接使用剪贴板中的信息',
    });
    execScript(app);
  }
  showNotify({
    title: isLoginAppAction ? '尝试唤起应用' : '操作成功',
    body: isLoginAppAction
      ? '若对应应用无法唤起，请稍后重试'
      : '应用信息更新成功',
  });
  closeMainWindow();
  return Promise.resolve();
});

ipcMain.on(CONSTANTS.EVENT.CANCEL_LOGIN_CLIENT, () => {
  closeMainWindow();
});

ipcMain.on(CONSTANTS.EVENT.CANCEL_MODIFY_APP, () => {
  closeMainWindow();
});
