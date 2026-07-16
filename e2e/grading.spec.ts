import { test, expect } from "@playwright/test";

test.describe("拍照批改流", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="password"]', "123456");
    await page.click("text=/进入系统/");
    await page.waitForURL("/");
  });

  test("进入拍照批改页面", async ({ page }) => {
    await page.click("text=/拍照批改作业/");
    await page.waitForURL("/grading");
    await expect(page.locator("text=/上传作业照片/")).toBeVisible();
  });
});
