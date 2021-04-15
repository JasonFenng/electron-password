const _ = require('lodash');
const { ipcRenderer } = require('electron');
const { Utils, Events } = require('./mainProcess/lib');

process.once('loaded', () => {
  console.log('preload loaded');
  // add variable to window;
  window.Utils = Utils;
  window._ = _;
  window.__GLOBAL_EVENT_TYPES = Events.EVENT_TYPES;

  // add communicate bridge

  // listen message from render-process
  //
  window.addEventListener('message', function (e) {
    const message = e.data || {};
    const { type, data, params } = message;
    switch (type) {
      case __GLOBAL_EVENT_TYPES.SHARE_GLOBAL_DATA:
        break;
      default:
        break;
    }
    ipcRenderer.invoke(type, data, params);
  });

  // pass event to render-process
  // share global data to renderProcess
  ipcRenderer.on(Events.EVENT_TYPES.SHARE_GLOBAL_DATA, (e, data, ...args) => {
    window.postMessage({
      type: Events.EVENT_TYPES.SHARE_GLOBAL_DATA,
      data,
      params: [...args],
    });
  });

  ipcRenderer.on(Events.EVENT_TYPES.MODIFY_GLOBAL_DATA, (e, data, ...args) => {
    window.postMessage({
      type: Events.EVENT_TYPES.MODIFY_GLOBAL_DATA,
      data,
      params: [...args],
    });
  });
});
