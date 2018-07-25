const type = require('../enums');

var createMark = {
    // return back
    result: {
        __id__: '',
        _id: ''
    },
    // record the component name if there are some same components
    compAssemblyData: {},

    createSceneAssetId: function (_type) {
        this.result.__id__ = `${_type}: fileHeader`;
        this.result._id = '';
    },
    
    createSceneId: function (_typee, _id) {
        this.result.__id__ = `${_type}: Scene, id: ${_id}`;
        this.result._id = '';
    },
    
    createNodeId: function (_type, _id, name) {
        this.result.__id__ = `${_type}: ${name}, id: ${_id}`;
        this.result._id = _id;
    },

    createPrefabInfo: function (_type, fileId) {
        this.result.__id__ = `${_type}: ${fileId}`;
        this.result._id = '';
    },

    createClickEvent: function (_type) {
        this.result.__id__ = `${_type}`;
        this.result._id = '';
    },

    createComponent: function (node, _type) {
        this.result.__id__ = `${type.comp}: ${_type}, Node: ${node._name}(${node._id})`;
        if (Object.keys(this.compAssemblyData).includes(this.result.__id__) > 0) {
            this.compAssemblyData[this.result.__id__]++;
            this.result.__id__ = `${type.comp}: ${_type}, Node: ${node._name}(${node._id}), index: ${this.compAssemblyData[this.result.__id__]}`;
        }
        else {
            this.compAssemblyData[this.result.__id__] = 0;
        }
        this.result._id = node._id;
    },

    createCustemEvent: function () {
        this.result.__id__ = type.custom;
        if (Object.keys(this.compAssemblyData).includes(this.result.__id__) > 0) {
            this.compAssemblyData[this.result.__id__]++;
            this.result.__id__ = `${type.custom}, index: ${this.compAssemblyData[this.result.__id__]}`;
        }
        else {
            this.compAssemblyData[this.result.__id__] = 0;
        }
        this.result._id = '';
    },

    createDefault: function (target, rawData) {
        if (target.node) {
            var nodeIndex = target.node.__id__;
            this.createComponent(rawData[nodeIndex], target.__type__);
        }
        else {
           this.createCustemEvent();
        }
    }
}

module.exports = createMark;