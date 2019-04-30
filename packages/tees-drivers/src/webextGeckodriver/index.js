const path = require('path');
const assert = require('assert');
const fs_extra = require('fs-extra');
const { exec } = require('child_process');

const webExtensionsGeckoDriver = require('webextensions-geckodriver');
const {webdriver, firefox} = webExtensionsGeckoDriver;
const {
  Builder,
  By,
  until
} = require('selenium-webdriver');

const {
  Driver: BaseDriver,
  Query: BaseQuery
} = require('../base');

class Query extends BaseQuery {
  async getText(selector, options) {
    const element = await this._getElement(selector, options);
    const innerText = element.getAttribute('innerText');
    return innerText;
  }

  async getAttribute(selector, attribute, options = {}) {
    const element = await this._getElement(selector, options);
    const attributeValue = await element.getAttribute(attribute);
    return attributeValue;
  }

  async getProperty(selector, property, options) {
    const propertyValue = await this.getAttribute(selector, property, options);
    return propertyValue;
  }

  async getValue(selector, options) {
    const value = this.getAttribute(selector, 'value', options);
    return value;
  }

  async html(selector) {
    const html = this.getAttribute(selector, 'innerHTML');
    return html;
  }

  async click(selector, options) {
    const element = await this._getElement(selector, options);
    await element.click();
  }

  async type(selector, value, options) {
    const element = await this._getElement(selector, options);
    if (options && options.delay) {
      for (const char of value) {
        await element.sendKeys(char);
        await this.waitFor(options.delay);
      }
    } else {
      await element.sendKeys(value);
    }
  }

  async waitForSelector(selector, options) {
    const element = await this._getElement(selector, options);
    return element;
  }

  async url() {
    return this._node.getCurrentUrl();
  }

  async goto(url) {
    await this._node.get(url);
  }

  async getNewOpenPage() {
    await this.waitFor(3000);
    const handles = await this._node.getAllWindowHandles();
    await this._node.switchTo().window(handles[handles.length - 1]);
    return this._node;
  }

  async clickToGetNewOpenPage(selector, browser, options = {}) {
    await this.click(selector, options);
    await this.waitFor(3000);
    const handles = await this._node.getAllWindowHandles();
    await this._node.switchTo().window(handles[handles.length - 1]);
    return this._node;
  }
    
  async backPreviousPage() {
    const handles = await this._node.getAllWindowHandles();
    if(handles.length > 1 ) {
      await this._node.switchTo().window(handles[handles.length - 2]);
    } else {
      await this._node.switchTo().window(handles[handles.length - 1]);
    }
  }

  async screenshot({
    path
  } = {}) {
    await this._node.takeScreenshot().then((data) => {
      const base64Data = data.replace(/^data:image\/png;base64,/, '');
      fs.writeFile(path, base64Data, 'base64');
    });
  }

  async waitForFrames(frames) {
    for (const frame of frames) {
      const element = await this._node.wait(until.elementLocated(By.css(frame)));
      await this._node.switchTo().frame(element);
    }
    return this._node;
  }

  async execute(...args) {
    let script = args.shift();
    if ((typeof script !== 'string' && typeof script !== 'function')) {
      throw new Error('number or type of arguments don\'t agree with execute protocol command');
    }
    if (typeof script === 'function') {
      script = `return (${script}).apply(null, arguments)`;
    }
    // TODO safari
    const handle = this._node.executeScript(script, args);
    await this.waitFor(100);
    // wait for applying to UI.
    return handle;
  }

  async clear(selector, options) {
    const element = await this._getElement(selector, options);
    element.clear();
  }

  async waitForFunction(...args) {
    const result = await this.execute(...args);
    if (result) return;
    await this.waitFor(250);
    await this.waitForFunction(...args);
  }

  async _getElement(selector, options) {
    const _selector = this.getSelector(selector, options);
    const element = await this._node.wait(until.elementLocated(By.css(_selector)));
    return element;
  }

  async $(selector, options) {
    const _selector = this.getSelector(selector, options);
    const element = this._node.findElement(By.css(_selector));
    return element;
  }

  async $$(selector, options) {
    const _selector = this.getSelector(selector, options);
    const elements = this._node.findElements(By.css(_selector));
    return elements;
  }
}
class Driver extends BaseDriver {
  constructor(options = {}, program = webExtensionsGeckoDriver) {
    super(options, program);
  }

  async run({ configSetting, type, extension = '',executablePath = '' , userDataDir = '', isHeadless } = {}) {
    debugger;
    const extDir = extension.split('.xpi')[0];
    const extensionPath = path.resolve(process.cwd(), extDir);
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
      
    await exec(`unzip -o ${extension} -d ${extensionPath}`, { maxBuffer: 1024 * 500 }, (err, stdout, stderr) => {
        if (err) {
          console.log(err);
          return;
        }
        console.log(`stdout: ${stdout}`);
        console.log(`stderr: ${stderr}`);
      });

    const manifestPath = path.resolve(process.cwd(), `${extDir}/manifest.json`);
    let geckodriver;
    const webExtension = await webExtensionsGeckoDriver(manifestPath);
    geckodriver = webExtension.geckodriver;
    const helper = {
      toolbarButton() {
        return geckodriver.wait(until.elementLocated(
          By.id('integration-for-google-firefox-version_ringcentral_com-browser-action')
        ), 10000);
      }
    };
    debugger;
    const button = await helper.toolbarButton();
    await button.click();
    let handles;
    await geckodriver.wait(async () => {
      handles = await geckodriver.getAllWindowHandles();
      return handles.length === 2;
    }, 20000, 'Should have opened a new tab');
    await geckodriver.switchTo().window(handles[1]);
    const currentUrl = await geckodriver.getCurrentUrl();
    console.log(currentUrl);
    this._browser = geckodriver;
  }

  async newPage() {
    this._page = this._browser;
  }

  async goto(config) {
  if (config.type === 'extension') {
    
  } else {
    await this._browser.get(config.location);
  }
}

  async closePage() {
    await this.close();
  }

  async close() {
    if (this._browser) {
      try {
        await this._browser.close();
      } catch (e) {
        // console.error(e);
      }
      try {
        await this._browser.quit();
      } catch (e) {
        // console.error(e);
      }
    }
  }
}

module.exports = {
  Driver,
  Query,
};
