var path = require('path');
var fs = require('fs');
var glob = require('glob');
var {shuffle} = require('shuffle-seed');
var localizeURLs = require('./localize-urls');

const OUTPUT_FILE = 'fixtures.json';

/**
 * Analyzes the contents of the specified `directory` ,and inlines
 * the contents into a single json file which can then we imported and built into a bundle
 * to be shipped to the browser.
 *
 * @param {string} directory
 * @param {Object} options
 */
module.exports = function ( directory, options ) {
    const tests = options.tests || [];
    const ignores = options.ignores || {};

    const basePath = directory;
    const jsonPaths = path.join(basePath, '/**/*.json');
    const imagePaths = path.join(basePath, '/**/*.png');
    const ignoreOutputPath = path.join(basePath, OUTPUT_FILE);
    //Extract the filedata into a flat dictionary
    let allFiles = {};
    let allPaths = glob.sync(jsonPaths, { ignore: [ignoreOutputPath] }).concat(glob.sync(imagePaths));

    //A Set that stores test names that are malformed so they can eb reomved later
    let malformedTests = {};

    for(let fixturePath of allPaths){
        const testName = path.dirname(fixturePath);
        const fileName = path.basename(fixturePath);
        const extension = path.extname(fixturePath)
        try {
            if( extension === '.json' ){
                let json = parseJsonFromFile(fixturePath);

                //Special case for style json which needs some preprocessing
                if( fileName === 'style.json' ) {
                    json = processStyle(testName, json);
                }

                allFiles[fixturePath] = json;
            } else if ( extension === '.png' ) {
                allFiles[fixturePath] = pngToBase64Str(fixturePath);
            } else {
                throw new Error(`${extension} is incompatible , file path ${fixturePath}`);
            }
        } catch (e) {
            console.log(`Error parsing file: ${fixturePath}`);
            malformedTests[testName] = true;
        }
    }

    // Re-nest by directory path, each directory path defines a testcase.
    let result = {};
    for ( let fullPath in allFiles ) {
        const testName = path.dirname(fullPath).replace('test/integration/', '');
        //Skip if test is malformed
        if(malformedTests[testName]) { continue; }

        if( result[testName] == null ){
            result[testName] = {};
        }
        const fileName = path.basename(fullPath, path.extname(fullPath));
        result[testName][fileName] = allFiles[fullPath];
    }

    const outputStr = JSON.stringify(result, null, 4);
    const outputPath = path.join(basePath, OUTPUT_FILE);

    fs.writeFileSync(outputPath, outputStr, { encoding: 'utf8'});
}


function parseJsonFromFile( filePath ) {
    return JSON.parse(fs.readFileSync( filePath, { encoding: 'utf8' }));
}

function pngToBase64Str( filePath ) {
    return fs.readFileSync(filePath).toString('base64');
}

//TODO: Inline images in `addImage` operations
function processStyle( testName, style ) {
    let clone = JSON.parse(JSON.stringify(style));
    localizeURLs(clone);

    clone.metadata = clone.metadata || {};
    clone.metadata.test = Object.assign({
        testName,
        width: 512,
        height: 512,
        pixelRatio: 1,
        recycleMap: false,
        allowed: 0.00015
    }, clone.metadata.test);

    return clone;
}