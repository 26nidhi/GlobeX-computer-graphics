const BACKEND_URL = "http://localhost:3001";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById("globe-canvas").appendChild(renderer.domElement);

const geometry = new THREE.SphereGeometry(5, 64, 64);
const loader = new THREE.TextureLoader();
const texture = loader.load(
  "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
);
const material = new THREE.MeshPhongMaterial({ map: texture });
const earth = new THREE.Mesh(geometry, material);
scene.add(earth);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(50, 50, 50);
scene.add(pointLight);

camera.position.z = 15;

function latLonToVector3(lat, lon) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(5.1 * Math.sin(phi) * Math.cos(theta));
  const z = 5.1 * Math.sin(phi) * Math.sin(theta);
  const y = 5.1 * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

async function askClaude(article) {
  const prompt = `
    Analyze the following news article and determine the most relevant geographical location (city and country) it pertains to. If multiple locations are mentioned, choose the most significant one. If no specific location is mentioned, suggest the most likely location based on the content. Then, provide the latitude and longitude coordinates for this location.

    Article Title: ${article.title}
    Article Description: ${article.description}
    
    Respond exactly in the following format:
    Location: [City], [Country]
    Latitude: [Latitude]
    Longitude: [Longitude]
    Reasoning: [Brief explanation of your choice]
  `;

  try {
    const response = await fetch(`${BACKEND_URL}/ask-claude`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt }),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    return data.content?.[0]?.text || null;
  } catch (error) {
    console.error("Error calling Claude API:", error);
    log(`Error calling Claude API: ${error.message}`);
    return null;
  }
}

async function addNewsMarkers(newsData) {
  const newsAmount = parseInt(document.getElementById("newsAmount").value);
  const selectedNews = newsData.slice(0, newsAmount);
  earth.children = [];
  let addedMarkers = 0;

  for (const news of selectedNews) {
    if (isFetchPaused) {
      log("Paused: Stopped processing news items.");
      break;
    }

    const claudeResponse = await askClaude(news);
    if (claudeResponse) {
      try {
        const lines = claudeResponse.split("\n");
        const location = lines
          .find((line) => line.startsWith("Location:"))
          ?.split(":")[1]
          .trim();
        const lat = parseFloat(
          lines.find((line) => line.startsWith("Latitude:"))?.split(":")[1]
        );
        const lon = parseFloat(
          lines.find((line) => line.startsWith("Longitude:"))?.split(":")[1]
        );

        if (location && !isNaN(lat) && !isNaN(lon)) {
          const markerGeometry = new THREE.SphereGeometry(0.07, 32, 32);
          const defaultColor = 0xff0000;
          const markerMaterial = new THREE.MeshBasicMaterial({
            color: defaultColor,
          });
          const marker = new THREE.Mesh(markerGeometry, markerMaterial);
          const position = latLonToVector3(lat, lon);
          marker.position.set(position.x, position.y, position.z);
          marker.userData.defaultColor = defaultColor;

          const hitGeometry = new THREE.SphereGeometry(0.4, 32, 32);
          const hitMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.0,
          });
          const hitSphere = new THREE.Mesh(hitGeometry, hitMaterial);
          hitSphere.position.copy(marker.position);
          hitSphere.position.y += 0.7;

          const markerGroup = new THREE.Group();
          markerGroup.add(marker);
          markerGroup.add(hitSphere);
          markerGroup.userData = {
            title: news.title,
            url: news.url,
            source: news.source.name,
            location: location,
          };

          earth.add(markerGroup);
          addedMarkers++;
          log(
            `Added marker for article: "${news.title}" at ${location} (${lat}, ${lon})`
          );
        }
      } catch (error) {
        log(
          `Error processing location for article: "${news.title}". Error: ${error.message}`
        );
      }
    } else {
      log(`Failed to get location for article: "${news.title}"`);
    }
  }
  log(`Added ${addedMarkers} news markers to the globe.`);
}
