const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function takeScreenshot(url, outputPath, width = 1440, height = 900) {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const userDataDir = path.join(os.tmpdir(), 'edge-shot-' + Date.now());
  const port = 9222 + Math.floor(Math.random() * 100);

  const edge = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--window-size=${width},${height}`,
  ]);

  try {
    // Wait for CDP to be ready
    let target = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await res.json();
        if (list.length > 0) {
          target = list[0];
          break;
        }
      } catch {}
    }

    if (!target || !target.webSocketDebuggerUrl) {
      throw new Error('Could not find CDP target');
    }

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const curId = id++;
        const handler = (event) => {
          const data = JSON.parse(event.data);
          if (data.id === curId) {
            ws.removeEventListener('message', handler);
            resolve(data.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send('Page.navigate', { url });

    // Wait for page to render and stabilize
    await new Promise((r) => setTimeout(r, 2000));

    const result = await send('Page.captureScreenshot', { format: 'png' });
    if (result && result.data) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, Buffer.from(result.data, 'base64'));
      console.log(`Screenshot saved to ${outputPath}`);
    } else {
      throw new Error('Screenshot data missing');
    }

    ws.close();
  } finally {
    edge.kill();
    setTimeout(() => {
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch {}
    }, 1000);
  }
}

const [,, url, out, w, h] = process.argv;
if (url && out) {
  takeScreenshot(url, out, parseInt(w) || 1440, parseInt(h) || 900).catch(console.error);
} else {
  console.log('Usage: node take-screenshot.js <url> <outputPath> [width] [height]');
}

