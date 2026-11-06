# Generar releases

- Crear el instalador de Windows: `npm run dist:win`
- Empaquetar la aplicación sin crear instalador: `npm run pack:win`
- Publicar la release de Windows en GitHub: configura `GH_TOKEN` con permiso para publicar en `GALHAKPRO988/Meld` y ejecuta `npm run release:win`. Electron Builder sube el instalador y `latest.yml`, que Electron usa para descargar e instalar actualizaciones.

Los archivos generados se guardan en `release/`. Antes de publicar, incrementa `version` en `package.json` y crea una release/tag con la misma versión (por ejemplo, `v1.0.1`). La versión mostrada por Meld se lee del `package.json`.

En Windows, la primera versión con el actualizador debe instalarse manualmente en las instalaciones existentes. Después, la aplicación descarga e instala el nuevo instalador cuando el usuario pulsa «Descargar e instalar» y se reinicia. En navegador se descarga el `.exe` para que el usuario lo ejecute.

En Android se descarga el APK correcto, pero Android siempre requiere que el usuario confirme la instalación. iOS no admite instalar IPA desde GitHub: para actualizar Meld allí hace falta distribuir la aplicación por App Store o TestFlight y enlazar esa ficha.
