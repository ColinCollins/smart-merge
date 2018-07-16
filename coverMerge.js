const path = require('path');
const fs = require('fs');
const del = require('del');

module.exports = {
    coverFile: function (tempFile, savePath, name) {
        // resort the index; tempFile is json file
        var merge = fs.readFileSync(tempFile, {encoding: 'utf8'});
        var data = JSON.parse(merge);
        
        // sort and create new array 
        var result = this.transToNormal(data);
    
        console.log('``````````````finished!````````````````');
        
        fs.writeFileSync(`${savePath}/${name}.fire`, JSON.stringify(result, null, '\t'), {
            encoding: 'utf8',
            force: true
        });
        del.sync(tempFile, {force: true});
        del.sync(path.join(savePath, 'Mergecache'), {force: true});
    },

    transToNormal: function (mergeData) {
        var tempData = [];
        mergeData = this.sortForTree(mergeData);
        mergeData.forEach(function (obj) {
            tempData.push({
                __id__: obj.__id__,
                content: obj.content
            });

            if (obj.content.__type__ === 'cc.SceneAsset') {
                return;
            }
            for (let i = 0; i < obj._components.length; i++) {
                obj._components[i].content.node.__id__ = obj.__id__;
                tempData.push({
                    __id__: obj._components[i].__id__,
                    content: obj._components[i].content
                });
                obj.content._components.push({
                    __id__: obj._components[i].__id__
                });
            }
            if (obj._prefabInfos.length > 0) {
                obj._prefabInfos[0].content.root.__id__ = obj.__id__;
                tempData.push({
                    __id__: obj._prefabInfos[0].__id__,
                    content: obj._prefabInfos[0].content
                });
                obj.content._prefab = {
                    __id__: obj._prefabInfos[0].__id__
                };
            }
            for (let k = 0; k < obj._clickEvent.length; k++) {
                tempData.push({
                    __id__: obj._clickEvent[k].__id__,
                    content: obj._clickEvent[k].content
                });
            }
        });

        var result = this.markToIndex(tempData);

        return result;
    },

    sortForTree: function (mergeData) {
        var scene = mergeData.find(function (ele) {
            if (ele.content.__type__ === 'cc.Scene')
                return ele;
        });
        var tempData = [];
        tempData.push(mergeData[0]);
        this.recurseChild(scene, mergeData).forEach(function (obj) {
            tempData.push(obj);
        });
        
        return tempData;
    },

    recurseChild: function (node, mergeData) {
        var _self = this;
        var record, result = [];
        result.push(node);
        if (node.content._children.length < 0) {
            return result;
        }
        node.content._children.forEach(function (child) {
            for (let i = 0; i < mergeData.length; i++) {
                if (mergeData[i].__id__ === child.__id__) {
                    record = _self.recurseChild (mergeData[i], mergeData);
                    for (let j = 0; j < record.length; j++){
                        result.push(record[j]);
                    }
                    break;
                }
            }
        });    

        return result;
    },

    markToIndex: function (tempData) {
        var data = [];
        tempData.forEach(function (obj) {
            obj = this.locationIndex(obj.content, tempData);
            data.push(obj)
        }.bind(this));
        
        return data;
    },

    locationIndex: function (objData, tempData) {
        // must the node sort first, or will lost the __id__
        var str = JSON.stringify(objData, null, '\t');
        str = str.replace(/"__id__": "([\S ]+)"/g, function (match, __id__) {
            var index = tempData.findIndex(function (ele) {
                // parse is to make the obj become the str
                if (`"${__id__}"` === JSON.stringify(ele.__id__)) {
                    return ele;
                }
            });
            return `"__id__": ${index}`;
        });
        objData = JSON.parse(str);

        return objData;
    }
}