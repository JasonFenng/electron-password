const log = require('electron-log');
const _ = require('lodash');
const CONSTANTS = require('../../common/Constants');

class Context {
  static get instance() {
    return this.__ins;
  }

  static set instance(ins) {
    this.__ins = ins;
  }

  constructor() {
    const ins = Context.instance;
    if (!ins) {
      this.store = {
        action: CONSTANTS.ACTION.INITIAL,
      };
      Context.instance = this;
    }
    return Context.instance;
  }

  clear() {
    this.store = {
      action: CONSTANTS.ACTION.INITIAL,
    };
  }

  get action() {
    return this.store.action;
  }
  set action(actionType) {
    const legalActionType = !!_.get(CONSTANTS.ACTION, actionType);
    if (!legalActionType) {
      log.error(`[CONTEXT::SET_ACTION_FAILED] actionType: ${actionType}`);
    }
    this.store.action = legalActionType ? actionType : CONSTANTS.ACTION.INITIAL;
    return this.store.action;
  }

  set userId(id) {
    this.store.userId = id;
    return this.store.userId;
  }
  get userId() {
    return this.store.userId;
  }

  set appId(id) {
    this.store.appId = id;
    return this.store.appId;
  }
  get appId() {
    return this.store.appId;
  }

  set appName(appName) {
    this.store.appName = appName;
    return this.store.appName;
  }
  get appName() {
    return this.store.appName;
  }

  set appleScript(appleScript) {
    this.store.appleScript = appleScript;
    return this.store.appleScript;
  }
  get appleScript() {
    return this.store.appleScript;
  }

  set keySequence(keySequence) {
    this.store.keySequence = keySequence;
    return this.store.keySequence;
  }
  get keySequence() {
    return this.store.keySequence;
  }

  config(params) {
    this.action = _.get(params, 'action');
    this.userId = _.get(params, 'userId');
    this.appId = _.get(params, 'appId');
    this.appName = _.get(params, 'appName');
    this.appleScript = _.get(params, 'appleScript');
    this.keySequence = _.get(params, 'keySequence');
  }
}

module.exports.default = module.exports = Context;
