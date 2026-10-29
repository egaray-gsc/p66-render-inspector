# Instalar P66 Render Inspector

En el Chrome de empresa solo se puede instalar arrastrando el `.crx` a `chrome://extensions`. IT tiene autorizado el ID `ilhlmkjikoindjjhdjgmpnfojckggjcd`.

1. **Actualiza las políticas.** En PowerShell o CMD ejecuta `gpupdate /force` y cierra todas las ventanas de Chrome.
2. **Descarga** `p66-render-inspector-X.Y.Z.zip` de las [Releases](https://github.com/egaray-gsc/p66-render-inspector/releases/latest) y descomprímelo. Dentro está el `.crx`.
3. **Instala:** abre `chrome://extensions`, arrastra el `.crx` encima de la página y pulsa **Añadir extensión**.

Para **actualizar**, repite los pasos 2 y 3 con la versión nueva. Se mantiene la configuración.

## Si falla

| Problema | Solución |
| --- | --- |
| "Bloqueada por el administrador" | La política aún no ha llegado. Repite el paso 1 o reinicia el PC. En `chrome://policy` debe aparecer el ID. |
| Chrome descarga el `.crx` en vez de instalarlo | Suéltalo sobre la pestaña `chrome://extensions`, no sobre otra. |
| Ya la tenías cargada sin empaquetar | Elimínala antes en `chrome://extensions`. |
| No aparece el widget | Recarga la página (F5). |
