import { expect, test, type Page } from '@playwright/test';

const mobileViewports = [
  { width: 390, height: 844 },
  { width: 320, height: 844 },
];

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.documentClientWidth);
  expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.documentClientWidth);
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
}

async function expectNoHorizontalOverflowAtMobileWidths(page: Page) {
  for (const viewport of mobileViewports) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
  }
}

test('both partners can complete a date invitation', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('专属口令').fill('2021121');
  await page.getByRole('button', { name: '进入我们的日历' }).click();
  const himIdentityButton = page.getByRole('button', { name: '我是他' });
  const herIdentityButton = page.getByRole('button', { name: '我是她' });
  const [himIdentityBox, herIdentityBox] = await Promise.all([
    himIdentityButton.boundingBox(),
    herIdentityButton.boundingBox(),
  ]);

  if (!himIdentityBox || !herIdentityBox) {
    throw new Error('Identity options must be visible after unlocking.');
  }

  expect(Math.abs(himIdentityBox.width - herIdentityBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(himIdentityBox.height - herIdentityBox.height)).toBeLessThanOrEqual(1);
  await himIdentityButton.click();

  await expect(page.getByRole('grid', { name: '共享月历' })).toBeVisible();
  await page.getByRole('link', { name: '发起约会' }).click();
  await expectNoHorizontalOverflow(page);
  await page.getByLabel('日期').fill('2026-07-25');
  await page.getByLabel('下午').check();
  await page.getByLabel('晚上').check();
  await page.getByRole('button', { name: '看电影' }).click();
  await page.getByLabel('想说的话').fill('一起去看新上映的电影');
  await page.getByRole('button', { name: '发送约会邀请' }).click();

  await expect(page.getByRole('heading', { name: '我的安排' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: '切换身份' }).click();
  await page.getByLabel('专属口令').fill('2021121');
  await page.getByRole('button', { name: '进入我们的日历' }).click();
  await page.getByRole('button', { name: '我是她' }).click();

  await page.getByLabel('1 条未读提醒').click();
  await page.getByRole('button', { name: /新的约会邀请/ }).click();
  await expect(page.getByRole('heading', { name: '看电影' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: '建议调整' }).click();
  await expectNoHorizontalOverflow(page);

  const selectedActivity = page.getByRole('button', { name: '看电影' });
  const unselectedActivity = page.getByRole('button', { name: '一起吃饭' });
  await expect(selectedActivity).toHaveAttribute('aria-pressed', 'true');
  await expect(unselectedActivity).toHaveAttribute('aria-pressed', 'false');

  const selectedStyle = await selectedActivity.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, color: style.color };
  });
  const unselectedStyle = await unselectedActivity.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, color: style.color };
  });
  expect(unselectedStyle.backgroundColor).not.toBe(selectedStyle.backgroundColor);
  expect(unselectedStyle.color).not.toBe(selectedStyle.color);

  await unselectedActivity.click();
  await expect(unselectedActivity).toHaveAttribute('aria-pressed', 'true');
  const newlySelectedStyle = await unselectedActivity.evaluate((element) => {
    const style = getComputedStyle(element);
    return { backgroundColor: style.backgroundColor, color: style.color };
  });
  expect(newlySelectedStyle).toEqual(selectedStyle);

  await page.getByRole('button', { name: '发送调整建议' }).click();
  await expect(page.getByLabel('最新调整建议')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: '切换身份' }).click();
  await page.getByLabel('专属口令').fill('2021121');
  await page.getByRole('button', { name: '进入我们的日历' }).click();
  await page.getByRole('button', { name: '我是他' }).click();
  await page.getByLabel('1 条未读提醒').click();
  await page.getByRole('button', { name: /新的调整建议/ }).click();
  await expect(page.getByLabel('最新调整建议')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('button', { name: '接受调整' }).click();

  await expect(page.getByText('已确认', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('已确认', { exact: true })).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: '年', exact: true }).click();
  await expect(page.getByRole('heading', { name: /年/ }).first()).toBeVisible();
  await page.getByRole('button', { name: '5年' }).click();
  await expect(page.getByRole('heading', { name: /-/ }).first()).toBeVisible();
});

