# Instal·lar P66 Render Inspector

Guia per instal·lar l'extensió al Chrome corporatiu. Són cinc minuts.

IT ha autoritzat l'extensió per al seu ID, `ilhlmkjikoindjjhdjgmpnfojckggjcd`. Al Chrome de l'empresa no es pot instal·lar des de la Chrome Web Store ni carregant la carpeta: l'única via és arrossegar el fitxer `.crx` a la pàgina d'extensions.

## Abans de començar

- Windows amb el Chrome de l'empresa.
- Accés al repositori [egaray-gsc/p66-render-inspector](https://github.com/egaray-gsc/p66-render-inspector). Si no el tens, demana'l a Enric Garay.

## 1. Actualitzar les polítiques del PC

Chrome només deixa instal·lar l'extensió quan la política d'IT que l'autoritza ja ha arribat al PC.

1. Obre **PowerShell** o **Símbol del sistema** (no cal com a administrador).
2. Executa:

   ```
   gpupdate /force
   ```

3. Espera que digui que l'actualització de la directiva d'usuari i d'equip s'ha completat.
4. Tanca **totes** les finestres de Chrome i torna'l a obrir.

Per comprovar que la política ha arribat: obre `chrome://policy`, prem **Torna a carregar les polítiques** i cerca `ilhlmkjikoindjjhdjgmpnfojckggjcd` (Ctrl+F). Si no surt, la política encara no hi és: torna a fer el pas 1 o reinicia el PC.

## 2. Descarregar el `.crx`

1. Ves a les [Releases del repositori](https://github.com/egaray-gsc/p66-render-inspector/releases/latest).
2. A **Assets**, descarrega `p66-render-inspector-X.Y.Z.zip`.
3. Descomprimeix-lo (clic dret → **Extreu-ho tot**). A dins hi ha `p66-render-inspector-X.Y.Z.crx`.

El `.crx` va dins d'un `.zip` perquè Chrome bloqueja la descàrrega directa d'un `.crx` des de fora de la Web Store i el marca com a fitxer sospitós.

## 3. Instal·lar-lo

1. Obre `chrome://extensions` en una pestanya.
2. Arrossega el fitxer `.crx` des de l'Explorador de fitxers a sobre d'aquesta pàgina.
3. Chrome mostra un diàleg amb els permisos de l'extensió. Prem **Afegeix l'extensió**.

L'extensió apareix a la llista amb l'ID `ilhlmkjikoindjjhdjgmpnfojckggjcd`.

## 4. Fixar la icona (opcional)

A la barra de Chrome, prem la icona del trencaclosques i després la xinxeta de **P66 Render Inspector**. Així la icona queda sempre visible i canvia al color de l'estat de la pàgina (`P66`, `FB`, `XK`, `!?`).

Les pestanyes de La Vanguardia o Mundo Deportivo que ja estaven obertes no mostren res fins que les recarregues.

## Actualitzar a una versió nova

Chrome no l'actualitza sol, perquè no ve de la Web Store.

1. Descarrega el `.zip` de la versió nova de les [Releases](https://github.com/egaray-gsc/p66-render-inspector/releases/latest) i descomprimeix-lo.
2. Arrossega el `.crx` nou a `chrome://extensions`, igual que al pas 3.

L'ID és el mateix, així que Chrome la tracta com una actualització: no cal desinstal·lar l'anterior i es mantenen les opcions (cantonada del widget, plegat o desplegat). La versió instal·lada surt a la targeta de l'extensió a `chrome://extensions`.

## Si tenies la versió sense empaquetar

Si l'havies carregat abans des de la carpeta (amb el mode de desenvolupador), elimina-la primer a `chrome://extensions` → **Elimina**. Té el mateix ID i Chrome no deixa tenir les dues.

## Problemes habituals

| Què passa | Causa probable | Què fer |
| --- | --- | --- |
| Chrome diu que l'administrador ha bloquejat l'extensió | La política d'IT encara no ha arribat al PC | Pas 1: `gpupdate /force`, tanca totes les finestres de Chrome i comprova `chrome://policy` |
| En deixar anar el `.crx`, Chrome el descarrega o no fa res | S'ha deixat anar sobre una pestanya que no és `chrome://extensions` | Obre `chrome://extensions` i torna-ho a provar |
| Chrome bloqueja la descàrrega | S'ha intentat baixar un `.crx` directament | Descarrega el `.zip` de la release i descomprimeix-lo |
| Error de paquet invàlid o malmès | El fitxer s'ha descarregat incomplet | Torna'l a descarregar |
| El widget no apareix | La pestanya ja era oberta abans d'instal·lar | Recarrega la pàgina (F5) |
