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

Al Chrome corporatiu, l'extensió s'instal·la arrossegant el `.crx` signat a `chrome://extensions`, després d'actualitzar les polítiques amb `gpupdate /force`. Pas a pas: **[docs/INSTALACION.md](docs/INSTALACION.md)**.

El `.crx` es descarrega de les [Releases](https://github.com/egaray-gsc/p66-render-inspector/releases/latest), dins d'un `.zip` perquè Chrome no el bloquegi com a fitxer sospitós.

L'ID és sempre `ilhlmkjikoindjjhdjgmpnfojckggjcd`: el `manifest.json` porta la clau pública (`key`) i el `.crx` es signa amb la clau privada corresponent. És l'ID que IT té a la llista blanca. Si canvia la clau, canvia l'ID i cal tornar a demanar-ho a IT.

### Per desenvolupar

En un Chrome sense polítiques d'empresa (o a Edge, `edge://extensions`):

1. Clona el repositori.
2. Obre `chrome://extensions` i activa el **Mode de desenvolupador** (a dalt a la dreta).
3. Prem **Carrega l'extensió sense empaquetar** i tria la carpeta del repositori.

Per veure els canvis, prem el botó de recarregar de l'extensió a `chrome://extensions`. Les pestanyes que ja estaven obertes no tenen dades fins que es recarreguen.

## Publicar una versió nova

1. Puja `version` a `manifest.json` (per exemple, de `1.2.0` a `1.2.1`).
2. Fes push a `main`.

El workflow [`.github/workflows/release.yml`](.github/workflows/release.yml) fa la resta:

- Empaqueta els fitxers de l'extensió i els signa amb `scripts/pack-crx.js` (format CRX3, sense dependències).
- Comprova que la clau dona l'ID `ilhlmkjikoindjjhdjgmpnfojckggjcd`. Si no, falla.
- Crea la release `vX.Y.Z` amb `p66-render-inspector-X.Y.Z.zip`, que conté el `.crx`.

Si es fa push sense canviar la versió, el workflow no publica res i deixa un avís. També es pot llançar a mà des de la pestanya **Actions** (*Run workflow*).

La clau privada és al secret del repositori `CRX_PRIVATE_KEY` (el contingut del `.pem`). No es puja mai al repositori. Per canviar-la:

```bash
gh secret set CRX_PRIVATE_KEY -R egaray-gsc/p66-render-inspector < p66-render-inspector-key.pem
```

Per generar un `.crx` en local amb la mateixa clau:

```bash
node scripts/pack-crx.js extensio.zip p66-render-inspector-key.pem p66-render-inspector.crx ilhlmkjikoindjjhdjgmpnfojckggjcd
```

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
scripts/pack-crx.js Signa el .zip de l'extensió i en fa un .crx (el fa servir el workflow)
.github/workflows/  Release automàtica en canviar la versió
docs/               Guia d'instal·lació i sol·licitud a IT
```

La classificació segueix els mateixos senyals que `scripts/detect-render.js` del repo `aws-ggc-reports-url` (pipeline d'auditoria CWV).
