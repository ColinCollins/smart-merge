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
        fireFiles.base = dumpSortFireFiles(args[2], args[5]); // base
        fireFiles.remote = dumpSortFireFiles(args[3], args[5]) // remote
        fireFiles.local = dumpSortFireFiles(args[4], args[5]); // local
       
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

function dumpSortFireFiles(originFile, sortNorm) {   
    var origin = fs.readFileSync(originFile, {
        encoding: 'utf8',
    });
    var rawData = JSON.parse(origin);
    var tempData = [];
    var fileProp = path.parse(originFile);
    var filesPos = {
        name: fileProp.name,
        sceneHeader: [],
        nodes: [],
        components: [],
        prefabInfos: []
    }

    resolveData(rawData, tempData);
    indexTomark(tempData);
    // only consider two part of the fire content.   
    groupingData(tempData, filesPos);

    var nodesCompare = sortNorm ? compareById : compareByName;
    filesPos.nodes.sort(nodesCompare);

    return filesPos;  
}

function resolveData (rawData, tempData) {
    // firstMachin
    for (let i = 0; i < rawData.length; i++) {
        var mark = '';
        // create the mark id, there maybe need change or make a model to other file as a import.
        switch (rawData[i].__type__) {
            case 'cc.SceneAsset':
                mark = 'fileHeader';
                break;
            case 'cc.Scene':
                mark = `scene-${rawData[i]._id}`;
                break;
            case 'cc.PrivateNode':
            case 'cc.Node':
                mark = `node-${rawData[i]._name}-${rawData[i]._id}`;
                break;
            case 'cc.PrefabInfo':
                // need to consider about the root 
                mark = `prefabInfo-${rawData[i].fileId}`;
                break;
                // add here to remind you there are some special obj
            case 'cc.ClickEvent':
                makr = `clickEvent-${rawData[i].__type__}`;
                break;
            default: 
                // there is the component contain the custome and the office componet
                var nodeIndex = '';
                console.log(rawData[i].__type__);
                nodeIndex = rawData[i].node.__id__;
                mark = `comp-${rawData[nodeIndex]._name}-${rawData[nodeIndex]._id}-${rawData[i].__type__}`;
                break;
        }
        var branch = {
            index: i,
            type: rawData[i].__type__,
            mark: mark,
            data: rawData[i]
        };
        tempData.push(branch);
    }
}

function groupingData (tempData, filesPos) {
    tempData.forEach(function (obj) {
        switch(obj.type) {
            case 'cc.Scene':
            case 'cc.PrivateNode':
            case 'cc.Node':
                var node = {
                    _id:obj.data._id,
                    prefab: obj.data._prefab,
                    mark: obj.mark,
                    _properties: obj.data
                };
                filesPos.nodes.push(node);
                break;
            case 'cc.PrefabInfo':
                var info = {
                    mark: obj.mark,
                    _properties: obj.data
                }
                filesPos.prefabInfos.push(info);
                break;
            case 'cc.SceneAsset':
                filesPos.sceneHeader = obj.data;
                break;
            default :
                // all components 
                var node = '';
                if (obj.data.node) {
                    node = obj.data.node.__id__;
                }
                var component = {
                    node: node, // node mark correspond mark 
                    mark: obj.mark,
                    _properties: obj.data
                };
                filesPos.components.push(component);
                break;
        }
    });
}
// destinationPath is the project root Path
function outputFiles (destinationPath) {
    var name = fireFiles.base.name;

    var modelBase, modelRemote, modelLocal;
    modelBase = createModel(fireFiles.base);
    modelRemote = createModel(fireFiles.remote);
    modelLocal = createModel(fireFiles.local);
    
    var compareFold = path.join(destinationPath, '/MergeCache');
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
    var model = {};
    // header
    model[filePos.sceneHeader.__type__] = filePos.sceneHeader;
    // node
    filePos.nodes.forEach(function (obj) {
        model[obj.mark] = obj._properties;
        // comp there has been sort
        filePos.components.forEach(function (comp) {
            var compMark = comp.mark;
            var parse = compMark.split('-'); 
            if (parse[2] == obj._id) {
                model[comp.mark] = comp._properties;
            }
        });
        // prefab
        if (obj.prefab) {
            filePos.prefabInfos.forEach(function (info) {
                if (obj.prefab.__id__ == info.mark) {
                    model[info.mark] = info._properties;
                }
            });
        }
    });

    // we get the rawData of the merage
    markToIndex(model);

    return JSON.stringify(model, null, '\t');
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


function indexTomark (tempData) {
    tempData.forEach(function (obj) {
        obj.data = locationId(obj, tempData);
    });
}

function locationId (obj, tempData) {
    var str = JSON.stringify(obj.data, null, '\t');
    str = str.replace(/"__id__": ([0-9]+)/g, function (match, index) {
        var mark = '';
        // the clickevent is little special did have any message contect to the user
        if (tempData[index].data.__type__ === 'cc.ClickEvent') {
            // sort out the clickEvent's mark
            var _id = obj.mark.split('-')[2];
            var _name = obj.mark.split('-')[1];

            var clickEvent = tempData[index];
            mark = `clickEvent-${_name}-${_id}-${clickEvent.data.__type__}`;
            clickEvent.mark = mark; 
        }
        else {
            mark = getMark(tempData, parseInt(index));
        }
        return `"__id__": "${mark}"`;
    });
    obj.data = JSON.parse(str);

    return obj.data;
}

function markToIndex (tempData) {
    tempData.forEach(function (obj) {
        obj._properties = locationIndex(obj._properties, tempData);
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

function getMark (array, index) {
    var obj = array.find(function (ele) {
        if (ele.index === index) {
            return ele;
        }
    });
    return obj.mark;
}

function compareById (a, b) {
    return a._id.localeCompare(b._id);
}

function compareByName (a, b) {
    return a.mark > b.mark;
}
