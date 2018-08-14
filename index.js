#!/usr/bin/env node

let program = require('commander')
 

program
  .version('0.1.0')  // TODO: 自动解析 module.json 中的版本
  .option('-i, --input <path>', 'schema 源文件 所在目录')
  .option('-o, --output <path>', 'swift 文件 输出目录')
  .parse(process.argv)


  console.log(`输入目录: ${program.input}`)
  console.log(`输出目录: ${program.output}`)
