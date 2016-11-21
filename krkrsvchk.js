var Zlib = require('zlibjs/bin/zlib.min').Zlib;

var OK				= 'OK';
var BYTE_CODE		= 'BYTE_CODE';
var FORMAT_ERROR	= 'FORMAT_ERROR';
var PARSE_ERROR		= 'PARSE_ERROR';
var MACRO			= 'MACRO';

function Result(code, detail)
{
  this.code = code;
  this.detail = detail || '';
}

function formatError(detail)
{
  throw new Result(FORMAT_ERROR, detail);
}

function check(file) {
  try {
    return main(file);
  } catch(e) {
    if (e instanceof Result)
      return e;
    else
      throw e;
  }
}

// TVPExecuteStorage
function main(file)
{
  var byteCodeTag = [0x54,0x4a,0x53,0x32,0x31,0x30,0x30,0x00];  // TJS2100\0
  if (equal(file.subarray(0, byteCodeTag.length), byteCodeTag))
    throw new Result(BYTE_CODE);

  var data = loadBinary(file, data);
  if (data==undefined)
    data = loadText(file, data);
  if (data==undefined)
    throw formatError('file is not binary nor text');

  // マクロが保存されていれば弾く
  if (data.core &&
      data.core.mainConductor &&
      data.core.mainConductor.macros)
  {
    var macro = data.core.mainConductor.macros;
    var detail = '';
    for (var k in macro)
      detail += k + ': ' + macro[k] + '\n';

    if (detail != '')
      throw new Result(MACRO, detail);
  }

  var title = data.core && data.core.caption ? data.core.caption : '';
  var id = data.id ? data.id : '';
  return new Result(OK, 'Title: '+title+'\n'+'ID: '+id);
}

function equal(a, b) {
  if (a.length != b.length)
    return false;
  for (var i=0; i<a.length; i++)
    if (a[i] != b[i])
      return false;
  return true;
}

// tTJSBinarySerializer::Read
function loadBinary(file, data) {
  var binaryTag = [0x4b, 0x42, 0x41, 0x44, 0x31, 0x30, 0x30, 0x00];  // KBAD100\0
  if (!equal(file.subarray(0, binaryTag.length), binaryTag))
    return undefined;

  return parseBinary(file.subarray(8));
}

// tTVPTextReadStream::tTVPTextReadStream
function loadText(file, data) {
  if (file.length<2)
    return false;

  var text;
  if (file[0]==0xff && file[1]==0xfe) {
    text = loadUTF16(file, 2);
  } else if (file[0]==0xfe && file[1]==0xfe) {
    text = decompress(file, 2);
  } else {
    // tTVPTextReadStreamはUTF-8とShift_JISにも対応しているが、
    // tTVPTextWriteStreamが出力するのはUTF-16のみなので、とりあえずANSIのみ
    text = loadANSI(file, 0);
  }

  return parseText(text);
}

