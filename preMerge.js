const process = require('process');
const path = require('path');
const fs = require('fs');
const del = require('del');
const { execFileSync } = require('child_process');
const cover = require('./CoverMerge');
const type = require('./Supportor/enums');
const pipe = require('./Supportor/MergePipe');
const convert = require('./Supportor/IdConverter');

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
    convert.indexToMark(tempData);
    groupingData(tempData, filesPos);

    filesPos.nodes.sort(compareByName);

    return filesPos;  
}

function resolveData (rawData, tempData) {
    let handler = require('./Supportor/CreateMark');
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
    let handler = require('./Supportor/Grouping');
    tempData.forEach(function (obj) {
        switch(obj.type) {
            case type.scene:
            case type.privateNode:
            case type.node:
                handler.Divide2Nodes(obj, filesPos);
                break;
            case type.prefabInfo:
                handler.Divide2PrefabInfos(obj, filesPos);
                break;
            case type.sceneAsset:
                handler.Divide2SceneAsset(obj, filesPos);
                break;
            default :
                handler.Divide2Components(obj, filesPos);
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
        obj._properties._prefab = undefined;
        var node = {
            __id__: `${obj.__id__}`,
            content: obj._properties,
            _components: [],
            _prefabInfos: [],
            _clickEvent: []
        };
        componentModel(node, obj, filePos);
        prefabInfoModel(node, obj, filePos);
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

function componentModel (node, obj, filePos) {
    for (let i = 0; i < filePos.components.length; i++) {
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
}

function prefabInfoModel (node, obj, filePos) {
    if (!obj.prefab) return;

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

function getFileName (tempName) {
    var spell = tempName.split('_');
    var words = [];
    for (let i = 0; i < spell.length; i++) {
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
