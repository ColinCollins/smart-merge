const process = require('process');
const path = require('path');
const fs = require('fs');
const del = require('del');
const { execFileSync } = require('child_process');
 
var fireFiles = {
    base: new Map(),
    remote: new Map(),
    local: new Map()
};

(function () {
    // args is the fill path, you must get the tool, we recommander the webstorm
    var args = process.argv;
    var config = fs.readFileSync('./package.json', {encoding: 'utf8'}).smartMerge;
    var compareFiles = [];

    var tempPath = path.join(process.cwd(), config.cachePath);  
    // clear the destination fold.
    del.sync(tempPath + '/*');

    if (path.extname(args[2]) === '.fire') {
        dumpSortFireFiles(args[2], fireFiles.base); // base
        dumpSortFireFiles(args[3], fireFiles.remote) // remote
        dumpSortFireFiles(args[4], fireFiles.local); // local
       
        // design the path that can be read
        if (!fs.existsSync(tempPath)) {
            console.error('Destination path is not available.')
            return;
        }
        // create the compare files, the files ext is the json
        compareFiles = outputFiles(resolvePath);
    }
    else {
        // if is not fire file conflict
        for (let i = 2; i < args.length - 1; i++) {
            compareFiles.push(args[i]);
        }
    }
    
    // merge is a array. args[6] is the tool. depend tool setting in the project.json, you must have a save the merge file
    compareForMerge(config.dependMergeTool, compareFiles, config.cachePath);
    console.log('1111111111');

})();

function dumpSortFireFiles(filePath, filesPos) {   
        var fileProp = path.parse(filePath);
        // fs set the encoding return a string back
        var origin = fs.readFileSync(filePath, {
            encoding: 'utf8',
        });
        // then sort and write to a new file, the sort is the json format
        var sort = JSON.parse(origin);
        filesPos.set(fileProp.name, {        
            nodes: [],
            components: [],
        });
        // only consider two part of the fire content.
        sort.forEach(function (obj, i) {
            if (obj._id) {
                var target = {
                    index: i,
                    _name: obj._name,
                    _id: obj._id,
                    _properties: obj,
                };
                filesPos.get(fileProp.name).nodes.push(target);
            }
            else if (obj.node) {
                var comp = {
                    _type: obj.__type__,
                    node: obj.node.__id__,
                    _properties: obj
                }
                filesPos.get(fileProp.name).components.push(comp);
            }
        });
        filesPos.get(fileProp.name).nodes.sort(nodesCompare);
        filesPos.get(fileProp.name).components.sort(compsCompare);
}

function outputFiles (destinationPath) {
    var filesName = fireFiles.base.keys();
    var name = '';

    for (let i = 0; i < fireFiles.base.size; i++) {
        var modelBase, modelRemote, modelLocal;
        name = filesName.next().value;
        modelBase = createModel(fireFiles.base, name);
        modelRemote = createModel(fireFiles.remote, name);
        modelLocal = createModel(fireFiles.local, name);
        
        var compareFold = path.join(destinationPath, name);
        // create the fold of conflict fire
        fs.mkdirSync(compareFold);
        fs.writeFileSync(compareFold + '/Base.json', modelBase, {
            encoding: 'utf8',
            flag: 'w'
        });
        fs.writeFileSync(compareFold + '/Remote.json', modelRemote, {
            encoding: 'utf8',
            flag: 'w'
        });
        fs.writeFileSync(compareFold + '/Loacl.json', modelLocal, {
            encoding: 'utf8',
            flag: 'w'
        });
    };

    var paths = fs.readdirSync(compareFold,{encoding: 'utf8'}).map(x => path.join(compareFold, x));
    return paths;
} 

function createModel (filePos, fileName) {
    var model = [];
    filePos.get(fileName).nodes.forEach(function (obj) {
        // get the sort node message;
        model.push(obj._properties);
    });
    // how to consider about the sort.
    filePos.get(fileName).components.forEach(function (obj) {
        model.push(obj._properties);
    });

    return JSON.stringify(model, null, '\t')
}

function compareForMerge (toolPath, compareFiles, tempPath) {
    // use the extenstion tool to resolve conflict.
    var base = compareFiles[0];
    var remote = compareFiles[1];
    var local = compareFiles[2];
    
    var merge = path.join(tempPath + 'merge.json');

    execFileSync(toolPath, [base, remote, local, ]);
}

function nodesCompare (a, b) {
    return a._id.localeCompare(b._id);
}

function compsCompare (a, b) {
    return a.node > b.node;
}