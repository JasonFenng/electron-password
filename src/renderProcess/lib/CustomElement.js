class CustomElement {
  static querySelector = (selector, pass = false) => {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) {
      return el;
    }
    if (pass) {
      const shadowElement = document.createElement('div');
      shadowElement.style.height = '0px';
      shadowElement.style.width = '0px';
      document.body.appendChild(shadowElement);
      return shadowElement;
    }
    return null;
  };

  constructor(selector, pass = false) {
    this.selector = selector;
    this.el = CustomElement.querySelector(selector, true);
  }

  on(event) {
    return new Promise((resolve, reject) => {
      if (!this.el) {
        reject(`Element NULL_POINTER SELECTOR::${this.selector}`)
        return
      }
      this.el.addEventListener(event, (...args) => {
        resolve(...args);
      });
    });
  }
}

module.exports = CustomElement;
