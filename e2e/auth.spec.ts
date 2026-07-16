import { test, expect } from "@playwright/test";

test.describe("认证流", () => {
  test("使用演示账号登录并跳转到工作台", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector("text=/进入系统/");

    // 默认选中第一个演示账号
    await page.fill('input[type="password"]', "123456");
    await page.click("text=/进入系统/");

    await page.waitForURL("/");
    await expect(page.locator("text=/下午好/")).toBeVisible();
  });

  test("错误密码不应登录", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="password"]', "wrong-password");
    await page.click("text=/进入系统/");

    await expect(page.locator("text=/账号或密码错误/")).toBeVisible();
  });
});
