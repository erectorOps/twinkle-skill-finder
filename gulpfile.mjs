 // gulpプラグインの読み込み
import gulp from 'gulp';
import fs from "fs/promises";
import path from 'path';
import ejs from "ejs";
import minimist from 'minimist';
import browserSyncPkg from "browser-sync";

import { cssSass } from './src/task/sass.mjs';
import { imgFunc } from './src/task/image.mjs';

import { srcBase, distBase } from './src/task/_config.mjs';
import log from 'fancy-log';
import rename from 'gulp-rename'; //ファイル出力時にファイル名を変える


const SRC = "src";
const DIST = "dist";


/* ========================================
   OPTION
======================================== */

const options = minimist(
  process.argv.slice(2)
);

/* ========================================
   BROWSER SYNC
======================================== */

export const browserSync =
  browserSyncPkg.create();

/* ========================================
   EJS
======================================== */

export async function ejsFunc() {

  const skills = JSON.parse(
    await fs.readFile(
      `${SRC}/data/skills.json`,
      "utf8"
    )
  );

  const characters = JSON.parse(
    await fs.readFile(
      `${SRC}/data/characters.json`,
      "utf8"
    )
  );

  const accessories = JSON.parse(
    await fs.readFile(
      `${SRC}/data/accessory.json`,
      "utf8"
    )
  );

  const pages = [
    "index.ejs"
  ];

  for (const page of pages) {
    
    const inputPath =
      path.join(SRC, page)

    const outputPath =
      path.join(
        DIST,
        page.replace(".ejs", ".html")
      );

    const template =
      await fs.readFile(
        inputPath,
        "utf8"
      );

    const html =
      ejs.render(
        template,
        {
          skills,
          characters,
          accessories
        },
        {
          filename: inputPath
        }
      );

    await fs.mkdir(
      path.dirname(outputPath),
      {
        recursive: true
      }
    );

    await fs.writeFile(
      outputPath,
      html
    );
  }

  browserSync.reload();

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
    [
      `${srcBase}/**/*.ejs`,
      `${srcBase}/data/**/*.json`
    ],

    gulp.series(
      ejsFunc,
      reload
    )
  );

  gulp.watch(
    `${srcBase}/scss/**/*.scss`,

    gulp.series(
      cssSass,
      reload
    )
  );

  gulp.watch(
    `${srcBase}/img/**/*`,

    gulp.series(
      imgFunc,
      reload
    )
  );
}

/* ========================================
   BUILD
======================================== */

export const build = gulp.series(

  gulp.parallel(
    ejsFunc,
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