function parseBinary(binary) {
  var pos = 0;

  var data;
  try {
    data = parse();
    
    if (pos<binary.length)
      throw pos;
  } catch (e) {
    if (typeof e == 'number') {
      var detail = '(binary pos='+e+') ';
      for (var i=0; i<64; i++)
        if (0<=e+i-8 && e+i-8<binary.length) {
          var t = binary[e+i-8].toString(16);
          if (t.length==1)
            t = '0'+t;
          detail += ' ' + t;
        }
      throw new Result(PARSE_ERROR, detail);
    }
    throw e;
  }
  return data;

  // tTJSBinarySerializer
  function parse() {
    if (pos>=binary.length)
      throw pos;
    var type = binary[pos++];

    if (0x00<=type && type<=0x7f) return type;
    if (0x80<=type && type<=0x8f) return parseDictionary(type-0x80);
    if (0x90<=type && type<=0x9f) return parseArray(type-0x90);
    if (0xa0<=type && type<=0xbf) return parseString(type-0xa0);
    if (type==0xc0) return undefined;
    if (type==0xc1) return undefined;
    if (type==0xc2) return 1;
    if (type==0xc3) return 0;
    if (type==0xc4) return parseString(read(1));
    if (type==0xc5) return parseString(read(2));
    if (type==0xc6) return parseString(read(4));
    if (0xc7<=type && type<=0xc9) throw pos;  // int array?
    if (type==0xca) return parseFloat();
    if (type==0xcb) return parseDouble();
    if (type==0xcc) return read(1);
    if (type==0xcd) return read(2);
    if (type==0xce) return read(4);
    if (type==0xcf) return read(8);
    if (type==0xd0) {var t=read(1); return t<0x80 ? t : t-0x100;}
    if (type==0xd1) {var t=read(2); return t<0x8000 ? t : t-0x10000;}
    if (type==0xd2) {var t=read(4); return t<0x80000000 ? t : t-0x100000000;}
    if (type==0xd3) {var t=read(8); var e=Math.pow(2, 63); return t<e ? t : t-e-e;}
    if (0xd4<=type && type<=0xd9) return parseOctet(type-0xd4);
    if (type==0xda) return parseOctet(read(2));
    if (type==0xdb) return parseOctet(read(4));
    if (type==0xdc) return parseArray(read(2));
    if (type==0xdd) return parseArray(read(4));
    if (type==0xde) return parseDictionary(read(2));
    if (type==0xdf) return parseDictionary(read(4));
    if (0xe0<=type && type<=0xff) return type-0x100;
  }

  function read(len) {
    if (pos+len>binary.length)
      throw pos;
    var r = 0;
    var e = 1;
    for (var i=0; i<len; i++) {
      r += binary[pos++]*e;
      e *= 256;
    }
    return r;
  }

  function parseDictionary(len) {
    var D = Object.create(null);;
    for (var i=0; i<len; i++) {
      var k = parse();
      if (typeof k!='string')
        throw pos;
      if (k in D)
        throw pos;
      D[k] = parse();
    }
    return D;
  }

  function parseArray(len) {
    var A = [];
    for (var i=0; i<len; i++)
      A.push(parse());
    return A;
  }

  function parseString(len) {
    var s = '';
    for (var i=0; i<len; i++) {
      if (pos+2>binary.length)
        throw pos;
      s += String.fromCharCode(binary[pos]|binary[pos+1]<<8);
      pos += 2;
    }
    return s;
  }

  function parseFloat() {
    if (pos+4>binary.length)
      throw pos;
    var f = new DataView(binary.buffer, pos, 4).getFloat32(0, true)
    pos += 4;
    return f;
  }

  function parseDouble() {
    if (pos+8>binary.length)
      throw pos;
    var f = new DataView(binary.buffer, pos, 8).getFloat64(0, true)
    pos += 8;
    return f;
  }

  function parseOctet(len) {
    var A = [];
    for (var i=0; i<len; i++)
      A.push(binary[pos++]);
    return new Uint8Array(A);
  }
}

function loadUTF16(data, pos)
{
  if ((data.length-pos)%2 != 0)
    formatError('odd length UTF-16');

  var result = '';
  for (; pos<data.length; pos+=2)
    result += String.fromCharCode(data[pos]|data[pos+1]<<8);
  return result;
}

function decompress(file, pos)
{
  if (pos+1+2 >= file.length)
    formatError('compressed/ciphered data are too short (mode, original BOM)');
  var mode = file[pos];
  pos++;
  var bom = file.subarray(pos, pos+2);
  pos += 2;

  if (bom[0]!=0xff || bom[1]!=0xfe)
    formatError('not supported original BOM ('+bom[0]+', '+bom[1]+')');

  var data;

  if (mode==1) {
    var d = [];
    for (; pos<file.length; pos++)
      d.push(file[pos]>>1&0x55 | file[pos]<<1&0xaa);
    data = new Uint8Array(d);
  } else if (mode==2) {
    if (pos+8+8 >= file.length)
      formatError('compressed data are too short (mode=2)');

    var compsize = read64(file, pos);
    pos += 8;
    var orgsize = read64(file, pos);
    pos += 8;

    if (pos+compsize != file.length)
      formatError('incorrect compressed data size (compsize='+compsize+', actual='+file.length+')');

    try {
      data = new Zlib.Inflate(file.subarray(pos, pos+compsize)).decompress();
    } catch (e) {
      formatError('failed to inflate ('+e.message+')');
    }

    if (data.length != orgsize)
      formatError('incorrect inflated data size');
  } else
    formatError('invalid mode ('+mode+') in compressed data');

  return loadUTF16(data, 0);
}

