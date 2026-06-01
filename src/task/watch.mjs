 // gulpプラグインの読み込み
import gulp from 'gulp';
import browserSync from "browser-sync"; //変更を即座にブラウザへ反映

import { HeroContents } from './heroContents.mjs';
import { HeroList } from './heroList.mjs';
//import { jsFunc } from './js.mjs';
import { imgFunc } from './image.mjs';
import { cssSass } from './sass.mjs';

import { srcBase, srcPath, distBase } from './_config.mjs';

/* リロード */
const browserSyncReload = (done) => {
    browserSync.reload();
    done();
}

const browserSyncOption = {
    server: distBase
  }
  
const browserSyncFunc = (startPath) => {
    const options = {
        ...browserSyncOption,
        startPath: startPath || "/"
    };
    browserSync.init(options);
}

/* ローカルサーバー立ち上げ */
//const browserSyncFunc = () => {
//    browserSync.init(browserSyncOption);
//}

const createWatchFiles = (kf) => {
    return () => {
        const heroContents = new HeroContents(kf);
        const heroList = new HeroList(kf);
        gulp.watch(srcPath.scss, gulp.series(cssSass))
        gulp.watch(srcPath.img, gulp.series(imgFunc, browserSyncReload))
        gulp.watch(srcPath.hero, gulp.series(gulp.parallel(...heroContents.createMultiLangTasks()), browserSyncReload))
        gulp.watch(srcPath.herolist, gulp.series(gulp.parallel(...heroList.createMultiLangTasks()), browserSyncReload))
        //gulp.watch(srcPath.js, gulp.series(jsFunc, browserSyncReload))
    }
}

const createWatchOne = (kf, id, lang) => {
    return () => {
        const heroContents = new HeroContents(kf);
        gulp.watch(srcPath.scss, gulp.series(cssSass))
        gulp.watch(srcPath.img, gulp.series(imgFunc, browserSyncReload))
        gulp.watch(srcPath.hero, gulp.series(gulp.parallel(heroContents.createOne.bind(heroContents, id, lang)), browserSyncReload));
        //gulp.watch(srcPath.js, gulp.series(jsFunc, browserSyncReload))
    }
}

export class Watch {

    constructor(kf) {
        this.kf = kf;
    }

    createOne(id, lang) {
        const path = `/hero/${id}.${lang}.html`;
        const launchBrowserSync = () => browserSyncFunc(path);
        return [createWatchOne(this.kf, id, lang), launchBrowserSync];
    }

    createFuncs() {
        return [createWatchFiles(this.kf), () => browserSyncFunc("/")];
    }
}
