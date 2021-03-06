
var _Deserializer = (function () {

    function _Deserializer(data, result, editor) {
        this._editor = (typeof editor !== 'undefined') ? editor : true;
        
        this.result = result || new Fire._DeserializeInfo();

        var jsonObj = null;
        if (typeof data === 'string') {
            jsonObj = JSON.parse(data);
        }
        else {
            jsonObj = data;
        }
        
        if (Array.isArray(jsonObj)) {
            var referencedList = jsonObj;
            var refCount = referencedList.length;
            // deserialize
            for (var i = 0; i < refCount; i++) {
                if (referencedList[i]) {
                    referencedList[i] = _deserializeObject(this, referencedList[i]);
                }
            }
            // dereference
            _dereference(referencedList, referencedList);
            // 
            this.deserializedData = refCount > 0 ? referencedList[0] : [];

            //// callback
            //for (var j = 0; j < refCount; j++) {
            //    if (referencedList[j].onAfterDeserialize) {
            //        referencedList[j].onAfterDeserialize();
            //    }
            //}
        }
        else {
            //jsonObj = jsonObj || {};
            var deserializedData = jsonObj ? _deserializeObject(this, jsonObj) : null;
            _dereference(deserializedData, [deserializedData]);
            this.deserializedData = deserializedData;

            //// callback
            //if (deserializedData.onAfterDeserialize) {
            //    deserializedData.onAfterDeserialize();
            //}
        }
    }

    /**
     * @param {object} obj - The object to dereference, must be object type, non-nil, not a reference
     * @param {object[]} referenceList - The referenced list to get reference from
     */
    var _dereference = function (obj, referenceList) {
        if (Array.isArray(obj)) {
            for (var i = 0; i < obj.length; i++) {
                if (obj[i] && typeof obj[i] === 'object') {
                    var id1 = obj[i].__id__;
                    if (id1 !== undefined) {
                        // set real reference
                        obj[i] = referenceList[id1];
                    }
                    else {
                        _dereference(obj[i], referenceList);
                    }
                }
            }
        }
        else {
            for (var k in obj) {
                var val = obj[k];
                if (val && typeof val === 'object') {
                    var id2 = val.__id__;
                    if (id2 !== undefined) {
                        obj[k] = referenceList[id2];
                    }
                    else {
                        _dereference(val, referenceList);
                    }
                }
            }
        }
    };

    /**
     * @param {Object} serialized - The obj to deserialize, must be non-nil
     */
    var _deserializeObject = function (self, serialized) {
        var propName, prop;
        var asset = null;
        var klass = null;
        if (serialized.__type__) {
            klass = Fire.getClassByName(serialized.__type__);
            if (!klass) {
                Fire.error('[Fire.deserialize] unknown type: ' + serialized.__type__);
                return null;
            }
            // instantiate a new object
            asset = new klass();
        }
        else if (!Array.isArray(serialized)) {
            // embedded primitive javascript object, not asset
            asset = serialized;
            //// jshint -W010
            //asset = new Object();
            //// jshint +W010
        }
        else {
            asset = serialized;
            for (var i = 0; i < serialized.length; i++) {
                prop = serialized[i];
                if (typeof prop === 'object' && prop) {
                    if (!prop.__uuid__) {
                        asset[i] = _deserializeObject(self, prop);
                    }
                    else {
                        self.result.uuidList.push(prop.__uuid__);
                        self.result.uuidObjList.push(asset);
                        self.result.uuidPropList.push('' + i);
                    }
                }
            }
            return serialized;
        }

        // parse property
        if (klass && Fire._isFireClass(klass)) {
            if (!klass.__props__) {
                return asset;
            }
            for (var p = 0; p < klass.__props__.length; p++) {
                propName = klass.__props__[p];
                var attrs = Fire.attr(klass, propName);
                // assume all prop in __props__ must have attr
                var hostType = attrs.hostType;
                if (!hostType) {
                    // skip nonSerialized
                    if (attrs.serializable === false) {
                        continue;
                    }

                    // skip editor only if not editor
                    if (!self._editor && attrs.editorOnly) {
                        continue;
                    }

                    prop = serialized[propName];
                    if (typeof prop !== 'undefined') {
                        if (typeof prop !== 'object') {
                            asset[propName] = prop;
                        }
                        else {
                            if (prop) {
                                if (!prop.__uuid__) {
                                    asset[propName] = _deserializeObject(self, prop);
                                }
                                else {
                                    self.result.uuidList.push(prop.__uuid__);
                                    self.result.uuidObjList.push(asset);
                                    self.result.uuidPropList.push(propName);
                                }
                            }
                            else {
                                asset[propName] = null;
                            }
                        }
                    }
                }
                else {
                    // always load host objects even if property not serialized
                    if (self.result.hostProp) {
                        Fire.error('not support multi host object in a file');
                        // 这里假定每个asset都有uuid，每个json只能包含一个asset，只能包含一个hostProp
                    }
                    self.result.hostProp = propName;
                }
            }
        }
        else /*javascript object instance*/ {
            for (propName in asset) {
                prop = serialized[propName];
                if (typeof prop !== 'undefined' && serialized.hasOwnProperty(propName)) {
                    if (typeof prop !== 'object') {
                        asset[propName] = prop;
                    }
                    else {
                        if (prop) {
                            if (!prop.__uuid__) {
                                asset[propName] = _deserializeObject(self, prop);
                            }
                            else {
                                self.result.uuidList.push(prop.__uuid__);
                                self.result.uuidObjList.push(asset);
                                self.result.uuidPropList.push(propName);
                            }
                        }
                        else {
                            asset[propName] = null;
                        }
                    }
                }
            }
        }
        return asset;
    };

    return _Deserializer;
})();

