// jshint ignore: start

largeModule('Deserialize');

test('basic deserialize test', function () {
    deepEqual(Fire.deserialize({}), {}, 'smoke test1');
    deepEqual(Fire.deserialize([]), [], 'smoke test2');

    // TODO:
    var MyAsset = (function () {
        var _super = Fire.Asset;

        function MyAsset () {
            _super.call(this);

            this.emptyArray = [];
            this.array = [1, '2', {a:3}, [4, [5]], true];
            this.string = 'unknown';
            this.emptyString = '';
            this.number = 1;
            this.boolean = true;
            this.emptyObj = {};
            this.embeddedTypedObj = new Vec2(1, 2.1);
        }
        Fire.extend(MyAsset, _super);
        Fire.registerClass('MyAsset', MyAsset);
        return MyAsset;
    })();

    var asset = new MyAsset();
    var serializedAsset = Fire.serialize(asset, false, false);
    var deserializedAsset = Fire.deserialize(serializedAsset);

    deepEqual(deserializedAsset, asset, 'test deserialize');

    Fire.unregisterClass(MyAsset);
});

test('nil', function () {
    var obj = {
        'null': null,
    };
    var str = '{ "null": null }'
    deepEqual(Fire.deserialize(str), obj, 'can deserialize null');

    var MyAsset = Fire.define('MyAsset', function () {
        this.foo = 'bar';
    }).prop('nil', 1234);

    str = '{ "__type__": "MyAsset" }'
    obj = new MyAsset();
    deepEqual(Fire.deserialize(str), obj, 'use default value');

    str = '{ "__type__": "MyAsset", "nil": null }'
    obj = new MyAsset();
    obj.nil = null;
    deepEqual(Fire.deserialize(str), obj, 'can override as null');

    Fire.unregisterClass(MyAsset);
});

test('json deserialize test', function () {

    // TODO:
    var MyAsset = (function () {
        var _super = Fire.Asset;

        function MyAsset () {
            _super.call(this);

            this.emptyArray = [];
            this.array = [1, '2', {a:3}, [4, [5]], true];
            this.string = 'unknown'; 
            this.number = 1;
            this.boolean = true;
            this.emptyObj = {};
            this.obj = {};

        }
        Fire.extend(MyAsset, _super);
        Fire.registerClass('MyAsset', MyAsset);
        return MyAsset;
    })();

    var jsonStr = '{"__type__":"MyAsset","emptyArray":[],"array":[1,"2",{"a":3},[4,[5]],true],"string":"unknown","number":1,"boolean":true,"emptyObj":{},"obj":{},"dynamicProp":false}';

    var deserializedAsset = Fire.deserialize(jsonStr);

    var expectAsset = new MyAsset();

    deepEqual(deserializedAsset, expectAsset, 'json deserialize test');

    Fire.unregisterClass(MyAsset);
});

test('reference to main asset', function () {
    var asset = {};
    asset.refSelf = asset;
    /*  {
            "refSelf": {
                "__id__": 0
            }
        }
     */

    var serializedAsset = Fire.serialize(asset);
    var deserializedAsset = Fire.deserialize(serializedAsset);
    
    ok(deserializedAsset.refSelf === deserializedAsset, 'should ref to self');
    //deepEqual(Fire.serialize(deserializedAsset), serializedAsset, 'test deserialize');
});

test('circular reference by object', function () {
    var MyAsset = (function () {
        var _super = Fire.Asset;
        function MyAsset () {
            _super.call(this);
            this.refSelf = this;
            this.refToMain = null;
        }
        Fire.extend(MyAsset, Fire.Asset);
        Fire.registerClass('MyAsset', MyAsset);
        return MyAsset;
    })();
    
    var asset = new MyAsset();
    var mainAsset = { myAsset: asset };
    asset.refToMain = mainAsset;

    var serializedAsset = Fire.serialize(mainAsset, false, false);
    var deserializedAsset = Fire.deserialize(serializedAsset);
    
    ok(deserializedAsset.myAsset.refSelf === deserializedAsset.myAsset, 'sub asset should ref to itself');
    ok(deserializedAsset.myAsset.refToMain === deserializedAsset, 'sub asset should ref to main');

    deepEqual(deserializedAsset, mainAsset, 'can ref');

    Fire.unregisterClass(MyAsset);
});

test('circular reference by array', function () {
    var MyAsset = (function () {
        var _super = Fire.Asset;

        function MyAsset () {
            _super.call(this);
            this.array1 = [1];
            this.array2 = [this.array1, 2];
            this.array1.push(this.array2);
            // array1 = [1, array2]
            // array2 = [array1, 2]
        }
        Fire.extend(MyAsset, _super);
        Fire.registerClass('MyAsset', MyAsset);

        return MyAsset;
    })();

    var expectAsset = new MyAsset();
    //Fire.log(Fire.serialize(expectAsset));
    var json = '[{"__type__":"MyAsset","array1":{"__id__":1},"array2":{"__id__":2}},[1,{"__id__":2}],[{"__id__":1},2]]';
    var deserializedAsset = Fire.deserialize(json);

    deepEqual(deserializedAsset, expectAsset, 'two arrays can circular reference each other');
    strictEqual(deserializedAsset.array1[1][0], deserializedAsset.array1, 'two arrays can circular reference each other 1');
    strictEqual(deserializedAsset.array2[0][1], deserializedAsset.array2, 'two arrays can circular reference each other 2');

    Fire.unregisterClass(MyAsset);
});

test('circular reference by dict', function () {
    var MyAsset = (function () {
        var _super = Fire.Asset;

        function MyAsset () {
            _super.call(this);
            this.dict1 = {num: 1};
            this.dict2 = {num: 2, other: this.dict1};
            this.dict1.other = this.dict2;
        }
        Fire.extend(MyAsset, _super);
        Fire.registerClass('MyAsset', MyAsset);

        return MyAsset;
    })();
    var expectAsset = new MyAsset();

    var serializedAssetJson = '[{"__type__":"MyAsset","dict1":{"__id__":1},"dict2":{"__id__":2}},{"num":1,"other":{"__id__":2}},{"num":2,"other":{"__id__":1}}]';
    var deserializedAsset = Fire.deserialize(serializedAssetJson);

    deepEqual(deserializedAsset, expectAsset, 'two dicts can circular reference each other');
    strictEqual(deserializedAsset.dict1.other.other, deserializedAsset.dict1, 'two dicts can circular reference each other 1');
    strictEqual(deserializedAsset.dict2.other.other, deserializedAsset.dict2, 'two dicts can circular reference each other 2');

    Fire.unregisterClass(MyAsset);
});

// jshint ignore: end
