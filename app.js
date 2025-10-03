const BACKEND_URL = "http://localhost:3001";

/* =================== THREE.js setup =================== */
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio || 1);
document.getElementById("globe-canvas").appendChild(renderer.domElement);

/* Globe */
const geometry = new THREE.SphereGeometry(5, 64, 64);
const loader = new THREE.TextureLoader();
const texture = loader.load(
  "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
);
const material = new THREE.MeshPhongMaterial({ map: texture });
const earth = new THREE.Mesh(geometry, material);
scene.add(earth);

/* Lights */
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(50, 50, 50);
scene.add(pointLight);

/* Camera */
camera.position.z = 15;
camera.lookAt(0, 0, 0);

/* =================== Interaction / state =================== */
let isPaused = false; // single source of truth for auto-rotation

// Enable OrbitControls if the examples script is included in index.html
let controls = null;
if (typeof THREE.OrbitControls !== "undefined") {
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = true;
  controls.minDistance = 7;
  controls.maxDistance = 30;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;
  controls.addEventListener("start", () => { isPaused = true; });
  controls.addEventListener("end",   () => { isPaused = false; });
}

/* =================== Helpers =================== */
function latLonToVector3(lat, lon) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const r = 5.1; // slightly above globe surface
  return new THREE.Vector3(
    -(r * Math.sin(phi) * Math.cos(theta)),
     (r * Math.cos(phi)),
     (r * Math.sin(phi) * Math.sin(theta))
  );
}

function log(message) {
  const el = document.getElementById("log");
  el.innerHTML += `${new Date().toISOString()}: ${message}<br>`;
  el.scrollTop = el.scrollHeight;
  console.log(message);
}

/* Country centroids (quick demo mapping) */
const COUNTRY_COORDS = {
  us: { lat: 38,   lon: -97 },
  in: { lat: 20,   lon: 77  },
  gb: { lat: 54,   lon: -2  },
  au: { lat: -25,  lon: 133 },
  ca: { lat: 56,   lon: -106},
  br: { lat: -14,  lon: -51 }
};

/* ---- Better spreading helpers (golden-angle spiral) ---- */
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

// Evenly distributes points in expanding spiral (degrees)
function spiralOffset(i, total, baseLatDeg) {
  const GOLDEN_ANGLE = 2.399963229728653; // ~137.5°
  const t = total <= 1 ? 0 : i / (total - 1);     // 0..1
  const maxRadiusDeg = Math.min(8, 2 + total * 0.25); // grows with count, capped ~8°
  const r = t * maxRadiusDeg;
  const theta = i * GOLDEN_ANGLE;

  // Longitude shrinks by cos(latitude), compensate to keep round shape
  const lonScale = Math.max(0.3, Math.cos(baseLatDeg * Math.PI / 180));

  const dLat = r * Math.sin(theta);
  const dLon = (r * Math.cos(theta)) / lonScale;
  return { dLat, dLon };
}

/* ---- India state centroids + detection ---- */
const IN_STATE_COORDS = {
  "gujarat":        { lat: 22.3,  lon: 70.8 },
  "maharashtra":    { lat: 19.7,  lon: 75.7 },
  "delhi":          { lat: 28.61, lon: 77.20 },
  "karnataka":      { lat: 14.6,  lon: 76.1 },
  "tamil nadu":     { lat: 11.1,  lon: 78.6 },
  "uttar pradesh":  { lat: 26.8,  lon: 80.9 },
  "west bengal":    { lat: 23.3,  lon: 87.3 },
  "telangana":      { lat: 18.1,  lon: 79.0 },
  "rajasthan":      { lat: 26.9,  lon: 73.8 },
  "kerala":         { lat: 10.5,  lon: 76.2 },
  "andhra pradesh": { lat: 15.9,  lon: 79.7 },
  "punjab":         { lat: 31.1,  lon: 75.3 },
  "haryana":        { lat: 29.1,  lon: 76.6 },
  "bihar":          { lat: 25.9,  lon: 85.5 },
  "madhya pradesh": { lat: 23.7,  lon: 78.9 },
  "assam":          { lat: 26.2,  lon: 92.9 },
  "odisha":         { lat: 20.5,  lon: 84.4 },
  "jharkhand":      { lat: 23.6,  lon: 85.3 },
  "chhattisgarh":   { lat: 21.3,  lon: 82.0 },
  "jammu":          { lat: 33.45, lon: 76.24 },
  "kashmir":        { lat: 34.1,  lon: 74.8 }
};

// try to detect an Indian state from article title/description
function detectIndianState(article) {
  const text = `${article.title || ""} ${article.description || ""}`.toLowerCase();
  for (const state in IN_STATE_COORDS) {
    if (text.includes(state)) return state;
  }
  return null;
}

