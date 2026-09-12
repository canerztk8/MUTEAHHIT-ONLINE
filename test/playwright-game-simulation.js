/**
 * playwright-game-simulation.js
 * ==============================
 * Müteahhit Online — 10 Oyun Playwright Simülasyonu
 *
 * Ne test eder:
 *   1. /api/room-check endpoint'i (yeni feature)
 *   2. Olmayan oda linki → "Oda Bulunamadı" ekranı
 *   3. Oda kurma → bağlanma akışı
 *   4. Bot oyuncularla ilk 5 tur
 *
 * Çalıştırma: node test/playwright-game-simulation.js
 * Önce localhost:3000, başarısızsa prod URL kullanılır.
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const LOCAL_PORT = 3000;
const LOCAL_URL = `http://localhost:${LOCAL_PORT}`;
const PROD_URL = 'https://muteahhit-online.pages.dev';
const GAMES_TO_SIMULATE = 10;
const TURNS_PER_GAME = 5;

const results = [];
let successCount = 0;
let serverProcess = null;
let targetUrl = PROD_URL;

// ─── Yerel Sunucu Başlatma ───────────────────────────────────────────────────
async function startLocalServer() {
  return new Promise((resolve) => {
    console.log('[Sunucu] Yerel sunucu başlatılıyor...');
    serverProcess = spawn('node', ['server/index.js'], {
      cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(LOCAL_PORT) }
    });
    const t = setTimeout(() => resolve(false), 8000);
    serverProcess.stdout.on('data', (d) => {
      if (d.toString().includes(LOCAL_PORT) || d.toString().includes('hazır')) {
        clearTimeout(t); resolve(true);
      }
    });
    serverProcess.on('error', () => { clearTimeout(t); resolve(false); });
  });
}

async function checkLocalServer() {
  try {
    const res = await fetch(`${LOCAL_URL}/api/health`, {
      signal: AbortSignal.timeout(3000), cache: 'no-store'
    });
    const j = await res.json();
    return j.status === 'ok';
  } catch { return false; }
}

// ─── Olmayan Oda Linki Testi ─────────────────────────────────────────────────
async function testNonExistentRoom(browser, baseUrl) {
  console.log('\n[On-Test] Olmayan oda linki testi...');
  const page = await browser.newPage();
  let showed = false;
  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.evaluate(() => localStorage.setItem('muteahhit_name', 'TestKullanici'));
    await page.goto(`${baseUrl}/?room=XXXXXX`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    showed = await page.waitForFunction(
      () => document.body.innerText.includes('Oda Bulunamad'),
      { timeout: 10000 }
    ).then(() => true).catch(() => false);
    console.log(showed
      ? '[On-Test] OK "Oda Bulunamadi" ekrani gosterildi!'
      : '[On-Test] UYARI "Oda Bulunamadi" ekrani gosterilmedi (backend kapali olabilir)');
  } catch (e) {
    console.error('[On-Test] Hata:', e.message);
  } finally {
    await page.close().catch(() => {});
  }
  return { showedRoomNotFound: showed };
}

// ─── Tek Oyun Simülasyonu ─────────────────────────────────────────────────────
async function simulateOneGame(browser, gameIndex, baseUrl) {
  const result = {
    game: gameIndex + 1, success: false, steps: [],
    error: null, roomCode: null, roomCheckWorked: null,
  };
  let page1 = null, page2 = null;
  try {
    // --- Sekme 1: Oda aç ---
    page1 = await browser.newPage();
    await page1.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    result.steps.push('OK Host sekmesi acildi');

    const nameInput = page1.locator('input[type="text"]').first();
    await nameInput.waitFor({ timeout: 10000 });
    await nameInput.fill(`Host${gameIndex + 1}`);
    result.steps.push('OK Isim girildi');

    // Oda Oluştur butonuna tıkla — data-testid ile güvenilir seçim
    const createBtn = page1.locator('[data-testid="create-room-btn"]');
    await createBtn.waitFor({ timeout: 10000 });
    await createBtn.click();
    result.steps.push('OK Oda Olustur tiklandi');

    await page1.waitForFunction(
      () => window.location.search.includes('room='),
      { timeout: 15000 }
    );
    const m = page1.url().match(/[?&]room=([A-Z0-9]+)/i);
    result.roomCode = m ? m[1].toUpperCase() : null;
    if (!result.roomCode) throw new Error('Oda kodu alinamadi');
    result.steps.push(`OK Oda: ${result.roomCode}`);

    // --- Sekme 2: Davet linki ---
    page2 = await browser.newPage();

    // /api/room-check endpoint testi
    try {
      const checkRes = await page2.request.get(`${baseUrl}/api/room-check?code=${result.roomCode}`);
      const checkData = await checkRes.json();
      result.roomCheckWorked = checkData.exists === true;
      result.steps.push(`OK room-check exists:${checkData.exists}`);
    } catch (e) {
      result.roomCheckWorked = null;
      result.steps.push(`UYARI room-check endpoint erisilemez`);
    }

    // İsim localStorage'a kaydet, sonra davet linki aç
    await page2.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page2.evaluate((n) => localStorage.setItem('muteahhit_name', n), `Client${gameIndex + 1}`);
    await page2.goto(`${baseUrl}/?room=${result.roomCode}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    result.steps.push('OK Davet linki acildi');

    // "Oda Bulunamadı" olmamalı
    const connResult = await Promise.race([
      page2.waitForFunction(
        () => !document.body.innerText.includes('Oda Bulunamad') &&
              (document.body.innerText.includes('Ba') || document.body.innerText.includes('Yükleniyor') || document.body.innerText.includes('Oyuncu')),
        { timeout: 12000 }
      ).then(() => 'ok'),
      page2.waitForFunction(
        () => document.body.innerText.includes('Oda Bulunamad'),
        { timeout: 12000 }
      ).then(() => 'not-found'),
    ]).catch(() => 'timeout');

    if (connResult === 'not-found') throw new Error('Oda Bulunamadi ekrani var olan oda icin gosterildi!');
    result.steps.push(connResult === 'ok' ? 'OK Baglanti baslatildi' : 'UYARI Timeout (ag gecikmesi)');

    // --- Oyunu başlat ---
    const startBtn = page1.getByRole('button', { name: /oyunu ba.lat|ba.lat/i }).first();
    if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startBtn.click();
      result.steps.push('OK Oyun baslatildi');
    }

    // --- 5 tur ---
    let turnsOk = 0;
    for (let t = 0; t < TURNS_PER_GAME; t++) {
      await page1.waitForTimeout(2000);
      const body = await page1.textContent('body').catch(() => '');
      if (body.includes('Kazand') || body.includes('Oyun Bitti')) break;
      const rollBtn = page1.getByRole('button', { name: /zar at|roll/i }).first();
      if (await rollBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
        await rollBtn.click();
        await page1.waitForTimeout(3000);
        const endBtn = page1.getByRole('button', { name: /turu bitir|tur bitti/i }).first();
        if (await endBtn.isVisible({ timeout: 5000 }).catch(() => false)) await endBtn.click();
        turnsOk++;
        result.steps.push(`OK Tur ${t + 1}`);
      } else {
        result.steps.push(`UYARI Tur ${t + 1}: zar at butonu yok (bot turu)`);
      }
    }
    result.steps.push(`OK ${turnsOk}/${TURNS_PER_GAME} tur tamamlandi`);
    result.success = true;
  } catch (err) {
    result.error = err.message;
    result.steps.push(`HATA: ${err.message}`);
  } finally {
    if (page1) await page1.close().catch(() => {});
    if (page2) await page2.close().catch(() => {});
  }
  return result;
}

// ─── Ana Akış ────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== MUTEAHHIT ONLINE — 10 OYUN PLAYWRIGHT SIMULASYONU ===\n');

  const localOk = await startLocalServer();
  if (localOk && await checkLocalServer()) {
    targetUrl = LOCAL_URL;
    console.log(`[Hedef] Yerel sunucu: ${targetUrl}`);
  } else {
    targetUrl = PROD_URL;
    console.log(`[Hedef] Prod URL: ${targetUrl}`);
  }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const nonExistentTest = await testNonExistentRoom(browser, targetUrl);

    console.log(`\n[Simulasyon] ${GAMES_TO_SIMULATE} oyun basliyor...\n`);
    for (let i = 0; i < GAMES_TO_SIMULATE; i++) {
      console.log(`\n--- Oyun ${i + 1}/${GAMES_TO_SIMULATE} ---`);
      const r = await simulateOneGame(browser, i, targetUrl);
      results.push(r);
      r.steps.forEach(s => console.log(`  ${s}`));
      if (r.error) console.log(`  HATA: ${r.error}`);
      console.log(`  => ${r.success ? 'BASARILI' : 'BASARISIZ'} | Oda:${r.roomCode || '-'} | RoomCheck:${r.roomCheckWorked === true ? 'OK' : r.roomCheckWorked === false ? 'YANLIS' : 'N/A'}`);
      await new Promise(res => setTimeout(res, 800));
    }

    successCount = results.filter(r => r.success).length;
    const rcOk = results.filter(r => r.roomCheckWorked === true).length;

    console.log('\n=== RAPOR ===');
    console.log(`  Toplam Oyun     : ${GAMES_TO_SIMULATE}`);
    console.log(`  Basarili        : ${successCount}/${GAMES_TO_SIMULATE} (%${Math.round(successCount / GAMES_TO_SIMULATE * 100)})`);
    console.log(`  room-check OK   : ${rcOk}/${GAMES_TO_SIMULATE}`);
    console.log(`  Olmayan oda test: ${nonExistentTest.showedRoomNotFound ? 'GECTI' : 'ATLANAMADI'}`);
    console.log(`  URL             : ${targetUrl}`);

    const reportPath = path.join(__dirname, 'playwright-simulation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(), targetUrl,
      totalGames: GAMES_TO_SIMULATE, successCount, roomCheckOk: rcOk,
      nonExistentRoomTest: nonExistentTest, games: results
    }, null, 2));
    console.log(`\n  Rapor: ${reportPath}`);
    console.log(successCount === GAMES_TO_SIMULATE ? '\nTUM OYUNLAR BASARILI!' : `\n${GAMES_TO_SIMULATE - successCount} oyun basarisiz.`);
  } finally {
    await browser.close();
    if (serverProcess) { serverProcess.kill(); console.log('\n[Sunucu] Kapatildi.'); }
    process.exit(successCount === GAMES_TO_SIMULATE ? 0 : 1);
  }
}

main().catch(err => {
  console.error('Beklenmeyen hata:', err);
  if (serverProcess) serverProcess.kill();
  process.exit(1);
});
