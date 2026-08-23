const {defineConfig}=require('@playwright/test');

module.exports=defineConfig({
  testDir:'./tests/e2e',
  timeout:30000,
  retries:1,
  workers:1,
  reporter:'list',
  use:{
    baseURL:'http://127.0.0.1:4173',
    browserName:'chromium',
    locale:'pt-BR',
    timezoneId:'America/Sao_Paulo',
    serviceWorkers:'block',
    acceptDownloads:true,
    trace:'retain-on-failure'
  }
});
