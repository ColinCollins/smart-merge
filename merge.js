const process = require('process');
const path = require('path');
const fs = require('fs');
const del = require('del');
const { execFileSync } = require('child_process');
 
var fireFiles = {
    base: {},
    remote: {},
    local: {}
};

(function () {
    var args = process.argv;
    if (args.length < 5) {
        console.error('Arguments not enough!');
        return;
    }

    var config = JSON.parse(fs.readFileSync('./package.json', {encoding: 'utf8'})).smartMerge;
    var compareFiles = [];
    var projectPath = path.parse(args[2]);
    var dir = projectPath.dir;
    var merge = path.join(dir, 'merge.json');

    if (projectPath.ext === '.fire') {
        fireFiles.base = dumpSortFireFiles(args[2]); // base
        fireFiles.remote = dumpSortFireFiles(args[3]) // remote
        fireFiles.local = dumpSortFireFiles(args[4]); // local
       
        // design the path that can be read
        if (!fs.existsSync(dir)) {
            console.error('Destination path is not available.')
            return;
        }
        // create the compare files, the files ext is the json
        compareFiles = outputFiles(dir);
        // depend tool setting in the project.json, you must have to save the merge file
        compareForMerge(config.dependMergeTool, compareFiles, merge);
        // resort the merge to the scene fire
        outputCover(merge, dir);
    }
    else {
        // if is not fire file conflict
        for (let i = 2; i < args.length - 1; i++) {
            compareFiles.push(args[i]);
        }
        compareForMerge(config.dependMergeTool, compareFiles, merge);
    }
    return;
})();

function dumpSortFireFiles(originFile) {   
    var origin = fs.readFileSync(originFile, {
        encoding: 'utf8',
    });
    var rawData = JSON.parse(origin);
    var tempData = [];
    resolveData(rawData, tempData);
    /* second Machin this part we need change the comp part or change all part. */
    indexToUnique(tempData);
    // third Machin return to the fireFiles need to use by other
    var fileProp = path.parse(originFile);
    var filesPos = {
        name: fileProp.name,
        sceneHeader: [],
        nodes: [],
        components: [],
        prefabInfos: []
    }
    // only consider two part of the fire content.   
    groupingData(tempData, filesPos);

    filesPos.nodes.sort(nodesCompare);
    filesPos.components.sort(compsCompare);

    return filesPos;  
}

// destinationPath is the project root Path
function outputFiles (destinationPath) {
    var name = fireFiles.base.name;

    var modelBase, modelRemote, modelLocal;
    modelBase = createModel(fireFiles.base);
    modelRemote = createModel(fireFiles.remote);
    modelLocal = createModel(fireFiles.local);
    
    var compareFold = path.join(destinationPath, '/cache');
    // add the clear the destination fold.
    if (fs.existsSync(compareFold))
        del.sync(compareFold + '/**', {force: true});

    // create the fold of conflict fire
    fs.mkdirSync(compareFold);
    fs.writeFileSync(compareFold + `/${name}Base.json`, modelBase, {
        encoding: 'utf8',
        flag: 'w'
    });
    fs.writeFileSync(compareFold + `/${name}Remote.json`, modelRemote, {
        encoding: 'utf8',
        flag: 'w'
    });
    fs.writeFileSync(compareFold + `/${name}Loacl.json`, modelLocal, {
        encoding: 'utf8',
        flag: 'w'
    });

    var paths = fs.readdirSync(compareFold,{encoding: 'utf8'}).map(x => path.join(compareFold, x));

    return paths;
} 

function createModel (filePos) {
    var model = [];
    filePos.sceneHeader.forEach(function (obj) {
        model.push(obj)
    });
    filePos.nodes.forEach(function (obj) {
        model.push(obj);
    });
    filePos.components.forEach(function (obj) {
        model.push(obj);
    });

    return JSON.stringify(model, null, '\t')
}

function compareForMerge (toolPath, compareFiles, merge) {
    var base = compareFiles[0];
    var remote = compareFiles[1];
    var local = compareFiles[2];  

    execFileSync(toolPath, [base, remote, local, '-o', merge]);
}