/* ---- Hover/Click helpers: pick closest only ---- */
function getMarkerGroupFromObject(obj) {
  let cur = obj;
  while (cur && !(cur instanceof THREE.Group)) cur = cur.parent;
  return cur && cur.userData && cur.userData.title ? cur : null;
}

function getClosestMarkerGroup(intersects) {
  for (const it of intersects) {
    const g = getMarkerGroupFromObject(it.object);
    if (g) return g; // intersects is sorted by distance
  }
  return null;
}

/* =================== News markers (NO Claude) =================== */
async function addNewsMarkers(articles) {
  const newsAmount = parseInt(document.getElementById("newsAmount").value);
  const selected = articles.slice(0, newsAmount);

  // clear old markers
  earth.children = [];
  let added = 0;

  const countryCode = document.getElementById("country").value; // from UI
  const base = COUNTRY_COORDS[countryCode];
  if (!base) {
    log(`No centroid mapping for country code: ${countryCode}`);
    return;
  }

  for (const news of selected) {
    if (isFetchPaused) {
      log("Paused: Stopped processing news items.");
      break;
    }

    // place near Indian state if detected; else country-based spiral
    let coords;
    if (countryCode === "in") {
      const detected = detectIndianState(news);
      if (detected && IN_STATE_COORDS[detected]) {
        const center = IN_STATE_COORDS[detected];
        const { dLat, dLon } = spiralOffset(added, selected.length, center.lat);
        coords = {
          lat: clamp(center.lat + dLat * 0.6, -85, 85),
          lon: ((center.lon + dLon * 0.6 + 540) % 360) - 180
        };
      } else {
        const { dLat, dLon } = spiralOffset(added, selected.length, base.lat);
        coords = {
          lat: clamp(base.lat + dLat, -85, 85),
          lon: ((base.lon + dLon + 540) % 360) - 180
        };
      }
    } else {
      const { dLat, dLon } = spiralOffset(added, selected.length, base.lat);
      coords = {
        lat: clamp(base.lat + dLat, -85, 85),
        lon: ((base.lon + dLon + 540) % 360) - 180
      };
    }

    const markerGeometry = new THREE.SphereGeometry(0.07, 32, 32);
    const defaultColor = 0xff0000;
    const markerMaterial = new THREE.MeshBasicMaterial({ color: defaultColor });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);

    const pos = latLonToVector3(coords.lat, coords.lon);
    marker.position.set(pos.x, pos.y, pos.z);
    marker.userData.defaultColor = defaultColor;

    // smaller, centered hit sphere to reduce overlaps
    const hitGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const hitMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00, transparent: true, opacity: 0.0
    });
    const hitSphere = new THREE.Mesh(hitGeometry, hitMaterial);
    hitSphere.position.copy(marker.position);

    const markerGroup = new THREE.Group();
    markerGroup.add(marker);
    markerGroup.add(hitSphere);
    markerGroup.userData = {
      title: news.title,
      url: news.url,
      source: news.source?.name || "Source",
      location: countryCode === "in" ? (detectIndianState(news)?.toUpperCase() || "INDIA") : countryCode.toUpperCase()
    };

    earth.add(markerGroup);
    added++;
    log(`Added marker for: "${news.title}"`);
  }

  log(`Added ${added} news markers to the globe.`);
}

/* =================== Fetch news flow =================== */
let isFetchPaused = false;
let fetchInterval;
const pauseFetchButton = document.getElementById("pauseFetchButton");

function toggleFetchPause() {
  isFetchPaused = !isFetchPaused;
  pauseFetchButton.textContent = isFetchPaused ? "Resume Fetch" : "Pause Fetch";
  pauseFetchButton.classList.toggle("paused", isFetchPaused);

  if (isFetchPaused) {
    clearInterval(fetchInterval);
    log("News fetching paused");
  } else {
    startFetchInterval();
    log("News fetching resumed");
  }
}
pauseFetchButton.addEventListener("click", toggleFetchPause);

async function fetchNews() {
  if (isFetchPaused) {
    log("News fetching is paused. Click 'Resume Fetch' to continue.");
    return;
  }

  const newsSource = document.getElementById("newsSource").value;
  const params = new URLSearchParams();

  if (newsSource === "top-headlines") {
    params.append("endpoint", "top-headlines");
    params.append("category", document.getElementById("category").value);
    params.append("country",  document.getElementById("country").value);
  } else {
    // still supported; markers placed near selected country's centroid
    params.append("endpoint", "everything");
    params.append("sources",  document.getElementById("source").value);
  }

  const url = `${BACKEND_URL}/api/news?${params.toString()}`;
  log(`Fetching news from URL: ${url}`);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    log(`JSON parsed successfully. Received ${data.articles.length} articles.`);
    await addNewsMarkers(data.articles);
  } catch (err) {
    log(`Error fetching news: ${err.name}: ${err.message}`);
    console.error("Full error object:", err);
  }
}

