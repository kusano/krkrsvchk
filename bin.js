var krkrsvchk = require('./krkrsvchk');
var fs = require('fs');

if (process.argv.length != 3) {
  console.log('Usage: krkrsvchk savedata.ksd/kdt');
  process.exit(1);
}
var filename = process.argv[2];

var file = new Uint8Array(fs.readFileSync(filename));
var result = krkrsvchk.check(file);

console.log(result.code);

if (result.code==krkrsvchk.OK)
  console.log(filename+' may be safe to load.');
if (result.code==krkrsvchk.BYTE_CODE)
  console.log(filename+' is byte code.');
if (result.code==krkrsvchk.FORMAT_ERROR)
  console.log('Failed to parse. '+filename+' may be custom format.');
if (result.code==krkrsvchk.PARSE_ERROR)
  console.log('Failed to parse. '+filename+' may contain scripts.');
if (result.code==krkrsvchk.MACRO)
  console.log(filename+' contain macros.');

console.log('[detail]');
console.log(result.detail);

process.exit(result.code==krkrsvchk.OK ? 0 : 1);
