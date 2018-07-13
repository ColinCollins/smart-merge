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
        coverFile(merge, dir);
    }
    else {
        // if is not fire file conflict
        for (let i = 2; i < args.length - 1; i++) {
            compareFiles.push(args[i]);
        }
        compareForMerge(config.dependMergeTool, compareFiles, merge);
        coverFile(merge, dir);
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
        var mark = '';
        // create the mark id, there maybe need change or make a model to other file as a import.
        switch (rawData[i].__type__) {
            case 'cc.SceneAsset':
                mark = 'fileHeader';
                break;
            case 'cc.Scene':
                mark = `${rawData[i].__type__}-${rawData[i]._id}`;
                break;
            case 'cc.PrivateNode':
            case 'cc.Node':
                mark = `${rawData[i].__type__}-${rawData[i]._name}-${rawData[i]._id}`;
                break;
            case 'cc.PrefabInfo':
                mark = `${rawData[i].__type__}-${rawData[i].fileId}`;
                break;
            case 'cc.ClickEvent':
                // did not get the special and only can be find by comp
                makr = `${rawData[i].__type__}`;
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
    var model = [];
    // header
    var header = {
        mark: filePos.sceneHeader.__type__,
        content: filePos.sceneHeader
    };
    model.push(header);
    // node
    filePos.nodes.forEach(function (obj) {
        obj._properties._components = [];
        obj._properties._prefab = null;
        var node = {
            mark: obj.mark,
            content: obj._properties,
            _components: [],
            _prefabInfos: [],
            _clickEvent: []
        }
        // comp there has been sort
        filePos.components.forEach(function (comp) {
            var compMark = comp.mark;
            var parse = compMark.split('-'); 
            if (parse[2] == obj._id) {
                if (parse[3] == 'cc.ClickEvent') {
                    node._clickEvent.push({
                        mark: comp.mark,
                        content: comp._properties
                    });
                } 
                else {
                    comp._properties.node = {};
                    node._components.push({
                        mark: comp.mark,
                        content: comp._properties
                    });
                }
            }
        });
        // prefab
        if (obj.prefab) {
            filePos.prefabInfos.forEach(function (info) {
                if (obj.prefab.__id__ == info.mark) {
                    info._properties.root = {};
                    node._prefabInfos.push({
                        mark: info.mark,
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

function coverFile (tempFile, savePath) {
    // resort the index; tempFile is json file
    var merge = fs.readFileSync(tempFile, {encoding: 'utf8'});
    var data = JSON.parse(merge);
    
    // sort and create new array 
    var result = transToNormal(data);

    console.log('``````````````finished!````````````````');
    
    var name = fireFiles.base.name.split('_')[0];
    fs.writeFileSync(`${savePath}/${name}.fire`, JSON.stringify(result, null, '\t'), {
        encoding: 'utf8',
        force: true
    });
    del.sync(tempFile, {force: true});
    del.sync(path.join(savePath, 'Mergecache'), {force: true});
}

function transToNormal (mergeData) {
    var tempData = [];
    mergeData = sortForTree(mergeData);
    mergeData.forEach(function (obj) {
        tempData.push({
            mark: obj.mark,
            content: obj.content
        });

        if (obj.content.__type__ === 'cc.SceneAsset') {
            return;
        }
        for (let i = 0; i < obj._components.length; i++) {
            obj._components[i].content.node.__id__ = obj.mark;
            tempData.push({
                mark: obj._components[i].mark,
                content: obj._components[i].content
            });
            obj.content._components.push({
                __id__: obj._components[i].mark
            });
        }
        if (obj._prefabInfos.length > 0) {
            obj._prefabInfos[0].content.root.__id__ = obj.mark;
            tempData.push({
                mark: obj._prefabInfos[0].mark,
                content: obj._prefabInfos[0].content
            });
            obj.content._prefab = {
                __id__: obj._prefabInfos[0].mark
            };
        }
        for (let k = 0; k < obj._clickEvent.length; k++) {
            tempData.push({
                mark: obj._clickEvent[k].mark,
                content: obj._clickEvent[k].content
            });
        }
    });

    var result = markToIndex(tempData);

    return result;
}

function sortForTree (mergeData) {
    var scene = mergeData.find(function (ele) {
        if (ele.content.__type__ === 'cc.Scene')
            return ele;
    });
    var tempData = [];
    tempData.push(mergeData[0]);
    recurseChild(scene, mergeData).forEach(function (obj) {
        tempData.push(obj);
    });
    
    return tempData;
}

function recurseChild (node, mergeData) {
    var record, result = [];
    result.push(node);
    if (node.content._children.length < 0) {
        return result;
    }
    node.content._children.forEach(function (child) {
        for (let i = 0; i < mergeData.length; i++) {
            if (mergeData[i].mark === child.__id__) {
                record = recurseChild (mergeData[i], mergeData);
                for (let j = 0; j < record.length; j++){
                    result.push(record[j]);
                }
                break;
            }
        }
    });    

    return result;
}

function indexToMark (tempData) {
    tempData.forEach(function (obj) {
        obj.data = locationId(obj, tempData);
    });
}

function locationId (obj, tempData) {
    var str = JSON.stringify(obj.data, null, '\t');
    str = str.replace(/"__id__": ([0-9]+)/g, function (match, index) {
        var mark = '';
        var clickEvent = tempData[index];
        // the clickevent is little special did have any message contect to the user
        if (clickEvent.data.__type__ === 'cc.ClickEvent') {
            // sort out the clickEvent's mark
            var _id = obj.mark.split('-')[2];
            var _name = obj.mark.split('-')[1];
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
    var data = [];
    tempData.forEach(function (obj) {
        obj = locationIndex(obj.content, tempData);
        data.push(obj)
    });
    
    return data;
}

function locationIndex (objData, tempData) {
    // must the node sort first, or will lost the mark
    var str = JSON.stringify(objData, null, '\t');
    str = str.replace(/"__id__": "([\S ]+)"/g, function (match, mark) {
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
// compare function
function compareById (a, b) {
    return a._id.localeCompare(b._id);
}

function compareByName (a, b) {
    return a.mark.localeCompare(b.mark);
}
