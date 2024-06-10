export function delay(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
}


export function getNewPageWhenLoaded(browser) {
    return new Promise((x) => browser.once('targetcreated', async (target) => {
        const newPage = await target.page();
        const newPagePromise = new Promise(() => newPage.once('domcontentloaded', () => x(newPage)));
        const isPageLoaded = await newPage.evaluate(() => document.readyState);
        return isPageLoaded.match('complete|interactive') ? x(newPage) : newPagePromise;
    }));
}

export async function firstTimeInit(page, d){
    await delay(500);
    const activeTab = await page.$('div.tab.expanded');
    const activeTabId = await page.evaluate(el => el.getAttribute("id"), activeTab);
    const activeCard = await activeTab.$('div.card.active');
    expect(activeTabId).toBe("settings-tab");

    await delay(d);
    await page.type("div.tab.expanded div.card.active input.pinInput", '123', {delay:50})
    page.keyboard.press('Enter')
    await delay(d);
    page.keyboard.down('Alt')
    page.keyboard.press('n')
    page.keyboard.up('Alt')
    await delay(d);
    expect(await page.$eval("div#seedStrength", x => x.innerHTML))
        .toBe("<span style=\"color:white\"> <span class=\"emoji\"> 💡 </span> Think about a memorable sentence</span>")
    await page.keyboard.type("this is a test seed", {delay:50})
    expect(await page.$eval("div#seedStrength", x => x.innerHTML))
        .toBe("<span style=\"color:orange\"> <span class=\"emoji\"> 😟 </span> We are getting somewhere</span>")
    page.keyboard.down('Alt')
    page.keyboard.press('s')
    page.keyboard.up('Alt')
    await delay(d);
    page.click("div.tab.expanded div.card.active div.button.passphrase-confirm")
    await delay(d)
}