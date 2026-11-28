import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir: './specs',
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: [['list'],['html',{outputFolder:'../../quality-results/browser-html',open:'never'}],['junit',{outputFile:'../../quality-results/browser.xml'}]],
  use: {baseURL:'http://127.0.0.1:4173',locale:'pt-BR',trace:'retain-on-failure',screenshot:'only-on-failure'},
  outputDir:'../../quality-results/browser-artifacts',
  webServer:{command:'npm --prefix ../.. run dev -- --host 127.0.0.1 --port 4173 --strictPort',url:'http://127.0.0.1:4173',timeout:120000,reuseExistingServer:false},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['Pixel 7']}}]
});
