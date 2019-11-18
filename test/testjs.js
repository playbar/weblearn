function myFunction()
{
    var bf = new Uint8Array(40);
    for ( var i =0; i < bf.length; ++i )
    {
        bf[i] = i * 2;
    }
    console.log(bf.byteLength);
    var subbf = bf.subarray(4);
    console.log(subbf);
    console.log(subbf.length )
    document.getElementById("demo").innerHTML="我的第一个 JavaScript 函数";

}