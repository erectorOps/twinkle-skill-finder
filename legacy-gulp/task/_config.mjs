export const srcBase = './src'
export const distBase = './dist'
export const srcPath = {
    'scss': srcBase + '/scss/**/*.scss',
    'img': srcBase + '/img/**/*',
    'js': srcBase + '/js/**/*.js',
    'json': srcBase + '/**/*.json',
    'xml': srcBase + '/xml/*',
    'ejs': srcBase + '/**/*.ejs',
    '_ejs': '!' + srcBase + '/_inc/**/*.ejs',
};

export const distPath = {
    'css': distBase + '/css',
    'img': distBase + '/img',
    'js': distBase + '/js'
};