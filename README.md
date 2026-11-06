<p align="center">
  <img src="logo.png" alt="Logo de Meld" width="180" />
</p>

<h1 align="center">Meld</h1>

<p align="center">
  <strong>Organízalo todo. Sin nube, sin cuentas.</strong><br />
  Páginas, tareas, calendario y diario en una sola app.<br />
  Tus datos viven en tu dispositivo y la IA usa tu propia API key.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/licencia-AGPL--3.0-blue" alt="Licencia AGPL v3" /></a>
</p>

> Meld está en desarrollo activo. Algunas funciones de instalación o distribución móvil dependen de que haya un artefacto publicado para tu plataforma.

## Contenido

- [Qué puedes hacer](#qué-puedes-hacer)
- [Privacidad y almacenamiento](#privacidad-y-almacenamiento)
- [Instalación y actualizaciones](#instalación-y-actualizaciones)
- [Desarrollo](#desarrollo)
- [Tecnologías](#tecnologías)
- [Estructura](#estructura)
- [Licencia y contacto](#licencia-y-contacto)

## Qué puedes hacer

### Páginas y editor

- Escribe en un editor visual basado en Tiptap o cambia al modo Markdown.
- Se conserva el contenido HTML para mantener el formato y se deriva Markdown para exportar y usar con la IA.
- Usa formato enriquecido, encabezados, listas y listas de tareas, tablas, bloques de código con resaltado, imágenes, callouts, desplegables y fórmulas.
- Crea enlaces entre páginas escribiendo `[[` y copia el contenido como Markdown.
- Organiza páginas en carpetas y con tags; fíjalas para tenerlas a mano.
- Los adjuntos se guardan localmente junto a tus datos.

### Tareas

- Añade vencimientos, horas, prioridades, subtareas, repetición, tags y carpetas.
- Consulta las vistas Hoy, Próximas, Todas y Completadas, y revisa el progreso del día.
- Crea tareas rápidamente con lenguaje natural, por ejemplo: `Comprar pan mañana a las 10 #casa`.
- Fija las tareas importantes. Al completar una tarea hay feedback háptico en dispositivos compatibles; completar todas las tareas previstas para hoy activa una celebración.

### Calendario

- Consulta eventos y tareas con fecha en vistas de mes, semana y día.
- Crea eventos con repetición, color, tags y recordatorios locales. Las notificaciones dependen del permiso y soporte del dispositivo o navegador.

### Carpetas, tags y búsqueda

- Agrupa páginas y tareas en carpetas anidables.
- Usa tags con color en páginas, tareas y eventos.
- Busca contenido de la app desde la sección Buscar o con **Ctrl+F** (Windows/Linux) o **⌘+F** (macOS).

### Diario

- El diario es opcional y está desactivado inicialmente.
- Escribe una entrada por día, añade un estado de ánimo y consulta tu racha.
- Desactivarlo oculta la sección, pero no elimina tus entradas.

### Asistente de IA opcional

- Configura tu propia clave de Anthropic, OpenAI, Google u OpenRouter.
- Decide qué secciones puede consultar la IA y si tiene acceso de solo lectura o también de escritura.
- Las acciones de escritura de la IA ofrecen una opción para deshacer.

### Personalización y copias

- Elige tema claro u oscuro y reduce las animaciones.
- Instala Meld como aplicación web desde un navegador compatible.
- Exporta una copia JSON de tus datos, descarga un ZIP con páginas y entradas en Markdown, o importa una copia JSON. También puedes borrar los datos desde Ajustes.

## Privacidad y almacenamiento

- **Datos de la app:** páginas, tareas, eventos, diario, chats y adjuntos se almacenan localmente en IndexedDB mediante Dexie. La configuración, incluidas las claves de API, se conserva en el almacenamiento local del navegador.
- **Sin cuenta ni sincronización de Meld:** el proyecto no proporciona un backend para guardar o sincronizar tus datos.
- **IA bajo tu control:** si usas el asistente, el texto de tu solicitud y el contexto permitido por tus ajustes se envían directamente desde tu dispositivo al proveedor elegido. Meld no opera un servidor intermediario para esas llamadas. El proveedor procesa las solicitudes según sus propias condiciones.
- **Claves API:** se guardan en el almacenamiento local del navegador y no están cifradas por Meld. Usa claves con límites de gasto y evita guardar claves en dispositivos compartidos.
- **Actualizaciones:** la comprobación de versiones consulta la API pública de GitHub Releases. La actualización automática de Windows usa además los artefactos publicados en esa release.
- **Tipografía:** la interfaz solicita Inter y JetBrains Mono a Google Fonts.
- **Entorno de desarrollo:** una vista previa de Lovable puede inyectar un servicio de captura de errores; ese hook solo reporta si el entorno lo proporciona.

Si borras los datos del sitio o del perfil del navegador, puedes perder la base local y las claves guardadas. Exporta copias periódicamente y guárdalas en un lugar seguro. Los datos del navegador y los de la aplicación de escritorio pueden pertenecer a perfiles/orígenes distintos; no asumas que se sincronizan entre sí.

## Instalación y actualizaciones

### Aplicación web

Abre Meld en un navegador compatible y, si lo deseas, usa la opción del navegador para instalarla o añadirla a la pantalla de inicio. La aplicación web necesita que su sitio esté disponible; que los datos estén almacenados localmente no significa que la web funcione sin conexión.

### Windows

Descarga el instalador `.exe` de la sección [Releases](https://github.com/GALHAKPRO988/Meld/releases). La app de escritorio usa Electron. Cuando hay una versión posterior publicada, la app puede descargarla e instalarla; la primera versión que incluya el actualizador debe instalarse manualmente en las instalaciones anteriores.

### Android e iOS

- **Android:** la comprobación de actualizaciones puede ofrecer el APK si la release pública incluye uno. Android siempre solicita confirmar la instalación; la instalación también puede depender de los permisos del dispositivo.
- **iOS:** GitHub no instala una app iOS directamente. La distribución y las actualizaciones deben hacerse mediante App Store o TestFlight.

La comprobación de actualizaciones usa la release pública más reciente de [GALHAKPRO988/Meld](https://github.com/GALHAKPRO988/Meld/releases). Para que funcione, el repositorio debe ser accesible públicamente y tener una release publicada con una etiqueta de versión superior a la instalada. La descarga específica depende de que esa release incluya un archivo compatible.

## Desarrollo

### Requisitos

- Node.js **20.19+** o **22.12+**.
- npm (se incluye con Node.js).
- Git.

### Preparar el proyecto

```bash
git clone https://github.com/GALHAKPRO988/Meld.git
cd Meld
npm ci
npm run dev
```

El servidor de desarrollo mostrará la dirección local en la terminal.

### Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo. |
| `npm run build` | Genera el build de producción web/SSR. |
| `npm run build:ios` | Genera el shell SPA local que carga Capacitor para iOS. |
| `npx cap sync ios` | Copia el build web y sincroniza los plugins nativos de iOS. |
| `npm run preview` | Previsualiza el build de producción. |
| `npm test` | Ejecuta las pruebas una vez. |
| `npm run test:watch` | Ejecuta las pruebas en modo watch. |
| `npm run lint` | Ejecuta ESLint. |
| `npm run pack:win` | Empaqueta la app de Windows sin crear instalador. |
| `npm run dist:win` | Genera el instalador de Windows. |
| `npm run release:win` | Genera y publica una release de Windows en GitHub. |

### Publicar una release de Windows

1. Actualiza `version` en `package.json`.
2. Crea y publica una release de GitHub cuyo tag coincida con esa versión (por ejemplo, `v1.0.1`).
3. Configura `GH_TOKEN` en el entorno con un token que tenga permiso para publicar en `GALHAKPRO988/Meld`.
4. Ejecuta `npm run release:win`. Electron Builder publicará el instalador y `latest.yml`, necesario para el actualizador de Windows.
5. Retira el token del entorno después de publicar.

En PowerShell, el paso del token puede hacerse así; reemplaza el marcador localmente y **no lo guardes en el repositorio**:

```powershell
$env:GH_TOKEN = "<tu-token>"
npm run release:win
$env:GH_TOKEN = $null
```

Los artefactos generados se guardan en `release/`. Para más detalles, consulta [RELEASES.md](RELEASES.md).

La versión que muestra la aplicación se obtiene de `package.json`. Para la actualización automática de Windows, la publicación debe contener los metadatos y archivos generados por Electron Builder. La distribución Android/iOS requiere sus propios artefactos y canales; `release:win` solo publica Windows.

### Compilar iOS con Codemagic

El build web habitual de TanStack Start genera un servidor Node para SSR; no se puede incluir ese servidor en el WebView de iOS. `npm run build:ios` genera un shell SPA estático en `dist/client` solo para la compilación móvil, sin cambiar el build SSR de la web. `npx cap sync ios` copia ese shell y los recursos de Capacitor al proyecto Xcode.

El workflow `ios-release` de `codemagic.yaml` compila y firma el IPA. En Codemagic, configura la firma de Apple para el identificador `com.seacraft2net.spliteasy` con distribución App Store y añade un certificado Apple Distribution y su provisioning profile de App Store en **Code signing identities**. El workflow los obtiene por `distribution_type` e `bundle_identifier`; no guardes certificados, perfiles, contraseñas ni claves privadas en el repositorio. Al finalizar, descarga el `.ipa` desde **Artifacts** del build.

SplitEasy no utiliza autenticación ni un backend propio. Los datos se guardan en el almacenamiento local de la aplicación; las funciones de IA requieren las claves que configure el usuario y acceso a Internet para comunicarse directamente con el proveedor.

## Tecnologías

- **Aplicación:** React, TypeScript, TanStack Start y TanStack Router.
- **Estilos y movimiento:** Tailwind CSS v4 y Framer Motion.
- **Editor:** Tiptap / ProseMirror.
- **Datos locales:** Dexie sobre IndexedDB; Zustand para preferencias persistentes.
- **IA:** Vercel AI SDK y adaptadores de Anthropic, OpenAI, Google y OpenRouter.
- **Escritorio:** Electron y electron-updater.
- **Móvil:** Capacitor para Android e iOS; Codemagic compila el IPA firmado en macOS.
- **Pruebas y calidad:** Vitest y ESLint.

## Estructura

```text
src/
├── components/       # Interfaz, editor, chat, tareas y componentes Liquid Glass
├── hooks/            # Hooks compartidos
├── lib/
│   ├── ai/           # Proveedores, herramientas y permisos de IA
│   ├── db.ts         # Esquema local de Dexie
│   ├── backup.ts     # Exportación e importación
│   ├── settings.ts   # Preferencias persistentes
│   └── updater.ts    # Consulta de GitHub Releases
├── routes/           # Rutas TanStack, con URLs en español
├── test/             # Pruebas
└── types/            # Tipos compartidos
electron/             # Proceso principal y preload de Electron
public/               # Iconos, manifest y recursos públicos
```

Rutas principales: `/` (inicio/IA), `/paginas`, `/tareas`, `/calendario`, `/carpetas`, `/tags`, `/diario`, `/buscar` y `/ajustes`.

## Licencia y contacto

Meld se distribuye bajo la licencia **GNU AGPL v3.0**. Consulta el archivo [LICENSE](LICENSE).

- Repositorio y versiones: [github.com/GALHAKPRO988/Meld](https://github.com/GALHAKPRO988/Meld)
- Soporte: [soporte@seacraft2.net](mailto:soporte@seacraft2.net)
