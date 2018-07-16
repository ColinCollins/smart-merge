const process = require('process');
const path = require('path');
const fs = require('fs');
const del = require('del');
const { execFileSync } = require('child_process');
const cover = require('./coverMerge');

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
        
        var name = getName(fireFiles.base.name);
        // resort the merge to the scene fire
        cover.coverFile(merge, dir, name);
    }
    else {
        // if is not fire file conflict
        for (let i = 2; i < args.length - 1; i++) {
            compareFiles.push(args[i]);
        }
        compareForMerge(config.dependMergeTool, compareFiles, merge);
        cover.coverFile(merge, dir);
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
    indexToMark(tempData);
    groupingData(tempData, filesPos);

    var nodesCompare = sortNorm === '-id' ? compareById : compareByName;
    filesPos.nodes.sort(nodesCompare);

    return filesPos;  
}

function resolveData (rawData, tempData) {
    for (let i = 0; i < rawData.length; i++) {
        var __id__ = '';
        // create the __id__ id, there maybe need change or make a model to other file as a import.
        switch (rawData[i].__type__) {
            case 'cc.SceneAsset':
                __id__ = {
                    type: "fileHeader"
                };
                break;
            case 'cc.Scene':
                __id__ = {
                    type: `${rawData[i].__type__}`,
                    _id: `${rawData[i]._id}`
                };
                break;
            case 'cc.PrivateNode':
            case 'cc.Node':
                __id__ = {
                    type: `${rawData[i].__type__}`, 
                    name: `${rawData[i]._name}`, 
                    _id: `${rawData[i]._id}`
                };
                break;
            case 'cc.PrefabInfo':
                __id__ = {
                    type: `${rawData[i].__type__}`, 
                    fileId: `${rawData[i].fileId}`
                };
                break;
            case 'cc.ClickEvent':
                // did not get the special and only can be find by comp
                __id__ = {
                    type: `${rawData[i].__type__}`
                };
                break;
            default: 
                // there is the component contain the custome and the office componet
                var nodeIndex = '';
                //console.log(rawData[i].__type__);
                nodeIndex = rawData[i].node.__id__;
                __id__ = {
                    type: `Comp`, 
                    name: `${rawData[nodeIndex]._name}`,
                    _id: `${rawData[nodeIndex]._id}`, 
                    OwnType: `${rawData[i].__type__}`
                };
                break;
        }
        __id__ = JSON.stringify(__id__);
        var branch = {
            index: i,
            type: rawData[i].__type__,
            __id__: __id__,
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
                    __id__: obj.__id__,
                    _properties: obj.data
                };
                filesPos.nodes.push(node);
                break;
            case 'cc.PrefabInfo':
                var info = {
                    __id__: obj.__id__,
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
                    node: node, // node __id__ correspond __id__ 
                    __id__: obj.__id__,
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
        }
        // comp there has been sort
        filePos.components.forEach(function (comp) {
            var compMark = comp.__id__;
            var parse = JSON.parse(compMark); 
            if (parse._id == obj._id) {
                if (parse.OwnType == 'cc.ClickEvent') {
                    node._clickEvent.push({
                        __id__: compMark,
                        content: comp._properties
                    });
                } 
                else {
                    comp._properties.node = {};
                    node._components.push({
                        __id__: compMark,
                        content: comp._properties
                    });
                }
            }
        });
        // prefab
        if (obj.prefab) {
            filePos.prefabInfos.forEach(function (info) {
                if (obj.prefab.__id__ == info.__id__) {
                    info._properties.root = {};
                    node._prefabInfos.push({
                        __id__: `${info.__id__}`,
                        content: info._properties
                    });
                }
            });
        }
        model.push(node);
    });

    return JSON.stringify(model, null, '\t');
}

function compareForMerge (toolPath, compareFiles, merge) {
    var base = compareFiles[0];
    var remote = compareFiles[1];
    var local = compareFiles[2];  

    execFileSync(toolPath, [base, remote, local, '-o', merge]);
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
        var clickEvent = tempData[index];
        // the clickevent is little special did have any message contect to the user
        if (clickEvent.data.__type__ === 'cc.ClickEvent') {
            // sort out the clickEvent's __id__
            var parse = JSON.parse(obj.__id__, null, '\t');
            var _id = parse._id;
            var _name = parse.name;
            __id__ = {
                type: "ClickEvent", 
                name: `${_name}`,
                _id: `${_id}`, 
                OwnType: `${clickEvent.data.__type__}`
            };
            __id__ = JSON.stringify(__id__);
            clickEvent.__id__ = __id__;
        }
        else {
            __id__ = getMark(tempData, parseInt(index));
        }
        // JSON type file want to get the str must use the stringify
        return `"__id__": ${JSON.stringify(__id__)}`;
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

function getName (tempName) {
    var spell = tempName.split('_');
    var name = '';
    for(let i = 0; i < spell.length; i++) {
        if (spell[i] === 'BASE') {
            return name;
        }
        name = name.concat(spell[i]);
    }
}
// compare function
function compareById (a, b) {
    return a._id.localeCompare(b._id);
}

function compareByName (a, b) {
    return a.__id__.localeCompare(b.__id__);
}
