 # libWexpr.js

libWexpr.js is a [Wexpr](https://github.com/thothonegan/libWexpr) file decoder and encoder libray for JavaScript which can convert a standards compliant text format Wexpr file into a JavaScript object/variable or convert a JavaScript object/variable into a standards compliant text format Wexpr file.

### Features

  - Works with both modern browsers and node.
  - Can force a string value to be encoded as binary data by providing a table of paths.
  - Can encode with pretty print enabled or disabled.
  - Automatically encodes strings that are valid barewords as barewords.
  - Automatically decodes true, false, null barewords as their native JavaScript counterparts and will not encode strings containing these words as barewords.
  - Easy to read error and warning messages in a clang-like format.
```
1:5:Syntax Error: Reference [b] is undefined.
@(a *[b])
    ^~~~
    
1:3:Syntax Error: Expected map key as word, number, or string but instead found array.
@(#() asdf)
  ^~
  
1:7:Syntax Error: Invalid escape sequence.
"asdf \a"
      ^~
```

### Usage

This example covers most of the usages of the library.

```js
// Require library.
require('./libWexpr.js');

// A string containing a valid Wexpr expression.
var chunk = "#(1 2 3 4 5)"

// Call decode by providing it a string containing the Wexpr text.
result = libWexpr.decode(chunk)
// This will return the equivalent of of the json [1, 2, 3, 4, 5].

// The result returned is an array the item in position 0 will be the table and the item in position 1 will be the error is one is returned and null otherwise so you should test against result[1] for error.
if (result[1] != null) {
   console.log("DECODE FAIL")
   console.log(result[1])
} else {
   console.log("DECODE SUCCESS")
   console.log(result[0])
}

// An object to encode into Wexpr.
var obj = {key1: "string", key2: "hi", key3: true, key4: [1, 2, 3], key5: "foo"}

// Call encode by providing it an object or variable. The second and third parameters are optional. The second parameter is pretty print and defaults to false. The third parameter is a map of keys that give the paths to all keys that should be encoded as base64 binary in the output file if they are strings. The paths stem from the root table which is expressed as '-' so -.key1 would equate to obj.key1 in this example.
var result = libWexpr.encode(obj, true, {["-.key1"]: true, ["-.key2"]: true })

// This will return:
/**
@(
	key3 true
	key1 <c3RyaW5n>
	key5 foo
	key2 <aGk=>
	key4 #(
		1
		2
		3
	)
)
**/

// The same rules apply for error checking with the encode function.
if (result[1] != null) {
   console.log("ENCODE FAIL")
   console.log(result[1])
} else {
   console.log("ENCODE SUCCESS")
   console.log(result[0])
}
```