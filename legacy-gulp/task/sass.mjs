import gulp from 'gulp';
import browserSync from 'browser-sync';
import * as sass from 'sass'; // sass
import gulpSass from 'gulp-sass'; //sass
import postcss from 'gulp-postcss'; //生成されたcssを操作する
import autoprefixer from 'autoprefixer'; //自動でベンダープレフィックスを付与
import plumber from 'gulp-plumber'; //エラーによるタスクの強制停止を防止
import notify from 'gulp-notify'; //デスクトップ通知
import { distPath, srcPath } from './_config.mjs';

// sassのコンパイラをgulp-sassに渡す
const compiledSass = gulpSass(sass);

export const cssSass = () => {
    return gulp.src(srcPath.scss, { sourcemaps: false })
      .pipe(
        //エラーが出ても処理を止めない
        plumber({
          errorHandler: notify.onError('Error:<%= error.message %>')
        }))
      .pipe(compiledSass({ outputStyle: 'expanded'}).on('error', compiledSass.logError))
      .pipe(postcss([
        autoprefixer({
          overrideBrowserslist: ['last 2 versions', 'iOS >= 12', 'Android >= 8']
        })
      ]))
      .pipe(gulp.dest(distPath.css)) //コンパイル先
      .pipe(browserSync.stream())
      .pipe(notify({
        message: 'Sassをコンパイルしました！',
        onLast: true
      }))
  }
  