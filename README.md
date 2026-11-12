# Simulador Interactivo de Tráfico Ferroviario (Renfe/ADIF)

**Práctica: Visualización de Datos Geográficos (Sesión 8)**

Este proyecto es una visualización 3D interactiva desarrollada con **Three.js** que muestra en tiempo real (con tiempo acelerado) el tráfico de trenes de Alta Velocidad, Larga y Media Distancia por toda la Península Ibérica.

A diferencia de visualizaciones estáticas, este simulador no se limita a colocar puntos en un mapa, sino que recrea la red logística completa del país cruzando horarios, estaciones y rutas de trenes oficiales.

---

## Fuentes de Datos (Open Data)

Para garantizar el rigor del proyecto, se ha renunciado a crear datasets ficticios. El simulador se alimenta directamente del **Portal de Datos Abiertos de Renfe** utilizando el estándar internacional **GTFS (General Transit Feed Specification)**:

*   **`stops.txt`**: Catálogo oficial de las estaciones de la Red Ferroviaria con sus coordenadas GPS exactas (Latitud y Longitud).
*   **`stop_times.txt`**: Base de datos masiva con los movimientos, horarios de salida (`departure_time`) y horarios de llegada (`arrival_time`) de todos los trenes programados.

---

## Características y Originalidad

Para aportar un grado de complejidad técnica y originalidad superior a los ejemplos base, se han implementado las siguientes características:

1. **Teleindicadores Interactivos (`Raycaster`):** 
   Se ha habilitado la interacción por ratón. Al hacer clic sobre cualquier estación (esfera) del mapa, se despliega un "Panel ADIF" que cruza los datos de ambos archivos para mostrar el catálogo completo de llegadas y salidas de esa estación concreta a lo largo del día.
2. **Cámara de Seguimiento Dinámica (`Lerp`):**
   Al seleccionar un tren específico (desde el desplegable o haciendo clic en los horarios del panel de la estación), el simulador traza su ruta completa. Se ha añadido un botón **"Seguir Tren"** que utiliza interpolación lineal (`.lerp`) para que la cámara persiga fluidamente al tren en 3D durante todo su recorrido.

---

## Leyenda de Colores

El sistema de renderizado evalúa el estado de cada estación y tren en cada fotograma para aplicar un código de colores dinámico:

*  **Amarillo brillante:** Trenes en movimiento a lo largo de las vías (líneas cian).
*  **Verde Azulado:** Estaciones en reposo (sin tráfico en ese minuto).
*  **Violeta:** Estaciones actuando como origen (un tren acaba de partir).
*  **Rojo:** Estaciones actuando como destino (esperando la llegada de un tren en ese tramo).
*  **Azul Oscuro:** Estaciones de alto tránsito (actúan como origen de un tren y destino de otro simultáneamente en ese mismo fotograma, habitual en nudos como Madrid, Zaragoza o Barcelona).
*  **Verde Neón (Grande):** Estación actualmente seleccionada por el usuario con el ratón.

---

## Controles de Usuario

*   **Rotar / Acercar:** Clic izquierdo + Arrastrar para rotar la cámara. Rueda del ratón para hacer zoom.
*   **Desplegable Superior:** Permite aislar un tren específico de la red logística para ver su recorrido y tiempo estimado de llegada a la próxima estación.
*   **Botón "Seguir tren":** Activa el modo de cámara en persecución.
*   **Clic en Estaciones:** Usa el ratón para pinchar en cualquier punto del mapa y abrir su tablón horario oficial de Renfe. Al hacer clic en cualquier ruta de ese tablón, el simulador saltará a ese tren automáticamente.
