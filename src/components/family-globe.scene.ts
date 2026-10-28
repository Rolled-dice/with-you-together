import * as THREE from "three";

export function createFamilyGlobe(
  stage: HTMLElement,
  motion: { angle: number; phase: number; drag: number; zoom: number },
) {
  const canvas = stage.querySelector("canvas")!;
  const pins = Array.from(stage.querySelectorAll<HTMLElement>("[data-globe-member]"));
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 20);
  const globe = new THREE.Group();
  scene.add(globe);
  let disposed = false;
  const textureReady = () => {
    if (!disposed) {
      stage.dataset.globeTexture = "ready";
      render();
    }
  };
  const textureFailed = () => {
    if (!disposed) stage.dataset.globeTexture = "failed";
  };
  const mask = new THREE.TextureLoader().load(
    "/family-earth-mask.jpg",
    textureReady,
    undefined,
    textureFailed,
  );
  const material = new THREE.ShaderMaterial({
    uniforms: {
      mask: { value: mask },
      ocean: { value: new THREE.Color() },
      land: { value: new THREE.Color() },
      ink: { value: new THREE.Color() },
      spin: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; varying vec3 vNormal;
      void main() { vUv = uv; vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D mask; uniform vec3 ocean; uniform vec3 land; uniform vec3 ink; uniform float spin;
      varying vec2 vUv; varying vec3 vNormal;
      void main() {
        vec2 mapUv = vec2(fract(vUv.x + 0.68 + spin), vUv.y);
        vec2 cells = vec2(180.0, 90.0);
        vec2 cellUv = (floor(mapUv * cells) + 0.5) / cells;
        float water = smoothstep(0.2, 0.65, texture2D(mask, cellUv).r);
        float dotShape = 1.0 - smoothstep(0.23, 0.38, length(fract(mapUv * cells) - 0.5));
        vec3 dotColour = mix(land, ink, step(0.5, fract(cellUv.x * 7.0 + cellUv.y * 4.0)));
        vec3 colour = mix(ocean, dotColour, (1.0 - water) * dotShape * 0.95);
        vec2 grid = abs(fract(mapUv * vec2(12.0, 6.0) + 0.5) - 0.5);
        float meridian = 1.0 - smoothstep(0.003, 0.009, min(grid.x, grid.y));
        colour = mix(colour, ink, meridian * 0.12);
        float edge = pow(1.0 - max(vNormal.z, 0.0), 2.0);
        gl_FragColor = vec4(mix(colour, ink, edge * 0.14), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const geometry = new THREE.SphereGeometry(1, 64, 48);
  globe.add(new THREE.Mesh(geometry, material));
  const atmosphere = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { glow: { value: new THREE.Color() }, strength: { value: 0.14 } },
    vertexShader: `varying vec3 vNormal; void main() { vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 glow; uniform float strength; varying vec3 vNormal;
      void main() { float rim = pow(1.0 - max(vNormal.z, 0.0), 4.0); gl_FragColor = vec4(glow, rim * strength);
        #include <colorspace_fragment>
      }`,
  });
  const air = new THREE.Mesh(geometry, atmosphere);
  air.scale.setScalar(1.015);
  globe.add(air);
  // Symbolic positions keep every member visible without collecting location data.
  const anchors = [
    [-0.68, 0.28, 0.9],
    [0.68, 0.28, 0.9],
    [-0.65, -0.58, 0.9],
    [0.65, -0.58, 0.9],
    [0, 0.85, 0.8],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize().multiplyScalar(1.07));
  if (pins.length === 1) anchors[0].set(0, 0.38, 1).normalize().multiplyScalar(1.07);
  const ringGeometry = new THREE.RingGeometry(0.045, 0.052, 48);
  const dotGeometry = new THREE.SphereGeometry(0.018, 12, 8);
  const ringMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const dotMaterial = new THREE.MeshBasicMaterial();
  const pings = pins.map((_, index) => {
    const group = new THREE.Group();
    const anchor = anchors[index % anchors.length];
    group.position.copy(anchor);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), anchor.clone().normalize());
    const dot = new THREE.Mesh(dotGeometry, dotMaterial);
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    const outer = new THREE.Mesh(ringGeometry, ringMaterial);
    outer.scale.setScalar(1.8);
    group.add(dot, ring, outer);
    globe.add(group);
    return outer;
  });
  const paths: THREE.QuadraticBezierCurve3[] = [];
  const pathGeometries: THREE.BufferGeometry[] = [];
  const trails = new THREE.LineDashedMaterial({
    transparent: true,
    opacity: 0.5,
    dashSize: 0.025,
    gapSize: 0.022,
  });
  const order = [0, 4, 1, 3, 2].filter((index) => index < pins.length);
  const travellers =
    order.length > 1
      ? order.map((index, i) => {
          const start = anchors[index];
          const end = anchors[order[(i + 1) % order.length]];
          const midpoint = start
            .clone()
            .add(end)
            .multiplyScalar(0.5)
            .normalize()
            .multiplyScalar(1.24);
          const curve = new THREE.QuadraticBezierCurve3(start, midpoint, end);
          paths.push(curve);
          const lineGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(72));
          pathGeometries.push(lineGeometry);
          const line = new THREE.Line(lineGeometry, trails);
          line.computeLineDistances();
          const traveller = new THREE.Mesh(dotGeometry, dotMaterial);
          traveller.scale.setScalar(0.7);
          globe.add(line, traveller);
          return traveller;
        })
      : [];
  let width = 1;
  let height = 1;
  let frame = 0;
  let visible = true;
  let lastState = "";
  function render() {
    if (disposed) return;
    globe.rotation.y = Math.sin(motion.phase * Math.PI * 2) * 0.09 + motion.drag;
    material.uniforms.spin.value = motion.phase;
    globe.updateMatrixWorld();
    camera.position.z = Math.max(3.65, 3.65 / camera.aspect) / motion.zoom;
    camera.updateMatrixWorld();
    const tallestPin = Math.max(0, ...pins.map((pin) => pin.offsetHeight));
    pins.forEach((pin, index) => {
      const point = anchors[index % anchors.length]
        .clone()
        .applyMatrix4(globe.matrixWorld)
        .project(camera);
      const half = pin.offsetWidth / 2 + 5;
      pin.style.left = `${THREE.MathUtils.clamp((point.x * 0.5 + 0.5) * width, half, width - half)}px`;
      // Separate rows on narrow screens so enlarged labels cannot cover another member.
      const rows = pins.length > 4 ? 3 : pins.length > 2 ? 2 : 1;
      const row = pins.length > 4 ? (index === 4 ? 0 : index < 2 ? 1 : 2) : index < 2 ? 0 : 1;
      const rowHeight = tallestPin + 14;
      const firstRow =
        Math.max(12, (height - (rows * tallestPin + (rows - 1) * 14)) / 2) + tallestPin / 2;
      const pinY =
        width < 380
          ? firstRow + row * rowHeight
          : (-point.y * 0.5 + 0.5) * height - (width >= 600 ? 24 : 16);
      pin.style.top = `${pinY}px`;
      pings[index].scale.setScalar(1.4 + Math.sin(motion.phase * Math.PI * 12 + index) * 0.35);
    });
    travellers.forEach((traveller, index) =>
      traveller.position.copy(
        paths[index].getPoint((motion.phase * 4 + index / travellers.length) % 1),
      ),
    );
    renderer.render(scene, camera);
    lastState = `${motion.angle},${motion.phase},${motion.drag},${motion.zoom}`;
    stage.dataset.globeReady = "true";
  }
  function resize() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  }
  function updateTheme() {
    const style = getComputedStyle(stage);
    const colour = (token: string) => new THREE.Color(style.getPropertyValue(token).trim());
    material.uniforms.ocean.value.copy(colour("--care-navy"));
    material.uniforms.land.value.copy(colour("--care-gold"));
    material.uniforms.ink.value.copy(colour("--care-coral"));
    atmosphere.uniforms.glow.value.copy(colour("--care-teal"));
    ringMaterial.color.copy(colour("--care-gold"));
    dotMaterial.color.copy(colour("--care-coral"));
    trails.color.copy(colour("--care-coral"));
    render();
  }
  function tick() {
    if (
      visible &&
      !document.hidden &&
      `${motion.angle},${motion.phase},${motion.drag},${motion.zoom}` !== lastState
    )
      render();
    frame = requestAnimationFrame(tick);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  pins.forEach((pin) => observer.observe(pin));
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  intersection.observe(stage);
  window.addEventListener("someonenear-theme", updateTheme);
  updateTheme();
  resize();
  tick();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    intersection.disconnect();
    window.removeEventListener("someonenear-theme", updateTheme);
    geometry.dispose();
    ringGeometry.dispose();
    dotGeometry.dispose();
    pathGeometries.forEach((item) => item.dispose());
    material.dispose();
    atmosphere.dispose();
    ringMaterial.dispose();
    dotMaterial.dispose();
    trails.dispose();
    mask.dispose();
    renderer.dispose();
  };
}