/**
 * @property {boolean} Fire.deserializing
 */
Fire._isDeserializing = false;

/**
 * Deserialize json to Fire.Asset
 * @param {(string|object)} data - the serialized Fire.Asset json string or json object
 * @param {Fire._DeserializeInfo} [result] - additional loading result
 * @param {boolean} [editor=true] - if false, property with Fire.EditorOnly will be discarded
 * @returns {object} the main data(asset)
 */
Fire.deserialize = function (data, result, editor) {
    Fire._isDeserializing = true;
    var deserializer = new _Deserializer(data, result, editor);
    Fire._isDeserializing = false;
    return deserializer.deserializedData;
};

/**
 * 包含反序列化时的一些信息
 * @class Fire._DeserializeInfo
 */
Fire._DeserializeInfo = function () {

    //this.urlList = [];
    //this.callbackList = [];

    // uuids(assets) need to load

    /**
     * @property {string[]} uuidList - list of the depends assets' uuid
     */
    this.uuidList = [];
    /**
     * @property {object[]} uuidObjList - the obj list whose field needs to load asset by uuid
     */
    this.uuidObjList = [];
    /**
     * @property {string[]} uuidPropList - the corresponding field name which referenced to the asset
     */
    this.uuidPropList = [];

    // host objects need to load
    // (不用存hostList因为它的uuid可以从asset上获得)

    /**
     * @property {string} hostProp - the corresponding field name which referenced to the host object
     */
    this.hostProp = '';
    ///**
    // * @property {Fire.Asset[]} hostObjList - the obj list whose corresponding host object needs to load
    // */
    //this.hostObjList = [];
    ///**
    // * @property {string[]} hostPropList - the corresponding field name which referenced to the host object
    // */
    //this.hostPropList = [];
};

Fire._DeserializeInfo.prototype.reset = function () {
    this.uuidList.length = 0;
    this.uuidObjList.length = 0;
    this.uuidPropList.length = 0;
    this.hostProp = '';
    //this.hostObjList.length = 0;
    //this.hostPropList.length = 0;
};