document.getElementById("newsSource").addEventListener("change", function () {
  document.getElementById("category").style.display =
    this.value === "top-headlines" ? "inline" : "none";
  document.getElementById("country").style.display =
    this.value === "top-headlines" ? "inline" : "none";
  document.getElementById("source").style.display =
    this.value === "top-headlines" ? "none" : "inline";
});

document.getElementById("fetchButton").addEventListener("click", fetchNews);

/* =================== Picking & hover =================== */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}
window.addEventListener("mousemove", onMouseMove, false);

function hideInfoBox() {
  document.getElementById("info").style.display = "none";
}

const pauseButton = document.getElementById("pauseButton");
const animationSlider = document.getElementById("animationSlider");
const sliderValue = document.getElementById("sliderValue");
let lastSliderValue = 0;
let selectedMarker = null;

pauseButton.addEventListener("click", () => {
  isPaused = !isPaused;
  pauseButton.textContent = isPaused ? "Resume rotation" : "Pause rotation";
});

animationSlider.addEventListener("input", () => {
  earth.rotation.y = (animationSlider.value * Math.PI) / 180;
  sliderValue.textContent = `${animationSlider.value}°`;
});

function onClick(event) {
  const infoBox = document.getElementById("info");
  if (infoBox.contains(event.target)) return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(earth.children, true);
  const closestGroup = getClosestMarkerGroup(intersects);

  if (closestGroup) {
    selectedMarker = closestGroup;
    updateInfoBox(closestGroup.userData);
  } else {
    selectedMarker = null;
    hideInfoBox();
  }
}
const canvas = renderer.domElement;
canvas.addEventListener("mousemove", onMouseMove, false);
canvas.addEventListener("click", onClick, false);

function updateInfoBox(newsData) {
  const infoBox = document.getElementById("info");
  if (!newsData) { infoBox.style.display = "none"; return; }

  infoBox.innerHTML = `
    <strong>${newsData.title || "No title"}</strong><br>
    Location: ${newsData.location || "Unknown"}<br>
    Source: ${newsData.source || "Unknown"}<br>
    <a href="${newsData.url || "#"}" target="_blank" id="readMoreLink">Read more</a>
  `;
  infoBox.style.display = "block";

  document.getElementById("readMoreLink").addEventListener("click", (e) => {
    e.stopPropagation();
  });
}

/* =================== Animation loop =================== */
function animate() {
  requestAnimationFrame(animate);

  if (!isPaused) {
    earth.rotation.y += 0.002;
    animationSlider.value = ((earth.rotation.y * 180) / Math.PI) % 360;
    sliderValue.textContent = `${Math.round(animationSlider.value)}°`;
  } else {
    const currentSliderValue = parseInt(animationSlider.value, 10);
    if (currentSliderValue !== lastSliderValue) {
      earth.rotation.y = (currentSliderValue * Math.PI) / 180;
      lastSliderValue = currentSliderValue;
    }
  }

  // Hover highlight (closest only)
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(earth.children, true);
  const closestGroup = getClosestMarkerGroup(intersects);
  handleMarkerHover(closestGroup);

  // Pointer cursor on hover
  document.body.style.cursor = closestGroup ? "pointer" : "default";

  if (selectedMarker) updateInfoBox(selectedMarker.userData);

  if (controls) controls.update();
  renderer.render(scene, camera);
}
animate();

/* =================== Resize =================== */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* =================== Auto-refresh interval =================== */
function startFetchInterval() {
  clearInterval(fetchInterval);
  fetchNews();
  fetchInterval = setInterval(() => {
    if (!isFetchPaused) fetchNews();
  }, 5 * 60 * 1000);
}

/* =================== Hover color helper (closest only) =================== */
function handleMarkerHover(closestGroup) {
  const hoverColor = 0xffff00;

  earth.children.forEach((markerGroup) => {
    if (!(markerGroup instanceof THREE.Group)) return;

    const marker = markerGroup.children.find(
      (child) =>
        child.geometry instanceof THREE.SphereGeometry &&
        child.material && child.material.opacity !== 0
    );
    if (!marker) return;

    const isHovered = closestGroup && (markerGroup === closestGroup);
    marker.material.color.setHex(
      isHovered ? hoverColor : marker.userData.defaultColor
    );
  });
}
