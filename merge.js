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
    //commander input
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
    var sortPattern = args[5];

    if (projectPath.ext === '.fire') {
        fireFiles.base = dumpSortFireFiles(args[2], sortPattern); // base
        fireFiles.remote = dumpSortFireFiles(args[3], sortPattern) // remote
        fireFiles.local = dumpSortFireFiles(args[4], sortPattern); // local
        
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

function dumpSortFireFiles(originFile, sortPattern) {   
    var origin = fs.readFileSync(originFile, {
        encoding: 'utf8',
    });
    var rawData = JSON.parse(origin);
    var tempData = [];
    var fileProp = path.parse(originFile);
    var filesPos = {
        name: fileProp.name,
        sceneAssset: null,
        nodes: []
    }
    resolveData(rawData, tempData);
    // second Machin this part we need change the comp part or change all part.
    groupingData(tempData, filesPos);
    // change the all _id or mark
    arrangeIndex(filesPos.nodes);
    // only consider two part of the fire content.  need change.
    var sortCompare = sortPattern ? sortById : sortByName;
    filesPos.nodes.sort(sortCompare);

    return filesPos;  
}

// destinationPath is the project root Path
function outputFiles (destinationPath) {
    var name = fireFiles.base.name;

    var modelBase, modelRemote, modelLocal;
    modelBase = createModel(fireFiles.base);
    modelRemote = createModel(fireFiles.remote);
    modelLocal = createModel(fireFiles.local);
    
    var compareFold = path.join(destinationPath, '/mergeCache');
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

    var paths = fs.readdirSync(compareFold, {encoding: 'utf8'}).map(x => path.join(compareFold, x));

    return paths;
} 

function createModel (filePos) {
    var model = {};

    // createTree

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
    markToIndex(rawData);

    console.log('``````````````finished!````````````````');
    var result = [];

    
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
    var branch;
    for (let i = 0; i < rawData.length; i++) {
        var type = rawData[i].__type__;
        console.log(type + i);
        switch(type) {
            case 'cc.SceneAsset':
                branch = {
                    scene: null
                }
                break;
            case 'cc.Scene':
                branch = {
                    index: i,
                    name: 'Scene',
                    id: rawData[i]._id,
                }
                break;
            case 'cc.Node':
                branch = {
                    index: i,
                    name: rawData[i]._name,
                    id: rawData[i]._id,
                    components: rawData[i]._components,
                    prefab: rawData[i]._prefab,
                }
                break;
            default:
                // cut down the run out of.
                branch = {
                    
                };
                break;
        }
        branch.type = type,
        branch._properties = rawData[i];
        tempData.push(branch);
    }
}

function groupingData (tempData, filePos) {
    // sort the grounp 
    tempData.forEach(function (obj) {
        switch(obj.type) {
            case 'cc.SceneAsset':
                filePos.sceneAssset = obj._properties;
                break;
            case 'cc.Scene':
                filePos.nodes.push(obj);
                break;
            case 'cc.Node':
                var comps = []
                for (let i = 0; i < obj.components.length; i++) {
                    comps.push(tempData[obj.components[i].__id__]._properties);
                }
                obj.components = comps;
                if (obj.prefab) {
                    id = obj.prefab.__id__;
                    obj.prefab = tempData[id]._properties;
                }
                filePos.nodes.push(obj);
                break;
        }
     });
}
// input the filePos.nodes
function arrangeIndex (nodes) {
    nodes.forEach(function (node) {
        node._properties = locationId(node._properties, nodes);
        // this judge is use for scene
        if(node.components && node.components.length > 0) {
            node.components.forEach(function (comp) {
                comp.node = null;
            });
        }
        if (node.prefab) {
            node.prefab.root = null;
        }
    });
}

function locationId (objData, objArr) {
    // There is the node prefab and components proto
    if (objData._prefan) {
        objData._prefab = null;
    }
    if (objData._components && objData._components.length > 0){
        objData._components = null;
    }
    if (objData._children && objData._children.length > 0) {
        objData._children.forEach(function (child) {
            for (let i = 0; i < objArr.length; i++) {
                if (objArr[i].index === child.__id__) {
                    child.__id__ = objArr[i].id;
                    break;
                }
            }; 
        });
    }
    if (objData._parent) {
        objArr.forEach(function (tar) {
            if (tar.index === objData._parent.__id__) {
                objData._parent.__id__ = tar.id;
            }
        }); 
    }

    return objData;
}

function markToIndex (tempData) {
    tempData.forEach(function (obj) {
        locationIndex(obj, tempData);
    });
}

function locationIndex (objData, tempData) {
    // must the node sort first, or will lost the mark
    var str = JSON.stringify(objData, null, '\t');
    str = str.replace(/"__id__": "([\S]+)"/g, function (match, mark) {
        var index = tempData.findIndex(function (ele) {
            if (mark === ele.mark) {
                return ele;
            }
        });
        return `"__id__": ${index}`;
    });
    objData = JSON.parse(str);

    return objData;
}

/* function getId (array, index) {
    var obj = array.find(function (ele) {
        if (ele.index === index) {
            return ele;
        }
    });
    return obj.id;
} */

function sortById (a, b) {
    return a.id.localeCompare(b.id);
}
function sortByName (a, b) {
    return a.name.localeCompare(b.name);
}