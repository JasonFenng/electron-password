const path = require('path');
const { app } = require('electron');

const dbPath = path.resolve(app.getPath('userData'), 'yufu.dt');

const vbsPath = path.resolve(app.getPath('cache'), 'tmp.vbs');

exports.DB_PATH = dbPath;
exports.VBS_PATH = vbsPath;

module.exports.default = module.exports;
