const base = require('./base');
const enzyme = require('./enzyme');
const puppeteer = require('./puppeteer');
const getSeleniumWebdriver = require('./seleniumWebdriver');
const pptrFirefox = require('./pptrFirefox');

module.exports = {
  ut: base,
  enzymeUT: enzyme,
  enzyme,
  puppeteer,
  pptrFirefox,
  chrome: getSeleniumWebdriver('Chrome'),
  ie: getSeleniumWebdriver('Ie'),
  edge: getSeleniumWebdriver('Edge'),
  firefox: getSeleniumWebdriver('Firefox'),
  safari: getSeleniumWebdriver('Safari'),
};
