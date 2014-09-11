
var _Deserializer = (function () {

    function _Deserializer(data, context, editor) {
        this._editor = (typeof editor !== 'undefined') ? editor : true;
        
        this.context = context || new FIRE._LoadingContext();

        var jsonObj = null;
        if (typeof data === 'string') {
            jsonObj = JSON.parse(data);
        }
        else {
            jsonObj = data;
        }
        
        if (Array.isArray(jsonObj)) {
            var referencedList = jsonObj;
            // deserialize
            for (var i = 0, len = referencedList.length; i < len; i++) {
                referencedList[i] = _deserializeAsset(this, referencedList[i]);
            }
            // dereference
            referencedList = _dereference(referencedList, referencedList);
            // 
            this.deserializedData = referencedList.pop() || [];
        }
        else {
            //jsonObj = jsonObj || {};
            this.deserializedData = _deserializeAsset(this, jsonObj);
        }
    }

    /**
     * @param {object} obj - The object to dereference, must be object type, non-nil, not a reference
     * @param {object[]} referenceList - The referenced list to get reference from
     * @returns {object} the referenced object
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
                        obj[i] = _dereference(obj[i], referenceList);
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
                        obj[k] = _dereference(val, referenceList);
                    }
                }
            }
        }
        return obj;
    };

    /**
     * @param {Object} serialized - The obj to deserialize
     */
    var _deserializeAsset = function (self, serialized) {
        if (!serialized) {
            return null;
        }
        if (!serialized.__type__) {
            // embedded primitive javascript object, not asset, can not serialize host resource
            for (var key in serialized) {
                var val = serialized[key];
                if (val && val.__uid__) {
                    self.context.uuidList.push(val.__uid__);
                    self.context.uuidObjList.push(serialized);
                    self.context.uuidPropList.push(key);
                }
            }
            return serialized;
        }
        
        var asset = null;
        var klass = null;
        klass = FIRE.getClassByName(serialized.__type__);
        if (!klass) {
            console.warn('FIRE.deserialize: unknown type: ' + serialized.__type__);
            return null;
            //// jshint -W010
            //asset = new Object();
            //// jshint +W010
        }
        // instantiate a new object
        asset = new klass();

        // parse property
        if (klass && FIRE._isFireClass(klass)) {
            if (klass.__props__) {
                for (var p = 0; p < klass.__props__.length; p++) {
                    var propName = klass.__props__[p];
                    var attrs = FIRE.attr(klass, propName);

                    // always load host objects even if property not serialized
                    var hostType = attrs.hostType;
                    if (hostType) {
                        self.context.hostObjList.push(asset);
                        self.context.hostPropList.push(propName);
                    }
                    else {
                        // skip nonSerialized
                        if (attrs.serializable === false) {
                            continue;
                        }

                        // skip editor only if not editor
                        if (!self._editor && attrs.editorOnly) {
                            continue;
                        }

                        var prop = serialized[propName];
                        if (typeof prop !== 'undefined') {        
                            asset[propName] = prop;
                            if (prop && prop.__uid__) {
                                self.context.uuidList.push(prop.__uid__);
                                self.context.uuidObjList.push(asset);
                                self.context.uuidPropList.push(propName);
                            }
                        }
                    }
                }
            }
            var onAfterDeserialize = asset.onAfterDeserialize;
            if (onAfterDeserialize) {
                onAfterDeserialize();
            }
        }
        else /*javascript object instance*/ {
            for (var k in asset) {
                var v = serialized[k];
                if (typeof v !== 'undefined' && serialized.hasOwnProperty(k)) {
                    asset[k] = v;
                    if (v && v.__uid__) {
                        self.context.uuidList.push(v.__uid__);
                        self.context.uuidObjList.push(asset);
                        self.context.uuidPropList.push(k);
                    }
                }
            }
        }
        return asset;
    };

    return _Deserializer;
})();

/**
 * Deserialize json to FIRE.Asset
 * @param {(string|object)} data - the serialized FIRE.Asset json string or json object
 * @param {FIRE._LoadingContext} [context] - the loading context info
 * @param {boolean} [editor=true] - if false, property with FIRE.EditorOnly will be discarded
 * @returns {object} the main data(asset)
 */
FIRE.deserialize = function (data, context, editor) {
    var deserializer = new _Deserializer(data, context, editor);
    return deserializer.deserializedData;
};

/**
 * contains asset's loading context info
 * @class FIRE._LoadingContext
 */
FIRE._LoadingContext = function () {

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
    /**
     * @property {int} uuidLoaded - the loaded count
     */
    this.uuidLoaded = 0;

    // host objects need to load
    // (不用存hostList因为它的uuid可以从asset上获得)

    /**
     * @property {FIRE.Asset[]} hostObjList - the obj list whose corresponding host object needs to load
     */
    this.hostObjList = [];
    /**
     * @property {string[]} hostPropList - the corresponding field name which referenced to the host object
     */
    this.hostPropList = [];
    /**
     * @property {int} hostLoaded - the loaded count
     */
    this.hostLoaded = 0;
};

FIRE._LoadingContext.prototype.reset = function () {
    this.uuidList.length = 0;
    this.uuidObjList.length = 0;
    this.uuidPropList.length = 0;
    this.hostObjList.length = 0;
    this.hostPropList.length = 0;
};
