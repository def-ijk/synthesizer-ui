// Music Visualizer - Unknown Lines
// Inspired by Joy Division's Unknown Pleasures album cover
// Converted from React to vanilla JavaScript for synthesizer integration

class MusicVisualizer {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.lines = null;
    this.sound = null;
    this.analyser = null;
    this.last = 0;
    this.frameId = null;
    this.dimension = 0;
    this.mount = null;
    this.isInitialized = false;
    this.volume = 0.3;
    this.volumeHud = null;
    this.hudTimeoutId = null;
    this.startTime = Date.now();
    this.locationRequested = false;
    this.locationHud = null;
  }

  init(mountElement) {
    if (this.isInitialized) return;

    this.mount = mountElement;
    this.dimension = Math.min(window.innerHeight, window.innerWidth);

    // Basic THREE.js scene and render setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(
      -550,
      -250,
      1200,
      -200,
      200,
      5000
    );
    this.camera.position.set(400, 1000, 300);
    this.camera.lookAt(400, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x000000, 0); // Transparent background
    this.mount.appendChild(this.renderer.domElement);

    // THREE.js audio and sound setup
    const listener = new THREE.AudioListener();
    this.camera.add(listener);
    this.sound = new THREE.Audio(listener);
    const audioLoader = new THREE.AudioLoader();

    // Load the audio file
    audioLoader.load("./Song 117.mp3", (buffer) => {
      this.sound.setBuffer(buffer);
      this.sound.setLoop(true);
      this.sound.setVolume(this.volume); // Lower volume to not interfere with synthesizer
    });

    this.analyser = new THREE.AudioAnalyser(this.sound, 128);

    // Line setup
    this.lines = new THREE.Group();
    this.scene.add(this.lines);

    this.last = 0;

    // Create volume HUD
    this.createVolumeHud();
    // Create location HUD (updates after user grants permission)
    this.createLocationHud();

    // Event listeners
    window.addEventListener("resize", this.onWindowResize.bind(this), false);
    this.mount.addEventListener("click", this.onClick.bind(this), false);
    window.addEventListener("keydown", this.onKeyDown.bind(this), false);
    this.mount.addEventListener("wheel", this.onWheel.bind(this), {
      passive: false,
    });

    this.isInitialized = true;
    this.animate();
  }

  animate(now) {
    this.frameId = requestAnimationFrame(this.animate.bind(this));
    this.renderer.render(this.scene, this.camera);

    if (!this.last || now - this.last >= 5) {
      this.last = now;
      const data = this.analyser.getFrequencyData();
      this.moveLines();
      this.addLine(data);
    }
  }

  addLine(fftValues) {
    const planeGeometry = new THREE.PlaneGeometry(200 - 1, 1, 200 - 1, 1);

    const plane = new THREE.Mesh(
      planeGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        wireframe: false,
        transparent: false,
      })
    );
    this.lines.add(plane);

    const lineGeometry = new THREE.BufferGeometry();
    let lineVertices = [];
    for (let i = 0; i < 200; i++) {
      lineVertices.push(planeGeometry.attributes.position.array[3 * i]);
      lineVertices.push(planeGeometry.attributes.position.array[3 * i + 1]);
      lineVertices.push(planeGeometry.attributes.position.array[3 * i + 2]);
    }
    lineGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(lineVertices), 3)
    );

    // Slight random variation for line color using Math.random()
    const jitter = Math.floor(Math.random() * 0x22); // 0..0x21
    const base = 0xe1e1e1;
    const color = Math.min(
      0xffffff,
      base + (jitter << 16) + (jitter << 8) + jitter
    );
    const lineMat = new THREE.LineBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.57,
    });
    const line = new THREE.Line(lineGeometry, lineMat);

    plane.add(line);

    for (let i = 0; i < 200; i++) {
      let y = 0;
      if (i >= 39 && i < 100) {
        y += fftValues[102 - i];
      } else if (i >= 100 && i < 161) {
        y += fftValues[i - 97];
      }
      y = Math.pow(y, 1.2);

      plane.geometry.attributes.position.array[i * 3 + 1] = y;
      line.geometry.attributes.position.array[i * 3 + 1] = y;
    }
  }

  moveLines() {
    // Animate speed varies over time using Date.now()
    const elapsed = Date.now() - this.startTime;
    const speed = 1 + 0.5 * Math.sin(elapsed / 2000);
    let planesThatHaveGoneFarEnough = [];
    this.lines.children.forEach((plane) => {
      for (let i = 0; i < 400; i++) {
        plane.geometry.attributes.position.array[i * 3 + 2] -= speed;
        if (i < 200) {
          plane.children[0].geometry.attributes.position.array[i * 3 + 2] -=
            speed;
        }
      }

      if (plane.geometry.attributes.position.array[2] <= -1000) {
        planesThatHaveGoneFarEnough.push(plane);
      } else {
        plane.geometry.attributes.position.needsUpdate = true;
        plane.children[0].geometry.attributes.position.needsUpdate = true;
      }
    });
    planesThatHaveGoneFarEnough.forEach((plane) => this.lines.remove(plane));
  }

  onWindowResize() {
    if (this.mount) {
      this.dimension = Math.min(window.innerHeight, window.innerWidth);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
  }

  onClick() {
    if (this.sound.isPlaying) {
      this.sound.pause();
    } else {
      this.sound.play();
    }
  }

  onKeyDown(event) {
    // Request user location when spacebar is pressed
    if (event.code === "Space" && !this.locationRequested) {
      event.preventDefault(); // Prevent page scroll
      this.locationRequested = true;
      this.requestLocation();
    }
  }

  destroy() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
    if (this.sound && this.sound.isPlaying) {
      this.sound.stop();
    }

    window.removeEventListener("resize", this.onWindowResize.bind(this));
    window.removeEventListener("keydown", this.onKeyDown.bind(this));
    if (this.mount) {
      this.mount.removeEventListener("click", this.onClick.bind(this));
      this.mount.removeEventListener("wheel", this.onWheel.bind(this));
      if (this.renderer && this.renderer.domElement) {
        this.mount.removeChild(this.renderer.domElement);
      }
    }
    this.isInitialized = false;
  }

  // Volume controls
  onWheel(event) {
    // Prevent page scroll when interacting with visualizer
    event.preventDefault();
    const step = 0.05;
    const deltaY = event.deltaY;
    // Scroll up -> increase, Scroll down -> decrease
    const direction = deltaY < 0 ? 1 : -1;
    this.volume = Math.max(0, Math.min(1, this.volume + direction * step));
    if (this.sound) {
      this.sound.setVolume(this.volume);
    }
    this.updateVolumeHud();
  }

  createVolumeHud() {
    if (!this.mount) return;
    const hud = document.createElement("div");
    hud.id = "volume-hud";
    hud.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(0,0,0,0.6);
      color: #fff;
      padding: 8px 12px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 150ms ease-in-out;
    `;
    // hud.textContent = `Volume: ${Math.round(this.volume * 100)}%`;
    this.mount.appendChild(hud);
    this.volumeHud = hud;
  }

  updateVolumeHud() {
    if (!this.volumeHud) return;
    this.volumeHud.textContent = `Volume: ${Math.round(this.volume * 100)}%`;
    this.volumeHud.style.opacity = "1";
    if (this.hudTimeoutId) {
      clearTimeout(this.hudTimeoutId);
    }
    this.hudTimeoutId = setTimeout(() => {
      this.volumeHud.style.opacity = "0";
    }, 800);
  }

  // Location controls (navigator.geolocation.getCurrentPosition)
  requestLocation() {
    if (!("geolocation" in navigator)) {
      this.updateLocationHud("Location not available");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        this.updateLocationHud(
          `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(
            4
          )} — resolving…`
        );
        // Subtle background tint based on latitude/longitude
        const r = Math.floor(30 + (Math.abs(latitude) / 90) * 50); // 30..80
        const b = Math.floor(30 + (Math.abs(longitude) / 180) * 50); // 30..80
        const container = this.mount ? this.mount.parentElement : null;
        if (container) {
          container.style.background = `rgba(${r}, 0, ${b}, 0.9)`;
        }
        // Reverse geocode to human-readable location
        this.reverseGeocode(latitude, longitude);
      },
      (err) => {
        this.updateLocationHud("Location denied");
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  }

  createLocationHud() {
    if (!this.mount) return;
    const hud = document.createElement("div");
    hud.id = "location-hud";
    hud.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: rgba(0,0,0,0.6);
      color: #fff;
      padding: 6px 10px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 12px;
      pointer-events: none;
      opacity: 0.85;
    `;
    // hud.textContent = "Press SPACE to enable location-based tint";
    this.mount.appendChild(hud);
    this.locationHud = hud;
  }

  updateLocationHud(text) {
    if (!this.locationHud) return;
    this.locationHud.textContent = text;
  }

  // Reverse geocoding via OpenStreetMap Nominatim
  async reverseGeocode(lat, lon) {
    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        lat: String(lat),
        lon: String(lon),
        zoom: "10",
        addressdetails: "1",
      });
      const url = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;
      const res = await fetch(url, {
        headers: {
          "Accept-Language": navigator.language || "en",
          // Note: browsers restrict setting User-Agent header; Nominatim allows CORS for simple requests
        },
      });
      if (!res.ok) throw new Error("Reverse geocode failed");
      const data = await res.json();
      const addr = data.address || {};
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.hamlet ||
        addr.suburb ||
        "";
      const state = addr.state || addr.region || "";
      const country = addr.country || "";
      const parts = [city, state, country].filter(Boolean);
      if (parts.length) {
        this.updateLocationHud(parts.join(", "));
      } else if (data.display_name) {
        this.updateLocationHud(data.display_name);
      } else {
        this.updateLocationHud("Location resolved");
      }
    } catch (e) {
      this.updateLocationHud("Could not resolve place name");
    }
  }
}

