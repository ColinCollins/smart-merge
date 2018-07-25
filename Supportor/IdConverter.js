module.exports = {
    indexToMark: function (tempData) {
        tempData.forEach(function (obj) {
            obj.data = this.locationId(obj, tempData);
        }.bind(this));
    },
    
    locationId: function (obj, tempData) {
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
                __id__ = this.getMark(tempData, parseInt(index));
                target._id = _id;
            }
            else {
                __id__ = this.getMark(tempData, parseInt(index));
            }
    
            return `"__id__": "${__id__}"`;
        });
        obj.data = JSON.parse(str);
    
        return obj.data;
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
    },

    getMark: function (array, index) {
        var obj = array.find(function (ele) {
            if (ele.index === index) {
                return ele;
            }
        });
        return obj.__id__;
    }
}