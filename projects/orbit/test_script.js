const { chromium } = require('/usr/share/vscodium/resources/app/node_modules/playwright-core');
(async () => {
  const consoleErrors = [];
  try {
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ message: msg.text(), url: page.url() });
      }
    });

    await page.goto('http://localhost:5173/');
    console.log('Title:', await page.title());
    await page.waitForTimeout(1000);
    
    // Check if login is present
    const loginInput = await page.$('input[name="username"], input[placeholder*="username"], input[type="text"]');
    if (loginInput) {
      console.log('Login page detected');
      await page.fill('input[type="text"], input[name="username"]', 'qatest1');
      await page.fill('input[type="password"]', 'Test1234!');
      const submitBtn = await page.$('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
      if (submitBtn) await submitBtn.click();
      await page.waitForTimeout(2000);
    }
    
    console.log('Current URL after login attempt:', page.url());

    // Go to Messages tab
    const messagesTab = await page.$('text=Messages, [aria-label="Messages"], a[href*="message"], button:has-text("Messages")');
    if (messagesTab) {
      await messagesTab.click();
      await page.waitForTimeout(1000);
    } else {
      const navItems = await page.$$('nav a, nav button, aside a, aside button');
      for (const item of navItems) {
        const text = await item.textContent();
        if (text && text.toLowerCase().includes('message')) {
          await item.click();
          break;
        }
      }
      await page.waitForTimeout(1000);
    }

    console.log('URL after messages:', page.url());

    // Open first conversation
    const firstConv = await page.$('.conversation-item, [class*="conversation"], [class*="chat-item"], div[role="button"]');
    if (firstConv) {
      await firstConv.click();
      await page.waitForTimeout(1000);
    }

    // Find message input field
    const chatInput = await page.$('textarea, div[contenteditable="true"], input[placeholder*="message"], input[placeholder*="Type"]');
    if (!chatInput) {
      const html = await page.content();
      console.log('Could not find chat input. Page content snippet:', html.substring(0, 1000));
    } else {
      console.log('Found chat input!');
      const longText = 'This is a very long text with spaces used to test whether the chat composer auto-growing mechanism correctly wraps text across multiple lines instead of scrolling horizontally or staying at a single line height.';
      
      await chatInput.fill(longText);
      await page.waitForTimeout(500);

      const height1 = await chatInput.evaluate(el => el.getBoundingClientRect().height);
      console.log('Height after 200 chars:', height1);

      await chatInput.press('Shift+Enter');
      await chatInput.type('second line');
      await page.waitForTimeout(500);

      const height2 = await chatInput.evaluate(el => el.getBoundingClientRect().height);
      console.log('Height after Shift+Enter + second line:', height2);

      await chatInput.press('Enter');
      await page.waitForTimeout(1000);

      const lastBubble = await page.$('.message-bubble:last-of-type, [class*="message"]:last-of-type');
      let bubbleHtml = '';
      if (lastBubble) {
        bubbleHtml = await lastBubble.innerHTML();
        console.log('Last message bubble HTML:', bubbleHtml);
      }

      console.log('SUCCESS_METRICS:', JSON.stringify({ height1, height2, bubbleHtml, consoleErrors }));
    }

    await browser.close();
  } catch (err) {
    console.error('Error during script:', err);
    console.log('SUCCESS_METRICS_ERROR:', JSON.stringify({ error: err.message, consoleErrors }));
  }
})();
