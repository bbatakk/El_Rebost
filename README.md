# El Rebost — web (PWA)

Versió web d'El Rebost que comparteix l'estoc, la llista de la compra i els plats entre tots els qui conviuen, en temps real.

**En línia**: https://casaestoc.web.app (projecte Firebase `casaestoc`)

- **Frontend**: Vite + React (JavaScript, els mateixos plats i lògica que l'app Android).
- **Base de dades**: Cloud Firestore amb sincronització en temps real — múltiples **rebosts** compartits.
- **Autenticació**: Google Sign-In; cada persona té el seu compte i s'uneix als rebosts amb un codi.
- **Backend**: Cloud Functions (Node.js 22) amb Google Cloud Vision per a l'OCR de tiquets i el reconeixement d'aliments per foto.
- **PWA**: instal·lable al mòbil i desplegable al núvol gratuït de Firebase Hosting.

## Com funciona

- Cada usuari entra amb el seu **compte de Google** (`AuthScreens.jsx`).
- En crear un rebost es genera un **codi de 6 caràcters** (col·lecció `rebostCodes`). Qui tingui el codi pot unir-s'hi com a membre (per codi o QR).
- Cada rebost és un document a Firestore (`rebosts/{id}`) amb `items`, `recipes` i `mealPlan`. Tots els membres veuen i editen les **mateixes dades en temps real** (`onSnapshot`).
- Les regles (`firestore.rules`) restringeixen l'accés: només l'amo o els membres poden llegir/escriure, i un membre no pot canviar el nom, l'amo ni el codi del rebost.
- Es pot esborrar el compte (reautenticació amb Google): elimina els rebosts propis i treu l'usuari dels que només és membre.

### Pestanyes

| Pestanya | Què hi trobes |
|---|---|
| **Estoc** | Productes a casa, quantitats i caducitats estimades |
| **Aliments** | Catàleg d'aliments amb categories i vida útil |
| **Cuina** | Plats que pots fer amb el que tens (i gairebé), receptes i cuinar (descompta ingredients, timers) |
| **Compra** | Llista de la compra compartida |

### Entrada ràpida de productes

- **Codi de barres**: escaneig amb la càmera i cerca automàtica a Open Food Facts (`src/off.js`).
- **Foto del tiquet**: OCR amb Cloud Vision (funció `scanReceipt`) i pantalla de revisió abans de desar (`ReceiptReviewModal`).
- **Foto de l'aliment**: reconeixement per etiquetes i text (funció `identifyFood`, `FoodIdentifyModal`).

## Posada en marxa local

Prerequisit: Node.js 20+ (en aquest projecte s'usa un Node portàtil).

```
npm install
npm run dev
```

Obre `http://localhost:5173`. Per al build de producció: `npm run build` (deixa el resultat a `dist/`).

Tests de la lògica (sense navegador):

```
npm test
```

## Configurar Firebase (una sola vegada)

> Ja fet per al projecte `casaestoc`; això és només per recrear l'entorn des de zero.

1. Vés a <https://console.firebase.google.com> i crea un projecte (gratuït).
2. Activa **Authentication → Sign-in method → Google** (i afegeix el domini de localhost/hosting als dominis autoritzats).
3. Activa **Firestore Database** (mode de producció).
4. A **Project settings → General**, copia la configuració de l'app web i enganxa-la a `src/firebase.js`.
5. Regles i índexs de Firestore:

   ```
   firebase deploy --only firestore:rules,firestore:indexes
   ```

   (els fitxers font són `firestore.rules` i `firestore.indexes.json`)
6. Cloud Functions (OCR de tiquets i reconeixement d'aliments):

   ```
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```

   > Nota: les funcions fan servir la **Cloud Vision API**, que requereix tenir-la activada al projecte GCP i un pla de facturació (Blaze), tot i que té una quota gratuïta mensual.
7. Comprova que tot funciona: `npm run dev`, entra amb Google, crea un rebost i afegeix un aliment.

## Desplegar al núvol (Firebase Hosting, gratuït)

El projecte ja està **desplegat a https://casaestoc.web.app**. Per tornar a desplegar després de canviar el codi:

```
npm run build
firebase deploy --only hosting
```

Si has canviat les funcions o les regles:

```
firebase deploy --only functions
firebase deploy --only firestore:rules,firestore:indexes
```

Eines utilitzades (una sola vegada, ja fet):
- `npm install -g firebase-tools` (amb el Node portàtil).
- `firebase login` (accés amb compte Google; guardat a `~/.config/firebase`).
- `firebase.json` (hosting des de `dist`, funcions a `functions/`) i `.firebaserc` (projecte `casaestoc`) ja creats.

Per instal·lar-la al mòbil: obre **https://casaestoc.web.app** i, des del menú del navegador, **Afegeix a la pantalla d'inici**.

## Estructura

- `src/firebase.js` — connexió Firebase, auth Google, gestió de rebosts (crear/unir/esborrar) i subscripcions en temps real.
- `src/App.jsx` — arrel de l'app: sessió de Google, selecció del rebost actiu i el seu menú.
- `src/MainApp.jsx` — pestanyes Estoc / Aliments / Cuina / Compra, capçalera, modals i toast.
- `src/data.js`, `src/shelflife.js` — categories, estimació de caducitat, escalat de quantitats (portats de `ShelfLife.kt`).
- `src/dishes.js` — catàleg de plats i coincidència d'ingredients (portat de `Dishes.kt`).
- `src/foods.js` — catàleg d'aliments coneguts.
- `src/prices.js` — historial i estimació de preus.
- `src/off.js` — cerca de productes a Open Food Facts per codi de barres.
- `src/sw.js` — service worker de la PWA.
- `src/lib/` — utilitats compartides:
  - `appUtils.js` — constants de pestanyes, routing per hash, `newId`, `zeroItem`, hook `useCollapsed`.
  - `timer.js` — àudio/notificacions del temporitzador i hook `useTimer`.
- `src/hooks/` — lògica reutilitzable:
  - `useToast.js` — notificacions emergents amb acció (Desfer).
  - `useRebostActions.js` — totes les mutacions de dades del rebost actiu (aliments, receptes, pla de menú).
  - `useScans.js` — fluxos d'escaneig de tiquets i identificació per foto.
- `src/components/` — diàlegs i peces d'UI:
  - `AuthScreens.jsx` — entrada amb Google, creació/unions a rebosts, esborrat de compte.
  - `ItemModal.jsx`, `DishModal.jsx`, `RecipeModal.jsx`, `CookModal.jsx` — alta/edició d'aliments, plats i cuinat.
  - `ReceiptReviewModal.jsx`, `FoodIdentifyModal.jsx` — revisió de tiquets escanejats i identificació per foto.
  - `BarcodeScanner.jsx`, `QrScanner.jsx`, `QrModal.jsx` — escaneig de codis de barres i QR.
  - `TimerBar.jsx`, `TimerModal.jsx` — temporitzadors de cuina.
  - `ConfirmDialog.jsx`, `ItemMenu.jsx`.
  - `tabs/` — una pestanya per fitxer: `StockTab`, `FoodsTab`, `KitchenTab`, `ShoppingTab`, `MenuTab` (+ helpers a `common.jsx`).
- `functions/index.js` — Cloud Functions `scanReceipt` i `identifyFood` (Google Cloud Vision).
- `tests/logic.test.mjs` — tests de la lògica sense navegador (`npm test`).

## Scripts de manteniment

- `scripts/seed.mjs` — poblar Firestore amb dades de prova.
- `scripts/dedupe.mjs` — detecta i fusiona aliments duplicats (singular/plural); dry-run per defecte, `--apply` per aplicar.
- `scripts/check-dishes.mjs` — calcula quants ingredients de cada plat hi ha disponibles al rebost indicat: `node scripts/check-dishes.mjs <CODI>`. Entra amb un compte anònim temporal que s'esborra sol en acabar (no deixa rastre als membres del rebost).
- `scripts/backup-*.json` — còpies de seguretat de dades.
