import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

let scene, renderer, camera, camcontrols;
let mapa, mapsx, mapsy;
let scale = 5;

// Limites mapa
let minlon = -9.95, maxlon = 3.8;
let minlat = 35.55, maxlat = 44.45;

let texturacargada = false;
let objetos = [];
let lineas;
let lineaRutaCompleta;
const bolas = [];

const geoBola = new THREE.SphereGeometry(0.025, 12, 12);
const matBola = new THREE.MeshBasicMaterial({ color: 0xffff00 });

let radarMesh;
const radarUniforms = {
  u_time: { value: 0.0 },
  u_color: { value: new THREE.Color(0x00ff88) },
};

const fechaInicio = new Date(2026, 10, 11);
let fechaActual;
let totalMinutos = 360; 

let fecha2show, infoRutaUI, selectorUI, btnSeguirUI, panelEstacionUI;
let pactivos = 0;

const datosSitycleta = [], datosEstaciones = [];
const infoTrenes = new Map();
const horariosPorEstacion = new Map();

let trenSeleccionado = "TODOS";
let estacionSeleccionada = null;
let seguirTren = false;

const raycaster = new THREE.Raycaster();
const raton = new THREE.Vector2();
let posClicInicio = { x: 0, y: 0 };

const opcionesfecha = {
  year: "numeric", month: "long", day: "numeric",
  hour: "2-digit", minute: "2-digit",
};

init();
animate();

