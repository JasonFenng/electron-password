const _ = require('lodash');

const serializeFormData = (formData) => {
  const obj = {};
  for (let [key, value] of formData.entries()) {
    _.set(obj, key, value);
  }
  return obj;
};

exports.Utils = {
  serializeFormData,
  forceResolve: require('../../common/Tool').forceResolve,
};
exports.CustomElement = require('./CustomElement');

module.exports.default = module.exports;
