import { expect, test } from '@playwright/test';

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
  await page.getByLabel('日期').fill('2026-07-25');
  await page.getByLabel('下午').check();
  await page.getByLabel('晚上').check();
  await page.getByRole('button', { name: '看电影' }).click();
  await page.getByLabel('想说的话').fill('一起去看新上映的电影');
  await page.getByRole('button', { name: '发送约会邀请' }).click();

  await expect(page.getByRole('heading', { name: '我的安排' })).toBeVisible();
  await page.getByRole('button', { name: '切换身份' }).click();
  await page.getByLabel('专属口令').fill('2021121');
  await page.getByRole('button', { name: '进入我们的日历' }).click();
  await page.getByRole('button', { name: '我是她' }).click();

  await page.getByLabel('1 条未读提醒').click();
  await page.getByRole('button', { name: /新的约会邀请/ }).click();
  await expect(page.getByRole('heading', { name: '看电影' })).toBeVisible();
  await page.getByRole('button', { name: '确认约会' }).click();

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

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);

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

  const narrowDimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(narrowDimensions.content).toBeLessThanOrEqual(narrowDimensions.viewport);
});
