 // gulpプラグインの読み込み
import gulp from 'gulp';
import fs from "fs/promises";
import path from 'path';
import browserSyncPkg from "browser-sync";

import { cssSass } from './src/task/sass.mjs';
import { imgFunc } from './src/task/image.mjs';
import { jsFunc } from './src/task/js.mjs';
import { buildSkillFinderIndex } from './src/task/skillFinderIndex.mjs';

import { srcBase, distBase } from './src/task/_config.mjs';

const SRC = "src";
const DIST = "dist";

/* ========================================
   BROWSER SYNC
======================================== */

export const browserSync =
  browserSyncPkg.create();

/* ========================================
   HTML
======================================== */

export async function htmlFunc() {
  const html = await fs.readFile(
    path.join(SRC, 'index.html'),
    'utf8'
  );

  await fs.mkdir(DIST, { recursive: true });

  await fs.writeFile(
    path.join(DIST, 'index.html'),
    html
  );
}

/* ========================================
   JSON → dist/data/
======================================== */

export async function jsonFunc() {
  const skills = JSON.parse(
    await fs.readFile(`${SRC}/data/skills.json`, 'utf8')
  );

  const characters = JSON.parse(
    await fs.readFile(`${SRC}/data/characters.json`, 'utf8')
  );

  const accessories = JSON.parse(
    await fs.readFile(`${SRC}/data/accessory.json`, 'utf8')
  );

  const release_dates = JSON.parse(
    await fs.readFile(`${SRC}/data/release_dates.json`, 'utf8')
  );

  const releaseDateItems =
    Array.isArray(release_dates)
      ? release_dates
      : release_dates.items || [];

  const releaseDateMap =
    new Map(releaseDateItems.map(item => [item.unit_id, item]));

  characters.forEach(character => {
    const releaseDate = releaseDateMap.get(character.unit_id);
    if (!releaseDate) return;
    character.release_date = releaseDate.release_date;
    character.release_date_raw = releaseDate.release_date_raw;
    character.release_order = releaseDate.release_order;
    character.obtain = releaseDate.obtain;
  });

  const skillFinderIndex = buildSkillFinderIndex({
    skills,
    characters,
    accessories
  });

  await fs.mkdir(path.join(DIST, 'data'), { recursive: true });

  await Promise.all([
    fs.writeFile(
      path.join(DIST, 'data', 'index.json'),
      JSON.stringify(skillFinderIndex)
    ),
    fs.writeFile(
      path.join(DIST, 'data', 'skills.json'),
      JSON.stringify(skills)
    ),
    fs.writeFile(
      path.join(DIST, 'data', 'characters.json'),
      JSON.stringify(characters)
    ),
    fs.writeFile(
      path.join(DIST, 'data', 'accessory.json'),
      JSON.stringify(accessories)
    ),
  ]);
}

/* ========================================
   SERVER
======================================== */

export function server(done) {
  browserSync.init({
    server: {
      baseDir: distBase,
      middleware: [
        function (req, res, next) {
          if (req.url.endsWith(".html")) {
            res.setHeader("Content-Type", "text/html; charset=UTF-8");
          }
          if (req.url.endsWith(".js")) {
            res.setHeader("Content-Type", "application/javascript; charset=UTF-8");
          }
          if (req.url.endsWith(".json")) {
            res.setHeader("Content-Type", "application/json; charset=UTF-8");
          }
          next();
        }
      ]
    },
    open: true,
    notify: false
  });

  done();
}

/* ========================================
   RELOAD
======================================== */

export function reload(done) {
  browserSync.reload();
  done();
}

/* ========================================
   WATCH
======================================== */

export function watchFiles() {
  gulp.watch(
    [`${srcBase}/index.html`],
    gulp.series(htmlFunc, reload)
  );

  gulp.watch(
    [`${srcBase}/js/**/*.js`],
    gulp.series(jsFunc, reload)
  );

  gulp.watch(
    [`${srcBase}/data/**/*.json`],
    gulp.series(jsonFunc, reload)
  );

  gulp.watch(
    `${srcBase}/scss/**/*.scss`,
    gulp.series(cssSass, reload)
  );

  gulp.watch(
    `${srcBase}/img/**/*`,
    gulp.series(imgFunc, reload)
  );
}

/* ========================================
   BUILD
======================================== */

export const build = gulp.series(
  gulp.parallel(
    htmlFunc,
    jsonFunc,
    jsFunc,
    cssSass,
    imgFunc
  )
);

/* ========================================
   DEFAULT
======================================== */

export default gulp.series(
  build,
  server,
  watchFiles
);
