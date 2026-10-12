import Helpers from 'ralix/src/helpers';

const helpers = new Helpers();
export const find = (selector, scope = document) => scope === document ? helpers.find(selector) : scope.querySelector(selector);
export const findAll = (selector, scope = document) => scope === document ? helpers.findAll(selector) : scope.querySelectorAll(selector);
// Delegating on document preserves native form submission; no button/link default is cancelled by Ralix.
export const on = (element, events, callback, options) => helpers.on(element, events, callback, options);
