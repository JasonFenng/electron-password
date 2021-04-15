const fs = require('fs');
const crypto = require('crypto');
const log = require('electron-log');
const _ = require('lodash');
const Cipher = require('./Cipher');
const { DB_PATH } = require('./Configuration');

class Auth {
  constructor() {
    this._cipherKey = null;
    this.sessionStore = {};
  }
  static hasInitDb = () => {
    return new Promise((resolve, reject) => {
      fs.open(DB_PATH, 'r', (err, fd) => {
        if (err) {
          resolve([false, err]);
          return;
        }
        resolve([true, fd]);
      });
    });
  };

  static getCipherKey = (password) => {
    return crypto.createHash('sha256').update(password).digest();
  };

  set cipher(password) {
    if (this._cipherKey) {
      log.warn('DUPLICATE::OPERATION');
    }
    this._cipherKey = Auth.getCipherKey(password);
    return this._cipherKey;
  }

  get cipher() {
    if (!this._cipherKey) {
      log.error('INVALID_KEY::SET_KEY_FIRST');
    }
    return this._cipherKey;
  }

  set logged(logged) {
    this.sessionStore.logged = !!logged;
    return this;
  }

  get logged() {
    return this.sessionStore.logged;
  }

  verify = async (password) => {
    if (password) {
      this.cipher = Auth.getCipherKey(password);
    }
    if (!this.cipher) {
      return Promise.reject([
        {
          status: 'EMPTY_KEY',
          e: new Error('EMPTY_KEY'),
        },
      ]);
    }
    const [exist] = await Auth.hasInitDb();
    if (!exist) {
      log.silly('FILE_IN_EXIST::A,DO_MORE');
      const [error] = Cipher.encrypt({ data: [], cipherKey: this.cipher });
      if (error) {
        log.error(_.get(error, 'status'), error.e);
        return Promise.resolve([error]);
      }
      return Promise.resolve([null]);
    }
    const [decryptError, data] = Cipher.decrypt(this.cipher);
    if (decryptError) {
      log.error(_.get(decryptError, 'status'), decryptError.e);
      return Promise.resolve([decryptError]);
    }
    return Promise.resolve([null, data]);
  };

  clear() {
    this._cipherKey = null;
    this.sessionStore = {};
  }
}

module.exports.default = module.exports = Auth;
