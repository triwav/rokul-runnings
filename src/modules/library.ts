import { WebDriver } from "./webdriver";
import { sleep } from "../utils/sleep";
import {
  elementValueParsed,
  appResponse,
  elementDataObject,
  nullValueResponse,
  elementValueRaw,
  elementValueRawAttrs
} from "../types/webdriver";

export enum buttons {
  up = "up",
  down = "down",
  right = "right",
  left = "left",
  back = "back",
  select = "select",
  replay = "replay",
  play = "play",
  stop = "stop",
  rewind = "rewind",
  fast_forward = "fast forward",
  options = "options",
  home = "home"
}

export class Library {
  constructor(
    rokuIPAddress: string,
    timeoutInMillis = 0,
    pressDelayInMillis = 0,
    public driver: WebDriver = new WebDriver(
      rokuIPAddress,
      timeoutInMillis,
      pressDelayInMillis
    )
  ) {
    this.driver = driver;
  }

  /** Closes the session */
  async close() {
    await this.driver.quiet();
  }

  /** Launches the channel corresponding to the specified channel ID. */
  async launchTheChannel(channelCode: string) {
    return await this.driver.sendLaunchChannel(channelCode);
  }

  /** Returns a list of installed channels as an array of objects */
  async getApps() {
    const response = await this.driver.getApps();
    return response.value;
  }

  /** Verifies the specified channel is installed on the device. */
  verifyIsChannelExist(apps: appResponse[], id: string) {
    return !!apps.find(app => app.ID === id);
  }

  /** Verify that the screen is loaded based on the provided element data. */
  async verifyIsScreenLoaded(
    data: elementDataObject,
    maxRetries = 10,
    delayInMillis = 1000
  ) {
    let retries = 0;
    while (retries < maxRetries) {
      const uiLayoutResponse = await this.driver.getUIElementError(data);
      if (uiLayoutResponse.status !== 200) retries++;
      else return true;
      await sleep(delayInMillis);
    }
    return false;
  }

  /** Simulates the press and release of the specified key. */
  async pressBtn(keyPress: string, delayInMillis = 2000) {
    await sleep(delayInMillis);
    return await this.driver.sendKeypress(keyPress);
  }

  /** Simulates the press and release of each letter in a word. */
  async sendWord(word: string, delayInMillis = 2000) {
    await sleep(delayInMillis);
    let wordResponse: { [key: string]: nullValueResponse }[] = [];
    for (let charIndex = 0; charIndex < word.length; charIndex++) {
      await sleep(500);
      let key = word.charAt(charIndex);
      let value = await this.driver.sendKeypress("LIT_" + key);
      wordResponse.push({ key: value });
    }
    return wordResponse;
  }

  /** Simulates the sequence of keypresses and releases. */
  async sendButtonSequence(sequence: buttons[], delayInMillis = 2000) {
    await sleep(delayInMillis);
    return await this.driver.sendSequence(sequence);
  }

  /** Searches for an element on the page based on the specified locator starting from the screen root. Returns information on the first matching element. */
  async getElement(data: elementDataObject, delayInMillis = 1000) {
    await sleep(delayInMillis);
    const response = await this.driver.getUIElement(data);
    const [attributes] = await this.getAllAttributes([response.value]);
    return attributes;
  }

  /** Searches for elements on the page based on the specified locators starting from the screen root. Returns information on the matching elements. */
  async getElements(data: elementDataObject, delayInMillis = 1000) {
    await sleep(delayInMillis);
    const response = await this.driver.getUIElements(data);
    const attributes = await this.getAllAttributes(response);
    return attributes;
  }

  /** Return the element on the screen that currently has focus. */
  async getFocusedElement() {
    const response = await this.driver.getActiveElement();
    const [element] = await this.getAllAttributes([response.value]);
    return element;
  }

