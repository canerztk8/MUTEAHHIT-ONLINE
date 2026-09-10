import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PORT = 8999;
const outputDir = path.join(rootDir, 'client', 'public', 'images', 'pawns');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const tokens = [
  { id: 'hard_hat', file: 'hard_hat.glb', rotX: 0.5, rotY: -0.4, rotZ: 0, scaleMult: 1.0 },
  { id: 'sports_car', file: 'sports_car.glb', rotX: 0.2, rotY: Math.PI + 0.4, rotZ: 0, scaleMult: 1.1 },
  { id: 'sneaker', file: 'sneaker.glb', rotX: 0.35, rotY: 0.3, rotZ: 0, scaleMult: 1.05 },
  { id: 'warship', file: 'warship_ww12_us_dd.glb', rotX: 0.18, rotY: Math.PI / 4, rotZ: 0, scaleMult: 0.85 },
  { id: 'sphinx', file: 'roman_sphinx.glb', rotX: 0.15, rotY: -0.35, rotZ: 0, scaleMult: 0.82 },
  { id: 'scooter', file: 'scooter.glb', rotX: 0.3, rotY: 0.4, rotZ: 0, scaleMult: 0.95 },
  { id: 'suv', file: 'suv.glb', rotX: 0.25, rotY: -Math.PI / 2 + 0.5, rotZ: 0, scaleMult: 0.78 },
  { id: 'excavator', file: 'excavator.glb', rotX: 0.3, rotY: 0.4, rotZ: 0, scaleMult: 1.05 },
  { id: 'train', file: 'train.glb', rotX: 0.22, rotY: -Math.PI / 4, rotZ: 0, scaleMult: 0.88 }
];

let savedTokens = new Set();

const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pawn Snapshot Renderer</title>
  <script type="importmap">
  {
    "imports": {
      "three": "/node_modules/three/build/three.module.js",
      "three/addons/": "/node_modules/three/examples/jsm/"
    }
  }
  </script>
  <style>
    body { margin: 0; background: transparent; overflow: hidden; }
    canvas { display: block; }
  </style>
</head>
<body>
  <div id="status" style="font-family:sans-serif; padding:10px; color:#333;">Hazırlanıyor...</div>
  <canvas id="c" width="384" height="384"></canvas>

  <script type="module">
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

    const tokens = ${JSON.stringify(tokens)};
    const canvas = document.getElementById('c');
    const statusEl = document.getElementById('status');

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(384, 384);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();

    // Kuşbakışı ve hafif 3D açılı (70 derece) stüdyo kamerası
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 2.5, 1.2);
    camera.lookAt(0, 0, 0);

    // Dengeli Stüdyo Işıklandırması (Patlamayan, derinlikli)
    const amb = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(amb);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.6);
    dirLight.position.set(3, 6, 3.5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    fillLight.position.set(-3, 3, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xfde047, 0.8);
    rimLight.position.set(0, 5, -3);
    scene.add(rimLight);

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/gltf/');
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    async function processTokens() {
      for (const t of tokens) {
        statusEl.innerText = 'Yükleniyor: ' + t.id;
        
        // Temizle
        const oldToken = scene.getObjectByName('current_token');
        if (oldToken) scene.remove(oldToken);

        const gltf = await new Promise((res, rej) => {
          gltfLoader.load('/models/pawns/' + t.file, res, undefined, rej);
        });

        const model = gltf.scene;
        model.name = 'current_token';

        // Bounding box ve merkezleme
        const box = new THREE.Box3().setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        // Modeli sahneye ortala
        model.position.x = -center.x;
        model.position.y = -center.y;
        model.position.z = -center.z;

        const group = new THREE.Group();
        group.name = 'current_token';
        group.add(model);

        // Materyal ve gölge iyileştirmeleri
        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (t.id === 'hard_hat' && child.material) {
              child.material.color.setHex(0xf59e0b);
              child.material.roughness = 0.35;
              child.material.metalness = 0.25;
            }
          }
        });

        // İstenen oryantasyon ve rotasyon
        if (t.rotX) group.rotation.x = t.rotX;
        if (t.rotY) group.rotation.y = t.rotY;
        if (t.rotZ) group.rotation.z = t.rotZ;

        // Boyutlandırma: Tüm modeller 256x256 çerçevesini dengeli doldursun
        const targetScale = (1.95 * (t.scaleMult || 1.0)) / maxDim;
        group.scale.set(targetScale, targetScale, targetScale);

        scene.add(group);

        // 2 kare render alıp dokuların GPU'ya tam yüklenmesini sağla
        renderer.render(scene, camera);
        await new Promise(r => setTimeout(r, 60));
        renderer.render(scene, camera);

        const dataUrl = canvas.toDataURL('image/png');

        await fetch('/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokenId: t.id, base64: dataUrl })
        });
      }

      statusEl.innerText = 'Tüm modeller başarıyla kaydedildi!';
    }

    processTokens().catch(err => {
      console.error(err);
      statusEl.innerText = 'Hata: ' + err.message;
    });
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { tokenId, base64 } = JSON.parse(body);
        const data = base64.replace(/^data:image\/png;base64,/, '');
        const filePath = path.join(outputDir, `${tokenId}.png`);
        fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
        console.log(`[OK] Saved: ${tokenId}.png`);

        savedTokens.add(tokenId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));

        if (savedTokens.size === tokens.length) {
          console.log('[ALL COMPLETED] All 9 pawn snapshots captured!');
          setTimeout(() => {
            server.close();
            process.exit(0);
          }, 500);
        }
      } catch (err) {
        console.error('Error saving image:', err);
        res.writeHead(500);
        res.end();
      }
    });
    return;
  }

  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(htmlContent);
    return;
  }

  // Statik dosya sunumu
  let filePath = '';
  if (req.url.startsWith('/models/pawns/')) {
    filePath = path.join(rootDir, 'client', 'public', req.url);
  } else if (req.url.startsWith('/draco/gltf/')) {
    filePath = path.join(rootDir, 'client', 'public', req.url);
  } else if (req.url.startsWith('/node_modules/three/')) {
    filePath = path.join(rootDir, req.url);
  }

  if (filePath && fs.existsSync(filePath)) {
    const ext = path.extname(filePath);
    const contentTypes = {
      '.js': 'application/javascript',
      '.wasm': 'application/wasm',
      '.glb': 'model/gltf-binary',
      '.bin': 'application/octet-stream'
    };
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found: ' + req.url);
  }
});

server.listen(PORT, () => {
  console.log(`Render server running on http://localhost:${PORT}`);
  
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  console.log(`Launching Edge: ${edgePath}`);

  const edge = spawn(edgePath, [
    '--headless',
    '--disable-gpu=false',
    '--no-sandbox',
    '--disable-web-security',
    `http://localhost:${PORT}`
  ]);

  edge.on('error', (err) => {
    console.error('Failed to start Edge:', err);
  });
});
