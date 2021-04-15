const crypto = require('crypto');
const fs = require('fs');
const log = require('electron-log');
const { DB_PATH } = require('./Configuration');

const CIPHER = 'aes-256-cbc';

function getCipherKey(password) {
  return crypto.createHash('sha256').update(password).digest();
}

function encrypt({ data, cipherKey }) {
  const initVect = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(CIPHER, cipherKey, initVect);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.concat([initVect, Buffer.from(JSON.stringify(data))])),
    cipher.final(),
  ]);
  // 实现1: 直接加密并写入文件；
  try {
    fs.writeFileSync(DB_PATH, encrypted);
  } catch (e) {
    log.error(`OPERATE_FAILED::ENC,WRI,${e}`);
    return [
      {
        status: 'OPERATE_FAILED::ENC,WRI',
        e,
      },
    ];
  }
  return [null];
}

function decrypt(cipherKey) {
  // 实现1：可以通过stream的方式实现，
  // 然而此种方式需要一个类似json-stream的东西将readableStream转化为json，nodejs原生并无此方法
  // 如果使用 writeableStream 写入其他文件，则会暴露用户信息，故没有采纳；
  // const readInitVect = fs.createReadStream(file, { end: 15 });
  // let initVect;
  // readInitVect.on('data', (chunk) => {
  //   initVect = chunk;
  // });
  // readInitVect.on('close', () => {
  //   const cipherKey = getCipherKey(password);
  //   const decipher = crypto.createDecipheriv('aes256', cipherKey, initVect);
  //   const readStream = fs.createReadStream(file, { start: 16 });
  //   const writeStream = fs.createWriteStream(file + '.unenc');
  //   readStream.pipe(decipher).pipe(writeStream);
  //   readStream.on('end', () => {
  //     console.log(new Date().valueOf() - startTime);
  //   });
  // });
  // 实现2：简单直接
  let buffer;
  try {
    buffer = fs.readFileSync(DB_PATH);
  } catch (e) {
    log.error(`OPERATE_FAILED::DNC,RED,${e}`);
    return [
      {
        status: 'OPERATE_FAILED::DEC,RED',
        e,
      },
    ];
  }
  if (!(buffer instanceof Buffer)) {
    log.error(`TYPE_ERROR::DNC,INS`);
    return [
      {
        status: 'TYPE_ERROR::DEC,INS',
        e: new Error('INVALID_DATA'),
      },
    ];
  }
  const initVect = buffer.slice(0, 16);
  const decipher = crypto.createDecipheriv(CIPHER, cipherKey, initVect);
  const data = buffer.slice(16);
  let decrypted;
  try {
    decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    decrypted = JSON.parse(decrypted.toString() || '[]');
  } catch (e) {
    log.error(`OPERATE_FAILED::DEC,DEC,PAR,${e}`);
    return [
      {
        status: 'OPERATE_FAILED',
        e,
      },
    ];
  }
  return [null, decrypted];
}

exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.getCipherKey = getCipherKey;
module.exports.default = module.exports;