// Initialize the visualizer when the page loads
let visualizer = null;

document.addEventListener("DOMContentLoaded", function () {
  // Wait for THREE.js to be available
  if (typeof THREE === "undefined") {
    console.log("THREE.js not loaded yet, waiting...");
    setTimeout(() => {
      if (typeof THREE !== "undefined") {
        initVisualizer();
      }
    }, 1000);
  } else {
    initVisualizer();
  }
});

function initVisualizer() {
  // Create a container for the visualizer
  const visualizerContainer = document.createElement("div");
  visualizerContainer.id = "visualizer-container";
  visualizerContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.9);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  `;

  // Add title
  const title = document.createElement("div");
  // title.textContent = "Unknown Lines Visualizer";
  title.style.cssText = `
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    font-size: 24px;
    font-family: Arial, sans-serif;
    font-weight: bold;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
  `;

  // Add instructions
  const instructions = document.createElement("div");
  // instructions.textContent = "Click anywhere to play/pause the music";
  instructions.style.cssText = `
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    color: #ccc;
    font-size: 16px;
    font-family: Arial, sans-serif;
    text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
  `;

  // Create canvas container for THREE.js
  const canvasContainer = document.createElement("div");
  canvasContainer.id = "canvas-container";
  canvasContainer.style.cssText = `
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  `;

  visualizerContainer.appendChild(title);
  visualizerContainer.appendChild(instructions);
  visualizerContainer.appendChild(canvasContainer);
  document.body.appendChild(visualizerContainer);

  // Initialize the visualizer
  visualizer = new MusicVisualizer();
  visualizer.init(canvasContainer);
}
