# Les courses de Laurent

Site statique (GitHub Pages) : un dossard par course, une fiche par course, un onglet « Données ».

- `index.html`, `css/style.css`, `js/app.js` (liste et fiches), `js/data.js` (graphiques), `vendor/leaflet/` (carte).
- `data/courses.json` : une entrée par course. Champs : `date`, `nom`, `lieu`, `categorie` (`xxl` = Ironman/Embrunman, `tri` = autres triathlons et duathlons, `course` = course à pied), `format`, `dist`, `distance_km`, `denivele_m`, `chrono`, `place`, `partants`, `natation`, `velo`, `cap`, `source` (lien vers le classement officiel), `depart` ([latitude, longitude] de la commune), `notes`.

Test en local : `python -m http.server` dans ce dossier, puis http://localhost:8000.
