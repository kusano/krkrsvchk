var krkrsvchk = require('../krkrsvchk');
var assert = require('assert');

describe('krkrsvchk', function() {
  describe('check', function() {
    function u8(s) {
      var A = new Uint8Array(s.length);
      for (var i=0; i<s.length; i++)
        A[i] = s.charCodeAt(i);
      return A;
    }

    it('OK',                    ()=>assert.equal(krkrsvchk.OK, krkrsvchk.check(u8('%[]')).code));
    it('FORMAT_ERROR',          ()=>assert.equal(krkrsvchk.FORMAT_ERROR, krkrsvchk.check(u8('\xfe\xfe\x00')).code));
    it('BYTE_CODE',             ()=>assert.equal(krkrsvchk.BYTE_CODE, krkrsvchk.check(u8('TJS2100\x00')).code));
    it('PARSE_ERROR',           ()=>assert.equal(krkrsvchk.PARSE_ERROR, krkrsvchk.check(u8('%["a"=>1+1]')).code));
    it('MACRO',                 ()=>assert.equal(krkrsvchk.MACRO, krkrsvchk.check(u8('%["core"=>%["mainConductor"=>%["macros"=>%["a"=>""]]]]')).code));
    it('THUMBNAIL',             ()=>assert.equal(krkrsvchk.THUMBNAIL, krkrsvchk.check(u8('BM')).code));
  });

  describe('equal', function() {
    var equal = krkrsvchk.__get__('equal');

    it('equal',                 ()=>assert.equal(true, equal([1, 2, 3], [1, 2, 3])));
    it('not equal',             ()=>assert.equal(false, equal([1, 2, 3], [1, 2, 4])));
    it('short',                 ()=>assert.equal(false, equal([1, 2, 3], [1, 2])));
    it('long',                  ()=>assert.equal(false, equal([1, 2, 3], [1, 2, 3, 4])));
  });

  describe('loadBinary', function() {
    var loadBinary = krkrsvchk.__get__('loadBinary');

    it('load',                  ()=>assert.equal(0, loadBinary(new Uint8Array([0x4b, 0x42, 0x41, 0x44, 0x31, 0x30, 0x30, 0x00, 0x00]))));
  });

  describe('loadText', function() {
    var loadText = krkrsvchk.__get__('loadText');

    it('load',                  ()=>assert.equal(0, loadText(new Uint8Array([0xff, 0xfe, 0x30, 0x00]))));
  });

  describe('parseBinary', function() {
    var parseBinary = krkrsvchk.__get__('parseBinary');

    function u8(d) {
      return new Uint8Array(d);
    }

    it('positive fix num',      ()=>assert.equal(10, parseBinary(u8([0x0a]))));
    it('fix map',               ()=>assert.deepEqual({a: 0, b: [], c: {d: {}}}, parseBinary(u8([0x83, 0xa1, 0x61, 0x00, 0x00, 0xa1, 0x62, 0x00, 0x90, 0xa1, 0x63, 0x00, 0x81, 0xa1, 0x64, 0x00, 0x80]))));
    it('fix array',             ()=>assert.deepEqual([0, 1, [2, 3, []]], parseBinary(u8([0x93, 0x00, 0x01, 0x93, 0x02, 0x03, 0x90]))));
    it('fix string',            ()=>assert.deepEqual('str', parseBinary(u8([0xa3, 0x73, 0x00, 0x74, 0x00, 0x72, 0x00]))));
    it('nil',                   ()=>assert.equal(undefined, parseBinary(u8([0xc0]))));
    it('void',                  ()=>assert.equal(undefined, parseBinary(u8([0xc1]))));
    it('true',                  ()=>assert.equal(1, parseBinary(u8([0xc2]))));
    it('false',                 ()=>assert.equal(0, parseBinary(u8([0xc3]))));
    it('string8',               ()=>assert.equal('abc', parseBinary(u8([0xc4, 0x03, 0x61, 0x00, 0x62, 0x00, 0x63, 0x00]))));
    it('string16',              ()=>assert.equal('abc', parseBinary(u8([0xc5, 0x03, 0x00, 0x61, 0x00, 0x62, 0x00, 0x63, 0x00]))));
    it('string32',              ()=>assert.equal('abc', parseBinary(u8([0xc6, 0x03, 0x00, 0x00, 0x00, 0x61, 0x00, 0x62, 0x00, 0x63, 0x00]))));
    it('float',                 ()=>assert.equal(3.820471434542632e-37, parseBinary(u8([0xca, 0x00, 0x01, 0x02, 0x03]))));
    it('double',                ()=>assert.equal(7.949928895127363e-275, parseBinary(u8([0xcb, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]))));
    it('uint8',                 ()=>assert.equal(0x80, parseBinary(u8([0xcc, 0x80]))));
    it('uint16',                ()=>assert.equal(0x9080, parseBinary(u8([0xcd, 0x80, 0x90]))));
    it('uint32',                ()=>assert.equal(0xb0a09080, parseBinary(u8([0xce, 0x80, 0x90, 0xa0, 0xb0]))));
    it('uint64',                ()=>assert.equal(0xd0c0b0a09080, parseBinary(u8([0xcf, 0x80, 0x90, 0xa0, 0xb0, 0xc0, 0xd0, 0x00, 0x00]))));
    it('int8',                  ()=>assert.equal(-0x80, parseBinary(u8([0xd0, 0x80]))));
    it('int8 positive',         ()=>assert.equal(0x05, parseBinary(u8([0xd0, 0x05]))));
    it('int16',                 ()=>assert.equal(-0x6f80, parseBinary(u8([0xd1, 0x80, 0x90]))));
    it('int32',                 ()=>assert.equal(-0x4f5f6f80, parseBinary(u8([0xd2, 0x80, 0x90, 0xa0, 0xb0]))));
    //it('int64',                 ()=>assert.equal(-1, parseBinary(u8([0xd3, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]))));
    it('fix raw',               ()=>assert.deepEqual(new Uint8Array([0x01, 0x02, 0x03]), parseBinary(u8([0xd7, 0x01, 0x02, 0x03]))));
    it('raw16',                 ()=>assert.deepEqual(new Uint8Array([0x01, 0x02, 0x03]), parseBinary(u8([0xda, 0x03, 0x00, 0x01, 0x02, 0x03]))));
    it('raw32',                 ()=>assert.deepEqual(new Uint8Array([0x01, 0x02, 0x03]), parseBinary(u8([0xdb, 0x03, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03]))));
    it('array16',               ()=>assert.deepEqual([0, 1, 2], parseBinary(u8([0xdc, 0x03, 0x00, 0x00, 0x01, 0x02]))));
    it('array32',               ()=>assert.deepEqual([0, 1, 2], parseBinary(u8([0xdd, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02]))));
    it('map16',                 ()=>assert.deepEqual({a: 0}, parseBinary(u8([0xde, 0x01, 0x00, 0xa1, 0x61, 0x00, 0x00]))));
    it('map32',                 ()=>assert.deepEqual({a: 0}, parseBinary(u8([0xdf, 0x01, 0x00, 0x00, 0x00, 0xa1, 0x61, 0x00, 0x00]))));
    it('negative fix num',      ()=>assert.deepEqual(-3, parseBinary(u8([0xfd]))));
  });

  describe('loadUTF16', function() {
    var loadUTF16 = krkrsvchk.__get__('loadUTF16');

    it('load',                  ()=>assert.equal('テスト', loadUTF16(new Uint8Array([0xc6, 0x30, 0xb9, 0x30, 0xc8, 0x30]), 0)));
  });

  describe('decompress', function() {
    var decompress = krkrsvchk.__get__('decompress');

    it('mode 1',                ()=>assert.equal('abc', decompress(new Uint8Array([0x01, 0xff, 0xfe, 0x92, 0x00, 0x91, 0x00, 0x93, 0x00]), 0)));
    it('mode 2', function() {
      return assert.equal('abc', decompress(new Uint8Array([
        0x02,
        0xff, 0xfe,
        0x0e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x78, 0x9c, 0x4b, 0x64, 0x48, 0x62, 0x48, 0x66, 0x00, 0x00, 0x04, 0x9a, 0x01, 0x27,
      ]), 0));
    });
  });

  describe('loadANSI', function() {
    var loadANSI = krkrsvchk.__get__('loadANSI');

    it('load',                  ()=>assert.equal('test', loadANSI(new Uint8Array([0x74, 0x65, 0x73, 0x74]), 0)));
  });

  describe('read64', function() {
    var read64 = krkrsvchk.__get__('read64');

    it('read64',                ()=>assert.equal(0xd0c0b0a09080, read64(new Uint8Array([0x80, 0x90, 0xa0, 0xb0, 0xc0, 0xd0, 0x00, 0x00]), 0)));
  });

  describe('parseText', function() {
    var parseText = krkrsvchk.__get__('parseText');

    describe('extra data', function() {
      it('space',               ()=>assert.equal(0, parseText('0 ')));
      it('comment 1',           ()=>assert.equal(0, parseText('0 //')));
      it('comment 2',           ()=>assert.equal(0, parseText('0 /* 1 */')));
      it('extra data',          ()=>assert.throws(()=>parseText('0 1'), e=>e.code==krkrsvchk.PARSE_ERROR));
    });

    describe('const', function() {
      it('array',               ()=>assert.deepEqual([1,2,3], parseText('(const) [1,2,3]')));
      it('string',              ()=>assert.throws(()=>parseText('(const) "abc"'), e=>e.code==krkrsvchk.PARSE_ERROR));
    });

    describe('space', function() {
      it('space',               ()=>assert.equal(0, parseText('  \t\r\n 0')));
      it('block comment',       ()=>assert.equal(1, parseText('/* 0 */ 1')));
      it('block comment nest',  ()=>assert.equal(2, parseText('/* 0 /* 1 \r\n */*/ 2')));
      it('block comment string',()=>assert.equal('a', parseText('/*"*/"a"')));
      it('line comment',        ()=>assert.equal(1, parseText('//0\r\n1')));
    });

    describe('string', function() {
      it('text',                ()=>assert.equal('test', parseText('"test"')));
      it('text escape',         ()=>assert.equal('test\r\n_', parseText('"test\\r\\n\\x5f"')));
      it('text with type',      ()=>assert.equal('test', parseText('string "test"')));
    });

    describe('number', function() {
      it('integer',             ()=>assert.equal(123, parseText('123')));
      it('negative integer',    ()=>assert.equal(-123, parseText('-123')));
      it('real',                ()=>assert.equal(0x1230, parseText('0x1.23p12')));
      it('small real',          ()=>assert.equal(0.5, parseText('0x1.p-1')));
      it('negative real',       ()=>assert.equal(-1, parseText('-0x1.p0')));
      it('zero',                ()=>assert.equal(0, parseText('0')));
      it('integer with type',   ()=>assert.equal(123, parseText('int 123')));
      it('real with type',      ()=>assert.equal(0x1230, parseText('real 0x1.23p12')));
      it('real NaN',            ()=>assert.ok(isNaN(parseText('NaN'))));
      it('real -Infinity',      ()=>assert.equal(-Infinity, parseText('-Infinity')));
      it('real +Infinity',      ()=>assert.equal(+Infinity, parseText('+Infinity')));
      it('real -0.0',           ()=>assert.equal(-0.0, parseText('-0.0')));
      it('real +0.0',           ()=>assert.equal(+0.0, parseText('+0.0')));
    });

    describe('octet', function() {
      it('octet',               ()=>assert.deepEqual(new Uint8Array([0x01, 0x23, 0xcd, 0xef]), parseText('<% 01 23 cd ef %>')));
    });

    describe('array', function() {
      it('array',               ()=>assert.deepEqual(["1", 2, [3], [[]]], parseText('["1",2,[3],[[]]]')));
    });

    describe('dictionary', function() {
      it('dictionary',          ()=>assert.deepEqual({a:1, b:[2], c:{d:{}}}, parseText('%["a"=>1,"b"=>[2],"c"=>%["d"=>%[]]]')));
    });

    describe('void', function() {
      it('void',                ()=>assert.equal(undefined, parseText('void')));
    });

    describe('object', function() {
      it('object',              ()=>assert.equal(undefined, parseText('null /* (object) "(object 0x00000000:0x00000000)" */')));
    });
  });
});
