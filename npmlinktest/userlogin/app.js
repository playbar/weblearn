// 使用npm link
// 以下指演示使用link 的方法
// 在 usermodule 的目录外边执行 npm link usermodule（此名称为package的名称，不是目录的名称）
// node app.js

const usermodule =require("usermodule");
console.log(usermodule)

