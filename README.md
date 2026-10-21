# P66 Render Inspector

Extensió de Chrome que indica, a cada pàgina de La Vanguardia i Mundo Deportivo (`.com` i `.biz`), quin render l'ha servida: P66, Xalok, o Xalok com a fallback perquè P66 ha fallat. També mostra les versions dels assets i enllaça a la versió JSON del contingut.

## Què mostra

**Un widget flotant**, a dalt a la dreta per defecte.

- **Plegat:** el semàfor amb `P66` o `Xalok`. El fallback surt com a `Xalok` amb el punt taronja.
- **Desplegat:** tot el detall (vegeu més avall).
- Es plega i es desplega amb un clic al mateix widget o a la icona de l'extensió, i recorda l'últim estat.

| Semàfor | Icona | Significa | Com se sap |
| --- | --- | --- | --- |
| Verd | `P66` | El serveix P66 | `X-Backend-Response: p66-pro01/…`, `p66-test02/…`, o body amb classe `gg` |
| Taronja | `FB` | P66 ha fallat i Varnish ha retornat Xalok | `X-Backend-Response: p66-xalok-pro/…` o `p66-xalok-test/…` |
| Blau | `XK` | Xalok directe, no ha passat per P66 | Sense capçalera i body amb classe `xk` |
| Vermell | `!?` | La capçalera i el body es contradiuen | Per exemple, capçalera de P66 amb body `xk` |

**Desplegat:**

- **Resposta**: backend, capçalera completa, què diu el body, codi HTTP.
- **Pàgina**: dades de `ggPageData` (id, tipus, plantilla, facet, entorn, accés).
- **Enllaços**:
  - Versió JSON, amb el codi de resposta al costat.
  - La mateixa URL amb `?facet=cwvp` (demanar P66) o `?facet=cwvx` (demanar Xalok).
  - La versió AMP o web de l'article.
- **Assets**: versió de css, js, optimize i settings, amb la llista de fitxers. Si un tipus apareix amb dues versions, ho marca.
  - css, js i optimize surten de les URLs de ggcstatic (`/minified/{tipus}/{versió}/{fitxer}`).
  - A AMP el CSS va inline i la seva versió surt del comentari `<!-- 1.2.34 -->` que el precedeix.
  - Els settings només existeixen a AMP: cada bloc de settings comença amb `<!-- 0.1.31 -->`.
- **Publicitat**: la llibreria DAI, que es carrega des de `dai.grupogodo.com` (pro) o `dai.grupogodo.biz` (tes).
  - **DAI**: versió, entorn, carpeta del lloc (`lv`, `md`) i build. Surt de la URL de `/{carpeta}/{versió}/{minified|unminified}/index.js`. Les versions amb guionet, com `0.30.0-beta.1`, surten marcades com a prerelease.
  - **Adloader**: versió del carregador `/{carpeta}/adloader.js`, llegida del seu propi codi. El `?v=02` de la seva URL no és la versió.
  - **Override**: avís si la configuració de DAI està forçada amb `?dai=` a la URL o amb `localStorage.adloaderConfig`.
  - DAI es demana després de carregar la pàgina. El widget s'actualitza tan bon punt arriba. A AMP no hi ha DAI.
- **Errors ESI**: els `<!-- esi:error … -->` que hagi deixat Varnish.

## Versió JSON

El document que P66 té del contingut:

```
https://www.lavanguardia.com/politica/20261020/11663593/slug.html
  → https://p66.lavanguardia.com/contents/Xalok-11663593/json
```

El host és `p66.` + el domini de la pàgina: `p66.lavanguardia.com`, `p66.lavanguardia.biz`, `p66.mundodeportivo.com` o `p66.mundodeportivo.biz`. L'id surt de la URL, o de `ggPageData.contentId` si la URL no el porta. Les portades i seccions no en tenen.

## Opcions

Només la cantonada del widget: clic dret a la icona → **Opcions**.

## Instal·lar

1. Descarrega o clona aquesta carpeta (`p66-render-inspector/`).
2. A Chrome, obre `chrome://extensions` i activa el **Mode de desenvolupador** (a dalt a la dreta).
3. Prem **Carrega l'extensió sense empaquetar** i tria la carpeta `p66-render-inspector`.
4. Opcional: fixa la icona a la barra (la icona del trencaclosques → xinxeta) per veure l'estat sempre. Quan la pàgina té estat, la icona es converteix en un quadrat del color del semàfor amb el text (`P66`, `FB`, `XK`, `!?`).

Per actualitzar: baixa els canvis i prem el botó de recarregar de l'extensió a `chrome://extensions`. Funciona igual a Edge (`edge://extensions`) i a qualsevol Chromium.

Les pestanyes que ja estaven obertes en instal·lar-la no tenen dades fins que es recarreguen.

El `manifest.json` porta una clau pública (`key`), així que l'ID és sempre `ilhlmkjikoindjjhdjgmpnfojckggjcd`, a qualsevol PC i des de qualsevol carpeta. És l'ID que cal donar a IT per a la llista blanca.

## Permisos

| Permís | Per a què |
| --- | --- |
| `webRequest` | Llegir la capçalera `X-Backend-Response` del document. Des de la pàgina no es veu. |
| `storage` | Desar l'estat de cada pestanya, si el widget està plegat i la cantonada. |
| `*.lavanguardia.*`, `*.mundodeportivo.*` | Executar-se només en aquests dominis i comprovar que l'enllaç JSON (`p66.*`) respon. |

No envia res enlloc fora d'aquests dominis.

## Fitxers

```
manifest.json       Manifest V3
background.js       Captura la capçalera, dibuixa la icona, comprova l'enllaç JSON
content.js          Llegeix body, assets i ggPageData; pinta el widget
lib/render.js       Classificació del render, assets i URL del JSON (compartit)
options/            Cantonada del widget
icons/              16, 32, 48 i 128 px
```

La classificació segueix els mateixos senyals que `scripts/detect-render.js` del repo `aws-ggc-reports-url` (pipeline d'auditoria CWV).
