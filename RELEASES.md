# Generar releases

- Crear el instalador de Windows: `npm run dist:win`
- Empaquetar la aplicación sin crear instalador: `npm run pack:win` (genera `release/win-unpacked/`; se puede comprimir esa carpeta como ZIP portable).
- Crear el APK de Android: `npm run build:android`, `npx cap sync android` y, desde `android/`, `.\gradlew.bat assembleDebug` en Windows. El APK debug se genera en `android/app/build/outputs/apk/debug/app-debug.apk`.
- Publicar la release de Windows en GitHub: configura `GH_TOKEN` con permiso para publicar en `GALHAKPRO988/Meld` y ejecuta `npm run release:win`. La app consulta el JSON de la última release de GitHub, selecciona `Meld-Setup_v<version>.exe` y verifica su SHA-256 antes de instalarlo; no necesita `latest.yml`.

Los archivos generados se guardan en `release/`. Antes de publicar, incrementa `version` en `package.json` y crea una release/tag con la misma versión (por ejemplo, `v1.0.1`). La versión mostrada por Meld se lee del `package.json`.

En Windows, las instalaciones que aún usan el actualizador anterior deben instalar manualmente una versión con este flujo nuevo. Después, la aplicación descarga e instala el instalador de la release más reciente cuando el usuario pulsa «Descargar e instalar» y se reinicia. En navegador se descarga el `.exe` para que el usuario lo ejecute.

En Android se descarga el APK correcto, pero Android siempre requiere que el usuario confirme la instalación. iOS no admite instalar IPA desde GitHub: para actualizar Meld allí hace falta distribuir la aplicación por App Store o TestFlight y enlazar esa ficha.
