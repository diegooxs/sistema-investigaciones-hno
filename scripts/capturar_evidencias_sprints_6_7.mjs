import { chromium } from "file:///C:/Users/diego/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.goto("http://localhost:5173/acceso", { waitUntil: "networkidle" });
await page.getByLabel("Correo institucional", { exact: true }).fill("admin@hno.local");
await page.getByLabel("Contraseña", { exact: true }).fill("Admin2027!");
await page.getByRole("button", { name: "Continuar", exact: true }).click();
await page.waitForURL("http://localhost:5173/");

await page.getByRole("button", { name: "Evaluaciones", exact: true }).click();
await page.getByRole("heading", { name: "Dictamen y autorización", exact: true }).waitFor();
await page.screenshot({
  path: "D:\\descargas\\sistema_investigaciones_hno\\docs\\evidencia_sprint6_dictamen_actual.png",
  fullPage: true,
});

await page.getByRole("button", { name: "Publicaciones", exact: true }).click();
await page.getByRole("heading", { name: "Publicación, consulta y reporte", exact: true }).waitFor();
await page.screenshot({
  path: "D:\\descargas\\sistema_investigaciones_hno\\docs\\evidencia_sprint7_publicaciones_reporte_actual.png",
  fullPage: true,
});

await browser.close();
