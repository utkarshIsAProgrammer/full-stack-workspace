import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
    console.log('Page title:', await page.title());

    // Wait for login form or input
    // Let's see what is on the page
    const content = await page.content();
    console.log('Page content length:', content.length);

    // Take screenshot
    await page.screenshot({ path: 'screenshot1.png' });

    // Try finding login inputs
    // Username 'test', password 'Test1234!'
    // Let's dump all buttons and inputs
    const inputs = await page.$$eval('input', els => els.map(el => ({ name: el.name, placeholder: el.placeholder, type: el.type, id: el.id })));
    console.log('Inputs:', inputs);

    const buttons = await page.$$eval('button, a', els => els.map(el => ({ text: el.innerText.trim(), tag: el.tagName })));
    console.log('Buttons/Links:', buttons.filter(b => b.text.length > 0));

    // If there is a sign in button or tab, click it
    // Let's check if sign in button exists
    const signInBtn = await page.$('button, a');
    for (const el of await page.$$('button, a')) {
      const text = await el.evaluate(node => node.innerText);
      if (text.toLowerCase().includes('sign in') || text.toLowerCase().includes('log in') || text.toLowerCase().includes('login')) {
        console.log('Found login/sign in element:', text);
        await el.click();
        await new Promise(r => setTimeout(r, 1000));
        break;
      }
    }

    await page.screenshot({ path: 'screenshot2.png' });

    // Now fill username and password
    // Let's find inputs again
    const usernameInput = await page.$('input[name="username"], input[type="text"], input:not([type="password"])');
    const passwordInput = await page.$('input[type="password"]');

    if (usernameInput && passwordInput) {
      await usernameInput.type('test');
      await passwordInput.type('Test1234!');
      console.log('Filled credentials');
      await page.screenshot({ path: 'screenshot3.png' });

      // Click submit
      const submitBtn = await page.$('button[type="submit"], form button, button');
      if (submitBtn) {
        await submitBtn.click();
        await new Promise(r => setTimeout(r, 2000));
      }
    } else {
      console.log('Could not find username/password inputs');
      // Let's check inputs again
      const allInputs = await page.$$eval('input', els => els.map(el => ({ name: el.name, placeholder: el.placeholder, type: el.type, id: el.id, class: el.className })));
      console.log('All inputs:', allInputs);
    }

    await page.screenshot({ path: 'screenshot4.png' });
    console.log('Current URL:', page.url());

    // 1. Report whether bell / notifications icon shows a red badge with a number
    // Let's find notification icon / bell
    const notificationBadgeInfo = await page.evaluate(() => {
      const bellIcons = Array.from(document.querySelectorAll('svg, button, a, div')).filter(el => {
        const text = el.innerText || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const className = typeof el.className === 'string' ? el.className : '';
        return ariaLabel.toLowerCase().includes('notification') ||
               ariaLabel.toLowerCase().includes('bell') ||
               className.toLowerCase().includes('bell') ||
               className.toLowerCase().includes('notification') ||
               el.querySelector('svg.lucide-bell, svg.lucide-bell-ring') !== null;
      });

      return bellIcons.map(el => ({
        outerHTML: el.outerHTML.substring(0, 200),
        text: el.innerText,
        ariaLabel: el.getAttribute('aria-label'),
        hasBadge: el.querySelector('.badge, [class*="badge"], [class*="red"], span') !== null,
        badgeText: el.querySelector('.badge, [class*="badge"], [class*="red"], span')?.innerText
      }));
    });

    console.log('Notification info elements:', notificationBadgeInfo);

    // Let's find the bell button specifically and click it
    const bellButton = await page.$('button[aria-label*="Notification"], button[aria-label*="bell"], a[href*="notification"], .lucide-bell, [data-testid*="notification"]');
    if (!bellButton) {
      // search buttons containing bell or notification
      const buttons = await page.$$('button, a');
      for (const btn of buttons) {
        const html = await btn.evaluate(node => node.outerHTML);
        if (html.includes('bell') || html.includes('notification')) {
          console.log('Clicking bell/notification button:', html);
          await btn.click();
          break;
        }
      }
    } else {
      await bellButton.click();
    }

    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: 'screenshot_notifications.png' });

    // 3. Report EXACTLY what is on the notifications page - list items, 'All quiet here' empty state, or an error message. Quote any visible text.
    const notificationsContent = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      return {
        text: main.innerText,
        html: main.innerHTML
      };
    });

    console.log('Notifications page text:\n', notificationsContent.text);

    // 4. Report how filter tabs (All, Likes, Comments...) look - are they in one line, wrapping, or scrolling horizontally?
    const filterTabsInfo = await page.evaluate(() => {
      const tabsContainer = document.querySelector('[class*="tab"], [class*="filter"], nav');
      const tabs = Array.from(document.querySelectorAll('button, [role="tab"], a')).filter(el => {
        const t = el.innerText.trim().toLowerCase();
        return t === 'all' || t === 'likes' || t === 'comments' || t === 'mentions' || t === 'follows';
      });

      if (tabs.length === 0) return { found: false };

      const parent = tabs[0].parentElement;
      const parentStyle = window.getComputedStyle(parent);
      
      return {
        found: true,
        parentDisplay: parentStyle.display,
        parentFlexWrap: parentStyle.flexWrap,
        parentOverflowX: parentStyle.overflowX,
        tabs: tabs.map(t => ({
          text: t.innerText.trim(),
          rect: t.getBoundingClientRect()
        }))
      };
    });

    console.log('Filter tabs info:', JSON.stringify(filterTabsInfo, null, 2));
    console.log('Console errors:', consoleErrors);

  } catch (err) {
    console.error('Error in puppeteer script:', err);
  } finally {
    await browser.close();
  }
})();
