const base = require('./base');
const enzyme = require('./enzyme');
const puppeteer = require('./puppeteer');
const getSeleniumWebdriver = require('./seleniumWebdriver');
const pptrFirefox = require('./pptrFirefox');
const webextGeckodriver = require('./webextGeckodriver');

module.exports = {
  ut: base,
  enzymeUT: enzyme,
  enzyme,
  puppeteer,
  pptrFirefox,
  webextGeckodriver,
  chrome: getSeleniumWebdriver('Chrome'),
  ie: getSeleniumWebdriver('Ie'),
  edge: getSeleniumWebdriver('Edge'),
  firefox: getSeleniumWebdriver('Firefox'),
  safari: getSeleniumWebdriver('Safari'),
};
