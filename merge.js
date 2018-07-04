const process = require('process');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
 
var files = {
    base: new Map(),
    remote: new Map(),
    local: new Map()
};

(function () {
    // args is the fill path, you must get the tool, we recommander the webstorm
    var args = process.argv;

    dumpSortFireFiles(Array.of(args[2]), files.base); // base
    dumpSortFireFiles(Array.of(args[3]), files.remote) // remote
    dumpSortFireFiles(Array.of(args[4]), files.local); // local

    outputFiles(args[5]); // args[5] is a path

    //merge = compareForCover(files.base, files.remote, files.local, merge); // merge is a array.
    args[5] = merge;
})();

function dumpSortFireFiles(filesPath, filesPos) {   
    filesPath.forEach(function (filepath, index) {
        var fileProp = path.parse(filepath);
        if (fileProp.ext !== '.fire') {
            return;
        }
        // There use the Sync is better, you don not to consider about the async and the how to return.
        // fs set the encoding return a string back
        var origin = fs.readFileSync(filepath, {
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
    });
    return filesPos;
}

function outputFiles (destinationPath) {
    var filesName = files.base.keys();
    var name = '';
    var cwd = path.cwd;
    // design the path that can be read
    if (!fs.accessSync(destinationPath)) {
        console.error('Destination path is not available.')
        return;
    }

    for (let i = 0 ; i < files.base.size ; i++) {
        var modelBase, modelRemote, modelLocal;
        name = filesName.next().value;
        modelBase = createModel(files.base, name);
        modelRemote = createModel(files.remote, name);
        modelLocal = createModel(files.local, name);
        
        var compareFile = path.join(destinationPath, name);


        fs.writeFileSync(compareFile, modelBase, {
            encoding: 'utf8',
            flag: 'w'
        });
        fs.writeFileSync(compareFile, modelRemote, {
            encoding: 'utf8',
            flag: 'w'
        });
        fs.writeFileSync(compareFile, modelLocal, {
            encoding: 'utf8',
            flag: 'w'
        });
    };
} 

function createModel (filePos, fileName) {
    var model = [];
    filePos.get(fileName).nodes.forEach(function (obj) {
        model.push(obj._properties); // get the sort node message;
    });
    // how to consider about the sort.
    filePos.get(fileName).components.forEach(function (obj) {
        model.push(obj._properties);
    });

    return JSON.stringify(model)
}


function compareForCover (base, remote, local, merge) {
    // remote local length =  base.length
    
}

function nodesCompare (a, b) {
    return a._id.localeCompare(b._id);
}

function compsCompare (a, b) {
    return a.node > b.node;
}