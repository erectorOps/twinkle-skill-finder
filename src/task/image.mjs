import gulp from 'gulp';
import imagemin from 'gulp-imagemin'; //画像圧縮
import pngquant from 'imagemin-pngquant'; //PNG画像はこのプラグインが軽量化率高い
import changed from 'gulp-changed'; //更新されたファイルのみ処理

import { srcPath, distPath } from './_config.mjs';

export const imgFunc = () => {
    return gulp.src(srcPath.img, {encoding: false})
      .pipe(changed(distPath.img))
      .pipe(imagemin([pngquant({ quality: [0.8, 0.95], speed: 1})], {verbose: true}))
      .pipe(gulp.dest(distPath.img))
}