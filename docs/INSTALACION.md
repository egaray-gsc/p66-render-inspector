# Instalar P66 Render Inspector

En el Chrome de empresa solo se puede instalar arrastrando el `.crx` a `chrome://extensions`. IT tiene autorizado el ID `ilhlmkjikoindjjhdjgmpnfojckggjcd`.

1. **Actualiza las políticas.** En PowerShell o CMD ejecuta `gpupdate /force` y cierra todas las ventanas de Chrome.
2. **Descarga** `p66-render-inspector-X.Y.Z.zip` de las [Releases](https://github.com/egaray-gsc/p66-render-inspector/releases/latest) y descomprímelo. Dentro está el `.crx`.
3. **Instala:** abre `chrome://extensions`, arrastra el `.crx` encima de la página y pulsa **Añadir extensión**.

## Actualizaciones

Desde la versión 1.3.0 la extensión se actualiza sola. Chrome busca una versión nueva cada pocas horas y la instala sin avisar. Se mantiene la configuración.

- **Para forzar la comprobación:** en `chrome://extensions`, activa el **Modo de desarrollador** y pulsa **Actualizar**.
- **Si tienes la 1.2.0 o anterior:** instala una última vez a mano la versión actual (pasos 2 y 3). A partir de ahí se actualiza sola.

## Si falla

| Problema | Solución |
| --- | --- |
| "Bloqueada por el administrador" | La política aún no ha llegado. Repite el paso 1 o reinicia el PC. En `chrome://policy` debe aparecer el ID. |
| Chrome descarga el `.crx` en vez de instalarlo | Suéltalo sobre la pestaña `chrome://extensions`, no sobre otra. |
| Ya la tenías cargada sin empaquetar | Elimínala antes en `chrome://extensions`. |
| No aparece el widget | Recarga la página (F5). |
