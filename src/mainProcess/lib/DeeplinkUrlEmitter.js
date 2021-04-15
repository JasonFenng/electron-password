const EventEmitter = require('events');
const log = require('electron-log');
const qs = require('qs');

class DeeplinkUrlEmitter {
  constructor() {
    this._eventName = 'DEEP_LINK_URL_EVENT';
    this._event = new EventEmitter();
    this._emitTime = 0;
    this._deeplink = '';
    this._params = {};
  }

  addEventListener(cb) {
    this._event.on(this._eventName, (...args) => {
      cb(this._params, ...args);
    });
  }

  invoke(link, ...args) {
    this._emitTime = this._emitTime + 1;
    if (link && typeof link === 'string') {
      this._deeplink = link.replace(/^(.?)+:\?/, '');
      this._params = qs.parse(this._deeplink);
    }
    log.silly(`URL_INVOKE::${this._emitTime}, ${link}, ${this._deeplink}`);
    return this._event.emit(this._eventName, ...args);
  }

  clear() {
    this._event.removeAllListeners(this._eventName);
    this._emitTime = 0;
    this._deeplink = '';
    this._params = {};
  }
}

const emitter = new DeeplinkUrlEmitter();

module.exports.default = module.exports = emitter;
