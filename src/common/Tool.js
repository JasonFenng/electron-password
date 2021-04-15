const forceResolve = (promiseInstance) => {
  if (promiseInstance instanceof Promise) {
    return promiseInstance.then((...args) => [null, ...args]).catch((e) => [e]);
  }
  return Promise.reject([new Error('INVALID_PROMISE')]);
};

exports.forceResolve = forceResolve;

module.exports.default = module.exports;