test('mobile layout does not overflow horizontally', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.getByLabel('专属口令').fill('2021121');
  await page.getByRole('button', { name: '进入我们的日历' }).click();
  const himIdentityButton = page.getByRole('button', { name: '我是他' });
  const herIdentityButton = page.getByRole('button', { name: '我是她' });
  const [himIdentityBox, herIdentityBox] = await Promise.all([
    himIdentityButton.boundingBox(),
    herIdentityButton.boundingBox(),
  ]);

  if (!himIdentityBox || !herIdentityBox) {
    throw new Error('Identity options must be visible after unlocking.');
  }

  expect(Math.abs(himIdentityBox.y - herIdentityBox.y)).toBeLessThanOrEqual(1);
  expect(himIdentityBox.x).not.toBe(herIdentityBox.x);
  expect(Math.abs(himIdentityBox.width - herIdentityBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(himIdentityBox.height - herIdentityBox.height)).toBeLessThanOrEqual(1);

  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 320, height: 844 });
  const [narrowHimIdentityBox, narrowHerIdentityBox] = await Promise.all([
    himIdentityButton.boundingBox(),
    herIdentityButton.boundingBox(),
  ]);

  if (!narrowHimIdentityBox || !narrowHerIdentityBox) {
    throw new Error('Identity options must remain visible at narrow widths.');
  }

  expect(Math.abs(narrowHimIdentityBox.x - narrowHerIdentityBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(narrowHimIdentityBox.y - narrowHerIdentityBox.y)).toBeGreaterThan(1);
  expect(Math.abs(narrowHimIdentityBox.width - narrowHerIdentityBox.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(narrowHimIdentityBox.height - narrowHerIdentityBox.height)).toBeLessThanOrEqual(1);

  await expectNoHorizontalOverflow(page);
});

test('mobile multi-activity booking pages do not overflow horizontally', async ({ page }) => {
  const longCustomActivity = '沿着梧桐树散步再去看独立电影节的特别放映';
  const longAdjustmentActivity = '一起去新开的沉浸式数字艺术展览馆慢慢逛';

  await page.setViewportSize(mobileViewports[0]);
  await page.goto('/');
  await page.getByLabel('专属口令').fill('2021121');
  await page.getByRole('button', { name: '进入我们的日历' }).click();
  await page.getByRole('button', { name: '我是他' }).click();
  await page.getByRole('link', { name: '发起约会' }).click();

  await page.getByLabel('日期').fill('2026-07-25');
  await page.getByLabel('晚上').check();
  await page.getByRole('button', { name: '一起吃饭' }).click();
  await page.getByRole('button', { name: '看电影' }).click();
  await page.getByRole('button', { name: '自定义' }).click();
  await page.getByLabel('自定义活动').fill(longCustomActivity);
  await expect(page.getByLabel('自定义活动')).toHaveValue(longCustomActivity);
  await expectNoHorizontalOverflowAtMobileWidths(page);

  await page.getByRole('button', { name: '发送约会邀请' }).click();
  await expect(page.getByRole('heading', { name: '我的安排' })).toBeVisible();
  await expect(page.getByText(longCustomActivity, { exact: true })).toBeVisible();
  await expectNoHorizontalOverflowAtMobileWidths(page);

  await page.getByRole('button', { name: '切换身份' }).click();
  await page.getByLabel('专属口令').fill('2021121');
  await page.getByRole('button', { name: '进入我们的日历' }).click();
  await page.getByRole('button', { name: '我是她' }).click();
  await page.getByRole('link', { name: '我的安排' }).click();
  await expect(page.getByText(longCustomActivity, { exact: true })).toBeVisible();
  await expectNoHorizontalOverflowAtMobileWidths(page);

  await page.getByRole('button', { name: new RegExp(longCustomActivity) }).click();
  await expect(page.getByText(longCustomActivity, { exact: true })).toBeVisible();
  await expectNoHorizontalOverflowAtMobileWidths(page);

  await page.getByRole('button', { name: '建议调整' }).click();
  await page.getByLabel('自定义活动').fill(longAdjustmentActivity);
  await expect(page.getByLabel('自定义活动')).toHaveValue(longAdjustmentActivity);
  await expectNoHorizontalOverflowAtMobileWidths(page);

  await page.getByRole('button', { name: '发送调整建议' }).click();
  const latestAdjustment = page.getByLabel('最新调整建议');
  await expect(latestAdjustment).toBeVisible();
  await expect(latestAdjustment.getByText(longAdjustmentActivity, { exact: true })).toBeVisible();
  await expectNoHorizontalOverflowAtMobileWidths(page);
});