function init() {
  fecha2show = document.createElement("div");
  fecha2show.style.position = "absolute";
  fecha2show.style.top = "15px";
  fecha2show.style.width = "100%";
  fecha2show.style.textAlign = "center";
  fecha2show.style.color = "#fff";
  fecha2show.style.fontWeight = "bold";
  fecha2show.style.backgroundColor = "rgba(0, 0, 0, 0.65)";
  fecha2show.style.zIndex = "1";
  fecha2show.style.fontFamily = "Monospace";
  fecha2show.innerHTML = "Cargando datos...";
  document.body.appendChild(fecha2show);

  const panelControles = document.createElement("div");
  panelControles.style.position = "absolute";
  panelControles.style.top = "45px";
  panelControles.style.width = "100%";
  panelControles.style.textAlign = "center";
  panelControles.style.zIndex = "2";
  panelControles.style.fontFamily = "Monospace";

  selectorUI = document.createElement("select");
  selectorUI.innerHTML = '<option value="TODOS">Mostrar todos los trenes</option>';
  selectorUI.addEventListener("change", (e) => seleccionarTren(e.target.value));
  panelControles.appendChild(selectorUI);

  btnSeguirUI = document.createElement("button");
  btnSeguirUI.innerText = "Seguir tren: OFF";
  btnSeguirUI.style.marginLeft = "8px";
  btnSeguirUI.disabled = true;
  btnSeguirUI.addEventListener("click", alternarSeguimiento);
  panelControles.appendChild(btnSeguirUI);

  infoRutaUI = document.createElement("div");
  infoRutaUI.style.marginTop = "5px";
  infoRutaUI.style.color = "#fff";
  infoRutaUI.style.backgroundColor = "rgba(0, 0, 0, 0.65)";
  panelControles.appendChild(infoRutaUI);

  document.body.appendChild(panelControles);

  panelEstacionUI = document.createElement("div");
  panelEstacionUI.style.position = "absolute";
  panelEstacionUI.style.top = "100px";
  panelEstacionUI.style.right = "15px";
  panelEstacionUI.style.width = "300px";
  panelEstacionUI.style.maxHeight = "380px";
  panelEstacionUI.style.overflowY = "auto";
  panelEstacionUI.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
  panelEstacionUI.style.color = "#fff";
  panelEstacionUI.style.padding = "10px";
  panelEstacionUI.style.fontFamily = "Monospace";
  panelEstacionUI.style.fontSize = "12px";
  panelEstacionUI.style.zIndex = "3";
  panelEstacionUI.style.display = "none";
  document.body.appendChild(panelEstacionUI);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 4.5;

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  camcontrols = new OrbitControls(camera, renderer.domElement);

  const geoRadar = new THREE.PlaneGeometry(0.4, 0.4);
  const matRadar = new THREE.ShaderMaterial({
    uniforms: radarUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float u_time;
      uniform vec3 u_color;
      varying vec2 vUv;

      void main() {
        float d = distance(vUv, vec2(0.5));
        float onda = sin(d * 35.0 - u_time * 4.0);
        float anillo = smoothstep(0.1, 0.5, onda) * smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(u_color, anillo * 0.85);
      }
    `,
  });
  radarMesh = new THREE.Mesh(geoRadar, matRadar);
  radarMesh.position.z = 0.015;
  radarMesh.visible = false;
  scene.add(radarMesh);

  renderer.domElement.addEventListener("pointerdown", (e) => {
    posClicInicio.x = e.clientX;
    posClicInicio.y = e.clientY;
  });

  renderer.domElement.addEventListener("pointerup", (e) => {
    const dx = e.clientX - posClicInicio.x;
    const dy = e.clientY - posClicInicio.y;
    if (Math.hypot(dx, dy) < 5) {
      detectarClicEstacion(e);
    }
  });

  const tx1 = new THREE.TextureLoader().load("src/mapa.png", function (texture) {
    const txaspectRatio = texture.image.width / texture.image.height;
    mapsy = scale;
    mapsx = mapsy * txaspectRatio;
    Plano(0, 0, 0, mapsx, mapsy);

    mapa.material.map = texture;
    mapa.material.needsUpdate = true;
    texturacargada = true;

    fetch("src/stops.txt")
      .then((response) => {
        if (!response.ok) throw new Error("Error: " + response.statusText);
        return response.text();
      })
      .then((content) => {
        procesarCSVEstaciones(content);
        return fetch("src/stop_times.txt");
      })
      .then((response) => {
        if (!response.ok) throw new Error("Error: " + response.statusText);
        return response.text();
      })
      .then((content) => {
        procesarCSVAlquileres(content);
      })
      .catch((error) => console.error("Error al cargar el archivo:", error));
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function latAMercator(lat) {
  return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
}

function procesarCSVEstaciones(content) {
  const sep = ",";
  const filas = content.split("\n");
  const encabezados = filas[0].trim().split(sep);

  const indices = {
    id: encabezados.indexOf("stop_id"),
    nombre: encabezados.indexOf("stop_name"),
    lat: encabezados.indexOf("stop_lat"),
    lon: encabezados.indexOf("stop_lon"),
  };

  const minMerc = latAMercator(minlat);
  const maxMerc = latAMercator(maxlat);

  for (let i = 1; i < filas.length; i++) {
    const columna = filas[i].trim().split(sep);
    if (columna.length > 5) {
      let lat = parseFloat(columna[indices.lat]);
      let lon = parseFloat(columna[indices.lon]);
      
      if (isNaN(lat) || isNaN(lon)) continue;
      if (lat < minlat || lat > maxlat || lon < minlon || lon > maxlon) continue;

      let mlon = Map2Range(lon, minlon, maxlon, -mapsx / 2, mapsx / 2);
      let mlat = Map2Range(latAMercator(lat), minMerc, maxMerc, -mapsy / 2, mapsy / 2);

      const idEst = columna[indices.id].trim();
      datosEstaciones.push({
        id: idEst,
        nombre: columna[indices.nombre].trim(),
        lat: lat,
        lon: lon,
        latmap: mlat,
        longmap: mlon,
      });

      horariosPorEstacion.set(idEst, []);
      Esfera(mlon, mlat, 0, 0.015, 10, 10, 0x009688); 
    }
  }
}

function procesarCSVAlquileres(content) {
  const sep = ",";
  const filas = content.split("\n");
  const encabezados = filas[0].trim().split(sep);

  const indices = {
    trip_id: encabezados.indexOf("trip_id"),
    t_fin: encabezados.indexOf("arrival_time"),
    t_inicio: encabezados.indexOf("departure_time"),
    stop_id: encabezados.indexOf("stop_id"),
    seq: encabezados.indexOf("stop_sequence"),
  };

  const mapaEstaciones = new Map(datosEstaciones.map((e) => [e.id, e]));
  const trenesUnicos = new Map();
  let paradaAnterior = null;

  for (let i = 1; i < filas.length; i++) {
    const columna = filas[i].trim().split(sep);
    if (columna.length > 4) {
      const trip_id = columna[indices.trip_id].trim();
      const codTren = trip_id.substring(0, 6);

      if (!trenesUnicos.has(codTren)) {
        trenesUnicos.set(codTren, trip_id);
      }
      if (trenesUnicos.get(codTren) !== trip_id) continue;

      const stop_id = columna[indices.stop_id].trim();
      if (!mapaEstaciones.has(stop_id)) continue;

      const strLlegada = columna[indices.t_fin].trim();
      const strSalida = columna[indices.t_inicio].trim();
      const t_llegada = convertirFecha(strLlegada);
      const t_salida = convertirFecha(strSalida);
      const seq = parseInt(columna[indices.seq], 10);

      if (horariosPorEstacion.has(stop_id)) {
        horariosPorEstacion.get(stop_id).push({
          tren: codTren,
          tiempo: t_salida,
          horaStr: strSalida.substring(0, 5),
        });
      }

      if (paradaAnterior && paradaAnterior.trip_id === trip_id && seq > paradaAnterior.seq) {
        datosSitycleta.push({
          tren: codTren,
          t_inicio: paradaAnterior.t_salida,
          t_fin: t_llegada,
          p_inicio: paradaAnterior.stop_id,
          p_fin: stop_id,
        });

        if (!infoTrenes.has(codTren)) {
          infoTrenes.set(codTren, {
            id: codTren,
            origen: mapaEstaciones.get(paradaAnterior.stop_id).nombre,
            destino: mapaEstaciones.get(stop_id).nombre,
            t_inicio: paradaAnterior.t_salida,
            t_fin: t_llegada,
            paradas: [paradaAnterior.stop_id, stop_id],
          });
        } else {
          const info = infoTrenes.get(codTren);
          info.destino = mapaEstaciones.get(stop_id).nombre; 
          info.t_fin = t_llegada;
          info.paradas.push(stop_id);
        }
      }

      paradaAnterior = {
        trip_id: trip_id,
        stop_id: stop_id,
        t_salida: t_salida,
        seq: seq,
      };
    }
  }

  infoTrenes.forEach((info, codTren) => {
    const opt = document.createElement("option");
    opt.value = codTren;
    opt.innerText = `Tren ${codTren}: ${info.origen} - ${info.destino}`;
    selectorUI.appendChild(opt);
  });
}

function detectarClicEstacion(event) {
  if (!texturacargada) return;

  raton.x = (event.clientX / window.innerWidth) * 2 - 1;
  raton.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(raton, camera);
  const intersecciones = raycaster.intersectObjects(objetos);

  if (intersecciones.length > 0) {
    const idx = objetos.indexOf(intersecciones[0].object);
    if (idx !== -1) {
      mostrarPanelEstacion(datosEstaciones[idx]);
    }
  }
}

function mostrarPanelEstacion(estacion) {
  estacionSeleccionada = estacion;
  trenSeleccionado = "TODOS";
  selectorUI.value = "TODOS";
  seguirTren = false;
  btnSeguirUI.innerText = "Seguir tren: OFF";
  btnSeguirUI.disabled = true;

  radarMesh.position.set(estacion.longmap, estacion.latmap, 0.015);
  radarUniforms.u_color.value.setHex(0x00ff88);
  radarMesh.visible = true;

  if (lineaRutaCompleta) {
    scene.remove(lineaRutaCompleta);
    lineaRutaCompleta.geometry.dispose();
    lineaRutaCompleta = null;
  }

  infoRutaUI.innerHTML = "Estación seleccionada: " + estacion.nombre;
  panelEstacionUI.style.display = "block";
  panelEstacionUI.innerHTML = "";

  const cabecera = document.createElement("div");
  const titulo = document.createElement("b");
  titulo.innerText = estacion.nombre;
  cabecera.appendChild(titulo);

  const btnCerrar = document.createElement("button");
  btnCerrar.innerText = "Cerrar";
  btnCerrar.style.float = "right";
  btnCerrar.onclick = () => {
    estacionSeleccionada = null;
    radarMesh.visible = false;
    panelEstacionUI.style.display = "none";
    infoRutaUI.innerHTML = "";
  };
  cabecera.appendChild(btnCerrar);
  panelEstacionUI.appendChild(cabecera);
  panelEstacionUI.appendChild(document.createElement("hr"));

  const lista = horariosPorEstacion.get(estacion.id) || [];
  lista.sort((a, b) => a.tiempo - b.tiempo);

  if (lista.length === 0) {
    const vacio = document.createElement("p");
    vacio.innerText = "Sin trenes registrados.";
    panelEstacionUI.appendChild(vacio);
    return;
  }

  for (const item of lista) {
    const info = infoTrenes.get(item.tren);
    if (!info) continue;

    const fila = document.createElement("div");
    fila.style.marginBottom = "6px";

    const btnRuta = document.createElement("button");
    btnRuta.innerText = `${item.horaStr} | ${info.origen} -> ${info.destino}`;
    btnRuta.style.width = "100%";
    btnRuta.style.textAlign = "left";
    btnRuta.style.cursor = "pointer";
    btnRuta.onclick = () => {
      selectorUI.value = item.tren;
      seleccionarTren(item.tren);
    };

    fila.appendChild(btnRuta);
    panelEstacionUI.appendChild(fila);
  }
}

function seleccionarTren(codTren) {
  trenSeleccionado = codTren;
  estacionSeleccionada = null; 
  panelEstacionUI.style.display = "none";

  if (lineaRutaCompleta) {
    scene.remove(lineaRutaCompleta);
    lineaRutaCompleta.geometry.dispose();
    lineaRutaCompleta = null;
  }

  if (trenSeleccionado === "TODOS") {
    seguirTren = false;
    radarMesh.visible = false;
    btnSeguirUI.innerText = "Seguir tren: OFF";
    btnSeguirUI.disabled = true;
    infoRutaUI.innerHTML = "";
    camera.position.set(0, 0, 4.5);
    camcontrols.target.set(0, 0, 0);
    camcontrols.update();
  } else {
    btnSeguirUI.disabled = false;
    radarUniforms.u_color.value.setHex(0xffaa00);
    radarMesh.visible = true;
    const info = infoTrenes.get(trenSeleccionado);
    if (info) {
      totalMinutos = (info.t_inicio - fechaInicio) / 60000;
      dibujarRutaCompleta(info.paradas);
    }
  }
}

function alternarSeguimiento() {
  seguirTren = !seguirTren;
  if (seguirTren) {
    btnSeguirUI.innerText = "Seguir tren: ON";
  } else {
    btnSeguirUI.innerText = "Seguir tren: OFF";
    camera.position.set(0, 0, 4.5);
    camcontrols.target.set(0, 0, 0);
    camcontrols.update();
  }
}

function dibujarRutaCompleta(idsParadas) {
  const pts = [];
  for (const id of idsParadas) {
    const est = datosEstaciones.find((e) => e.id === id);
    if (est) {
      pts.push(new THREE.Vector3(est.longmap, est.latmap, 0.005));
    }
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: 0xffaa00 });
  lineaRutaCompleta = new THREE.Line(geo, mat);
  scene.add(lineaRutaCompleta);
}

function Map2Range(val, vmin, vmax, dmin, dmax) {
  let t = 1 - (vmax - val) / (vmax - vmin);
  return dmin + t * (dmax - dmin);
}

function Esfera(px, py, pz, radio, nx, ny, col) {
  let geometry = new THREE.SphereBufferGeometry(radio, nx, ny);
  let material = new THREE.MeshBasicMaterial({ color: col });
  let mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(px, py, pz);
  objetos.push(mesh);
  scene.add(mesh);
}

function Plano(px, py, pz, sx, sy) {
  let geometry = new THREE.PlaneGeometry(sx, sy);
  let material = new THREE.MeshBasicMaterial({});
  let mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(px, py, pz);
  scene.add(mesh);
  mapa = mesh;
}

function convertirFecha(horaStr) {
  const [horas, minutos, segundos] = horaStr.trim().split(":").map(Number);
  return new Date(
    fechaInicio.getFullYear(),
    fechaInicio.getMonth(),
    fechaInicio.getDate(),
    horas,
    minutos,
    segundos || 0
  );
}

function actualizarFecha() {
  totalMinutos += trenSeleccionado === "TODOS" ? 0.25 : 0.15;

  if (trenSeleccionado !== "TODOS") {
    const info = infoTrenes.get(trenSeleccionado);
    if (info) {
      const minFin = (info.t_fin - fechaInicio) / 60000;
      const minIni = (info.t_inicio - fechaInicio) / 60000;
      if (totalMinutos > minFin + 5) {
        totalMinutos = minIni;
      }
    }
  } else if (totalMinutos >= 1440) {
    totalMinutos = 360;
  }

  fechaActual = new Date(fechaInicio.getTime() + totalMinutos * 60000);
}

function filtraparadasActivas() {
  for (const b of bolas) {
    b.visible = false;
  }

  const registrosFiltrados = datosSitycleta.filter((registro) => {
    const activoEnHora = registro.t_inicio <= fechaActual && registro.t_fin >= fechaActual;
    if (!activoEnHora) return false;

    if (trenSeleccionado !== "TODOS") {
      return registro.tren === trenSeleccionado;
    }

    if (estacionSeleccionada) {
      const info = infoTrenes.get(registro.tren);
      return info && info.paradas.includes(estacionSeleccionada.id);
    }

    return true;
  });

  if (lineas) {
    scene.remove(lineas);
    lineas.geometry.dispose();
  }

  const buscaEstacion = (id) => datosEstaciones.find((e) => e.id === id);

  const pts = [];
  let nBolas = 0;
  
  for (const r of registrosFiltrados) {
    const a = buscaEstacion(r.p_inicio);
    const b = buscaEstacion(r.p_fin);

    if (a && b) {
      pts.push(new THREE.Vector3(a.longmap, a.latmap, 0.01));
      pts.push(new THREE.Vector3(b.longmap, b.latmap, 0.01));

      if (a !== b) {
        const dur = Math.max(r.t_fin - r.t_inicio, 60000);
        const t = Math.min(1, Math.max(0, (fechaActual - r.t_inicio) / dur));
        
        if (!bolas[nBolas]) {
          const m = new THREE.Mesh(geoBola, matBola);
          scene.add(m);
          bolas.push(m);
        }
        
        const bx = a.longmap + (b.longmap - a.longmap) * t;
        const by = a.latmap + (b.latmap - a.latmap) * t;

        bolas[nBolas].position.set(bx, by, 0.02);
        bolas[nBolas].visible = true;

        if (trenSeleccionado !== "TODOS") {
          const minRestantes = Math.max(0, Math.round((r.t_fin - fechaActual) / 60000));
          infoRutaUI.innerHTML = `Tramo: ${a.nombre} -> ${b.nombre} (${minRestantes} min)`;

          radarMesh.position.set(bx, by, 0.015);

          if (seguirTren) {
            camcontrols.target.lerp(new THREE.Vector3(bx, by, 0), 0.1);
            camera.position.lerp(new THREE.Vector3(bx, by - 0.7, 1.1), 0.05);
            camcontrols.update();
          }
        }
        nBolas++;
      }
    }
  }

  lineas = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x00ffff })
  );
  scene.add(lineas);

  pactivos = registrosFiltrados.length;

  const estacionesA = new Set(registrosFiltrados.map((r) => r.p_inicio));
  const estacionesB = new Set(registrosFiltrados.map((r) => r.p_fin));

  let i = 0;
  for (const estacion of datosEstaciones) {
    if (estacionSeleccionada && estacion.id === estacionSeleccionada.id) {
      objetos[i].material.color.set(0x00ff00);
      objetos[i].scale.set(3, 3, 3);
    } else if (estacionesA.has(estacion.id) || estacionesB.has(estacion.id)) {
      if (estacionesA.has(estacion.id) && estacionesB.has(estacion.id))
        objetos[i].material.color.set(0x005aa0);
      else {
        if (estacionesA.has(estacion.id))
          objetos[i].material.color.set(0x8a2be2);
        else objetos[i].material.color.set(0xc81e3c); 
      }
      objetos[i].scale.set(2, 2, 2);
    } else {
      objetos[i].material.color.set(0x009688);
      objetos[i].scale.set(1, 1, 1);
    }
    i++;
  }
}

function animate() {
  if (texturacargada) {
    actualizarFecha();
    filtraparadasActivas();

    radarUniforms.u_time.value += 0.08;

    fecha2show.innerHTML = fechaActual.toLocaleString("es-ES", opcionesfecha);
    fecha2show.innerHTML += " · " + pactivos + " trenes en circulación";
  }

  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