  /** Verifies that the Focused Element returned from {@link getFocusedElement} is a RenderableNode */
  async verifyFocusedElementIsRenderableNode(maxRetries = 10) {
    let retries = 0;
    let element: elementValueParsed;
    while (element.XMLName !== "RenderableNode" && retries < maxRetries) {
      const response = await this.driver.getActiveElement();
      [element] = await this.getAllAttributes([response.value]);
      retries++;
    }
    return element.XMLName === "RenderableNode";
  }

  /** Verify that the specified channel has been launched. */
  async verifyIsChannelLoaded({
    id,
    maxRetries = 10,
    delayInMillis = 1000
  }: {
    id: string;
    maxRetries?: number;
    delayInMillis?: number;
  }) {
    let retries = 0;
    while (retries < maxRetries) {
      const response = await this.driver.getCurrentApp();
      if (response.ID != id) retries++;
      else return true;
      await sleep(delayInMillis);
    }
    return false;
  }

  /** Returns an object containing information about the channel currently loaded. */
  async getCurrentChannelInfo() {
    const response = await this.driver.getCurrentApp();
    return response;
  }

  /** Returns an object containing the information about the device. */
  async getDeviceInfo() {
    return await this.driver.getDeviceInfo();
  }

  /** Returns an object containing information about the Roku media player */
  async getPlayerInfo() {
    const response = await this.driver.getPlayerInfo();
    if (typeof response.Position === "string") {
      response.Position = parseInt(response.Position.split(" ")[0]);
    }
    if (typeof response.Duration === "string") {
      response.Duration = parseInt(response.Duration.split(" ")[0]);
    }
    return response;
  }

  /** Verify playback has started on the Roku media player. */
  async verifyIsPlaybackStarted(maxRetries = 10, delayInMillis = 1000) {
    let retries = 0;
    while (retries < maxRetries) {
      const response = await this.driver.getPlayerInfoError();
      if (response.status !== 200) {
        retries++;
      } else if (Object.keys(response.body.value).includes("State")) {
        if (response.body.value["State"] !== "play") {
          retries++;
        } else return true;
        await sleep(delayInMillis);
      }
    }
    return false;
  }

  /** Sets the timeout for Web driver client requests. */
  async setTimeout(timeoutInMillis: number) {
    await this.driver.setTimeouts("implicit", timeoutInMillis);
  }

  /** Sets the delay between key presses. */
  async setDelay(delayInMillis) {
    await this.driver.setTimeouts("pressDelay", delayInMillis);
  }

  /** Returns all elements in an array, with their attributes in Name.Local:Value pairs, and their child nodes in an array. */
  async getAllAttributes(elements: elementValueRaw[]) {
    let allElements: elementValueParsed[] = [];
    for (let i = 0; i < elements.length; i++) {
      let element = elements[i].Attrs;
      let allAttributesForElement: elementValueParsed = await this.parseAttributes(
        element
      );
      if (elements[i].Nodes !== null) {
        allAttributesForElement.Nodes = await this.parseAttributeNodes(
          elements[i].Nodes
        );
      }
      allAttributesForElement.XMLName = elements[i].XMLName.Local;
      allElements[i] = allAttributesForElement;
    }
    return allElements;
  }

  /** Parses the given JSON object and returns it as an object with Name.Local:Value pairs. */
  async parseAttributes(element: elementValueRawAttrs) {
    let parsedElement: elementValueParsed = { XMLName: "", Attrs: {} };
    for (let i = 0; i < element.length; i++) {
      let key = element[i].Name.Local;
      parsedElement.Attrs[key] = element[i].Value;
    }
    return parsedElement;
  }

  /** Resursive function to parse all child nodes of the parent element */
  async parseAttributeNodes(node: elementValueRaw[]) {
    let allAttributesForElement = [];
    for (let i = 0; i < node.length; i++) {
      allAttributesForElement[i] = await this.parseAttributes(node[i].Attrs);
      if (node[i].Nodes !== null) {
        allAttributesForElement[i].Nodes = [];
        for (let j = 0; j < node[i].Nodes.length; j++)
          allAttributesForElement[i].Nodes[j] = await this.parseAttributeNodes(
            node[i].Nodes
          );
      }
    }
    return allAttributesForElement;
  }
}