const pptrFirefox = require('puppeteer-firefox');
const path = require('path');
const webExt = require('web-ext').default;
const fs_extra = require('fs-extra');
const { exec } = require('child_process');
const get_port = require('get-port');

const EXTENSION_ID = 'integration-for-google-firefox-version_ringcentral_com-browser-action';

const {
  Driver: BaseDriver,
  Query: BaseQuery
} = require('../base');

const setting = {
  headless: false,
  ignoreHTTPSErrors: true,
  args: [
  ]
};
class Query extends BaseQuery {
  async getText(selector, options = {}) {
    const [ text ] = await this.getTexts(selector, options) || [];
    return text;
  }

  async getNewOpenPage() {
    await this.waitFor(3000);
    const allpages = await this._node.pages();
    return allpages[allpages.length - 1];
  }

  async clickToGetNewOpenPage(selector, browser, options = {}) {
    const openEventPage = new Promise((resolve) => {
      browser.on('targetcreated', (target) => {
        resolve(target.page());
      });
    });
    await this.click(selector, options);
    const eventDetailPage = await openEventPage;
    return eventDetailPage;
  }

  async getTexts(selector, options = {}) {
    const _selector = this.getSelector(selector, options);
    await this.waitForSelector(selector, options);
    const innerTextList = await this._node.$$eval(_selector, nodes => nodes.map(n => n.innerText));
    return innerTextList;
  }

  async getAttribute(selector, attribute, options = {}) {
    const element = await this.waitForSelector(selector, options);
    const attributeValue = await this._node.evaluate(
      (element, attr) => element.getAttribute(attr),
      element, attribute
    );
    return attributeValue;
  }

  async getProperty(selector, property, options) {
    const element = await this.waitForSelector(selector, options);
    const value = await this._node.evaluate(
      (element, property) => element[property],
      element, property
    );
    return value;
  }

  async getValue(selector, options) {
    const value = await this.getProperty(selector, 'value', options);
    return value;
  }

  async html(selector) {
    const _selector = this.getSelector(selector);
    await this.waitForSelector(selector);
    const html = await this._node.$eval(_selector, node => node.innerHTML);
    return html;
  }

  async url() {
    return this._node.url();
  }

  async click(selector, options) {
    await this.waitForSelector(selector, options);
    const _selector = this.getSelector(selector, options);
    await this._node.click(_selector);
  }

  async type(selector, value, options) {
    const _selector = this.getSelector(selector, options);
    await this._node.type(_selector, value, options);
  }

  async waitForSelector(selector, options) {
    const _selector = this.getSelector(selector, options);
    if (!this._node.waitForSelector) return;
    const element = await this._node.waitForSelector(_selector, options);
    return element;
  }

  async waitForFrames(frameSelectors) {
    let frame = this._node;
    for (const frameSelector of frameSelectors) {
      await frame.waitForFunction(`document.querySelector('${frameSelector}')`);
      const name = await frame.evaluate((frameSelector) => {
        const { name, id } = document.querySelector(frameSelector);
        return name || id;
      }, frameSelector);
      frame = this._node.frames().find(frame => frame.name() === name);
    }
    return frame;
  }

  async waitForFunction(fn, ...args) {
    // TODO waitForFunction for `option` compatibility
    await this._node.waitForFunction(fn, {}, ...args);
  }

  async screenshot({ path } = {}) {
    await this._node.screenshot({
      path
    });
  }

  async goto(url, options = {}) {
    await this._node.goto(url, options);
  }

  async execute(...args) {
    const result = await this._node.evaluate(...args);
    return result;
  }

  async clear(selector, options) {
    await this.waitForSelector(selector, options);
    const _selector = this.getSelector(selector, options);
    await this._node.focus(_selector);
    await this._node.$eval(_selector, input => input.select(), _selector);
    if (this._node.keyboard) {
      await this._node.keyboard.press('Delete');
    } else {
      await this._node.evaluate(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Delete' }));
      });
    }
  }

  async $(selector, options) {
    const _selector = this.getSelector(selector, options);
    const element = await this._node.$(_selector);
    return element;
  }

  /**
   * To find an element in html page
   * @param {*} selector: css selector like syntax
   */
  async $$(selector, options) {
    const _selector = this.getSelector(selector, options);
    const elements = await this._node.$$(_selector);
    return elements;
  }
}

class Driver extends BaseDriver {
  constructor(options = {}, program = pptrFirefox) {
    super(options, program);
  }
  async run({ configSetting, type, extension = '', isHeadless } = {}) {
    debugger;
    this._isHeadless = isHeadless;
    const isExtension = type === 'extension';
    const extensionPath = path.resolve(process.cwd(), extension);
    const mergeSetting = {
      ...this._options.driver.setting,
      ...configSetting,
      args: [
        ...this._options.driver.setting.args,
        ...configSetting.args,
      ],
    }

    const setting = isExtension ? {
      ...mergeSetting,
      args: [
        ...mergeSetting.args,
      ],
    } : mergeSetting;
    this._browser = await this._program.launch({
      ...setting,
      headless: isExtension ? false : this._isHeadless,
    });
  }

async launchWithExtension(config) {
  const ext = config.extension;
  const extDir = `../../extension/${config.extname}`;
  const extensionPath = path.resolve(process.cwd(), extDir);
  debugger;
  const CDPPort = await get_port();
  if (await fs_extra.pathExistsSync(extensionPath)) {
    await fs_extra.remove(extensionPath)
      .then(() => {
        console.log('Clean up extension dir Success!');
      }).catch((err) => {
        console.error(err);
      });
  } 
  await fs_extra.mkdir(extensionPath)
    .then(() => {
        console.log('make extension dir Success!');
      }).catch((err) => {
        console.error(err);
      });
    
  await exec(`unzip -o ${ext} -d ${extensionPath}`, { maxBuffer: 1024 * 500 }, (err, stdout, stderr) => {
      if (err) {
        console.log(err);
        return;
      }
      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);
    });

    await webExt.cmd.run({
      sourceDir: extensionPath,
      firefox: pptrFirefox.executablePath(),
      startUrl: 'about:debugging',
      binaryArgs: [
        `-juggler=${CDPPort}`,
      ]
    }, {
      shouldExitProgram: true,
    });

    const browserWSEndpoint = `ws://127.0.0.1:${CDPPort}`;
    this._browser = await pptrFirefox.connect({
      browserWSEndpoint,
    });
  }

  async newPage() {
    this._page = await this._browser.newPage();
  }

  async goto(config) {
    debugger;
    if (config.type === 'extension') {
      const _page =await  browser.newPage();
      await _page.goto('http://www.baidu.com');

      console.log('title',await _page.title());
      await _page.type('#kw','haha');

      await $(this._browser).getNewOpenPage();
    } else {
      await this._page.goto(config.location);
    }
  }

  async closePage() {
    await this._page.close();
    this._page = null;
  }

  async close() {
    if (this._browser) {
      try {
        await this._browser.close();
      } catch (e) {
        console.error(e);
      }
    }
  }
}

module.exports = {
  Driver,
  setting,
  Query,
};