function outputCover (tempFile, savePath) {
    // resort the index; tempFile is json file
    var merge = fs.readFileSync(tempFile, {encoding: 'utf8'});
    var rawData = JSON.parse(merge);
    // we get the rawData of the merage
    uniqueToIndex(rawData);

    console.log('``````````````finished!````````````````');
    var result = [];

    rawData.forEach(function (data) {
        result.push(data._properties);
    });
    var name = fireFiles.base.name;
    fs.writeFileSync(`${savePath}/${name}.fire`, JSON.stringify(result, null, '\t'), {
        encoding: 'utf8',
        force: true
    });
    del.sync(tempFile, {force: true});
    del.sync(path.join(savePath, 'cache'), {force: true})
}

function resolveData (rawData, tempData) {
    // firstMachin
    for (let i = 0; i < rawData.length; i++) {
        var type, unique = '';
        // create the unique id, there maybe need change or make a model to other file as a import.
        switch (rawData[i].__type__) {
            case 'cc.SceneAsset':
                unique = 'fileHeader';
                type = 'sceneAsset';
                break;
            case 'cc.Scene':
                unique = `scene-${rawData[i]._id}`;
                type = 'scene';
                break;
            case 'cc.Node':
                unique = `node-${rawData[i]._name}-${rawData[i]._id}`;
                type = 'node';
                break;
            case 'cc.PrefabInfo':
                // need to consider about the root 
                unique = `prefabInfo-${rawData[i]._fileId}`;
                type = 'prefabInfo';
                break;
            default: 
                // there is the compone contain the custome and the office componet
                unique = `comp-${rawData[i].__type__}`;
                type = 'comp';
                break;
        }
        var branch = {
            index: i,
            type: type,
            unique: unique,
            data: rawData[i]
        };
        tempData.push(branch);
    }
}

function groupingData (tempData, filesPos) {
    tempData.forEach(function (obj) {
        switch(obj.type) {
            case 'scene':
            case 'node':
                var node = {
                    _id:obj.data._id,
                    type: obj.type,
                    unique: obj.unique,
                    _properties: obj.data
                };
                filesPos.nodes.push(node);
                break;
            case 'comp':
                var component = {
                    node: obj.data.node.__id__,
                    type: obj.type,
                    unique: obj.unique,
                    _properties: obj.data
                };
                filesPos.components.push(component);
                break;
            case 'prefabInfo':
                var info = {
                    root: obj.data.root.__id__,
                    type: obj.type,
                    unique: obj.unique,
                    _properties: obj.data
                }
                filesPos.prefabInfos.push(info);
                break;
            case 'sceneAsset':
                var header = {
                    type: obj.type,
                    unique: obj.unique,
                    _properties: obj.data
                }
                filesPos.sceneHeader.push(header)
                break;
        }
    });
}

function nodesCompare (a, b) {
    return a._id.localeCompare(b._id);
}

function compsCompare (a, b) {
    return a.node > b.node;
}

function indexToUnique (tempData) {
    tempData.forEach(function (obj) {
        obj.data = locationId(obj.data, tempData);
    });
}

function locationId (objData, tempData) {
    var str = JSON.stringify(objData, null, '\t');
    str = str.replace(/"__id__": ([0-9]+)/g, function (match, index) {
        var unique = getUnique(tempData, parseInt(index));
        return `"__id__": "${unique}"`;
    });
    objData = JSON.parse(str);

    return objData;
}

function uniqueToIndex (tempData) {
    tempData.forEach(function (obj) {
        if (obj.type === 'node') {
            if (obj._properties._components.length > 0) {
                obj._properties._components.forEach(function (comp) {
                    tempData.forEach(function (data, index) {
                        if (data.type === 'comp') {
                            if (data.unique === comp.__id__ && data.node === obj.unique) {
                                comp.__id__ = index;
                            }
                        }
                    });
                });
            }
        }
        obj._properties = locationIndex(obj._properties, tempData);
    });
}

function locationIndex (objData, tempData) {
    // must the node sort first, or will lost the unique
    var str = JSON.stringify(objData, null, '\t');
    str = str.replace(/"__id__": "([\S]+)"/g, function (match, unique) {
        var index = tempData.findIndex(function (ele) {
            if (unique === ele.unique) {
                return ele;
            }
        });
        return `"__id__": ${index}`;
    });
    objData = JSON.parse(str);

    return objData;
}

function getUnique (array, index) {
    var obj = array.find(function (ele) {
        if (ele.index === index) {
            return ele;
        }
    });
    return obj.unique;
}
