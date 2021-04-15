const Cipher = require('./Cipher');
const _ = require('lodash');
const log = require('electron-log');
const shortid = require('shortid');
const Ajv = require('ajv');

const winSchema = {
  required: [
    'userId',
    'appId',
    'appName',
    'username',
    'password',
    'path',
    'keySequence',
  ],
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    appId: { type: 'string' },
    appName: { type: 'string' },
    path: { type: 'string' },
    keySequence: { type: 'string' },
    username: { type: 'string' },
    password: { type: 'string' },
  },
};

const macSchema = {
  required: [
    'userId',
    'appId',
    'appName',
    'username',
    'password',
    'appleScript',
  ],
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    appId: { type: 'string' },
    appName: { type: 'string' },
    username: { type: 'string' },
    password: { type: 'string' },
    appleScript: { type: 'string' },
  },
};

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(
  process.platform === 'win32' ? winSchema : macSchema,
);

const getAll = (cipher) => {
  const [error, data] = Cipher.decrypt(cipher);
  if (error) {
    return [error];
  }
  if (!Array.isArray(data)) {
    log.error('[10500::INVALID_DATA]');
    return [
      {
        status: '10500',
        e: new Error(`ERROR::INVALID_DATA`),
      },
    ];
  }
  return [null, data];
};

const find = (cipher, query) => {
  const [error, data] = getAll(cipher);
  const appId = _.get(query, 'appId');
  const userId = _.get(query, 'userId');
  log.silly(`[FIND] ${appId},${userId}`);
  if (error) {
    return [error];
  }
  if (!appId || !userId) {
    log.error('[FIND::ERROR] INVALID_DATA, status :11400');
    return [{ status: '11400', e: new Error(`BAD_QUERY::${appId},${userId}`) }];
  }
  // log.info(JSON.stringify(data));
  const item = data.find(
    (i) => _.get(i, 'appId') === appId && _.get(i, 'userId') === userId,
  );
  if (!item) {
    log.error('[FIND::ERROR] NOT_FOUND, status: 11404');
    return [{ status: '11404', e: new Error(`NOT_FOUND::${appId},${userId}`) }];
  }
  return [null, item];
};

const update = (cipher, id, item) => {
  const [error, data] = getAll(cipher);
  log.silly(`[UPDATE] id: ${id}`);
  if (error) {
    return [error];
  }
  const index = data.findIndex((i) => _.get(i, 'id') === id);
  if (index > -1) {
    const newItem = _.merge(data[index], item);
    data[index] = newItem;
    const [err] = Cipher.encrypt({ data, cipherKey: cipher });
    if (!err) {
      return [null, newItem];
    }
    return [err];
  }
  log.error(`[UPDATE::ERROR] NOT_FOUND, status: 12404, ${id}`);
  return [
    {
      status: '12404',
      e: new Error('NOT_FOUND'),
    },
  ];
};
const create = (cipher, item) => {
  const obj = _.pick(item, [
    'userId',
    'appId',
    'appName',
    'username',
    'password',
    'path',
    'keySequence',
    'appleScript',
  ]);
  log.silly('[CREATE]');
  const valid = validate(obj);
  if (!valid) {
    log.error(
      `[CREATE::ERROR] BAD_REQUEST, status:13400, ${ajv.errorsText(
        validate.errors,
      )}`,
    );
    return [
      {
        status: '13400',
        e: new Error('BAD_REQUEST'),
      },
    ];
  }
  const [error, data] = getAll(cipher);
  if (error) {
    return [error];
  }
  _.set(obj, 'id', shortid.generate());
  data.push(obj);
  const [err] = Cipher.encrypt({ data, cipherKey: cipher });
  if (!err) {
    return [null, obj];
  }
  return [err];
};

exports.find = find;
exports.update = update;
exports.create = create;
module.exports.default = module.exports;
