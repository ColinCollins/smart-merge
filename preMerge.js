const process = require('process');
const path = require('path');
const fs = require('fs');
const del = require('del');
const { execFileSync } = require('child_process');
const cover = require('./coverMerge');
const type = require('./enums');
const pipe = require('./mergePipe');

var config = JSON.parse(fs.readFileSync('./mergeConfig.json', {encoding: 'utf8'}));
var fireFiles = {
    base: {},
    local: {},
    remote: {}
};

(function () {
    var args = process.argv;
    if (args.length < 4) {
        console.error('Arguments not enough!');
        return;
    }

    var projectPath = path.parse(args[2]);
    var dir = projectPath.dir;
    var merge = path.join(dir, 'merge.json');
    if (projectPath.ext === '.fire') {
        fireFiles.base = dumpSortFireFiles(args[2]); // base
        fireFiles.local = dumpSortFireFiles(args[3]); // local
        fireFiles.remote = dumpSortFireFiles(args[4]); // remote
        // design the path that can be read
        if (!fs.existsSync(dir)) {
            console.error('Destination path is not available.')
            return;
        }
        // create the compare files, the files ext is the json
        var compareFiles = outputFiles(dir);   
        compareForMerge(config.smartMerge.dependMergeTool, compareFiles, merge);

        var name = getFileName(fireFiles.base.name);
        cover.coverFile(merge, dir, name);
    }
    else {
        // if is not fire file conflict
        for (let i = 2; i < args.length - 1; i++) {
            compareFiles.push(args[i]);
        }
        compareForMerge(config.smartMerge.dependMergeTool, compareFiles, merge);
        cover.coverFile(merge, dir);
    }
    return;
})();

function dumpSortFireFiles(originFile) {   
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
    indexToMark(tempData);
    groupingData(tempData, filesPos);

    filesPos.nodes.sort(compareByName);

    return filesPos;  
}

function resolveData (rawData, tempData) {
    let handler = require('./Support/CreateMark');
    for (let i = 0; i < rawData.length; i++) {
        switch (rawData[i].__type__) {
            case type.sceneAsset:
                handler.createSceneAssetId(rawData[i].__type__);
                break;
            case type.scene:
               handler.createSceneId(rawData[i].__type__, rawData[i]._id);
                break;
            case type.privateNode:
            case type.node:
                handler.createNodeId(rawData[i].__type__, rawData[i]._id, rawData[i]._name);
                break;
            case type.prefabInfo:
                handler.createPrefabInfo(rawData[i].__type__, rawData[i].fileId);
                break;
            case type.clickEvent:
                handler.createClickEvent(rawData[i].__type__);
                break;
            default: 
                handler.createDefault(rawData[i], rawData);
                break;
        }

        var branch = {
            index: i,
            name: rawData[i]._name,
            type: rawData[i].__type__,
            __id__: handler.result.__id__,
            _id: handler.result._id,
            data: rawData[i]
        };
        tempData.push(branch);
    }
}

