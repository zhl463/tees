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

const EXTENSION_TOOL_BAR_ID = 'integration-for-google-firefox-version_ringcentral_com-browser-action';

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
    this.helper = {
      toolbarButton() {
        return geckodriver.wait(until.elementLocated(
          By.id(`${EXTENSION_TOOL_BAR_ID}`)
        ), 10000);
      },
      getHandles() {
        return geckodriver.wait(async() => {
          const handles = await geckodriver.getAllWindowHandles();
          return handles;
        }, 20000);
      },
      waitForElement(id) {
        return geckodriver.wait(until.elementLocated(
          By.id(`${id}`)
        ), 30*1000);
      }
    };
    this._browser = geckodriver;
  }

  async newPage() {
    this._page = this._browser;
  }

  async goto(config) {
    if (config.type === 'extension') {
      const button = await this.helper.toolbarButton();
      await button.click();
      await this._browser.sleep(2*1000);
      const handles = await this.helper.getHandles();
      await this._browser.switchTo().window(handles[1]);
      this._page = this._browser;
      const currentUrl = await this._browser.getCurrentUrl();
      console.log(`currentUrl: ${currentUrl}`);
      debugger;
      const uri = await this._browser.executeScript('document.querySelector(\'[contextmenu="contentAreaContextMenu"]\')._contentPrincipal.siteOrigin');
      await this._browser.switchTo().window(handles[0]);
      await this._browser.executeScript(`window.open(${uuid}/standalong.html)`);
      await this.helper.waitForElement('rc-widget-adapter-frame');
      await this._browser.switchTo().frame(By.id('rc-widget-adapter-frame'));
      await this._browser.click(By.css('[data-sign="loginButton"]'));
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