function loadANSI(data, pos)
{
  var result = '';
  for (; pos<data.length; pos++) {
    if (data[pos]>=0x80)
      formatError('unsupported character encoding (UTF-8 or Shift_JIS?)');
    result += String.fromCharCode(data[pos]);
  }
  return result;
}

function read64(file, offset)
{
  var value = 0;
  var e = 1;
  for (var i=0; i<8; i++) {
    value += file[offset+i]*e;
    e *= 256;
  }
  return value;
}

// saveStructが保存する
// 文字列、実数、オクテット列、整数、Array、Dictionary, void
// のみ対応
function parseText(text) {
  var pos = 0;

  var data;
  try {
    data = parse();

    parseSpace();
    if (pos<text.length)
      throw pos;

  } catch (e) {
    if (typeof e == 'number') {
      throw new Result(PARSE_ERROR,
        '(text pos='+e+') '+text.substr(Math.max(0, e-8), 64));
    }
    throw e;
  }

  return data;

  function parse()
  {
    parseSpace();

    if (pos>=text.length)
      return pos;
    var c = text[pos];

    // (const)
    var isConst = false;
    if (c=='(') {
      if (text.substr(pos, 7) != '(const)')
        throw pos;
      pos += 7;
      isConst = true;
      parseSpace();
      c = text[pos];
    }

    if (c=='"') {
      if (isConst)
        throw pos;
      return parseString();
    } else if (/[-0-9.]/.test(c)) {
      if (isConst)
        throw pos;
      return parseNumber();
    } else if (c=='<') {
      if (isConst)
        throw pos;
      return parseOctet();
    } else if (c=='[') {
      return parseArray();
    } else if (c=='%') {
      return parseDictionary();
    } else if (c=='v') {
      if (isConst)
        throw pos;
      return parseVoid();
    } else if (c=='n') {
      if (isConst)
        throw pos;
      return parseObject();
    } else {
      throw pos;
    }
  }

  // TJSSkipComment
  function parseSpace() {
    while (/[ \t\r\n/]/.test(text[pos])) {
      if (text.substr(pos, 2)=='/*') {
        pos += 2;
        num = 1;
        while (num>0) {
          if (text.substr(pos, 2)=='/*') {
            pos += 2;
            num++;
          } else if (text.substr(pos, 2)=='*/') {
            pos += 2;
            num--;
          } else
            pos++;
        }
      } else if (text.substr(pos, 2)=='//') {
        pos += 2;
        while (pos<text.length && text[pos]!='\n')
          pos++;
      } else
        pos++;
    }
  }

  // tTJSString::EscapeC
  function parseString() {
    var s = '';
    pos++;
    while (true) {
      if (pos>=text.length)
        throw pos;
      if (text[pos]=='"') {
        pos++;
        break;
      } else if (text[pos]=='\\') {
        var esc = text.substr(pos, 2);
        pos += 2;
        if (false);
        else if (esc=='\\a') s += '\x07';
        else if (esc=='\\b') s += '\x08';
        else if (esc=='\\f') s += '\x0c';
        else if (esc=='\\n') s += '\x0a';
        else if (esc=='\\r') s += '\x0d';
        else if (esc=='\\t') s += '\x09';
        else if (esc=='\\v') s += '\x0b';
        else if (esc=='\\\\') s += '\\';
        else if (esc=='\\\'') s += '\'';
        else if (esc=='\\\"') s += '\"';
        else if (esc=='\\x') {
          var hex = text.substr(pos, 2);
          if (!/[0-9a-f]{2,2}/.test(hex))
            throw pos;
          pos += 2;
          s += String.fromCharCode(parseInt(hex, 16));
          // \x形式の文字の直後に16進数が続くことはない
          if (/[0-9A-Fa-f]/.test(text[pos]))
            throw pos;
        } else
          throw pos;
      } else
        s += text[pos++];
    }
    return s;
  }

  // TJSRealToHexString
  // TJS_tTVInt_to_str
  function parseNumber() {
    // 生成されるのは、0x1.xxxxpnn形式か、10進整数のみ
    if (text[pos]=='0' && /[^0-9x]/.test(text[pos+1])) {
      pos++;
      return 0;
    }

    var sign = 1;
    if (text[pos]=='-') {
      pos++;
      sign = -1;
    }

    var num;
    if (text[pos]=='0') {
      if (text.substr(pos, 4)!='0x1.')
        throw pos;
      pos += 4;

      var sig = '1';
      while (/[0-9A-F]/.test(text[pos]))
        sig += text[pos++];

      if (text[pos++] != 'p')
        throw pos;

      var exp = '';
      if (text[pos]=='-')
        exp += text[pos++];
      while (/[0-9]/.test(text[pos]))
        exp += text[pos++];

      num = parseInt(sig, 16) * Math.pow(2, parseInt(exp)-(sig.length-1)*4);
    } else {
      var t = '';
      while (/[0-9]/.test(text[pos]))
        t += text[pos++];
      num = parseInt(t);
    }

    return sign*num;
  }
  
  // TJSVariantToExpressionString
  function parseOctet() {
    if (text.substr(pos, 3) != '<% ')
      throw pos;
    pos += 3;
    var A = [];
    while (true) {
      if (text[pos]=='%')
        break;
      var hex = text.substr(pos, 2);
      if (!/[0-9a-f]{2,2}/.test(hex))
        throw pos;
      pos += 2;
      A.push(parseInt(hex, 16));
      if (text[pos]!=' ')
        throw pos;
      pos++;
    }
    if (text.substr(pos, 2) != '%>')
      throw pos;
    pos += 2;
    return new Uint8Array(A);
  }

  // tTJSArrayNI::SaveStructuredData
  function parseArray() {
    pos++;
    var A = [];

    parseSpace();
    if (text[pos]==']') {
      pos++;
      return A;
    }

    while (true) {
      A.push(parse());
      parseSpace();
      if (text[pos]==']') {
        pos++;
        return A;
      }
      if (text[pos]!=',')
        throw pos;
      pos++;
    }
  }

  // tTJSDictionaryNI::SaveStructuredData
  function parseDictionary() {
    if (text.substr(pos, 2) != '%[')
      throw pos;
    pos += 2;
    var D = Object.create(null);

    parseSpace();
    if (text[pos]==']') {
      pos++;
      return D;
    }

    while (true) {
      parseSpace();
      if (text[pos]!='"')
        throw pos;

      var k = parseString();
      if (k in D)
        throw pos;

      parseSpace();
      if (text.substr(pos, 2)!='=>')
        throw pos;
      pos += 2;

      var v = parse();
      D[k] = v;

      parseSpace();
      if (text[pos]==']') {
        pos++;
        return D;
      }
      if (text[pos]!=',')
        throw pos;
      pos++;
    }
  }

  function parseVoid() {
    if (text.substr(pos, 4)!='void')
      throw pos;
    pos += 4;
    return undefined;
  }

  function parseObject() {
    // 保存時は'null'になる
    if (text.substr(pos, 4)!='null')
      throw pos;
    pos += 4;
    return undefined;
  }
}

module.exports = {
  check: check,

  OK: OK,
  FORMAT_ERROR: FORMAT_ERROR,
  BYTE_CODE: BYTE_CODE,
  PARSE_ERROR: PARSE_ERROR,
  MACRO: MACRO,

  // for test
  __get__: function(name){return eval(name);},
}
