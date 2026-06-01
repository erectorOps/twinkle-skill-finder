import gulp from 'gulp';
import { srcPath, distPath } from './_config.mjs';

export const jsFunc = () => {
  return gulp.src(srcPath.js)
    .pipe(gulp.dest(distPath.js))
}