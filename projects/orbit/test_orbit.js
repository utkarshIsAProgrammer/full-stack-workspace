const puppeteer = require('puppeteer');
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  
  const consoleMessages = [];
  const consoleErrors = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    console.log(`[CONSOLE ${type}] ${text}`);
    consoleMessages.push({ type, message: text });
    if (type === 'error' || type === 'warning') {
      consoleErrors.push({ message: `[${type.toUpperCase()}] ${text}` });
    }
  });

  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.message}`);
    consoleErrors.push({ message: `[PAGE ERROR] ${err.message}` });
  });

  try {
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });

    console.log('Clicking Get Started...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const btn = buttons.find(b => b.textContent && (b.textContent.includes('Get Started') || b.textContent.includes('Sign In') || b.textContent.includes('Log in')));
      if (btn) {
        btn.click();
        return true;
      }
      if (buttons.length > 0) {
        buttons[0].click();
        return true;
      }
      return false;
    });

    await sleep(2000);

    console.log('Logging in with qatest1 / QaPass123!...');
    await page.waitForSelector('input', { timeout: 5000 });
    
    const inputs = await page.$$('input');
    if (inputs.length >= 2) {
      await inputs[0].type('qatest1');
      await inputs[1].type('QaPass123!');
    } else if (inputs.length === 1) {
      await inputs[0].type('qatest1');
      const pwdInput = await page.$('input[type="password"]');
      if (pwdInput) await pwdInput.type('QaPass123!');
    }

    // Submit form
    const submitBtn = await page.$('button[type="submit"], form button, button');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    console.log('Waiting ~8 seconds for home feed to load...');
    await sleep(8000);

    await page.screenshot({ path: 'feed_loaded.png' });

    console.log('Looking for glance rings row...');
    const clickedGlance = await page.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll('div, button, span'));
      const potentialRings = allEls.filter(el => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const isCircular = style.borderRadius === '50%' || style.borderRadius === '9999px';
        const hasGradient = style.backgroundImage && style.backgroundImage.includes('gradient');
        return rect.top < 300 && rect.width >= 40 && rect.width <= 100 && rect.height >= 40 && rect.height <= 100 && (isCircular || hasGradient || el.className.includes('story') || el.className.includes('ring') || el.className.includes('glance'));
      });

      if (potentialRings.length > 0) {
        potentialRings[0].click();
        return 'clicked potential ring';
      }

      const avatars = Array.from(document.querySelectorAll('img')).filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.top < 250 && rect.width > 30 && rect.height > 30;
      });
      if (avatars.length > 0) {
        avatars[0].click();
        return 'clicked avatar img';
      }

      return 'none found';
    });

    console.log('Glance click result:', clickedGlance);

    console.log('WAITING 3 seconds for glance viewer...');
    await sleep(3000);

    await page.screenshot({ path: 'glance_viewer.png' });

    const diagnostics = await page.evaluate(() => {
      const mediaEl = document.querySelector('video, img');
      const mediaHtml = mediaEl ? mediaEl.outerHTML : 'No media element found';
      const src = mediaEl ? (mediaEl.getAttribute('src') || mediaEl.src) : null;
      const opacity = mediaEl ? window.getComputedStyle(mediaEl).opacity : null;
      const exists = !!mediaEl;

      const viewerContainer = document.querySelector('[role="dialog"], .fixed, .absolute, [class*="viewer"], [class*="story"]') || document.body;
      const innerHtml = viewerContainer.innerHTML;

      return {
        mediaHtml,
        src,
        opacity,
        exists,
        innerHtmlSnippet: innerHtml.substring(0, 3000)
      };
    });

    console.log('DIAGNOSTICS_JSON:', JSON.stringify(diagnostics, null, 2));
    console.log('CONSOLE_ERRORS_JSON:', JSON.stringify(consoleErrors, null, 2));

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await browser.close();
  }
})();