function groupingData (tempData, filesPos) {
    tempData.forEach(function (obj) {
        switch(obj.type) {
            case type.scene:
            case type.privateNode:
            case type.node:
                var node = {
                    _id:obj.data._id,
                    prefab: obj.data._prefab,
                    __id__: obj.__id__,
                    _properties: obj.data
                };
                filesPos.nodes.push(node);
                break;
            case type.prefabInfo:
                var info = {
                    __id__: obj.__id__,
                    _properties: obj.data
                }
                filesPos.prefabInfos.push(info);
                break;
            case type.sceneAsset:
                filesPos.sceneHeader = obj.data;
                break;
            default :
                var node = '';
                if (obj.data.node) {
                    node = obj.data.node.__id__;
                }
                var component = {
                    node: node,
                    __id__: obj.__id__,
                    // _id is belong to node
                    _id: obj._id,
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

    var modelBase, modelLocal, modelRemote;
    var result = pipe.preReplaceData(
                        createModel(fireFiles.base), 
                        createModel(fireFiles.local), 
                        createModel(fireFiles.remote), 
                        config.replaceData
                    );
    if (result) {
        modelBase = result[0];
        modelLocal = result[1];
        modelRemote = result[2];
    }

    var compareFold = path.join(destinationPath, '/MergeCache');
    // add the clear the destination fold.
    if (fs.existsSync(compareFold))
        del.sync(compareFold + '/**', {force: true});

    fs.mkdirSync(compareFold);
    fs.writeFileSync(compareFold + `/${name}Base.json`, modelBase, {
        encoding: 'utf8',
        flag: 'w'
    });
    fs.writeFileSync(compareFold + `/${name}Local.json`, modelLocal, {
        encoding: 'utf8',
        flag: 'w'
    });
    fs.writeFileSync(compareFold + `/${name}Remote.json`, modelRemote, {
        encoding: 'utf8',
        flag: 'w'
    });
    var paths = fs.readdirSync(compareFold, {encoding: 'utf8'}).map(x => path.join(compareFold, x));

    return paths;
} 

function createModel (filePos) {
    var model = [];
    // header
    var header = {
        __id__: filePos.sceneHeader.__type__,
        content: filePos.sceneHeader
    };
    model.push(header);
    // node
    filePos.nodes.forEach(function (obj) {
        obj._properties._components = [];
        obj._properties._prefab = null;
        var node = {
            __id__: `${obj.__id__}`,
            content: obj._properties,
            _components: [],
            _prefabInfos: [],
            _clickEvent: []
        };
        // comp there has been sort
        for(let i = 0; i < filePos.components.length; i++) {
            var comp = filePos.components[i];
            if (comp._id == obj._id) {
                if (comp._properties.__type__ == type.clickEvent) {
                    node._clickEvent.push({
                        __id__: comp.__id__,
                        content: comp._properties
                    });
                } 
                else {
                    comp._properties.node = undefined;
                    node._components.push({
                        __id__: comp.__id__,
                        content: comp._properties
                    });
                }
            }
        };
        // prefab
        if (obj.prefab) {
            for (let i = 0; i < filePos.prefabInfos.length; i++) {
                var info = filePos.prefabInfos[i];
                if (obj.prefab.__id__ == info.__id__) {
                    info._properties.root = undefined;
                    node._prefabInfos.push({
                        __id__: info.__id__,
                        content: info._properties
                    });
                    break;
                }
            }
        }
        model.push(node);
    });
    return model;
}

function compareForMerge (toolPath, compareFiles, merge) {
    var base = compareFiles[0];
    var local = compareFiles[1];
    var remote = compareFiles[2];

    execFileSync(toolPath, [base, local, remote, '-o', merge]);
}

function indexToMark (tempData) {
    tempData.forEach(function (obj) {
        obj.data = locationId(obj, tempData);
    });
}

function locationId (obj, tempData) {
    var str = JSON.stringify(obj.data, null, '\t');
    str = str.replace(/"__id__": ([0-9]+)/g, function (match, index) {
        var __id__ = ''; 
        var target = tempData[index];
        var _id = obj._id;
        var _name = obj.name;
        if (target.data.__type__ === type.clickEvent) {    
            __id__ = `${type.clickEvent}: ${obj.name}, Comp ${_name}(${_id})`;
            target.__id__ = __id__;
            target._id = _id;
        }
        else if (target.__id__ && target.__id__.includes(type.custom)) {
            __id__ = getMark(tempData, parseInt(index));
            target._id = _id;
        }
        else {
            __id__ = getMark(tempData, parseInt(index));
        }

        return `"__id__": "${__id__}"`;
    });
    obj.data = JSON.parse(str);

    return obj.data;
}

function getMark (array, index) {
    var obj = array.find(function (ele) {
        if (ele.index === index) {
            return ele;
        }
    });
    return obj.__id__;
}

function getFileName (tempName) {
    var spell = tempName.split('_');
    var words = [];
    for(let i = 0; i < spell.length; i++) {
        if (spell[i] === 'BASE') {
            var name = words.join('_');
            return name;
        }
        words.push(spell[i]);
    }
}

function compareByName (a, b) {
    return a.__id__.localeCompare(b.__id__);
}
