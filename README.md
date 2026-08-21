# El Rebost — web (PWA)

Versió web d'El Rebost que comparteix l'estoc, la llista de la compra i els plats entre tots els qui conviuen, en temps real.

**En línia**: https://casaestoc.web.app (projecte Firebase `casaestoc`)

- **Frontend**: Vite + React (JavaScript, els mateixos plats i lògica que l'app Android).
- **Base de dades**: Firebase (auth anònim + un sol document `casa/shared` en Cloud Firestore).
- **PWA**: instal·lable al mòbil i desplegable al núvol gratuït de Firebase Hosting.

## Com funciona

Tothom que obre la web veu i edita les **mateixes dades** (un únic document compartit). No cal registrar-se: l'usuari entra de manera anònima automàticament. Amb les regles següents, només els documents del mateix projecte Firestore s'hi poden connectar (no hi ha autenticació per persona).

## Posada en marxa local

Prerequisit: Node.js 20+ (en aquest projecte s'usa un Node portàtil).

```
npm install
npm run dev
```

Obre `http://localhost:5173`. Per al build de producció: `npm run build` (deixa el resultat a `dist/`). Tests de la lògica (sense navegador): `npm test`.

## Configurar Firebase (una sola vegada)

1. Vés a <https://console.firebase.google.com> i crea un projecte (gratuït).
2. Al projecte, activa **Authentication → Sign-in method → Anonymous**.
3. Activa **Firestore Database** (mode de producció). Anota l'**ID del projecte** (el que apareix a `firebaseconfig`).
4. A **Project settings → General**, copia la configuració de l'app web (Firebase SDK snippet) i enganxa els valors a `src/firebase.js` (substitueix els valors `API_KEY_AQUI`, `TU_PROJECTE`, etc.).

   > Ja fet: `src/firebase.js` conté la configuració del projecte `casaestoc`.

   ```js
   const firebaseConfig = {
     apiKey: '...',
     authDomain: '...',
     projectId: '...',
     storageBucket: '...',
     messagingSenderId: '...',
     appId: '...'
   }
   ```

5. **Regles de Firestore** (important: la lectura i escriptura són anònimes, així que restringeix el document):

   A la pestanya **Rules**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /casa/shared {
         allow read, write: if true;
       }
     }
   }
   ```

   > Nota: si vols que només els del teu entorn hi accedeixin, el més segur és limitar-ho per la URL del teu hosting, però l'opció anterior és la més senzilla per a ús domèstic.

6. Comprova que tot funciona: `npm run dev`, afegeix un aliment, tanca i torna a obrir — les dades hi continuen perquè es desen al núvol.

## Desplegar al núvol (Firebase Hosting, gratuït)

El projecte ja està **desplegat a https://casaestoc.web.app**. Per tornar a desplegar després de canviar el codi:

```
npm run build
firebase deploy --only hosting
```

Eines utilitzades (una sola vegada, ja fet):
- `npm install -g firebase-tools` (amb el Node portàtil).
- `firebase login` (accés amb compte Google; guardat a `~/.config/firebase`).
- `firebase.json` (carpeta pública `dist`) i `.firebaserc` (projecte `casaestoc`) ja creats.

Per instal·lar-la al mòbil: obre **https://casaestoc.web.app** i, des del menú del navegador, **Afegeix a la pantalla d'inici**.

## Estructura

- `src/firebase.js` — connexió Firebase + sincronització del document compartit.
- `src/data.js`, `src/shelflife.js` — categories, estimació de caducitat, escalat de quantitats (portats de `ShelfLife.kt`).
- `src/dishes.js` — catàleg de plats i coincidència d'ingredients (portat de `Dishes.kt`).
- `src/App.jsx` — pestanyes Estoc / Cuina / Compra i operacions.
- `src/components/ItemModal.jsx`, `DishModal.jsx` — diàlegs d'alta/edició i recepta.
